import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, InvoiceStatus } from '@prisma/client';
import { paymentService, PaymentRequest } from '../services/paymentService';

const prisma = new PrismaClient();

describe('Payment Processing Service', () => {
  let testVessel: any;
  let testVendor: any;
  let testPurchaseOrder: any;
  let testInvoice: any;
  let testDelivery: any;
  let testUser: any;

  beforeAll(async () => {
    // Create test data
    testUser = await prisma.user.create({
      data: {
        email: 'finance@test.com',
        passwordHash: 'hashedpassword',
        firstName: 'Finance',
        lastName: 'User',
        role: 'FINANCE_TEAM',
        emailVerified: true
      }
    });

    testVessel = await prisma.vessel.create({
      data: {
        name: 'Test Vessel Payment',
        imoNumber: 'IMO1234568',
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
        name: 'Test Payment Vendor',
        code: 'TPV001',
        email: 'vendor@payment.com',
        isActive: true,
        isApproved: true,
        creditLimit: 5000,
        bankName: 'Test Bank',
        accountNumber: 'encrypted-account-123',
        routingNumber: 'encrypted-routing-456'
      }
    });

    testPurchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber: 'PO-PAYMENT-001',
        vendorId: testVendor.id,
        vesselId: testVessel.id,
        totalAmount: 2000.00,
        currency: 'USD',
        status: 'DELIVERED'
      }
    });

    testDelivery = await prisma.delivery.create({
      data: {
        deliveryNumber: 'DEL-PAYMENT-001',
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
    await prisma.purchaseOrder.delete({ where: { id: testPurchaseOrder.id } });
    await prisma.vendor.delete({ where: { id: testVendor.id } });
    await prisma.vessel.delete({ where: { id: testVessel.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing test invoices
    await prisma.invoice.deleteMany({ where: { purchaseOrderId: testPurchaseOrder.id } });
  });

  describe('Payment Initiation', () => {
    test('should successfully initiate payment for small amounts', async () => {
      // Create approved invoice
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-PAY-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED
        }
      });

      const paymentRequest: PaymentRequest = {
        invoiceId: testInvoice.id,
        amount: 1000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank',
          swiftCode: 'TESTUS33'
        },
        reference: 'PAY-TEST-001',
        description: 'Test payment'
      };

      const result = await paymentService.initiatePayment(paymentRequest, testUser.id);

      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(result.transactionId).toBeDefined();
      expect(result.amount).toBe(1000.00);

      // Verify invoice was updated
      const updatedInvoice = await prisma.invoice.findUnique({
        where: { id: testInvoice.id }
      });
      expect(updatedInvoice?.status).toBe(InvoiceStatus.PAID);
      expect(updatedInvoice?.paidAmount).toBe(1000.00);
    });

    test('should require approval for large amounts', async () => {
      // Create approved invoice with large amount
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-PAY-002',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 15000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED
        }
      });

      const paymentRequest: PaymentRequest = {
        invoiceId: testInvoice.id,
        amount: 15000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-TEST-002',
        description: 'Large payment requiring approval'
      };

      const result = await paymentService.initiatePayment(paymentRequest, testUser.id);

      expect(result.success).toBe(false);
      expect(result.status).toBe('PENDING');
      expect(result.errorMessage).toContain('requires approval');
    });

    test('should reject payment for non-approved invoice', async () => {
      // Create non-approved invoice
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-PAY-003',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.UNDER_REVIEW
        }
      });

      const paymentRequest: PaymentRequest = {
        invoiceId: testInvoice.id,
        amount: 1000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-TEST-003',
        description: 'Payment for non-approved invoice'
      };

      await expect(
        paymentService.initiatePayment(paymentRequest, testUser.id)
      ).rejects.toThrow('Invoice must be approved before payment');
    });

    test('should reject payment exceeding remaining balance', async () => {
      // Create partially paid invoice
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-PAY-004',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED,
          paidAmount: 600.00
        }
      });

      const paymentRequest: PaymentRequest = {
        invoiceId: testInvoice.id,
        amount: 500.00, // Would exceed remaining balance of 400
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-TEST-004',
        description: 'Payment exceeding balance'
      };

      await expect(
        paymentService.initiatePayment(paymentRequest, testUser.id)
      ).rejects.toThrow('Payment amount exceeds remaining balance');
    });
  });

  describe('Payment Approval Workflow', () => {
    test('should handle single-level approval', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-APPROVAL-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 8000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED
        }
      });

      const paymentRequest: PaymentRequest = {
        invoiceId: testInvoice.id,
        amount: 8000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-APPROVAL-001',
        description: 'Payment requiring approval'
      };

      // Initiate payment (should require approval)
      const initiateResult = await paymentService.initiatePayment(paymentRequest, testUser.id);
      expect(initiateResult.success).toBe(false);
      expect(initiateResult.status).toBe('PENDING');

      // Approve payment
      const approvalResult = await paymentService.approvePayment(
        testInvoice.id,
        'finance-manager-id', // Mock approver ID
        true,
        'Approved for payment'
      );

      expect(approvalResult.approved).toBe(true);
      expect(approvalResult.canProceedWithPayment).toBe(true);
    });

    test('should handle payment rejection', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-REJECTION-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 8000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED
        }
      });

      const paymentRequest: PaymentRequest = {
        invoiceId: testInvoice.id,
        amount: 8000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-REJECTION-001',
        description: 'Payment to be rejected'
      };

      // Initiate payment (should require approval)
      await paymentService.initiatePayment(paymentRequest, testUser.id);

      // Reject payment
      const rejectionResult = await paymentService.approvePayment(
        testInvoice.id,
        'finance-manager-id',
        false,
        'Insufficient documentation'
      );

      expect(rejectionResult.approved).toBe(false);
      expect(rejectionResult.canProceedWithPayment).toBe(false);
    });

    test('should handle multi-level approval', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-MULTILEVEL-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 30000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED
        }
      });

      const paymentRequest: PaymentRequest = {
        invoiceId: testInvoice.id,
        amount: 30000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-MULTILEVEL-001',
        description: 'Large payment requiring multi-level approval'
      };

      // Initiate payment (should require approval)
      await paymentService.initiatePayment(paymentRequest, testUser.id);

      // First level approval
      const firstApproval = await paymentService.approvePayment(
        testInvoice.id,
        'finance-manager-id',
        true,
        'First level approved'
      );

      expect(firstApproval.approved).toBe(true);
      expect(firstApproval.canProceedWithPayment).toBe(false); // Still needs more approvals

      // Second level approval
      const secondApproval = await paymentService.approvePayment(
        testInvoice.id,
        'cfo-id',
        true,
        'Second level approved'
      );

      expect(secondApproval.approved).toBe(true);
      expect(secondApproval.canProceedWithPayment).toBe(false); // Still needs CEO approval

      // Final level approval
      const finalApproval = await paymentService.approvePayment(
        testInvoice.id,
        'ceo-id',
        true,
        'Final approval granted'
      );

      expect(finalApproval.approved).toBe(true);
      expect(finalApproval.canProceedWithPayment).toBe(true);
    });
  });

  describe('Payment Status and History', () => {
    test('should get payment status correctly', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-STATUS-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.PAID,
          paidAmount: 1000.00,
          paidDate: new Date(),
          paymentReference: 'PAY-REF-001'
        }
      });

      const status = await paymentService.getPaymentStatus(testInvoice.id);

      expect(status.invoice).toBeDefined();
      expect(status.paymentStatus.isPaid).toBe(true);
      expect(status.paymentStatus.paidAmount).toBe(1000.00);
      expect(status.paymentStatus.remainingAmount).toBe(0);
    });

    test('should handle partial payments', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-PARTIAL-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED,
          paidAmount: 600.00
        }
      });

      const status = await paymentService.getPaymentStatus(testInvoice.id);

      expect(status.paymentStatus.isPaid).toBe(false);
      expect(status.paymentStatus.paidAmount).toBe(600.00);
      expect(status.paymentStatus.remainingAmount).toBe(400.00);
    });
  });

  describe('Payment Exception Handling', () => {
    test('should handle payment exceptions', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-EXCEPTION-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED
        }
      });

      await paymentService.handlePaymentException(
        testInvoice.id,
        'BANK_ERROR',
        'Connection timeout to banking system',
        testUser.id
      );

      // Verify invoice status was updated
      const updatedInvoice = await prisma.invoice.findUnique({
        where: { id: testInvoice.id }
      });

      expect(updatedInvoice?.status).toBe(InvoiceStatus.DISPUTED);
      expect(updatedInvoice?.notes).toContain('Payment exception: BANK_ERROR');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent invoice', async () => {
      const paymentRequest: PaymentRequest = {
        invoiceId: 'non-existent-id',
        amount: 1000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-ERROR-001',
        description: 'Payment for non-existent invoice'
      };

      await expect(
        paymentService.initiatePayment(paymentRequest, testUser.id)
      ).rejects.toThrow('Invoice not found');
    });

    test('should handle unauthorized approval', async () => {
      testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-UNAUTH-001',
          purchaseOrderId: testPurchaseOrder.id,
          totalAmount: 8000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: InvoiceStatus.APPROVED
        }
      });

      const paymentRequest: PaymentRequest = {
        invoiceId: testInvoice.id,
        amount: 8000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-UNAUTH-001',
        description: 'Payment with unauthorized approval'
      };

      // Initiate payment
      await paymentService.initiatePayment(paymentRequest, testUser.id);

      // Try to approve with wrong user
      await expect(
        paymentService.approvePayment(
          testInvoice.id,
          'unauthorized-user-id',
          true,
          'Unauthorized approval attempt'
        )
      ).rejects.toThrow('User not authorized to approve at this level');
    });
  });
});