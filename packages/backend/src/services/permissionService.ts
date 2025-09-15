import { PrismaClient, UserRole, Permission, User } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Comprehensive permission definitions for all system functions
export const PERMISSIONS = {
  // User Management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE_ROLES: 'user:manage_roles',
  USER_MANAGE_PERMISSIONS: 'user:manage_permissions',

  // Vessel Management
  VESSEL_CREATE: 'vessel:create',
  VESSEL_READ: 'vessel:read',
  VESSEL_UPDATE: 'vessel:update',
  VESSEL_DELETE: 'vessel:delete',
  VESSEL_ASSIGN_USERS: 'vessel:assign_users',
  VESSEL_MANAGE_CERTIFICATES: 'vessel:manage_certificates',

  // Requisition Management
  REQUISITION_CREATE: 'requisition:create',
  REQUISITION_READ: 'requisition:read',
  REQUISITION_UPDATE: 'requisition:update',
  REQUISITION_DELETE: 'requisition:delete',
  REQUISITION_SUBMIT: 'requisition:submit',
  REQUISITION_CANCEL: 'requisition:cancel',

  // Approval Workflow
  APPROVAL_LEVEL_1: 'approval:level_1', // Up to $500
  APPROVAL_LEVEL_2: 'approval:level_2', // Up to $5,000
  APPROVAL_LEVEL_3: 'approval:level_3', // Up to $25,000
  APPROVAL_LEVEL_4: 'approval:level_4', // Above $25,000
  APPROVAL_EMERGENCY_OVERRIDE: 'approval:emergency_override',
  APPROVAL_DELEGATE: 'approval:delegate',

  // Vendor Management
  VENDOR_CREATE: 'vendor:create',
  VENDOR_READ: 'vendor:read',
  VENDOR_UPDATE: 'vendor:update',
  VENDOR_DELETE: 'vendor:delete',
  VENDOR_APPROVE: 'vendor:approve',
  VENDOR_MANAGE_RATINGS: 'vendor:manage_ratings',

  // RFQ Management
  RFQ_CREATE: 'rfq:create',
  RFQ_READ: 'rfq:read',
  RFQ_UPDATE: 'rfq:update',
  RFQ_DELETE: 'rfq:delete',
  RFQ_SEND: 'rfq:send',
  RFQ_EVALUATE: 'rfq:evaluate',

  // Quote Management
  QUOTE_CREATE: 'quote:create',
  QUOTE_READ: 'quote:read',
  QUOTE_UPDATE: 'quote:update',
  QUOTE_DELETE: 'quote:delete',
  QUOTE_COMPARE: 'quote:compare',
  QUOTE_APPROVE: 'quote:approve',

  // Purchase Order Management
  PO_CREATE: 'po:create',
  PO_READ: 'po:read',
  PO_UPDATE: 'po:update',
  PO_DELETE: 'po:delete',
  PO_APPROVE: 'po:approve',
  PO_SEND: 'po:send',

  // Invoice Management
  INVOICE_CREATE: 'invoice:create',
  INVOICE_READ: 'invoice:read',
  INVOICE_UPDATE: 'invoice:update',
  INVOICE_DELETE: 'invoice:delete',
  INVOICE_APPROVE: 'invoice:approve',
  INVOICE_PROCESS_PAYMENT: 'invoice:process_payment',

  // Financial Management
  FINANCE_VIEW_BUDGETS: 'finance:view_budgets',
  FINANCE_MANAGE_BUDGETS: 'finance:manage_budgets',
  FINANCE_VIEW_REPORTS: 'finance:view_reports',
  FINANCE_MANAGE_COST_CENTERS: 'finance:manage_cost_centers',
  FINANCE_PROCESS_PAYMENTS: 'finance:process_payments',

  // Analytics and Reporting
  ANALYTICS_VIEW_DASHBOARD: 'analytics:view_dashboard',
  ANALYTICS_VIEW_REPORTS: 'analytics:view_reports',
  ANALYTICS_EXPORT_DATA: 'analytics:export_data',
  ANALYTICS_VIEW_COMPLIANCE: 'analytics:view_compliance',

  // System Administration
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_MANAGE_SETTINGS: 'system:manage_settings',
  SYSTEM_VIEW_AUDIT_LOGS: 'system:view_audit_logs',
  SYSTEM_MANAGE_INTEGRATIONS: 'system:manage_integrations',

  // Emergency Procedures
  EMERGENCY_OVERRIDE: 'emergency:override',
  EMERGENCY_APPROVE_POST: 'emergency:approve_post',
  EMERGENCY_VIEW_LOGS: 'emergency:view_logs',

  // Delegation
  DELEGATION_CREATE: 'delegation:create',
  DELEGATION_MANAGE: 'delegation:manage',
  DELEGATION_VIEW: 'delegation:view',
} as const;

// Role hierarchy with inheritance (crew → chief_engineer → captain → superintendent)
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  VESSEL_CREW: [],
  CHIEF_ENGINEER: ['VESSEL_CREW'],
  CAPTAIN: ['CHIEF_ENGINEER', 'VESSEL_CREW'],
  SUPERINTENDENT: ['CAPTAIN', 'CHIEF_ENGINEER', 'VESSEL_CREW'],
  PROCUREMENT_MANAGER: [],
  FINANCE_TEAM: [],
  ADMIN: ['SUPERINTENDENT', 'CAPTAIN', 'CHIEF_ENGINEER', 'VESSEL_CREW', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM'],
};

// Default permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  VESSEL_CREW: [
    PERMISSIONS.REQUISITION_CREATE,
    PERMISSIONS.REQUISITION_READ,
    PERMISSIONS.REQUISITION_UPDATE,
    PERMISSIONS.REQUISITION_SUBMIT,
    PERMISSIONS.VESSEL_READ,
    PERMISSIONS.VENDOR_READ,
    PERMISSIONS.QUOTE_READ,
    PERMISSIONS.PO_READ,
    PERMISSIONS.INVOICE_READ,
  ],
  
  CHIEF_ENGINEER: [
    ...ROLE_PERMISSIONS.VESSEL_CREW,
    PERMISSIONS.APPROVAL_LEVEL_1,
    PERMISSIONS.REQUISITION_DELETE,
    PERMISSIONS.VESSEL_UPDATE,
    PERMISSIONS.VESSEL_MANAGE_CERTIFICATES,
    PERMISSIONS.ANALYTICS_VIEW_DASHBOARD,
  ],
  
  CAPTAIN: [
    ...ROLE_PERMISSIONS.CHIEF_ENGINEER,
    PERMISSIONS.APPROVAL_LEVEL_2,
    PERMISSIONS.APPROVAL_EMERGENCY_OVERRIDE,
    PERMISSIONS.EMERGENCY_OVERRIDE,
    PERMISSIONS.EMERGENCY_APPROVE_POST,
    PERMISSIONS.DELEGATION_CREATE,
    PERMISSIONS.DELEGATION_MANAGE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.VESSEL_ASSIGN_USERS,
  ],
  
  SUPERINTENDENT: [
    ...ROLE_PERMISSIONS.CAPTAIN,
    PERMISSIONS.APPROVAL_LEVEL_3,
    PERMISSIONS.VESSEL_CREATE,
    PERMISSIONS.VESSEL_DELETE,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.ANALYTICS_VIEW_REPORTS,
    PERMISSIONS.ANALYTICS_EXPORT_DATA,
    PERMISSIONS.FINANCE_VIEW_BUDGETS,
    PERMISSIONS.FINANCE_VIEW_REPORTS,
  ],
  
  PROCUREMENT_MANAGER: [
    PERMISSIONS.REQUISITION_READ,
    PERMISSIONS.APPROVAL_LEVEL_2,
    PERMISSIONS.APPROVAL_LEVEL_3,
    PERMISSIONS.APPROVAL_LEVEL_4,
    PERMISSIONS.VENDOR_CREATE,
    PERMISSIONS.VENDOR_READ,
    PERMISSIONS.VENDOR_UPDATE,
    PERMISSIONS.VENDOR_APPROVE,
    PERMISSIONS.VENDOR_MANAGE_RATINGS,
    PERMISSIONS.RFQ_CREATE,
    PERMISSIONS.RFQ_READ,
    PERMISSIONS.RFQ_UPDATE,
    PERMISSIONS.RFQ_SEND,
    PERMISSIONS.RFQ_EVALUATE,
    PERMISSIONS.QUOTE_READ,
    PERMISSIONS.QUOTE_COMPARE,
    PERMISSIONS.QUOTE_APPROVE,
    PERMISSIONS.PO_CREATE,
    PERMISSIONS.PO_READ,
    PERMISSIONS.PO_UPDATE,
    PERMISSIONS.PO_APPROVE,
    PERMISSIONS.PO_SEND,
    PERMISSIONS.ANALYTICS_VIEW_DASHBOARD,
    PERMISSIONS.ANALYTICS_VIEW_REPORTS,
  ],
  
  FINANCE_TEAM: [
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.INVOICE_UPDATE,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.INVOICE_PROCESS_PAYMENT,
    PERMISSIONS.FINANCE_VIEW_BUDGETS,
    PERMISSIONS.FINANCE_MANAGE_BUDGETS,
    PERMISSIONS.FINANCE_VIEW_REPORTS,
    PERMISSIONS.FINANCE_MANAGE_COST_CENTERS,
    PERMISSIONS.FINANCE_PROCESS_PAYMENTS,
    PERMISSIONS.PO_READ,
    PERMISSIONS.QUOTE_READ,
    PERMISSIONS.ANALYTICS_VIEW_REPORTS,
    PERMISSIONS.ANALYTICS_EXPORT_DATA,
  ],
  
  ADMIN: [
    ...Object.values(PERMISSIONS),
  ],
};

export class PermissionService {
  /**
   * Initialize permissions in the database
   */
  static async initializePermissions(): Promise<void> {
    try {
      const permissionData = Object.entries(PERMISSIONS).map(([key, value]) => ({
        name: value,
        description: key.replace(/_/g, ' ').toLowerCase(),
        category: value.split(':')[0],
      }));

      for (const permission of permissionData) {
        await prisma.permission.upsert({
          where: { name: permission.name },
          update: {
            description: permission.description,
            category: permission.category,
          },
          create: permission,
        });
      }

      logger.info('Permissions initialized successfully');
    } catch (error) {
      logger.error('Error initializing permissions:', error);
      throw error;
    }
  }

  /**
   * Get all permissions for a user including inherited permissions from role hierarchy
   */
  static async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get role-based permissions
      const rolePermissions = this.getRolePermissions(user.role);
      
      // Get explicitly assigned permissions
      const explicitPermissions = user.permissions.map(up => up.permission.name);
      
      // Combine and deduplicate
      const allPermissions = [...new Set([...rolePermissions, ...explicitPermissions])];
      
      return allPermissions;
    } catch (error) {
      logger.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Get permissions for a role including inherited permissions
   */
  static getRolePermissions(role: UserRole): string[] {
    const directPermissions = ROLE_PERMISSIONS[role] || [];
    const inheritedRoles = ROLE_HIERARCHY[role] || [];
    
    const inheritedPermissions = inheritedRoles.flatMap(inheritedRole => 
      ROLE_PERMISSIONS[inheritedRole] || []
    );
    
    return [...new Set([...directPermissions, ...inheritedPermissions])];
  }

  /**
   * Check if a user has a specific permission
   */
  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return userPermissions.includes(permission);
    } catch (error) {
      logger.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Check if a user has any of the specified permissions
   */
  static async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return permissions.some(permission => userPermissions.includes(permission));
    } catch (error) {
      logger.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Check if a user has all of the specified permissions
   */
  static async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return permissions.every(permission => userPermissions.includes(permission));
    } catch (error) {
      logger.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Assign permission to user
   */
  static async assignPermissionToUser(userId: string, permissionName: string): Promise<void> {
    try {
      const permission = await prisma.permission.findUnique({
        where: { name: permissionName },
      });

      if (!permission) {
        throw new Error(`Permission ${permissionName} not found`);
      }

      await prisma.userPermission.upsert({
        where: {
          userId_permissionId: {
            userId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          userId,
          permissionId: permission.id,
        },
      });

      logger.info(`Permission ${permissionName} assigned to user ${userId}`);
    } catch (error) {
      logger.error('Error assigning permission to user:', error);
      throw error;
    }
  }

  /**
   * Remove permission from user
   */
  static async removePermissionFromUser(userId: string, permissionName: string): Promise<void> {
    try {
      const permission = await prisma.permission.findUnique({
        where: { name: permissionName },
      });

      if (!permission) {
        throw new Error(`Permission ${permissionName} not found`);
      }

      await prisma.userPermission.deleteMany({
        where: {
          userId,
          permissionId: permission.id,
        },
      });

      logger.info(`Permission ${permissionName} removed from user ${userId}`);
    } catch (error) {
      logger.error('Error removing permission from user:', error);
      throw error;
    }
  }

  /**
   * Get approval level for user based on role and permissions
   */
  static async getUserApprovalLevel(userId: string): Promise<number> {
    try {
      const permissions = await this.getUserPermissions(userId);
      
      if (permissions.includes(PERMISSIONS.APPROVAL_LEVEL_4)) return 4;
      if (permissions.includes(PERMISSIONS.APPROVAL_LEVEL_3)) return 3;
      if (permissions.includes(PERMISSIONS.APPROVAL_LEVEL_2)) return 2;
      if (permissions.includes(PERMISSIONS.APPROVAL_LEVEL_1)) return 1;
      
      return 0;
    } catch (error) {
      logger.error('Error getting user approval level:', error);
      return 0;
    }
  }

  /**
   * Check if user can approve requisition based on amount and urgency
   */
  static async canApproveRequisition(
    userId: string, 
    amount: number, 
    urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY'
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      
      // Emergency override permission
      if (urgency === 'EMERGENCY' && permissions.includes(PERMISSIONS.APPROVAL_EMERGENCY_OVERRIDE)) {
        return true;
      }
      
      // Amount-based approval levels
      if (amount <= 500 && permissions.includes(PERMISSIONS.APPROVAL_LEVEL_1)) return true;
      if (amount <= 5000 && permissions.includes(PERMISSIONS.APPROVAL_LEVEL_2)) return true;
      if (amount <= 25000 && permissions.includes(PERMISSIONS.APPROVAL_LEVEL_3)) return true;
      if (amount > 25000 && permissions.includes(PERMISSIONS.APPROVAL_LEVEL_4)) return true;
      
      return false;
    } catch (error) {
      logger.error('Error checking requisition approval permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions grouped by category
   */
  static async getPermissionsByCategory(): Promise<Record<string, Permission[]>> {
    try {
      const permissions = await prisma.permission.findMany({
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });

      const grouped = permissions.reduce((acc, permission) => {
        if (!acc[permission.category]) {
          acc[permission.category] = [];
        }
        acc[permission.category].push(permission);
        return acc;
      }, {} as Record<string, Permission[]>);

      return grouped;
    } catch (error) {
      logger.error('Error getting permissions by category:', error);
      throw error;
    }
  }
}