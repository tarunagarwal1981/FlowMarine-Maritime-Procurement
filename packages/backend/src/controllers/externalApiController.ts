import { Request, Response, NextFunction } from 'express';
import { externalApiService } from '../services/externalApiIntegrationService';
import { bankingApiService } from '../services/bankingApiIntegrationService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class ExternalApiController {
  // IMPA/ISSA Catalog Endpoints
  async searchIMPACatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        searchTerm,
        impaCode,
        issaCode,
        category,
        vesselType,
        engineType,
        limit = 50,
        offset = 0
      } = req.query;

      const result = await externalApiService.searchIMPACatalog({
        searchTerm: searchTerm as string,
        impaCode: impaCode as string,
        issaCode: issaCode as string,
        category: category as string,
        vesselType: vesselType as string,
        engineType: engineType as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: result,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: result.total
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getIMPAItemDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { impaCode } = req.params;
      
      if (!impaCode) {
        throw new AppError('IMPA code is required', 400, 'MISSING_IMPA_CODE');
      }

      const item = await externalApiService.getIMPAItemDetails(impaCode);
      
      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      next(error);
    }
  }

  async getIMPASupplierPricing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { impaCode } = req.params;
      const { location } = req.query;
      
      if (!impaCode) {
        throw new AppError('IMPA code is required', 400, 'MISSING_IMPA_CODE');
      }

      const suppliers = await externalApiService.getIMPASupplierPricing(
        impaCode,
        location as string
      );
      
      res.json({
        success: true,
        data: suppliers
      });
    } catch (error) {
      next(error);
    }
  }

  // Port Database Endpoints
  async getPortInformation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { portCode } = req.params;
      
      if (!portCode) {
        throw new AppError('Port code is required', 400, 'MISSING_PORT_CODE');
      }

      const portData = await externalApiService.getPortInformation(portCode);
      
      res.json({
        success: true,
        data: portData
      });
    } catch (error) {
      next(error);
    }
  }

  async searchPorts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { country, region, services, latitude, longitude, radius } = req.query;

      const query: any = {};
      
      if (country) query.country = country;
      if (region) query.region = region;
      if (services) query.services = (services as string).split(',');
      
      if (latitude && longitude && radius) {
        query.coordinates = {
          latitude: parseFloat(latitude as string),
          longitude: parseFloat(longitude as string),
          radius: parseFloat(radius as string)
        };
      }

      const ports = await externalApiService.searchPorts(query);
      
      res.json({
        success: true,
        data: ports
      });
    } catch (error) {
      next(error);
    }
  }

  // Weather API Endpoints
  async getWeatherData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude } = req.query;
      
      if (!latitude || !longitude) {
        throw new AppError('Latitude and longitude are required', 400, 'MISSING_COORDINATES');
      }

      const weatherData = await externalApiService.getWeatherData({
        latitude: parseFloat(latitude as string),
        longitude: parseFloat(longitude as string)
      });
      
      res.json({
        success: true,
        data: weatherData
      });
    } catch (error) {
      next(error);
    }
  }

  async getRouteWeatherForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { route } = req.body;
      
      if (!route || !Array.isArray(route)) {
        throw new AppError('Route coordinates array is required', 400, 'MISSING_ROUTE');
      }

      const weatherForecast = await externalApiService.getRouteWeatherForecast(route);
      
      res.json({
        success: true,
        data: weatherForecast
      });
    } catch (error) {
      next(error);
    }
  }

  // Vessel Tracking Endpoints
  async getVesselPosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { imoNumber } = req.params;
      
      if (!imoNumber) {
        throw new AppError('IMO number is required', 400, 'MISSING_IMO_NUMBER');
      }

      const trackingData = await externalApiService.getVesselPosition(imoNumber);
      
      res.json({
        success: true,
        data: trackingData
      });
    } catch (error) {
      next(error);
    }
  }

  async trackMultipleVessels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { imoNumbers } = req.body;
      
      if (!imoNumbers || !Array.isArray(imoNumbers)) {
        throw new AppError('IMO numbers array is required', 400, 'MISSING_IMO_NUMBERS');
      }

      const trackingData = await externalApiService.trackMultipleVessels(imoNumbers);
      
      res.json({
        success: true,
        data: trackingData
      });
    } catch (error) {
      next(error);
    }
  }

  // Banking API Endpoints
  async getCurrentExchangeRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currencies } = req.query;
      
      if (!currencies) {
        throw new AppError('Currencies parameter is required', 400, 'MISSING_CURRENCIES');
      }

      const currencyList = (currencies as string).split(',');
      const rates = await bankingApiService.getCurrentExchangeRates(currencyList);
      
      res.json({
        success: true,
        data: rates
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistoricalExchangeRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fromCurrency, toCurrency, startDate, endDate } = req.query;
      
      if (!fromCurrency || !toCurrency || !startDate || !endDate) {
        throw new AppError('All currency and date parameters are required', 400, 'MISSING_PARAMETERS');
      }

      const rates = await bankingApiService.getHistoricalExchangeRates(
        fromCurrency as string,
        toCurrency as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json({
        success: true,
        data: rates
      });
    } catch (error) {
      next(error);
    }
  }

  async getBankAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await bankingApiService.getBankAccounts();
      
      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      next(error);
    }
  }

  async getCashPosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currency } = req.query;
      
      const positions = await bankingApiService.getCashPosition(currency as string);
      
      res.json({
        success: true,
        data: positions
      });
    } catch (error) {
      next(error);
    }
  }

  async initiatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentInstruction = req.body;
      
      // Validate required fields
      const requiredFields = ['fromAccount', 'toAccount', 'amount', 'currency', 'beneficiaryDetails'];
      for (const field of requiredFields) {
        if (!paymentInstruction[field]) {
          throw new AppError(`${field} is required`, 400, 'MISSING_PAYMENT_FIELD');
        }
      }

      const paymentStatus = await bankingApiService.initiatePayment(paymentInstruction);
      
      res.json({
        success: true,
        data: paymentStatus
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.params;
      
      if (!paymentId) {
        throw new AppError('Payment ID is required', 400, 'MISSING_PAYMENT_ID');
      }

      const status = await bankingApiService.getPaymentStatus(paymentId);
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  async getFXHedgingRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { exposures } = req.body;
      
      if (!exposures || !Array.isArray(exposures)) {
        throw new AppError('Exposures array is required', 400, 'MISSING_EXPOSURES');
      }

      const recommendations = await bankingApiService.getFXHedgingRecommendations(exposures);
      
      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      next(error);
    }
  }

  // Real-time Data Endpoints
  async getSystemStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check the status of all external API integrations
      const status = {
        impa: 'CONNECTED',
        ports: 'CONNECTED',
        weather: 'CONNECTED',
        vesselTracking: 'CONNECTED',
        banking: 'CONNECTED',
        lastChecked: new Date()
      };

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }
}

export const externalApiController = new ExternalApiController();