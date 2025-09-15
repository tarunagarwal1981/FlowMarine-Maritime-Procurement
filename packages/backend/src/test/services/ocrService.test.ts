import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OCRService } from '@/services/ocrService';

// Mock Tesseract.js
const mockRecognize = vi.fn();
vi.mock('tesseract.js', () => ({
  recognize: mockRecognize,
}));

// Mock AWS Textract (if used)
const mockTextract = {
  detectDocumentText: vi.fn(() => ({
    promise: vi.fn(),
  })),
};

vi.mock('aws-sdk', () => ({
  Textract: vi.fn(() => mockTextract),
}));

describe('OCRService', () => {
  let ocrService: OCRService;

  beforeEach(() => {
    ocrService = new OCRService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('extractInvoiceData', () => {
    it('should extract invoice data from image successfully', async () => {
      const mockOCRResult = {
        data: {
          text: `
            INVOICE
            Invoice Number: INV-2024-001
            Date: 2024-02-15
            Vendor: Marine Supplies Ltd
            Amount: $5,000.00
            PO Number: PO-2024-001
            
            Line Items:
            Engine Oil - Qty: 10 - $300.00
            Air Filter - Qty: 2 - $150.00
            Total: $5,000.00
          `,
        },
      };

      mockRecognize.mockResolvedValue(mockOCRResult);

      const imageBuffer = Buffer.from('fake-image-data');
      const result = await ocrService.extractInvoiceData(imageBuffer);

      expect(mockRecognize).toHaveBeenCalledWith(imageBuffer, 'eng');
      expect(result).toEqual({
        invoiceNumber: 'INV-2024-001',
        date: '2024-02-15',
        vendorName: 'Marine Supplies Ltd',
        totalAmount: 5000.00,
        currency: 'USD',
        poNumber: 'PO-2024-001',
        lineItems: [
          {
            description: 'Engine Oil',
            quantity: 10,
            unitPrice: 30.00,
            totalPrice: 300.00,
          },
          {
            description: 'Air Filter',
            quantity: 2,
            unitPrice: 75.00,
            totalPrice: 150.00,
          },
        ],
        confidence: expect.any(Number),
      });
    });

    it('should handle OCR errors gracefully', async () => {
      mockRecognize.mockRejectedValue(new Error('OCR processing failed'));

      const imageBuffer = Buffer.from('corrupted-image-data');

      await expect(ocrService.extractInvoiceData(imageBuffer))
        .rejects.toThrow('OCR processing failed');
    });

    it('should return low confidence for unclear text', async () => {
      const mockOCRResult = {
        data: {
          text: 'unclear text with many errors',
          confidence: 45, // Low confidence
        },
      };

      mockRecognize.mockResolvedValue(mockOCRResult);

      const imageBuffer = Buffer.from('blurry-image-data');
      const result = await ocrService.extractInvoiceData(imageBuffer);

      expect(result.confidence).toBeLessThan(50);
      expect(result.requiresManualReview).toBe(true);
    });
  });

  describe('extractPurchaseOrderData', () => {
    it('should extract PO data from document', async () => {
      const mockOCRResult = {
        data: {
          text: `
            PURCHASE ORDER
            PO Number: PO-2024-001
            Date: 2024-02-10
            Vendor: Marine Supplies Ltd
            Ship To: MV Ocean Explorer
            Port: Hamburg
            
            Items:
            1. Engine Oil SAE 15W-40 - Qty: 10 - $300.00
            2. Air Filter Heavy Duty - Qty: 2 - $150.00
            
            Total: $450.00
            Terms: Net 30
          `,
        },
      };

      mockRecognize.mockResolvedValue(mockOCRResult);

      const imageBuffer = Buffer.from('po-image-data');
      const result = await ocrService.extractPurchaseOrderData(imageBuffer);

      expect(result).toEqual({
        poNumber: 'PO-2024-001',
        date: '2024-02-10',
        vendorName: 'Marine Supplies Ltd',
        shipTo: 'MV Ocean Explorer',
        deliveryLocation: 'Hamburg',
        totalAmount: 450.00,
        currency: 'USD',
        paymentTerms: 'Net 30',
        lineItems: [
          {
            description: 'Engine Oil SAE 15W-40',
            quantity: 10,
            unitPrice: 30.00,
            totalPrice: 300.00,
          },
          {
            description: 'Air Filter Heavy Duty',
            quantity: 2,
            unitPrice: 75.00,
            totalPrice: 150.00,
          },
        ],
        confidence: expect.any(Number),
      });
    });
  });

  describe('extractDeliveryReceiptData', () => {
    it('should extract delivery receipt information', async () => {
      const mockOCRResult = {
        data: {
          text: `
            DELIVERY RECEIPT
            Receipt Number: DR-2024-001
            Date: 2024-02-20
            PO Number: PO-2024-001
            Vessel: MV Ocean Explorer
            Port: Hamburg
            
            Received Items:
            ✓ Engine Oil - Qty: 10 - Good Condition
            ✓ Air Filter - Qty: 2 - Good Condition
            
            Received by: Chief Engineer John Smith
            Signature: [Signature Present]
          `,
        },
      };

      mockRecognize.mockResolvedValue(mockOCRResult);

      const imageBuffer = Buffer.from('receipt-image-data');
      const result = await ocrService.extractDeliveryReceiptData(imageBuffer);

      expect(result).toEqual({
        receiptNumber: 'DR-2024-001',
        date: '2024-02-20',
        poNumber: 'PO-2024-001',
        vesselName: 'MV Ocean Explorer',
        deliveryLocation: 'Hamburg',
        receivedBy: 'Chief Engineer John Smith',
        signaturePresent: true,
        receivedItems: [
          {
            description: 'Engine Oil',
            quantity: 10,
            condition: 'Good Condition',
            received: true,
          },
          {
            description: 'Air Filter',
            quantity: 2,
            condition: 'Good Condition',
            received: true,
          },
        ],
        confidence: expect.any(Number),
      });
    });

    it('should detect missing signature', async () => {
      const mockOCRResult = {
        data: {
          text: `
            DELIVERY RECEIPT
            Receipt Number: DR-2024-002
            Date: 2024-02-21
            PO Number: PO-2024-002
            
            Received Items:
            Engine Oil - Qty: 5
            
            Received by: [Not Signed]
          `,
        },
      };

      mockRecognize.mockResolvedValue(mockOCRResult);

      const imageBuffer = Buffer.from('unsigned-receipt-data');
      const result = await ocrService.extractDeliveryReceiptData(imageBuffer);

      expect(result.signaturePresent).toBe(false);
      expect(result.requiresManualReview).toBe(true);
    });
  });

  describe('validateExtractedData', () => {
    it('should validate invoice data against PO', async () => {
      const invoiceData = {
        invoiceNumber: 'INV-2024-001',
        poNumber: 'PO-2024-001',
        totalAmount: 5000.00,
        vendorName: 'Marine Supplies Ltd',
        lineItems: [
          { description: 'Engine Oil', quantity: 10, totalPrice: 300.00 },
        ],
      };

      const poData = {
        poNumber: 'PO-2024-001',
        totalAmount: 5000.00,
        vendorName: 'Marine Supplies Ltd',
        lineItems: [
          { description: 'Engine Oil', quantity: 10, totalPrice: 300.00 },
        ],
      };

      const validation = await ocrService.validateExtractedData(invoiceData, poData);

      expect(validation.isValid).toBe(true);
      expect(validation.discrepancies).toHaveLength(0);
      expect(validation.matchPercentage).toBeGreaterThan(95);
    });

    it('should detect amount discrepancies', async () => {
      const invoiceData = {
        invoiceNumber: 'INV-2024-001',
        poNumber: 'PO-2024-001',
        totalAmount: 5500.00, // Different amount
        vendorName: 'Marine Supplies Ltd',
        lineItems: [
          { description: 'Engine Oil', quantity: 10, totalPrice: 350.00 },
        ],
      };

      const poData = {
        poNumber: 'PO-2024-001',
        totalAmount: 5000.00,
        vendorName: 'Marine Supplies Ltd',
        lineItems: [
          { description: 'Engine Oil', quantity: 10, totalPrice: 300.00 },
        ],
      };

      const validation = await ocrService.validateExtractedData(invoiceData, poData);

      expect(validation.isValid).toBe(false);
      expect(validation.discrepancies).toContain('AMOUNT_MISMATCH');
      expect(validation.amountDifference).toBe(500.00);
      expect(validation.requiresApproval).toBe(true);
    });

    it('should detect quantity discrepancies', async () => {
      const invoiceData = {
        invoiceNumber: 'INV-2024-001',
        poNumber: 'PO-2024-001',
        totalAmount: 5000.00,
        vendorName: 'Marine Supplies Ltd',
        lineItems: [
          { description: 'Engine Oil', quantity: 12, totalPrice: 300.00 }, // Different quantity
        ],
      };

      const poData = {
        poNumber: 'PO-2024-001',
        totalAmount: 5000.00,
        vendorName: 'Marine Supplies Ltd',
        lineItems: [
          { description: 'Engine Oil', quantity: 10, totalPrice: 300.00 },
        ],
      };

      const validation = await ocrService.validateExtractedData(invoiceData, poData);

      expect(validation.isValid).toBe(false);
      expect(validation.discrepancies).toContain('QUANTITY_MISMATCH');
      expect(validation.requiresApproval).toBe(true);
    });
  });

  describe('improveOCRAccuracy', () => {
    it('should preprocess image for better OCR results', async () => {
      const originalBuffer = Buffer.from('original-image-data');
      
      // Mock image preprocessing
      const preprocessedBuffer = await ocrService.preprocessImage(originalBuffer);
      
      expect(preprocessedBuffer).toBeInstanceOf(Buffer);
      expect(preprocessedBuffer.length).toBeGreaterThan(0);
    });

    it('should use multiple OCR engines for critical documents', async () => {
      const imageBuffer = Buffer.from('critical-document-data');
      
      // Mock multiple OCR results
      mockRecognize
        .mockResolvedValueOnce({ data: { text: 'Result from Engine 1', confidence: 85 } })
        .mockResolvedValueOnce({ data: { text: 'Result from Engine 2', confidence: 90 } });

      const result = await ocrService.extractWithMultipleEngines(imageBuffer);

      expect(result.bestResult.confidence).toBe(90);
      expect(result.consensusText).toBeDefined();
      expect(result.engines).toHaveLength(2);
    });
  });

  describe('handleSpecialDocumentTypes', () => {
    it('should handle maritime-specific invoice formats', async () => {
      const mockMaritimeInvoice = {
        data: {
          text: `
            MARINE INVOICE
            Invoice: MI-2024-001
            Vessel: MV Ocean Explorer
            IMO: 1234567
            Port of Supply: Hamburg
            Bunker Delivery Note: BDN-001
            
            Marine Gas Oil: 500 MT @ $650/MT = $325,000
            Marine Diesel Oil: 200 MT @ $680/MT = $136,000
            
            Total: $461,000 USD
          `,
        },
      };

      mockRecognize.mockResolvedValue(mockMaritimeInvoice);

      const imageBuffer = Buffer.from('marine-invoice-data');
      const result = await ocrService.extractMaritimeInvoiceData(imageBuffer);

      expect(result).toEqual({
        invoiceNumber: 'MI-2024-001',
        vesselName: 'MV Ocean Explorer',
        imoNumber: '1234567',
        portOfSupply: 'Hamburg',
        bunkerDeliveryNote: 'BDN-001',
        fuelItems: [
          {
            type: 'Marine Gas Oil',
            quantity: 500,
            unit: 'MT',
            unitPrice: 650,
            totalPrice: 325000,
          },
          {
            type: 'Marine Diesel Oil',
            quantity: 200,
            unit: 'MT',
            unitPrice: 680,
            totalPrice: 136000,
          },
        ],
        totalAmount: 461000,
        currency: 'USD',
        confidence: expect.any(Number),
      });
    });
  });
});