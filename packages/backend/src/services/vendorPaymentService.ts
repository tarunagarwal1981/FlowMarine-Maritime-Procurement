import { PrismaClient } from '@prisma/client';
import { CurrencyService } from './currencyService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface VendorPaymentTerms {
  vendorId: string;
  paymentTerms: string; // e.g., "NET30", "NET60", "COD", "2/10 NET30"
  creditLimit: number;
  creditLimitCurrency: string;
  currentBalance: number;
  availableCredit: number;
  paymentHistory: PaymentHistoryItem[];
  averagePaymentDays: number;
  onTimePaymentPercentage: number;
  lastPaymentDate?: Date;
}

export interface PaymentHistoryItem {
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  currency: string;
  invoiceDate: Date;
  dueDate: Date;
  paidDate?: Date;
  paidAmount?: number;
  paymentDays?: number;
  isOnTime: boolean;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL';
}

export interface VendorCreditReport {
  vendorId: string;
  vendorName: string;
  creditLimit: number;
  creditLimitCurrency: string;
  currentBalance: number;
  availableCredit: number;
  creditUtilization: number;
  paymentRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendations: string[];
}

export interface PaymentAnalytics {
  totalVendors: number;
  totalOutstanding: number;
  currency: string;
  averagePaymentDays: number;
  onTimePaymentRate: number;
  overdueInvoices: number;
  overdueAmount: number;
  paymentTermsBreakdown: Array<{
    terms: string;
    vendorCount: number;
    totalAmount: number;
  }>;
  topVendorsBySpending: Array<{
    vendorId: string;
    vendorName: string;
    totalSpent: number;
    invoiceCount: number;
  }>;
}

export class VendorPaymentService {
  /**
   * Update vendor payment terms and credit limit
   */
  static async updateVendorPaymentTerms(
    vendorId: string,
    data: {
      paymentTerms?: string;
      creditLimit?: number;
      creditLimitCurrency?: string;
    }
  ) {
    try {
      const updateData: any = {};
      
      if (data.paymentTerms) {
        updateData.paymentTerms = data.paymentTerms;
      }
      
      if (data.creditLimit !== undefined) {
        updateData.creditLimit = data.creditLimit;
      }
      
      if (data.creditLimitCurrency) {
        updateData.creditLimitCurrency = data.creditLimitCurrency;
      }

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: updateData
      });

      logger.info(`Updated payment terms for vendor ${vendorId}: ${data.paymentTerms}`);
      return vendor;
    } catch (error) {
      logger.error('Error updating vendor payment terms:', error);
      throw error;
    }
  }

  /**
   * Get vendor payment terms and credit status
   */
  static async getVendorPaymentTerms(vendorId: string): Promise<VendorPaymentTerms> {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
          invoices: {
            include: {
              purchaseOrder: true
            },
            orderBy: { invoiceDate: 'desc' }
          }
        }
      });

      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Calculate current balance from unpaid invoices
      const unpaidInvoices = vendor.invoices.filter(inv => 
        inv.status !== 'PAID' && inv.status !== 'REJECTED'
      );
      
      const currentBalance = unpaidInvoices.reduce((sum, inv) => {
        // Convert to vendor's credit limit currency if different
        if (inv.currency === vendor.creditLimitCurrency) {
          return sum + inv.totalAmount;
        } else {
          // In a real implementation, we'd use CurrencyService here
          return sum + (inv.totalAmount * inv.exchangeRate);
        }
      }, 0);

      const availableCredit = Math.max(0, (vendor.creditLimit || 0) - currentBalance);

      // Build payment history
      const paymentHistory: PaymentHistoryItem[] = vendor.invoices.map(invoice => {
        const paymentDays = invoice.paidDate 
          ? Math.ceil((invoice.paidDate.getTime() - invoice.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
          : undefined;
        
        const dueDays = this.parsePaymentTerms(vendor.paymentTerms || 'NET30');
        const dueDate = new Date(invoice.invoiceDate);
        dueDate.setDate(dueDate.getDate() + dueDays);
        
        const isOnTime = invoice.paidDate ? invoice.paidDate <= dueDate : new Date() <= dueDate;
        
        let status: PaymentHistoryItem['status'] = 'PENDING';
        if (invoice.status === 'PAID') {
          status = 'PAID';
        } else if (invoice.paidAmount && invoice.paidAmount < invoice.totalAmount) {
          status = 'PARTIAL';
        } else if (new Date() > dueDate) {
          status = 'OVERDUE';
        }

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceAmount: invoice.totalAmount,
          currency: invoice.currency,
          invoiceDate: invoice.invoiceDate,
          dueDate,
          paidDate: invoice.paidDate,
          paidAmount: invoice.paidAmount,
          paymentDays,
          isOnTime,
          status
        };
      });

      // Calculate payment metrics
      const paidInvoices = paymentHistory.filter(p => p.status === 'PAID' && p.paymentDays);
      const averagePaymentDays = paidInvoices.length > 0
        ? paidInvoices.reduce((sum, p) => sum + (p.paymentDays || 0), 0) / paidInvoices.length
        : 0;
      
      const onTimePayments = paidInvoices.filter(p => p.isOnTime).length;
      const onTimePaymentPercentage = paidInvoices.length > 0
        ? (onTimePayments / paidInvoices.length) * 100
        : 100;

      const lastPaymentDate = paidInvoices.length > 0
        ? paidInvoices[0].paidDate
        : undefined;

      return {
        vendorId,
        paymentTerms: vendor.paymentTerms || 'NET30',
        creditLimit: vendor.creditLimit || 0,
        creditLimitCurrency: vendor.creditLimitCurrency,
        currentBalance,
        availableCredit,
        paymentHistory,
        averagePaymentDays,
        onTimePaymentPercentage,
        lastPaymentDate
      };
    } catch (error) {
      logger.error('Error getting vendor payment terms:', error);
      throw error;
    }
  }  
/**
   * Generate vendor credit report
   */
  static async generateVendorCreditReport(vendorId: string): Promise<VendorCreditReport> {
    try {
      const paymentTerms = await this.getVendorPaymentTerms(vendorId);
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId }
      });

      if (!vendor) {
        throw new Error('Vendor not found');
      }

      const creditUtilization = paymentTerms.creditLimit > 0
        ? (paymentTerms.currentBalance / paymentTerms.creditLimit) * 100
        : 0;

      // Determine payment rating
      let paymentRating: VendorCreditReport['paymentRating'] = 'EXCELLENT';
      if (paymentTerms.onTimePaymentPercentage < 95) {
        paymentRating = 'GOOD';
      }
      if (paymentTerms.onTimePaymentPercentage < 85) {
        paymentRating = 'FAIR';
      }
      if (paymentTerms.onTimePaymentPercentage < 70) {
        paymentRating = 'POOR';
      }

      // Determine risk level
      let riskLevel: VendorCreditReport['riskLevel'] = 'LOW';
      if (creditUtilization > 80 || paymentTerms.onTimePaymentPercentage < 85) {
        riskLevel = 'MEDIUM';
      }
      if (creditUtilization > 95 || paymentTerms.onTimePaymentPercentage < 70) {
        riskLevel = 'HIGH';
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (creditUtilization > 90) {
        recommendations.push('Consider increasing credit limit or requiring prepayment');
      }
      if (paymentTerms.onTimePaymentPercentage < 80) {
        recommendations.push('Monitor payment behavior closely and consider shorter payment terms');
      }
      if (paymentTerms.averagePaymentDays > this.parsePaymentTerms(paymentTerms.paymentTerms) + 10) {
        recommendations.push('Vendor consistently pays late - consider payment penalties');
      }
      if (paymentTerms.availableCredit < paymentTerms.creditLimit * 0.2) {
        recommendations.push('Low available credit - review credit limit or payment schedule');
      }

      return {
        vendorId,
        vendorName: vendor.name,
        creditLimit: paymentTerms.creditLimit,
        creditLimitCurrency: paymentTerms.creditLimitCurrency,
        currentBalance: paymentTerms.currentBalance,
        availableCredit: paymentTerms.availableCredit,
        creditUtilization,
        paymentRating,
        riskLevel,
        recommendations
      };
    } catch (error) {
      logger.error('Error generating vendor credit report:', error);
      throw error;
    }
  }

  /**
   * Get payment analytics
   */
  static async getPaymentAnalytics(
    startDate?: Date,
    endDate?: Date,
    currency: string = 'USD'
  ): Promise<PaymentAnalytics> {
    try {
      const whereClause: any = {};
      
      if (startDate && endDate) {
        whereClause.invoiceDate = {
          gte: startDate,
          lte: endDate
        };
      }

      // Get all invoices in the period
      const invoices = await prisma.invoice.findMany({
        where: whereClause,
        include: {
          purchaseOrder: {
            include: {
              vendor: true
            }
          }
        }
      });

      // Get unique vendors
      const vendorIds = [...new Set(invoices.map(inv => inv.purchaseOrder.vendor.id))];
      const totalVendors = vendorIds.length;

      // Calculate total outstanding
      const outstandingInvoices = invoices.filter(inv => 
        inv.status !== 'PAID' && inv.status !== 'REJECTED'
      );
      
      let totalOutstanding = 0;
      for (const invoice of outstandingInvoices) {
        if (invoice.currency === currency) {
          totalOutstanding += invoice.totalAmount;
        } else {
          // Convert using exchange rate
          totalOutstanding += invoice.totalAmount * invoice.exchangeRate;
        }
      }

      // Calculate payment metrics
      const paidInvoices = invoices.filter(inv => inv.status === 'PAID' && inv.paidDate);
      let totalPaymentDays = 0;
      let onTimePayments = 0;

      for (const invoice of paidInvoices) {
        const paymentDays = Math.ceil(
          (invoice.paidDate!.getTime() - invoice.invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalPaymentDays += paymentDays;

        const vendor = invoice.purchaseOrder.vendor;
        const dueDays = this.parsePaymentTerms(vendor.paymentTerms || 'NET30');
        const dueDate = new Date(invoice.invoiceDate);
        dueDate.setDate(dueDate.getDate() + dueDays);

        if (invoice.paidDate! <= dueDate) {
          onTimePayments++;
        }
      }

      const averagePaymentDays = paidInvoices.length > 0 ? totalPaymentDays / paidInvoices.length : 0;
      const onTimePaymentRate = paidInvoices.length > 0 ? (onTimePayments / paidInvoices.length) * 100 : 100;

      // Count overdue invoices
      const now = new Date();
      let overdueInvoices = 0;
      let overdueAmount = 0;

      for (const invoice of outstandingInvoices) {
        const vendor = invoice.purchaseOrder.vendor;
        const dueDays = this.parsePaymentTerms(vendor.paymentTerms || 'NET30');
        const dueDate = new Date(invoice.invoiceDate);
        dueDate.setDate(dueDate.getDate() + dueDays);

        if (now > dueDate) {
          overdueInvoices++;
          if (invoice.currency === currency) {
            overdueAmount += invoice.totalAmount;
          } else {
            overdueAmount += invoice.totalAmount * invoice.exchangeRate;
          }
        }
      }

      // Payment terms breakdown
      const paymentTermsMap = new Map<string, { count: number; amount: number }>();
      
      for (const invoice of invoices) {
        const terms = invoice.purchaseOrder.vendor.paymentTerms || 'NET30';
        const existing = paymentTermsMap.get(terms) || { count: 0, amount: 0 };
        
        let amount = invoice.totalAmount;
        if (invoice.currency !== currency) {
          amount = invoice.totalAmount * invoice.exchangeRate;
        }

        paymentTermsMap.set(terms, {
          count: existing.count + 1,
          amount: existing.amount + amount
        });
      }

      const paymentTermsBreakdown = Array.from(paymentTermsMap.entries()).map(([terms, data]) => ({
        terms,
        vendorCount: data.count,
        totalAmount: data.amount
      }));

      // Top vendors by spending
      const vendorSpendingMap = new Map<string, { name: string; amount: number; count: number }>();
      
      for (const invoice of invoices) {
        const vendor = invoice.purchaseOrder.vendor;
        const existing = vendorSpendingMap.get(vendor.id) || { name: vendor.name, amount: 0, count: 0 };
        
        let amount = invoice.totalAmount;
        if (invoice.currency !== currency) {
          amount = invoice.totalAmount * invoice.exchangeRate;
        }

        vendorSpendingMap.set(vendor.id, {
          name: vendor.name,
          amount: existing.amount + amount,
          count: existing.count + 1
        });
      }

      const topVendorsBySpending = Array.from(vendorSpendingMap.entries())
        .map(([vendorId, data]) => ({
          vendorId,
          vendorName: data.name,
          totalSpent: data.amount,
          invoiceCount: data.count
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      return {
        totalVendors,
        totalOutstanding,
        currency,
        averagePaymentDays,
        onTimePaymentRate,
        overdueInvoices,
        overdueAmount,
        paymentTermsBreakdown,
        topVendorsBySpending
      };
    } catch (error) {
      logger.error('Error getting payment analytics:', error);
      throw error;
    }
  }  /
**
   * Check credit availability for vendor
   */
  static async checkCreditAvailability(
    vendorId: string,
    amount: number,
    currency: string
  ): Promise<{
    available: boolean;
    availableCredit: number;
    requiredAmount: number;
    creditUtilization: number;
    message: string;
  }> {
    try {
      const paymentTerms = await this.getVendorPaymentTerms(vendorId);
      
      // Convert amount to vendor's credit limit currency if different
      let requiredAmount = amount;
      if (currency !== paymentTerms.creditLimitCurrency) {
        const conversion = await CurrencyService.convertCurrency(
          amount,
          currency,
          paymentTerms.creditLimitCurrency
        );
        requiredAmount = conversion.convertedAmount;
      }

      const available = paymentTerms.availableCredit >= requiredAmount;
      const newBalance = paymentTerms.currentBalance + requiredAmount;
      const creditUtilization = paymentTerms.creditLimit > 0 
        ? (newBalance / paymentTerms.creditLimit) * 100 
        : 0;

      let message: string;
      if (available) {
        message = `Credit available. Remaining credit: ${paymentTerms.availableCredit - requiredAmount} ${paymentTerms.creditLimitCurrency}`;
      } else {
        message = `Insufficient credit. Required: ${requiredAmount} ${paymentTerms.creditLimitCurrency}, Available: ${paymentTerms.availableCredit} ${paymentTerms.creditLimitCurrency}`;
      }

      return {
        available,
        availableCredit: paymentTerms.availableCredit,
        requiredAmount,
        creditUtilization,
        message
      };
    } catch (error) {
      logger.error('Error checking credit availability:', error);
      return {
        available: false,
        availableCredit: 0,
        requiredAmount: amount,
        creditUtilization: 100,
        message: 'Error checking credit availability'
      };
    }
  }

  /**
   * Parse payment terms to get number of days
   */
  private static parsePaymentTerms(terms: string): number {
    const upperTerms = terms.toUpperCase();
    
    if (upperTerms === 'COD' || upperTerms === 'CASH ON DELIVERY') {
      return 0;
    } else if (upperTerms.includes('NET')) {
      const match = upperTerms.match(/NET\s*(\d+)/);
      return match ? parseInt(match[1]) : 30;
    } else if (upperTerms.includes('/')) {
      // Terms like "2/10 NET30" - return the NET days
      const match = upperTerms.match(/NET\s*(\d+)/);
      return match ? parseInt(match[1]) : 30;
    } else if (upperTerms.includes('IMMEDIATE')) {
      return 0;
    } else {
      // Default to 30 days
      return 30;
    }
  }

  /**
   * Get vendors with credit issues
   */
  static async getVendorsWithCreditIssues(): Promise<Array<{
    vendorId: string;
    vendorName: string;
    issue: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    creditUtilization: number;
    overdueAmount: number;
  }>> {
    try {
      const vendors = await prisma.vendor.findMany({
        where: { isActive: true },
        include: {
          invoices: {
            where: {
              status: { in: ['RECEIVED', 'UNDER_REVIEW', 'APPROVED'] }
            }
          }
        }
      });

      const issues = [];

      for (const vendor of vendors) {
        const paymentTerms = await this.getVendorPaymentTerms(vendor.id);
        const creditUtilization = vendor.creditLimit > 0 
          ? (paymentTerms.currentBalance / vendor.creditLimit) * 100 
          : 0;

        // Check for high credit utilization
        if (creditUtilization > 90) {
          issues.push({
            vendorId: vendor.id,
            vendorName: vendor.name,
            issue: `High credit utilization: ${creditUtilization.toFixed(1)}%`,
            severity: 'HIGH' as const,
            creditUtilization,
            overdueAmount: 0
          });
        } else if (creditUtilization > 75) {
          issues.push({
            vendorId: vendor.id,
            vendorName: vendor.name,
            issue: `Moderate credit utilization: ${creditUtilization.toFixed(1)}%`,
            severity: 'MEDIUM' as const,
            creditUtilization,
            overdueAmount: 0
          });
        }

        // Check for overdue payments
        const overdueInvoices = paymentTerms.paymentHistory.filter(p => p.status === 'OVERDUE');
        if (overdueInvoices.length > 0) {
          const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0);
          
          issues.push({
            vendorId: vendor.id,
            vendorName: vendor.name,
            issue: `${overdueInvoices.length} overdue invoices totaling ${overdueAmount} ${vendor.creditLimitCurrency}`,
            severity: overdueAmount > vendor.creditLimit * 0.5 ? 'HIGH' : 'MEDIUM',
            creditUtilization,
            overdueAmount
          });
        }

        // Check for poor payment history
        if (paymentTerms.onTimePaymentPercentage < 70) {
          issues.push({
            vendorId: vendor.id,
            vendorName: vendor.name,
            issue: `Poor payment history: ${paymentTerms.onTimePaymentPercentage.toFixed(1)}% on-time payments`,
            severity: paymentTerms.onTimePaymentPercentage < 50 ? 'HIGH' : 'MEDIUM',
            creditUtilization,
            overdueAmount: 0
          });
        }
      }

      return issues.sort((a, b) => {
        const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      logger.error('Error getting vendors with credit issues:', error);
      return [];
    }
  }
}