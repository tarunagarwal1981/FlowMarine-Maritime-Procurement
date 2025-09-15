import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CurrencyService } from '../services/currencyService';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock Prisma
const mockPrisma = {
  exchangeRate: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn()
  }
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma)
}));

describe('CurrencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getExchangeRate', () => {
    it('should return rate 1 for same currency', async () => {
      const result = await CurrencyService.getExchangeRate('USD', 'USD');
      
      expect(result).toEqual({
        fromCurrency: 'USD',
        toCurrency: 'USD',
        rate: 1,
        date: expect.any(Date),
        source: 'internal'
      });
    });

    it('should return cached rate if available and cache enabled', async () => {
      const cachedRate = {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.85,
        date: new Date(),
        source: 'cached',
        createdAt: new Date()
      };

      mockPrisma.exchangeRate.findFirst.mockResolvedValue(cachedRate);

      const result = await CurrencyService.getExchangeRate('USD', 'EUR', true);

      expect(result).toEqual({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.85,
        date: cachedRate.date,
        source: 'cached'
      });
    });

    it('should fetch from API if no cached rate', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
      mockPrisma.exchangeRate.create.mockResolvedValue({});

      mockedAxios.get.mockResolvedValue({
        data: {
          rates: {
            EUR: 0.85
          }
        }
      });

      const result = await CurrencyService.getExchangeRate('USD', 'EUR');

      expect(result).toEqual({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.85,
        date: expect.any(Date),
        source: 'exchangerate-api'
      });
    });

    it('should throw error for unsupported currency', async () => {
      await expect(
        CurrencyService.getExchangeRate('USD', 'INVALID')
      ).rejects.toThrow('Unsupported currency pair: USD/INVALID');
    });
  });

  describe('convertCurrency', () => {
    it('should convert currency correctly', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
      mockPrisma.exchangeRate.create.mockResolvedValue({});

      mockedAxios.get.mockResolvedValue({
        data: {
          rates: {
            EUR: 0.85
          }
        }
      });

      const result = await CurrencyService.convertCurrency(100, 'USD', 'EUR');

      expect(result).toEqual({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        convertedAmount: 85,
        exchangeRate: 0.85,
        conversionDate: expect.any(Date)
      });
    });

    it('should round converted amount to 2 decimal places', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
      mockPrisma.exchangeRate.create.mockResolvedValue({});

      mockedAxios.get.mockResolvedValue({
        data: {
          rates: {
            EUR: 0.8567
          }
        }
      });

      const result = await CurrencyService.convertCurrency(100, 'USD', 'EUR');

      expect(result.convertedAmount).toBe(85.67);
    });
  });

  describe('getHistoricalExchangeRate', () => {
    it('should return historical rate if found', async () => {
      const historicalRate = {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.82,
        date: new Date('2024-01-01'),
        source: 'historical'
      };

      mockPrisma.exchangeRate.findFirst.mockResolvedValue(historicalRate);

      const result = await CurrencyService.getHistoricalExchangeRate(
        'USD',
        'EUR',
        new Date('2024-01-01')
      );

      expect(result).toEqual(historicalRate);
    });

    it('should return null if no historical rate found', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);

      const result = await CurrencyService.getHistoricalExchangeRate(
        'USD',
        'EUR',
        new Date('2024-01-01')
      );

      expect(result).toBeNull();
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return array of supported currencies', () => {
      const currencies = CurrencyService.getSupportedCurrencies();
      
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
    });
  });

  describe('isValidCurrency', () => {
    it('should return true for valid currencies', () => {
      expect(CurrencyService.isValidCurrency('USD')).toBe(true);
      expect(CurrencyService.isValidCurrency('eur')).toBe(true);
      expect(CurrencyService.isValidCurrency('GBP')).toBe(true);
    });

    it('should return false for invalid currencies', () => {
      expect(CurrencyService.isValidCurrency('INVALID')).toBe(false);
      expect(CurrencyService.isValidCurrency('XYZ')).toBe(false);
    });
  });

  describe('convertMultipleCurrencies', () => {
    it('should convert multiple amounts to base currency', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);
      mockPrisma.exchangeRate.create.mockResolvedValue({});

      // Mock different API responses for different currencies
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { rates: { USD: 1.18 } } // EUR to USD
        })
        .mockResolvedValueOnce({
          data: { rates: { USD: 1.25 } } // GBP to USD
        });

      const amounts = [
        { amount: 100, currency: 'EUR' },
        { amount: 50, currency: 'GBP' }
      ];

      const result = await CurrencyService.convertMultipleCurrencies(amounts, 'USD');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        amount: 100,
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        convertedAmount: 118,
        exchangeRate: 1.18,
        conversionDate: expect.any(Date)
      });
      expect(result[1]).toEqual({
        amount: 50,
        fromCurrency: 'GBP',
        toCurrency: 'USD',
        convertedAmount: 62.5,
        exchangeRate: 1.25,
        conversionDate: expect.any(Date)
      });
    });
  });

  describe('getExchangeRateTrends', () => {
    it('should return exchange rate trends', async () => {
      const mockTrends = [
        { date: new Date('2024-01-01'), rate: 0.85 },
        { date: new Date('2024-01-02'), rate: 0.86 },
        { date: new Date('2024-01-03'), rate: 0.84 }
      ];

      mockPrisma.exchangeRate.findMany.mockResolvedValue(mockTrends);

      const result = await CurrencyService.getExchangeRateTrends('USD', 'EUR', 30);

      expect(result).toEqual(mockTrends);
      expect(mockPrisma.exchangeRate.findMany).toHaveBeenCalledWith({
        where: {
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          date: {
            gte: expect.any(Date)
          }
        },
        orderBy: {
          date: 'asc'
        },
        select: {
          date: true,
          rate: true
        }
      });
    });
  });
});