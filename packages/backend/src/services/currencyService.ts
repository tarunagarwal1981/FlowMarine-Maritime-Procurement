import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface ExchangeRateResponse {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: Date;
  source: string;
}

export interface CurrencyConversion {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  exchangeRate: number;
  conversionDate: Date;
}

export class CurrencyService {
  private static readonly SUPPORTED_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NOK',
    'DKK', 'SGD', 'HKD', 'NZD', 'KRW', 'INR', 'BRL', 'MXN', 'ZAR', 'RUB'
  ];

  private static readonly EXCHANGE_RATE_APIS = [
    {
      name: 'exchangerate-api',
      url: 'https://api.exchangerate-api.com/v4/latest/',
      key: process.env.EXCHANGE_RATE_API_KEY
    },
    {
      name: 'fixer',
      url: 'https://api.fixer.io/latest',
      key: process.env.FIXER_API_KEY
    }
  ];

  /**
   * Get current exchange rate between two currencies
   */
  static async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    useCache: boolean = true
  ): Promise<ExchangeRateResponse> {
    // Validate currencies
    if (!this.SUPPORTED_CURRENCIES.includes(fromCurrency) || 
        !this.SUPPORTED_CURRENCIES.includes(toCurrency)) {
      throw new Error(`Unsupported currency pair: ${fromCurrency}/${toCurrency}`);
    }

    // Same currency
    if (fromCurrency === toCurrency) {
      return {
        fromCurrency,
        toCurrency,
        rate: 1,
        date: new Date(),
        source: 'internal'
      };
    } 
   // Check cache first if enabled
    if (useCache) {
      const cachedRate = await this.getCachedExchangeRate(fromCurrency, toCurrency);
      if (cachedRate) {
        return cachedRate;
      }
    }

    // Fetch from external API
    const rate = await this.fetchExchangeRateFromAPI(fromCurrency, toCurrency);
    
    // Cache the rate
    await this.cacheExchangeRate(rate);
    
    return rate;
  }

  /**
   * Convert amount from one currency to another
   */
  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    useCache: boolean = true
  ): Promise<CurrencyConversion> {
    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency, useCache);
    
    const convertedAmount = amount * exchangeRate.rate;
    
    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
      exchangeRate: exchangeRate.rate,
      conversionDate: exchangeRate.date
    };
  }

  /**
   * Get historical exchange rate for a specific date
   */
  static async getHistoricalExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRateResponse | null> {
    try {
      const historicalRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency,
          toCurrency,
          date: {
            gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (historicalRate) {
        return {
          fromCurrency: historicalRate.fromCurrency,
          toCurrency: historicalRate.toCurrency,
          rate: historicalRate.rate,
          date: historicalRate.date,
          source: historicalRate.source
        };
      }

      return null;
    } catch (error) {
      logger.error('Error fetching historical exchange rate:', error);
      return null;
    }
  }  /
**
   * Get cached exchange rate (within last 1 hour)
   */
  private static async getCachedExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRateResponse | null> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const cachedRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency,
          toCurrency,
          createdAt: {
            gte: oneHourAgo
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (cachedRate) {
        return {
          fromCurrency: cachedRate.fromCurrency,
          toCurrency: cachedRate.toCurrency,
          rate: cachedRate.rate,
          date: cachedRate.date,
          source: cachedRate.source
        };
      }

      return null;
    } catch (error) {
      logger.error('Error fetching cached exchange rate:', error);
      return null;
    }
  }

  /**
   * Fetch exchange rate from external API with fallback
   */
  private static async fetchExchangeRateFromAPI(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRateResponse> {
    let lastError: Error | null = null;

    // Try each API in order
    for (const api of this.EXCHANGE_RATE_APIS) {
      try {
        const rate = await this.fetchFromSpecificAPI(api, fromCurrency, toCurrency);
        if (rate) {
          return rate;
        }
      } catch (error) {
        logger.warn(`Failed to fetch from ${api.name}:`, error);
        lastError = error as Error;
      }
    }

    // If all APIs fail, throw the last error
    throw new Error(`Failed to fetch exchange rate from all APIs: ${lastError?.message}`);
  }  /*
*
   * Fetch from specific API
   */
  private static async fetchFromSpecificAPI(
    api: any,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRateResponse | null> {
    try {
      let response;
      
      if (api.name === 'exchangerate-api') {
        response = await axios.get(`${api.url}${fromCurrency}`, {
          timeout: 5000
        });
        
        if (response.data && response.data.rates && response.data.rates[toCurrency]) {
          return {
            fromCurrency,
            toCurrency,
            rate: response.data.rates[toCurrency],
            date: new Date(),
            source: api.name
          };
        }
      } else if (api.name === 'fixer' && api.key) {
        response = await axios.get(api.url, {
          params: {
            access_key: api.key,
            base: fromCurrency,
            symbols: toCurrency
          },
          timeout: 5000
        });
        
        if (response.data && response.data.rates && response.data.rates[toCurrency]) {
          return {
            fromCurrency,
            toCurrency,
            rate: response.data.rates[toCurrency],
            date: new Date(),
            source: api.name
          };
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error fetching from ${api.name}:`, error);
      return null;
    }
  }

  /**
   * Cache exchange rate in database
   */
  private static async cacheExchangeRate(rate: ExchangeRateResponse): Promise<void> {
    try {
      await prisma.exchangeRate.create({
        data: {
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: rate.rate,
          date: rate.date,
          source: rate.source
        }
      });
    } catch (error) {
      logger.error('Error caching exchange rate:', error);
      // Don't throw - caching failure shouldn't break the main flow
    }
  }  /**

   * Get all supported currencies
   */
  static getSupportedCurrencies(): string[] {
    return [...this.SUPPORTED_CURRENCIES];
  }

  /**
   * Validate currency code
   */
  static isValidCurrency(currency: string): boolean {
    return this.SUPPORTED_CURRENCIES.includes(currency.toUpperCase());
  }

  /**
   * Convert multiple amounts to a base currency
   */
  static async convertMultipleCurrencies(
    amounts: Array<{ amount: number; currency: string }>,
    baseCurrency: string
  ): Promise<Array<CurrencyConversion>> {
    const conversions: CurrencyConversion[] = [];

    for (const item of amounts) {
      try {
        const conversion = await this.convertCurrency(
          item.amount,
          item.currency,
          baseCurrency
        );
        conversions.push(conversion);
      } catch (error) {
        logger.error(`Error converting ${item.currency} to ${baseCurrency}:`, error);
        // Add a fallback conversion with rate 1 if conversion fails
        conversions.push({
          amount: item.amount,
          fromCurrency: item.currency,
          toCurrency: baseCurrency,
          convertedAmount: item.amount,
          exchangeRate: 1,
          conversionDate: new Date()
        });
      }
    }

    return conversions;
  }

  /**
   * Get exchange rate trends for analytics
   */
  static async getExchangeRateTrends(
    fromCurrency: string,
    toCurrency: string,
    days: number = 30
  ): Promise<Array<{ date: Date; rate: number }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const rates = await prisma.exchangeRate.findMany({
        where: {
          fromCurrency,
          toCurrency,
          date: {
            gte: startDate
          }
        },
        orderBy: {
          date: 'asc'
        },
        select: {
          date: true,
          rate: true
        }
      });

      return rates;
    } catch (error) {
      logger.error('Error fetching exchange rate trends:', error);
      return [];
    }
  }
}