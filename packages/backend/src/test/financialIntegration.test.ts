import request from 'supertest';
import { app } from '../server';
import { bankingIntegrationService } from '../services/bankingIntegrationService';
import { exchangeRateIntegrationService } from '../services/exchangeRateIntegrationService';
import { paymentGatewayIntegrationService } from '../services/paymentGatewayIntegrationService';
import { accountingIntegrationService } from '../services/accountingIntegrationService';

// Mock external services
jest.mock('../services/bankingIntegrationService');
jest.mock('../services/exchangeRateIntegrationService');
jest.mock('../services/paymentGatewayIntegrationService');
jest.mock('../services/accountingIntegrationService');

const mockBankingService = bankingIntegrationService as jest.Mocked<typeof bankingIntegrationService>;
const mockExchangeRateService = exchangeRateIntegrationService as jest.Mocked<typeof exchangeRateIntegrationService>;
const mockPaymentGatewayService = paymentGatewayIntegrationService as jest.Mocked<typeof paymentGatewayIntegrationService>;
const mockAccountingService = accountingIntegrationService as jest.Mocked<typeof accountingIntegrationService>;

describe('Financial Integration API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup test authentication
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'finance@test.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
  });

  describe('Banking Integration', () => {
    describe('POST /api/financial/banking/payments', () => {
      it('should process banking payment successfully', async () => {
        const mockValidation = {
          isValid: true,
          errors: [],
          warnings: [],
          estimatedFees: 25,
          estimatedProcessingTime: '1-2 business days',
          requiredDocuments: []
        };

        const mockPaymentStatus = {
          instructionId: 'PAY-123456',
          status: 'PENDING' as const,
          transactionId: 'TXN-789012',
          bankReference: 'BANK-REF-345',
          fees: 25,
          exchangeRate: 1.0,
          finalAmount: 1000,
          finalCurrency: 'USD'
        };

        mockBankingService.validatePayment.mockResolvedValue(mockValidation);
        mockBankingService.processPayment.mockResolvedValue(mockPaymentStatus);

        const paymentInstruction = {
          instructionId: 'PAY-123456',
          paymentMethod: 'SWIFT',
          amount: 1000,
          currency: 'USD',
          beneficiary: {
            name: 'Test Vendor',
            accountNumber: '1234567890',
            bankCode: 'TESTBANK',
            bankName: 'Test Bank',
            bankAddress: '123 Bank St',
            country: 'US'
          },
          remitter: {
            name: 'FlowMarine',
            accountNumber: '0987654321',
            bankCode: 'OURBANK',
            bankName: 'Our Bank',
            country: 'US'
          },
          purpose: 'Invoice payment',
          urgency: 'STANDARD',
          reference: 'INV-001'
        };

        const response = await request(app)
          .post('/api/financial/banking/payments')
          .set('Authorization', `Bearer ${authToken}`)
          .send(paymentInstruction);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockPaymentStatus);
        expect(mockBankingService.validatePayment).toHaveBeenCalledWith(paymentInstruction);
        expect(mockBankingService.processPayment).toHaveBeenCalledWith(paymentInstruction);
      });

      it('should return validation errors for invalid payment', async () => {
        const mockValidation = {
          isValid: false,
          errors: ['Invalid payment amount', 'Beneficiary account number is required'],
          warnings: [],
          estimatedFees: 0,
          estimatedProcessingTime: 'Unknown',
          requiredDocuments: []
        };

        mockBankingService.validatePayment.mockResolvedValue(mockValidation);

        const invalidPayment = {
          instructionId: 'PAY-123456',
          amount: -100,
          currency: 'USD'
        };

        const response = await request(app)
          .post('/api/financial/banking/payments')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidPayment);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toEqual(mockValidation.errors);
      });
    });

    describe('GET /api/financial/banking/payments/:instructionId/status', () => {
      it('should get payment status successfully', async () => {
        const mockStatus = {
          instructionId: 'PAY-123456',
          status: 'COMPLETED' as const,
          transactionId: 'TXN-789012',
          bankReference: 'BANK-REF-345',
          processedDate: new Date(),
          fees: 25,
          finalAmount: 1000,
          finalCurrency: 'USD'
        };

        mockBankingService.getPaymentStatus.mockResolvedValue(mockStatus);

        const response = await request(app)
          .get('/api/financial/banking/payments/PAY-123456/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockStatus);
      });

      it('should return 404 when payment not found', async () => {
        mockBankingService.getPaymentStatus.mockResolvedValue(null);

        const response = await request(app)
          .get('/api/financial/banking/payments/NONEXISTENT/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Payment not found');
      });
    });

    describe('POST /api/financial/banking/payments/:instructionId/cancel', () => {
      it('should cancel payment successfully', async () => {
        mockBankingService.cancelPayment.mockResolvedValue(true);

        const response = await request(app)
          .post('/api/financial/banking/payments/PAY-123456/cancel')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Duplicate payment' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.cancelled).toBe(true);
      });
    });

    describe('GET /api/financial/banking/payments/history', () => {
      it('should get payment history successfully', async () => {
        const mockHistory = [
          {
            instructionId: 'PAY-123456',
            status: 'COMPLETED' as const,
            transactionId: 'TXN-789012',
            processedDate: new Date(),
            fees: 25,
            finalAmount: 1000,
            finalCurrency: 'USD'
          }
        ];

        mockBankingService.getPaymentHistory.mockResolvedValue(mockHistory);

        const response = await request(app)
          .get('/api/financial/banking/payments/history')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            currency: 'USD'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockHistory);
      });

      it('should return 400 when dates are missing', async () => {
        const response = await request(app)
          .get('/api/financial/banking/payments/history')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Start date and end date are required');
      });
    });
  });

  describe('Exchange Rate Integration', () => {
    describe('GET /api/financial/exchange-rates/:fromCurrency/:toCurrency', () => {
      it('should get exchange rate successfully', async () => {
        const mockRate = {
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          rate: 0.85,
          timestamp: new Date(),
          provider: 'ExchangeRate-API'
        };

        mockExchangeRateService.getExchangeRate.mockResolvedValue(mockRate);

        const response = await request(app)
          .get('/api/financial/exchange-rates/USD/EUR')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockRate);
        expect(mockExchangeRateService.getExchangeRate).toHaveBeenCalledWith('USD', 'EUR', undefined);
      });
    });

    describe('GET /api/financial/exchange-rates/:baseCurrency/multiple', () => {
      it('should get multiple exchange rates successfully', async () => {
        const mockRates = [
          {
            baseCurrency: 'USD',
            targetCurrency: 'EUR',
            rate: 0.85,
            timestamp: new Date(),
            provider: 'ExchangeRate-API'
          },
          {
            baseCurrency: 'USD',
            targetCurrency: 'GBP',
            rate: 0.75,
            timestamp: new Date(),
            provider: 'ExchangeRate-API'
          }
        ];

        mockExchangeRateService.getMultipleRates.mockResolvedValue(mockRates);

        const response = await request(app)
          .get('/api/financial/exchange-rates/USD/multiple')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ targetCurrencies: 'EUR,GBP' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockRates);
        expect(mockExchangeRateService.getMultipleRates).toHaveBeenCalledWith('USD', ['EUR', 'GBP'], undefined);
      });
    });

    describe('POST /api/financial/exchange-rates/convert', () => {
      it('should convert currency successfully', async () => {
        const mockConversion = {
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          amount: 1000,
          convertedAmount: 850,
          exchangeRate: 0.85,
          timestamp: new Date(),
          provider: 'ExchangeRate-API'
        };

        mockExchangeRateService.convertCurrency.mockResolvedValue(mockConversion);

        const response = await request(app)
          .post('/api/financial/exchange-rates/convert')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 1000,
            fromCurrency: 'USD',
            toCurrency: 'EUR'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockConversion);
      });
    });

    describe('GET /api/financial/exchange-rates/currencies/supported', () => {
      it('should get supported currencies successfully', async () => {
        const mockCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];

        mockExchangeRateService.getSupportedCurrencies.mockReturnValue(mockCurrencies);

        const response = await request(app)
          .get('/api/financial/exchange-rates/currencies/supported')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockCurrencies);
      });
    });
  });

  describe('Payment Gateway Integration', () => {
    describe('POST /api/financial/payment-gateways/payments', () => {
      it('should process gateway payment successfully', async () => {
        const mockResponse = {
          requestId: 'REQ-123456',
          transactionId: 'TXN-789012',
          status: 'COMPLETED' as const,
          amount: 1000,
          currency: 'USD',
          fees: 30,
          netAmount: 970,
          gatewayResponse: {},
          processingTime: new Date(),
          authorizationCode: 'AUTH-123'
        };

        mockPaymentGatewayService.processPayment.mockResolvedValue(mockResponse);

        const paymentRequest = {
          requestId: 'REQ-123456',
          amount: 1000,
          currency: 'USD',
          paymentMethod: {
            type: 'CREDIT_CARD',
            cardDetails: {
              cardNumber: '4111111111111111',
              expiryMonth: 12,
              expiryYear: 2025,
              cvv: '123',
              cardholderName: 'John Doe',
              billingAddress: {
                street: '123 Main St',
                city: 'New York',
                state: 'NY',
                postalCode: '10001',
                country: 'US'
              }
            }
          },
          merchant: {
            merchantId: 'MERCHANT-123',
            name: 'FlowMarine',
            category: 'Maritime Services'
          },
          customer: {
            email: 'customer@example.com',
            name: 'John Doe'
          },
          description: 'Invoice payment',
          reference: 'INV-001'
        };

        const response = await request(app)
          .post('/api/financial/payment-gateways/payments')
          .set('Authorization', `Bearer ${authToken}`)
          .send(paymentRequest);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResponse);
      });
    });

    describe('POST /api/financial/payment-gateways/validate-payment-method', () => {
      it('should validate payment method successfully', async () => {
        const mockValidation = {
          isValid: true,
          errors: [],
          riskScore: 10
        };

        mockPaymentGatewayService.validatePaymentMethod.mockResolvedValue(mockValidation);

        const paymentMethod = {
          type: 'CREDIT_CARD',
          cardDetails: {
            cardNumber: '4111111111111111',
            expiryMonth: 12,
            expiryYear: 2025,
            cvv: '123',
            cardholderName: 'John Doe',
            billingAddress: {
              street: '123 Main St',
              city: 'New York',
              state: 'NY',
              postalCode: '10001',
              country: 'US'
            }
          }
        };

        const response = await request(app)
          .post('/api/financial/payment-gateways/validate-payment-method')
          .set('Authorization', `Bearer ${authToken}`)
          .send(paymentMethod);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockValidation);
      });
    });

    describe('GET /api/financial/payment-gateways/available', () => {
      it('should get available gateways successfully', async () => {
        const mockGateways = [
          {
            gatewayId: 'stripe',
            name: 'Stripe',
            type: 'CREDIT_CARD',
            supportedCurrencies: ['USD', 'EUR', 'GBP'],
            maxTransactionAmount: 999999,
            processingFees: {
              fixedFee: 0.30,
              percentageFee: 2.9,
              currency: 'USD'
            }
          }
        ];

        mockPaymentGatewayService.getAvailableGateways.mockReturnValue(mockGateways);

        const response = await request(app)
          .get('/api/financial/payment-gateways/available')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            amount: '1000',
            currency: 'USD',
            country: 'US',
            paymentType: 'CREDIT_CARD'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockGateways);
      });
    });
  });

  describe('Accounting Integration', () => {
    describe('POST /api/financial/accounting/:systemId/chart-of-accounts/sync', () => {
      it('should sync chart of accounts successfully', async () => {
        const mockAccounts = [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'ASSET' as const,
            isActive: true,
            costCenterRequired: false
          },
          {
            accountCode: '2000',
            accountName: 'Accounts Payable',
            accountType: 'LIABILITY' as const,
            isActive: true,
            costCenterRequired: true
          }
        ];

        mockAccountingService.syncChartOfAccounts.mockResolvedValue(mockAccounts);

        const response = await request(app)
          .post('/api/financial/accounting/quickbooks/chart-of-accounts/sync')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockAccounts);
        expect(mockAccountingService.syncChartOfAccounts).toHaveBeenCalledWith('quickbooks');
      });
    });

    describe('POST /api/financial/accounting/:systemId/cost-centers/sync', () => {
      it('should sync cost centers successfully', async () => {
        const mockCostCenters = [
          {
            costCenterCode: 'VESSEL-001',
            name: 'MV Atlantic',
            description: 'Container vessel',
            isActive: true,
            vesselId: 'vessel-001'
          }
        ];

        mockAccountingService.syncCostCenters.mockResolvedValue(mockCostCenters);

        const response = await request(app)
          .post('/api/financial/accounting/quickbooks/cost-centers/sync')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockCostCenters);
      });
    });

    describe('POST /api/financial/accounting/:systemId/journal-entries', () => {
      it('should post journal entry successfully', async () => {
        const mockResult = {
          success: true,
          entryId: 'JE-123456',
          systemReference: 'QB-789012'
        };

        mockAccountingService.postJournalEntry.mockResolvedValue(mockResult);

        const journalEntry = {
          entryId: 'JE-123456',
          entryDate: new Date(),
          reference: 'INV-001',
          description: 'Invoice payment',
          totalDebit: 1000,
          totalCredit: 1000,
          currency: 'USD',
          lineItems: [
            {
              lineNumber: 1,
              accountCode: '5000',
              description: 'Office supplies',
              debitAmount: 1000,
              creditAmount: 0,
              costCenter: 'VESSEL-001'
            },
            {
              lineNumber: 2,
              accountCode: '2000',
              description: 'Accounts payable',
              debitAmount: 0,
              creditAmount: 1000,
              costCenter: 'VESSEL-001'
            }
          ],
          source: 'FlowMarine',
          status: 'DRAFT' as const,
          createdBy: 'system'
        };

        const response = await request(app)
          .post('/api/financial/accounting/quickbooks/journal-entries')
          .set('Authorization', `Bearer ${authToken}`)
          .send(journalEntry);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });

    describe('GET /api/financial/accounting/:systemId/trial-balance', () => {
      it('should get trial balance successfully', async () => {
        const mockTrialBalance = [
          {
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'ASSET',
            debitBalance: 10000,
            creditBalance: 0,
            netBalance: 10000,
            currency: 'USD',
            asOfDate: new Date('2024-01-31')
          }
        ];

        mockAccountingService.getTrialBalance.mockResolvedValue(mockTrialBalance);

        const response = await request(app)
          .get('/api/financial/accounting/quickbooks/trial-balance')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ asOfDate: '2024-01-31' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockTrialBalance);
      });
    });

    describe('GET /api/financial/accounting/:systemId/reports/financial', () => {
      it('should generate financial report successfully', async () => {
        const mockReport = {
          reportType: 'BALANCE_SHEET' as const,
          reportPeriod: {
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31')
          },
          currency: 'USD',
          data: { /* report data */ },
          generatedDate: new Date(),
          parameters: {}
        };

        mockAccountingService.generateFinancialReport.mockResolvedValue(mockReport);

        const response = await request(app)
          .get('/api/financial/accounting/quickbooks/reports/financial')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            reportType: 'BALANCE_SHEET',
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockReport);
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', async () => {
      const response = await request(app)
        .get('/api/financial/exchange-rates/USD/EUR');

      expect(response.status).toBe(401);
    });

    it('should require proper role for sensitive operations', async () => {
      // This would require a token with insufficient permissions
      const response = await request(app)
        .post('/api/financial/banking/payments')
        .set('Authorization', `Bearer invalid-token`)
        .send({});

      expect(response.status).toBe(401);
    });
  });
});

describe('Financial Integration Services Unit Tests', () => {
  describe('Exchange Rate Integration Service', () => {
    it('should return rate of 1 for same currency conversion', async () => {
      const rate = await exchangeRateIntegrationService.getExchangeRate('USD', 'USD');
      
      expect(rate.baseCurrency).toBe('USD');
      expect(rate.targetCurrency).toBe('USD');
      expect(rate.rate).toBe(1);
      expect(rate.provider).toBe('internal');
    });
  });

  describe('Payment Gateway Integration Service', () => {
    it('should validate card number using Luhn algorithm', async () => {
      const validCard = {
        type: 'CREDIT_CARD' as const,
        cardDetails: {
          cardNumber: '4111111111111111', // Valid test card
          expiryMonth: 12,
          expiryYear: 2025,
          cvv: '123',
          cardholderName: 'John Doe',
          billingAddress: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US'
          }
        }
      };

      const validation = await paymentGatewayIntegrationService.validatePaymentMethod(validCard);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid card number', async () => {
      const invalidCard = {
        type: 'CREDIT_CARD' as const,
        cardDetails: {
          cardNumber: '1234567890123456', // Invalid card
          expiryMonth: 12,
          expiryYear: 2025,
          cvv: '123',
          cardholderName: 'John Doe',
          billingAddress: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US'
          }
        }
      };

      const validation = await paymentGatewayIntegrationService.validatePaymentMethod(invalidCard);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid card number');
    });
  });
});