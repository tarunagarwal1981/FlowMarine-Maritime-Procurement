import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { fieldEncryptionService } from './fieldEncryptionService';

export interface BankingProvider {
  providerId: string;
  name: string;
  type: 'SWIFT' | 'ACH' | 'WIRE' | 'SEPA' | 'LOCAL';
  apiEndpoint: string;
  authMethod: 'API_KEY' | 'OAUTH' | 'CERTIFICATE';
  supportedCurrencies: string[];
  supportedCountries: string[];
  maxTransactionAmount: number;
  dailyLimit: number;
  processingTime: string;
  fees: BankingFees;
}

export interface BankingFees {
  fixedFee: number;
  percentageFee: number;
  currency: string;
  minimumFee: number;
  maximumFee: number;
}

export interface PaymentInstruction {
  instructionId: string;
  paymentMethod: 'SWIFT' | 'ACH' | 'WIRE' | 'SEPA' | 'LOCAL';
  amount: number;
  currency: string;
  beneficiary: BeneficiaryDetails;
  remitter: RemitterDetails;
  purpose: string;
  urgency: 'STANDARD' | 'URGENT' | 'SAME_DAY';
  scheduledDate?: Date;
  reference: string;
  invoiceReference?: string;
}

export interface BeneficiaryDetails {
  name: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  bankAddress: string;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  country: string;
}

export interface RemitterDetails {
  name: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  country: string;
}

export interface PaymentStatus {
  instructionId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  transactionId?: string;
  bankReference?: string;
  processedDate?: Date;
  failureReason?: string;
  fees: number;
  exchangeRate?: number;
  finalAmount?: number;
  finalCurrency?: string;
}

export interface PaymentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedFees: number;
  estimatedProcessingTime: string;
  requiredDocuments: string[];
}

class BankingIntegrationService {
  private providers: Map<string, BankingProvider>;
  private cache: Map<string, { data: any; expiry: number }>;

  constructor() {
    this.providers = new Map();
    this.cache = new Map();
    this.initializeProviders();
  }

  /**
   * Register a banking provider
   */
  registerProvider(provider: BankingProvider): void {
    this.providers.set(provider.providerId, provider);
    logger.info(`Registered banking provider: ${provider.name}`);
  }

  /**
   * Get available banking providers for a currency and country
   */
  getAvailableProviders(currency: string, country: string, amount: number): BankingProvider[] {
    return Array.from(this.providers.values()).filter(provider => 
      provider.supportedCurrencies.includes(currency) &&
      provider.supportedCountries.includes(country) &&
      amount <= provider.maxTransactionAmount
    );
  }

  /**
   * Validate payment instruction
   */
  async validatePayment(instruction: PaymentInstruction): Promise<PaymentValidation> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Basic validation
      if (!instruction.amount || instruction.amount <= 0) {
        errors.push('Invalid payment amount');
      }

      if (!instruction.currency || instruction.currency.length !== 3) {
        errors.push('Invalid currency code');
      }

      if (!instruction.beneficiary.accountNumber) {
        errors.push('Beneficiary account number is required');
      }

      if (!instruction.beneficiary.bankCode && !instruction.beneficiary.swiftCode) {
        errors.push('Bank code or SWIFT code is required');
      }

      // Get available providers
      const providers = this.getAvailableProviders(
        instruction.currency,
        instruction.beneficiary.country,
        instruction.amount
      );

      if (providers.length === 0) {
        errors.push('No banking provider available for this payment');
      }

      // Estimate fees and processing time
      let estimatedFees = 0;
      let estimatedProcessingTime = 'Unknown';
      const requiredDocuments: string[] = [];

      if (providers.length > 0) {
        const bestProvider = this.selectBestProvider(providers, instruction);
        estimatedFees = this.calculateFees(bestProvider, instruction.amount);
        estimatedProcessingTime = bestProvider.processingTime;

        // Add required documents based on amount and destination
        if (instruction.amount > 10000) {
          requiredDocuments.push('Commercial Invoice');
          requiredDocuments.push('Purchase Order');
        }

        if (instruction.beneficiary.country !== instruction.remitter.country) {
          requiredDocuments.push('Foreign Exchange Declaration');
        }

        // Add warnings for high-risk transactions
        if (instruction.amount > 50000) {
          warnings.push('High-value transaction may require additional verification');
        }

        if (instruction.urgency === 'SAME_DAY') {
          warnings.push('Same-day processing may incur additional fees');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        estimatedFees,
        estimatedProcessingTime,
        requiredDocuments
      };
    } catch (error) {
      logger.error('Error validating payment:', error);
      throw new AppError('Failed to validate payment', 500, 'PAYMENT_VALIDATION_ERROR');
    }
  }

  /**
   * Process payment instruction
   */
  async processPayment(instruction: PaymentInstruction): Promise<PaymentStatus> {
    try {
      // Validate payment first
      const validation = await this.validatePayment(instruction);
      if (!validation.isValid) {
        throw new AppError(`Payment validation failed: ${validation.errors.join(', ')}`, 400, 'PAYMENT_VALIDATION_FAILED');
      }

      // Select best provider
      const providers = this.getAvailableProviders(
        instruction.currency,
        instruction.beneficiary.country,
        instruction.amount
      );

      const provider = this.selectBestProvider(providers, instruction);
      
      // Process payment with selected provider
      const paymentStatus = await this.executePayment(provider, instruction);

      // Log payment for audit
      logger.info(`Payment processed: ${instruction.instructionId}`, {
        provider: provider.name,
        amount: instruction.amount,
        currency: instruction.currency,
        beneficiary: instruction.beneficiary.name,
        status: paymentStatus.status
      });

      return paymentStatus;
    } catch (error) {
      logger.error('Error processing payment:', error);
      throw new AppError('Failed to process payment', 500, 'PAYMENT_PROCESSING_ERROR');
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(instructionId: string, providerId?: string): Promise<PaymentStatus | null> {
    try {
      const cacheKey = `payment_status_${instructionId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      let status: PaymentStatus | null = null;

      if (providerId) {
        const provider = this.providers.get(providerId);
        if (provider) {
          status = await this.fetchPaymentStatus(provider, instructionId);
        }
      } else {
        // Try all providers until we find the payment
        for (const provider of this.providers.values()) {
          try {
            status = await this.fetchPaymentStatus(provider, instructionId);
            if (status) break;
          } catch (error) {
            // Continue to next provider
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
   * Cancel payment instruction
   */
  async cancelPayment(instructionId: string, reason: string): Promise<boolean> {
    try {
      const status = await this.getPaymentStatus(instructionId);
      if (!status) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      if (status.status === 'COMPLETED') {
        throw new AppError('Cannot cancel completed payment', 400, 'PAYMENT_ALREADY_COMPLETED');
      }

      if (status.status === 'PROCESSING') {
        throw new AppError('Cannot cancel payment in processing', 400, 'PAYMENT_IN_PROCESSING');
      }

      // Find provider and cancel payment
      for (const provider of this.providers.values()) {
        try {
          const cancelled = await this.cancelPaymentWithProvider(provider, instructionId, reason);
          if (cancelled) {
            logger.info(`Payment cancelled: ${instructionId}`, { reason, provider: provider.name });
            return true;
          }
        } catch (error) {
          continue;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error cancelling payment:', error);
      throw new AppError('Failed to cancel payment', 500, 'PAYMENT_CANCELLATION_ERROR');
    }
  }

  /**
   * Get payment history for a date range
   */
  async getPaymentHistory(
    startDate: Date,
    endDate: Date,
    currency?: string,
    status?: string
  ): Promise<PaymentStatus[]> {
    try {
      const allPayments: PaymentStatus[] = [];

      for (const provider of this.providers.values()) {
        try {
          const payments = await this.fetchPaymentHistory(provider, startDate, endDate, currency, status);
          allPayments.push(...payments);
        } catch (error) {
          logger.warn(`Failed to fetch payment history from ${provider.name}:`, error);
          continue;
        }
      }

      // Sort by processed date
      return allPayments.sort((a, b) => {
        const dateA = a.processedDate || new Date(0);
        const dateB = b.processedDate || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      logger.error('Error getting payment history:', error);
      throw new AppError('Failed to get payment history', 500, 'PAYMENT_HISTORY_ERROR');
    }
  }

  /**
   * Get account balance from banking provider
   */
  async getAccountBalance(providerId: string, accountNumber: string): Promise<{
    balance: number;
    currency: string;
    availableBalance: number;
    lastUpdated: Date;
  }> {
    try {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new AppError('Banking provider not found', 404, 'PROVIDER_NOT_FOUND');
      }

      const cacheKey = `balance_${providerId}_${accountNumber}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const balance = await this.fetchAccountBalance(provider, accountNumber);
      this.setCache(cacheKey, balance, 300000); // Cache for 5 minutes

      return balance;
    } catch (error) {
      logger.error('Error getting account balance:', error);
      throw new AppError('Failed to get account balance', 500, 'BALANCE_FETCH_ERROR');
    }
  }

  private initializeProviders(): void {
    // Initialize default banking providers
    const defaultProviders: BankingProvider[] = [
      {
        providerId: 'swift_global',
        name: 'SWIFT Global Payments',
        type: 'SWIFT',
        apiEndpoint: process.env.SWIFT_API_URL || 'https://api.swift.com/v1',
        authMethod: 'CERTIFICATE',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SEK', 'NOK', 'DKK'],
        supportedCountries: ['*'], // Global coverage
        maxTransactionAmount: 10000000,
        dailyLimit: 50000000,
        processingTime: '1-3 business days',
        fees: {
          fixedFee: 25,
          percentageFee: 0.1,
          currency: 'USD',
          minimumFee: 25,
          maximumFee: 500
        }
      },
      {
        providerId: 'ach_us',
        name: 'ACH US Domestic',
        type: 'ACH',
        apiEndpoint: process.env.ACH_API_URL || 'https://api.achpayments.com/v1',
        authMethod: 'API_KEY',
        supportedCurrencies: ['USD'],
        supportedCountries: ['US'],
        maxTransactionAmount: 1000000,
        dailyLimit: 5000000,
        processingTime: '1-2 business days',
        fees: {
          fixedFee: 5,
          percentageFee: 0.05,
          currency: 'USD',
          minimumFee: 5,
          maximumFee: 50
        }
      },
      {
        providerId: 'sepa_eu',
        name: 'SEPA European Payments',
        type: 'SEPA',
        apiEndpoint: process.env.SEPA_API_URL || 'https://api.sepapayments.eu/v1',
        authMethod: 'OAUTH',
        supportedCurrencies: ['EUR'],
        supportedCountries: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
        maxTransactionAmount: 1000000,
        dailyLimit: 10000000,
        processingTime: 'Same day or next business day',
        fees: {
          fixedFee: 2,
          percentageFee: 0.02,
          currency: 'EUR',
          minimumFee: 2,
          maximumFee: 20
        }
      }
    ];

    defaultProviders.forEach(provider => this.registerProvider(provider));
  }

  private selectBestProvider(providers: BankingProvider[], instruction: PaymentInstruction): BankingProvider {
    // Score providers based on fees, processing time, and reliability
    let bestProvider = providers[0];
    let bestScore = 0;

    for (const provider of providers) {
      let score = 0;

      // Lower fees = higher score
      const fees = this.calculateFees(provider, instruction.amount);
      score += Math.max(0, 100 - (fees / instruction.amount) * 1000);

      // Faster processing = higher score
      if (provider.processingTime.includes('Same day')) score += 50;
      else if (provider.processingTime.includes('1')) score += 30;
      else if (provider.processingTime.includes('2')) score += 20;

      // Prefer provider type based on urgency
      if (instruction.urgency === 'SAME_DAY' && provider.type === 'WIRE') score += 30;
      if (instruction.urgency === 'STANDARD' && provider.type === 'ACH') score += 20;

      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  private calculateFees(provider: BankingProvider, amount: number): number {
    const percentageFee = (amount * provider.fees.percentageFee) / 100;
    const totalFee = provider.fees.fixedFee + percentageFee;
    
    return Math.max(
      provider.fees.minimumFee,
      Math.min(provider.fees.maximumFee, totalFee)
    );
  }

  private async executePayment(provider: BankingProvider, instruction: PaymentInstruction): Promise<PaymentStatus> {
    const headers = this.buildHeaders(provider);
    
    const paymentData = {
      instruction_id: instruction.instructionId,
      amount: instruction.amount,
      currency: instruction.currency,
      beneficiary: {
        name: instruction.beneficiary.name,
        account_number: await fieldEncryptionService.encrypt(instruction.beneficiary.accountNumber),
        bank_code: instruction.beneficiary.bankCode,
        bank_name: instruction.beneficiary.bankName,
        swift_code: instruction.beneficiary.swiftCode,
        iban: instruction.beneficiary.iban,
        country: instruction.beneficiary.country
      },
      remitter: instruction.remitter,
      purpose: instruction.purpose,
      urgency: instruction.urgency,
      reference: instruction.reference,
      scheduled_date: instruction.scheduledDate?.toISOString()
    };

    const response = await fetch(`${provider.apiEndpoint}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      throw new AppError(`Payment processing failed: ${response.statusText}`, response.status, 'PAYMENT_API_ERROR');
    }

    const data = await response.json();
    
    return {
      instructionId: instruction.instructionId,
      status: data.status || 'PENDING',
      transactionId: data.transaction_id,
      bankReference: data.bank_reference,
      processedDate: data.processed_date ? new Date(data.processed_date) : undefined,
      fees: data.fees || this.calculateFees(provider, instruction.amount),
      exchangeRate: data.exchange_rate,
      finalAmount: data.final_amount,
      finalCurrency: data.final_currency
    };
  }

  private async fetchPaymentStatus(provider: BankingProvider, instructionId: string): Promise<PaymentStatus | null> {
    const headers = this.buildHeaders(provider);
    
    const response = await fetch(`${provider.apiEndpoint}/payments/${instructionId}/status`, {
      headers
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new AppError(`Status fetch failed: ${response.statusText}`, response.status, 'STATUS_API_ERROR');
    }

    const data = await response.json();
    
    return {
      instructionId,
      status: data.status,
      transactionId: data.transaction_id,
      bankReference: data.bank_reference,
      processedDate: data.processed_date ? new Date(data.processed_date) : undefined,
      failureReason: data.failure_reason,
      fees: data.fees,
      exchangeRate: data.exchange_rate,
      finalAmount: data.final_amount,
      finalCurrency: data.final_currency
    };
  }

  private async cancelPaymentWithProvider(provider: BankingProvider, instructionId: string, reason: string): Promise<boolean> {
    const headers = this.buildHeaders(provider);
    
    const response = await fetch(`${provider.apiEndpoint}/payments/${instructionId}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason })
    });

    return response.ok;
  }

  private async fetchPaymentHistory(
    provider: BankingProvider,
    startDate: Date,
    endDate: Date,
    currency?: string,
    status?: string
  ): Promise<PaymentStatus[]> {
    const headers = this.buildHeaders(provider);
    const params = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    });

    if (currency) params.append('currency', currency);
    if (status) params.append('status', status);

    const response = await fetch(`${provider.apiEndpoint}/payments/history?${params}`, {
      headers
    });

    if (!response.ok) {
      throw new AppError(`History fetch failed: ${response.statusText}`, response.status, 'HISTORY_API_ERROR');
    }

    const data = await response.json();
    
    return data.payments?.map((payment: any) => ({
      instructionId: payment.instruction_id,
      status: payment.status,
      transactionId: payment.transaction_id,
      bankReference: payment.bank_reference,
      processedDate: payment.processed_date ? new Date(payment.processed_date) : undefined,
      fees: payment.fees,
      exchangeRate: payment.exchange_rate,
      finalAmount: payment.final_amount,
      finalCurrency: payment.final_currency
    })) || [];
  }

  private async fetchAccountBalance(provider: BankingProvider, accountNumber: string): Promise<{
    balance: number;
    currency: string;
    availableBalance: number;
    lastUpdated: Date;
  }> {
    const headers = this.buildHeaders(provider);
    
    const response = await fetch(`${provider.apiEndpoint}/accounts/${accountNumber}/balance`, {
      headers
    });

    if (!response.ok) {
      throw new AppError(`Balance fetch failed: ${response.statusText}`, response.status, 'BALANCE_API_ERROR');
    }

    const data = await response.json();
    
    return {
      balance: data.balance,
      currency: data.currency,
      availableBalance: data.available_balance,
      lastUpdated: new Date(data.last_updated)
    };
  }

  private buildHeaders(provider: BankingProvider): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    switch (provider.authMethod) {
      case 'API_KEY':
        headers['Authorization'] = `Bearer ${process.env[`${provider.providerId.toUpperCase()}_API_KEY`]}`;
        break;
      case 'OAUTH':
        headers['Authorization'] = `Bearer ${process.env[`${provider.providerId.toUpperCase()}_ACCESS_TOKEN`]}`;
        break;
      case 'CERTIFICATE':
        // Certificate-based auth would require additional setup
        headers['X-Certificate'] = process.env[`${provider.providerId.toUpperCase()}_CERT_ID`] || '';
        break;
    }

    return headers;
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

export const bankingIntegrationService = new BankingIntegrationService();