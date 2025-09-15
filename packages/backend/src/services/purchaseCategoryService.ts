import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface PurchaseCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  budgetLimit?: number;
  budgetCurrency?: string;
  approvalRequired: boolean;
  children?: PurchaseCategory[];
}

export interface CategorySpending {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  totalSpent: number;
  currency: string;
  transactionCount: number;
  averageAmount: number;
  lastPurchaseDate?: Date;
  budgetLimit?: number;
  budgetUtilization?: number;
}

export interface CategoryReport {
  period: string;
  totalCategories: number;
  totalSpending: number;
  currency: string;
  categories: CategorySpending[];
  topCategories: CategorySpending[];
  budgetOverruns: CategorySpending[];
}

export class PurchaseCategoryService {
  /**
   * Create a new purchase category
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
        const parent = await prisma.systemSetting.findFirst({
          where: {
            key: `purchase_category_${data.parentId}`,
            category: 'PURCHASE_CATEGORIES'
          }
        });
        if (!parent) {
          throw new Error('Parent purchase category not found');
        }
      }

      // Check if code already exists
      const existing = await prisma.systemSetting.findFirst({
        where: {
          key: `purchase_category_code_${data.code}`,
          category: 'PURCHASE_CATEGORIES'
        }
      });
      if (existing) {
        throw new Error('Purchase category code already exists');
      }

      // Create category record
      const categoryId = `pc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const categoryData = {
        id: categoryId,
        code: data.code,
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        isActive: true,
        budgetLimit: data.budgetLimit,
        budgetCurrency: data.budgetCurrency || 'USD',
        approvalRequired: data.approvalRequired || false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store as system setting (using JSON value)
      await prisma.systemSetting.create({
        data: {
          key: `purchase_category_${categoryId}`,
          value: JSON.stringify(categoryData),
          description: `Purchase category: ${data.name}`,
          category: 'PURCHASE_CATEGORIES'
        }
      });

      // Create code index for quick lookup
      await prisma.systemSetting.create({
        data: {
          key: `purchase_category_code_${data.code}`,
          value: categoryId,
          description: `Code index for category: ${data.name}`,
          category: 'PURCHASE_CATEGORIES'
        }
      });

      logger.info(`Purchase category created: ${data.code} - ${data.name}`);
      return categoryData;
    } catch (error) {
      logger.error('Error creating purchase category:', error);
      throw error;
    }
  }

  /**
   * Get all purchase categories
   */
  static async getAllPurchaseCategories(): Promise<PurchaseCategory[]> {
    try {
      const categories = await prisma.systemSetting.findMany({
        where: {
          category: 'PURCHASE_CATEGORIES',
          key: { startsWith: 'purchase_category_pc_' }
        },
        orderBy: { createdAt: 'asc' }
      });

      return categories.map(cat => JSON.parse(cat.value) as PurchaseCategory);
    } catch (error) {
      logger.error('Error getting purchase categories:', error);
      throw error;
    }
  }

  /**
   * Get purchase category by code
   */
  static async getPurchaseCategoryByCode(code: string): Promise<PurchaseCategory | null> {
    try {
      const codeIndex = await prisma.systemSetting.findFirst({
        where: {
          key: `purchase_category_code_${code}`,
          category: 'PURCHASE_CATEGORIES'
        }
      });

      if (!codeIndex) {
        return null;
      }

      const category = await prisma.systemSetting.findFirst({
        where: {
          key: `purchase_category_${codeIndex.value}`,
          category: 'PURCHASE_CATEGORIES'
        }
      });

      return category ? JSON.parse(category.value) as PurchaseCategory : null;
    } catch (error) {
      logger.error('Error getting purchase category by code:', error);
      return null;
    }
  }  /**

   * Get category spending analysis
   */
  static async getCategorySpendingAnalysis(
    vesselId?: string,
    startDate?: Date,
    endDate?: Date,
    currency: string = 'USD'
  ): Promise<CategorySpending[]> {
    try {
      const whereClause: any = {};
      
      if (vesselId) {
        whereClause.vesselId = vesselId;
      }
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          gte: startDate,
          lte: endDate
        };
      }

      // Get spending from purchase orders grouped by category
      const purchaseOrders = await prisma.purchaseOrder.findMany({
        where: {
          ...whereClause,
          status: {
            in: ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'INVOICED', 'PAID']
          }
        },
        include: {
          lineItems: true
        }
      });

      // Group by category (we'll need to map line items to categories)
      const categorySpending = new Map<string, {
        totalSpent: number;
        transactionCount: number;
        lastPurchaseDate: Date;
      }>();

      for (const po of purchaseOrders) {
        // For now, we'll use a simple category mapping based on item description
        // In a real implementation, this would be based on item catalog categories
        const category = this.inferCategoryFromPO(po);
        
        const existing = categorySpending.get(category) || {
          totalSpent: 0,
          transactionCount: 0,
          lastPurchaseDate: new Date(0)
        };

        // Convert currency if needed
        let amount = po.totalAmount;
        if (po.currency !== currency) {
          // In a real implementation, we'd use CurrencyService here
          // For now, we'll use the exchange rate from the PO
          amount = po.totalAmount * po.exchangeRate;
        }

        categorySpending.set(category, {
          totalSpent: existing.totalSpent + amount,
          transactionCount: existing.transactionCount + 1,
          lastPurchaseDate: po.createdAt > existing.lastPurchaseDate ? po.createdAt : existing.lastPurchaseDate
        });
      }

      // Get all categories to include budget information
      const allCategories = await this.getAllPurchaseCategories();
      const categoryMap = new Map(allCategories.map(cat => [cat.code, cat]));

      // Build result
      const result: CategorySpending[] = [];
      
      for (const [categoryCode, spending] of categorySpending) {
        const category = categoryMap.get(categoryCode);
        const averageAmount = spending.transactionCount > 0 ? spending.totalSpent / spending.transactionCount : 0;
        
        let budgetUtilization: number | undefined;
        if (category?.budgetLimit) {
          budgetUtilization = (spending.totalSpent / category.budgetLimit) * 100;
        }

        result.push({
          categoryId: category?.id || categoryCode,
          categoryCode,
          categoryName: category?.name || categoryCode,
          totalSpent: spending.totalSpent,
          currency,
          transactionCount: spending.transactionCount,
          averageAmount,
          lastPurchaseDate: spending.lastPurchaseDate,
          budgetLimit: category?.budgetLimit,
          budgetUtilization
        });
      }

      return result.sort((a, b) => b.totalSpent - a.totalSpent);
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
  ): Promise<CategoryReport> {
    try {
      const { startDate, endDate } = this.parsePeriod(period);
      
      const categorySpending = await this.getCategorySpendingAnalysis(
        vesselId,
        startDate,
        endDate,
        currency
      );

      const totalSpending = categorySpending.reduce((sum, cat) => sum + cat.totalSpent, 0);
      const topCategories = categorySpending.slice(0, 10);
      const budgetOverruns = categorySpending.filter(cat => 
        cat.budgetUtilization && cat.budgetUtilization > 100
      );

      return {
        period,
        totalCategories: categorySpending.length,
        totalSpending,
        currency,
        categories: categorySpending,
        topCategories,
        budgetOverruns
      };
    } catch (error) {
      logger.error('Error generating category report:', error);
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
      const existing = await prisma.systemSetting.findFirst({
        where: {
          key: `purchase_category_${id}`,
          category: 'PURCHASE_CATEGORIES'
        }
      });

      if (!existing) {
        throw new Error('Purchase category not found');
      }

      const currentData = JSON.parse(existing.value) as PurchaseCategory;
      const updatedData = {
        ...currentData,
        ...data,
        updatedAt: new Date()
      };

      await prisma.systemSetting.update({
        where: { id: existing.id },
        data: {
          value: JSON.stringify(updatedData),
          description: `Purchase category: ${updatedData.name}`
        }
      });

      logger.info(`Purchase category updated: ${updatedData.code} - ${updatedData.name}`);
      return updatedData;
    } catch (error) {
      logger.error('Error updating purchase category:', error);
      throw error;
    }
  }

  /**
   * Infer category from purchase order (helper method)
   */
  private static inferCategoryFromPO(po: any): string {
    // Simple category inference based on line item descriptions
    // In a real implementation, this would be based on item catalog categories
    const descriptions = po.lineItems.map((item: any) => item.itemDescription.toLowerCase());
    
    if (descriptions.some((desc: string) => desc.includes('engine') || desc.includes('motor'))) {
      return 'ENGINE_PARTS';
    } else if (descriptions.some((desc: string) => desc.includes('safety') || desc.includes('life'))) {
      return 'SAFETY_GEAR';
    } else if (descriptions.some((desc: string) => desc.includes('deck') || desc.includes('rope'))) {
      return 'DECK_EQUIPMENT';
    } else if (descriptions.some((desc: string) => desc.includes('navigation') || desc.includes('gps'))) {
      return 'NAVIGATION';
    } else if (descriptions.some((desc: string) => desc.includes('food') || desc.includes('catering'))) {
      return 'CATERING';
    } else if (descriptions.some((desc: string) => desc.includes('maintenance') || desc.includes('repair'))) {
      return 'MAINTENANCE';
    } else if (descriptions.some((desc: string) => desc.includes('electrical') || desc.includes('wire'))) {
      return 'ELECTRICAL';
    } else {
      return 'GENERAL';
    }
  }

  /**
   * Parse period string to date range
   */
  private static parsePeriod(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    
    if (period.includes('Q')) {
      // Quarterly period like "2024-Q1"
      const [year, quarter] = period.split('-Q');
      const yearNum = parseInt(year);
      const quarterNum = parseInt(quarter);
      
      const startMonth = (quarterNum - 1) * 3;
      const startDate = new Date(yearNum, startMonth, 1);
      const endDate = new Date(yearNum, startMonth + 3, 0); // Last day of quarter
      
      return { startDate, endDate };
    } else if (period.includes('-')) {
      // Monthly period like "2024-01"
      const [year, month] = period.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month) - 1; // JavaScript months are 0-based
      
      const startDate = new Date(yearNum, monthNum, 1);
      const endDate = new Date(yearNum, monthNum + 1, 0); // Last day of month
      
      return { startDate, endDate };
    } else if (period === 'YTD') {
      // Year to date
      const startDate = new Date(now.getFullYear(), 0, 1);
      const endDate = now;
      
      return { startDate, endDate };
    } else if (period === 'MTD') {
      // Month to date
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = now;
      
      return { startDate, endDate };
    } else {
      // Default to current month
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      return { startDate, endDate };
    }
  }

  /**
   * Get category hierarchy
   */
  static async getCategoryHierarchy(): Promise<PurchaseCategory[]> {
    try {
      const allCategories = await this.getAllPurchaseCategories();
      
      // Build hierarchy
      const categoryMap = new Map(allCategories.map(cat => [cat.id, cat]));
      const rootCategories: PurchaseCategory[] = [];

      for (const category of allCategories) {
        if (!category.parentId) {
          // Root category
          category.children = this.buildCategoryChildren(category.id, categoryMap);
          rootCategories.push(category);
        }
      }

      return rootCategories;
    } catch (error) {
      logger.error('Error getting category hierarchy:', error);
      throw error;
    }
  }

  /**
   * Build category children recursively
   */
  private static buildCategoryChildren(
    parentId: string,
    categoryMap: Map<string, PurchaseCategory>
  ): PurchaseCategory[] {
    const children: PurchaseCategory[] = [];
    
    for (const [id, category] of categoryMap) {
      if (category.parentId === parentId) {
        category.children = this.buildCategoryChildren(id, categoryMap);
        children.push(category);
      }
    }

    return children.sort((a, b) => a.code.localeCompare(b.code));
  }
}