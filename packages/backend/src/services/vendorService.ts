import { PrismaClient, Vendor, VendorServiceArea, VendorPortCapability, VendorCertification } from '@prisma/client';
import { encrypt, decrypt } from '../utils/encryption';
import { AppError } from '../utils/errors';
import { AuditService } from './auditService';
import { fieldEncryptionService } from './fieldEncryptionService';

const prisma = new PrismaClient();

export interface VendorRegistrationData {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  website?: string;
  contactPersonName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  taxId?: string;
  registrationNumber?: string;
  paymentTerms?: string;
  creditLimit?: number;
  creditLimitCurrency?: string;
  serviceAreas?: {
    country: string;
    region?: string;
    ports: string[];
  }[];
  portCapabilities?: {
    portCode: string;
    portName: string;
    capabilities: string[];
  }[];
  certifications?: {
    certificationType: string;
    certificateNumber: string;
    issuedBy: string;
    issueDate: Date;
    expiryDate?: Date;
    documentUrl?: string;
  }[];
}

export interface VendorUpdateData extends Partial<VendorRegistrationData> {
  id: string;
}

export interface VendorPerformanceUpdate {
  vendorId: string;
  qualityRating?: number;
  deliveryRating?: number;
  priceRating?: number;
}

export interface VendorSearchFilters {
  country?: string;
  region?: string;
  portCode?: string;
  capabilities?: string[];
  minRating?: number;
  isActive?: boolean;
  isApproved?: boolean;
}

class VendorService {
  /**
   * Register a new vendor with comprehensive information
   */
  async registerVendor(data: VendorRegistrationData, userId: string): Promise<Vendor> {
    try {
      // Check if vendor code already exists
      const existingVendor = await prisma.vendor.findUnique({
        where: { code: data.code }
      });

      if (existingVendor) {
        throw new AppError('Vendor code already exists', 400, 'VENDOR_CODE_EXISTS');
      }

      // Encrypt sensitive banking details using field-level encryption
      const bankingDataToEncrypt: any = {};
      const encryptedBankingData: any = {};
      
      if (data.accountNumber) {
        bankingDataToEncrypt.accountNumber = data.accountNumber;
        encryptedBankingData.accountNumber = encrypt(data.accountNumber); // Keep legacy encryption for compatibility
      }
      if (data.routingNumber) {
        bankingDataToEncrypt.routingNumber = data.routingNumber;
        encryptedBankingData.routingNumber = encrypt(data.routingNumber); // Keep legacy encryption for compatibility
      }
      if (data.swiftCode) {
        bankingDataToEncrypt.swiftCode = data.swiftCode;
      }

      // Use new field-level encryption for enhanced security
      let fieldEncryptedBankingData = null;
      if (Object.keys(bankingDataToEncrypt).length > 0) {
        fieldEncryptedBankingData = fieldEncryptionService.encryptBankingData(bankingDataToEncrypt);
        
        // Log banking data encryption
        await AuditService.logBankingDataAccess({
          userId: 'system', // This would be the actual user ID in real implementation
          vendorId: 'new-vendor',
          action: 'encrypt',
          fields: Object.keys(bankingDataToEncrypt),
        });
      }

      // Create vendor with related data in a transaction
      const vendor = await prisma.$transaction(async (tx) => {
        // Create the vendor
        const newVendor = await tx.vendor.create({
          data: {
            name: data.name,
            code: data.code,
            email: data.email,
            phone: data.phone,
            website: data.website,
            contactPersonName: data.contactPersonName,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            address: data.address,
            city: data.city,
            country: data.country,
            postalCode: data.postalCode,
            bankName: data.bankName,
            accountNumber: encryptedBankingData.accountNumber,
            routingNumber: encryptedBankingData.routingNumber,
            swiftCode: data.swiftCode,
            encryptedBankingData: fieldEncryptedBankingData,
            bankingDataEncryptedAt: fieldEncryptedBankingData ? new Date() : null,
            taxId: data.taxId,
            registrationNumber: data.registrationNumber,
            paymentTerms: data.paymentTerms,
            creditLimit: data.creditLimit,
            creditLimitCurrency: data.creditLimitCurrency || 'USD',
            isActive: true,
            isApproved: false // Requires approval
          }
        });

        // Create service areas
        if (data.serviceAreas && data.serviceAreas.length > 0) {
          await tx.vendorServiceArea.createMany({
            data: data.serviceAreas.map(area => ({
              vendorId: newVendor.id,
              country: area.country,
              region: area.region,
              ports: area.ports
            }))
          });
        }

        // Create port capabilities
        if (data.portCapabilities && data.portCapabilities.length > 0) {
          await tx.vendorPortCapability.createMany({
            data: data.portCapabilities.map(capability => ({
              vendorId: newVendor.id,
              portCode: capability.portCode,
              portName: capability.portName,
              capabilities: capability.capabilities
            }))
          });
        }

        // Create certifications
        if (data.certifications && data.certifications.length > 0) {
          await tx.vendorCertification.createMany({
            data: data.certifications.map(cert => ({
              vendorId: newVendor.id,
              certificationType: cert.certificationType,
              certificateNumber: cert.certificateNumber,
              issuedBy: cert.issuedBy,
              issueDate: cert.issueDate,
              expiryDate: cert.expiryDate,
              documentUrl: cert.documentUrl
            }))
          });
        }

        return newVendor;
      });

      // Enhanced audit log
      await AuditService.log({
        userId,
        action: 'CREATE',
        resource: 'vendor',
        resourceId: vendor.id,
        newValues: { ...data, accountNumber: '[ENCRYPTED]', routingNumber: '[ENCRYPTED]' },
        severity: 'MEDIUM',
        category: 'DATA_MODIFICATION',
        metadata: {
          bankingDataEncrypted: fieldEncryptedBankingData !== null,
          encryptedFields: Object.keys(bankingDataToEncrypt),
        }
      });

      return vendor;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to register vendor', 500, 'VENDOR_REGISTRATION_FAILED');
    }
  }

  /**
   * Update vendor information
   */
  async updateVendor(data: VendorUpdateData, userId: string): Promise<Vendor> {
    try {
      const existingVendor = await prisma.vendor.findUnique({
        where: { id: data.id }
      });

      if (!existingVendor) {
        throw new AppError('Vendor not found', 404, 'VENDOR_NOT_FOUND');
      }

      // Encrypt sensitive banking details if provided using field-level encryption
      const bankingDataToEncrypt: any = {};
      const encryptedBankingData: any = {};
      
      if (data.accountNumber) {
        bankingDataToEncrypt.accountNumber = data.accountNumber;
        encryptedBankingData.accountNumber = encrypt(data.accountNumber); // Keep legacy encryption for compatibility
      }
      if (data.routingNumber) {
        bankingDataToEncrypt.routingNumber = data.routingNumber;
        encryptedBankingData.routingNumber = encrypt(data.routingNumber); // Keep legacy encryption for compatibility
      }
      if (data.swiftCode) {
        bankingDataToEncrypt.swiftCode = data.swiftCode;
      }

      // Use new field-level encryption for enhanced security
      let fieldEncryptedBankingData = null;
      if (Object.keys(bankingDataToEncrypt).length > 0) {
        fieldEncryptedBankingData = fieldEncryptionService.encryptBankingData(bankingDataToEncrypt);
        
        // Log banking data encryption
        await AuditService.logBankingDataAccess({
          userId,
          vendorId: data.id,
          action: 'encrypt',
          fields: Object.keys(bankingDataToEncrypt),
        });
      }

      const updatedVendor = await prisma.$transaction(async (tx) => {
        // Update vendor basic information
        const vendor = await tx.vendor.update({
          where: { id: data.id },
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            website: data.website,
            contactPersonName: data.contactPersonName,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            address: data.address,
            city: data.city,
            country: data.country,
            postalCode: data.postalCode,
            bankName: data.bankName,
            accountNumber: encryptedBankingData.accountNumber || existingVendor.accountNumber,
            routingNumber: encryptedBankingData.routingNumber || existingVendor.routingNumber,
            swiftCode: data.swiftCode,
            encryptedBankingData: fieldEncryptedBankingData || existingVendor.encryptedBankingData,
            bankingDataEncryptedAt: fieldEncryptedBankingData ? new Date() : existingVendor.bankingDataEncryptedAt,
            bankingDataLastAccessed: new Date(),
            taxId: data.taxId,
            registrationNumber: data.registrationNumber,
            paymentTerms: data.paymentTerms,
            creditLimit: data.creditLimit,
            creditLimitCurrency: data.creditLimitCurrency
          }
        });

        // Update service areas if provided
        if (data.serviceAreas) {
          await tx.vendorServiceArea.deleteMany({
            where: { vendorId: data.id }
          });
          
          if (data.serviceAreas.length > 0) {
            await tx.vendorServiceArea.createMany({
              data: data.serviceAreas.map(area => ({
                vendorId: data.id,
                country: area.country,
                region: area.region,
                ports: area.ports
              }))
            });
          }
        }

        // Update port capabilities if provided
        if (data.portCapabilities) {
          await tx.vendorPortCapability.deleteMany({
            where: { vendorId: data.id }
          });
          
          if (data.portCapabilities.length > 0) {
            await tx.vendorPortCapability.createMany({
              data: data.portCapabilities.map(capability => ({
                vendorId: data.id,
                portCode: capability.portCode,
                portName: capability.portName,
                capabilities: capability.capabilities
              }))
            });
          }
        }

        // Update certifications if provided
        if (data.certifications) {
          await tx.vendorCertification.deleteMany({
            where: { vendorId: data.id }
          });
          
          if (data.certifications.length > 0) {
            await tx.vendorCertification.createMany({
              data: data.certifications.map(cert => ({
                vendorId: data.id,
                certificationType: cert.certificationType,
                certificateNumber: cert.certificateNumber,
                issuedBy: cert.issuedBy,
                issueDate: cert.issueDate,
                expiryDate: cert.expiryDate,
                documentUrl: cert.documentUrl
              }))
            });
          }
        }

        return vendor;
      });

      // Enhanced audit log
      await AuditService.log({
        userId,
        action: 'UPDATE',
        resource: 'vendor',
        resourceId: data.id,
        oldValues: { ...existingVendor, accountNumber: '[ENCRYPTED]', routingNumber: '[ENCRYPTED]' },
        newValues: { ...data, accountNumber: '[ENCRYPTED]', routingNumber: '[ENCRYPTED]' },
        severity: 'MEDIUM',
        category: 'DATA_MODIFICATION',
        metadata: {
          bankingDataUpdated: fieldEncryptedBankingData !== null,
          encryptedFields: Object.keys(bankingDataToEncrypt),
        }
      });

      return updatedVendor;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update vendor', 500, 'VENDOR_UPDATE_FAILED');
    }
  }

  /**
   * Get vendor by ID with all related data
   */
  async getVendorById(id: string, includeDecryptedBanking = false): Promise<any> {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id },
        include: {
          serviceAreas: true,
          portCapabilities: true,
          certifications: true,
          rfqs: {
            include: {
              rfq: {
                include: {
                  requisition: {
                    include: {
                      vessel: true
                    }
                  }
                }
              }
            }
          },
          quotes: {
            include: {
              rfq: {
                include: {
                  requisition: {
                    include: {
                      vessel: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!vendor) {
        throw new AppError('Vendor not found', 404, 'VENDOR_NOT_FOUND');
      }

      // Decrypt banking details if requested and available
      if (includeDecryptedBanking) {
        // Try field-level decryption first (new method)
        if (vendor.encryptedBankingData) {
          try {
            const decryptedBankingData = fieldEncryptionService.decryptBankingData(vendor.encryptedBankingData);
            Object.assign(vendor, decryptedBankingData);
            
            // Log banking data access
            await AuditService.logBankingDataAccess({
              userId: 'system', // This would be the actual user ID in real implementation
              vendorId: vendor.id,
              action: 'decrypt',
              fields: Object.keys(decryptedBankingData),
            });
            
            // Update last accessed timestamp
            await prisma.vendor.update({
              where: { id: vendor.id },
              data: { bankingDataLastAccessed: new Date() },
            });
          } catch (error) {
            logger.error('Failed to decrypt field-level banking data', { vendorId: vendor.id, error: error.message });
          }
        }
        
        // Fallback to legacy decryption
        if (vendor.accountNumber && !vendor.encryptedBankingData) {
          vendor.accountNumber = decrypt(vendor.accountNumber);
        }
        if (vendor.routingNumber && !vendor.encryptedBankingData) {
          vendor.routingNumber = decrypt(vendor.routingNumber);
        }
      }

      return vendor;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get vendor', 500, 'VENDOR_FETCH_FAILED');
    }
  }

  /**
   * Search vendors with filters
   */
  async searchVendors(filters: VendorSearchFilters = {}): Promise<Vendor[]> {
    try {
      const whereClause: any = {};

      if (filters.isActive !== undefined) {
        whereClause.isActive = filters.isActive;
      }

      if (filters.isApproved !== undefined) {
        whereClause.isApproved = filters.isApproved;
      }

      if (filters.minRating) {
        whereClause.overallScore = {
          gte: filters.minRating
        };
      }

      // Service area filters
      if (filters.country || filters.region || filters.portCode) {
        whereClause.serviceAreas = {
          some: {
            ...(filters.country && { country: filters.country }),
            ...(filters.region && { region: filters.region }),
            ...(filters.portCode && { ports: { has: filters.portCode } })
          }
        };
      }

      // Port capability filters
      if (filters.capabilities && filters.capabilities.length > 0) {
        whereClause.portCapabilities = {
          some: {
            capabilities: {
              hasSome: filters.capabilities
            }
          }
        };
      }

      const vendors = await prisma.vendor.findMany({
        where: whereClause,
        include: {
          serviceAreas: true,
          portCapabilities: true,
          certifications: true
        },
        orderBy: [
          { overallScore: 'desc' },
          { name: 'asc' }
        ]
      });

      return vendors;
    } catch (error) {
      throw new AppError('Failed to search vendors', 500, 'VENDOR_SEARCH_FAILED');
    }
  }

  /**
   * Update vendor performance ratings
   */
  async updateVendorPerformance(data: VendorPerformanceUpdate, userId: string): Promise<Vendor> {
    try {
      const existingVendor = await prisma.vendor.findUnique({
        where: { id: data.vendorId }
      });

      if (!existingVendor) {
        throw new AppError('Vendor not found', 404, 'VENDOR_NOT_FOUND');
      }

      // Calculate overall score based on weighted average
      // Price (40%), Delivery (30%), Quality (20%), Location (10%)
      const qualityRating = data.qualityRating ?? existingVendor.qualityRating;
      const deliveryRating = data.deliveryRating ?? existingVendor.deliveryRating;
      const priceRating = data.priceRating ?? existingVendor.priceRating;

      const overallScore = (
        (priceRating * 0.4) +
        (deliveryRating * 0.3) +
        (qualityRating * 0.2) +
        (5 * 0.1) // Location score placeholder - would be calculated based on proximity
      );

      const updatedVendor = await prisma.vendor.update({
        where: { id: data.vendorId },
        data: {
          qualityRating,
          deliveryRating,
          priceRating,
          overallScore
        }
      });

      // Audit log
      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'vendor_performance',
        resourceId: data.vendorId,
        oldValues: {
          qualityRating: existingVendor.qualityRating,
          deliveryRating: existingVendor.deliveryRating,
          priceRating: existingVendor.priceRating,
          overallScore: existingVendor.overallScore
        },
        newValues: {
          qualityRating,
          deliveryRating,
          priceRating,
          overallScore
        }
      });

      return updatedVendor;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update vendor performance', 500, 'VENDOR_PERFORMANCE_UPDATE_FAILED');
    }
  }

  /**
   * Approve or reject vendor
   */
  async updateVendorApprovalStatus(vendorId: string, isApproved: boolean, userId: string): Promise<Vendor> {
    try {
      const existingVendor = await prisma.vendor.findUnique({
        where: { id: vendorId }
      });

      if (!existingVendor) {
        throw new AppError('Vendor not found', 404, 'VENDOR_NOT_FOUND');
      }

      const updatedVendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { isApproved }
      });

      // Audit log
      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'vendor_approval',
        resourceId: vendorId,
        oldValues: { isApproved: existingVendor.isApproved },
        newValues: { isApproved }
      });

      return updatedVendor;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update vendor approval status', 500, 'VENDOR_APPROVAL_UPDATE_FAILED');
    }
  }

  /**
   * Get vendors by service area and capabilities
   */
  async getVendorsByLocationAndCapabilities(
    country: string,
    portCode?: string,
    capabilities?: string[]
  ): Promise<Vendor[]> {
    try {
      const whereClause: any = {
        isActive: true,
        isApproved: true,
        serviceAreas: {
          some: {
            country,
            ...(portCode && { ports: { has: portCode } })
          }
        }
      };

      if (capabilities && capabilities.length > 0) {
        whereClause.portCapabilities = {
          some: {
            ...(portCode && { portCode }),
            capabilities: {
              hasSome: capabilities
            }
          }
        };
      }

      const vendors = await prisma.vendor.findMany({
        where: whereClause,
        include: {
          serviceAreas: true,
          portCapabilities: true,
          certifications: true
        },
        orderBy: { overallScore: 'desc' }
      });

      return vendors;
    } catch (error) {
      throw new AppError('Failed to get vendors by location and capabilities', 500, 'VENDOR_LOCATION_SEARCH_FAILED');
    }
  }

  /**
   * Get vendor performance statistics
   */
  async getVendorPerformanceStats(vendorId: string): Promise<any> {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
          quotes: {
            include: {
              rfq: {
                include: {
                  requisition: true
                }
              }
            }
          },
          purchaseOrders: {
            include: {
              deliveries: true,
              invoices: true
            }
          }
        }
      });

      if (!vendor) {
        throw new AppError('Vendor not found', 404, 'VENDOR_NOT_FOUND');
      }

      // Calculate performance statistics
      const totalQuotes = vendor.quotes.length;
      const acceptedQuotes = vendor.quotes.filter(q => q.status === 'ACCEPTED').length;
      const totalOrders = vendor.purchaseOrders.length;
      const completedOrders = vendor.purchaseOrders.filter(po => po.status === 'DELIVERED').length;
      const onTimeDeliveries = vendor.purchaseOrders.filter(po => 
        po.deliveries.some(d => d.status === 'DELIVERED' && d.actualDate && d.scheduledDate && d.actualDate <= d.scheduledDate)
      ).length;

      return {
        vendorId,
        name: vendor.name,
        overallScore: vendor.overallScore,
        qualityRating: vendor.qualityRating,
        deliveryRating: vendor.deliveryRating,
        priceRating: vendor.priceRating,
        statistics: {
          totalQuotes,
          acceptedQuotes,
          quoteAcceptanceRate: totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0,
          totalOrders,
          completedOrders,
          orderCompletionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
          onTimeDeliveryRate: totalOrders > 0 ? (onTimeDeliveries / totalOrders) * 100 : 0
        }
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get vendor performance statistics', 500, 'VENDOR_STATS_FAILED');
    }
  }

  /**
   * Get expiring vendor certifications
   */
  async getExpiringCertifications(daysAhead = 30): Promise<any[]> {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + daysAhead);

      const expiringCertifications = await prisma.vendorCertification.findMany({
        where: {
          expiryDate: {
            lte: expiryDate,
            gte: new Date()
          }
        },
        include: {
          vendor: true
        },
        orderBy: { expiryDate: 'asc' }
      });

      return expiringCertifications;
    } catch (error) {
      throw new AppError('Failed to get expiring certifications', 500, 'CERTIFICATION_EXPIRY_FETCH_FAILED');
    }
  }
}

export const vendorService = new VendorService();