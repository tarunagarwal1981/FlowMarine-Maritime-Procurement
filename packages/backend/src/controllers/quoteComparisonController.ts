import { Request, Response, NextFunction } from 'express';
import { quoteComparisonService } from '../services/quoteComparisonService';
import { AppError } from '../utils/errors';

export class QuoteComparisonController {
  /**
   * Score and compare quotes for an RFQ
   */
  async scoreQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rfqId } = req.params;
      const { scoringWeights } = req.body;

      if (!rfqId) {
        throw new AppError('RFQ ID is required', 400, 'MISSING_RFQ_ID');
      }

      const report = await quoteComparisonService.scoreAndCompareQuotes(rfqId, scoringWeights);

      res.status(200).json({
        success: true,
        data: report,
        message: 'Quotes scored and compared successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get quote comparison report
   */
  async getComparisonReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rfqId } = req.params;

      if (!rfqId) {
        throw new AppError('RFQ ID is required', 400, 'MISSING_RFQ_ID');
      }

      const report = await quoteComparisonService.getQuoteComparisonReport(rfqId);

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'No quote comparison data available for this RFQ'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: report,
        message: 'Quote comparison report retrieved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendor recommendation
   */
  async getVendorRecommendation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rfqId } = req.params;

      if (!rfqId) {
        throw new AppError('RFQ ID is required', 400, 'MISSING_RFQ_ID');
      }

      const recommendation = await quoteComparisonService.getVendorRecommendation(rfqId);

      res.status(200).json({
        success: true,
        data: recommendation,
        message: 'Vendor recommendation retrieved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve a quote with justification
   */
  async approveQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quoteId } = req.params;
      const { justification, alternativeQuotes } = req.body;
      const userId = req.user?.id;

      if (!quoteId) {
        throw new AppError('Quote ID is required', 400, 'MISSING_QUOTE_ID');
      }

      if (!justification) {
        throw new AppError('Justification is required for quote approval', 400, 'MISSING_JUSTIFICATION');
      }

      if (!userId) {
        throw new AppError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
      }

      const approvalData = {
        quoteId,
        approvedBy: userId,
        justification,
        alternativeQuotes
      };

      const approvedQuote = await quoteComparisonService.approveQuote(approvalData, userId);

      res.status(200).json({
        success: true,
        data: approvedQuote,
        message: 'Quote approved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get side-by-side quote comparison
   */
  async getSideBySideComparison(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rfqId } = req.params;
      const { quoteIds } = req.query;

      if (!rfqId) {
        throw new AppError('RFQ ID is required', 400, 'MISSING_RFQ_ID');
      }

      const report = await quoteComparisonService.getQuoteComparisonReport(rfqId);

      if (!report) {
        res.status(404).json({
          success: false,
          message: 'No quote comparison data available for this RFQ'
        });
        return;
      }

      // Filter quotes if specific quote IDs are requested
      let filteredQuotes = report.scoredQuotes;
      if (quoteIds && typeof quoteIds === 'string') {
        const requestedQuoteIds = quoteIds.split(',');
        filteredQuotes = report.scoredQuotes.filter(quote => 
          requestedQuoteIds.includes(quote.quoteId)
        );
      }

      // Generate comparison matrix for filtered quotes
      const comparisonData = {
        rfqId: report.rfqId,
        rfqTitle: report.rfqTitle,
        quotes: filteredQuotes,
        comparisonMatrix: report.comparisonMatrix,
        scoringCriteria: report.scoringCriteria
      };

      res.status(200).json({
        success: true,
        data: comparisonData,
        message: 'Side-by-side comparison retrieved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update scoring weights and re-score quotes
   */
  async updateScoringWeights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rfqId } = req.params;
      const { weights } = req.body;

      if (!rfqId) {
        throw new AppError('RFQ ID is required', 400, 'MISSING_RFQ_ID');
      }

      if (!weights) {
        throw new AppError('Scoring weights are required', 400, 'MISSING_WEIGHTS');
      }

      // Validate weights sum to 1.0
      const totalWeight = (weights.price || 0) + (weights.delivery || 0) + 
                         (weights.quality || 0) + (weights.location || 0);

      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new AppError('Scoring weights must sum to 1.0', 400, 'INVALID_WEIGHTS');
      }

      const report = await quoteComparisonService.scoreAndCompareQuotes(rfqId, weights);

      res.status(200).json({
        success: true,
        data: report,
        message: 'Scoring weights updated and quotes re-scored successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get quote scoring details
   */
  async getQuoteScoringDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quoteId } = req.params;

      if (!quoteId) {
        throw new AppError('Quote ID is required', 400, 'MISSING_QUOTE_ID');
      }

      // Get quote with scoring details
      const quote = await quoteComparisonService.getQuoteComparisonReport(req.body.rfqId);

      if (!quote) {
        res.status(404).json({
          success: false,
          message: 'Quote not found or not scored'
        });
        return;
      }

      const quoteDetails = quote.scoredQuotes.find(q => q.quoteId === quoteId);

      if (!quoteDetails) {
        res.status(404).json({
          success: false,
          message: 'Quote scoring details not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          quote: quoteDetails,
          scoringCriteria: quote.scoringCriteria,
          ranking: `${quoteDetails.ranking} of ${quote.totalQuotes}`
        },
        message: 'Quote scoring details retrieved successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const quoteComparisonController = new QuoteComparisonController();