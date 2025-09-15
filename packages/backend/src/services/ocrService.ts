import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { logger } from '../utils/logger';

export interface OCRResult {
  text: string;
  confidence: number;
  extractedData: {
    invoiceNumber?: string;
    invoiceDate?: string;
    totalAmount?: number;
    currency?: string;
    vendorName?: string;
    lineItems?: Array<{
      description: string;
      quantity?: number;
      unitPrice?: number;
      totalPrice?: number;
    }>;
  };
}

export class OCRService {
  private worker: any;

  async initialize(): Promise<void> {
    try {
      this.worker = await createWorker('eng');
      logger.info('OCR service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OCR service:', error);
      throw error;
    }
  }

  async processInvoiceImage(imageBuffer: Buffer): Promise<OCRResult> {
    try {
      // Preprocess image for better OCR accuracy
      const processedImage = await this.preprocessImage(imageBuffer);
      
      // Perform OCR
      const { data } = await this.worker.recognize(processedImage);
      
      // Extract structured data from OCR text
      const extractedData = this.extractInvoiceData(data.text);
      
      return {
        text: data.text,
        confidence: data.confidence,
        extractedData
      };
    } catch (error) {
      logger.error('OCR processing failed:', error);
      throw new Error('Failed to process invoice image');
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Enhance image for better OCR results
      return await sharp(imageBuffer)
        .greyscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();
    } catch (error) {
      logger.error('Image preprocessing failed:', error);
      throw error;
    }
  }

  private extractInvoiceData(text: string): OCRResult['extractedData'] {
    const extractedData: OCRResult['extractedData'] = {};

    try {
      // Extract invoice number
      const invoiceNumberMatch = text.match(/(?:invoice|inv)[\s#:]*([A-Z0-9\-]+)/i);
      if (invoiceNumberMatch) {
        extractedData.invoiceNumber = invoiceNumberMatch[1];
      }

      // Extract invoice date
      const dateMatch = text.match(/(?:date|dated)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
      if (dateMatch) {
        extractedData.invoiceDate = dateMatch[1];
      }

      // Extract total amount
      const totalMatch = text.match(/(?:total|amount|sum)[\s:$]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      if (totalMatch) {
        extractedData.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
      }

      // Extract currency
      const currencyMatch = text.match(/(?:USD|EUR|GBP|JPY|\$|€|£|¥)/i);
      if (currencyMatch) {
        const currencyMap: { [key: string]: string } = {
          '$': 'USD',
          '€': 'EUR',
          '£': 'GBP',
          '¥': 'JPY'
        };
        extractedData.currency = currencyMap[currencyMatch[0]] || currencyMatch[0].toUpperCase();
      }

      // Extract vendor name (usually at the top of the invoice)
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        // Take the first substantial line as potential vendor name
        const vendorLine = lines.find(line => line.length > 5 && !line.match(/^\d+$/));
        if (vendorLine) {
          extractedData.vendorName = vendorLine.trim();
        }
      }

      // Extract line items (simplified pattern)
      const lineItems: Array<{
        description: string;
        quantity?: number;
        unitPrice?: number;
        totalPrice?: number;
      }> = [];

      const itemPattern = /(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
      let match;
      while ((match = itemPattern.exec(text)) !== null) {
        lineItems.push({
          description: match[1].trim(),
          quantity: parseFloat(match[2]),
          unitPrice: parseFloat(match[3].replace(/,/g, '')),
          totalPrice: parseFloat(match[4].replace(/,/g, ''))
        });
      }

      if (lineItems.length > 0) {
        extractedData.lineItems = lineItems;
      }

    } catch (error) {
      logger.error('Data extraction failed:', error);
    }

    return extractedData;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      logger.info('OCR service terminated');
    }
  }
}

// Singleton instance
export const ocrService = new OCRService();