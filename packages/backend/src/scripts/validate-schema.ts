/**
 * Schema Validation Script
 * Validates the Prisma schema structure and relationships
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalModels: number;
    totalEnums: number;
    totalIndexes: number;
    totalRelations: number;
  };
}

class SchemaValidator {
  private schemaContent: string;
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor() {
    try {
      this.schemaContent = readFileSync(
        join(process.cwd(), 'prisma', 'schema.prisma'),
        'utf-8'
      );
    } catch (error) {
      throw new Error('Could not read schema.prisma file');
    }
  }

  validate(): ValidationResult {
    console.log('🔍 Validating FlowMarine database schema...\n');

    this.validateBasicStructure();
    this.validateEnums();
    this.validateModels();
    this.validateRelationships();
    this.validateIndexes();
    this.validateMaritimeRequirements();

    const summary = this.generateSummary();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      summary
    };
  }

  private validateBasicStructure(): void {
    console.log('📋 Validating basic schema structure...');

    // Check for required sections
    const requiredSections = [
      'generator client',
      'datasource db',
      'enum UserRole',
      'model User'
    ];

    requiredSections.forEach(section => {
      if (!this.schemaContent.includes(section)) {
        this.errors.push(`Missing required section: ${section}`);
      }
    });

    // Check datasource configuration
    if (!this.schemaContent.includes('provider = "postgresql"')) {
      this.errors.push('Database provider should be PostgreSQL');
    }

    console.log('✅ Basic structure validation complete\n');
  }

  private validateEnums(): void {
    console.log('🏷️  Validating enums...');

    const requiredEnums = [
      'UserRole',
      'UrgencyLevel',
      'RequisitionStatus',
      'ApprovalStatus',
      'ItemCategory',
      'CriticalityLevel',
      'RFQStatus',
      'QuoteStatus',
      'POStatus',
      'DeliveryStatus',
      'InvoiceStatus',
      'AuditAction'
    ];

    requiredEnums.forEach(enumName => {
      if (!this.schemaContent.includes(`enum ${enumName}`)) {
        this.errors.push(`Missing required enum: ${enumName}`);
      }
    });

    // Validate UserRole enum values
    const userRoleValues = [
      'VESSEL_CREW',
      'CHIEF_ENGINEER',
      'CAPTAIN',
      'SUPERINTENDENT',
      'PROCUREMENT_MANAGER',
      'FINANCE_TEAM',
      'ADMIN'
    ];

    userRoleValues.forEach(value => {
      if (!this.schemaContent.includes(value)) {
        this.errors.push(`Missing UserRole value: ${value}`);
      }
    });

    // Validate ItemCategory enum values
    const itemCategoryValues = [
      'ENGINE_PARTS',
      'DECK_EQUIPMENT',
      'SAFETY_GEAR',
      'NAVIGATION',
      'CATERING',
      'MAINTENANCE'
    ];

    itemCategoryValues.forEach(value => {
      if (!this.schemaContent.includes(value)) {
        this.errors.push(`Missing ItemCategory value: ${value}`);
      }
    });

    console.log('✅ Enum validation complete\n');
  }

  private validateModels(): void {
    console.log('📊 Validating models...');

    const requiredModels = [
      // User Management
      'User',
      'Permission',
      'UserPermission',
      'RefreshToken',
      'Delegation',

      // Vessel Management
      'Vessel',
      'VesselAssignment',
      'VesselCertificate',
      'VesselSpecification',

      // Item Catalog
      'ItemCatalog',

      // Procurement
      'Requisition',
      'RequisitionItem',
      'Approval',

      // Vendor Management
      'Vendor',
      'VendorServiceArea',
      'VendorPortCapability',
      'VendorCertification',

      // RFQ and Quotes
      'RFQ',
      'RFQVendor',
      'Quote',
      'QuoteLineItem',

      // Purchase Orders
      'PurchaseOrder',
      'POLineItem',
      'Delivery',
      'Invoice',

      // Financial
      'CostCenter',
      'Budget',
      'ExchangeRate',

      // System
      'AuditLog',
      'SystemSetting',
      'NotificationTemplate'
    ];

    requiredModels.forEach(modelName => {
      if (!this.schemaContent.includes(`model ${modelName}`)) {
        this.errors.push(`Missing required model: ${modelName}`);
      }
    });

    console.log('✅ Model validation complete\n');
  }

  private validateRelationships(): void {
    console.log('🔗 Validating relationships...');

    const criticalRelationships = [
      // User-Vessel relationships
      { from: 'User', to: 'VesselAssignment', field: 'vessels' },
      { from: 'Vessel', to: 'VesselAssignment', field: 'assignments' },

      // Requisition relationships
      { from: 'Requisition', to: 'Vessel', field: 'vessel' },
      { from: 'Requisition', to: 'User', field: 'requestedBy' },
      { from: 'Requisition', to: 'RequisitionItem', field: 'items' },

      // Approval relationships
      { from: 'Approval', to: 'Requisition', field: 'requisition' },
      { from: 'Approval', to: 'User', field: 'approver' },

      // Vendor relationships
      { from: 'Vendor', to: 'Quote', field: 'quotes' },
      { from: 'Quote', to: 'RFQ', field: 'rfq' },

      // Purchase Order relationships
      { from: 'PurchaseOrder', to: 'Quote', field: 'quote' },
      { from: 'PurchaseOrder', to: 'Vendor', field: 'vendor' },
      { from: 'PurchaseOrder', to: 'Vessel', field: 'vessel' }
    ];

    criticalRelationships.forEach(rel => {
      const relationshipPattern = new RegExp(`${rel.field}\\s+${rel.to}`, 'g');
      if (!relationshipPattern.test(this.schemaContent)) {
        this.warnings.push(`Potential missing relationship: ${rel.from}.${rel.field} -> ${rel.to}`);
      }
    });

    console.log('✅ Relationship validation complete\n');
  }

  private validateIndexes(): void {
    console.log('📇 Validating indexes...');

    const criticalIndexes = [
      // User indexes
      '@@index([email])',
      '@@index([role])',

      // Vessel indexes
      '@@index([imoNumber])',
      '@@index([vesselType])',

      // Requisition indexes
      '@@index([vesselId])',
      '@@index([status])',
      '@@index([urgencyLevel])',

      // Item catalog indexes
      '@@index([impaCode])',
      '@@index([issaCode])',
      '@@index([category])',

      // Vendor indexes
      '@@index([code])',
      '@@index([isActive])',

      // Audit indexes
      '@@index([userId])',
      '@@index([action])',
      '@@index([createdAt])'
    ];

    criticalIndexes.forEach(index => {
      if (!this.schemaContent.includes(index)) {
        this.warnings.push(`Missing recommended index: ${index}`);
      }
    });

    console.log('✅ Index validation complete\n');
  }

  private validateMaritimeRequirements(): void {
    console.log('⚓ Validating maritime-specific requirements...');

    // Requirement 2.1: IMPA/ISSA catalog integration
    if (!this.schemaContent.includes('impaCode') || !this.schemaContent.includes('issaCode')) {
      this.errors.push('Missing IMPA/ISSA code fields in ItemCatalog (Requirement 2.1)');
    }

    // Requirement 2.2: Vessel specifications
    if (!this.schemaContent.includes('compatibleVesselTypes') || !this.schemaContent.includes('compatibleEngineTypes')) {
      this.errors.push('Missing vessel compatibility fields (Requirement 2.2)');
    }

    // Requirement 2.3: Maritime categories
    const maritimeCategories = ['ENGINE_PARTS', 'DECK_EQUIPMENT', 'SAFETY_GEAR', 'NAVIGATION'];
    const hasMaritime = maritimeCategories.some(cat => this.schemaContent.includes(cat));
    if (!hasMaritime) {
      this.errors.push('Missing maritime-specific categories (Requirement 2.3)');
    }

    // Requirement 13.1: Vessel data management
    if (!this.schemaContent.includes('currentLatitude') || !this.schemaContent.includes('currentLongitude')) {
      this.errors.push('Missing vessel position tracking (Requirement 13.1)');
    }

    // Requirement 13.2: Certificate tracking
    if (!this.schemaContent.includes('VesselCertificate') || !this.schemaContent.includes('expiryDate')) {
      this.errors.push('Missing certificate tracking system (Requirement 13.2)');
    }

    // Emergency override capability
    if (!this.schemaContent.includes('emergencyOverride')) {
      this.errors.push('Missing emergency override capability');
    }

    // Multi-currency support
    if (!this.schemaContent.includes('ExchangeRate') || !this.schemaContent.includes('currency')) {
      this.errors.push('Missing multi-currency support');
    }

    // Audit trail
    if (!this.schemaContent.includes('AuditLog') || !this.schemaContent.includes('AuditAction')) {
      this.errors.push('Missing comprehensive audit trail');
    }

    console.log('✅ Maritime requirements validation complete\n');
  }

  private generateSummary(): ValidationResult['summary'] {
    const modelMatches = this.schemaContent.match(/model \w+/g) || [];
    const enumMatches = this.schemaContent.match(/enum \w+/g) || [];
    const indexMatches = this.schemaContent.match(/@@index/g) || [];
    const relationMatches = this.schemaContent.match(/@relation/g) || [];

    return {
      totalModels: modelMatches.length,
      totalEnums: enumMatches.length,
      totalIndexes: indexMatches.length,
      totalRelations: relationMatches.length
    };
  }
}

// Run validation
try {
  const validator = new SchemaValidator();
  const result = validator.validate();

  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Models: ${result.summary.totalModels}`);
  console.log(`Total Enums: ${result.summary.totalEnums}`);
  console.log(`Total Indexes: ${result.summary.totalIndexes}`);
  console.log(`Total Relations: ${result.summary.totalRelations}`);
  console.log('='.repeat(50));

  if (result.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    result.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }

  if (result.isValid) {
    console.log('\n✅ SCHEMA VALIDATION PASSED!');
    console.log('The FlowMarine database schema is valid and ready for use.');
  } else {
    console.log('\n❌ SCHEMA VALIDATION FAILED!');
    console.log('Please fix the errors above before proceeding.');
  }

  console.log('\n🚀 Next Steps:');
  console.log('1. Set up your PostgreSQL database');
  console.log('2. Configure your .env file');
  console.log('3. Run: npm run db:generate');
  console.log('4. Run: npm run db:migrate');
  console.log('5. Run: npm run db:seed');

} catch (error) {
  console.error('❌ Validation failed:', error);
  process.exit(1);
}