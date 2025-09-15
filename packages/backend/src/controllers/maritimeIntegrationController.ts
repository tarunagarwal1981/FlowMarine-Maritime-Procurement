import { Request, Response } from 'express';
import { aisGpsIntegrationService } from '../services/aisGpsIntegrationService';
import { impaCatalogIntegrationService } from '../services/impaCatalogIntegrationService';
import { portDatabaseIntegrationService } from '../services/portDatabaseIntegrationService';
import { vesselManagementIntegrationService } from '../services/vesselManagementIntegrationService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class MaritimeIntegrationController {
  /**
   * Get vessel position from AIS/GPS systems
   */
  async getVesselPosition(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { imoNumber, gpsDeviceId } = req.query;

      if (!imoNumber) {
        throw new AppError('IMO number is required', 400, 'MISSING_IMO_NUMBER');
      }

      const position = await aisGpsIntegrationService.getBestAvailablePosition(
        vesselId,
        imoNumber as string,
        gpsDeviceId as string
      );

      if (!position) {
        res.status(404).json({
          success: false,
          message: 'Vessel position not available'
        });
        return;
      }

      res.json({
        success: true,
        data: position
      });
    } catch (error) {
      logger.error('Error getting vessel position:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Search IMPA/ISSA catalog
   */
  async searchCatalog(req: Request, res: Response): Promise<void> {
    try {
      const {
        query,
        impaCode,
        issaCode,
        category,
        vesselType,
        engineType,
        limit,
        offset,
        source
      } = req.query;

      const searchParams = {
        query: query as string,
        impaCode: impaCode as string,
        issaCode: issaCode as string,
        category: category as string,
        vesselType: vesselType as string,
        engineType: engineType as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      };

      let result;
      
      if (source === 'impa') {
        result = await impaCatalogIntegrationService.searchIMPACatalog(searchParams);
      } else if (source === 'issa') {
        const items = await impaCatalogIntegrationService.searchISSACatalog(searchParams);
        result = { items, total: items.length, hasMore: false };
      } else {
        result = await impaCatalogIntegrationService.getCombinedCatalogData(searchParams);
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error searching catalog:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get specific catalog item
   */
  async getCatalogItem(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const { source } = req.query;

      let item;
      
      if (source === 'impa') {
        item = await impaCatalogIntegrationService.getIMPAItem(code);
      } else if (source === 'issa') {
        item = await impaCatalogIntegrationService.getISSAItem(code);
      } else {
        // Try both sources
        const [impaItem, issaItem] = await Promise.all([
          impaCatalogIntegrationService.getIMPAItem(code),
          impaCatalogIntegrationService.getISSAItem(code)
        ]);
        item = impaItem || issaItem;
      }

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Catalog item not found'
        });
        return;
      }

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      logger.error('Error getting catalog item:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Sync catalog updates
   */
  async syncCatalogUpdates(req: Request, res: Response): Promise<void> {
    try {
      const { lastSyncDate } = req.body;
      
      const result = await impaCatalogIntegrationService.syncCatalogUpdates(
        lastSyncDate ? new Date(lastSyncDate) : undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error syncing catalog updates:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Search ports
   */
  async searchPorts(req: Request, res: Response): Promise<void> {
    try {
      const {
        query,
        country,
        region,
        services,
        maxDistance,
        latitude,
        longitude
      } = req.query;

      const searchParams = {
        query: query as string,
        country: country as string,
        region: region as string,
        services: services ? (services as string).split(',') : undefined,
        maxDistance: maxDistance ? parseFloat(maxDistance as string) : undefined,
        coordinates: latitude && longitude ? {
          latitude: parseFloat(latitude as string),
          longitude: parseFloat(longitude as string)
        } : undefined
      };

      const ports = await portDatabaseIntegrationService.searchPorts(searchParams);

      res.json({
        success: true,
        data: ports
      });
    } catch (error) {
      logger.error('Error searching ports:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get port details
   */
  async getPortDetails(req: Request, res: Response): Promise<void> {
    try {
      const { portCode } = req.params;

      const port = await portDatabaseIntegrationService.getPortDetails(portCode);

      if (!port) {
        res.status(404).json({
          success: false,
          message: 'Port not found'
        });
        return;
      }

      res.json({
        success: true,
        data: port
      });
    } catch (error) {
      logger.error('Error getting port details:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Find nearest ports
   */
  async findNearestPorts(req: Request, res: Response): Promise<void> {
    try {
      const { latitude, longitude, radius } = req.query;

      if (!latitude || !longitude) {
        throw new AppError('Latitude and longitude are required', 400, 'MISSING_COORDINATES');
      }

      const ports = await portDatabaseIntegrationService.findNearestPorts(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        radius ? parseFloat(radius as string) : undefined
      );

      res.json({
        success: true,
        data: ports
      });
    } catch (error) {
      logger.error('Error finding nearest ports:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Coordinate delivery
   */
  async coordinateDelivery(req: Request, res: Response): Promise<void> {
    try {
      const coordination = req.body;

      const result = await portDatabaseIntegrationService.coordinateDelivery(coordination);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error coordinating delivery:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get customs requirements
   */
  async getCustomsRequirements(req: Request, res: Response): Promise<void> {
    try {
      const { portCode, vesselFlag, cargoType } = req.query;

      if (!portCode || !vesselFlag || !cargoType) {
        throw new AppError('Port code, vessel flag, and cargo type are required', 400, 'MISSING_PARAMETERS');
      }

      const requirements = await portDatabaseIntegrationService.getCustomsRequirements(
        portCode as string,
        vesselFlag as string,
        cargoType as string
      );

      res.json({
        success: true,
        data: requirements
      });
    } catch (error) {
      logger.error('Error getting customs requirements:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Calculate transit time
   */
  async calculateTransitTime(req: Request, res: Response): Promise<void> {
    try {
      const { fromPortCode, toPortCode, vesselSpeed } = req.query;

      if (!fromPortCode || !toPortCode) {
        throw new AppError('From and to port codes are required', 400, 'MISSING_PORT_CODES');
      }

      const result = await portDatabaseIntegrationService.calculateTransitTime(
        fromPortCode as string,
        toPortCode as string,
        vesselSpeed ? parseFloat(vesselSpeed as string) : undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error calculating transit time:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get vessel management system data
   */
  async getVesselManagementData(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { systemId, dataType } = req.query;

      if (!systemId || !dataType) {
        throw new AppError('System ID and data type are required', 400, 'MISSING_PARAMETERS');
      }

      const data = await vesselManagementIntegrationService.exchangeVesselData(
        systemId as string,
        vesselId,
        dataType as any,
        'GET'
      );

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Error getting vessel management data:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get crew manifest
   */
  async getCrewManifest(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { systemId } = req.query;

      if (!systemId) {
        throw new AppError('System ID is required', 400, 'MISSING_SYSTEM_ID');
      }

      const manifest = await vesselManagementIntegrationService.getCrewManifest(
        systemId as string,
        vesselId
      );

      res.json({
        success: true,
        data: manifest
      });
    } catch (error) {
      logger.error('Error getting crew manifest:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get maintenance schedule
   */
  async getMaintenanceSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { systemId } = req.query;

      if (!systemId) {
        throw new AppError('System ID is required', 400, 'MISSING_SYSTEM_ID');
      }

      const schedule = await vesselManagementIntegrationService.getMaintenanceSchedule(
        systemId as string,
        vesselId
      );

      res.json({
        success: true,
        data: schedule
      });
    } catch (error) {
      logger.error('Error getting maintenance schedule:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get integrated dashboard data
   */
  async getIntegratedDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { systemId } = req.query;

      if (!systemId) {
        throw new AppError('System ID is required', 400, 'MISSING_SYSTEM_ID');
      }

      const dashboardData = await vesselManagementIntegrationService.getIntegratedDashboardData(
        systemId as string,
        vesselId
      );

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      logger.error('Error getting integrated dashboard data:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Sync procurement data with vessel management system
   */
  async syncProcurementData(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { systemId } = req.query;
      const procurementData = req.body;

      if (!systemId) {
        throw new AppError('System ID is required', 400, 'MISSING_SYSTEM_ID');
      }

      const result = await vesselManagementIntegrationService.syncProcurementData(
        systemId as string,
        vesselId,
        procurementData
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error syncing procurement data:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const maritimeIntegrationController = new MaritimeIntegrationController();