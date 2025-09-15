// Analytics Types for FlowMarine Dashboard Components

export interface SpendData {
  period: string;
  totalSpend: number;
  currency: string;
  breakdown: CategoryBreakdown[];
  vesselBreakdown: VesselBreakdown[];
  yearOverYear?: YearOverYearComparison;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage?: number;
}

export interface VesselBreakdown {
  vesselId: string;
  vesselName: string;
  amount: number;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface YearOverYearComparison {
  currentPeriod: number;
  previousPeriod: number;
  change: number;
  changePercentage: number;
}

export interface BudgetData {
  totalBudget: number;
  utilized: number;
  remaining: number;
  utilizationPercentage: number;
  variance: BudgetVariance;
  projectedSpend: number;
  alerts: BudgetAlert[];
  hierarchy: BudgetHierarchy[];
}

export interface BudgetVariance {
  amount: number;
  percentage: number;
  status: 'under' | 'over' | 'on-track';
}

export interface BudgetAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  threshold: number;
  currentValue: number;
  vesselId?: string;
  category?: string;
  createdAt: Date;
}

export interface BudgetHierarchy {
  level: 'vessel' | 'fleet' | 'company';
  id: string;
  name: string;
  budget: number;
  utilized: number;
  remaining: number;
  utilizationPercentage: number;
  children?: BudgetHierarchy[];
}

export interface VendorPerformance {
  vendorId: string;
  vendorName: string;
  overallScore: number;
  deliveryScore: number;
  qualityScore: number;
  priceScore: number;
  totalOrders: number;
  onTimeDeliveryRate: number;
  averageDeliveryTime: number;
  costSavings: number;
  trend: 'improving' | 'declining' | 'stable';
  historicalScores: HistoricalScore[];
  recommendations: string[];
}

export interface HistoricalScore {
  period: string;
  overallScore: number;
  deliveryScore: number;
  qualityScore: number;
  priceScore: number;
}

export interface CostSavingsData {
  totalSavings: number;
  savingsBreakdown: SavingsBreakdown[];
  roiMetrics: ROIMetrics;
  emergencyVsPlanned: EmergencyVsPlannedRatio;
  savingsForecast: SavingsForecast[];
  initiatives: SavingsInitiative[];
}

export interface SavingsBreakdown {
  category: string;
  amount: number;
  percentage: number;
  source: 'negotiation' | 'bulk_purchase' | 'automation' | 'process_improvement';
}

export interface ROIMetrics {
  totalInvestment: number;
  totalSavings: number;
  roi: number;
  paybackPeriod: number; // in months
  netPresentValue: number;
}

export interface EmergencyVsPlannedRatio {
  emergencySpend: number;
  plannedSpend: number;
  emergencyPercentage: number;
  targetPercentage: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface SavingsForecast {
  period: string;
  projectedSavings: number;
  confidence: number; // 0-100
}

export interface SavingsInitiative {
  id: string;
  name: string;
  description: string;
  targetSavings: number;
  actualSavings: number;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  startDate: Date;
  endDate?: Date;
}

// Dashboard Configuration Types
export interface DashboardFilters {
  timeRange: 'monthly' | 'quarterly' | 'yearly';
  dateFrom: Date;
  dateTo: Date;
  vessels: string[];
  categories: string[];
  vendors: string[];
  currency: string;
}

export interface DrillDownLevel {
  level: 'fleet' | 'vessel' | 'category' | 'vendor';
  id?: string;
  name?: string;
}

export interface ChartConfiguration {
  type: 'line' | 'bar' | 'doughnut' | 'pie' | 'area';
  responsive: boolean;
  maintainAspectRatio: boolean;
  colors: string[];
  animations: boolean;
}

// API Response Types
export interface AnalyticsApiResponse<T> {
  success: boolean;
  data: T;
  lastUpdated: Date;
  metadata?: {
    totalRecords: number;
    filters: DashboardFilters;
    executionTime: number;
  };
}

export interface RealTimeUpdate {
  type: 'spend' | 'budget' | 'vendor' | 'savings';
  data: any;
  timestamp: Date;
  vesselId?: string;
  category?: string;
}

// Operational Analytics Types
export interface CycleTimeData {
  averageCycleTime: number; // in hours
  cycleTimeByStage: CycleTimeStage[];
  vesselComparison: VesselCycleTimeComparison[];
  bottlenecks: Bottleneck[];
  trends: CycleTimeTrend[];
  recommendations: EfficiencyRecommendation[];
}

export interface CycleTimeStage {
  stage: 'requisition' | 'approval' | 'rfq' | 'quote_selection' | 'po_creation' | 'delivery';
  stageName: string;
  averageTime: number; // in hours
  minTime: number;
  maxTime: number;
  bottlenecks: Bottleneck[];
  efficiency: number; // 0-100 percentage
}

export interface Bottleneck {
  id: string;
  stage: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  frequency: number; // occurrences per month
  averageDelay: number; // in hours
  rootCause: string;
  recommendation: string;
  estimatedSavings: number; // in hours if resolved
}

export interface VesselCycleTimeComparison {
  vesselId: string;
  vesselName: string;
  averageCycleTime: number;
  efficiency: number; // 0-100 percentage
  rank: number;
  improvement: number; // percentage change from previous period
  bottleneckCount: number;
}

export interface CycleTimeTrend {
  period: string;
  averageCycleTime: number;
  efficiency: number;
  bottleneckCount: number;
}

export interface EfficiencyRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  estimatedTimeSavings: number; // in hours
  estimatedCostSavings: number;
  category: 'process' | 'automation' | 'training' | 'system';
}

export interface VesselSpendingPattern {
  vesselId: string;
  vesselName: string;
  vesselType: string;
  totalSpend: number;
  spendPerCategory: CategorySpend[];
  spendTrend: SpendTrendPoint[];
  efficiency: VesselEfficiencyMetrics;
  routeCorrelation: RouteSpendCorrelation[];
  recommendations: VesselRecommendation[];
}

export interface CategorySpend {
  category: string;
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  benchmark: number; // fleet average
}

export interface SpendTrendPoint {
  period: string;
  amount: number;
  category?: string;
}

export interface VesselEfficiencyMetrics {
  spendPerNauticalMile: number;
  spendPerDay: number;
  maintenanceEfficiency: number;
  procurementEfficiency: number;
  overallRating: number;
  fleetRank: number;
}

export interface RouteSpendCorrelation {
  route: string;
  frequency: number;
  averageSpend: number;
  spendPerMile: number;
  correlation: number; // -1 to 1
}

export interface VesselRecommendation {
  id: string;
  type: 'cost_reduction' | 'efficiency' | 'maintenance' | 'procurement';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedSavings: number;
  implementationEffort: 'high' | 'medium' | 'low';
}

export interface PortEfficiencyData {
  portId: string;
  portName: string;
  country: string;
  totalDeliveries: number;
  onTimeDeliveryRate: number;
  averageDeliveryTime: number; // in hours
  costEfficiency: number; // 0-100 rating
  customsClearanceTime: number; // in hours
  rating: number; // 0-5 stars
  trends: PortTrend[];
  seasonalPatterns: SeasonalPattern[];
  recommendations: PortRecommendation[];
}

export interface PortTrend {
  period: string;
  deliveries: number;
  onTimeRate: number;
  averageTime: number;
  cost: number;
}

export interface SeasonalPattern {
  month: number;
  monthName: string;
  demandMultiplier: number; // 1.0 = average
  averageDeliveryTime: number;
  costMultiplier: number;
}

export interface PortRecommendation {
  id: string;
  type: 'logistics' | 'cost' | 'timing' | 'alternative';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: number;
}

export interface InventoryAnalyticsData {
  totalInventoryValue: number;
  turnoverRate: number;
  stockLevels: StockLevel[];
  demandForecast: DemandForecast[];
  optimizationOpportunities: InventoryOptimization[];
  alerts: InventoryAlert[];
  predictiveMaintenance: MaintenanceForecast[];
}

export interface StockLevel {
  itemId: string;
  itemName: string;
  category: string;
  currentStock: number;
  optimalStock: number;
  reorderPoint: number;
  turnoverRate: number;
  status: 'optimal' | 'overstocked' | 'understocked' | 'critical';
  vesselId?: string;
}

export interface DemandForecast {
  itemId: string;
  itemName: string;
  category: string;
  forecastPeriod: string;
  predictedDemand: number;
  confidence: number; // 0-100
  seasonalFactor: number;
  trendFactor: number;
}

export interface InventoryOptimization {
  id: string;
  type: 'reduce_stock' | 'increase_stock' | 'consolidate' | 'redistribute';
  title: string;
  description: string;
  items: string[];
  estimatedSavings: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface InventoryAlert {
  id: string;
  type: 'low_stock' | 'overstock' | 'expired' | 'slow_moving';
  severity: 'critical' | 'warning' | 'info';
  itemId: string;
  itemName: string;
  message: string;
  vesselId?: string;
  createdAt: Date;
}

export interface MaintenanceForecast {
  vesselId: string;
  vesselName: string;
  equipmentId: string;
  equipmentName: string;
  predictedMaintenanceDate: Date;
  confidence: number;
  estimatedCost: number;
  requiredParts: MaintenancePart[];
  urgency: 'high' | 'medium' | 'low';
}

export interface MaintenancePart {
  itemId: string;
  itemName: string;
  quantity: number;
  estimatedCost: number;
  leadTime: number; // in days
  availability: 'in_stock' | 'order_required' | 'critical_shortage';
}

// Port Efficiency and Logistics Analytics Types
export interface PortLogisticsData {
  portId: string;
  portName: string;
  country: string;
  region: string;
  totalDeliveries: number;
  onTimeDeliveryRate: number;
  averageDeliveryTime: number; // in hours
  costEfficiency: number; // 0-100 rating
  customsClearanceTime: number; // in hours
  rating: number; // 0-5 stars
  trends: PortTrend[];
  seasonalPatterns: SeasonalPattern[];
  recommendations: PortRecommendation[];
  logistics: PortLogisticsMetrics;
  comparison: PortComparisonData;
}

export interface PortLogisticsMetrics {
  averageDockingTime: number; // in hours
  cargoHandlingEfficiency: number; // 0-100 rating
  portCongestionLevel: 'low' | 'medium' | 'high';
  availableBerths: number;
  averageWaitTime: number; // in hours
  fuelAvailability: boolean;
  sparePartsAvailability: boolean;
  customsComplexity: 'simple' | 'moderate' | 'complex';
}

export interface PortComparisonData {
  rank: number;
  totalPorts: number;
  benchmarkMetrics: {
    deliveryTime: number; // industry average
    costEfficiency: number; // industry average
    onTimeRate: number; // industry average
  };
  competitorAnalysis: {
    betterPorts: number;
    worsePorts: number;
    similarPorts: number;
  };
}

export interface LogisticsOptimization {
  id: string;
  type: 'route' | 'timing' | 'consolidation' | 'alternative_port';
  title: string;
  description: string;
  currentCost: number;
  optimizedCost: number;
  potentialSavings: number;
  savingsPercentage: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  estimatedTimeToImplement: number; // in days
  affectedVessels: string[];
  affectedRoutes: string[];
}

export interface SeasonalDemandForecast {
  month: number;
  monthName: string;
  demandMultiplier: number; // 1.0 = average
  predictedVolume: number;
  confidence: number; // 0-100
  factors: SeasonalFactor[];
  recommendations: string[];
}

export interface SeasonalFactor {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  historicalCorrelation: number; // -1 to 1
}

export interface PortEfficiencyDashboardData {
  overview: {
    totalPorts: number;
    averageEfficiency: number;
    topPerformingPort: string;
    mostImprovedPort: string;
    totalDeliveries: number;
    overallOnTimeRate: number;
  };
  portRankings: PortLogisticsData[];
  logisticsOptimizations: LogisticsOptimization[];
  seasonalForecasts: SeasonalDemandForecast[];
  regionalAnalysis: RegionalPortAnalysis[];
  alerts: PortAlert[];
}

export interface RegionalPortAnalysis {
  region: string;
  portCount: number;
  averageEfficiency: number;
  totalVolume: number;
  costIndex: number; // relative to global average
  strengths: string[];
  challenges: string[];
  opportunities: string[];
}

export interface PortAlert {
  id: string;
  portId: string;
  portName: string;
  type: 'congestion' | 'delay' | 'cost_increase' | 'service_disruption';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  impact: string;
  recommendedAction: string;
  estimatedDuration: string;
  createdAt: Date;
}

// Inventory and Demand Analytics Types
export interface InventoryDemandFilters {
  vesselIds?: string[];
  selectedVessel?: string;
  categories?: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface InventoryTurnoverData {
  categoryTurnover: CategoryTurnoverData[];
  valueDistribution: InventoryValueDistribution[];
  slowMovingItems: SlowMovingItem[];
  overallMetrics: InventoryOverallMetrics;
}

export interface CategoryTurnoverData {
  category: string;
  turnoverRate: number;
  targetRate: number;
  variance: number;
  trend: 'improving' | 'declining' | 'stable';
  totalValue: number;
}

export interface InventoryValueDistribution {
  name: string;
  value: number;
  percentage: number;
  count: number;
}

export interface SlowMovingItem {
  itemId: string;
  itemName: string;
  category: string;
  daysInStock: number;
  value: number;
  lastMovement: Date;
  recommendedAction: 'liquidate' | 'redistribute' | 'monitor';
}

export interface InventoryOverallMetrics {
  totalInventoryValue: number;
  averageTurnoverRate: number;
  slowMovingPercentage: number;
  excessInventoryValue: number;
  inventoryAccuracy: number;
}

export interface DemandForecastData {
  seasonalPatterns: SeasonalDemandData[];
  categoryForecast: CategoryForecastData[];
  accuracy: number;
  meanAbsoluteError: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  forecastHorizon: number; // in months
}

export interface SeasonalDemandData {
  month: string;
  historicalDemand: number;
  forecastedDemand: number;
  confidence: number;
  seasonalIndex: number;
}

export interface CategoryForecastData {
  period: string;
  [category: string]: number | string; // Dynamic category columns
}

export interface OptimizationRecommendations {
  recommendations: InventoryRecommendation[];
  optimalStockLevels: OptimalStockLevel[];
  potentialSavings: number;
  implementationPriority: RecommendationPriority[];
}

export interface InventoryRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'stock_reduction' | 'stock_increase' | 'reorder_optimization' | 'consolidation';
  impact: 'high' | 'medium' | 'low';
  potentialSavings: number;
  implementationEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  affectedItems: string[];
  timeframe: string;
}

export interface OptimalStockLevel {
  itemName: string;
  currentStock: number;
  optimalStock: number;
  reorderPoint: number;
  safetyStock: number;
  economicOrderQuantity: number;
  variance: number;
}

export interface RecommendationPriority {
  recommendationId: string;
  priority: number;
  score: number;
  quickWins: boolean;
  dependencies: string[];
}

export interface StockAlertsData {
  criticalAlerts: StockAlert[];
  summary: AlertSummary;
  trends: AlertTrend[];
}

export interface StockAlert {
  id: string;
  itemId: string;
  itemName: string;
  vesselId: string;
  vesselName: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'low_stock' | 'overstock' | 'expired' | 'obsolete' | 'reorder_needed';
  message: string;
  currentStock: number;
  reorderPoint: number;
  recommendedAction: string;
  estimatedStockoutDate?: Date;
  createdAt: Date;
}

export interface AlertSummary {
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  newAlertsToday: number;
  resolvedAlertsToday: number;
}

export interface AlertTrend {
  date: string;
  criticalAlerts: number;
  warningAlerts: number;
  totalAlerts: number;
}

export interface PredictiveMaintenanceData {
  upcomingNeeds: MaintenanceNeed[];
  summary: MaintenanceSummary;
  costProjections: MaintenanceCostProjection[];
  riskAssessment: MaintenanceRiskAssessment[];
}

export interface MaintenanceNeed {
  id: string;
  vesselId: string;
  vesselName: string;
  equipmentId: string;
  equipmentName: string;
  predictedDate: Date;
  confidence: number;
  urgency: 'high' | 'medium' | 'low';
  estimatedCost: number;
  requiredParts: RequiredPart[];
  maintenanceType: 'preventive' | 'corrective' | 'overhaul';
  riskIfDelayed: 'high' | 'medium' | 'low';
}

export interface RequiredPart {
  itemId: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  leadTime: number;
  availability: 'in_stock' | 'order_required' | 'critical_shortage';
  alternativeParts: string[];
}

export interface MaintenanceSummary {
  totalUpcomingMaintenance: number;
  next30Days: number;
  next90Days: number;
  totalEstimatedCost: number;
  highRiskItems: number;
  partsToOrder: number;
}

export interface MaintenanceCostProjection {
  month: string;
  projectedCost: number;
  confidence: number;
  breakdown: {
    preventive: number;
    corrective: number;
    overhaul: number;
  };
}

export interface MaintenanceRiskAssessment {
  vesselId: string;
  vesselName: string;
  riskScore: number;
  criticalEquipment: string[];
  overdueMaintenanceCount: number;
  estimatedDowntimeRisk: number; // in hours
  financialRisk: number;
  recommendations: string[];
}

// Financial Insights Dashboard Types
export interface MultiCurrencyConsolidationData {
  totalSpendBaseCurrency: number;
  baseCurrency: string;
  currencyBreakdown: CurrencyBreakdown[];
  exchangeRateImpact: ExchangeRateImpact;
  historicalRates: HistoricalExchangeRate[];
  hedgingRecommendations: HedgingRecommendation[];
}

export interface CurrencyBreakdown {
  currency: string;
  amount: number;
  amountInBaseCurrency: number;
  exchangeRate: number;
  percentage: number;
  trend: 'strengthening' | 'weakening' | 'stable';
  volatility: number;
}

export interface ExchangeRateImpact {
  gainLoss: number;
  percentage: number;
  trend: 'favorable' | 'unfavorable' | 'neutral';
  impactByMonth: MonthlyImpact[];
}

export interface MonthlyImpact {
  month: string;
  gainLoss: number;
  exchangeRate: number;
  volume: number;
}

export interface HistoricalExchangeRate {
  currency: string;
  date: Date;
  rate: number;
  change: number;
  changePercentage: number;
}

export interface HedgingRecommendation {
  id: string;
  currency: string;
  recommendationType: 'forward_contract' | 'option' | 'swap' | 'natural_hedge';
  title: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  potentialSavings: number;
  timeHorizon: string;
  implementation: string;
}

export interface PaymentTermsOptimizationData {
  currentTermsAnalysis: PaymentTermsAnalysis;
  earlyPaymentDiscounts: EarlyPaymentDiscountData;
  vendorPaymentPerformance: VendorPaymentPerformance[];
  cashFlowOptimization: CashFlowOptimization;
  paymentTimingOptimization: PaymentTimingOptimization[];
}

export interface PaymentTermsAnalysis {
  averagePaymentTerms: number;
  weightedAverageTerms: number;
  termDistribution: TermDistribution[];
  benchmarkComparison: BenchmarkComparison;
}

export interface TermDistribution {
  terms: string;
  vendorCount: number;
  totalValue: number;
  percentage: number;
}

export interface BenchmarkComparison {
  industryAverage: number;
  variance: number;
  ranking: 'above_average' | 'average' | 'below_average';
}

export interface EarlyPaymentDiscountData {
  captured: number;
  missed: number;
  potentialSavings: number;
  discountOpportunities: DiscountOpportunity[];
  monthlyTrends: MonthlyDiscountTrend[];
}

export interface DiscountOpportunity {
  vendorId: string;
  vendorName: string;
  discountRate: number;
  discountDays: number;
  standardTerms: number;
  potentialSavings: number;
  riskAssessment: 'low' | 'medium' | 'high';
}

export interface MonthlyDiscountTrend {
  month: string;
  captured: number;
  missed: number;
  captureRate: number;
}

export interface VendorPaymentPerformance {
  vendorId: string;
  vendorName: string;
  averagePaymentTime: number;
  onTimePaymentRate: number;
  earlyPaymentRate: number;
  latePaymentRate: number;
  paymentTerms: string;
  creditRating: string;
  relationshipScore: number;
}

export interface CashFlowOptimization {
  currentCashCycle: number;
  optimizedCashCycle: number;
  potentialImprovement: number;
  recommendations: CashFlowRecommendation[];
  monthlyProjections: MonthlyCashFlowProjection[];
}

export interface CashFlowRecommendation {
  id: string;
  type: 'extend_terms' | 'early_discount' | 'payment_timing' | 'supplier_financing';
  title: string;
  description: string;
  impact: number;
  implementationEffort: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MonthlyCashFlowProjection {
  month: string;
  inflows: number;
  outflows: number;
  netFlow: number;
  cumulativeFlow: number;
}

export interface PaymentTimingOptimization {
  vendorId: string;
  vendorName: string;
  currentTiming: string;
  recommendedTiming: string;
  potentialSavings: number;
  riskImpact: 'positive' | 'neutral' | 'negative';
  implementationComplexity: 'low' | 'medium' | 'high';
}

export interface CostAnalysisVarianceData {
  budgetVsActualAnalysis: BudgetVarianceAnalysis;
  costPerVesselMile: CostPerVesselMileData;
  categoryAnalysis: CategoryCostAnalysis[];
  varianceExplanation: VarianceExplanation[];
  costOptimizationRecommendations: CostOptimizationRecommendation[];
}

export interface BudgetVarianceAnalysis {
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  variancePercentage: number;
  favorableVariance: number;
  unfavorableVariance: number;
  varianceByPeriod: PeriodVariance[];
}

export interface PeriodVariance {
  period: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercentage: number;
  status: 'favorable' | 'unfavorable' | 'on_target';
}

export interface CostPerVesselMileData {
  overallCostPerMile: number;
  vesselComparison: VesselMileComparison[];
  categoryBreakdown: CategoryMileBreakdown[];
  trends: CostPerMileTrend[];
  benchmarks: CostBenchmark[];
}

export interface VesselMileComparison {
  vesselId: string;
  vesselName: string;
  costPerMile: number;
  totalMiles: number;
  totalCost: number;
  efficiency: number;
  rank: number;
  improvement: number;
}

export interface CategoryMileBreakdown {
  category: string;
  costPerMile: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  benchmark: number;
}

export interface CostPerMileTrend {
  period: string;
  costPerMile: number;
  totalMiles: number;
  efficiency: number;
}

export interface CostBenchmark {
  vesselType: string;
  industryAverage: number;
  topQuartile: number;
  bottomQuartile: number;
  ourPerformance: number;
  ranking: 'top_quartile' | 'above_average' | 'below_average' | 'bottom_quartile';
}

export interface CategoryCostAnalysis {
  category: string;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  drivers: CostDriver[];
  seasonality: SeasonalityFactor[];
}

export interface CostDriver {
  driver: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  correlation: number;
  actionable: boolean;
}

export interface SeasonalityFactor {
  month: number;
  monthName: string;
  seasonalIndex: number;
  historicalAverage: number;
  explanation: string;
}

export interface VarianceExplanation {
  category: string;
  variance: number;
  rootCause: string;
  explanation: string;
  impact: 'high' | 'medium' | 'low';
  controllable: boolean;
  recommendedAction: string;
  timeline: string;
}

export interface CostOptimizationRecommendation {
  id: string;
  category: string;
  type: 'process_improvement' | 'vendor_negotiation' | 'consolidation' | 'timing_optimization';
  title: string;
  description: string;
  currentCost: number;
  optimizedCost: number;
  potentialSavings: number;
  savingsPercentage: number;
  implementationEffort: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  timeToImplement: string;
  roi: number;
  priority: 'high' | 'medium' | 'low';
}