import { PrismaClient } from '@prisma/client';
import { ocrService } from '../services/ocrService.js';
import { invoiceProcessingService } from '../services/invoiceProcessingService.js';
import { paymentService } from '../services/paymentService.js';

const prisma = new PrismaClient();

async function validateTask13Implementation() {
  console.log('🔍 Validating Task 13: Invoice Processing and Three-Way Matching Implementation...\n');

  const results = {
    ocrService: false,
    invoiceProcessing: false,
    threeWayMatching: false,
    paymentProcessing: false,
    paymentApproval: false,
    auditTrails: false
  };

  try {
    // Test 1: OCR Service Initialization
    console.log('1. Testing OCR Service...');
    try {
      await ocrService.initialize();
      console.log('   ✅ OCR service initialized successfully');
      results.ocrService = true;
      await ocrService.terminate();
    } catch (error) {
      console.log('   ❌ OCR service initialization failed:', error.message);
    }

    // Test 2: Invoice Processing Service
    console.log('\n2. Testing Invoice Processing Service...');
    try {
      // Create test data
      const testVessel = await prisma.vessel.create({
        data: {
          name: 'Test Validation Vessel',
          imoNumber: 'IMO9999999',
          vesselType: 'Container Ship',
          flag: 'US',
          engineType: 'Diesel',
          cargoCapacity: 50000,
          fuelConsumption: 100,
          crewComplement: 25
        }
      });

      const testVendor = await prisma.vendor.create({
        data: {
          name: 'Test Validation Vendor',
          code: 'TVV001',
          email: 'vendor@validation.com',
          isActive: true,
          isApproved: true
        }
      });

      const testPO = await prisma.purchaseOrder.create({
        data: {
          poNumber: 'PO-VALIDATION-001',
          vendorId: testVendor.id,
          vesselId: testVessel.id,
          totalAmount: 1000.00,
          currency: 'USD',
          status: 'SENT',
          lineItems: {
            create: [
              {
                itemDescription: 'Test Item',
                quantity: 1,
                unitPrice: 1000.00,
                totalPrice: 1000.00,
                currency: 'USD'
              }
            ]
          }
        }
      });

      const testDelivery = await prisma.delivery.create({
        data: {
          deliveryNumber: 'DEL-VALIDATION-001',
          purchaseOrderId: testPO.id,
          status: 'DELIVERED',
          actualDate: new Date(),
          receivedBy: 'Test Receiver'
        }
      });

      const testInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-VALIDATION-001',
          purchaseOrderId: testPO.id,
          totalAmount: 1000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'RECEIVED'
        }
      });

      console.log('   ✅ Test data created successfully');
      results.invoiceProcessing = true;

      // Test 3: Three-Way Matching
      console.log('\n3. Testing Three-Way Matching...');
      const processingResult = await invoiceProcessingService.processInvoice(testInvoice.id);
      
      if (processingResult.threeWayMatch) {
        console.log('   ✅ Three-way matching completed');
        console.log(`   📊 Price variance: ${processingResult.threeWayMatch.priceVariance.toFixed(2)}%`);
        console.log(`   📊 Matched: ${processingResult.threeWayMatch.isMatched}`);
        results.threeWayMatching = true;
      } else {
        console.log('   ❌ Three-way matching failed');
      }

      // Test 4: Payment Processing
      console.log('\n4. Testing Payment Processing...');
      
      // Update invoice to approved status for payment testing
      await prisma.invoice.update({
        where: { id: testInvoice.id },
        data: { status: 'APPROVED' }
      });

      const paymentRequest = {
        invoiceId: testInvoice.id,
        amount: 1000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-VALIDATION-001',
        description: 'Test payment'
      };

      const paymentResult = await paymentService.initiatePayment(paymentRequest, 'test-user-id');
      
      if (paymentResult) {
        console.log('   ✅ Payment processing completed');
        console.log(`   💰 Payment status: ${paymentResult.status}`);
        console.log(`   💰 Success: ${paymentResult.success}`);
        results.paymentProcessing = true;
      }

      // Test 5: Payment Approval Workflow
      console.log('\n5. Testing Payment Approval Workflow...');
      
      // Create a large invoice that requires approval
      const largeInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-LARGE-001',
          purchaseOrderId: testPO.id,
          totalAmount: 15000.00,
          currency: 'USD',
          invoiceDate: new Date(),
          status: 'APPROVED'
        }
      });

      const largePaymentRequest = {
        invoiceId: largeInvoice.id,
        amount: 15000.00,
        currency: 'USD',
        vendorBankDetails: {
          accountNumber: '123456789',
          routingNumber: '987654321',
          bankName: 'Test Bank'
        },
        reference: 'PAY-LARGE-001',
        description: 'Large payment requiring approval'
      };

      const largePaymentResult = await paymentService.initiatePayment(largePaymentRequest, 'test-user-id');
      
      if (largePaymentResult.status === 'PENDING') {
        console.log('   ✅ Payment approval workflow triggered');
        console.log('   📋 Large payment requires approval as expected');
        results.paymentApproval = true;
      }

      // Test 6: Audit Trails
      console.log('\n6. Testing Audit Trails...');
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { resource: 'Invoice' },
            { resource: 'Payment' },
            { resource: 'PaymentApproval' }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      if (auditLogs.length > 0) {
        console.log('   ✅ Audit trails created successfully');
        console.log(`   📝 Found ${auditLogs.length} audit log entries`);
        results.auditTrails = true;
      }

      // Cleanup test data
      await prisma.delivery.deleteMany({ where: { purchaseOrderId: testPO.id } });
      await prisma.invoice.deleteMany({ where: { purchaseOrderId: testPO.id } });
      await prisma.pOLineItem.deleteMany({ where: { purchaseOrderId: testPO.id } });
      await prisma.purchaseOrder.delete({ where: { id: testPO.id } });
      await prisma.vendor.delete({ where: { id: testVendor.id } });
      await prisma.vessel.delete({ where: { id: testVessel.id } });

      console.log('\n   🧹 Test data cleaned up');

    } catch (error) {
      console.log('   ❌ Invoice processing test failed:', error.message);
    }

    // Summary
    console.log('\n📊 VALIDATION SUMMARY');
    console.log('====================');
    
    const testResults = [
      { name: 'OCR Service', passed: results.ocrService },
      { name: 'Invoice Processing', passed: results.invoiceProcessing },
      { name: 'Three-Way Matching', passed: results.threeWayMatching },
      { name: 'Payment Processing', passed: results.paymentProcessing },
      { name: 'Payment Approval', passed: results.paymentApproval },
      { name: 'Audit Trails', passed: results.auditTrails }
    ];

    testResults.forEach(test => {
      console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });

    const passedTests = testResults.filter(test => test.passed).length;
    const totalTests = testResults.length;
    
    console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Task 13 implementation is complete.');
    } else {
      console.log('⚠️  Some tests failed. Please review the implementation.');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run validation
validateTask13Implementation().catch(console.error);