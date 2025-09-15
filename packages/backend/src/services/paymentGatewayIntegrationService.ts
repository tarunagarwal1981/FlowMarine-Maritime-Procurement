import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { fieldEncryptionService } from './fieldEncryptionService';

export interface PaymentGateway {
  gatewayId: string;
  name: string;
  type: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'DIGITAL_WALLET' | 'CRYPTOCURRENCY';
  apiEndpoint: string;
  authMethod: 'API_KEY' | 'OAUTH' | 'SIGNATURE';
  supportedCurrencies: string[];
  supportedCountries: string[];
  processingFees: GatewayFees;
  settlementTime: string;
  maxTransactionAmount: number;
  features: string[];
}

export interface GatewayFees {
  fixedFee: number;
  percentageFee: number;
  currency: string;
  internationalFee?: number;
  chargebackFee?: number;
}

export interface PaymentRequest {
  requestId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  merchant: MerchantInfo;
  customer: CustomerInfo;
  description: string;
  reference: string;
  callbackUrl?: string;
  returnUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentMethod {
  type: 'CREDIT_CARD' | 'BANK_ACCOUNT' | 'DIGITAL_WALLET' | 'CRYPTOCURRENCY';
  cardDetails?: CardDetails;
  bankDetails?: BankAccountDetails;
  walletDetails?: WalletDetails;
  cryptoDetails?: CryptocurrencyDetails;
}

export interface CardDetails {
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  cardholderName: string;
  billingAddress: Address;
}

export interface BankAccountDetails {
  accountNumber: string;
  routingNumber: string;
  accountType: 'CHECKING' | 'SAVINGS';
  bankName: string;
  accountHolderName: string;
}

export interface WalletDetails {
  walletType: 'PAYPAL' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'ALIPAY' | 'WECHAT_PAY';
  walletId: string;
  email?: string;
}

export interface CryptocurrencyDetails {
  currency: 'BTC' | 'ETH' | 'USDC' | 'USDT';
  walletAddress: string;
  network?: string;
}

export interface MerchantInfo {
  merchantId: string;
  name: string;
  category: string;
  website?: string;
  supportEmail?: string;
}

export interface CustomerInfo {
  customerId?: string;
  email: string;
  phone?: string;
  name: string;
  billingAddress?: Address;
  shippingAddress?: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaymentResponse {
  requestId: string;
  transactionId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  amount: number;
  currency: string;
  fees: number;
  netAmount: number;
  gatewayResponse: any;
  processingTime?: Date;
  settlementDate?: Date;
  failureReason?: string;
  riskScore?: number;
  authorizationCode?: string;
}

export interface RefundRequest {
  originalTransactionId: string;
  amount?: number; // Partial refund if specified
  reason: string;
  reference: string;
}

export interface RefundResponse {
  refundId: string;
  originalTransactionId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  processedDate?: Date;
  failureReason?: string;
}

class PaymentGatewayIntegrationService {
  private gateways: Map<string, PaymentGateway>;
  private cache: Map<string, { data: any; expiry: number }>;

  constructor() {
    this.gateways = new Map();
    this.cache = new Map();
    this.initializeGateways();
  }

  /**
   * Register a payment gateway
   */
  registerGateway(gateway: PaymentGateway): void {
    this.gateways.set(gateway.gatewayId, gateway);
    logger.info(`Registered payment gateway: ${gateway.name}`);
  }

  /**
   * Get available gateways for a payment request
   */
  getAvailableGateways(
    amount: number,
    currency: string,
    country: string,
    paymentType: string
  ): PaymentGateway[] {
    return Array.from(this.gateways.values()).filter(gateway =>
      gateway.supportedCurrencies.includes(currency) &&
      gateway.supportedCountries.includes(country) &&
      amount <= gateway.maxTransactionAmount &&
      (paymentType === 'ANY' || gateway.type === paymentType)
    );
  }

  /**
   * Process payment through gateway
   */
  async processPayment(request: PaymentRequest, gatewayId?: string): Promise<PaymentResponse> {
    try {
      let gateway: PaymentGateway;

      if (gatewayId) {
        gateway = this.gateways.get(gatewayId);
        if (!gateway) {
          throw new AppError('Payment gateway not found', 404, 'GATEWAY_NOT_FOUND');
        }
      } else {
        const availableGateways = this.getAvailableGateways(
          request.amount,
          request.currency,
          request.customer.billingAddress?.country || 'US',
          request.paymentMethod.type
        );

        if (availableGateways.length === 0) {
          throw new AppError('No suitable payment gateway available', 400, 'NO_GATEWAY_AVAILABLE');
        }

        gateway = this.selectBestGateway(availableGateways, request);
      }

      // Validate payment request
      await this.validatePaymentRequest(request, gateway);

      // Process payment with selected gateway
      const response = await this.executePayment(gateway, request);

      // Log payment for audit
      logger.info(`Payment processed: ${request.requestId}`, {
        gateway: gateway.name,
        amount: request.amount,
        currency: request.currency,
        status: response.status
      });

      return response;
    } catch (error) {
      logger.error('Error processing payment:', error);
      throw new AppError('Failed to process payment', 500, 'PAYMENT_PROCESSING_ERROR');
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string, gatewayId?: string): Promise<PaymentResponse | null> {
    try {
      const cacheKey = `payment_status_${transactionId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      let status: PaymentResponse | null = null;

      if (gatewayId) {
        const gateway = this.gateways.get(gatewayId);
        if (gateway) {
          status = await this.fetchPaymentStatus(gateway, transactionId);
        }
      } else {
        // Try all gateways until we find the transaction
        for (const gateway of this.gateways.values()) {
          try {
            status = await this.fetchPaymentStatus(gateway, transactionId);
            if (status) break;
          } catch (error) {
            continue;
          }
        }
      }

      if (status) {
        this.setCache(cacheKey, status, 60000); // Cache for 1 minute
      }

      return status;
    } catch (error) {
      logger.error('Error getting payment status:', error);
      throw new AppError('Failed to get payment status', 500, 'PAYMENT_STATUS_ERROR');
    }
  }

  /**
   * Process refund
   */
  async processRefund(refundRequest: RefundRequest, gatewayId?: string): Promise<RefundResponse> {
    try {
      // First get the original transaction to determine the gateway
      const originalTransaction = await this.getPaymentStatus(refundRequest.originalTransactionId, gatewayId);
      if (!originalTransaction) {
        throw new AppError('Original transaction not found', 404, 'TRANSACTION_NOT_FOUND');
      }

      if (originalTransaction.status !== 'COMPLETED') {
        throw new AppError('Cannot refund non-completed transaction', 400, 'INVALID_TRANSACTION_STATUS');
      }

      let gateway: PaymentGateway;
      if (gatewayId) {
        gateway = this.gateways.get(gatewayId);
        if (!gateway) {
          throw new AppError('Payment gateway not found', 404, 'GATEWAY_NOT_FOUND');
        }
      } else {
        // Try to determine gateway from transaction data
        gateway = Array.from(this.gateways.values())[0]; // Fallback to first gateway
      }

      const refundResponse = await this.executeRefund(gateway, refundRequest, originalTransaction);

      logger.info(`Refund processed: ${refundResponse.refundId}`, {
        gateway: gateway.name,
        originalTransaction: refundRequest.originalTransactionId,
        amount: refundResponse.amount,
        status: refundResponse.status
      });

      return refundResponse;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw new AppError('Failed to process refund', 500, 'REFUND_PROCESSING_ERROR');
    }
  }

  /**
   * Validate payment method
   */
  async validatePaymentMethod(paymentMethod: PaymentMethod): Promise<{
    isValid: boolean;
    errors: string[];
    riskScore: number;
  }> {
    const errors: string[] = [];
    let riskScore = 0;

    try {
      switch (paymentMethod.type) {
        case 'CREDIT_CARD':
          if (!paymentMethod.cardDetails) {
            errors.push('Card details are required');
            break;
          }

          // Validate card number (basic Luhn algorithm check)
          if (!this.validateCardNumber(paymentMethod.cardDetails.cardNumber)) {
            errors.push('Invalid card number');
            riskScore += 50;
          }

          // Validate expiry date
          const now = new Date();
          const expiryDate = new Date(paymentMethod.cardDetails.expiryYear, paymentMethod.cardDetails.expiryMonth - 1);
          if (expiryDate < now) {
            errors.push('Card has expired');
            riskScore += 100;
          }

          // Validate CVV
          if (!paymentMethod.cardDetails.cvv || paymentMethod.cardDetails.cvv.length < 3) {
            errors.push('Invalid CVV');
            riskScore += 30;
          }

          break;

        case 'BANK_ACCOUNT':
          if (!paymentMethod.bankDetails) {
            errors.push('Bank account details are required');
            break;
          }

          if (!paymentMethod.bankDetails.accountNumber) {
            errors.push('Account number is required');
          }

          if (!paymentMethod.bankDetails.routingNumber) {
            errors.push('Routing number is required');
          }

          break;

        case 'DIGITAL_WALLET':
          if (!paymentMethod.walletDetails) {
            errors.push('Wallet details are required');
            break;
          }

          if (!paymentMethod.walletDetails.walletId) {
            errors.push('Wallet ID is required');
          }

          break;

        case 'CRYPTOCURRENCY':
          if (!paymentMethod.cryptoDetails) {
            errors.push('Cryptocurrency details are required');
            break;
          }

          if (!paymentMethod.cryptoDetails.walletAddress) {
            errors.push('Wallet address is required');
          }

          // Crypto payments have higher risk
          riskScore += 20;
          break;
      }

      return {
        isValid: errors.length === 0,
        errors,
        riskScore: Math.min(riskScore, 100)
      };
    } catch (error) {
      logger.error('Error validating payment method:', error);
      return {
        isValid: false,
        errors: ['Validation failed'],
        riskScore: 100
      };
    }
  }

  /**
   * Get gateway fees estimate
   */
  calculateFees(gateway: PaymentGateway, amount: number, currency: string, isInternational: boolean = false): number {
    let fees = gateway.processingFees.fixedFee;
    fees += (amount * gateway.processingFees.percentageFee) / 100;

    if (isInternational && gateway.processingFees.internationalFee) {
      fees += gateway.processingFees.internationalFee;
    }

    return Math.round(fees * 100) / 100; // Round to 2 decimal places
  }

  private initializeGateways(): void {
    const defaultGateways: PaymentGateway[] = [
      {
        gatewayId: 'stripe',
        name: 'Stripe',
        type: 'CREDIT_CARD',
        apiEndpoint: 'https://api.stripe.com/v1',
        authMethod: 'API_KEY',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SEK', 'NOK', 'DKK'],
        supportedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'LU', 'GR', 'CY', 'MT', 'SI', 'SK', 'EE', 'LV', 'LT', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'JP', 'SG', 'HK', 'MY', 'TH', 'PH', 'ID', 'IN', 'BR', 'MX'],
        processingFees: {
          fixedFee: 0.30,
          percentageFee: 2.9,
          currency: 'USD',
          internationalFee: 1.5,
          chargebackFee: 15
        },
        settlementTime: '2-7 business days',
        maxTransactionAmount: 999999,
        features: ['3D_SECURE', 'RECURRING', 'MARKETPLACE', 'MOBILE_PAYMENTS']
      },
      {
        gatewayId: 'paypal',
        name: 'PayPal',
        type: 'DIGITAL_WALLET',
        apiEndpoint: 'https://api.paypal.com/v2',
        authMethod: 'OAUTH',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'ILS', 'MXN', 'BRL', 'TWD', 'THB', 'SGD', 'HKD', 'NZD', 'PHP', 'MYR', 'INR', 'RUB'],
        supportedCountries: ['*'], // Global coverage
        processingFees: {
          fixedFee: 0.49,
          percentageFee: 3.49,
          currency: 'USD',
          internationalFee: 4.99,
          chargebackFee: 20
        },
        settlementTime: '1-3 business days',
        maxTransactionAmount: 60000,
        features: ['BUYER_PROTECTION', 'RECURRING', 'MOBILE_PAYMENTS', 'INVOICING']
      },
      {
        gatewayId: 'square',
        name: 'Square',
        type: 'CREDIT_CARD',
        apiEndpoint: 'https://connect.squareup.com/v2',
        authMethod: 'API_KEY',
        supportedCurrencies: ['USD', 'CAD', 'GBP', 'AUD', 'JPY'],
        supportedCountries: ['US', 'CA', 'GB', 'AU', 'JP'],
        processingFees: {
          fixedFee: 0.10,
          percentageFee: 2.6,
          currency: 'USD',
          internationalFee: 3.5,
          chargebackFee: 15
        },
        settlementTime: '1-2 business days',
        maxTransactionAmount: 50000,
        features: ['IN_PERSON', 'ONLINE', 'RECURRING', 'INVOICING']
      }
    ];

    defaultGateways.forEach(gateway => this.registerGateway(gateway));
  }

  private selectBestGateway(gateways: PaymentGateway[], request: PaymentRequest): PaymentGateway {
    // Score gateways based on fees, features, and reliability
    let bestGateway = gateways[0];
    let bestScore = 0;

    for (const gateway of gateways) {
      let score = 0;

      // Lower fees = higher score
      const fees = this.calculateFees(gateway, request.amount, request.currency);
      score += Math.max(0, 100 - (fees / request.amount) * 1000);

      // Faster settlement = higher score
      if (gateway.settlementTime.includes('1')) score += 30;
      else if (gateway.settlementTime.includes('2')) score += 20;

      // More features = higher score
      score += gateway.features.length * 5;

      // Prefer certain gateways for specific payment types
      if (request.paymentMethod.type === 'DIGITAL_WALLET' && gateway.type === 'DIGITAL_WALLET') {
        score += 50;
      }

      if (score > bestScore) {
        bestScore = score;
        bestGateway = gateway;
      }
    }

    return bestGateway;
  }

  private async validatePaymentRequest(request: PaymentRequest, gateway: PaymentGateway): Promise<void> {
    const errors: string[] = [];

    // Validate amount
    if (request.amount <= 0) {
      errors.push('Invalid payment amount');
    }

    if (request.amount > gateway.maxTransactionAmount) {
      errors.push(`Amount exceeds gateway limit of ${gateway.maxTransactionAmount}`);
    }

    // Validate currency
    if (!gateway.supportedCurrencies.includes(request.currency)) {
      errors.push(`Currency ${request.currency} not supported by gateway`);
    }

    // Validate payment method
    const methodValidation = await this.validatePaymentMethod(request.paymentMethod);
    if (!methodValidation.isValid) {
      errors.push(...methodValidation.errors);
    }

    if (errors.length > 0) {
      throw new AppError(`Payment validation failed: ${errors.join(', ')}`, 400, 'PAYMENT_VALIDATION_FAILED');
    }
  }

  private async executePayment(gateway: PaymentGateway, request: PaymentRequest): Promise<PaymentResponse> {
    const headers = this.buildHeaders(gateway);
    
    // Encrypt sensitive payment data
    const encryptedRequest = await this.encryptPaymentData(request);
    
    const response = await fetch(`${gateway.apiEndpoint}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(encryptedRequest)
    });

    if (!response.ok) {
      throw new AppError(`Payment gateway error: ${response.statusText}`, response.status, 'GATEWAY_API_ERROR');
    }

    const data = await response.json();
    
    return this.mapPaymentResponse(data, request, gateway);
  }

  private async fetchPaymentStatus(gateway: PaymentGateway, transactionId: string): Promise<PaymentResponse | null> {
    const headers = this.buildHeaders(gateway);
    
    const response = await fetch(`${gateway.apiEndpoint}/payments/${transactionId}`, {
      headers
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new AppError(`Status fetch failed: ${response.statusText}`, response.status, 'STATUS_API_ERROR');
    }

    const data = await response.json();
    
    return this.mapPaymentResponse(data, null, gateway);
  }

  private async executeRefund(
    gateway: PaymentGateway,
    refundRequest: RefundRequest,
    originalTransaction: PaymentResponse
  ): Promise<RefundResponse> {
    const headers = this.buildHeaders(gateway);
    
    const refundData = {
      transaction_id: refundRequest.originalTransactionId,
      amount: refundRequest.amount || originalTransaction.amount,
      reason: refundRequest.reason,
      reference: refundRequest.reference
    };

    const response = await fetch(`${gateway.apiEndpoint}/refunds`, {
      method: 'POST',
      headers,
      body: JSON.stringify(refundData)
    });

    if (!response.ok) {
      throw new AppError(`Refund failed: ${response.statusText}`, response.status, 'REFUND_API_ERROR');
    }

    const data = await response.json();
    
    return {
      refundId: data.refund_id || data.id,
      originalTransactionId: refundRequest.originalTransactionId,
      amount: data.amount,
      currency: data.currency,
      status: data.status === 'succeeded' ? 'COMPLETED' : 'PENDING',
      processedDate: data.created ? new Date(data.created * 1000) : undefined,
      failureReason: data.failure_reason
    };
  }

  private validateCardNumber(cardNumber: string): boolean {
    // Basic Luhn algorithm implementation
    const digits = cardNumber.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  private async encryptPaymentData(request: PaymentRequest): Promise<any> {
    const encryptedRequest = { ...request };

    if (request.paymentMethod.cardDetails) {
      encryptedRequest.paymentMethod = {
        ...request.paymentMethod,
        cardDetails: {
          ...request.paymentMethod.cardDetails,
          cardNumber: await fieldEncryptionService.encrypt(request.paymentMethod.cardDetails.cardNumber),
          cvv: await fieldEncryptionService.encrypt(request.paymentMethod.cardDetails.cvv)
        }
      };
    }

    if (request.paymentMethod.bankDetails) {
      encryptedRequest.paymentMethod = {
        ...request.paymentMethod,
        bankDetails: {
          ...request.paymentMethod.bankDetails,
          accountNumber: await fieldEncryptionService.encrypt(request.paymentMethod.bankDetails.accountNumber),
          routingNumber: await fieldEncryptionService.encrypt(request.paymentMethod.bankDetails.routingNumber)
        }
      };
    }

    return encryptedRequest;
  }

  private mapPaymentResponse(data: any, request: PaymentRequest | null, gateway: PaymentGateway): PaymentResponse {
    return {
      requestId: request?.requestId || data.request_id,
      transactionId: data.id || data.transaction_id,
      status: this.mapStatus(data.status),
      amount: data.amount || request?.amount || 0,
      currency: data.currency || request?.currency || 'USD',
      fees: data.fees || this.calculateFees(gateway, data.amount || 0, data.currency || 'USD'),
      netAmount: (data.amount || 0) - (data.fees || 0),
      gatewayResponse: data,
      processingTime: data.created ? new Date(data.created * 1000) : undefined,
      settlementDate: data.settlement_date ? new Date(data.settlement_date) : undefined,
      failureReason: data.failure_reason || data.decline_reason,
      riskScore: data.risk_score,
      authorizationCode: data.authorization_code
    };
  }

  private mapStatus(gatewayStatus: string): PaymentResponse['status'] {
    const statusMap: Record<string, PaymentResponse['status']> = {
      'pending': 'PENDING',
      'processing': 'PROCESSING',
      'succeeded': 'COMPLETED',
      'completed': 'COMPLETED',
      'failed': 'FAILED',
      'declined': 'FAILED',
      'canceled': 'CANCELLED',
      'cancelled': 'CANCELLED',
      'refunded': 'REFUNDED'
    };

    return statusMap[gatewayStatus.toLowerCase()] || 'PENDING';
  }

  private buildHeaders(gateway: PaymentGateway): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    switch (gateway.authMethod) {
      case 'API_KEY':
        headers['Authorization'] = `Bearer ${process.env[`${gateway.gatewayId.toUpperCase()}_API_KEY`]}`;
        break;
      case 'OAUTH':
        headers['Authorization'] = `Bearer ${process.env[`${gateway.gatewayId.toUpperCase()}_ACCESS_TOKEN`]}`;
        break;
      case 'SIGNATURE':
        // Signature-based auth would require additional implementation
        headers['X-Signature'] = this.generateSignature(gateway);
        break;
    }

    return headers;
  }

  private generateSignature(gateway: PaymentGateway): string {
    // This would implement the specific signature generation for the gateway
    // For now, return a placeholder
    return process.env[`${gateway.gatewayId.toUpperCase()}_SIGNATURE`] || '';
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }
}

export const paymentGatewayIntegrationService = new PaymentGatewayIntegrationService();