import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface SpendingAnalysis {
  totalSpending: number;
  currency: string;
  spendingByVessel: Array<{
    vesselId: string;
    vesselName: string;
    totalAmount: number;
    currency: string;
    orderCount: number;
  }>;
  spendingByCategory: Array<{
    categoryCode: string;
    categoryName: string;
    totalAmount: number;
    currency: string;
    orderCount: number;
  }>;
  spendingByVendor: Array<{
    vendorId: string;
    vendorName: string;
    totalAmount: number;
    currency: string;
    orderCount: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    totalAmount: number;
    orderCount: number;
  }>;
}

export interface VendorPerformanceAnalytics {
  vendorId: string;
  vendorName: string;
  overallScore: number;
  qualityRating: number;
  deliveryRating: number;
  priceRating: number;
  totalOrders: number;
  onTimeDeliveries: number;
  deliveryPercentage: number;
  averageDeliveryTime: number;
  scoringTrends: Array<{
    month: string;
    qualityScore: number;
    deliveryScore: number;
    priceScore: number;
    overallScore: number;
  }>;
}

export interface ProcurementPattern {
  vesselId: string;
  vesselName: string;
  categoryAnalysis: Array<{
    category: string;
    frequency: number;
    averageAmount: number;
    seasonalTrends: Array<{
      month: string;
      orderCount: number;
      totalAmount: number;
    }>;
  }>;
  urgencyPatterns: Array<{
    urgencyLevel: string;
    count: number;
    percentage: number;
    averageAmount: number;
  }>;
  topItems: Array<{
    itemId: string;
    itemName: string;
    orderCount: number;
    totalQuantity: number;
    totalAmount: number;
  }>;
}

export interface CostOptimizationRecommendation {
  type: 'VENDOR_CONSOLIDATION' | 'BULK_ORDERING' | 'SEASONAL_PLANNING' | 'ALTERNATIVE_SUPPLIER';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  potentialSavings: number;
  currency: string;
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedVessels: string[];
  affectedCategories: string[];
  details: Record<string, any>;
}

export class AnalyticsService {
  /**
   * Generate comprehensive spending analysis
   */
  async generateSpendingAnalysis(
    startDate: Date,
    endDate: Date,
    vesselIds?: string[],
    currency: string = 'USD'
  ): Promise<SpendingAnalysis> {
    try {
      logger.info('Generating spending analysis', { startDate, endDate, vesselIds, currency });

      const whereClause = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(vesselIds && vesselIds.length > 0 && { vesselId: { in: vesselIds } }),
        status: { in: ['DELIVERED', 'INVOICED', 'PAID'] },
      };

      // Get total spending
      const totalSpendingResult = await prisma.purchaseOrder.aggregate({
        where: whereClause,
        _sum: {
          totalAmount: true,
        },
      });

      // Spending by vessel
      const spendingByVessel = await prisma.purchaseOrder.groupBy({
        by: ['vesselId'],
        where: whereClause,
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      });

      const vesselDetails = await prisma.vessel.findMany({
        where: {
          id: { in: spendingByVessel.map(s => s.vesselId) },
        },
        select: { id: true, name: true },
      });

      const spendingByVesselWithNames = spendingByVessel.map(spending => {
        const vessel = vesselDetails.find(v => v.id === spending.vesselId);
        return {
          vesselId: spending.vesselId,
          vesselName: vessel?.name || 'Unknown',
          totalAmount: spending._sum.totalAmount || 0,
          currency,
          orderCount: spending._count.id,
        };
      });

      // Spending by category
      const spendingByCategory = await prisma.purchaseOrder.groupBy({
        by: ['categoryCode'],
        where: {
          ...whereClause,
          categoryCode: { not: null },
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      });

      const categoryDetails = await prisma.purchaseCategory.findMany({
        where: {
          code: { in: spendingByCategory.map(s => s.categoryCode).filter(Boolean) as string[] },
        },
        select: { code: true, name: true },
      });

      const spendingByCategoryWithNames = spendingByCategory.map(spending => {
        const category = categoryDetails.find(c => c.code === spending.categoryCode);
        return {
          categoryCode: spending.categoryCode || 'UNCATEGORIZED',
          categoryName: category?.name || 'Uncategorized',
          totalAmount: spending._sum.totalAmount || 0,
          currency,
          orderCount: spending._count.id,
        };
      });

      // Spending by vendor
      const spendingByVendor = await prisma.purchaseOrder.groupBy({
        by: ['vendorId'],
        where: whereClause,
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      });

      const vendorDetails = await prisma.vendor.findMany({
        where: {
          id: { in: spendingByVendor.map(s => s.vendorId) },
        },
        select: { id: true, name: true },
      });

      const spendingByVendorWithNames = spendingByVendor.map(spending => {
        const vendor = vendorDetails.find(v => v.id === spending.vendorId);
        return {
          vendorId: spending.vendorId,
          vendorName: vendor?.name || 'Unknown',
          totalAmount: spending._sum.totalAmount || 0,
          currency,
          orderCount: spending._count.id,
        };
      });

      // Monthly trends
      const monthlyTrends = await this.getMonthlySpendingTrends(startDate, endDate, vesselIds);

      return {
        totalSpending: totalSpendingResult._sum.totalAmount || 0,
        currency,
        spendingByVessel: spendingByVesselWithNames,
        spendingByCategory: spendingByCategoryWithNames,
        spendingByVendor: spendingByVendorWithNames,
        monthlyTrends,
      };
    } catch (error) {
      logger.error('Error generating spending analysis', { error });
      throw error;
    }
  }

  /**
   * Generate vendor performance analytics with scoring trends
   */
  async generateVendorPerformanceAnalytics(
    vendorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<VendorPerformanceAnalytics> {
    try {
      logger.info('Generating vendor performance analytics', { vendorId, startDate, endDate });

      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: {
          id: true,
          name: true,
          overallScore: true,
          qualityRating: true,
          deliveryRating: true,
          priceRating: true,
        },
      });

      if (!vendor) {
        throw new Error(`Vendor not found: ${vendorId}`);
      }

      // Get purchase orders for the vendor in the date range
      const purchaseOrders = await prisma.purchaseOrder.findMany({
        where: {
          vendorId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          deliveries: true,
        },
      });

      // Calculate delivery performance
      const deliveriesWithDates = purchaseOrders.flatMap(po => 
        po.deliveries.filter(d => d.scheduledDate && d.actualDate)
      );

      const onTimeDeliveries = deliveriesWithDates.filter(d => 
        d.actualDate && d.scheduledDate && d.actualDate <= d.scheduledDate
      ).length;

      const deliveryPercentage = deliveriesWithDates.length > 0 
        ? (onTimeDeliveries / deliveriesWithDates.length) * 100 
        : 0;

      // Calculate average delivery time
      const deliveryTimes = deliveriesWithDates.map(d => {
        if (d.actualDate && d.scheduledDate) {
          return Math.abs(d.actualDate.getTime() - d.scheduledDate.getTime()) / (1000 * 60 * 60 * 24);
        }
        return 0;
      });

      const averageDeliveryTime = deliveryTimes.length > 0 
        ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length 
        : 0;

      // Generate scoring trends (monthly)
      const scoringTrends = await this.getVendorScoringTrends(vendorId, startDate, endDate);

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        overallScore: vendor.overallScore,
        qualityRating: vendor.qualityRating,
        deliveryRating: vendor.deliveryRating,
        priceRating: vendor.priceRating,
        totalOrders: purchaseOrders.length,
        onTimeDeliveries,
        deliveryPercentage,
        averageDeliveryTime,
        scoringTrends,
      };
    } catch (error) {
      logger.error('Error generating vendor performance analytics', { error });
      throw error;
    }
  }

  /**
   * Analyze procurement patterns by vessel and category
   */
  async analyzeProcurementPatterns(
    vesselId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProcurementPattern> {
    try {
      logger.info('Analyzing procurement patterns', { vesselId, startDate, endDate });

      const vessel = await prisma.vessel.findUnique({
        where: { id: vesselId },
        select: { id: true, name: true },
      });

      if (!vessel) {
        throw new Error(`Vessel not found: ${vesselId}`);
      }

      // Get requisitions for analysis
      const requisitions = await prisma.requisition.findMany({
        where: {
          vesselId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          items: {
            include: {
              itemCatalog: true,
            },
          },
        },
      });

      // Analyze by category
      const categoryMap = new Map<string, {
        frequency: number;
        totalAmount: number;
        monthlyData: Map<string, { count: number; amount: number }>;
      }>();

      requisitions.forEach(req => {
        req.items.forEach(item => {
          const category = item.itemCatalog.category;
          const month = req.createdAt.toISOString().substring(0, 7); // YYYY-MM
          const amount = item.totalPrice || 0;

          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              frequency: 0,
              totalAmount: 0,
              monthlyData: new Map(),
            });
          }

          const categoryData = categoryMap.get(category)!;
          categoryData.frequency += 1;
          categoryData.totalAmount += amount;

          if (!categoryData.monthlyData.has(month)) {
            categoryData.monthlyData.set(month, { count: 0, amount: 0 });
          }

          const monthlyData = categoryData.monthlyData.get(month)!;
          monthlyData.count += 1;
          monthlyData.amount += amount;
        });
      });

      const categoryAnalysis = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        frequency: data.frequency,
        averageAmount: data.frequency > 0 ? data.totalAmount / data.frequency : 0,
        seasonalTrends: Array.from(data.monthlyData.entries()).map(([month, monthData]) => ({
          month,
          orderCount: monthData.count,
          totalAmount: monthData.amount,
        })),
      }));

      // Analyze urgency patterns
      const urgencyMap = new Map<string, { count: number; totalAmount: number }>();
      requisitions.forEach(req => {
        const urgency = req.urgencyLevel;
        if (!urgencyMap.has(urgency)) {
          urgencyMap.set(urgency, { count: 0, totalAmount: 0 });
        }
        const urgencyData = urgencyMap.get(urgency)!;
        urgencyData.count += 1;
        urgencyData.totalAmount += req.totalAmount;
      });

      const totalRequisitions = requisitions.length;
      const urgencyPatterns = Array.from(urgencyMap.entries()).map(([urgency, data]) => ({
        urgencyLevel: urgency,
        count: data.count,
        percentage: totalRequisitions > 0 ? (data.count / totalRequisitions) * 100 : 0,
        averageAmount: data.count > 0 ? data.totalAmount / data.count : 0,
      }));

      // Analyze top items
      const itemMap = new Map<string, {
        name: string;
        orderCount: number;
        totalQuantity: number;
        totalAmount: number;
      }>();

      requisitions.forEach(req => {
        req.items.forEach(item => {
          const itemId = item.itemCatalogId;
          if (!itemMap.has(itemId)) {
            itemMap.set(itemId, {
              name: item.itemCatalog.name,
              orderCount: 0,
              totalQuantity: 0,
              totalAmount: 0,
            });
          }
          const itemData = itemMap.get(itemId)!;
          itemData.orderCount += 1;
          itemData.totalQuantity += item.quantity;
          itemData.totalAmount += item.totalPrice || 0;
        });
      });

      const topItems = Array.from(itemMap.entries())
        .map(([itemId, data]) => ({
          itemId,
          itemName: data.name,
          orderCount: data.orderCount,
          totalQuantity: data.totalQuantity,
          totalAmount: data.totalAmount,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);

      return {
        vesselId: vessel.id,
        vesselName: vessel.name,
        categoryAnalysis,
        urgencyPatterns,
        topItems,
      };
    } catch (error) {
      logger.error('Error analyzing procurement patterns', { error });
      throw error;
    }
  }

  /**
   * Generate cost optimization recommendations
   */
  async generateCostOptimizationRecommendations(
    vesselIds?: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<CostOptimizationRecommendation[]> {
    try {
      logger.info('Generating cost optimization recommendations', { vesselIds, startDate, endDate });

      const recommendations: CostOptimizationRecommendation[] = [];

      // Vendor consolidation opportunities
      const vendorConsolidation = await this.analyzeVendorConsolidationOpportunities(vesselIds, startDate, endDate);
      recommendations.push(...vendorConsolidation);

      // Bulk ordering opportunities
      const bulkOrdering = await this.analyzeBulkOrderingOpportunities(vesselIds, startDate, endDate);
      recommendations.push(...bulkOrdering);

      // Seasonal planning opportunities
      const seasonalPlanning = await this.analyzeSeasonalPlanningOpportunities(vesselIds, startDate, endDate);
      recommendations.push(...seasonalPlanning);

      // Alternative supplier opportunities
      const alternativeSuppliers = await this.analyzeAlternativeSupplierOpportunities(vesselIds, startDate, endDate);
      recommendations.push(...alternativeSuppliers);

      return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
    } catch (error) {
      logger.error('Error generating cost optimization recommendations', { error });
      throw error;
    }
  }

  /**
   * Get monthly spending trends
   */
  private async getMonthlySpendingTrends(
    startDate: Date,
    endDate: Date,
    vesselIds?: string[]
  ): Promise<Array<{ month: string; totalAmount: number; orderCount: number }>> {
    const whereClause = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(vesselIds && vesselIds.length > 0 && { vesselId: { in: vesselIds } }),
      status: { in: ['DELIVERED', 'INVOICED', 'PAID'] },
    };

    const orders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    const monthlyMap = new Map<string, { totalAmount: number; orderCount: number }>();

    orders.forEach(order => {
      const month = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { totalAmount: 0, orderCount: 0 });
      }
      const monthData = monthlyMap.get(month)!;
      monthData.totalAmount += order.totalAmount;
      monthData.orderCount += 1;
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        totalAmount: data.totalAmount,
        orderCount: data.orderCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Get vendor scoring trends over time
   */
  private async getVendorScoringTrends(
    vendorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    month: string;
    qualityScore: number;
    deliveryScore: number;
    priceScore: number;
    overallScore: number;
  }>> {
    // This would typically involve historical scoring data
    // For now, we'll return current scores for each month
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        qualityRating: true,
        deliveryRating: true,
        priceRating: true,
        overallScore: true,
      },
    });

    if (!vendor) {
      return [];
    }

    const trends = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      trends.push({
        month: current.toISOString().substring(0, 7),
        qualityScore: vendor.qualityRating,
        deliveryScore: vendor.deliveryRating,
        priceScore: vendor.priceRating,
        overallScore: vendor.overallScore,
      });
      current.setMonth(current.getMonth() + 1);
    }

    return trends;
  }

  /**
   * Analyze vendor consolidation opportunities
   */
  private async analyzeVendorConsolidationOpportunities(
    vesselIds?: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<CostOptimizationRecommendation[]> {
    // Implementation for vendor consolidation analysis
    return [];
  }

  /**
   * Analyze bulk ordering opportunities
   */
  private async analyzeBulkOrderingOpportunities(
    vesselIds?: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<CostOptimizationRecommendation[]> {
    // Implementation for bulk ordering analysis
    return [];
  }

  /**
   * Analyze seasonal planning opportunities
   */
  private async analyzeSeasonalPlanningOpportunities(
    vesselIds?: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<CostOptimizationRecommendation[]> {
    // Implementation for seasonal planning analysis
    return [];
  }

  /**
   * Analyze alternative supplier opportunities
   */
  private async analyzeAlternativeSupplierOpportunities(
    vesselIds?: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<CostOptimizationRecommendation[]> {
    // Implementation for alternative supplier analysis
    return [];
  }
}

export const analyticsService = new AnalyticsService();