import { PrismaClient, Delivery, DeliveryStatus, PurchaseOrder } from '@prisma/client';
import { AppError } from '../utils/errors';
import { auditService } from './auditService';

const prisma = new PrismaClient();

export interface CreateDeliveryData {
  purchaseOrderId: string;
  scheduledDate: Date;
  deliveryAddress: string;
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
}

export interface UpdateDeliveryData {
  status?: DeliveryStatus;
  actualDate?: Date;
  trackingNumber?: string;
  carrier?: string;
  receivedBy?: string;
  photoUrls?: string[];
  notes?: string;
}

export interface DeliveryConfirmationData {
  deliveryId: string;
  receivedBy: string;
  actualDate: Date;
  photoUrls: string[];
  notes?: string;
  discrepancies?: string;
}

export interface PortDeliveryInfo {
  portCode: string;
  portName: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  services: string[];
  agents: PortAgent[];
  restrictions: string[];
  operatingHours: string;
  contactInfo: {
    phone: string;
    email: string;
    vhf: string;
  };
}

export interface PortAgent {
  name: string;
  contact: string;
  email: string;
  phone: string;
  services: string[];
}

export interface DeliveryTracking {
  deliveryId: string;
  status: DeliveryStatus;
  currentLocation?: string;
  estimatedDelivery?: Date;
  trackingEvents: TrackingEvent[];
  lastUpdate: Date;
}

export interface TrackingEvent {
  timestamp: Date;
  location: string;
  status: string;
  description: string;
  carrier?: string;
}

export interface EstimatedDeliveryTime {
  estimatedDays: number;
  estimatedDate: Date;
  factors: {
    distance: number;
    carrier: string;
    portCongestion: string;
    weatherConditions: string;
    customsClearance: string;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

class DeliveryService {
  private readonly PORT_DATABASE: Map<string, PortDeliveryInfo> = new Map([
    ['USNYC', {
      portCode: 'USNYC',
      portName: 'Port of New York',
      coordinates: { latitude: 40.6892, longitude: -74.0445 },
      services: ['container', 'bulk', 'general_cargo', 'customs'],
      agents: [
        {
          name: 'NYC Port Services',
          contact: 'John Smith',
          email: 'john@nycport.com',
          phone: '+1-212-555-0123',
          services: ['delivery', 'customs', 'warehousing']
        }
      ],
      restrictions: ['No hazardous materials without permit', 'Weight limit 40 tons per container'],
      operatingHours: '24/7',
      contactInfo: {
        phone: '+1-212-555-PORT',
        email: 'operations@portny.com',
        vhf: 'Channel 12'
      }
    }],
    ['GBLON', {
      portCode: 'GBLON',
      portName: 'Port of London',
      coordinates: { latitude: 51.5074, longitude: -0.1278 },
      services: ['container', 'general_cargo', 'customs'],
      agents: [
        {
          name: 'London Maritime Services',
          contact: 'Sarah Johnson',
          email: 'sarah@londonmaritime.co.uk',
          phone: '+44-20-7555-0123',
          services: ['delivery', 'customs', 'documentation']
        }
      ],
      restrictions: ['Tidal restrictions apply', 'Advance booking required'],
      operatingHours: '06:00-22:00',
      contactInfo: {
        phone: '+44-20-7555-PORT',
        email: 'operations@portlondon.co.uk',
        vhf: 'Channel 14'
      }
    }]
  ]);

  /**
   * Create delivery schedule for purchase order
   */
  async createDelivery(data: CreateDeliveryData, userId: string): Promise<Delivery> {
    try {
      // Verify purchase order exists and is in appropriate status
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
        include: {
          vessel: true,
          vendor: true
        }
      });

      if (!po) {
        throw new AppError('Purchase order not found', 404, 'PO_NOT_FOUND');
      }

      if (po.status !== 'SENT' && po.status !== 'ACKNOWLEDGED') {
        throw new AppError('Purchase order must be sent or acknowledged to schedule delivery', 400, 'INVALID_PO_STATUS');
      }

      // Check if delivery already exists
      const existingDelivery = await prisma.delivery.findFirst({
        where: { purchaseOrderId: data.purchaseOrderId }
      });

      if (existingDelivery) {
        throw new AppError('Delivery already scheduled for this purchase order', 400, 'DELIVERY_EXISTS');
      }

      // Generate delivery number
      const deliveryNumber = await this.generateDeliveryNumber();

      // Create delivery
      const delivery = await prisma.delivery.create({
        data: {
          deliveryNumber,
          purchaseOrderId: data.purchaseOrderId,
          status: DeliveryStatus.SCHEDULED,
          scheduledDate: data.scheduledDate,
          deliveryAddress: data.deliveryAddress,
          carrier: data.carrier,
          trackingNumber: data.trackingNumber,
          notes: data.notes,
          photoUrls: []
        }
      });

      // Update PO status to IN_PROGRESS
      await prisma.purchaseOrder.update({
        where: { id: data.purchaseOrderId },
        data: { status: 'IN_PROGRESS' }
      });

      // Create audit log
      await auditService.log({
        userId,
        action: 'CREATE',
        resource: 'delivery',
        resourceId: delivery.id,
        newValues: {
          deliveryNumber: delivery.deliveryNumber,
          purchaseOrderId: data.purchaseOrderId,
          scheduledDate: data.scheduledDate,
          status: DeliveryStatus.SCHEDULED
        },
        vesselId: po.vesselId,
        metadata: {
          poNumber: po.poNumber,
          vendorId: po.vendorId
        }
      });

      return delivery;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create delivery', 500, 'DELIVERY_CREATION_FAILED');
    }
  }

  /**
   * Update delivery status and tracking information
   */
  async updateDelivery(deliveryId: string, data: UpdateDeliveryData, userId: string): Promise<Delivery> {
    try {
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          purchaseOrder: {
            include: {
              vessel: true
            }
          }
        }
      });

      if (!delivery) {
        throw new AppError('Delivery not found', 404, 'DELIVERY_NOT_FOUND');
      }

      // Build update data
      const updateData: any = {};
      
      if (data.status) updateData.status = data.status;
      if (data.actualDate) updateData.actualDate = data.actualDate;
      if (data.trackingNumber) updateData.trackingNumber = data.trackingNumber;
      if (data.carrier) updateData.carrier = data.carrier;
      if (data.receivedBy) updateData.receivedBy = data.receivedBy;
      if (data.photoUrls) updateData.photoUrls = data.photoUrls;
      if (data.notes) {
        updateData.notes = delivery.notes ? `${delivery.notes}\n\n${data.notes}` : data.notes;
      }

      // Update delivery
      const updatedDelivery = await prisma.delivery.update({
        where: { id: deliveryId },
        data: updateData
      });

      // Update PO status if delivery is completed
      if (data.status === DeliveryStatus.DELIVERED) {
        await prisma.purchaseOrder.update({
          where: { id: delivery.purchaseOrderId },
          data: { status: 'DELIVERED' }
        });
      }

      // Create audit log
      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'delivery',
        resourceId: deliveryId,
        oldValues: {
          status: delivery.status,
          actualDate: delivery.actualDate,
          receivedBy: delivery.receivedBy
        },
        newValues: updateData,
        vesselId: delivery.purchaseOrder.vesselId,
        metadata: {
          deliveryNumber: delivery.deliveryNumber,
          poNumber: delivery.purchaseOrder.poNumber
        }
      });

      return updatedDelivery;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update delivery', 500, 'DELIVERY_UPDATE_FAILED');
    }
  }

  /**
   * Confirm delivery with photo documentation
   */
  async confirmDelivery(data: DeliveryConfirmationData, userId: string): Promise<Delivery> {
    try {
      const delivery = await prisma.delivery.findUnique({
        where: { id: data.deliveryId },
        include: {
          purchaseOrder: {
            include: {
              vessel: true,
              vendor: true
            }
          }
        }
      });

      if (!delivery) {
        throw new AppError('Delivery not found', 404, 'DELIVERY_NOT_FOUND');
      }

      if (delivery.status === DeliveryStatus.DELIVERED) {
        throw new AppError('Delivery already confirmed', 400, 'DELIVERY_ALREADY_CONFIRMED');
      }

      // Update delivery with confirmation details
      const confirmedDelivery = await prisma.delivery.update({
        where: { id: data.deliveryId },
        data: {
          status: DeliveryStatus.DELIVERED,
          actualDate: data.actualDate,
          receivedBy: data.receivedBy,
          photoUrls: data.photoUrls,
          notes: delivery.notes ? 
            `${delivery.notes}\n\nDelivery Confirmed: ${data.notes || 'No additional notes'}${data.discrepancies ? `\nDiscrepancies: ${data.discrepancies}` : ''}` :
            `Delivery Confirmed: ${data.notes || 'No additional notes'}${data.discrepancies ? `\nDiscrepancies: ${data.discrepancies}` : ''}`
        }
      });

      // Update PO status
      await prisma.purchaseOrder.update({
        where: { id: delivery.purchaseOrderId },
        data: { status: 'DELIVERED' }
      });

      // Create audit log
      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'delivery',
        resourceId: data.deliveryId,
        oldValues: { status: delivery.status },
        newValues: {
          status: DeliveryStatus.DELIVERED,
          actualDate: data.actualDate,
          receivedBy: data.receivedBy,
          photoCount: data.photoUrls.length,
          discrepancies: data.discrepancies
        },
        vesselId: delivery.purchaseOrder.vesselId,
        metadata: {
          deliveryNumber: delivery.deliveryNumber,
          poNumber: delivery.purchaseOrder.poNumber,
          vendorId: delivery.purchaseOrder.vendorId
        }
      });

      return confirmedDelivery;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to confirm delivery', 500, 'DELIVERY_CONFIRMATION_FAILED');
    }
  }

  /**
   * Get delivery tracking information
   */
  async getDeliveryTracking(deliveryId: string): Promise<DeliveryTracking> {
    try {
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          purchaseOrder: {
            include: {
              vessel: true,
              vendor: true
            }
          }
        }
      });

      if (!delivery) {
        throw new AppError('Delivery not found', 404, 'DELIVERY_NOT_FOUND');
      }

      // Generate mock tracking events (in production, this would integrate with carrier APIs)
      const trackingEvents = this.generateTrackingEvents(delivery);

      const tracking: DeliveryTracking = {
        deliveryId: delivery.id,
        status: delivery.status,
        currentLocation: this.getCurrentLocation(delivery),
        estimatedDelivery: delivery.scheduledDate,
        trackingEvents,
        lastUpdate: new Date()
      };

      return tracking;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get delivery tracking', 500, 'DELIVERY_TRACKING_FAILED');
    }
  }

  /**
   * Calculate estimated delivery time
   */
  async calculateEstimatedDeliveryTime(
    originPort: string,
    destinationPort: string,
    carrier: string
  ): Promise<EstimatedDeliveryTime> {
    try {
      // Get port information
      const originInfo = this.PORT_DATABASE.get(originPort);
      const destinationInfo = this.PORT_DATABASE.get(destinationPort);

      if (!originInfo || !destinationInfo) {
        throw new AppError('Port information not available', 404, 'PORT_INFO_NOT_FOUND');
      }

      // Calculate distance (simplified - would use actual maritime routing)
      const distance = this.calculateDistance(
        originInfo.coordinates,
        destinationInfo.coordinates
      );

      // Base delivery time calculation
      let estimatedDays = Math.ceil(distance / 500); // Assume 500 nautical miles per day

      // Adjust for carrier
      const carrierMultiplier = this.getCarrierMultiplier(carrier);
      estimatedDays = Math.ceil(estimatedDays * carrierMultiplier);

      // Add port congestion factor
      const congestionDays = this.getPortCongestionDays(destinationPort);
      estimatedDays += congestionDays;

      // Add customs clearance time
      const customsDays = this.getCustomsClearanceDays(destinationPort);
      estimatedDays += customsDays;

      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

      const estimation: EstimatedDeliveryTime = {
        estimatedDays,
        estimatedDate,
        factors: {
          distance,
          carrier,
          portCongestion: `${congestionDays} days`,
          weatherConditions: 'Normal',
          customsClearance: `${customsDays} days`
        },
        confidence: distance < 1000 ? 'HIGH' : distance < 3000 ? 'MEDIUM' : 'LOW'
      };

      return estimation;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to calculate delivery time', 500, 'DELIVERY_TIME_CALCULATION_FAILED');
    }
  }

  /**
   * Get port database information
   */
  async getPortInfo(portCode: string): Promise<PortDeliveryInfo | null> {
    return this.PORT_DATABASE.get(portCode) || null;
  }

  /**
   * Search ports by name or code
   */
  async searchPorts(query: string): Promise<PortDeliveryInfo[]> {
    const results: PortDeliveryInfo[] = [];
    
    for (const [code, info] of this.PORT_DATABASE) {
      if (
        code.toLowerCase().includes(query.toLowerCase()) ||
        info.portName.toLowerCase().includes(query.toLowerCase())
      ) {
        results.push(info);
      }
    }

    return results;
  }

  /**
   * Get deliveries for a vessel
   */
  async getDeliveriesByVessel(vesselId: string, status?: DeliveryStatus): Promise<Delivery[]> {
    try {
      const where: any = {
        purchaseOrder: {
          vesselId
        }
      };

      if (status) {
        where.status = status;
      }

      return await prisma.delivery.findMany({
        where,
        include: {
          purchaseOrder: {
            include: {
              vendor: true,
              vessel: true
            }
          }
        },
        orderBy: { scheduledDate: 'desc' }
      });
    } catch (error) {
      throw new AppError('Failed to get deliveries for vessel', 500, 'DELIVERY_VESSEL_FETCH_FAILED');
    }
  }

  /**
   * Generate unique delivery number
   */
  private async generateDeliveryNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
    
    const count = await prisma.delivery.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `DEL-${year}${month}-${sequence}`;
  }

  /**
   * Generate mock tracking events
   */
  private generateTrackingEvents(delivery: Delivery): TrackingEvent[] {
    const events: TrackingEvent[] = [];
    const baseDate = delivery.createdAt;

    events.push({
      timestamp: baseDate,
      location: 'Vendor Facility',
      status: 'SCHEDULED',
      description: 'Delivery scheduled',
      carrier: delivery.carrier
    });

    if (delivery.status !== DeliveryStatus.SCHEDULED) {
      const pickupDate = new Date(baseDate);
      pickupDate.setHours(pickupDate.getHours() + 2);
      
      events.push({
        timestamp: pickupDate,
        location: 'Vendor Facility',
        status: 'IN_TRANSIT',
        description: 'Package picked up by carrier',
        carrier: delivery.carrier
      });
    }

    if (delivery.status === DeliveryStatus.DELIVERED) {
      events.push({
        timestamp: delivery.actualDate || new Date(),
        location: delivery.deliveryAddress || 'Vessel',
        status: 'DELIVERED',
        description: `Delivered to ${delivery.receivedBy}`,
        carrier: delivery.carrier
      });
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get current location for tracking
   */
  private getCurrentLocation(delivery: Delivery): string {
    switch (delivery.status) {
      case DeliveryStatus.SCHEDULED:
        return 'Vendor Facility';
      case DeliveryStatus.IN_TRANSIT:
        return 'In Transit';
      case DeliveryStatus.DELIVERED:
        return delivery.deliveryAddress || 'Delivered';
      case DeliveryStatus.DELAYED:
        return 'Delayed in Transit';
      case DeliveryStatus.CANCELLED:
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }

  /**
   * Calculate distance between two coordinates (simplified)
   */
  private calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 3440; // Nautical miles radius of Earth
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) * Math.cos(this.toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get carrier speed multiplier
   */
  private getCarrierMultiplier(carrier: string): number {
    const multipliers: { [key: string]: number } = {
      'express': 0.7,
      'standard': 1.0,
      'economy': 1.3,
      'sea_freight': 2.0
    };

    return multipliers[carrier.toLowerCase()] || 1.0;
  }

  /**
   * Get port congestion days
   */
  private getPortCongestionDays(portCode: string): number {
    // Simplified - would integrate with real port congestion data
    const congestionData: { [key: string]: number } = {
      'USNYC': 2,
      'GBLON': 1,
      'SGSIN': 3,
      'HKHKG': 2
    };

    return congestionData[portCode] || 1;
  }

  /**
   * Get customs clearance days
   */
  private getCustomsClearanceDays(portCode: string): number {
    // Simplified - would integrate with customs data
    const customsData: { [key: string]: number } = {
      'USNYC': 2,
      'GBLON': 1,
      'SGSIN': 1,
      'HKHKG': 1
    };

    return customsData[portCode] || 2;
  }
}

export const deliveryService = new DeliveryService();