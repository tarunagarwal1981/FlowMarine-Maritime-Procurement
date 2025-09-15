import { Request, Response } from 'express';
import { FinancialService, VendorPaymentService, FinancialReportingService } from '../services/financialService';
import { logger } from '../utils/logger';

export class FinancialController {
  /**
   * Create purchase category
   */
  static async createPurchaseCategory(req: Request, res: Response) {
    try {
      const { code, name, description, parentId } = req.body;

      if (!code || !name) {
        return res.status(400).json({
          success: false,
          error: 'Code and name are required'
        });
      }

      const category = await FinancialService.createPurchaseCategory({
        code: code.toUpperCase(),
        name,
        description,
        parentId
      });

      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error('Error creating purchase category:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create purchase category'
      });
    }
  }

  /**
   * Get all purchase categories
   */
  static async getAllPurchaseCategories(req: Request, res: Response) {
    try {
      const { includeInactive = 'false' } = req.query;
      
      const categories = await FinancialService.getAllPurchaseCategories(
        includeInactive === 'true'
      );

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Error getting purchase categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get purchase categories'
      });
    }
  }

  /**
   * Get purchase category hierarchy
   */
  static async getCategoryHierarchy(req: Request, res: Response) {
    try {
      const hierarchy = await FinancialService.getCategoryHierarchy();

      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      logger.error('Error getting category hierarchy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get category hierarchy'
      });
    }
  }

  /**
   * Get purchase category by code
   */
  static async getPurchaseCategoryByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;

      const category = await FinancialService.getPurchaseCategoryByCode(code.toUpperCase());

      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Purchase category not found'
        });
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error('Error getting purchase category by code:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get purchase category'
      });
    }
  }

  /**
   * Update purchase category
   */
  static async updatePurchaseCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        budgetLimit,
        budgetCurrency,
        approvalRequired,
        isActive
      } = req.body;

      const category = await FinancialService.updatePurchaseCategory(id, {
        name,
        description,
        budgetLimit: budgetLimit ? parseFloat(budgetLimit) : undefined,
        budgetCurrency: budgetCurrency?.toUpperCase(),
        approvalRequired,
        isActive
      });

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error('Error updating purchase category:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update purchase category'
      });
    }
  }

  /**
   * Get category spending analysis
   */
  static async getCategorySpendingAnalysis(req: Request, res: Response) {
    try {
      const { vesselId, startDate, endDate, currency = 'USD' } = req.query;

      const analysis = await FinancialService.getCategorySpendingAnalysis(
        vesselId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        (currency as string).toUpperCase()
      );

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Error getting category spending analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get category spending analysis'
      });
    }
  }

  /**
   * Generate category report
   */
  static async generateCategoryReport(req: Request, res: Response) {
    try {
      const { period, vesselId, currency = 'USD' } = req.query;

      if (!period) {
        return res.status(400).json({
          success: false,
          error: 'Period is required'
        });
      }

      const report = await FinancialService.generateCategoryReport(
        period as string,
        vesselId as string,
        (currency as string).toUpperCase()
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating category report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate category report'
      });
    }
  }

  // ============================================================================
  // VENDOR PAYMENT MANAGEMENT
  // ============================================================================

  /**
   * Update vendor payment terms
   */
  static async updateVendorPaymentTerms(req: Request, res: Response) {
    try {
      const { vendorId } = req.params;
      const { paymentTerms, creditLimit, creditLimitCurrency } = req.body;

      const vendor = await VendorPaymentService.updateVendorPaymentTerms(vendorId, {
        paymentTerms,
        creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
        creditLimitCurrency: creditLimitCurrency?.toUpperCase()
      });

      res.json({
        success: true,
        data: vendor
      });
    } catch (error) {
      logger.error('Error updating vendor payment terms:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update vendor payment terms'
      });
    }
  }

  /**
   * Get vendor payment terms
   */
  static async getVendorPaymentTerms(req: Request, res: Response) {
    try {
      const { vendorId } = req.params;

      const paymentTerms = await VendorPaymentService.getVendorPaymentTerms(vendorId);

      res.json({
        success: true,
        data: paymentTerms
      });
    } catch (error) {
      logger.error('Error getting vendor payment terms:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get vendor payment terms'
      });
    }
  }

  /**
   * Generate vendor credit report
   */
  static async generateVendorCreditReport(req: Request, res: Response) {
    try {
      const { vendorId } = req.params;

      const report = await VendorPaymentService.generateVendorCreditReport(vendorId);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating vendor credit report:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate vendor credit report'
      });
    }
  }

  /**
   * Check credit availability
   */
  static async checkCreditAvailability(req: Request, res: Response) {
    try {
      const { vendorId, amount, currency } = req.body;

      if (!vendorId || !amount || !currency) {
        return res.status(400).json({
          success: false,
          error: 'vendorId, amount, and currency are required'
        });
      }

      const availability = await VendorPaymentService.checkCreditAvailability(
        vendorId,
        parseFloat(amount),
        currency.toUpperCase()
      );

      res.json({
        success: true,
        data: availability
      });
    } catch (error) {
      logger.error('Error checking credit availability:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check credit availability'
      });
    }
  }

  /**
   * Get vendors with credit issues
   */
  static async getVendorsWithCreditIssues(req: Request, res: Response) {
    try {
      const issues = await VendorPaymentService.getVendorsWithCreditIssues();

      res.json({
        success: true,
        data: issues
      });
    } catch (error) {
      logger.error('Error getting vendors with credit issues:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get vendors with credit issues'
      });
    }
  }

  /**
   * Get payment analytics
   */
  static async getPaymentAnalytics(req: Request, res: Response) {
    try {
      const { startDate, endDate, currency = 'USD' } = req.query;

      const analytics = await VendorPaymentService.getPaymentAnalytics(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        (currency as string).toUpperCase()
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting payment analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payment analytics'
      });
    }
  }

  // ============================================================================
  // FINANCIAL REPORTING
  // ============================================================================

  /**
   * Generate financial report
   */
  static async generateFinancialReport(req: Request, res: Response) {
    try {
      const { reportType, period, vesselId, baseCurrency = 'USD' } = req.body;

      if (!reportType || !period) {
        return res.status(400).json({
          success: false,
          error: 'reportType and period are required'
        });
      }

      const validReportTypes = ['SPENDING', 'BUDGET', 'VARIANCE', 'CASH_FLOW'];
      if (!validReportTypes.includes(reportType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`
        });
      }

      const report = await FinancialReportingService.generateFinancialReport(
        reportType,
        period,
        vesselId,
        baseCurrency.toUpperCase()
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating financial report:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate financial report'
      });
    }
  }

  /**
   * Apply seasonal budget adjustments
   */
  static async applySeasonalBudgetAdjustments(req: Request, res: Response) {
    try {
      const { adjustments } = req.body;

      if (!adjustments || !Array.isArray(adjustments)) {
        return res.status(400).json({
          success: false,
          error: 'adjustments array is required'
        });
      }

      const results = await FinancialReportingService.applySeasonalBudgetAdjustments(adjustments);

      res.json({
        success: true,
        data: results,
        message: `Applied ${results.length} seasonal budget adjustments`
      });
    } catch (error) {
      logger.error('Error applying seasonal budget adjustments:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply seasonal budget adjustments'
      });
    }
  }

  /**
   * Get financial dashboard
   */
  static async getFinancialDashboard(req: Request, res: Response) {
    try {
      const { vesselId, baseCurrency = 'USD' } = req.query;

      const dashboard = await FinancialReportingService.generateFinancialDashboard(
        vesselId as string,
        (baseCurrency as string).toUpperCase()
      );

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error('Error getting financial dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get financial dashboard'
      });
    }
  }
}