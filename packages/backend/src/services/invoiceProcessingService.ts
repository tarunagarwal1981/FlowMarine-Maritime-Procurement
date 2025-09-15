import { PrismaClient, Invoice, InvoiceStatus, PurchaseOrder } from '@prisma/client';
import { ocrService, OCRResult } from './ocrService';
import { auditService } from './auditService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface ThreeWayMatchResult {
  isMatched: boolean;
  priceVariance: number;
  quantityVariance: number;
  issues: string[];
  tolerance: {
    priceTolerancePercent: number;
    quantityTolerancePercent: number;
  };
}

export interface InvoiceValidationResult {
  isValid: boolean;
  ocrResult?: OCRResult;
  threeWayMatch?: ThreeWayMatchResult;
  errors: string[];
  warnings: string[];
}

export class InvoiceProcessingService {
  private readonly PRICE_TOLERANCE_PERCENT = 2; // ±2% as per requirements
  private readonly QUANTITY_TOLERANCE_PERCENT = 0; // Exact quantity matching required

  async processInvoice(
    invoiceId: string,
    imageBuffer?: Buffer,
    userId?: string
  ): Promise<InvoiceValidationResult> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          purchaseOrder: {
            include: {
              lineItems: true,
              deliveries: true
            }
          }
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const result: InvoiceValidationResult = {
        isValid: false,
        errors: [],
        warnings: []
      };

      // Step 1: OCR Processing if image provided
      if (imageBuffer) {
        try {
          result.ocrResult = await ocrService.processInvoiceImage(imageBuffer);
          
          // Update invoice with OCR data
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              ocrData: result.ocrResult as any
            }
          });

          logger.info(`OCR processing completed for invoice ${invoice.invoiceNumber}`);
        } catch (error) {
          result.errors.push('OCR processing failed');
          logger.error('OCR processing error:', error);
        }
      }

      // Step 2: Three-way matching
      result.threeWayMatch = await this.performThreeWayMatching(invoice);

      // Step 3: Validate invoice data
      const validationErrors = this.validateInvoiceData(invoice, result.ocrResult);
      result.errors.push(...validationErrors);

      // Step 4: Determine overall validity
      result.isValid = result.errors.length === 0 && 
                      (result.threeWayMatch?.isMatched ?? false);

      // Step 5: Update invoice status based on validation
      const newStatus = this.determineInvoiceStatus(result);
      
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          matchingResults: result.threeWayMatch as any
        }
      });

      // Step 6: Audit logging
      if (userId) {
        await auditService.log({
          userId,
          action: 'UPDATE',
          resource: 'Invoice',
          resourceId: invoiceId,
          metadata: {
            ocrProcessed: !!imageBuffer,
            threeWayMatched: result.threeWayMatch?.isMatched,
            validationResult: result.isValid
          }
        });
      }

      logger.info(`Invoice processing completed for ${invoice.invoiceNumber}`, {
        isValid: result.isValid,
        hasErrors: result.errors.length > 0,
        threeWayMatched: result.threeWayMatch?.isMatched
      });

      return result;

    } catch (error) {
      logger.error('Invoice processing failed:', error);
      throw error;
    }
  }

  private async performThreeWayMatching(
    invoice: Invoice & {
      purchaseOrder: PurchaseOrder & {
        lineItems: any[];
        deliveries: any[];
      };
    }
  ): Promise<ThreeWayMatchResult> {
    const result: ThreeWayMatchResult = {
      isMatched: false,
      priceVariance: 0,
      quantityVariance: 0,
      issues: [],
      tolerance: {
        priceTolerancePercent: this.PRICE_TOLERANCE_PERCENT,
        quantityTolerancePercent: this.QUANTITY_TOLERANCE_PERCENT
      }
    };

    try {
      const { purchaseOrder } = invoice;

      // Check if purchase order exists
      if (!purchaseOrder) {
        result.issues.push('No associated purchase order found');
        return result;
      }

      // Check if delivery confirmation exists
      const hasDelivery = purchaseOrder.deliveries.some(d => d.status === 'DELIVERED');
      if (!hasDelivery) {
        result.issues.push('No delivery confirmation found');
        result.isMatched = false;
        return result;
      }

      // Price matching with tolerance
      const poTotalAmount = purchaseOrder.totalAmount;
      const invoiceTotalAmount = invoice.totalAmount;
      
      result.priceVariance = Math.abs((invoiceTotalAmount - poTotalAmount) / poTotalAmount) * 100;
      
      if (result.priceVariance > this.PRICE_TOLERANCE_PERCENT) {
        result.issues.push(
          `Price variance ${result.priceVariance.toFixed(2)}% exceeds tolerance of ${this.PRICE_TOLERANCE_PERCENT}%`
        );
      }

      // Currency matching
      if (invoice.currency !== purchaseOrder.currency) {
        result.issues.push(`Currency mismatch: Invoice ${invoice.currency} vs PO ${purchaseOrder.currency}`);
      }

      // Line item quantity matching (exact matching required)
      const quantityIssues = this.validateLineItemQuantities(invoice, purchaseOrder);
      result.issues.push(...quantityIssues);

      // Vendor validation
      if (invoice.purchaseOrder.vendorId) {
        // Additional vendor validation could be added here
      }

      // Determine if matching is successful
      result.isMatched = result.issues.length === 0;

      logger.info(`Three-way matching completed for invoice ${invoice.invoiceNumber}`, {
        isMatched: result.isMatched,
        priceVariance: result.priceVariance,
        issuesCount: result.issues.length
      });

    } catch (error) {
      logger.error('Three-way matching failed:', error);
      result.issues.push('Three-way matching process failed');
    }

    return result;
  }

  private validateLineItemQuantities(
    invoice: Invoice,
    purchaseOrder: PurchaseOrder & { lineItems: any[] }
  ): string[] {
    const issues: string[] = [];

    try {
      // If OCR extracted line items, validate against PO line items
      const ocrData = invoice.ocrData as any;
      if (ocrData?.extractedData?.lineItems) {
        const ocrLineItems = ocrData.extractedData.lineItems;
        const poLineItems = purchaseOrder.lineItems;

        if (ocrLineItems.length !== poLineItems.length) {
          issues.push(`Line item count mismatch: Invoice has ${ocrLineItems.length}, PO has ${poLineItems.length}`);
        }

        // Match line items by description similarity
        for (const ocrItem of ocrLineItems) {
          const matchingPoItem = poLineItems.find(poItem => 
            this.isDescriptionSimilar(ocrItem.description, poItem.itemDescription)
          );

          if (!matchingPoItem) {
            issues.push(`No matching PO line item found for: ${ocrItem.description}`);
            continue;
          }

          // Exact quantity matching
          if (ocrItem.quantity && Math.abs(ocrItem.quantity - matchingPoItem.quantity) > 0.001) {
            issues.push(
              `Quantity mismatch for ${ocrItem.description}: Invoice ${ocrItem.quantity}, PO ${matchingPoItem.quantity}`
            );
          }
        }
      }
    } catch (error) {
      logger.error('Line item validation failed:', error);
      issues.push('Line item validation failed');
    }

    return issues;
  }

  private isDescriptionSimilar(desc1: string, desc2: string): boolean {
    // Simple similarity check - could be enhanced with fuzzy matching
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalized1 = normalize(desc1);
    const normalized2 = normalize(desc2);
    
    return normalized1.includes(normalized2) || 
           normalized2.includes(normalized1) ||
           this.calculateSimilarity(normalized1, normalized2) > 0.8;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Levenshtein distance based similarity
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
  }

  private validateInvoiceData(invoice: Invoice, ocrResult?: OCRResult): string[] {
    const errors: string[] = [];

    // Basic invoice data validation
    if (!invoice.invoiceNumber) {
      errors.push('Invoice number is required');
    }

    if (!invoice.totalAmount || invoice.totalAmount <= 0) {
      errors.push('Valid total amount is required');
    }

    if (!invoice.invoiceDate) {
      errors.push('Invoice date is required');
    }

    // OCR data validation if available
    if (ocrResult) {
      if (ocrResult.confidence < 70) {
        errors.push('OCR confidence too low for reliable processing');
      }

      // Cross-validate OCR extracted data with invoice data
      if (ocrResult.extractedData.totalAmount && 
          Math.abs(ocrResult.extractedData.totalAmount - invoice.totalAmount) > 0.01) {
        errors.push('OCR extracted amount does not match invoice amount');
      }
    }

    return errors;
  }

  private determineInvoiceStatus(result: InvoiceValidationResult): InvoiceStatus {
    if (result.errors.length > 0) {
      return InvoiceStatus.DISPUTED;
    }

    if (result.threeWayMatch?.isMatched) {
      return InvoiceStatus.APPROVED;
    }

    return InvoiceStatus.UNDER_REVIEW;
  }

  async getInvoiceProcessingStatus(invoiceId: string): Promise<{
    invoice: Invoice;
    processingStatus: {
      ocrCompleted: boolean;
      threeWayMatched: boolean;
      readyForPayment: boolean;
      issues: string[];
    };
  }> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        purchaseOrder: {
          include: {
            vendor: true,
            deliveries: true
          }
        }
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const ocrCompleted = !!invoice.ocrData;
    const matchingResults = invoice.matchingResults as any;
    const threeWayMatched = matchingResults?.isMatched ?? false;
    const readyForPayment = invoice.status === InvoiceStatus.APPROVED;
    const issues = matchingResults?.issues ?? [];

    return {
      invoice,
      processingStatus: {
        ocrCompleted,
        threeWayMatched,
        readyForPayment,
        issues
      }
    };
  }
}

export const invoiceProcessingService = new InvoiceProcessingService();