import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuditService } from './auditService';

const prisma = new PrismaClient();

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  title: string;
  content?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  checksum: string;
  createdBy: string;
  createdAt: Date;
  changeDescription?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface DocumentChangeLog {
  id: string;
  documentId: string;
  fromVersion: number;
  toVersion: number;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  changedBy: string;
  changedAt: Date;
  changeDescription: string;
  fieldChanges: DocumentFieldChange[];
}

export interface DocumentFieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'ADDED' | 'MODIFIED' | 'REMOVED';
}

export interface ComplianceFlag {
  id: string;
  documentId: string;
  regulation: string;
  regulationType: 'SOLAS' | 'MARPOL' | 'ISM' | 'GDPR' | 'SOX' | 'CUSTOM';
  flagType: 'REQUIRED' | 'COMPLIANT' | 'NON_COMPLIANT' | 'UNDER_REVIEW';
  description: string;
  dueDate?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  vesselId?: string;
  metadata: Record<string, any>;
}

export class DocumentVersionService {
  /**
   * Create a new document version
   */
  static async createDocumentVersion(data: {
    documentId: string;
    title: string;
    content?: string;
    fileUrl?: string;
    fileSize?: number;
    mimeType?: string;
    checksum: string;
    createdBy: string;
    changeDescription?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }): Promise<DocumentVersion> {
    try {
      // Get the latest version number
      const latestVersion = await this.getLatestVersion(data.documentId);
      const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

      // Create new version
      const version = await prisma.documentVersion.create({
        data: {
          documentId: data.documentId,
          version: newVersionNumber,
          title: data.title,
          content: data.content,
          fileUrl: data.fileUrl,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          checksum: data.checksum,
          createdBy: data.createdBy,
          changeDescription: data.changeDescription,
          tags: data.tags || [],
          metadata: data.metadata || {},
        },
      });

      // Create change log entry
      await this.createChangeLog({
        documentId: data.documentId,
        fromVersion: latestVersion?.version || 0,
        toVersion: newVersionNumber,
        changeType: latestVersion ? 'UPDATE' : 'CREATE',
        changedBy: data.createdBy,
        changeDescription: data.changeDescription || (latestVersion ? 'Document updated' : 'Document created'),
        fieldChanges: latestVersion ? await this.calculateFieldChanges(latestVersion, version) : [],
      });

      // Log compliance event
      await AuditService.logComplianceEvent({
        userId: data.createdBy,
        regulation: 'Document Management',
        complianceType: 'SOX',
        action: 'DOCUMENT_VERSION_CREATED',
        details: {
          documentId: data.documentId,
          version: newVersionNumber,
          changeDescription: data.changeDescription,
        },
      });

      logger.info('Document version created', {
        documentId: data.documentId,
        version: newVersionNumber,
        createdBy: data.createdBy,
      });

      return version as DocumentVersion;
    } catch (error) {
      logger.error('Failed to create document version', {
        error: error.message,
        documentId: data.documentId,
      });
      throw error;
    }
  }

  /**
   * Get latest version of a document
   */
  static async getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
    try {
      const version = await prisma.documentVersion.findFirst({
        where: { documentId },
        orderBy: { version: 'desc' },
      });

      return version as DocumentVersion | null;
    } catch (error) {
      logger.error('Failed to get latest document version', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  /**
   * Get specific version of a document
   */
  static async getDocumentVersion(documentId: string, version: number): Promise<DocumentVersion | null> {
    try {
      const docVersion = await prisma.documentVersion.findFirst({
        where: {
          documentId,
          version,
        },
      });

      return docVersion as DocumentVersion | null;
    } catch (error) {
      logger.error('Failed to get document version', {
        error: error.message,
        documentId,
        version,
      });
      throw error;
    }
  }

  /**
   * Get all versions of a document
   */
  static async getDocumentVersionHistory(documentId: string): Promise<DocumentVersion[]> {
    try {
      const versions = await prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { version: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return versions as DocumentVersion[];
    } catch (error) {
      logger.error('Failed to get document version history', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  /**
   * Create change log entry
   */
  private static async createChangeLog(data: {
    documentId: string;
    fromVersion: number;
    toVersion: number;
    changeType: DocumentChangeLog['changeType'];
    changedBy: string;
    changeDescription: string;
    fieldChanges: DocumentFieldChange[];
  }): Promise<DocumentChangeLog> {
    try {
      const changeLog = await prisma.documentChangeLog.create({
        data: {
          documentId: data.documentId,
          fromVersion: data.fromVersion,
          toVersion: data.toVersion,
          changeType: data.changeType,
          changedBy: data.changedBy,
          changeDescription: data.changeDescription,
          fieldChanges: data.fieldChanges,
        },
      });

      return changeLog as DocumentChangeLog;
    } catch (error) {
      logger.error('Failed to create document change log', {
        error: error.message,
        documentId: data.documentId,
      });
      throw error;
    }
  }

  /**
   * Calculate field changes between versions
   */
  private static async calculateFieldChanges(
    oldVersion: DocumentVersion,
    newVersion: DocumentVersion
  ): Promise<DocumentFieldChange[]> {
    const changes: DocumentFieldChange[] = [];

    // Compare title
    if (oldVersion.title !== newVersion.title) {
      changes.push({
        field: 'title',
        oldValue: oldVersion.title,
        newValue: newVersion.title,
        changeType: 'MODIFIED',
      });
    }

    // Compare content
    if (oldVersion.content !== newVersion.content) {
      changes.push({
        field: 'content',
        oldValue: oldVersion.content ? '[CONTENT]' : null,
        newValue: newVersion.content ? '[CONTENT]' : null,
        changeType: 'MODIFIED',
      });
    }

    // Compare tags
    const oldTags = new Set(oldVersion.tags);
    const newTags = new Set(newVersion.tags);

    // Added tags
    for (const tag of newTags) {
      if (!oldTags.has(tag)) {
        changes.push({
          field: 'tags',
          oldValue: null,
          newValue: tag,
          changeType: 'ADDED',
        });
      }
    }

    // Removed tags
    for (const tag of oldTags) {
      if (!newTags.has(tag)) {
        changes.push({
          field: 'tags',
          oldValue: tag,
          newValue: null,
          changeType: 'REMOVED',
        });
      }
    }

    // Compare metadata
    const oldMetadata = oldVersion.metadata || {};
    const newMetadata = newVersion.metadata || {};

    const allMetadataKeys = new Set([...Object.keys(oldMetadata), ...Object.keys(newMetadata)]);

    for (const key of allMetadataKeys) {
      const oldValue = oldMetadata[key];
      const newValue = newMetadata[key];

      if (oldValue !== newValue) {
        let changeType: DocumentFieldChange['changeType'];
        if (oldValue === undefined) changeType = 'ADDED';
        else if (newValue === undefined) changeType = 'REMOVED';
        else changeType = 'MODIFIED';

        changes.push({
          field: `metadata.${key}`,
          oldValue,
          newValue,
          changeType,
        });
      }
    }

    return changes;
  }

  /**
   * Get document change history
   */
  static async getDocumentChangeHistory(documentId: string): Promise<DocumentChangeLog[]> {
    try {
      const changeLogs = await prisma.documentChangeLog.findMany({
        where: { documentId },
        orderBy: { changedAt: 'desc' },
        include: {
          changer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return changeLogs as DocumentChangeLog[];
    } catch (error) {
      logger.error('Failed to get document change history', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  /**
   * Restore document to a specific version
   */
  static async restoreDocumentVersion(
    documentId: string,
    targetVersion: number,
    restoredBy: string,
    reason: string
  ): Promise<DocumentVersion> {
    try {
      const targetVersionDoc = await this.getDocumentVersion(documentId, targetVersion);
      if (!targetVersionDoc) {
        throw new Error(`Version ${targetVersion} not found for document ${documentId}`);
      }

      const currentVersion = await this.getLatestVersion(documentId);
      if (!currentVersion) {
        throw new Error(`No current version found for document ${documentId}`);
      }

      // Create new version based on target version
      const restoredVersion = await this.createDocumentVersion({
        documentId,
        title: targetVersionDoc.title,
        content: targetVersionDoc.content,
        fileUrl: targetVersionDoc.fileUrl,
        fileSize: targetVersionDoc.fileSize,
        mimeType: targetVersionDoc.mimeType,
        checksum: targetVersionDoc.checksum,
        createdBy: restoredBy,
        changeDescription: `Restored to version ${targetVersion}: ${reason}`,
        tags: targetVersionDoc.tags,
        metadata: {
          ...targetVersionDoc.metadata,
          restoredFrom: targetVersion,
          restorationReason: reason,
        },
      });

      // Create restore change log
      await this.createChangeLog({
        documentId,
        fromVersion: currentVersion.version,
        toVersion: restoredVersion.version,
        changeType: 'RESTORE',
        changedBy: restoredBy,
        changeDescription: `Restored to version ${targetVersion}: ${reason}`,
        fieldChanges: await this.calculateFieldChanges(currentVersion, restoredVersion),
      });

      logger.info('Document version restored', {
        documentId,
        fromVersion: currentVersion.version,
        toVersion: targetVersion,
        newVersion: restoredVersion.version,
        restoredBy,
      });

      return restoredVersion;
    } catch (error) {
      logger.error('Failed to restore document version', {
        error: error.message,
        documentId,
        targetVersion,
      });
      throw error;
    }
  }

  /**
   * Add compliance flag to document
   */
  static async addComplianceFlag(data: {
    documentId: string;
    regulation: string;
    regulationType: ComplianceFlag['regulationType'];
    flagType: ComplianceFlag['flagType'];
    description: string;
    dueDate?: Date;
    vesselId?: string;
    metadata?: Record<string, any>;
    flaggedBy: string;
  }): Promise<ComplianceFlag> {
    try {
      const flag = await prisma.complianceFlag.create({
        data: {
          documentId: data.documentId,
          regulation: data.regulation,
          regulationType: data.regulationType,
          flagType: data.flagType,
          description: data.description,
          dueDate: data.dueDate,
          vesselId: data.vesselId,
          metadata: data.metadata || {},
        },
      });

      // Log compliance event
      await AuditService.logComplianceEvent({
        userId: data.flaggedBy,
        regulation: data.regulation,
        complianceType: data.regulationType,
        action: 'COMPLIANCE_FLAG_ADDED',
        vesselId: data.vesselId,
        details: {
          documentId: data.documentId,
          flagType: data.flagType,
          description: data.description,
          dueDate: data.dueDate,
        },
      });

      logger.info('Compliance flag added to document', {
        documentId: data.documentId,
        regulation: data.regulation,
        flagType: data.flagType,
      });

      return flag as ComplianceFlag;
    } catch (error) {
      logger.error('Failed to add compliance flag', {
        error: error.message,
        documentId: data.documentId,
      });
      throw error;
    }
  }

  /**
   * Resolve compliance flag
   */
  static async resolveComplianceFlag(
    flagId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<ComplianceFlag> {
    try {
      const flag = await prisma.complianceFlag.update({
        where: { id: flagId },
        data: {
          resolvedAt: new Date(),
          resolvedBy,
          metadata: {
            resolution,
          },
        },
      });

      // Log compliance event
      await AuditService.logComplianceEvent({
        userId: resolvedBy,
        regulation: flag.regulation,
        complianceType: flag.regulationType,
        action: 'COMPLIANCE_FLAG_RESOLVED',
        vesselId: flag.vesselId,
        details: {
          flagId,
          resolution,
          originalDescription: flag.description,
        },
      });

      logger.info('Compliance flag resolved', {
        flagId,
        resolvedBy,
        regulation: flag.regulation,
      });

      return flag as ComplianceFlag;
    } catch (error) {
      logger.error('Failed to resolve compliance flag', {
        error: error.message,
        flagId,
      });
      throw error;
    }
  }

  /**
   * Get compliance flags for document
   */
  static async getDocumentComplianceFlags(documentId: string): Promise<ComplianceFlag[]> {
    try {
      const flags = await prisma.complianceFlag.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        include: {
          resolver: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return flags as ComplianceFlag[];
    } catch (error) {
      logger.error('Failed to get document compliance flags', {
        error: error.message,
        documentId,
      });
      throw error;
    }
  }

  /**
   * Get compliance flags by regulation type
   */
  static async getComplianceFlagsByRegulation(
    regulationType: ComplianceFlag['regulationType'],
    vesselId?: string
  ): Promise<ComplianceFlag[]> {
    try {
      const where: any = { regulationType };
      if (vesselId) {
        where.vesselId = vesselId;
      }

      const flags = await prisma.complianceFlag.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          document: {
            select: {
              id: true,
              title: true,
            },
          },
          resolver: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return flags as ComplianceFlag[];
    } catch (error) {
      logger.error('Failed to get compliance flags by regulation', {
        error: error.message,
        regulationType,
      });
      throw error;
    }
  }
}

export const documentVersionService = DocumentVersionService;