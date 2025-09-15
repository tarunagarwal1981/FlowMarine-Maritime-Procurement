import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BudgetService } from '../services/budgetService';
import { CurrencyService } from '../services/currencyService';

// Mock CurrencyService
vi.mock('../services/currencyService');
const mockedCurrencyService = vi.mocked(CurrencyService);

// Mock Prisma
const mockPrisma = {
  budget: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn()
  },
  requisition: {
    aggregate: vi.fn()
  },
  purchaseOrder: {
    aggregate: vi.fn()
  }
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma)
}));

describe('BudgetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createBudget', () => {
    it('should create a budget successfully', async () => {
      const budgetData = {
        vesselId: 'vessel1',
        costCenterId: 'cost1',
        category: 'ENGINE_PARTS',
        amount: 10000,
        currency: 'USD',
        period: '2024-Q1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      };

      const mockBudget = {
        id: 'budget1',
        ...budgetData,
        vessel: { id: 'vessel1', name: 'Test Vessel' },
        costCenter: { id: 'cost1', name: 'Test Cost Center' }
      };

      mockedCurrencyService.isValidCurrency.mockReturnValue(true);
      mockPrisma.budget.findFirst.mockResolvedValue(null); // No overlapping budget
      mockPrisma.budget.create.mockResolvedValue(mockBudget);

      const result = await BudgetService.createBudget(budgetData);

      expect(result).toEqual(mockBudget);
      expect(mockPrisma.budget.create).toHaveBeenCalledWith({
        data: budgetData,
        include: {
          vessel: true,
          costCenter: true
        }
      });
    });

    it('should throw error for invalid currency', async () => {
      const budgetData = {
        category: 'ENGINE_PARTS',
        amount: 10000,
        currency: 'INVALID',
        period: '2024-Q1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      };

      mockedCurrencyService.isValidCurrency.mockReturnValue(false);

      await expect(BudgetService.createBudget(budgetData)).rejects.toThrow('Invalid currency: INVALID');
    });

    it('should throw error for invalid date range', async () => {
      const budgetData = {
        category: 'ENGINE_PARTS',
        amount: 10000,
        currency: 'USD',
        period: '2024-Q1',
        startDate: new Date('2024-03-31'),
        endDate: new Date('2024-01-01')
      };

      mockedCurrencyService.isValidCurrency.mockReturnValue(true);

      await expect(BudgetService.createBudget(budgetData)).rejects.toThrow('Start date must be before end date');
    });

    it('should throw error for overlapping budget', async () => {
      const budgetData = {
        vesselId: 'vessel1',
        category: 'ENGINE_PARTS',
        amount: 10000,
        currency: 'USD',
        period: '2024-Q1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      };

      mockedCurrencyService.isValidCurrency.mockReturnValue(true);
      mockPrisma.budget.findFirst.mockResolvedValue({ id: 'existing' }); // Overlapping budget exists

      await expect(BudgetService.createBudget(budgetData)).rejects.toThrow('Overlapping budget period found for this category');
    });
  });

  describe('checkBudgetAvailability', () => {
    it('should return available when budget has sufficient funds', async () => {
      const mockBudget = {
        id: 'budget1',
        vesselId: 'vessel1',
        costCenterId: null,
        category: 'ENGINE_PARTS',
        currency: 'USD',
        amount: 10000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      mockPrisma.budget.findFirst.mockResolvedValue(mockBudget);
      mockPrisma.requisition.aggregate.mockResolvedValue({ _sum: { totalAmount: 3000 } });
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({ _sum: { totalAmount: 2000 } });

      const result = await BudgetService.checkBudgetAvailability(
        'vessel1',
        'ENGINE_PARTS',
        1000,
        'USD'
      );

      expect(result).toEqual({
        available: true,
        budgetId: 'budget1',
        remainingAmount: 5000, // 10000 - 3000 - 2000
        utilizationPercentage: 50, // (3000 + 2000) / 10000 * 100
        message: 'Budget available. Remaining: 5000 USD'
      });
    });

    it('should return not available when budget has insufficient funds', async () => {
      const mockBudget = {
        id: 'budget1',
        vesselId: 'vessel1',
        costCenterId: null,
        category: 'ENGINE_PARTS',
        currency: 'USD',
        amount: 10000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      mockPrisma.budget.findFirst.mockResolvedValue(mockBudget);
      mockPrisma.requisition.aggregate.mockResolvedValue({ _sum: { totalAmount: 8000 } });
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({ _sum: { totalAmount: 1500 } });

      const result = await BudgetService.checkBudgetAvailability(
        'vessel1',
        'ENGINE_PARTS',
        1000,
        'USD'
      );

      expect(result).toEqual({
        available: false,
        budgetId: 'budget1',
        remainingAmount: 500, // 10000 - 8000 - 1500
        utilizationPercentage: 95, // (8000 + 1500) / 10000 * 100
        message: 'Insufficient budget. Required: 1000 USD, Available: 500 USD'
      });
    });

    it('should return not available when no budget found', async () => {
      mockPrisma.budget.findFirst.mockResolvedValue(null);

      const result = await BudgetService.checkBudgetAvailability(
        'vessel1',
        'ENGINE_PARTS',
        1000,
        'USD'
      );

      expect(result).toEqual({
        available: false,
        message: 'No active budget found for category ENGINE_PARTS in USD'
      });
    });
  });

  describe('getVesselBudgetSummary', () => {
    it('should return multi-currency budget summary', async () => {
      const mockBudgets = [
        {
          id: 'budget1',
          vesselId: 'vessel1',
          costCenterId: null,
          category: 'ENGINE_PARTS',
          amount: 10000,
          currency: 'USD',
          period: '2024-Q1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-31'),
          vessel: { id: 'vessel1', name: 'Test Vessel' },
          costCenter: null
        },
        {
          id: 'budget2',
          vesselId: 'vessel1',
          costCenterId: null,
          category: 'SAFETY_GEAR',
          amount: 5000,
          currency: 'EUR',
          period: '2024-Q1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-31'),
          vessel: { id: 'vessel1', name: 'Test Vessel' },
          costCenter: null
        }
      ];

      mockPrisma.budget.findMany.mockResolvedValue(mockBudgets);
      mockPrisma.requisition.aggregate.mockResolvedValue({ _sum: { totalAmount: 2000 } });
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({ _sum: { totalAmount: 1000 } });

      // Mock currency conversions
      mockedCurrencyService.convertCurrency
        .mockResolvedValueOnce({
          amount: 10000,
          fromCurrency: 'USD',
          toCurrency: 'USD',
          convertedAmount: 10000,
          exchangeRate: 1,
          conversionDate: new Date()
        })
        .mockResolvedValueOnce({
          amount: 3000,
          fromCurrency: 'USD',
          toCurrency: 'USD',
          convertedAmount: 3000,
          exchangeRate: 1,
          conversionDate: new Date()
        })
        .mockResolvedValueOnce({
          amount: 5000,
          fromCurrency: 'EUR',
          toCurrency: 'USD',
          convertedAmount: 5500,
          exchangeRate: 1.1,
          conversionDate: new Date()
        })
        .mockResolvedValueOnce({
          amount: 3000,
          fromCurrency: 'EUR',
          toCurrency: 'USD',
          convertedAmount: 3300,
          exchangeRate: 1.1,
          conversionDate: new Date()
        });

      const result = await BudgetService.getVesselBudgetSummary('vessel1', undefined, 'USD');

      expect(result.baseCurrency).toBe('USD');
      expect(result.totalBudget).toBe(15500); // 10000 + 5500
      expect(result.totalSpent).toBe(6300); // 3000 + 3300
      expect(result.totalRemaining).toBe(9200); // 15500 - 6300
      expect(result.budgets).toHaveLength(2);
      expect(result.currencyBreakdown).toHaveLength(2);
    });
  });

  describe('applySeasonalAdjustments', () => {
    it('should apply seasonal adjustments to budgets', async () => {
      const adjustments = [
        {
          category: 'ENGINE_PARTS',
          quarter: '2024-Q1',
          adjustmentPercentage: 10,
          reason: 'Winter maintenance increase'
        }
      ];

      const mockBudgets = [
        {
          id: 'budget1',
          amount: 10000,
          category: 'ENGINE_PARTS'
        }
      ];

      mockPrisma.budget.findMany.mockResolvedValue(mockBudgets);
      mockPrisma.budget.update.mockResolvedValue({
        id: 'budget1',
        amount: 11000
      });

      await BudgetService.applySeasonalAdjustments('vessel1', adjustments);

      expect(mockPrisma.budget.update).toHaveBeenCalledWith({
        where: { id: 'budget1' },
        data: { amount: 11000 } // 10000 * 1.1
      });
    });
  });

  describe('getBudgetHierarchy', () => {
    it('should return budget hierarchy', async () => {
      const mockVesselBudget = {
        id: 'vessel-budget',
        vesselId: 'vessel1',
        costCenterId: null,
        category: 'ENGINE_PARTS',
        currency: 'USD',
        amount: 10000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const mockFleetBudget = {
        id: 'fleet-budget',
        vesselId: null,
        costCenterId: 'fleet-cost-center',
        category: 'ENGINE_PARTS',
        currency: 'USD',
        amount: 50000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      mockPrisma.budget.findFirst
        .mockResolvedValueOnce(mockVesselBudget) // Vessel level
        .mockResolvedValueOnce(mockFleetBudget) // Fleet level
        .mockResolvedValueOnce(null); // Company level

      mockPrisma.requisition.aggregate.mockResolvedValue({ _sum: { totalAmount: 2000 } });
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({ _sum: { totalAmount: 1000 } });

      const result = await BudgetService.getBudgetHierarchy('vessel1', 'ENGINE_PARTS', 'USD');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        level: 'vessel',
        budgetId: 'vessel-budget',
        amount: 10000,
        spentAmount: 3000,
        remainingAmount: 7000
      });
      expect(result[1]).toEqual({
        level: 'fleet',
        budgetId: 'fleet-budget',
        amount: 50000,
        spentAmount: 3000,
        remainingAmount: 47000
      });
    });
  });
});