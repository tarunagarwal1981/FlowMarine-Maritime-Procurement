import { PrismaClient, PurchaseOrder, POStatus, Quote, Vessel } from '@prisma/client';
import { AppError } from '../utils/errors';
import { auditService } from './auditService';

const prisma = new PrismaClient();

export interface CreatePOData {
  quoteId: string;
  approvedBy: string;
  deliveryInstructions?: string;
  specialTerms?: string;
  notes?: string;
}

export interface POApprovalData {
  purchaseOrderId: string;
  approvedBy: string;
  comments?: string;
}

export interface MaritimeTermsConfig {
  incoterms: string;
  paymentTerms: string;
  deliveryTerms: string;
  warrantyTerms: string;
  inspectionTerms: string;
  forceMateure: string;
  disputeResolution: string;
}

export interface VesselDeliveryInfo {
  vesselName: string;
  imoNumber: string;
  currentPosition?: {
    latitude: number;
    longitude: number;
    lastUpdate: Date;
  };
  currentVoyage?: {
    departure: string;
    destination: string;
    eta: Date;
  };
  portAgent?: {
    name: string;
    contact: string;
    email: string;
  };
  deliveryInstructions: string;
}

class PurchaseOrderService {
  private readonly MARITIME_TERMS: MaritimeTermsConfig = {
    incoterms: 'DAP (Delivered at Place) - Port of delivery as specified',
    paymentTerms: 'Net 30 days from delivery confirmation',
    deliveryTerms: 'Delivery to vessel at berth or anchorage as directed by Master/Chief Engineer',
    warrantyTerms: 'All goods shall be warranted for 12 months from delivery date or as per manufacturer warranty, whichever is longer',
    inspectionTerms: 'Goods subject to inspection by vessel crew upon delivery. Any discrepancies must be reported within 48 hours',
    forceMateure: 'Neither party shall be liable for delays due to weather, port congestion, or other maritime circumstances beyond reasonable control',
    disputeResolution: 'Disputes to be resolved under maritime law of vessel flag state'
  };

  private readonly HIGH_VALUE_THRESHOLD = 25000; // USD equivalent

  /**
   * Generate purchase order from approved quote
   */
  async generatePurchaseOrder(data: CreatePOData): Promise<PurchaseOrder> {
    try {
      // Get quote with all related data
      const quote = await prisma.quote.findUnique({
        where: { id: data.quoteId },
        include: {
          vendor: {
            include: {
              serviceAreas: true,
              portCapabilities: true
            }
          },
          rfq: {
            include: {
              requisition: {
                include: {
                  vessel: true,
                  items: {
                    include: {
                      itemCatalog: true
                    }
                  }
                }
              }
            }
          },
          lineItems: {
            include: {
              itemCatalog: true
            }
          }
        }
      });

      if (!quote) {
        throw new AppError('Quote not found', 404, 'QUOTE_NOT_FOUND');
      }

      if (quote.status !== 'ACCEPTED') {
        throw new AppError('Only accepted quotes can be converted to purchase orders', 400, 'INVALID_QUOTE_STATUS');
      }

      // Check if PO already exists for this quote
      const existingPO = await prisma.purchaseOrder.findUnique({
        where: { quoteId: data.quoteId }
      });

      if (existingPO) {
        throw new AppError('Purchase order already exists for this quote', 400, 'PO_ALREADY_EXISTS');
      }

      // Generate PO number
      const poNumber = await this.generatePONumber();

      // Get vessel delivery information
      const vesselDeliveryInfo = await this.getVesselDeliveryInfo(quote.rfq.requisition.vessel);

      // Determine if high-value approval is needed
      const requiresApproval = quote.totalAmount >= this.HIGH_VALUE_THRESHOLD;
      const initialStatus = requiresApproval ? POStatus.DRAFT : POStatus.SENT;

      // Create purchase order
      const purchaseOrder = await prisma.$transaction(async (tx) => {
        // Create PO
        const po = await tx.purchaseOrder.create({
          data: {
            poNumber,
            quoteId: data.quoteId,
            vendorId: quote.vendorId,
            vesselId: quote.rfq.requisition.vesselId,
            status: initialStatus,
            totalAmount: quote.totalAmount,
            currency: quote.currency,
            exchangeRate: await this.getCurrentExchangeRate(quote.currency),
            paymentTerms: this.buildPaymentTerms(quote),
            deliveryTerms: this.buildDeliveryTerms(vesselDeliveryInfo, data.deliveryInstructions),
            deliveryAddress: this.buildDeliveryAddress(vesselDeliveryInfo),
            deliveryDate: quote.deliveryDate,
            notes: this.buildPONotes(data, vesselDeliveryInfo),
            attachments: []
          }
        });

        // Create PO line items
        const lineItems = quote.lineItems.map(item => ({
          purchaseOrderId: po.id,
          itemDescription: `${item.itemCatalog.name} - ${item.itemCatalog.description || ''}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          currency: item.currency,
          specifications: item.specifications
        }));

        await tx.pOLineItem.createMany({
          data: lineItems
        });

        return po;
      });

      // Create audit log
      await auditService.log({
        userId: data.approvedBy,
        action: 'CREATE',
        resource: 'purchase_order',
        resourceId: purchaseOrder.id,
        newValues: {
          poNumber: purchaseOrder.poNumber,
          quoteId: data.quoteId,
          vendorId: quote.vendorId,
          vesselId: quote.rfq.requisition.vesselId,
          totalAmount: quote.totalAmount,
          status: initialStatus,
          requiresApproval
        },
        vesselId: quote.rfq.requisition.vesselId,
        metadata: {
          rfqId: quote.rfqId,
          requisitionId: quote.rfq.requisitionId
        }
      });

      return purchaseOrder;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate purchase order', 500, 'PO_GENERATION_FAILED');
    }
  }

  /**
   * Approve high-value purchase order
   */
  async approvePurchaseOrder(data: POApprovalData): Promise<PurchaseOrder> {
    try {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
        include: {
          vendor: true,
          vessel: true
        }
      });

      if (!po) {
        throw new AppError('Purchase order not found', 404, 'PO_NOT_FOUND');
      }

      if (po.status !== POStatus.DRAFT) {
        throw new AppError('Only draft purchase orders can be approved', 400, 'INVALID_PO_STATUS');
      }

      // Update PO status to SENT
      const approvedPO = await prisma.purchaseOrder.update({
        where: { id: data.purchaseOrderId },
        data: {
          status: POStatus.SENT,
          notes: po.notes ? `${po.notes}\n\nApproval Comments: ${data.comments || 'Approved'}` : `Approval Comments: ${data.comments || 'Approved'}`
        }
      });

      // Create audit log
      await auditService.log({
        userId: data.approvedBy,
        action: 'APPROVE',
        resource: 'purchase_order',
        resourceId: data.purchaseOrderId,
        oldValues: { status: POStatus.DRAFT },
        newValues: { status: POStatus.SENT, approvedBy: data.approvedBy, comments: data.comments },
        vesselId: po.vesselId,
        metadata: {
          poNumber: po.poNumber,
          vendorId: po.vendorId,
          totalAmount: po.totalAmount
        }
      });

      return approvedPO;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to approve purchase order', 500, 'PO_APPROVAL_FAILED');
    }
  }

  /**
   * Get purchase order with full details
   */
  async getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
    try {
      return await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          vendor: {
            include: {
              serviceAreas: true,
              portCapabilities: true
            }
          },
          vessel: true,
          quote: {
            include: {
              rfq: {
                include: {
                  requisition: {
                    include: {
                      requestedBy: true,
                      items: {
                        include: {
                          itemCatalog: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          lineItems: true,
          deliveries: true,
          invoices: true
        }
      });
    } catch (error) {
      throw new AppError('Failed to get purchase order', 500, 'PO_FETCH_FAILED');
    }
  }

  /**
   * Get purchase orders for a vessel
   */
  async getPurchaseOrdersByVessel(vesselId: string, status?: POStatus): Promise<PurchaseOrder[]> {
    try {
      const where: any = { vesselId };
      if (status) {
        where.status = status;
      }

      return await prisma.purchaseOrder.findMany({
        where,
        include: {
          vendor: true,
          vessel: true,
          lineItems: true,
          deliveries: true
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      throw new AppError('Failed to get purchase orders for vessel', 500, 'PO_VESSEL_FETCH_FAILED');
    }
  }

  /**
   * Update purchase order status
   */
  async updatePurchaseOrderStatus(id: string, status: POStatus, userId: string, notes?: string): Promise<PurchaseOrder> {
    try {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id }
      });

      if (!po) {
        throw new AppError('Purchase order not found', 404, 'PO_NOT_FOUND');
      }

      const updatedPO = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status,
          notes: notes ? (po.notes ? `${po.notes}\n\n${notes}` : notes) : po.notes
        }
      });

      // Create audit log
      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'purchase_order',
        resourceId: id,
        oldValues: { status: po.status },
        newValues: { status, notes },
        vesselId: po.vesselId,
        metadata: {
          poNumber: po.poNumber,
          statusChange: `${po.status} -> ${status}`
        }
      });

      return updatedPO;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update purchase order status', 500, 'PO_STATUS_UPDATE_FAILED');
    }
  }

  /**
   * Generate unique PO number
   */
  private async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the count of POs created this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
    
    const count = await prisma.purchaseOrder.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `PO-${year}${month}-${sequence}`;
  }

  /**
   * Get vessel delivery information
   */
  private async getVesselDeliveryInfo(vessel: Vessel): Promise<VesselDeliveryInfo> {
    const deliveryInfo: VesselDeliveryInfo = {
      vesselName: vessel.name,
      imoNumber: vessel.imoNumber,
      deliveryInstructions: `Delivery to M/V ${vessel.name} (IMO: ${vessel.imoNumber})`
    };

    // Add current position if available
    if (vessel.currentLatitude && vessel.currentLongitude) {
      deliveryInfo.currentPosition = {
        latitude: vessel.currentLatitude,
        longitude: vessel.currentLongitude,
        lastUpdate: vessel.positionUpdatedAt || new Date()
      };
    }

    // Add current voyage information if available
    if (vessel.currentDestination && vessel.currentETA) {
      deliveryInfo.currentVoyage = {
        departure: vessel.currentDeparture || 'Unknown',
        destination: vessel.currentDestination,
        eta: vessel.currentETA
      };
    }

    return deliveryInfo;
  }

  /**
   * Build payment terms with maritime-specific conditions
   */
  private buildPaymentTerms(quote: any): string {
    const baseTerms = quote.paymentTerms || this.MARITIME_TERMS.paymentTerms;
    
    return `${baseTerms}

MARITIME PAYMENT CONDITIONS:
- Payment subject to satisfactory delivery and inspection by vessel crew
- All banking charges outside seller's country for buyer's account
- Payment to be made in ${quote.currency}
- Late payment charges: 1.5% per month on overdue amounts
- Retention: 5% of invoice value held for 30 days post-delivery for warranty claims`;
  }

  /**
   * Build delivery terms with vessel-specific information
   */
  private buildDeliveryTerms(vesselInfo: VesselDeliveryInfo, additionalInstructions?: string): string {
    let terms = `${this.MARITIME_TERMS.deliveryTerms}

VESSEL DELIVERY REQUIREMENTS:
- Vessel: ${vesselInfo.vesselName} (IMO: ${vesselInfo.imoNumber})`;

    if (vesselInfo.currentVoyage) {
      terms += `
- Current voyage: ${vesselInfo.currentVoyage.departure} to ${vesselInfo.currentVoyage.destination}
- ETA: ${vesselInfo.currentVoyage.eta.toDateString()}`;
    }

    if (vesselInfo.currentPosition) {
      terms += `
- Last known position: ${vesselInfo.currentPosition.latitude.toFixed(4)}°N, ${vesselInfo.currentPosition.longitude.toFixed(4)}°E
- Position updated: ${vesselInfo.currentPosition.lastUpdate.toDateString()}`;
    }

    terms += `
- Delivery coordination required with Master/Chief Engineer minimum 24 hours prior
- All goods to be properly packaged for maritime transport
- Delivery receipt to be signed by authorized vessel representative
- ${this.MARITIME_TERMS.inspectionTerms}`;

    if (additionalInstructions) {
      terms += `\n\nADDITIONAL INSTRUCTIONS:\n${additionalInstructions}`;
    }

    return terms;
  }

  /**
   * Build delivery address with port information
   */
  private buildDeliveryAddress(vesselInfo: VesselDeliveryInfo): string {
    let address = `M/V ${vesselInfo.vesselName} (IMO: ${vesselInfo.imoNumber})`;

    if (vesselInfo.currentVoyage) {
      address += `\nPort of ${vesselInfo.currentVoyage.destination}`;
    }

    if (vesselInfo.portAgent) {
      address += `\n\nPort Agent: ${vesselInfo.portAgent.name}
Contact: ${vesselInfo.portAgent.contact}
Email: ${vesselInfo.portAgent.email}`;
    }

    address += `\n\nNote: Final delivery location to be confirmed 24-48 hours prior to delivery based on vessel's actual position and berth assignment.`;

    return address;
  }

  /**
   * Build comprehensive PO notes
   */
  private buildPONotes(data: CreatePOData, vesselInfo: VesselDeliveryInfo): string {
    let notes = `MARITIME PURCHASE ORDER

Generated from approved quote for vessel operations.

IMPORTANT MARITIME CONDITIONS:
${this.MARITIME_TERMS.warrantyTerms}

FORCE MAJEURE:
${this.MARITIME_TERMS.forceMateure}

DISPUTE RESOLUTION:
${this.MARITIME_TERMS.disputeResolution}`;

    if (data.specialTerms) {
      notes += `\n\nSPECIAL TERMS:\n${data.specialTerms}`;
    }

    if (data.notes) {
      notes += `\n\nADDITIONAL NOTES:\n${data.notes}`;
    }

    return notes;
  }

  /**
   * Get current exchange rate (simplified - would integrate with real API)
   */
  private async getCurrentExchangeRate(currency: string): Promise<number> {
    if (currency === 'USD') return 1;

    // Try to get latest rate from database
    const latestRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: currency,
        toCurrency: 'USD'
      },
      orderBy: { date: 'desc' }
    });

    return latestRate?.rate || 1;
  }
}

export const purchaseOrderService = new PurchaseOrderService();