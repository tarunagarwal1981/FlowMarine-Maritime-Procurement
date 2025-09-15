import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { redis } from '../config/redis';
import { AppError } from '../utils/errors';
import { encrypt, decrypt } from '../utils/encryption';

export interface BankAccount {
  accountId: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  balance: number;
  accountType: 'CHECKING' | 'SAVINGS' | 'BUSINESS';
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN';
  country: string;
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: Date;
  source: string;
  bid: number;
  ask: number;
  spread: number;
}

export interface PaymentInstruction {
  paymentId: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  targetCurrency?: string;
  paymentMethod: 'WIRE' | 'ACH' | 'SWIFT' | 'SEPA' | 'DIGITAL';
  urgency: 'STANDARD' | 'URGENT' | 'SAME_DAY';
  reference: string;
  beneficiaryDetails: BeneficiaryDetails;
  complianceChecks: ComplianceCheck[];
}

export interface BeneficiaryDetails {
  name: string;
  address: string;
  bankName: string;
  bankAddress: string;
  accountNumber: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  country: string;
}

export interface ComplianceCheck {
  type: 'AML' | 'KYC' | 'SANCTIONS' | 'PEP';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUIRES_REVIEW';
  details: string;
  checkedAt: Date;
  checkedBy: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  statusDetails: string;
  fees: PaymentFee[];
  exchangeRateUsed?: number;
  actualAmount?: number;
  completedAt?: Date;
  failureReason?: string;
  trackingReference?: string;
}

export interface PaymentFee {
  type: 'TRANSFER' | 'EXCHANGE' | 'CORRESPONDENT' | 'COMPLIANCE';
  amount: number;
  currency: string;
  description: string;
}

export interface CashPosition {
  currency: string;
  totalBalance: number;
  availableBalance: number;
  pendingIncoming: number;
  pendingOutgoing: number;
  accounts: BankAccount[];
  lastUpdated: Date;
}

export interface FXHedgingRecommendation {
  currencyPair: string;
  exposureAmount: number;
  recommendedAction: 'HEDGE' | 'WAIT' | 'PARTIAL_HEDGE';
  hedgingInstrument: 'FORWARD' | 'OPTION' | 'SWAP';
  targetRate: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timeHorizon: number; // days
  reasoning: string;
}

export class BankingApiIntegrationService extends EventEmitter {
  private swiftClient: AxiosInstance;
  private fxClient: AxiosInstance;
  private complianceClient: AxiosInstance;
  private primaryBankClient: AxiosInstance;

  constructor() {
    super();
    this.initializeClients();
    this.setupRealTimeRateUpdates();
  }

  private initializeClients(): void {
    // SWIFT Network Client
    this.swiftClient = axios.create({
      baseURL: process.env.SWIFT_API_URL || 'https://api.swift.com/v1',
      timeout: 60000,
      headers: {
        'Authorization': `Bearer ${process.env.SWIFT_API_KEY}`,
        'Content-Type': 'application/json',
        'X-API-Version': '2024-01'
      }
    });

    // Foreign Exchange Client
    this.fxClient = axios.create({
      baseURL: process.env.FX_API_URL || 'https://api.xe.com/v1',
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${process.env.FX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Compliance Screening Client
    this.complianceClient = axios.create({
      baseURL: process.env.COMPLIANCE_API_URL || 'https://api.worldcheck.com/v1',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${process.env.COMPLIANCE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Primary Bank API Client
    this.primaryBankClient = axios.create({
      baseURL: process.env.PRIMARY_BANK_API_URL,
      timeout: 45000,
      headers: {
        'Authorization': `Bearer ${process.env.PRIMARY_BANK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    const clients = [this.swiftClient, this.fxClient, this.complianceClient, this.primaryBankClient];
    
    clients.forEach(client => {
      client.interceptors.request.use(
        (config) => {
          // Add request ID for tracking
          config.headers['X-Request-ID'] = `fm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          logger.debug(`Banking API Request: ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => {
          logger.error('Banking API Request Error:', error);
          return Promise.reject(error);
        }
      );

      client.interceptors.response.use(
        (response) => {
          logger.debug(`Banking API Response: ${response.status} ${response.config.url}`);
          return response;
        },
        (error) => {
          logger.error('Banking API Response Error:', error.response?.data || error.message);
          return Promise.reject(new AppError(
            `Banking API Error: ${error.response?.data?.message || error.message}`,
            error.response?.status || 500,
            'BANKING_API_ERROR'
          ));
        }
      );
    });
  }

  // Exchange Rate Management
  async getCurrentExchangeRates(currencies: string[]): Promise<ExchangeRate[]> {
    try {
      const cacheKey = `fx:rates:${currencies.sort().join(',')}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.fxClient.get('/rates', {
        params: {
          currencies: currencies.join(','),
          include_spread: true
        }
      });

      const rates = response.data.rates.map(this.transformExchangeRate);

      // Cache for 1 minute (FX rates change frequently)
      await redis.setex(cacheKey, 60, JSON.stringify(rates));
      
      return rates;
    } catch (error) {
      logger.error('Exchange rates error:', error);
      throw error;
    }
  }

  async getHistoricalExchangeRates(
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<ExchangeRate[]> {
    try {
      const response = await this.fxClient.get('/rates/historical', {
        params: {
          from: fromCurrency,
          to: toCurrency,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      });

      return response.data.rates.map(this.transformExchangeRate);
    } catch (error) {
      logger.error('Historical exchange rates error:', error);
      throw error;
    }
  }

  async getFXHedgingRecommendations(
    exposures: { currency: string; amount: number }[]
  ): Promise<FXHedgingRecommendation[]> {
    try {
      const response = await this.fxClient.get('/hedging/recommendations', {
        params: { exposures: JSON.stringify(exposures) }
      });

      return response.data.recommendations;
    } catch (error) {
      logger.error('FX hedging recommendations error:', error);
      throw error;
    }
  }

  private transformExchangeRate(rawRate: any): ExchangeRate {
    return {
      fromCurrency: rawRate.from_currency,
      toCurrency: rawRate.to_currency,
      rate: rawRate.rate,
      timestamp: new Date(rawRate.timestamp),
      source: rawRate.source,
      bid: rawRate.bid,
      ask: rawRate.ask,
      spread: rawRate.spread
    };
  }

  // Account Management
  async getBankAccounts(): Promise<BankAccount[]> {
    try {
      const cacheKey = 'banking:accounts';
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.primaryBankClient.get('/accounts');
      const accounts = response.data.accounts.map(this.transformBankAccount);

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(accounts));
      
      return accounts;
    } catch (error) {
      logger.error('Bank accounts error:', error);
      throw error;
    }
  }

  async getAccountBalance(accountId: string): Promise<number> {
    try {
      const response = await this.primaryBankClient.get(`/accounts/${accountId}/balance`);
      return response.data.balance;
    } catch (error) {
      logger.error('Account balance error:', error);
      throw error;
    }
  }

  async getCashPosition(currency?: string): Promise<CashPosition[]> {
    try {
      const accounts = await this.getBankAccounts();
      const filteredAccounts = currency 
        ? accounts.filter(acc => acc.currency === currency)
        : accounts;

      const positions = new Map<string, CashPosition>();

      for (const account of filteredAccounts) {
        const curr = account.currency;
        if (!positions.has(curr)) {
          positions.set(curr, {
            currency: curr,
            totalBalance: 0,
            availableBalance: 0,
            pendingIncoming: 0,
            pendingOutgoing: 0,
            accounts: [],
            lastUpdated: new Date()
          });
        }

        const position = positions.get(curr)!;
        position.totalBalance += account.balance;
        position.availableBalance += account.balance; // Simplified
        position.accounts.push(account);
      }

      return Array.from(positions.values());
    } catch (error) {
      logger.error('Cash position error:', error);
      throw error;
    }
  }

  private transformBankAccount(rawAccount: any): BankAccount {
    return {
      accountId: rawAccount.account_id,
      accountNumber: rawAccount.account_number,
      bankCode: rawAccount.bank_code,
      bankName: rawAccount.bank_name,
      currency: rawAccount.currency,
      balance: rawAccount.balance,
      accountType: rawAccount.account_type,
      status: rawAccount.status,
      country: rawAccount.country
    };
  }

  // Payment Processing
  async initiatePayment(instruction: PaymentInstruction): Promise<PaymentStatus> {
    try {
      // Perform compliance checks first
      const complianceResults = await this.performComplianceChecks(instruction.beneficiaryDetails);
      
      if (complianceResults.some(check => check.status === 'REJECTED')) {
        throw new AppError('Payment rejected due to compliance issues', 400, 'COMPLIANCE_REJECTED');
      }

      // Get current exchange rate if needed
      let exchangeRate = instruction.exchangeRate;
      if (instruction.targetCurrency && instruction.currency !== instruction.targetCurrency) {
        const rates = await this.getCurrentExchangeRates([instruction.currency, instruction.targetCurrency]);
        const rate = rates.find(r => 
          r.fromCurrency === instruction.currency && r.toCurrency === instruction.targetCurrency
        );
        exchangeRate = rate?.rate || exchangeRate;
      }

      const paymentData = {
        ...instruction,
        exchangeRate,
        complianceChecks: complianceResults,
        initiatedAt: new Date()
      };

      const response = await this.swiftClient.post('/payments', paymentData);
      
      const paymentStatus: PaymentStatus = {
        paymentId: response.data.payment_id,
        status: response.data.status,
        statusDetails: response.data.status_details,
        fees: response.data.fees || [],
        exchangeRateUsed: exchangeRate,
        trackingReference: response.data.tracking_reference
      };

      // Cache payment status
      await redis.setex(`payment:${paymentStatus.paymentId}`, 3600, JSON.stringify(paymentStatus));

      this.emit('payment-initiated', paymentStatus);
      
      return paymentStatus;
    } catch (error) {
      logger.error('Payment initiation error:', error);
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const cacheKey = `payment:${paymentId}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const status = JSON.parse(cached);
        // If payment is still pending/processing, check for updates
        if (status.status === 'PENDING' || status.status === 'PROCESSING') {
          return await this.refreshPaymentStatus(paymentId);
        }
        return status;
      }

      return await this.refreshPaymentStatus(paymentId);
    } catch (error) {
      logger.error('Payment status error:', error);
      throw error;
    }
  }

  private async refreshPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const response = await this.swiftClient.get(`/payments/${paymentId}/status`);
    
    const status: PaymentStatus = {
      paymentId: response.data.payment_id,
      status: response.data.status,
      statusDetails: response.data.status_details,
      fees: response.data.fees || [],
      exchangeRateUsed: response.data.exchange_rate_used,
      actualAmount: response.data.actual_amount,
      completedAt: response.data.completed_at ? new Date(response.data.completed_at) : undefined,
      failureReason: response.data.failure_reason,
      trackingReference: response.data.tracking_reference
    };

    // Cache updated status
    await redis.setex(`payment:${paymentId}`, 3600, JSON.stringify(status));

    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      this.emit('payment-status-changed', status);
    }

    return status;
  }

  // Compliance and Risk Management
  async performComplianceChecks(beneficiary: BeneficiaryDetails): Promise<ComplianceCheck[]> {
    try {
      const checks: ComplianceCheck[] = [];

      // AML Check
      const amlResponse = await this.complianceClient.post('/aml/check', {
        name: beneficiary.name,
        address: beneficiary.address,
        country: beneficiary.country
      });

      checks.push({
        type: 'AML',
        status: amlResponse.data.status,
        details: amlResponse.data.details,
        checkedAt: new Date(),
        checkedBy: 'SYSTEM'
      });

      // Sanctions Check
      const sanctionsResponse = await this.complianceClient.post('/sanctions/check', {
        name: beneficiary.name,
        country: beneficiary.country,
        bank_name: beneficiary.bankName
      });

      checks.push({
        type: 'SANCTIONS',
        status: sanctionsResponse.data.status,
        details: sanctionsResponse.data.details,
        checkedAt: new Date(),
        checkedBy: 'SYSTEM'
      });

      // KYC Check
      const kycResponse = await this.complianceClient.post('/kyc/check', {
        name: beneficiary.name,
        address: beneficiary.address,
        account_number: beneficiary.accountNumber,
        bank_name: beneficiary.bankName
      });

      checks.push({
        type: 'KYC',
        status: kycResponse.data.status,
        details: kycResponse.data.details,
        checkedAt: new Date(),
        checkedBy: 'SYSTEM'
      });

      return checks;
    } catch (error) {
      logger.error('Compliance checks error:', error);
      throw error;
    }
  }

  // Real-time Updates
  private setupRealTimeRateUpdates(): void {
    // Set up WebSocket for real-time FX rate updates
    setInterval(async () => {
      try {
        const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'HKD'];
        const rates = await this.getCurrentExchangeRates(majorCurrencies);
        this.emit('fx-rates-updated', rates);
      } catch (error) {
        logger.error('Real-time FX update error:', error);
      }
    }, 60000); // Update every minute

    // Set up payment status monitoring
    setInterval(async () => {
      try {
        // Check for pending payments and update their status
        const pendingPayments = await this.getPendingPayments();
        for (const payment of pendingPayments) {
          await this.refreshPaymentStatus(payment.paymentId);
        }
      } catch (error) {
        logger.error('Payment status monitoring error:', error);
      }
    }, 300000); // Check every 5 minutes
  }

  private async getPendingPayments(): Promise<PaymentStatus[]> {
    // This would typically query a database for pending payments
    // For now, return empty array
    return [];
  }

  // Automated Payment Processing
  async processAutomatedPayments(criteria: {
    maxAmount?: number;
    approvedVendors?: string[];
    currencies?: string[];
  }): Promise<PaymentStatus[]> {
    try {
      // This would integrate with the procurement system to get approved invoices
      // and automatically process payments based on the criteria
      logger.info('Processing automated payments with criteria:', criteria);
      
      // Implementation would go here
      return [];
    } catch (error) {
      logger.error('Automated payment processing error:', error);
      throw error;
    }
  }
}

export const bankingApiService = new BankingApiIntegrationService();