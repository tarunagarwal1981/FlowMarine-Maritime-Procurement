import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface ExchangeRateProvider {
  providerId: string;
  name: string;
  apiEndpoint: string;
  authMethod: 'API_KEY' | 'FREE' | 'SUBSCRIPTION';
  updateFrequency: number; // minutes
  supportedCurrencies: string[];
  historicalDataAvailable: boolean;
  rateLimit: number; // requests per hour
}

export interface ExchangeRate {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  timestamp: Date;
  provider: string;
  bid?: number;
  ask?: number;
  spread?: number;
}

export interface HistoricalRate {
  date: Date;
  rate: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: Date;
  provider: string;
  fees?: number;
}

class ExchangeRateIntegrationService {
  private providers: Map<string, ExchangeRateProvider>;
  private rateCache: Map<string, { rate: ExchangeRate; expiry: number }>;
  private requestCounts: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.providers = new Map();
    this.rateCache = new Map();
    this.requestCounts = new Map();
    this.initializeProviders();
  }

  /**
   * Register an exchange rate provider
   */
  registerProvider(provider: ExchangeRateProvider): void {
    this.providers.set(provider.providerId, provider);
    logger.info(`Registered exchange rate provider: ${provider.name}`);
  }

  /**
   * Get current exchange rate between two currencies
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string, providerId?: string): Promise<ExchangeRate> {
    try {
      if (fromCurrency === toCurrency) {
        return {
          baseCurrency: fromCurrency,
          targetCurrency: toCurrency,
          rate: 1,
          timestamp: new Date(),
          provider: 'internal'
        };
      }

      const cacheKey = `${fromCurrency}_${toCurrency}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      let rate: ExchangeRate;

      if (providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
          throw new AppError('Exchange rate provider not found', 404, 'PROVIDER_NOT_FOUND');
        }
        rate = await this.fetchRateFromProvider(provider, fromCurrency, toCurrency);
      } else {
        rate = await this.fetchRateWithFallback(fromCurrency, toCurrency);
      }

      // Cache the rate
      const ttl = 5 * 60 * 1000; // 5 minutes
      this.setCache(cacheKey, rate, ttl);

      return rate;
    } catch (error) {
      logger.error('Error getting exchange rate:', error);
      throw new AppError('Failed to get exchange rate', 500, 'EXCHANGE_RATE_ERROR');
    }
  }

  /**
   * Get multiple exchange rates at once
   */
  async getMultipleRates(baseCurrency: string, targetCurrencies: string[], providerId?: string): Promise<ExchangeRate[]> {
    try {
      const rates: ExchangeRate[] = [];

      for (const targetCurrency of targetCurrencies) {
        try {
          const rate = await this.getExchangeRate(baseCurrency, targetCurrency, providerId);
          rates.push(rate);
        } catch (error) {
          logger.warn(`Failed to get rate for ${baseCurrency}/${targetCurrency}:`, error);
          // Continue with other currencies
        }
      }

      return rates;
    } catch (error) {
      logger.error('Error getting multiple exchange rates:', error);
      throw new AppError('Failed to get multiple exchange rates', 500, 'MULTIPLE_RATES_ERROR');
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    providerId?: string
  ): Promise<CurrencyConversion> {
    try {
      const rate = await this.getExchangeRate(fromCurrency, toCurrency, providerId);
      const convertedAmount = amount * rate.rate;

      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
        exchangeRate: rate.rate,
        timestamp: rate.timestamp,
        provider: rate.provider
      };
    } catch (error) {
      logger.error('Error converting currency:', error);
      throw new AppError('Failed to convert currency', 500, 'CURRENCY_CONVERSION_ERROR');
    }
  }

  /**
   * Get historical exchange rates
   */
  async getHistoricalRates(
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date,
    providerId?: string
  ): Promise<HistoricalRate[]> {
    try {
      const providers = providerId 
        ? [this.providers.get(providerId)!]
        : Array.from(this.providers.values()).filter(p => p.historicalDataAvailable);

      if (providers.length === 0) {
        throw new AppError('No provider available for historical data', 404, 'NO_HISTORICAL_PROVIDER');
      }

      for (const provider of providers) {
        try {
          return await this.fetchHistoricalRates(provider, fromCurrency, toCurrency, startDate, endDate);
        } catch (error) {
          logger.warn(`Failed to get historical rates from ${provider.name}:`, error);
          continue;
        }
      }

      throw new AppError('All historical rate providers failed', 500, 'HISTORICAL_RATES_FAILED');
    } catch (error) {
      logger.error('Error getting historical rates:', error);
      throw new AppError('Failed to get historical rates', 500, 'HISTORICAL_RATES_ERROR');
    }
  }

  /**
   * Get supported currencies from all providers
   */
  getSupportedCurrencies(): string[] {
    const allCurrencies = new Set<string>();
    
    for (const provider of this.providers.values()) {
      provider.supportedCurrencies.forEach(currency => allCurrencies.add(currency));
    }

    return Array.from(allCurrencies).sort();
  }

  /**
   * Get provider status and health
   */
  async getProviderStatus(): Promise<Array<{
    providerId: string;
    name: string;
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    lastUpdate: Date;
    requestsRemaining?: number;
  }>> {
    const statuses = [];

    for (const provider of this.providers.values()) {
      try {
        const testRate = await this.fetchRateFromProvider(provider, 'USD', 'EUR');
        const requestCount = this.requestCounts.get(provider.providerId);
        
        statuses.push({
          providerId: provider.providerId,
          name: provider.name,
          status: 'HEALTHY' as const,
          lastUpdate: testRate.timestamp,
          requestsRemaining: requestCount ? provider.rateLimit - requestCount.count : provider.rateLimit
        });
      } catch (error) {
        statuses.push({
          providerId: provider.providerId,
          name: provider.name,
          status: 'DOWN' as const,
          lastUpdate: new Date()
        });
      }
    }

    return statuses;
  }

  /**
   * Sync rates for commonly used currency pairs
   */
  async syncCommonRates(): Promise<{ success: number; failed: number; errors: string[] }> {
    const commonPairs = [
      ['USD', 'EUR'], ['USD', 'GBP'], ['USD', 'JPY'], ['USD', 'AUD'], ['USD', 'CAD'],
      ['EUR', 'GBP'], ['EUR', 'JPY'], ['EUR', 'CHF'], ['GBP', 'JPY'], ['AUD', 'NZD']
    ];

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [from, to] of commonPairs) {
      try {
        await this.getExchangeRate(from, to);
        success++;
      } catch (error) {
        failed++;
        errors.push(`${from}/${to}: ${error.message}`);
      }
    }

    logger.info(`Rate sync completed: ${success} success, ${failed} failed`);
    return { success, failed, errors };
  }

  private initializeProviders(): void {
    const defaultProviders: ExchangeRateProvider[] = [
      {
        providerId: 'exchangerate_api',
        name: 'ExchangeRate-API',
        apiEndpoint: 'https://api.exchangerate-api.com/v4',
        authMethod: 'FREE',
        updateFrequency: 60, // 1 hour
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR', 'KRW'],
        historicalDataAvailable: false,
        rateLimit: 1500 // per month for free tier
      },
      {
        providerId: 'fixer_io',
        name: 'Fixer.io',
        apiEndpoint: 'https://api.fixer.io/v1',
        authMethod: 'API_KEY',
        updateFrequency: 60,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR', 'KRW', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'DKK'],
        historicalDataAvailable: true,
        rateLimit: 1000 // per month for free tier
      },
      {
        providerId: 'currencylayer',
        name: 'CurrencyLayer',
        apiEndpoint: 'https://api.currencylayer.com',
        authMethod: 'API_KEY',
        updateFrequency: 60,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR', 'KRW'],
        historicalDataAvailable: true,
        rateLimit: 1000
      },
      {
        providerId: 'openexchangerates',
        name: 'Open Exchange Rates',
        apiEndpoint: 'https://openexchangerates.org/api',
        authMethod: 'API_KEY',
        updateFrequency: 60,
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR', 'KRW'],
        historicalDataAvailable: true,
        rateLimit: 1000
      }
    ];

    defaultProviders.forEach(provider => this.registerProvider(provider));
  }

  private async fetchRateWithFallback(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
    const providers = Array.from(this.providers.values())
      .filter(p => p.supportedCurrencies.includes(fromCurrency) && p.supportedCurrencies.includes(toCurrency))
      .sort((a, b) => a.rateLimit - b.rateLimit); // Try providers with higher rate limits first

    for (const provider of providers) {
      try {
        if (this.isRateLimited(provider)) {
          continue;
        }

        return await this.fetchRateFromProvider(provider, fromCurrency, toCurrency);
      } catch (error) {
        logger.warn(`Failed to get rate from ${provider.name}:`, error);
        continue;
      }
    }

    throw new AppError('All exchange rate providers failed', 500, 'ALL_PROVIDERS_FAILED');
  }

  private async fetchRateFromProvider(
    provider: ExchangeRateProvider,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate> {
    this.incrementRequestCount(provider);

    let url: string;
    const headers: Record<string, string> = {};

    switch (provider.providerId) {
      case 'exchangerate_api':
        url = `${provider.apiEndpoint}/latest/${fromCurrency}`;
        break;
      case 'fixer_io':
        url = `${provider.apiEndpoint}/latest?access_key=${process.env.FIXER_API_KEY}&base=${fromCurrency}&symbols=${toCurrency}`;
        break;
      case 'currencylayer':
        url = `${provider.apiEndpoint}/live?access_key=${process.env.CURRENCYLAYER_API_KEY}&source=${fromCurrency}&currencies=${toCurrency}`;
        break;
      case 'openexchangerates':
        url = `${provider.apiEndpoint}/latest.json?app_id=${process.env.OPENEXCHANGERATES_API_KEY}&base=${fromCurrency}&symbols=${toCurrency}`;
        break;
      default:
        throw new AppError('Unknown provider', 400, 'UNKNOWN_PROVIDER');
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AppError(`${provider.name} API error: ${response.statusText}`, response.status, 'PROVIDER_API_ERROR');
    }

    const data = await response.json();
    
    return this.parseProviderResponse(provider, data, fromCurrency, toCurrency);
  }

  private parseProviderResponse(
    provider: ExchangeRateProvider,
    data: any,
    fromCurrency: string,
    toCurrency: string
  ): ExchangeRate {
    let rate: number;
    let timestamp: Date;

    switch (provider.providerId) {
      case 'exchangerate_api':
        rate = data.rates[toCurrency];
        timestamp = new Date(data.date);
        break;
      case 'fixer_io':
        rate = data.rates[toCurrency];
        timestamp = new Date(data.timestamp * 1000);
        break;
      case 'currencylayer':
        rate = data.quotes[`${fromCurrency}${toCurrency}`];
        timestamp = new Date(data.timestamp * 1000);
        break;
      case 'openexchangerates':
        rate = data.rates[toCurrency];
        timestamp = new Date(data.timestamp * 1000);
        break;
      default:
        throw new AppError('Unknown provider response format', 500, 'UNKNOWN_RESPONSE_FORMAT');
    }

    if (!rate) {
      throw new AppError('Exchange rate not found in response', 404, 'RATE_NOT_FOUND');
    }

    return {
      baseCurrency: fromCurrency,
      targetCurrency: toCurrency,
      rate,
      timestamp,
      provider: provider.name
    };
  }

  private async fetchHistoricalRates(
    provider: ExchangeRateProvider,
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalRate[]> {
    if (!provider.historicalDataAvailable) {
      throw new AppError('Provider does not support historical data', 400, 'NO_HISTORICAL_DATA');
    }

    this.incrementRequestCount(provider);

    let url: string;
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    switch (provider.providerId) {
      case 'fixer_io':
        // Fixer.io requires separate requests for each date
        return await this.fetchFixerHistoricalRates(provider, fromCurrency, toCurrency, startDate, endDate);
      case 'currencylayer':
        url = `${provider.apiEndpoint}/timeframe?access_key=${process.env.CURRENCYLAYER_API_KEY}&source=${fromCurrency}&currencies=${toCurrency}&start_date=${startDateStr}&end_date=${endDateStr}`;
        break;
      case 'openexchangerates':
        // OpenExchangeRates requires separate requests for each date
        return await this.fetchOpenExchangeHistoricalRates(provider, fromCurrency, toCurrency, startDate, endDate);
      default:
        throw new AppError('Historical data not supported for this provider', 400, 'HISTORICAL_NOT_SUPPORTED');
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new AppError(`${provider.name} historical API error: ${response.statusText}`, response.status, 'HISTORICAL_API_ERROR');
    }

    const data = await response.json();
    
    return this.parseHistoricalResponse(provider, data, fromCurrency, toCurrency);
  }

  private async fetchFixerHistoricalRates(
    provider: ExchangeRateProvider,
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalRate[]> {
    const rates: HistoricalRate[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const url = `${provider.apiEndpoint}/${dateStr}?access_key=${process.env.FIXER_API_KEY}&base=${fromCurrency}&symbols=${toCurrency}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const rate = data.rates[toCurrency];
          if (rate) {
            rates.push({
              date: new Date(dateStr),
              rate,
              high: rate,
              low: rate,
              open: rate,
              close: rate
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch rate for ${dateStr}:`, error);
      }

      currentDate.setDate(currentDate.getDate() + 1);
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return rates;
  }

  private async fetchOpenExchangeHistoricalRates(
    provider: ExchangeRateProvider,
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalRate[]> {
    const rates: HistoricalRate[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const url = `${provider.apiEndpoint}/historical/${dateStr}.json?app_id=${process.env.OPENEXCHANGERATES_API_KEY}&base=${fromCurrency}&symbols=${toCurrency}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const rate = data.rates[toCurrency];
          if (rate) {
            rates.push({
              date: new Date(dateStr),
              rate,
              high: rate,
              low: rate,
              open: rate,
              close: rate
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch rate for ${dateStr}:`, error);
      }

      currentDate.setDate(currentDate.getDate() + 1);
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return rates;
  }

  private parseHistoricalResponse(
    provider: ExchangeRateProvider,
    data: any,
    fromCurrency: string,
    toCurrency: string
  ): HistoricalRate[] {
    const rates: HistoricalRate[] = [];

    switch (provider.providerId) {
      case 'currencylayer':
        for (const [date, quotes] of Object.entries(data.quotes)) {
          const rate = (quotes as any)[`${fromCurrency}${toCurrency}`];
          if (rate) {
            rates.push({
              date: new Date(date),
              rate,
              high: rate,
              low: rate,
              open: rate,
              close: rate
            });
          }
        }
        break;
    }

    return rates.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private isRateLimited(provider: ExchangeRateProvider): boolean {
    const requestCount = this.requestCounts.get(provider.providerId);
    if (!requestCount) return false;

    const now = Date.now();
    if (now > requestCount.resetTime) {
      // Reset counter
      this.requestCounts.set(provider.providerId, { count: 0, resetTime: now + 3600000 });
      return false;
    }

    return requestCount.count >= provider.rateLimit;
  }

  private incrementRequestCount(provider: ExchangeRateProvider): void {
    const now = Date.now();
    const requestCount = this.requestCounts.get(provider.providerId);

    if (!requestCount || now > requestCount.resetTime) {
      this.requestCounts.set(provider.providerId, { count: 1, resetTime: now + 3600000 });
    } else {
      requestCount.count++;
    }
  }

  private getFromCache(key: string): ExchangeRate | null {
    const cached = this.rateCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.rate;
    }
    this.rateCache.delete(key);
    return null;
  }

  private setCache(key: string, rate: ExchangeRate, ttl: number): void {
    this.rateCache.set(key, {
      rate,
      expiry: Date.now() + ttl
    });
  }
}

export const exchangeRateIntegrationService = new ExchangeRateIntegrationService();