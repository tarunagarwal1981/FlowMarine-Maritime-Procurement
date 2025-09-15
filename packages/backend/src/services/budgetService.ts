import { PrismaClient } from '@prisma/client';
import { CurrencyService } from './currencyService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface BudgetSummary {
  budgetId: string;
  category: string;
  budgetAmount: number;
  currency: string;
  spentAmount: number;
  remainingAmount: number;
  utilizationPercentage: number;
  period: string;
  startDate: Date;
  endDate: Date;
  vesselId?: string;
  costCenterId?: string;
}

export interface MultiCurrencyBudgetSummary {
  baseCurrency: string;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overallUtilization: number;
  budgets: BudgetSummary[];
  currencyBreakdown: Array<{
    currency: string;
    budgetAmount: number;
    spentAmount: number;
    exchangeRate: number;
  }>;
}

export interface SeasonalAdjustment {
  category: string;
  quarter: string;
  adjustmentPercentage: number;
  reason: string;
}

export class BudgetService {
  /**
   * Create a new budget
   */
  static async createBudget(data: {
    vesselId?: string;
    costCenterId?: string;
    category: string;
    amount: number;
    currency: string;
    period: string;
    startDate: Date;
    endDate: Date;
  }) {
    try {
      // Validate currency
      if (!CurrencyService.isValidCurrency(data.currency)) {
        throw new Error(`Invalid currency: ${data.currency}`);
      }

      // Validate dates
      if (data.startDate >= data.endDate) {
        throw new Error('Start date must be before end date');
      }

      // Check for overlapping budgets
      const overlapping = await prisma.budget.findFirst({
        where: {
          vesselId: data.vesselId,
          costCenterId: data.costCenterId,
          category: data.category,
          OR: [
            {
              startDate: { lte: data.endDate },
              endDate: { gte: data.startDate }
            }
          ]
        }
      });

      if (overlapping) {
        throw new Error('Overlapping budget period found for this category');
      }

      const budget = await prisma.budget.create({
        data: {
          vesselId: data.vesselId,
          costCenterId: data.costCenterId,
          category: data.category,
          amount: data.amount,
          currency: data.currency,
          period: data.period,
          startDate: data.startDate,
          endDate: data.endDate
        },
        include: {
          vessel: true,
          costCenter: true
        }
      });

      logger.info(`Budget created: ${budget.category} - ${budget.amount} ${budget.currency}`);
      return budget;
    } catch (error) {
      logger.error('Error creating budget:', error);
      throw error;
    }
  }  /*
*
   * Get budget summary for a vessel
   */
  static async getVesselBudgetSummary(
    vesselId: string,
    period?: string,
    baseCurrency: string = 'USD'
  ): Promise<MultiCurrencyBudgetSummary> {
    try {
      const whereClause: any = {
        vesselId,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      };

      if (period) {
        whereClause.period = period;
      }

      const budgets = await prisma.budget.findMany({
        where: whereClause,
        include: {
          vessel: true,
          costCenter: true
        },
        orderBy: { category: 'asc' }
      });

      // Calculate spent amounts by querying related transactions
      const budgetSummaries: BudgetSummary[] = [];
      const currencyTotals = new Map<string, { budget: number; spent: number }>();

      for (const budget of budgets) {
        // Calculate spent amount from requisitions and purchase orders
        const spentAmount = await this.calculateSpentAmount(
          budget.vesselId,
          budget.costCenterId,
          budget.category,
          budget.currency,
          budget.startDate,
          budget.endDate
        );

        const remainingAmount = budget.amount - spentAmount;
        const utilizationPercentage = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0;

        budgetSummaries.push({
          budgetId: budget.id,
          category: budget.category,
          budgetAmount: budget.amount,
          currency: budget.currency,
          spentAmount,
          remainingAmount,
          utilizationPercentage,
          period: budget.period,
          startDate: budget.startDate,
          endDate: budget.endDate,
          vesselId: budget.vesselId,
          costCenterId: budget.costCenterId
        });

        // Track currency totals
        const existing = currencyTotals.get(budget.currency) || { budget: 0, spent: 0 };
        currencyTotals.set(budget.currency, {
          budget: existing.budget + budget.amount,
          spent: existing.spent + spentAmount
        });
      }

      // Convert all amounts to base currency
      const currencyBreakdown = [];
      let totalBudgetInBase = 0;
      let totalSpentInBase = 0;

      for (const [currency, totals] of currencyTotals) {
        const budgetConversion = await CurrencyService.convertCurrency(
          totals.budget,
          currency,
          baseCurrency
        );
        const spentConversion = await CurrencyService.convertCurrency(
          totals.spent,
          currency,
          baseCurrency
        );

        totalBudgetInBase += budgetConversion.convertedAmount;
        totalSpentInBase += spentConversion.convertedAmount;

        currencyBreakdown.push({
          currency,
          budgetAmount: totals.budget,
          spentAmount: totals.spent,
          exchangeRate: budgetConversion.exchangeRate
        });
      }

      const totalRemaining = totalBudgetInBase - totalSpentInBase;
      const overallUtilization = totalBudgetInBase > 0 ? (totalSpentInBase / totalBudgetInBase) * 100 : 0;

      return {
        baseCurrency,
        totalBudget: totalBudgetInBase,
        totalSpent: totalSpentInBase,
        totalRemaining,
        overallUtilization,
        budgets: budgetSummaries,
        currencyBreakdown
      };
    } catch (error) {
      logger.error('Error getting vessel budget summary:', error);
      throw error;
    }
  }  /**

   * Calculate spent amount for a budget category
   */
  private static async calculateSpentAmount(
    vesselId: string | null,
    costCenterId: string | null,
    category: string,
    currency: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      // Get spent from approved requisitions
      const requisitionSpent = await prisma.requisition.aggregate({
        where: {
          vesselId: vesselId || undefined,
          status: 'APPROVED',
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          items: {
            some: {
              itemCatalog: {
                category: category as any
              }
            }
          }
        },
        _sum: {
          totalAmount: true
        }
      });

      // Get spent from purchase orders
      const poSpent = await prisma.purchaseOrder.aggregate({
        where: {
          vesselId: vesselId || undefined,
          status: {
            in: ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'INVOICED', 'PAID']
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          currency
        },
        _sum: {
          totalAmount: true
        }
      });

      const requisitionTotal = requisitionSpent._sum.totalAmount || 0;
      const poTotal = poSpent._sum.totalAmount || 0;

      // Convert to budget currency if different
      let totalSpent = requisitionTotal + poTotal;

      // Note: In a real implementation, you might need more sophisticated
      // category matching and currency conversion for individual transactions
      
      return totalSpent;
    } catch (error) {
      logger.error('Error calculating spent amount:', error);
      return 0;
    }
  }

  /**
   * Apply seasonal adjustments to budgets
   */
  static async applySeasonalAdjustments(
    vesselId: string,
    adjustments: SeasonalAdjustment[]
  ): Promise<void> {
    try {
      for (const adjustment of adjustments) {
        // Find budgets for the category and quarter
        const quarterStart = this.getQuarterStartDate(adjustment.quarter);
        const quarterEnd = this.getQuarterEndDate(adjustment.quarter);

        const budgets = await prisma.budget.findMany({
          where: {
            vesselId,
            category: adjustment.category,
            startDate: { gte: quarterStart },
            endDate: { lte: quarterEnd }
          }
        });

        // Apply adjustment to each budget
        for (const budget of budgets) {
          const adjustedAmount = budget.amount * (1 + adjustment.adjustmentPercentage / 100);
          
          await prisma.budget.update({
            where: { id: budget.id },
            data: { amount: adjustedAmount }
          });

          logger.info(
            `Applied ${adjustment.adjustmentPercentage}% seasonal adjustment to budget ${budget.id}: ${budget.amount} -> ${adjustedAmount}`
          );
        }
      }
    } catch (error) {
      logger.error('Error applying seasonal adjustments:', error);
      throw error;
    }
  }  /**

   * Get quarter start date
   */
  private static getQuarterStartDate(quarter: string): Date {
    const [year, q] = quarter.split('-Q');
    const yearNum = parseInt(year);
    const quarterNum = parseInt(q);
    
    const month = (quarterNum - 1) * 3;
    return new Date(yearNum, month, 1);
  }

  /**
   * Get quarter end date
   */
  private static getQuarterEndDate(quarter: string): Date {
    const [year, q] = quarter.split('-Q');
    const yearNum = parseInt(year);
    const quarterNum = parseInt(q);
    
    const month = quarterNum * 3;
    return new Date(yearNum, month, 0); // Last day of previous month
  }

  /**
   * Check budget availability
   */
  static async checkBudgetAvailability(
    vesselId: string,
    category: string,
    amount: number,
    currency: string,
    costCenterId?: string
  ): Promise<{
    available: boolean;
    budgetId?: string;
    remainingAmount?: number;
    utilizationPercentage?: number;
    message: string;
  }> {
    try {
      const currentDate = new Date();
      
      const budget = await prisma.budget.findFirst({
        where: {
          vesselId,
          costCenterId,
          category,
          currency,
          startDate: { lte: currentDate },
          endDate: { gte: currentDate }
        }
      });

      if (!budget) {
        return {
          available: false,
          message: `No active budget found for category ${category} in ${currency}`
        };
      }

      const spentAmount = await this.calculateSpentAmount(
        budget.vesselId,
        budget.costCenterId,
        budget.category,
        budget.currency,
        budget.startDate,
        budget.endDate
      );

      const remainingAmount = budget.amount - spentAmount;
      const utilizationPercentage = (spentAmount / budget.amount) * 100;

      if (remainingAmount >= amount) {
        return {
          available: true,
          budgetId: budget.id,
          remainingAmount,
          utilizationPercentage,
          message: `Budget available. Remaining: ${remainingAmount} ${currency}`
        };
      } else {
        return {
          available: false,
          budgetId: budget.id,
          remainingAmount,
          utilizationPercentage,
          message: `Insufficient budget. Required: ${amount} ${currency}, Available: ${remainingAmount} ${currency}`
        };
      }
    } catch (error) {
      logger.error('Error checking budget availability:', error);
      return {
        available: false,
        message: 'Error checking budget availability'
      };
    }
  }

  /**
   * Parse period string into date range
   */
  static parsePeriod(period: string): { startDate: Date; endDate: Date } {
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

  /**
   * Get budget hierarchy (vessel -> fleet -> company)
   */
  static async getBudgetHierarchy(
    vesselId: string,
    category: string,
    currency: string
  ): Promise<Array<{
    level: 'vessel' | 'fleet' | 'company';
    budgetId: string;
    amount: number;
    spentAmount: number;
    remainingAmount: number;
  }>> {
    try {
      const hierarchy = [];
      const currentDate = new Date();

      // Vessel level budget
      const vesselBudget = await prisma.budget.findFirst({
        where: {
          vesselId,
          category,
          currency,
          startDate: { lte: currentDate },
          endDate: { gte: currentDate }
        }
      });

      if (vesselBudget) {
        const spentAmount = await this.calculateSpentAmount(
          vesselBudget.vesselId,
          vesselBudget.costCenterId,
          vesselBudget.category,
          vesselBudget.currency,
          vesselBudget.startDate,
          vesselBudget.endDate
        );

        hierarchy.push({
          level: 'vessel' as const,
          budgetId: vesselBudget.id,
          amount: vesselBudget.amount,
          spentAmount,
          remainingAmount: vesselBudget.amount - spentAmount
        });
      }

      // Fleet level budget (cost center without vessel)
      const fleetBudget = await prisma.budget.findFirst({
        where: {
          vesselId: null,
          category,
          currency,
          startDate: { lte: currentDate },
          endDate: { gte: currentDate },
          costCenter: {
            code: { startsWith: 'FLEET' } // Assuming fleet cost centers start with 'FLEET'
          }
        }
      });

      if (fleetBudget) {
        const spentAmount = await this.calculateSpentAmount(
          null,
          fleetBudget.costCenterId,
          fleetBudget.category,
          fleetBudget.currency,
          fleetBudget.startDate,
          fleetBudget.endDate
        );

        hierarchy.push({
          level: 'fleet' as const,
          budgetId: fleetBudget.id,
          amount: fleetBudget.amount,
          spentAmount,
          remainingAmount: fleetBudget.amount - spentAmount
        });
      }

      // Company level budget
      const companyBudget = await prisma.budget.findFirst({
        where: {
          vesselId: null,
          category,
          currency,
          startDate: { lte: currentDate },
          endDate: { gte: currentDate },
          costCenter: {
            code: { startsWith: 'COMPANY' } // Assuming company cost centers start with 'COMPANY'
          }
        }
      });

      if (companyBudget) {
        const spentAmount = await this.calculateSpentAmount(
          null,
          companyBudget.costCenterId,
          companyBudget.category,
          companyBudget.currency,
          companyBudget.startDate,
          companyBudget.endDate
        );

        hierarchy.push({
          level: 'company' as const,
          budgetId: companyBudget.id,
          amount: companyBudget.amount,
          spentAmount,
          remainingAmount: companyBudget.amount - spentAmount
        });
      }

      return hierarchy;
    } catch (error) {
      logger.error('Error getting budget hierarchy:', error);
      return [];
    }
  }
}