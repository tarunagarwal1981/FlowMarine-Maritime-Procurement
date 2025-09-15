import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { invoiceProcessingService } from '../services/invoiceProcessingService';
import { ocrService } from '../services/ocrService';

const prisma = new PrismaClient();

describe('Invoice Processing Service', () => {
  let testVessel: any;
  let testVendor: any;
  let testPurchaseOrder: any;
  let testInvoice: any;
  let testDelivery: any;

  beforeAll(async () => {
    // Initialize OCR service
    await ocrService.initialize();

    // Create test data
    testVessel = await prisma.vessel.create({
      data: {
        name: 'Test Vessel',
        imoNumber: 'IMO1234567',
        vesselType: 'Container Ship',
        flag: 'US',
        engineType: 'Diesel',
        cargoCapacity: 50000,
        fuelConsumption: 100,
        crewComplement: 25
      }
    });

    testVendor = await prisma.vendor.create({
      data: {
        name: 'Test Vendor',
        code: 'TV001',
        email: 'vendor@test.com',
        isActive: true,
        isApproved: true
      }
    });

    testPurchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber: 'PO-TEST-001',
        vendorId: testVendor.id,
        vesselId: testVessel.id,
        totalAmount: 1000.00,
        currency: 'USD',
        status: 'SENT',
        lineItems: {
          create: [
            {
              itemDescription: 'Engine Oil Filter',
              quantity: 10,
              unitPrice: 50.00,
              totalPrice: 500.00,
              currency: 'USD'
            },
            {
              itemDescription: 'Hydraulic Pump',
              quantity: 2,
              unitPrice: 250.00,
              totalPrice: 500.00,
              currency: 'USD'
            }
          ]
        }
      }
    });

    testDelivery = await prisma.delivery.create({
      data: {
        deliveryNumber: 'DEL-TEST-001',
        purchaseOrderId: testPurchaseOrder.id,
        status: 'DELIVERED',
        actualDate: new Date(),
        receivedBy: 'Test Receiver'
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.delivery.deleteMany({ where: { purchaseOrderId: testPurchaseOrder.id } });
    await prisma.invoice.deleteMany({ where: { purchaseOrderId: testPurchaseOrder.id } });
    await prisma.pOLineItem.deleteMany({ where: { purchaseOrderId: testPurchaseOrder.id } });
    await prisma.purchaseOrder.delete({ where: { id: testPurchaseOrder.id } });
    await prisma.vendor.delete({ where: { id: testVendor.id } });
    await prisma.vessel.delete({ where: { id: testVessel.id } });
    
    await ocrService.terminate();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing test invoices
    await prisma.invoice.deleteMany({ where: { purchaseOrderId: testPurchaseOrder.id } });
  });

  describe('Three-Way Matching', () => {
    test('should successfully match invoice with exact amounts', async () => {
      // Create invoice with exact PO amount
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-TEST-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      const result = await invoiceProcessingService.processInvoice(testInvoice.id);

      expect(result.isValid).toBe(true);
      expect(result.threeWayMatch?.isMatched).toBe(true);
      expect(result.threeWayMatch?.priceVariance).toBeLessThan(0.01);
      expect(result.errors).toHaveLength(0);
    });

    test('should match invoice within price tolerance (±2%)', async () => {
      // Create invoice with 1.5% variance (within tolerance)
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-TEST-002',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1015.00, // 1.5% higher
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      const result = await invoiceProcessingService.processInvoice(testInvoice.id);

      expect(result.isValid).toBe(true);
      expect(result.threeWayMatch?.isMatched).toBe(true);
      expect(result.threeWayMatch?.priceVariance).toBeLessThan(2);
    });

    test('should reject invoice exceeding price tolerance', async () => {
      // Create invoice with 3% variance (exceeds tolerance)
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-TEST-003',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1030.00, // 3% higher
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      const result = await invoiceProcessingService.processInvoice(testInvoice.id);

      expect(result.isValid).toBe(false);
      expect(result.threeWayMatch?.isMatched).toBe(false);
      expect(result.threeWayMatch?.priceVariance).toBeGreaterThan(2);
      expect(result.threeWayMatch?.issues).toContain(
        expect.stringContaining('Price variance')
      );
    });

    test('should reject invoice with currency mismatch', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-TEST-004',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'EUR', // Different currency
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      const result = await invoiceProcessingService.processInvoice(testInvoice.id);

      expect(result.isValid).toBe(false);
      expect(result.threeWayMatch?.isMatched).toBe(false);
      expect(result.threeWayMatch?.issues).toContain(
        expect.stringContaining('Currency mismatch')
      );
    });

    test('should reject invoice without delivery confirmation', async () => {
      // Delete the delivery to simulate no delivery confirmation
      await prisma.delivery.delete({ where: { id: testDelivery.id } });

      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-TEST-005',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      const result = await invoiceProcessingService.processInvoice(testInvoice.id);

      expect(result.isValid).toBe(false);
      expect(result.threeWayMatch?.isMatched).toBe(false);
      expect(result.threeWayMatch?.issues).toContain('No delivery confirmation found');

      // Recreate delivery for other tests
      testDelivery = await prisma.delivery.create({
        data: {
          deliveryNumber: 'DEL-TEST-001-RECREATED',
          purchaseOrderId: testPurchaseOrder.id,
          status: 'DELIVERED',
          actualDate: new Date(),
          receivedBy: 'Test Receiver'
        }
      });
    });
  });

  describe('OCR Processing', () => {
    test('should process invoice with OCR data', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-TEST-OCR-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      // Create a simple test image buffer (1x1 white pixel PNG)
      const testImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8A, 0x8E, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const result = await invoiceProcessingService.processInvoice(
        testInvoice.id,
        testImageBuffer
      );

      expect(result.ocrResult).toBeDefined();
      expect(result.ocrResult?.text).toBeDefined();
      expect(result.ocrResult?.confidence).toBeGreaterThanOrEqual(0);

      // Verify OCR data was saved to database
      const updatedInvoice = await prisma.invoice.findUnique({
        where: { id: testInvoice.id }
      });
      expect(updatedInvoice?.ocrData).toBeDefined();
    });
  });

  describe('Invoice Status Management', () => {
    test('should update invoice status based on validation results', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-TEST-STATUS-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      const result = await invoiceProcessingService.processInvoice(testInvoice.id);

      // Check that status was updated
      const updatedInvoice = await prisma.invoice.findUnique({
        where: { id: testInvoice.id }
      });

      if (result.isValid) {
        expect(updatedInvoice?.status).toBe('APPROVED');
      } else {
        expect(updatedInvoice?.status).toBeOneOf(['UNDER_REVIEW', 'DISPUTED']);
      }
    });

    test('should get invoice processing status', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-TEST-STATUS-002',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      // Process the invoice first
      await invoiceProcessingService.processInvoice(testInvoice.id);

      // Get processing status
      const status = await invoiceProcessingService.getInvoiceProcessingStatus(testInvoice.id);

      expect(status.invoice).toBeDefined();
      expect(status.processingStatus).toBeDefined();
      expect(status.processingStatus.ocrCompleted).toBeDefined();
      expect(status.processingStatus.threeWayMatched).toBeDefined();
      expect(status.processingStatus.readyForPayment).toBeDefined();
      expect(Array.isArray(status.processingStatus.issues)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent invoice', async () => {
      await expect(
        invoiceProcessingService.processInvoice('non-existent-id')
      ).rejects.toThrow('Invoice not found');
    });

    test('should handle invoice without purchase order', async () => {
      // This scenario shouldn't happen due to foreign key constraints,
      // but we test the error handling anyway
      const invalidInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-INVALID-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      // Manually delete the purchase order to simulate the error condition
      await prisma.delivery.deleteMany({ where: { purchaseOrderId: testPurchaseOrder.id } });
      await prisma.pOLineItem.deleteMany({ where: { purchaseOrderId: testPurchaseOrder.id } });
      await prisma.purchaseOrder.delete({ where: { id: testPurchaseOrder.id } });

      const result = await invoiceProcessingService.processInvoice(invalidInvoice.id);

      expect(result.isValid).toBe(false);
      expect(result.threeWayMatch?.issues).toContain('No associated purchase order found');

      // Clean up
      await prisma.invoice.delete({ where: { id: invalidInvoice.id } });

      // Recreate purchase order for other tests
      testPurchaseOrder = await prisma.purchaseOrder.create({
        data: {
          poNumber: 'PO-TEST-001-RECREATED',
          vendorId: testVendor.id,
          vesselId: testVessel.id,
          totalAmount: 1000.00,
          currency: 'USD',
          status: 'SENT',
          lineItems: {
            create: [
              {
                itemDescription: 'Engine Oil Filter',
                quantity: 10,
                unitPrice: 50.00,
                totalPrice: 500.00,
                currency: 'USD'
              },
              {
                itemDescription: 'Hydraulic Pump',
                quantity: 2,
                unitPrice: 250.00,
                totalPrice: 500.00,
                currency: 'USD'
              }
            ]
          }
        }
      });

      testDelivery = await prisma.delivery.create({
        data: {
          deliveryNumber: 'DEL-TEST-001-FINAL',
          purchaseOrderId: testPurchaseOrder.id,
          status: 'DELIVERED',
          actualDate: new Date(),
          receivedBy: 'Test Receiver'
        }
      });
    });
  });
});