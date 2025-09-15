import { Request, Response } from 'express';
import { bankingIntegrationService } from '../services/bankingIntegrationService';
import { exchangeRateIntegrationService } from '../services/exchangeRateIntegrationService';
import { paymentGatewayIntegrationService } from '../services/paymentGatewayIntegrationService';
import { accountingIntegrationService } from '../services/accountingIntegrationService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class FinancialIntegrationController {
  /**
   * Process banking payment
   */
  async processBankingPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentInstruction = req.body;

      const validation = await bankingIntegrationService.validatePayment(paymentInstruction);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        });
        return;
      }

      const paymentStatus = await bankingIntegrationService.processPayment(paymentInstruction);

      res.json({
        success: true,
        data: paymentStatus
      });
    } catch (error) {
      logger.error('Error processing banking payment:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get banking payment status
   */
  async getBankingPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { instructionId } = req.params;
      const { providerId } = req.query;

      const status = await bankingIntegrationService.getPaymentStatus(
        instructionId,
        providerId as string
      );

      if (!status) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting banking payment status:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cancel banking payment
   */
  async cancelBankingPayment(req: Request, res: Response): Promise<void> {
    try {
      const { instructionId } = req.params;
      const { reason } = req.body;

      const cancelled = await bankingIntegrationService.cancelPayment(instructionId, reason);

      res.json({
        success: true,
        data: { cancelled }
      });
    } catch (error) {
      logger.error('Error cancelling banking payment:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get banking payment history
   */
  async getBankingPaymentHistory(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, currency, status } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
      }

      const history = await bankingIntegrationService.getPaymentHistory(
        new Date(startDate as string),
        new Date(endDate as string),
        currency as string,
        status as string
      );

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Error getting banking payment history:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(req: Request, res: Response): Promise<void> {
    try {
      const { providerId, accountNumber } = req.params;

      const balance = await bankingIntegrationService.getAccountBalance(providerId, accountNumber);

      res.json({
        success: true,
        data: balance
      });
    } catch (error) {
      logger.error('Error getting account balance:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get exchange rate
   */
  async getExchangeRate(req: Request, res: Response): Promise<void> {
    try {
      const { fromCurrency, toCurrency } = req.params;
      const { providerId } = req.query;

      const rate = await exchangeRateIntegrationService.getExchangeRate(
        fromCurrency,
        toCurrency,
        providerId as string
      );

      res.json({
        success: true,
        data: rate
      });
    } catch (error) {
      logger.error('Error getting exchange rate:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get multiple exchange rates
   */
  async getMultipleExchangeRates(req: Request, res: Response): Promise<void> {
    try {
      const { baseCurrency } = req.params;
      const { targetCurrencies, providerId } = req.query;

      if (!targetCurrencies) {
        throw new AppError('Target currencies are required', 400, 'MISSING_TARGET_CURRENCIES');
      }

      const currencies = (targetCurrencies as string).split(',');
      const rates = await exchangeRateIntegrationService.getMultipleRates(
        baseCurrency,
        currencies,
        providerId as string
      );

      res.json({
        success: true,
        data: rates
      });
    } catch (error) {
      logger.error('Error getting multiple exchange rates:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Convert currency
   */
  async convertCurrency(req: Request, res: Response): Promise<void> {
    try {
      const { amount, fromCurrency, toCurrency } = req.body;
      const { providerId } = req.query;

      if (!amount || !fromCurrency || !toCurrency) {
        throw new AppError('Amount, from currency, and to currency are required', 400, 'MISSING_CONVERSION_PARAMS');
      }

      const conversion = await exchangeRateIntegrationService.convertCurrency(
        amount,
        fromCurrency,
        toCurrency,
        providerId as string
      );

      res.json({
        success: true,
        data: conversion
      });
    } catch (error) {
      logger.error('Error converting currency:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get historical exchange rates
   */
  async getHistoricalExchangeRates(req: Request, res: Response): Promise<void> {
    try {
      const { fromCurrency, toCurrency } = req.params;
      const { startDate, endDate, providerId } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
      }

      const rates = await exchangeRateIntegrationService.getHistoricalRates(
        fromCurrency,
        toCurrency,
        new Date(startDate as string),
        new Date(endDate as string),
        providerId as string
      );

      res.json({
        success: true,
        data: rates
      });
    } catch (error) {
      logger.error('Error getting historical exchange rates:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get supported currencies
   */
  async getSupportedCurrencies(req: Request, res: Response): Promise<void> {
    try {
      const currencies = exchangeRateIntegrationService.getSupportedCurrencies();

      res.json({
        success: true,
        data: currencies
      });
    } catch (error) {
      logger.error('Error getting supported currencies:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get exchange rate provider status
   */
  async getExchangeRateProviderStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await exchangeRateIntegrationService.getProviderStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting provider status:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Process payment gateway payment
   */
  async processGatewayPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentRequest = req.body;
      const { gatewayId } = req.query;

      const response = await paymentGatewayIntegrationService.processPayment(
        paymentRequest,
        gatewayId as string
      );

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      logger.error('Error processing gateway payment:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get payment gateway status
   */
  async getGatewayPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { gatewayId } = req.query;

      const status = await paymentGatewayIntegrationService.getPaymentStatus(
        transactionId,
        gatewayId as string
      );

      if (!status) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting gateway payment status:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Process refund
   */
  async processRefund(req: Request, res: Response): Promise<void> {
    try {
      const refundRequest = req.body;
      const { gatewayId } = req.query;

      const response = await paymentGatewayIntegrationService.processRefund(
        refundRequest,
        gatewayId as string
      );

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      logger.error('Error processing refund:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Validate payment method
   */
  async validatePaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const paymentMethod = req.body;

      const validation = await paymentGatewayIntegrationService.validatePaymentMethod(paymentMethod);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      logger.error('Error validating payment method:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get available payment gateways
   */
  async getAvailableGateways(req: Request, res: Response): Promise<void> {
    try {
      const { amount, currency, country, paymentType } = req.query;

      if (!amount || !currency || !country) {
        throw new AppError('Amount, currency, and country are required', 400, 'MISSING_GATEWAY_PARAMS');
      }

      const gateways = paymentGatewayIntegrationService.getAvailableGateways(
        parseFloat(amount as string),
        currency as string,
        country as string,
        paymentType as string || 'ANY'
      );

      res.json({
        success: true,
        data: gateways
      });
    } catch (error) {
      logger.error('Error getting available gateways:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Sync chart of accounts
   */
  async syncChartOfAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;

      const accounts = await accountingIntegrationService.syncChartOfAccounts(systemId);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      logger.error('Error syncing chart of accounts:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Sync cost centers
   */
  async syncCostCenters(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;

      const costCenters = await accountingIntegrationService.syncCostCenters(systemId);

      res.json({
        success: true,
        data: costCenters
      });
    } catch (error) {
      logger.error('Error syncing cost centers:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Post journal entry
   */
  async postJournalEntry(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const journalEntry = req.body;

      const result = await accountingIntegrationService.postJournalEntry(systemId, journalEntry);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error posting journal entry:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get trial balance
   */
  async getTrialBalance(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const { asOfDate, costCenter } = req.query;

      if (!asOfDate) {
        throw new AppError('As of date is required', 400, 'MISSING_AS_OF_DATE');
      }

      const trialBalance = await accountingIntegrationService.getTrialBalance(
        systemId,
        new Date(asOfDate as string),
        costCenter as string
      );

      res.json({
        success: true,
        data: trialBalance
      });
    } catch (error) {
      logger.error('Error getting trial balance:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const { reportType, startDate, endDate, ...parameters } = req.query;

      if (!reportType || !startDate || !endDate) {
        throw new AppError('Report type, start date, and end date are required', 400, 'MISSING_REPORT_PARAMS');
      }

      const report = await accountingIntegrationService.generateFinancialReport(
        systemId,
        reportType as any,
        new Date(startDate as string),
        new Date(endDate as string),
        parameters
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating financial report:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Sync procurement transactions
   */
  async syncProcurementTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const transactions = req.body;

      const result = await accountingIntegrationService.syncProcurementTransactions(
        systemId,
        transactions
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error syncing procurement transactions:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get budget vs actual
   */
  async getBudgetVsActual(req: Request, res: Response): Promise<void> {
    try {
      const { systemId } = req.params;
      const { startDate, endDate, costCenterCode } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400, 'MISSING_DATES');
      }

      const budgetData = await accountingIntegrationService.getBudgetVsActual(
        systemId,
        new Date(startDate as string),
        new Date(endDate as string),
        costCenterCode as string
      );

      res.json({
        success: true,
        data: budgetData
      });
    } catch (error) {
      logger.error('Error getting budget vs actual:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const financialIntegrationController = new FinancialIntegrationController();