import { PrismaClient } from '@prisma/client';
import { CurrencyService } from './currencyService';
import { BudgetService } from './budgetService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface FinancialReport {
  reportId: string;
  reportType: string;
  period: string;
  generatedAt: Date;
  baseCurrency: string;
  summary: FinancialSummary;
  details: any;
}

export interface FinancialSummary {
  totalSpending: number;
  totalBudget: number;
  budgetUtilization: number;
  currencyBreakdown: CurrencyBreakdown[];
  categoryBreakdown: CategoryBreakdown[];
  vesselBreakdown: VesselBreakdown[];
}

export interface CurrencyBreakdown {
  currency: string;
  amount: number;
  percentage: number;
  exchangeRate: number;
  convertedAmount: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  budgetAmount?: number;
  budgetUtilization?: number;
  transactionCount: number;
}

export interface VesselBreakdown {
  vesselId: string;
  vesselName: string;
  amount: number;
  percentage: number;
  budgetAmount?: number;
  budgetUtilization?: number;
  topCategories: Array<{
    category: string;
    amount: number;
  }>;
}

export interface SeasonalBudgetAdjustment {
  vesselId?: string;
  category: string;
  quarter: string;
  baseAmount: number;
  adjustmentPercentage: number;
  adjustedAmount: number;
  reason: string;
  appliedAt: Date;
}

export class FinancialReportingService {
  /**
   * Generate comprehensive financial report
   */
  static async generateFinancialReport(
    reportType: 'SPENDING' | 'BUDGET' | 'VARIANCE' | 'CASH_FLOW',
    period: string,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ): Promise<FinancialReport> {
    try {
      const reportId = `FR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const { startDate, endDate } = this.parsePeriod(period);

      let summary: FinancialSummary;
      let details: any;

      switch (reportType) {
        case 'SPENDING':
          ({ summary, details } = await this.generateSpendingReport(startDate, endDate, vesselId, baseCurrency));
          break;
        case 'BUDGET':
          ({ summary, details } = await this.generateBudgetReport(startDate, endDate, vesselId, baseCurrency));
          break;
        case 'VARIANCE':
          ({ summary, details } = await this.generateVarianceReport(startDate, endDate, vesselId, baseCurrency));
          break;
        case 'CASH_FLOW':
          ({ summary, details } = await this.generateCashFlowReport(startDate, endDate, vesselId, baseCurrency));
          break;
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      return {
        reportId,
        reportType,
        period,
        generatedAt: new Date(),
        baseCurrency,
        summary,
        details
      };
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
  ): Promise<{ summary: FinancialSummary; details: any }> {
    const whereClause: any = {
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'INVOICED', 'PAID'] }
    };

    if (vesselId) {
      whereClause.vesselId = vesselId;
    }

    // Get purchase orders for the period
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        vendor: true,
        vessel: true,
        lineItems: true
      }
    });

    // Calculate currency breakdown
    const currencyTotals = new Map<string, number>();
    let totalSpendingInBase = 0;

    for (const po of purchaseOrders) {
      const existing = currencyTotals.get(po.currency) || 0;
      currencyTotals.set(po.currency, existing + po.totalAmount);

      // Convert to base currency
      if (po.currency === baseCurrency) {
        totalSpendingInBase += po.totalAmount;
      } else {
        const conversion = await CurrencyService.convertCurrency(
          po.totalAmount,
          po.currency,
          baseCurrency
        );
        totalSpendingInBase += conversion.convertedAmount;
      }
    }

    const currencyBreakdown: CurrencyBreakdown[] = [];
    for (const [currency, amount] of currencyTotals) {
      const conversion = await CurrencyService.convertCurrency(amount, currency, baseCurrency);
      currencyBreakdown.push({
        currency,
        amount,
        percentage: totalSpendingInBase > 0 ? (conversion.convertedAmount / totalSpendingInBase) * 100 : 0,
        exchangeRate: conversion.exchangeRate,
        convertedAmount: conversion.convertedAmount
      });
    }

    // Calculate category breakdown
    const categoryTotals = new Map<string, { amount: number; count: number }>();
    
    for (const po of purchaseOrders) {
      // Infer category from line items (simplified)
      const category = this.inferCategoryFromLineItems(po.lineItems);
      const existing = categoryTotals.get(category) || { amount: 0, count: 0 };
      
      const convertedAmount = po.currency === baseCurrency 
        ? po.totalAmount 
        : (await CurrencyService.convertCurrency(po.totalAmount, po.currency, baseCurrency)).convertedAmount;

      categoryTotals.set(category, {
        amount: existing.amount + convertedAmount,
        count: existing.count + 1
      });
    }

    const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryTotals.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalSpendingInBase > 0 ? (data.amount / totalSpendingInBase) * 100 : 0,
      transactionCount: data.count
    }));

    // Calculate vessel breakdown
    const vesselTotals = new Map<string, { amount: number; vessel: any; categories: Map<string, number> }>();
    
    for (const po of purchaseOrders) {
      const existing = vesselTotals.get(po.vesselId) || { 
        amount: 0, 
        vessel: po.vessel, 
        categories: new Map() 
      };
      
      const convertedAmount = po.currency === baseCurrency 
        ? po.totalAmount 
        : (await CurrencyService.convertCurrency(po.totalAmount, po.currency, baseCurrency)).convertedAmount;

      const category = this.inferCategoryFromLineItems(po.lineItems);
      const categoryAmount = existing.categories.get(category) || 0;
      existing.categories.set(category, categoryAmount + convertedAmount);

      vesselTotals.set(po.vesselId, {
        amount: existing.amount + convertedAmount,
        vessel: po.vessel,
        categories: existing.categories
      });
    }

    const vesselBreakdown: VesselBreakdown[] = Array.from(vesselTotals.entries()).map(([vesselId, data]) => {
      const topCategories = Array.from(data.categories.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        vesselId,
        vesselName: data.vessel.name,
        amount: data.amount,
        percentage: totalSpendingInBase > 0 ? (data.amount / totalSpendingInBase) * 100 : 0,
        topCategories
      };
    });

    const summary: FinancialSummary = {
      totalSpending: totalSpendingInBase,
      totalBudget: 0, // Will be calculated if budget data is available
      budgetUtilization: 0,
      currencyBreakdown,
      categoryBreakdown,
      vesselBreakdown
    };

    const details = {
      purchaseOrderCount: purchaseOrders.length,
      averageOrderValue: purchaseOrders.length > 0 ? totalSpendingInBase / purchaseOrders.length : 0,
      largestOrder: Math.max(...purchaseOrders.map(po => po.totalAmount)),
      smallestOrder: Math.min(...purchaseOrders.map(po => po.totalAmount)),
      uniqueVendors: new Set(purchaseOrders.map(po => po.vendor.id)).size,
      topVendors: this.getTopVendors(purchaseOrders, baseCurrency)
    };

    return { summary, details };
  }  /
**
   * Generate budget report
   */
  private static async generateBudgetReport(
    startDate: Date,
    endDate: Date,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ): Promise<{ summary: FinancialSummary; details: any }> {
    // Get budgets for the period
    const whereClause: any = {
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    };

    if (vesselId) {
      whereClause.vesselId = vesselId;
    }

    const budgets = await prisma.budget.findMany({
      where: whereClause,
      include: {
        vessel: true,
        costCenter: true
      }
    });

    let totalBudgetInBase = 0;
    const currencyTotals = new Map<string, number>();
    const categoryTotals = new Map<string, { budget: number; spent: number }>();
    const vesselTotals = new Map<string, { budget: number; spent: number; vessel: any }>();

    for (const budget of budgets) {
      // Convert budget to base currency
      const budgetInBase = budget.currency === baseCurrency 
        ? budget.amount 
        : (await CurrencyService.convertCurrency(budget.amount, budget.currency, baseCurrency)).convertedAmount;

      totalBudgetInBase += budgetInBase;

      // Track by currency
      const existing = currencyTotals.get(budget.currency) || 0;
      currencyTotals.set(budget.currency, existing + budget.amount);

      // Calculate spent amount for this budget
      const spentAmount = await this.calculateBudgetSpent(budget, baseCurrency);

      // Track by category
      const categoryData = categoryTotals.get(budget.category) || { budget: 0, spent: 0 };
      categoryTotals.set(budget.category, {
        budget: categoryData.budget + budgetInBase,
        spent: categoryData.spent + spentAmount
      });

      // Track by vessel
      if (budget.vesselId) {
        const vesselData = vesselTotals.get(budget.vesselId) || { budget: 0, spent: 0, vessel: budget.vessel };
        vesselTotals.set(budget.vesselId, {
          budget: vesselData.budget + budgetInBase,
          spent: vesselData.spent + spentAmount,
          vessel: budget.vessel
        });
      }
    }

    // Build currency breakdown
    const currencyBreakdown: CurrencyBreakdown[] = [];
    for (const [currency, amount] of currencyTotals) {
      const conversion = await CurrencyService.convertCurrency(amount, currency, baseCurrency);
      currencyBreakdown.push({
        currency,
        amount,
        percentage: totalBudgetInBase > 0 ? (conversion.convertedAmount / totalBudgetInBase) * 100 : 0,
        exchangeRate: conversion.exchangeRate,
        convertedAmount: conversion.convertedAmount
      });
    }

    // Build category breakdown
    const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryTotals.entries()).map(([category, data]) => ({
      category,
      amount: data.spent,
      percentage: totalBudgetInBase > 0 ? (data.spent / totalBudgetInBase) * 100 : 0,
      budgetAmount: data.budget,
      budgetUtilization: data.budget > 0 ? (data.spent / data.budget) * 100 : 0,
      transactionCount: 0 // Would need to calculate from actual transactions
    }));

    // Build vessel breakdown
    const vesselBreakdown: VesselBreakdown[] = Array.from(vesselTotals.entries()).map(([vesselId, data]) => ({
      vesselId,
      vesselName: data.vessel?.name || 'Unknown',
      amount: data.spent,
      percentage: totalBudgetInBase > 0 ? (data.spent / totalBudgetInBase) * 100 : 0,
      budgetAmount: data.budget,
      budgetUtilization: data.budget > 0 ? (data.spent / data.budget) * 100 : 0,
      topCategories: [] // Would need to calculate from category data
    }));

    const totalSpent = Array.from(categoryTotals.values()).reduce((sum, data) => sum + data.spent, 0);
    const budgetUtilization = totalBudgetInBase > 0 ? (totalSpent / totalBudgetInBase) * 100 : 0;

    const summary: FinancialSummary = {
      totalSpending: totalSpent,
      totalBudget: totalBudgetInBase,
      budgetUtilization,
      currencyBreakdown,
      categoryBreakdown,
      vesselBreakdown
    };

    const details = {
      budgetCount: budgets.length,
      overBudgetCategories: categoryBreakdown.filter(cat => (cat.budgetUtilization || 0) > 100),
      underBudgetCategories: categoryBreakdown.filter(cat => (cat.budgetUtilization || 0) < 50),
      budgetVariance: totalBudgetInBase - totalSpent
    };

    return { summary, details };
  }

  /**
   * Generate variance report (budget vs actual)
   */
  private static async generateVarianceReport(
    startDate: Date,
    endDate: Date,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ): Promise<{ summary: FinancialSummary; details: any }> {
    const budgetReport = await this.generateBudgetReport(startDate, endDate, vesselId, baseCurrency);
    const spendingReport = await this.generateSpendingReport(startDate, endDate, vesselId, baseCurrency);

    // Calculate variances
    const categoryVariances = budgetReport.summary.categoryBreakdown.map(budgetCat => {
      const spendingCat = spendingReport.summary.categoryBreakdown.find(s => s.category === budgetCat.category);
      const actualSpent = spendingCat?.amount || 0;
      const budgetAmount = budgetCat.budgetAmount || 0;
      const variance = budgetAmount - actualSpent;
      const variancePercentage = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

      return {
        category: budgetCat.category,
        budgetAmount,
        actualSpent,
        variance,
        variancePercentage,
        status: variance >= 0 ? 'UNDER_BUDGET' : 'OVER_BUDGET'
      };
    });

    const vesselVariances = budgetReport.summary.vesselBreakdown.map(budgetVessel => {
      const spendingVessel = spendingReport.summary.vesselBreakdown.find(s => s.vesselId === budgetVessel.vesselId);
      const actualSpent = spendingVessel?.amount || 0;
      const budgetAmount = budgetVessel.budgetAmount || 0;
      const variance = budgetAmount - actualSpent;
      const variancePercentage = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

      return {
        vesselId: budgetVessel.vesselId,
        vesselName: budgetVessel.vesselName,
        budgetAmount,
        actualSpent,
        variance,
        variancePercentage,
        status: variance >= 0 ? 'UNDER_BUDGET' : 'OVER_BUDGET'
      };
    });

    const summary: FinancialSummary = {
      totalSpending: spendingReport.summary.totalSpending,
      totalBudget: budgetReport.summary.totalBudget,
      budgetUtilization: budgetReport.summary.budgetUtilization,
      currencyBreakdown: spendingReport.summary.currencyBreakdown,
      categoryBreakdown: budgetReport.summary.categoryBreakdown,
      vesselBreakdown: budgetReport.summary.vesselBreakdown
    };

    const details = {
      totalVariance: budgetReport.summary.totalBudget - spendingReport.summary.totalSpending,
      categoryVariances,
      vesselVariances,
      significantVariances: categoryVariances.filter(v => Math.abs(v.variancePercentage) > 20),
      overBudgetItems: categoryVariances.filter(v => v.status === 'OVER_BUDGET'),
      underBudgetItems: categoryVariances.filter(v => v.status === 'UNDER_BUDGET' && v.variancePercentage > 50)
    };

    return { summary, details };
  }

  /**
   * Generate cash flow report
   */
  private static async generateCashFlowReport(
    startDate: Date,
    endDate: Date,
    vesselId?: string,
    baseCurrency: string = 'USD'
  ): Promise<{ summary: FinancialSummary; details: any }> {
    // This would typically integrate with accounting systems
    // For now, we'll provide a simplified version based on invoices and payments

    const whereClause: any = {
      invoiceDate: { gte: startDate, lte: endDate }
    };

    if (vesselId) {
      whereClause.purchaseOrder = { vesselId };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        purchaseOrder: {
          include: {
            vendor: true,
            vessel: true
          }
        }
      }
    });

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const monthlyFlow = new Map<string, { invoiced: number; paid: number; outstanding: number }>();

    for (const invoice of invoices) {
      const convertedAmount = invoice.currency === baseCurrency 
        ? invoice.totalAmount 
        : (await CurrencyService.convertCurrency(invoice.totalAmount, invoice.currency, baseCurrency)).convertedAmount;

      totalInvoiced += convertedAmount;

      if (invoice.status === 'PAID') {
        totalPaid += invoice.paidAmount ? 
          (invoice.currency === baseCurrency ? invoice.paidAmount : convertedAmount) : 
          convertedAmount;
      } else {
        totalOutstanding += convertedAmount;
      }

      // Track monthly flow
      const monthKey = invoice.invoiceDate.toISOString().substring(0, 7); // YYYY-MM
      const existing = monthlyFlow.get(monthKey) || { invoiced: 0, paid: 0, outstanding: 0 };
      
      existing.invoiced += convertedAmount;
      if (invoice.status === 'PAID') {
        existing.paid += convertedAmount;
      } else {
        existing.outstanding += convertedAmount;
      }
      
      monthlyFlow.set(monthKey, existing);
    }

    const summary: FinancialSummary = {
      totalSpending: totalPaid,
      totalBudget: 0,
      budgetUtilization: 0,
      currencyBreakdown: [],
      categoryBreakdown: [],
      vesselBreakdown: []
    };

    const details = {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      paymentRate: totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0,
      monthlyFlow: Array.from(monthlyFlow.entries()).map(([month, data]) => ({
        month,
        ...data
      })),
      averagePaymentTime: 0, // Would calculate from payment history
      overdueAmount: 0 // Would calculate from overdue invoices
    };

    return { summary, details };
  }  /
**
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
  ): Promise<SeasonalBudgetAdjustment[]> {
    try {
      const results: SeasonalBudgetAdjustment[] = [];

      for (const adjustment of adjustments) {
        const { startDate, endDate } = this.parseQuarter(adjustment.quarter);

        // Find budgets to adjust
        const whereClause: any = {
          category: adjustment.category,
          startDate: { gte: startDate },
          endDate: { lte: endDate }
        };

        if (adjustment.vesselId) {
          whereClause.vesselId = adjustment.vesselId;
        }

        const budgets = await prisma.budget.findMany({
          where: whereClause
        });

        for (const budget of budgets) {
          const baseAmount = budget.amount;
          const adjustedAmount = baseAmount * (1 + adjustment.adjustmentPercentage / 100);

          // Update the budget
          await prisma.budget.update({
            where: { id: budget.id },
            data: { amount: adjustedAmount }
          });

          results.push({
            vesselId: budget.vesselId,
            category: budget.category,
            quarter: adjustment.quarter,
            baseAmount,
            adjustmentPercentage: adjustment.adjustmentPercentage,
            adjustedAmount,
            reason: adjustment.reason,
            appliedAt: new Date()
          });

          logger.info(
            `Applied seasonal adjustment: ${adjustment.adjustmentPercentage}% to budget ${budget.id} (${baseAmount} -> ${adjustedAmount})`
          );
        }
      }

      return results;
    } catch (error) {
      logger.error('Error applying seasonal budget adjustments:', error);
      throw error;
    }
  }

  /**
   * Generate financial dashboard data
   */
  static async generateFinancialDashboard(
    vesselId?: string,
    baseCurrency: string = 'USD'
  ): Promise<{
    currentMonth: any;
    yearToDate: any;
    budgetStatus: any;
    alerts: any[];
  }> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      // Current month data
      const currentMonth = await this.generateSpendingReport(
        currentMonthStart,
        now,
        vesselId,
        baseCurrency
      );

      // Year to date data
      const yearToDate = await this.generateSpendingReport(
        yearStart,
        now,
        vesselId,
        baseCurrency
      );

      // Budget status
      const budgetStatus = await this.generateBudgetReport(
        currentMonthStart,
        now,
        vesselId,
        baseCurrency
      );

      // Generate alerts
      const alerts = await this.generateFinancialAlerts(vesselId, baseCurrency);

      return {
        currentMonth: currentMonth.summary,
        yearToDate: yearToDate.summary,
        budgetStatus: budgetStatus.summary,
        alerts
      };
    } catch (error) {
      logger.error('Error generating financial dashboard:', error);
      throw error;
    }
  }

  /**
   * Generate financial alerts
   */
  private static async generateFinancialAlerts(
    vesselId?: string,
    baseCurrency: string = 'USD'
  ): Promise<Array<{
    type: 'BUDGET_OVERRUN' | 'HIGH_SPENDING' | 'PAYMENT_OVERDUE' | 'CREDIT_LIMIT';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    amount?: number;
    currency?: string;
  }>> {
    const alerts = [];

    try {
      // Check for budget overruns
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const budgetReport = await this.generateBudgetReport(monthStart, now, vesselId, baseCurrency);
      
      for (const category of budgetReport.summary.categoryBreakdown) {
        if ((category.budgetUtilization || 0) > 100) {
          alerts.push({
            type: 'BUDGET_OVERRUN',
            severity: 'HIGH',
            message: `Budget overrun in ${category.category}: ${category.budgetUtilization?.toFixed(1)}% utilized`,
            amount: category.amount,
            currency: baseCurrency
          });
        } else if ((category.budgetUtilization || 0) > 90) {
          alerts.push({
            type: 'BUDGET_OVERRUN',
            severity: 'MEDIUM',
            message: `Budget warning in ${category.category}: ${category.budgetUtilization?.toFixed(1)}% utilized`,
            amount: category.amount,
            currency: baseCurrency
          });
        }
      }

      // Check for high spending patterns
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const currentSpending = budgetReport.summary.totalSpending;
      const lastMonthReport = await this.generateSpendingReport(lastMonth, lastMonthEnd, vesselId, baseCurrency);
      const lastMonthSpending = lastMonthReport.summary.totalSpending;

      if (currentSpending > lastMonthSpending * 1.5) {
        alerts.push({
          type: 'HIGH_SPENDING',
          severity: 'MEDIUM',
          message: `Spending increased by ${((currentSpending / lastMonthSpending - 1) * 100).toFixed(1)}% compared to last month`,
          amount: currentSpending,
          currency: baseCurrency
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Error generating financial alerts:', error);
      return alerts;
    }
  }

  // Helper methods
  private static parsePeriod(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    
    if (period.includes('Q')) {
      const [year, quarter] = period.split('-Q');
      const yearNum = parseInt(year);
      const quarterNum = parseInt(quarter);
      
      const startMonth = (quarterNum - 1) * 3;
      const startDate = new Date(yearNum, startMonth, 1);
      const endDate = new Date(yearNum, startMonth + 3, 0);
      
      return { startDate, endDate };
    } else if (period.includes('-')) {
      const [year, month] = period.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month) - 1;
      
      const startDate = new Date(yearNum, monthNum, 1);
      const endDate = new Date(yearNum, monthNum + 1, 0);
      
      return { startDate, endDate };
    } else if (period === 'YTD') {
      const startDate = new Date(now.getFullYear(), 0, 1);
      return { startDate, endDate: now };
    } else if (period === 'MTD') {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate, endDate: now };
    } else {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate, endDate };
    }
  }

  private static parseQuarter(quarter: string): { startDate: Date; endDate: Date } {
    const [year, q] = quarter.split('-Q');
    const yearNum = parseInt(year);
    const quarterNum = parseInt(q);
    
    const startMonth = (quarterNum - 1) * 3;
    const startDate = new Date(yearNum, startMonth, 1);
    const endDate = new Date(yearNum, startMonth + 3, 0);
    
    return { startDate, endDate };
  }

  private static async calculateBudgetSpent(budget: any, baseCurrency: string): Promise<number> {
    // This would calculate actual spending against the budget
    // For now, return a placeholder value
    return budget.amount * 0.7; // Assume 70% utilization
  }

  private static inferCategoryFromLineItems(lineItems: any[]): string {
    // Simple category inference - in real implementation would use item catalog
    if (lineItems.some(item => item.itemDescription.toLowerCase().includes('engine'))) {
      return 'ENGINE_PARTS';
    } else if (lineItems.some(item => item.itemDescription.toLowerCase().includes('safety'))) {
      return 'SAFETY_GEAR';
    } else {
      return 'GENERAL';
    }
  }

  private static async getTopVendors(purchaseOrders: any[], baseCurrency: string): Promise<any[]> {
    const vendorTotals = new Map<string, { name: string; amount: number; count: number }>();
    
    for (const po of purchaseOrders) {
      const existing = vendorTotals.get(po.vendor.id) || { name: po.vendor.name, amount: 0, count: 0 };
      const convertedAmount = po.currency === baseCurrency 
        ? po.totalAmount 
        : (await CurrencyService.convertCurrency(po.totalAmount, po.currency, baseCurrency)).convertedAmount;

      vendorTotals.set(po.vendor.id, {
        name: po.vendor.name,
        amount: existing.amount + convertedAmount,
        count: existing.count + 1
      });
    }

    return Array.from(vendorTotals.entries())
      .map(([vendorId, data]) => ({ vendorId, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }
}