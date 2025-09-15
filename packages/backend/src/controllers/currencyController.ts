import { Request, Response } from 'express';
import { CurrencyService } from '../services/currencyService';
import { CostCenterService } from '../services/costCenterService';
import { BudgetService } from '../services/budgetService';
import { logger } from '../utils/logger';

export class CurrencyController {
  /**
   * Get supported currencies
   */
  static async getSupportedCurrencies(req: Request, res: Response) {
    try {
      const currencies = CurrencyService.getSupportedCurrencies();
      
      res.json({
        success: true,
        data: currencies
      });
    } catch (error) {
      logger.error('Error getting supported currencies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get supported currencies'
      });
    }
  }

  /**
   * Get current exchange rate
   */
  static async getExchangeRate(req: Request, res: Response) {
    try {
      const { fromCurrency, toCurrency } = req.params;
      const { useCache = 'true' } = req.query;

      const exchangeRate = await CurrencyService.getExchangeRate(
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase(),
        useCache === 'true'
      );

      res.json({
        success: true,
        data: exchangeRate
      });
    } catch (error) {
      logger.error('Error getting exchange rate:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get exchange rate'
      });
    }
  }

  /**
   * Convert currency
   */
  static async convertCurrency(req: Request, res: Response) {
    try {
      const { amount, fromCurrency, toCurrency } = req.body;

      if (!amount || !fromCurrency || !toCurrency) {
        return res.status(400).json({
          success: false,
          error: 'Amount, fromCurrency, and toCurrency are required'
        });
      }

      const conversion = await CurrencyService.convertCurrency(
        parseFloat(amount),
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase()
      );

      res.json({
        success: true,
        data: conversion
      });
    } catch (error) {
      logger.error('Error converting currency:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert currency'
      });
    }
  }  /
**
   * Get historical exchange rate
   */
  static async getHistoricalExchangeRate(req: Request, res: Response) {
    try {
      const { fromCurrency, toCurrency } = req.params;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Date parameter is required'
        });
      }

      const historicalRate = await CurrencyService.getHistoricalExchangeRate(
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase(),
        new Date(date as string)
      );

      if (!historicalRate) {
        return res.status(404).json({
          success: false,
          error: 'Historical exchange rate not found for the specified date'
        });
      }

      res.json({
        success: true,
        data: historicalRate
      });
    } catch (error) {
      logger.error('Error getting historical exchange rate:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get historical exchange rate'
      });
    }
  }

  /**
   * Get exchange rate trends
   */
  static async getExchangeRateTrends(req: Request, res: Response) {
    try {
      const { fromCurrency, toCurrency } = req.params;
      const { days = '30' } = req.query;

      const trends = await CurrencyService.getExchangeRateTrends(
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase(),
        parseInt(days as string)
      );

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      logger.error('Error getting exchange rate trends:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get exchange rate trends'
      });
    }
  }

  /**
   * Convert multiple currencies
   */
  static async convertMultipleCurrencies(req: Request, res: Response) {
    try {
      const { amounts, baseCurrency } = req.body;

      if (!amounts || !Array.isArray(amounts) || !baseCurrency) {
        return res.status(400).json({
          success: false,
          error: 'amounts (array) and baseCurrency are required'
        });
      }

      const conversions = await CurrencyService.convertMultipleCurrencies(
        amounts,
        baseCurrency.toUpperCase()
      );

      res.json({
        success: true,
        data: conversions
      });
    } catch (error) {
      logger.error('Error converting multiple currencies:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert multiple currencies'
      });
    }
  }
}