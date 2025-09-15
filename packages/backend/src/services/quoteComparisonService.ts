import { PrismaClient, Quote, QuoteStatus, Vendor } from '@prisma/client';
import { AppError } from '../utils/errors';
import { auditService } from './auditService';

const prisma = new PrismaClient();

export interface QuoteComparisonData {
  rfqId: string;
  quotes: Quote[];
  scoringWeights?: {
    price: number;
    delivery: number;
    quality: number;
    location: number;
  };
}

export interface VendorScoringResult {
  vendorId: string;
  vendorName: string;
  quoteId: string;
  scores: {
    priceScore: number;
    deliveryScore: number;
    qualityScore: number;
    locationScore: number;
    totalScore: number;
  };
  ranking: number;
  recommendation: 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'ACCEPTABLE' | 'NOT_RECOMMENDED';
  totalAmount: number;
  currency: string;
  deliveryDate?: Date;
  notes?: string;
}

export interface QuoteApprovalData {
  quoteId: string;
  approvedBy: string;
  justification: string;
  alternativeQuotes?: {
    quoteId: string;
    reason: string;
  }[];
}

export interface QuoteComparisonReport {
  rfqId: string;
  rfqTitle: string;
  totalQuotes: number;
  scoredQuotes: VendorScoringResult[];
  recommendedQuote: VendorScoringResult;
  comparisonMatrix: any[];
  scoringCriteria: {
    priceWeight: number;
    deliveryWeight: number;
    qualityWeight: number;
    locationWeight: number;
  };
  generatedAt: Date;
}

class QuoteComparisonService {
  private readonly DEFAULT_SCORING_WEIGHTS = {
    price: 0.4,      // 40%
    delivery: 0.3,   // 30%
    quality: 0.2,    // 20%
    location: 0.1    // 10%
  };

  /**
   * Score and compare quotes for an RFQ
   */
  async scoreAndCompareQuotes(rfqId: string, customWeights?: any): Promise<QuoteComparisonReport> {
    try {
      // Get RFQ with quotes and related data
      const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        include: {
          requisition: {
            include: {
              vessel: true,
              items: {
                include: {
                  itemCatalog: true
                }
              }
            }
          },
          quotes: {
            where: { status: 'SUBMITTED' },
            include: {
              vendor: {
                include: {
                  serviceAreas: true,
                  portCapabilities: true
                }
              },
              lineItems: {
                include: {
                  itemCatalog: true
                }
              }
            }
          }
        }
      });

      if (!rfq) {
        throw new AppError('RFQ not found', 404, 'RFQ_NOT_FOUND');
      }

      if (rfq.quotes.length === 0) {
        throw new AppError('No submitted quotes found for this RFQ', 400, 'NO_QUOTES_FOUND');
      }

      const scoringWeights = { ...this.DEFAULT_SCORING_WEIGHTS, ...customWeights };

      // Score each quote
      const scoredQuotes = await Promise.all(
        rfq.quotes.map(quote => this.scoreQuote(quote, rfq, scoringWeights))
      );

      // Sort by total score descending
      scoredQuotes.sort((a, b) => b.scores.totalScore - a.scores.totalScore);

      // Assign rankings
      scoredQuotes.forEach((quote, index) => {
        quote.ranking = index + 1;
      });

      // Update quote scores in database
      await this.updateQuoteScores(scoredQuotes);

      // Generate comparison matrix
      const comparisonMatrix = this.generateComparisonMatrix(scoredQuotes, rfq);

      const report: QuoteComparisonReport = {
        rfqId,
        rfqTitle: rfq.title,
        totalQuotes: scoredQuotes.length,
        scoredQuotes,
        recommendedQuote: scoredQuotes[0],
        comparisonMatrix,
        scoringCriteria: {
          priceWeight: scoringWeights.price,
          deliveryWeight: scoringWeights.delivery,
          qualityWeight: scoringWeights.quality,
          locationWeight: scoringWeights.location
        },
        generatedAt: new Date()
      };

      return report;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to score and compare quotes', 500, 'QUOTE_COMPARISON_FAILED');
    }
  }

  /**
   * Score an individual quote
   */
  private async scoreQuote(quote: any, rfq: any, weights: any): Promise<VendorScoringResult> {
    const priceScore = this.calculatePriceScore(quote, rfq.quotes);
    const deliveryScore = this.calculateDeliveryScore(quote, rfq);
    const qualityScore = this.calculateQualityScore(quote.vendor);
    const locationScore = this.calculateLocationScore(quote.vendor, rfq);

    const totalScore = (
      (priceScore * weights.price) +
      (deliveryScore * weights.delivery) +
      (qualityScore * weights.quality) +
      (locationScore * weights.location)
    );

    const recommendation = this.getRecommendation(totalScore);

    return {
      vendorId: quote.vendorId,
      vendorName: quote.vendor.name,
      quoteId: quote.id,
      scores: {
        priceScore: Math.round(priceScore * 100) / 100,
        deliveryScore: Math.round(deliveryScore * 100) / 100,
        qualityScore: Math.round(qualityScore * 100) / 100,
        locationScore: Math.round(locationScore * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100
      },
      ranking: 0, // Will be set later
      recommendation,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
      deliveryDate: quote.deliveryDate,
      notes: quote.notes
    };
  }

  /**
   * Calculate price score (lower price = higher score)
   */
  private calculatePriceScore(quote: any, allQuotes: any[]): number {
    const prices = allQuotes.map(q => q.totalAmount);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) return 10; // All quotes have same price

    // Normalize price score (10 for lowest price, scaling down for higher prices)
    const normalizedScore = 10 - ((quote.totalAmount - minPrice) / (maxPrice - minPrice)) * 10;
    return Math.max(0, normalizedScore);
  }

  /**
   * Calculate delivery score (earlier delivery = higher score)
   */
  private calculateDeliveryScore(quote: any, rfq: any): number {
    if (!quote.deliveryDate || !rfq.deliveryDate) {
      return 5; // Neutral score if delivery dates not specified
    }

    const requestedDelivery = new Date(rfq.deliveryDate);
    const quotedDelivery = new Date(quote.deliveryDate);
    const daysDifference = Math.ceil((quotedDelivery.getTime() - requestedDelivery.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDifference <= 0) {
      return 10; // Can deliver on or before requested date
    } else if (daysDifference <= 7) {
      return 8; // Within a week of requested date
    } else if (daysDifference <= 14) {
      return 6; // Within two weeks
    } else if (daysDifference <= 30) {
      return 4; // Within a month
    } else {
      return 2; // More than a month late
    }
  }

  /**
   * Calculate quality score based on vendor ratings
   */
  private calculateQualityScore(vendor: any): number {
    return vendor.qualityRating || 5; // Use vendor's quality rating or default to 5
  }

  /**
   * Calculate location score based on vendor proximity and capabilities
   */
  private calculateLocationScore(vendor: any, rfq: any): number {
    let score = 0;
    const deliveryLocation = rfq.deliveryLocation || rfq.requisition.deliveryLocation;

    if (!deliveryLocation) return 5; // Neutral score if no delivery location specified

    // Extract country from delivery location (simplified)
    const locationParts = deliveryLocation.split(',');
    const country = locationParts[locationParts.length - 1]?.trim();

    // Check if vendor serves the delivery country
    const servesCountry = vendor.serviceAreas?.some((area: any) => 
      area.country.toLowerCase() === country?.toLowerCase()
    );

    if (servesCountry) {
      score += 5;

      // Check for port capabilities in the delivery area
      const hasPortCapabilities = vendor.portCapabilities?.some((capability: any) => 
        capability.capabilities.includes('delivery')
      );

      if (hasPortCapabilities) {
        score += 3;
      }

      // Check for local presence (simplified - would use actual distance calculation)
      const hasLocalPresence = vendor.serviceAreas?.some((area: any) => 
        area.country.toLowerCase() === country?.toLowerCase() && area.region
      );

      if (hasLocalPresence) {
        score += 2;
      }
    } else {
      score = 3; // Lower score for vendors not serving the delivery country
    }

    return Math.min(score, 10);
  }

  /**
   * Get recommendation based on total score
   */
  private getRecommendation(totalScore: number): 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'ACCEPTABLE' | 'NOT_RECOMMENDED' {
    if (totalScore >= 8.5) return 'HIGHLY_RECOMMENDED';
    if (totalScore >= 7.0) return 'RECOMMENDED';
    if (totalScore >= 5.5) return 'ACCEPTABLE';
    return 'NOT_RECOMMENDED';
  }

  /**
   * Update quote scores in database
   */
  private async updateQuoteScores(scoredQuotes: VendorScoringResult[]): Promise<void> {
    const updatePromises = scoredQuotes.map(quote => 
      prisma.quote.update({
        where: { id: quote.quoteId },
        data: {
          priceScore: quote.scores.priceScore,
          deliveryScore: quote.scores.deliveryScore,
          qualityScore: quote.scores.qualityScore,
          locationScore: quote.scores.locationScore,
          totalScore: quote.scores.totalScore
        }
      })
    );

    await Promise.all(updatePromises);
  }

  /**
   * Generate comparison matrix for side-by-side analysis
   */
  private generateComparisonMatrix(scoredQuotes: VendorScoringResult[], rfq: any): any[] {
    const matrix = [];

    // Header row
    const headerRow = {
      criteria: 'Criteria',
      ...scoredQuotes.reduce((acc, quote, index) => {
        acc[`vendor_${index}`] = quote.vendorName;
        return acc;
      }, {} as any)
    };
    matrix.push(headerRow);

    // Total Amount row
    const amountRow = {
      criteria: 'Total Amount',
      ...scoredQuotes.reduce((acc, quote, index) => {
        acc[`vendor_${index}`] = `${quote.currency} ${quote.totalAmount.toLocaleString()}`;
        return acc;
      }, {} as any)
    };
    matrix.push(amountRow);

    // Delivery Date row
    const deliveryRow = {
      criteria: 'Delivery Date',
      ...scoredQuotes.reduce((acc, quote, index) => {
        acc[`vendor_${index}`] = quote.deliveryDate ? quote.deliveryDate.toDateString() : 'Not specified';
        return acc;
      }, {} as any)
    };
    matrix.push(deliveryRow);

    // Score rows
    const scoreRows = [
      { key: 'priceScore', label: 'Price Score' },
      { key: 'deliveryScore', label: 'Delivery Score' },
      { key: 'qualityScore', label: 'Quality Score' },
      { key: 'locationScore', label: 'Location Score' },
      { key: 'totalScore', label: 'Total Score' }
    ];

    scoreRows.forEach(scoreRow => {
      const row = {
        criteria: scoreRow.label,
        ...scoredQuotes.reduce((acc, quote, index) => {
          acc[`vendor_${index}`] = quote.scores[scoreRow.key as keyof typeof quote.scores];
          return acc;
        }, {} as any)
      };
      matrix.push(row);
    });

    // Recommendation row
    const recommendationRow = {
      criteria: 'Recommendation',
      ...scoredQuotes.reduce((acc, quote, index) => {
        acc[`vendor_${index}`] = quote.recommendation;
        return acc;
      }, {} as any)
    };
    matrix.push(recommendationRow);

    return matrix;
  }

  /**
   * Approve a quote with justification
   */
  async approveQuote(data: QuoteApprovalData, userId: string): Promise<Quote> {
    try {
      const quote = await prisma.quote.findUnique({
        where: { id: data.quoteId },
        include: {
          rfq: {
            include: {
              requisition: true
            }
          },
          vendor: true
        }
      });

      if (!quote) {
        throw new AppError('Quote not found', 404, 'QUOTE_NOT_FOUND');
      }

      if (quote.status !== 'SUBMITTED') {
        throw new AppError('Only submitted quotes can be approved', 400, 'INVALID_QUOTE_STATUS');
      }

      // Update quote status and create approval record
      const approvedQuote = await prisma.$transaction(async (tx) => {
        // Update the approved quote
        const updatedQuote = await tx.quote.update({
          where: { id: data.quoteId },
          data: { status: 'ACCEPTED' }
        });

        // Reject other quotes for the same RFQ
        await tx.quote.updateMany({
          where: {
            rfqId: quote.rfqId,
            id: { not: data.quoteId },
            status: 'SUBMITTED'
          },
          data: { status: 'REJECTED' }
        });

        // Update RFQ status
        await tx.rFQ.update({
          where: { id: quote.rfqId },
          data: { status: 'AWARDED' }
        });

        return updatedQuote;
      });

      // Create audit log with justification
      await auditService.log({
        userId,
        action: 'APPROVE',
        resource: 'quote',
        resourceId: data.quoteId,
        newValues: {
          status: 'ACCEPTED',
          approvedBy: data.approvedBy,
          justification: data.justification,
          alternativeQuotes: data.alternativeQuotes
        },
        metadata: {
          rfqId: quote.rfqId,
          vendorId: quote.vendorId,
          totalAmount: quote.totalAmount
        }
      });

      return approvedQuote;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to approve quote', 500, 'QUOTE_APPROVAL_FAILED');
    }
  }

  /**
   * Get quote comparison report by RFQ ID
   */
  async getQuoteComparisonReport(rfqId: string): Promise<QuoteComparisonReport | null> {
    try {
      // Check if we have scored quotes for this RFQ
      const quotes = await prisma.quote.findMany({
        where: {
          rfqId,
          status: 'SUBMITTED',
          totalScore: { not: null }
        },
        include: {
          vendor: true
        },
        orderBy: { totalScore: 'desc' }
      });

      if (quotes.length === 0) {
        return null; // No scored quotes available
      }

      const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        include: {
          requisition: {
            include: {
              vessel: true
            }
          }
        }
      });

      if (!rfq) {
        throw new AppError('RFQ not found', 404, 'RFQ_NOT_FOUND');
      }

      // Convert quotes to scoring results
      const scoredQuotes: VendorScoringResult[] = quotes.map((quote, index) => ({
        vendorId: quote.vendorId,
        vendorName: quote.vendor.name,
        quoteId: quote.id,
        scores: {
          priceScore: quote.priceScore || 0,
          deliveryScore: quote.deliveryScore || 0,
          qualityScore: quote.qualityScore || 0,
          locationScore: quote.locationScore || 0,
          totalScore: quote.totalScore || 0
        },
        ranking: index + 1,
        recommendation: this.getRecommendation(quote.totalScore || 0),
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        deliveryDate: quote.deliveryDate,
        notes: quote.notes
      }));

      const comparisonMatrix = this.generateComparisonMatrix(scoredQuotes, rfq);

      return {
        rfqId,
        rfqTitle: rfq.title,
        totalQuotes: scoredQuotes.length,
        scoredQuotes,
        recommendedQuote: scoredQuotes[0],
        comparisonMatrix,
        scoringCriteria: this.DEFAULT_SCORING_WEIGHTS,
        generatedAt: new Date()
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get quote comparison report', 500, 'QUOTE_COMPARISON_REPORT_FAILED');
    }
  }

  /**
   * Get vendor recommendation based on scoring
   */
  async getVendorRecommendation(rfqId: string): Promise<{
    recommendedVendor: VendorScoringResult;
    alternatives: VendorScoringResult[];
    reasoning: string[];
  }> {
    try {
      const report = await this.getQuoteComparisonReport(rfqId);

      if (!report) {
        throw new AppError('No quote comparison data available', 404, 'NO_COMPARISON_DATA');
      }

      const recommended = report.recommendedQuote;
      const alternatives = report.scoredQuotes.slice(1, 4); // Top 3 alternatives

      // Generate reasoning
      const reasoning = [];
      
      if (recommended.scores.priceScore >= 8) {
        reasoning.push('Highly competitive pricing');
      }
      
      if (recommended.scores.deliveryScore >= 8) {
        reasoning.push('Excellent delivery timeline');
      }
      
      if (recommended.scores.qualityScore >= 8) {
        reasoning.push('High quality rating from past performance');
      }
      
      if (recommended.scores.locationScore >= 8) {
        reasoning.push('Strong local presence and capabilities');
      }

      if (recommended.scores.totalScore >= 8.5) {
        reasoning.push('Overall exceptional performance across all criteria');
      }

      return {
        recommendedVendor: recommended,
        alternatives,
        reasoning
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get vendor recommendation', 500, 'VENDOR_RECOMMENDATION_FAILED');
    }
  }
}

export const quoteComparisonService = new QuoteComparisonService();