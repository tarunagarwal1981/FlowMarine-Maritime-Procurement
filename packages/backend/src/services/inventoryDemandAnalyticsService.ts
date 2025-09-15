import { PrismaClient } from '@prisma/client';
import { 
  InventoryTurnoverData, 
  DemandForecastData, 
  OptimizationRecommendations,
  StockAlertsData,
  PredictiveMaintenanceData,
  InventoryDemandFilters
} from '../types/analytics';

const prisma = new PrismaClient();

export class InventoryDemandAnalyticsService {
  /**
   * Get inventory turnover analysis data
   */
  async getInventoryTurnoverAnalysis(filters: InventoryDemandFilters): Promise<InventoryTurnoverData> {
    const { vesselIds, selectedVessel, categories, timeRange } = filters;

    // Build where clause for filtering
    const whereClause: any = {};
    if (vesselIds?.length || selectedVessel) {
      whereClause.vesselId = {
        in: selectedVessel ? [selectedVessel] : vesselIds
      };
    }
    if (categories?.length) {
      whereClause.category = { in: categories };
    }
    if (timeRange) {
      whereClause.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end
      };
    }

    // Get inventory data with turnover calculations
    const inventoryData = await prisma.$queryRaw`
      SELECT 
        ic.category,
        COUNT(ii.id) as item_count,
        SUM(ii.current_stock * ii.unit_cost) as total_value,
        AVG(ii.turnover_rate) as avg_turnover_rate,
        AVG(6.0) as target_rate,
        SUM(CASE WHEN ii.last_movement < NOW() - INTERVAL '90 days' THEN ii.current_stock * ii.unit_cost ELSE 0 END) as slow_moving_value
      FROM item_catalog ic
      LEFT JOIN inventory_items ii ON ic.id = ii.item_id
      WHERE (${vesselIds?.length || selectedVessel ? `ii.vessel_id = ANY(${JSON.stringify(selectedVessel ? [selectedVessel] : vesselIds)})` : 'TRUE'})
        AND (${categories?.length ? `ic.category = ANY(${JSON.stringify(categories)})` : 'TRUE'})
        AND ii.created_at BETWEEN ${timeRange?.start || new Date('2024-01-01')} AND ${timeRange?.end || new Date()}
      GROUP BY ic.category
      ORDER BY total_value DESC
    `;

    // Get slow-moving items
    const slowMovingItems = await prisma.$queryRaw`
      SELECT 
        ii.id as item_id,
        ic.name as item_name,
        ic.category,
        EXTRACT(DAYS FROM (NOW() - ii.last_movement)) as days_in_stock,
        ii.current_stock * ii.unit_cost as value,
        ii.last_movement,
        CASE 
          WHEN EXTRACT(DAYS FROM (NOW() - ii.last_movement)) > 365 THEN 'liquidate'
          WHEN EXTRACT(DAYS FROM (NOW() - ii.last_movement)) > 180 THEN 'redistribute'
          ELSE 'monitor'
        END as recommended_action
      FROM inventory_items ii
      JOIN item_catalog ic ON ii.item_id = ic.id
      WHERE ii.last_movement < NOW() - INTERVAL '90 days'
        AND (${vesselIds?.length || selectedVessel ? `ii.vessel_id = ANY(${JSON.stringify(selectedVessel ? [selectedVessel] : vesselIds)})` : 'TRUE'})
        AND (${categories?.length ? `ic.category = ANY(${JSON.stringify(categories)})` : 'TRUE'})
      ORDER BY days_in_stock DESC
      LIMIT 20
    `;

    // Calculate category turnover data
    const categoryTurnover = (inventoryData as any[]).map((item: any) => ({
      category: item.category,
      turnoverRate: parseFloat(item.avg_turnover_rate) || 0,
      targetRate: parseFloat(item.target_rate) || 6.0,
      variance: (parseFloat(item.avg_turnover_rate) || 0) - (parseFloat(item.target_rate) || 6.0),
      trend: this.calculateTrend(parseFloat(item.avg_turnover_rate) || 0, parseFloat(item.target_rate) || 6.0),
      totalValue: parseFloat(item.total_value) || 0
    }));

    // Calculate value distribution
    const totalValue = categoryTurnover.reduce((sum, item) => sum + item.totalValue, 0);
    const valueDistribution = categoryTurnover.map(item => ({
      name: item.category,
      value: item.totalValue,
      percentage: totalValue > 0 ? (item.totalValue / totalValue) * 100 : 0,
      count: 0 // This would need additional query
    }));

    // Format slow-moving items
    const formattedSlowMovingItems = (slowMovingItems as any[]).map((item: any) => ({
      itemId: item.item_id,
      itemName: item.item_name,
      category: item.category,
      daysInStock: parseInt(item.days_in_stock),
      value: parseFloat(item.value),
      lastMovement: new Date(item.last_movement),
      recommendedAction: item.recommended_action as 'liquidate' | 'redistribute' | 'monitor'
    }));

    // Calculate overall metrics
    const overallMetrics = {
      totalInventoryValue: totalValue,
      averageTurnoverRate: categoryTurnover.reduce((sum, item) => sum + item.turnoverRate, 0) / categoryTurnover.length || 0,
      slowMovingPercentage: totalValue > 0 ? (formattedSlowMovingItems.reduce((sum, item) => sum + item.value, 0) / totalValue) * 100 : 0,
      excessInventoryValue: formattedSlowMovingItems.reduce((sum, item) => sum + item.value, 0),
      inventoryAccuracy: 95 // This would be calculated from cycle counts
    };

    return {
      categoryTurnover,
      valueDistribution,
      slowMovingItems: formattedSlowMovingItems,
      overallMetrics
    };
  }

  /**
   * Get demand forecast data with seasonal patterns
   */
  async getDemandForecast(filters: InventoryDemandFilters): Promise<DemandForecastData> {
    const { vesselIds, selectedVessel, categories, timeRange } = filters;

    // Get historical demand data for seasonal analysis
    const historicalDemand = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM r.created_at) as month,
        TO_CHAR(r.created_at, 'Mon') as month_name,
        ic.category,
        SUM(ri.quantity) as total_demand,
        AVG(ri.quantity) as avg_demand
      FROM requisitions r
      JOIN requisition_items ri ON r.id = ri.requisition_id
      JOIN item_catalog ic ON ri.item_id = ic.id
      WHERE r.created_at >= NOW() - INTERVAL '24 months'
        AND (${vesselIds?.length || selectedVessel ? `r.vessel_id = ANY(${JSON.stringify(selectedVessel ? [selectedVessel] : vesselIds)})` : 'TRUE'})
        AND (${categories?.length ? `ic.category = ANY(${JSON.stringify(categories)})` : 'TRUE'})
      GROUP BY EXTRACT(MONTH FROM r.created_at), TO_CHAR(r.created_at, 'Mon'), ic.category
      ORDER BY month, ic.category
    `;

    // Calculate seasonal patterns
    const monthlyData = new Map();
    (historicalDemand as any[]).forEach((item: any) => {
      const month = item.month_name;
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { month, historicalDemand: 0, forecastedDemand: 0, confidence: 0, seasonalIndex: 1.0 });
      }
      const existing = monthlyData.get(month);
      existing.historicalDemand += parseFloat(item.total_demand);
      existing.forecastedDemand = existing.historicalDemand * 1.1; // Simple 10% growth forecast
      existing.confidence = 85; // Base confidence
      existing.seasonalIndex = this.calculateSeasonalIndex(parseInt(item.month));
    });

    const seasonalPatterns = Array.from(monthlyData.values());

    // Generate category forecast data
    const categoryForecast = await this.generateCategoryForecast(filters);

    // Calculate forecast accuracy metrics
    const accuracy = 0.87; // This would be calculated from historical forecast vs actual
    const meanAbsoluteError = 12.5; // This would be calculated from historical data
    const trendDirection = this.calculateTrendDirection(seasonalPatterns);

    return {
      seasonalPatterns,
      categoryForecast,
      accuracy,
      meanAbsoluteError,
      trendDirection,
      forecastHorizon: 12
    };
  }

  /**
   * Get inventory optimization recommendations
   */
  async getOptimizationRecommendations(filters: InventoryDemandFilters): Promise<OptimizationRecommendations> {
    const { vesselIds, selectedVessel, categories } = filters;

    // Analyze current stock levels vs optimal
    const stockAnalysis = await prisma.$queryRaw`
      SELECT 
        ic.id as item_id,
        ic.name as item_name,
        ic.category,
        ii.current_stock,
        ii.reorder_point,
        ii.safety_stock,
        ii.economic_order_quantity,
        ii.unit_cost,
        CASE 
          WHEN ii.current_stock > ii.reorder_point * 2 THEN 'overstocked'
          WHEN ii.current_stock < ii.reorder_point THEN 'understocked'
          ELSE 'optimal'
        END as stock_status
      FROM item_catalog ic
      JOIN inventory_items ii ON ic.id = ii.item_id
      WHERE (${vesselIds?.length || selectedVessel ? `ii.vessel_id = ANY(${JSON.stringify(selectedVessel ? [selectedVessel] : vesselIds)})` : 'TRUE'})
        AND (${categories?.length ? `ic.category = ANY(${JSON.stringify(categories)})` : 'TRUE'})
    `;

    // Generate recommendations based on analysis
    const recommendations = [];
    const optimalStockLevels = [];
    let totalPotentialSavings = 0;

    (stockAnalysis as any[]).forEach((item: any) => {
      const currentStock = parseInt(item.current_stock);
      const optimalStock = parseInt(item.reorder_point) * 1.5; // 1.5x reorder point as optimal
      const unitCost = parseFloat(item.unit_cost);

      if (item.stock_status === 'overstocked') {
        const excessStock = currentStock - optimalStock;
        const potentialSavings = excessStock * unitCost;
        totalPotentialSavings += potentialSavings;

        recommendations.push({
          id: `rec_${item.item_id}`,
          title: `Reduce ${item.item_name} Inventory`,
          description: `Current stock (${currentStock}) exceeds optimal level (${optimalStock}) by ${excessStock} units`,
          category: 'stock_reduction' as const,
          impact: potentialSavings > 10000 ? 'high' as const : potentialSavings > 5000 ? 'medium' as const : 'low' as const,
          potentialSavings,
          implementationEffort: 'medium' as const,
          riskLevel: 'low' as const,
          affectedItems: [item.item_id],
          timeframe: '1-3 months'
        });
      }

      optimalStockLevels.push({
        itemName: item.item_name,
        currentStock,
        optimalStock,
        reorderPoint: parseInt(item.reorder_point),
        safetyStock: parseInt(item.safety_stock),
        economicOrderQuantity: parseInt(item.economic_order_quantity),
        variance: currentStock - optimalStock
      });
    });

    // Generate implementation priorities
    const implementationPriority = recommendations.map((rec, index) => ({
      recommendationId: rec.id,
      priority: index + 1,
      score: rec.impact === 'high' ? 90 : rec.impact === 'medium' ? 70 : 50,
      quickWins: rec.implementationEffort === 'low' && rec.potentialSavings > 5000,
      dependencies: []
    }));

    return {
      recommendations,
      optimalStockLevels,
      potentialSavings: totalPotentialSavings,
      implementationPriority
    };
  }

  /**
   * Get stock alerts and monitoring data
   */
  async getStockAlerts(filters: InventoryDemandFilters): Promise<StockAlertsData> {
    const { vesselIds, selectedVessel, categories } = filters;

    // Get critical stock alerts
    const alerts = await prisma.$queryRaw`
      SELECT 
        ii.id,
        ii.item_id,
        ic.name as item_name,
        ii.vessel_id,
        v.name as vessel_name,
        ic.category,
        ii.current_stock,
        ii.reorder_point,
        ii.safety_stock,
        CASE 
          WHEN ii.current_stock <= ii.safety_stock THEN 'critical'
          WHEN ii.current_stock <= ii.reorder_point THEN 'warning'
          ELSE 'info'
        END as severity,
        CASE 
          WHEN ii.current_stock <= ii.safety_stock THEN 'low_stock'
          WHEN ii.current_stock > ii.reorder_point * 3 THEN 'overstock'
          ELSE 'reorder_needed'
        END as alert_type,
        ii.created_at
      FROM inventory_items ii
      JOIN item_catalog ic ON ii.item_id = ic.id
      JOIN vessels v ON ii.vessel_id = v.id
      WHERE (ii.current_stock <= ii.reorder_point OR ii.current_stock > ii.reorder_point * 3)
        AND (${vesselIds?.length || selectedVessel ? `ii.vessel_id = ANY(${JSON.stringify(selectedVessel ? [selectedVessel] : vesselIds)})` : 'TRUE'})
        AND (${categories?.length ? `ic.category = ANY(${JSON.stringify(categories)})` : 'TRUE'})
      ORDER BY 
        CASE 
          WHEN ii.current_stock <= ii.safety_stock THEN 1
          WHEN ii.current_stock <= ii.reorder_point THEN 2
          ELSE 3
        END,
        ii.current_stock ASC
    `;

    // Format alerts
    const criticalAlerts = (alerts as any[]).map((alert: any) => ({
      id: alert.id,
      itemId: alert.item_id,
      itemName: alert.item_name,
      vesselId: alert.vessel_id,
      vesselName: alert.vessel_name,
      category: alert.category,
      severity: alert.severity as 'critical' | 'warning' | 'info',
      type: alert.alert_type as 'low_stock' | 'overstock' | 'reorder_needed',
      message: this.generateAlertMessage(alert),
      currentStock: parseInt(alert.current_stock),
      reorderPoint: parseInt(alert.reorder_point),
      recommendedAction: this.getRecommendedAction(alert),
      estimatedStockoutDate: this.calculateStockoutDate(alert),
      createdAt: new Date(alert.created_at)
    }));

    // Calculate summary statistics
    const summary = {
      totalAlerts: criticalAlerts.length,
      criticalCount: criticalAlerts.filter(a => a.severity === 'critical').length,
      warningCount: criticalAlerts.filter(a => a.severity === 'warning').length,
      infoCount: criticalAlerts.filter(a => a.severity === 'info').length,
      newAlertsToday: criticalAlerts.filter(a => 
        a.createdAt.toDateString() === new Date().toDateString()
      ).length,
      resolvedAlertsToday: 0 // This would require tracking resolved alerts
    };

    // Generate alert trends (simplified)
    const trends = this.generateAlertTrends();

    return {
      criticalAlerts,
      summary,
      trends
    };
  }

  /**
   * Get predictive maintenance data
   */
  async getPredictiveMaintenanceData(filters: InventoryDemandFilters): Promise<PredictiveMaintenanceData> {
    const { vesselIds, selectedVessel } = filters;

    // Get upcoming maintenance needs based on equipment usage and schedules
    const maintenanceNeeds = await prisma.$queryRaw`
      SELECT 
        vm.id,
        vm.vessel_id,
        v.name as vessel_name,
        vm.equipment_id,
        vm.equipment_name,
        vm.next_maintenance_date as predicted_date,
        vm.maintenance_type,
        vm.estimated_cost,
        vm.confidence_score as confidence,
        CASE 
          WHEN vm.next_maintenance_date <= NOW() + INTERVAL '30 days' THEN 'high'
          WHEN vm.next_maintenance_date <= NOW() + INTERVAL '90 days' THEN 'medium'
          ELSE 'low'
        END as urgency,
        CASE 
          WHEN vm.criticality = 'SAFETY_CRITICAL' THEN 'high'
          WHEN vm.criticality = 'OPERATIONAL_CRITICAL' THEN 'medium'
          ELSE 'low'
        END as risk_if_delayed
      FROM vessel_maintenance vm
      JOIN vessels v ON vm.vessel_id = v.id
      WHERE vm.next_maintenance_date >= NOW()
        AND vm.next_maintenance_date <= NOW() + INTERVAL '12 months'
        AND (${vesselIds?.length || selectedVessel ? `vm.vessel_id = ANY(${JSON.stringify(selectedVessel ? [selectedVessel] : vesselIds)})` : 'TRUE'})
      ORDER BY vm.next_maintenance_date ASC
    `;

    // Get required parts for each maintenance need
    const upcomingNeeds = await Promise.all(
      (maintenanceNeeds as any[]).map(async (need: any) => {
        const requiredParts = await this.getRequiredPartsForMaintenance(need.equipment_id, need.maintenance_type);
        
        return {
          id: need.id,
          vesselId: need.vessel_id,
          vesselName: need.vessel_name,
          equipmentId: need.equipment_id,
          equipmentName: need.equipment_name,
          predictedDate: new Date(need.predicted_date),
          confidence: parseInt(need.confidence),
          urgency: need.urgency as 'high' | 'medium' | 'low',
          estimatedCost: parseFloat(need.estimated_cost),
          requiredParts,
          maintenanceType: need.maintenance_type as 'preventive' | 'corrective' | 'overhaul',
          riskIfDelayed: need.risk_if_delayed as 'high' | 'medium' | 'low'
        };
      })
    );

    // Calculate summary metrics
    const summary = {
      totalUpcomingMaintenance: upcomingNeeds.length,
      next30Days: upcomingNeeds.filter(n => n.predictedDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length,
      next90Days: upcomingNeeds.filter(n => n.predictedDate <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)).length,
      totalEstimatedCost: upcomingNeeds.reduce((sum, n) => sum + n.estimatedCost, 0),
      highRiskItems: upcomingNeeds.filter(n => n.riskIfDelayed === 'high').length,
      partsToOrder: upcomingNeeds.reduce((sum, n) => sum + n.requiredParts.length, 0)
    };

    // Generate cost projections
    const costProjections = this.generateMaintenanceCostProjections(upcomingNeeds);

    // Generate risk assessments
    const riskAssessment = this.generateMaintenanceRiskAssessment(upcomingNeeds);

    return {
      upcomingNeeds,
      summary,
      costProjections,
      riskAssessment
    };
  }

  // Helper methods
  private calculateTrend(current: number, target: number): 'improving' | 'declining' | 'stable' {
    const variance = current - target;
    if (variance > 0.5) return 'improving';
    if (variance < -0.5) return 'declining';
    return 'stable';
  }

  private calculateSeasonalIndex(month: number): number {
    // Simplified seasonal index calculation
    const seasonalFactors = [0.9, 0.85, 1.1, 1.2, 1.3, 1.1, 0.9, 0.8, 1.0, 1.2, 1.1, 1.0];
    return seasonalFactors[month - 1] || 1.0;
  }

  private calculateTrendDirection(patterns: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (patterns.length < 2) return 'stable';
    
    const firstHalf = patterns.slice(0, Math.floor(patterns.length / 2));
    const secondHalf = patterns.slice(Math.floor(patterns.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, p) => sum + p.forecastedDemand, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.forecastedDemand, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }

  private async generateCategoryForecast(filters: InventoryDemandFilters) {
    // Simplified category forecast generation
    const quarters = ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'];
    const categories = filters.categories || ['Engine Parts', 'Safety Equipment', 'Deck Equipment'];
    
    return quarters.map(quarter => {
      const forecast: any = { period: quarter };
      categories.forEach(category => {
        forecast[category] = Math.floor(Math.random() * 100) + 50; // Simplified forecast
      });
      return forecast;
    });
  }

  private generateAlertMessage(alert: any): string {
    if (alert.severity === 'critical') {
      return `Critical: Stock level (${alert.current_stock}) is below safety threshold`;
    } else if (alert.severity === 'warning') {
      return `Warning: Stock level (${alert.current_stock}) is below reorder point`;
    }
    return `Info: Stock level monitoring for ${alert.item_name}`;
  }

  private getRecommendedAction(alert: any): string {
    if (alert.severity === 'critical') {
      return 'Order immediately - emergency procurement required';
    } else if (alert.severity === 'warning') {
      return 'Initiate reorder process';
    }
    return 'Monitor stock levels';
  }

  private calculateStockoutDate(alert: any): Date | undefined {
    if (alert.severity === 'critical') {
      // Estimate stockout in 7-14 days for critical items
      return new Date(Date.now() + (7 + Math.random() * 7) * 24 * 60 * 60 * 1000);
    }
    return undefined;
  }

  private generateAlertTrends() {
    // Simplified trend generation
    const trends = [];
    for (let i = 7; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        criticalAlerts: Math.floor(Math.random() * 5) + 1,
        warningAlerts: Math.floor(Math.random() * 10) + 3,
        totalAlerts: Math.floor(Math.random() * 20) + 10
      });
    }
    return trends;
  }

  private async getRequiredPartsForMaintenance(equipmentId: string, maintenanceType: string) {
    // Simplified required parts lookup
    return [
      {
        itemId: 'part1',
        itemName: 'Engine Gasket',
        quantity: 2,
        unitCost: 500,
        totalCost: 1000,
        leadTime: 14,
        availability: 'order_required' as const,
        alternativeParts: ['part2']
      }
    ];
  }

  private generateMaintenanceCostProjections(needs: any[]) {
    const months = ['Mar 2024', 'Apr 2024', 'May 2024', 'Jun 2024'];
    return months.map(month => ({
      month,
      projectedCost: Math.floor(Math.random() * 50000) + 20000,
      confidence: Math.floor(Math.random() * 20) + 70,
      breakdown: {
        preventive: Math.floor(Math.random() * 25000) + 10000,
        corrective: Math.floor(Math.random() * 15000) + 5000,
        overhaul: Math.floor(Math.random() * 10000) + 2000
      }
    }));
  }

  private generateMaintenanceRiskAssessment(needs: any[]) {
    // Group by vessel and assess risk
    const vesselGroups = new Map();
    needs.forEach(need => {
      if (!vesselGroups.has(need.vesselId)) {
        vesselGroups.set(need.vesselId, {
          vesselId: need.vesselId,
          vesselName: need.vesselName,
          needs: []
        });
      }
      vesselGroups.get(need.vesselId).needs.push(need);
    });

    return Array.from(vesselGroups.values()).map(vessel => ({
      vesselId: vessel.vesselId,
      vesselName: vessel.vesselName,
      riskScore: Math.floor(Math.random() * 40) + 60,
      criticalEquipment: vessel.needs.filter((n: any) => n.riskIfDelayed === 'high').map((n: any) => n.equipmentName),
      overdueMaintenanceCount: Math.floor(Math.random() * 3),
      estimatedDowntimeRisk: Math.floor(Math.random() * 72) + 24,
      financialRisk: vessel.needs.reduce((sum: number, n: any) => sum + n.estimatedCost, 0),
      recommendations: [
        'Schedule immediate maintenance for critical equipment',
        'Order required parts in advance',
        'Consider maintenance window optimization'
      ]
    }));
  }
}

export default InventoryDemandAnalyticsService;