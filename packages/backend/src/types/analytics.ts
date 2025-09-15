// Backend Analytics Types for FlowMarine

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