import { PrismaClient } from '@prisma/client';
import { CurrencyService } from './currencyService';
import { BudgetService } from './budgetService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface PurchaseCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  budgetLimit?: number;
  budgetCurrency: string;
  approvalRequired: boolean;
  isActive: boolean;
  parent?: PurchaseCategory;
  children?: PurchaseCategory[];
}

export interface CategoryHierarchy {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  budgetLimit?: number;
  budgetCurrency: string;
  approvalRequired: boolean;
  isActive: boolean;
  level: number;
  children?: CategoryHierarchy[];
}

export interface CategorySpendingAnalysis {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  totalSpent: number;
  currency: string;
  budgetLimit?: number;
  utilizationPercentage?: number;
  transactionCount: number;
  averageTransactionAmount: number;
  monthlyBreakdown: Array<{
    month: string;
    amount: number;
    transactionCount: number;
  }>;
}

export interface VendorPaymentTerms {
  vendorId: string;
  vendorName: string;
  paymentTerms: string;
  creditLimit: number;
  creditLimitCurrency: string;
  currentOutstanding: number;
  availableCredit: number;
  paymentHistory: Array<{
    date: Date;
    amount: number;
    currency: string;
    status: string;
  }>;
}

export interface VendorCreditReport {
  vendorId: string;
  vendorName: string;
  creditLimit: number;
  creditLimitCurrency: string;
  currentOutstanding: number;
  availableCredit: number;
  utilizationPercentage: number;
  paymentHistory: Array<{
    invoiceId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    paidDate?: Date;
    daysOverdue?: number;
    status: string;
  }>;
  creditScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PaymentAnalytics {
  totalPayments: number;
  totalAmount: number;
  currency: string;
  averagePaymentAmount: number;
  onTimePaymentPercentage: number;
  averageDaysToPayment: number;
  topVendorsByAmount: Array<{
    vendorId: string;
    vendorName: string;
    totalAmount: number;
    paymentCount: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    amount: number;
    paymentCount: number;
    averageDaysToPayment: number;
  }>;
}

export class FinancialService {
  /**
   * Create purchase category
   */
  static async createPurchaseCategory(data: {
    code: string;
    name: string;
    description?: string;
    parentId?: string;
    budgetLimit?: number;
    budgetCurrency?: string;
    approvalRequired?: boolean;
  }): Promise<PurchaseCategory> {
    try {
      // Validate parent exists if provided
      if (data.parentId) {
        const parent = await prisma.purchaseCategory.findUnique({
          where: { id: data.parentId }
        });
        if (!parent) {
          throw new Error('Parent category not found');
        }
      }

      // Check if code already exists
      const existing = await prisma.purchaseCategory.findUnique({
        where: { code: data.code }
      });
      if (existing) {
        throw new Error('Purchase category code already exists');
      }

      // Validate currency if provided
      if (data.budgetCurrency && !CurrencyService.isValidCurrency(data.budgetCurrency)) {
        throw new Error(`Invalid currency: ${data.budgetCurrency}`);
      }

      const category = await prisma.purchaseCategory.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description,
          parentId: data.parentId,
          budgetLimit: data.budgetLimit,
          budgetCurrency: data.budgetCurrency || 'USD',
          approvalRequired: data.approvalRequired || false
        },
        include: {
          parent: true,
          children: true
        }
      });

      logger.info(`Purchase category created: ${category.code}`);
      return category as PurchaseCategory;
    } catch (error) {
      logger.error('Error creating purchase category:', error);
      throw error;
    }
  }

  /**
   * Get all purchase categories
   */
  static async getAllPurchaseCategories(includeInactive: boolean = false): Promise<PurchaseCategory[]> {
    try {
      const categories = await prisma.purchaseCategory.findMany({
        where: includeInactive ? {} : { isActive: true },
        include: {
          parent: true,
          children: {
            where: includeInactive ? {} : { isActive: true }
          }
        },
        orderBy: { code: 'asc' }
      });

      return categories as PurchaseCategory[];
    } catch (error) {
      logger.error('Error getting purchase categories:', error);
      throw error;
    }
  }

  /**
   * Get purchase category hierarchy
   */
  static async getCategoryHierarchy(): Promise<CategoryHierarchy[]> {
    try {
      const categories = await prisma.purchaseCategory.findMany({
        where: { isActive: true },
        include: {
          children: {
            where: { isActive: true },
            include: {
              children: {
                where: { isActive: true }
              }
            }
          }
        },
        orderBy: { code: 'asc' }
      });

      // Build hierarchy starting from root nodes
      const rootNodes = categories.filter(cat => !cat.parentId);
      return this.buildCategoryHierarchy(rootNodes, 0);
    } catch (error) {
      logger.error('Error getting category hierarchy:', error);
      throw error;
    }
  }

  /**
   * Build hierarchical structure for categories
   */
  private static buildCategoryHierarchy(nodes: any[], level: number): CategoryHierarchy[] {
    return nodes.map(node => ({
      id: node.id,
      code: node.code,
      name: node.name,
      description: node.description,
      parentId: node.parentId,
      budgetLimit: node.budgetLimit,
      budgetCurrency: node.budgetCurrency,
      approvalRequired: node.approvalRequired,
      isActive: node.isActive,
      level,
      children: node.children ? this.buildCategoryHierarchy(node.children, level + 1) : []
    }));
  }

  /**
   * Get purchase category by code
   */
  static async getPurchaseCategoryByCode(code: string): Promise<PurchaseCategory | null> {
    try {
      const category = await prisma.purchaseCategory.findUnique({
        where: { code },
        include: {
          parent: true,
          children: true
        }
      });

      return category as PurchaseCategory | null;
    } catch (error) {
      logger.error('Error getting purchase category by code:', error);
      throw error;
    }
  }

  /**
   * Update purchase category
   */
  static async updatePurchaseCategory(
    id: string,
    data: {
      name?: string;
      description?: string;
      budgetLimit?: number;
      budgetCurrency?: string;
      approvalRequired?: boolean;
      isActive?: boolean;
    }
  ): Promise<PurchaseCategory> {
    try {
      // Validate currency if provided
      if (data.budgetCurrency && !CurrencyService.isValidCurrency(data.budgetCurrency)) {
        throw new Error(`Invalid currency: ${data.budgetCurrency}`);
      }

      const category = await prisma.purchaseCategory.update({
        where: { id },
        data,
        include: {
          parent: true,
          children: true
        }
      });

      logger.info(`Purchase category updated: ${category.code}`);
      return category as PurchaseCategory;
    } catch (error) {
      logger.error('Error updating purchase category:', error);
      throw error;
    }
  }

  /**
   * Get category spending analysis
   */
  static async getCategorySpendingAnalysis(
    vesselId?: string,
    startDate?: Date,
    endDate?: Date,
    currency: string = 'USD'
  ): Promise<CategorySpendingAnalysis[]> {
    try {
      const whereClause: any = {};
      
      if (vesselId) {
        whereClause.vesselId = vesselId;
      }
      
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      // Get spending data from purchase orders grouped by category
      const spendingData = await prisma.purchaseOrder.groupBy({
        by: ['categoryCode'],
        where: {
          ...whereClause,
          status: {
            in: ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'INVOICED', 'PAID']
          }
        },
        _sum: {
          totalAmount: true
        },
        _count: {
          id: true
        },
        _avg: {
          totalAmount: true
        }
      });

      const analysis: CategorySpendingAnalysis[] = [];

      for (const data of spendingData) {
        if (!data.categoryCode) continue;

        // Get category details
        const category = await this.getPurchaseCategoryByCode(data.categoryCode);
        if (!category) continue;

        // Convert to target currency if needed
        let totalSpent = data._sum.totalAmount || 0;
        if (currency !== 'USD') {
          const conversion = await CurrencyService.convertCurrency(totalSpent, 'USD', currency);
          totalSpent = conversion.convertedAmount;
        }

        // Get monthly breakdown
        const monthlyData = await prisma.purchaseOrder.groupBy({
          by: ['createdAt'],
          where: {
            ...whereClause,
            categoryCode: data.categoryCode,
            status: {
              in: ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'INVOICED', 'PAID']
            }
          },
          _sum: {
            totalAmount: true
          },
          _count: {
            id: true
          }
        });

        // Process monthly breakdown (simplified - in real implementation would group by month)
        const monthlyBreakdown = monthlyData.map(month => ({
          month: month.createdAt.toISOString().substring(0, 7), // YYYY-MM format
          amount: month._sum.totalAmount || 0,
          transactionCount: month._count.id
        }));

        const utilizationPercentage = category.budgetLimit 
          ? (totalSpent / category.budgetLimit) * 100 
          : undefined;

        analysis.push({
          categoryId: category.id,
          categoryCode: category.code,
          categoryName: category.name,
          totalSpent,
          currency,
          budgetLimit: category.budgetLimit,
          utilizationPercentage,
          transactionCount: data._count.id,
          averageTransactionAmount: data._avg.totalAmount || 0,
          monthlyBreakdown
        });
      }

      return analysis;
    } catch (error) {
      logger.error('Error getting category spending analysis:', error);
      throw error;
    }
  }

  /**
   * Generate category report
   */
  static async generateCategoryReport(
    period: string,
    vesselId?: string,
    currency: string = 'USD'
  ) {
    try {
      // Parse period (e.g., "2024-Q1", "2024-01")
      const { startDate, endDate } = this.parsePeriod(period);

      const analysis = await this.getCategorySpendingAnalysis(
        vesselId,
        startDate,
        endDate,
        currency
      );

      const totalSpent = analysis.reduce((sum, cat) => sum + cat.totalSpent, 0);
      const totalTransactions = analysis.reduce((sum, cat) => sum + cat.transactionCount, 0);

      return {
        period,
        vesselId,
        currency,
        generatedAt: new Date(),
        summary: {
          totalSpent,
          totalTransactions,
          averageTransactionAmount: totalTransactions > 0 ? totalSpent / totalTransactions : 0,
          categoryCount: analysis.length
        },
        categories: analysis.sort((a, b) => b.totalSpent - a.totalSpent)
      };
    } catch (error) {
      logger.error('Error generating category report:', error);
      throw error;
    }
  }

  /**
   * Parse period string into date range
   */
  private static parsePeriod(period: string): { startDate: Date; endDate: Date } {
    if (period.includes('-Q')) {
      // Quarterly period (e.g., "2024-Q1")
      const [year, quarter] = period.split('-Q');
      const yearNum = parseInt(year);
      const quarterNum = parseInt(quarter);
      
      const startMonth = (quarterNum - 1) * 3;
      const endMonth = quarterNum * 3;
      
      return {
        startDate: new Date(yearNum, startMonth, 1),
        endDate: new Date(yearNum, endMonth, 0) // Last day of previous month
      };
    } else if (period.match(/^\d{4}-\d{2}$/)) {
      // Monthly period (e.g., "2024-01")
      const [year, month] = period.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month) - 1; // JavaScript months are 0-indexed
      
      return {
        startDate: new Date(yearNum, monthNum, 1),
        endDate: new Date(yearNum, monthNum + 1, 0) // Last day of month
      };
    } else {
      throw new Error('Invalid period format. Use YYYY-QN for quarters or YYYY-MM for months');
    }
  }
}

export class VendorPaymentService {
  /**
   * Update vendor payment terms
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
      // Validate currency if provided
      if (data.creditLimitCurrency && !CurrencyService.isValidCurrency(data.creditLimitCurrency)) {
        throw new Error(`Invalid currency: ${data.creditLimitCurrency}`);
      }

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          paymentTerms: data.paymentTerms,
          creditLimit: data.creditLimit,
          creditLimitCurrency: data.creditLimitCurrency
        }
      });

      logger.info(`Vendor payment terms updated: ${vendor.code}`);
      return vendor;
    } catch (error) {
      logger.error('Error updating vendor payment terms:', error);
      throw error;
    }
  }

  /**
   * Get vendor payment terms
   */
  static async getVendorPaymentTerms(vendorId: string): Promise<VendorPaymentTerms> {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
          purchaseOrders: {
            where: {
              status: {
                in: ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'INVOICED']
              }
            },
            select: {
              totalAmount: true,
              currency: true,
              createdAt: true
            }
          }
        }
      });

      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Calculate current outstanding amount
      let currentOutstanding = 0;
      const paymentHistory = [];

      for (const po of vendor.purchaseOrders) {
        // Convert to vendor's credit limit currency
        if (po.currency !== vendor.creditLimitCurrency) {
          const conversion = await CurrencyService.convertCurrency(
            po.totalAmount,
            po.currency,
            vendor.creditLimitCurrency
          );
          currentOutstanding += conversion.convertedAmount;
        } else {
          currentOutstanding += po.totalAmount;
        }

        paymentHistory.push({
          date: po.createdAt,
          amount: po.totalAmount,
          currency: po.currency,
          status: 'OUTSTANDING'
        });
      }

      const availableCredit = (vendor.creditLimit || 0) - currentOutstanding;

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        paymentTerms: vendor.paymentTerms || 'Net 30',
        creditLimit: vendor.creditLimit || 0,
        creditLimitCurrency: vendor.creditLimitCurrency,
        currentOutstanding,
        availableCredit,
        paymentHistory: paymentHistory.slice(0, 10) // Last 10 transactions
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
      
      // Get detailed payment history with invoices
      const invoices = await prisma.invoice.findMany({
        where: {
          purchaseOrder: {
            vendorId
          }
        },
        include: {
          purchaseOrder: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });

      const paymentHistory = invoices.map(invoice => {
        const daysOverdue = invoice.paidDate 
          ? 0 
          : invoice.dueDate 
            ? Math.max(0, Math.floor((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        return {
          invoiceId: invoice.id,
          amount: invoice.totalAmount,
          currency: invoice.currency,
          dueDate: invoice.dueDate || new Date(),
          paidDate: invoice.paidDate,
          daysOverdue,
          status: invoice.paidDate ? 'PAID' : (daysOverdue > 0 ? 'OVERDUE' : 'PENDING')
        };
      });

      // Calculate credit score based on payment history
      const paidOnTime = paymentHistory.filter(p => p.status === 'PAID' && (p.daysOverdue || 0) <= 5).length;
      const totalPaid = paymentHistory.filter(p => p.status === 'PAID').length;
      const onTimePercentage = totalPaid > 0 ? (paidOnTime / totalPaid) * 100 : 100;
      
      let creditScore = Math.min(100, Math.max(0, onTimePercentage));
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      
      if (creditScore < 70) riskLevel = 'HIGH';
      else if (creditScore < 85) riskLevel = 'MEDIUM';

      const utilizationPercentage = paymentTerms.creditLimit > 0 
        ? (paymentTerms.currentOutstanding / paymentTerms.creditLimit) * 100 
        : 0;

      return {
        vendorId: paymentTerms.vendorId,
        vendorName: paymentTerms.vendorName,
        creditLimit: paymentTerms.creditLimit,
        creditLimitCurrency: paymentTerms.creditLimitCurrency,
        currentOutstanding: paymentTerms.currentOutstanding,
        availableCredit: paymentTerms.availableCredit,
        utilizationPercentage,
        paymentHistory,
        creditScore,
        riskLevel
      };
    } catch (error) {
      logger.error('Error generating vendor credit report:', error);
      throw error;
    }
  }

  /**
   * Check credit availability
   */
  static async checkCreditAvailability(
    vendorId: string,
    amount: number,
    currency: string
  ): Promise<{
    available: boolean;
    availableCredit: number;
    requestedAmount: number;
    currency: string;
    message: string;
  }> {
    try {
      const paymentTerms = await this.getVendorPaymentTerms(vendorId);
      
      // Convert requested amount to vendor's credit limit currency
      let convertedAmount = amount;
      if (currency !== paymentTerms.creditLimitCurrency) {
        const conversion = await CurrencyService.convertCurrency(
          amount,
          currency,
          paymentTerms.creditLimitCurrency
        );
        convertedAmount = conversion.convertedAmount;
      }

      const available = paymentTerms.availableCredit >= convertedAmount;

      return {
        available,
        availableCredit: paymentTerms.availableCredit,
        requestedAmount: convertedAmount,
        currency: paymentTerms.creditLimitCurrency,
        message: available 
          ? `Credit available. Remaining: ${paymentTerms.availableCredit} ${paymentTerms.creditLimitCurrency}`
          : `Insufficient credit. Required: ${convertedAmount} ${paymentTerms.creditLimitCurrency}, Available: ${paymentTerms.availableCredit} ${paymentTerms.creditLimitCurrency}`
      };
    } catch (error) {
      logger.error('Error checking credit availability:', error);
      throw error;
    }
  }

  /**
   * Get vendors with credit issues
   */
  static async getVendorsWithCreditIssues() {
    try {
      const vendors = await prisma.vendor.findMany({
        where: {
          isActive: true,
          creditLimit: { gt: 0 }
        },
        include: {
          purchaseOrders: {
            where: {
              status: {
                in: ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'INVOICED']
              }
            }
          }
        }
      });

      const issues = [];

      for (const vendor of vendors) {
        const paymentTerms = await this.getVendorPaymentTerms(vendor.id);
        const utilizationPercentage = paymentTerms.creditLimit > 0 
          ? (paymentTerms.currentOutstanding / paymentTerms.creditLimit) * 100 
          : 0;

        if (utilizationPercentage > 90 || paymentTerms.availableCredit < 0) {
          issues.push({
            vendorId: vendor.id,
            vendorName: vendor.name,
            creditLimit: paymentTerms.creditLimit,
            currentOutstanding: paymentTerms.currentOutstanding,
            availableCredit: paymentTerms.availableCredit,
            utilizationPercentage,
            currency: paymentTerms.creditLimitCurrency,
            issueType: paymentTerms.availableCredit < 0 ? 'OVER_LIMIT' : 'HIGH_UTILIZATION'
          });
        }
      }

      return issues;
    } catch (error) {
      logger.error('Error getting vendors with credit issues:', error);
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
      
      if (startDate || endDate) {
        whereClause.paidDate = {};
        if (startDate) whereClause.paidDate.gte = startDate;
        if (endDate) whereClause.paidDate.lte = endDate;
      }

      // Get paid invoices
      const paidInvoices = await prisma.invoice.findMany({
        where: {
          ...whereClause,
          paidDate: { not: null }
        },
        include: {
          purchaseOrder: {
            include: {
              vendor: true
            }
          }
        }
      });

      let totalAmount = 0;
      let totalDaysToPayment = 0;
      let onTimePayments = 0;
      const vendorTotals = new Map<string, { name: string; amount: number; count: number }>();
      const monthlyData = new Map<string, { amount: number; count: number; totalDays: number }>();

      for (const invoice of paidInvoices) {
        // Convert to target currency
        let amount = invoice.totalAmount;
        if (invoice.currency !== currency) {
          const conversion = await CurrencyService.convertCurrency(
            amount,
            invoice.currency,
            currency
          );
          amount = conversion.convertedAmount;
        }

        totalAmount += amount;

        // Calculate days to payment
        const daysToPayment = invoice.dueDate && invoice.paidDate
          ? Math.floor((invoice.paidDate.getTime() - invoice.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        totalDaysToPayment += daysToPayment;

        // Check if paid on time (within payment terms, assume 30 days if no due date)
        const paymentTermDays = 30; // Could be extracted from vendor payment terms
        if (daysToPayment <= paymentTermDays) {
          onTimePayments++;
        }

        // Track vendor totals
        const vendorId = invoice.purchaseOrder.vendorId;
        const vendorName = invoice.purchaseOrder.vendor.name;
        const existing = vendorTotals.get(vendorId) || { name: vendorName, amount: 0, count: 0 };
        vendorTotals.set(vendorId, {
          name: vendorName,
          amount: existing.amount + amount,
          count: existing.count + 1
        });

        // Track monthly data
        const month = invoice.paidDate!.toISOString().substring(0, 7); // YYYY-MM
        const monthlyExisting = monthlyData.get(month) || { amount: 0, count: 0, totalDays: 0 };
        monthlyData.set(month, {
          amount: monthlyExisting.amount + amount,
          count: monthlyExisting.count + 1,
          totalDays: monthlyExisting.totalDays + daysToPayment
        });
      }

      const totalPayments = paidInvoices.length;
      const averagePaymentAmount = totalPayments > 0 ? totalAmount / totalPayments : 0;
      const onTimePaymentPercentage = totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;
      const averageDaysToPayment = totalPayments > 0 ? totalDaysToPayment / totalPayments : 0;

      // Top vendors by amount
      const topVendorsByAmount = Array.from(vendorTotals.entries())
        .map(([vendorId, data]) => ({
          vendorId,
          vendorName: data.name,
          totalAmount: data.amount,
          paymentCount: data.count
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);

      // Monthly trends
      const monthlyTrends = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          amount: data.amount,
          paymentCount: data.count,
          averageDaysToPayment: data.count > 0 ? data.totalDays / data.count : 0
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        totalPayments,
        totalAmount,
        currency,
        averagePaymentAmount,
        onTimePaymentPercentage,
        averageDaysToPayment,
        topVendorsByAmount,
        monthlyTrends
      };
    } catch (error) {
      logger.error('Error getting payment analytics:', error);
      throw error;
    }
  }
}

export class FinancialReportingService {
  /**
   * Generate financial report
   */
  static async generateFinancialReport(
    reportType: string,
    period: string,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ) {
    try {
      const { startDate, endDate } = BudgetService.parsePeriod(period);

      switch (reportType) {
        case 'SPENDING':
          return await this.generateSpendingReport(startDate, endDate, vesselId, baseCurrency);
        case 'BUDGET':
          return await this.generateBudgetReport(startDate, endDate, vesselId, baseCurrency);
        case 'VARIANCE':
          return await this.generateVarianceReport(startDate, endDate, vesselId, baseCurrency);
        case 'CASH_FLOW':
          return await this.generateCashFlowReport(startDate, endDate, vesselId, baseCurrency);
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }
    } catch (error) {
      logger.error('Error generating financial report:', error);
      throw error;
    }
  }

  /**
   * Generate spending report
   */
  private static async generateSpendingReport(
    startDate: Date,
    endDate: Date,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ) {
    const categoryAnalysis = await FinancialService.getCategorySpendingAnalysis(
      vesselId,
      startDate,
      endDate,
      baseCurrency
    );

    const totalSpent = categoryAnalysis.reduce((sum, cat) => sum + cat.totalSpent, 0);
    const totalTransactions = categoryAnalysis.reduce((sum, cat) => sum + cat.transactionCount, 0);

    return {
      reportType: 'SPENDING',
      period: `${startDate.toISOString().substring(0, 10)} to ${endDate.toISOString().substring(0, 10)}`,
      vesselId,
      baseCurrency,
      generatedAt: new Date(),
      summary: {
        totalSpent,
        totalTransactions,
        averageTransactionAmount: totalTransactions > 0 ? totalSpent / totalTransactions : 0
      },
      categories: categoryAnalysis.sort((a, b) => b.totalSpent - a.totalSpent)
    };
  }

  /**
   * Generate budget report
   */
  private static async generateBudgetReport(
    startDate: Date,
    endDate: Date,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ) {
    // This would need to be implemented based on budget data
    // For now, return a placeholder
    return {
      reportType: 'BUDGET',
      period: `${startDate.toISOString().substring(0, 10)} to ${endDate.toISOString().substring(0, 10)}`,
      vesselId,
      baseCurrency,
      generatedAt: new Date(),
      message: 'Budget report implementation pending'
    };
  }

  /**
   * Generate variance report
   */
  private static async generateVarianceReport(
    startDate: Date,
    endDate: Date,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ) {
    // This would compare actual spending vs budget
    // For now, return a placeholder
    return {
      reportType: 'VARIANCE',
      period: `${startDate.toISOString().substring(0, 10)} to ${endDate.toISOString().substring(0, 10)}`,
      vesselId,
      baseCurrency,
      generatedAt: new Date(),
      message: 'Variance report implementation pending'
    };
  }

  /**
   * Generate cash flow report
   */
  private static async generateCashFlowReport(
    startDate: Date,
    endDate: Date,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ) {
    // This would show cash inflows and outflows
    // For now, return a placeholder
    return {
      reportType: 'CASH_FLOW',
      period: `${startDate.toISOString().substring(0, 10)} to ${endDate.toISOString().substring(0, 10)}`,
      vesselId,
      baseCurrency,
      generatedAt: new Date(),
      message: 'Cash flow report implementation pending'
    };
  }

  /**
   * Apply seasonal budget adjustments
   */
  static async applySeasonalBudgetAdjustments(
    adjustments: Array<{
      vesselId?: string;
      category: string;
      quarter: string;
      adjustmentPercentage: number;
      reason: string;
    }>
  ) {
    const results = [];

    for (const adjustment of adjustments) {
      try {
        // Find budgets matching the criteria
        const { startDate, endDate } = this.parseQuarter(adjustment.quarter);
        
        const budgets = await prisma.budget.findMany({
          where: {
            vesselId: adjustment.vesselId,
            category: adjustment.category,
            startDate: { gte: startDate },
            endDate: { lte: endDate }
          }
        });

        for (const budget of budgets) {
          const originalAmount = budget.amount;
          const adjustedAmount = originalAmount * (1 + adjustment.adjustmentPercentage / 100);
          
          await prisma.budget.update({
            where: { id: budget.id },
            data: { amount: adjustedAmount }
          });

          results.push({
            budgetId: budget.id,
            originalAmount,
            adjustedAmount,
            adjustmentPercentage: adjustment.adjustmentPercentage,
            reason: adjustment.reason
          });

          logger.info(
            `Applied ${adjustment.adjustmentPercentage}% seasonal adjustment to budget ${budget.id}: ${originalAmount} -> ${adjustedAmount}`
          );
        }
      } catch (error) {
        logger.error(`Error applying seasonal adjustment:`, error);
        results.push({
          error: error instanceof Error ? error.message : 'Unknown error',
          adjustment
        });
      }
    }

    return results;
  }

  /**
   * Parse quarter string
   */
  private static parseQuarter(quarter: string): { startDate: Date; endDate: Date } {
    const [year, q] = quarter.split('-Q');
    const yearNum = parseInt(year);
    const quarterNum = parseInt(q);
    
    const startMonth = (quarterNum - 1) * 3;
    const endMonth = quarterNum * 3;
    
    return {
      startDate: new Date(yearNum, startMonth, 1),
      endDate: new Date(yearNum, endMonth, 0)
    };
  }

  /**
   * Generate financial dashboard
   */
  static async generateFinancialDashboard(
    vesselId?: string,
    baseCurrency: string = 'USD'
  ) {
    try {
      // Get current month data
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get spending analysis for current month
      const currentMonthSpending = await FinancialService.getCategorySpendingAnalysis(
        vesselId,
        startOfMonth,
        endOfMonth,
        baseCurrency
      );

      // Get budget summary
      const budgetSummary = vesselId 
        ? await BudgetService.getVesselBudgetSummary(vesselId, undefined, baseCurrency)
        : null;

      // Get payment analytics
      const paymentAnalytics = await VendorPaymentService.getPaymentAnalytics(
        startOfMonth,
        endOfMonth,
        baseCurrency
      );

      const totalCurrentSpending = currentMonthSpending.reduce((sum, cat) => sum + cat.totalSpent, 0);

      return {
        period: `${startOfMonth.toISOString().substring(0, 10)} to ${endOfMonth.toISOString().substring(0, 10)}`,
        vesselId,
        baseCurrency,
        generatedAt: new Date(),
        summary: {
          currentMonthSpending: totalCurrentSpending,
          totalBudget: budgetSummary?.totalBudget || 0,
          budgetUtilization: budgetSummary?.overallUtilization || 0,
          totalPayments: paymentAnalytics.totalPayments,
          onTimePaymentPercentage: paymentAnalytics.onTimePaymentPercentage
        },
        currentMonthSpending,
        budgetSummary,
        paymentAnalytics: {
          totalPayments: paymentAnalytics.totalPayments,
          totalAmount: paymentAnalytics.totalAmount,
          onTimePaymentPercentage: paymentAnalytics.onTimePaymentPercentage,
          averageDaysToPayment: paymentAnalytics.averageDaysToPayment
        }
      };
    } catch (error) {
      logger.error('Error generating financial dashboard:', error);
      throw error;
    }
  }
}