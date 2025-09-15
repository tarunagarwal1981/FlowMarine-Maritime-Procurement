import { UrgencyLevel, CriticalityLevel } from '@prisma/client';

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  isActive: boolean;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface WorkflowAction {
  type: 'APPROVE' | 'REQUIRE_APPROVAL' | 'ESCALATE' | 'NOTIFY' | 'BYPASS';
  approverRole?: string;
  approverLevel?: number;
  budgetLimit?: number;
  costCenter?: string;
  notificationTemplate?: string;
  escalationDelay?: number; // in hours
}

export interface ApprovalThreshold {
  minAmount: number;
  maxAmount: number;
  currency: string;
  requiredRole: string;
  approverLevel: number;
  budgetHierarchy: 'VESSEL' | 'FLEET' | 'COMPANY';
  costCenterRequired: boolean;
}

export interface BudgetHierarchy {
  level: 'VESSEL' | 'FLEET' | 'COMPANY';
  parentLevel?: 'FLEET' | 'COMPANY';
  budgetLimit: number;
  currency: string;
  approvalRequired: boolean;
  approverRole: string;
}

export interface EmergencyBypass {
  urgencyLevel: UrgencyLevel;
  criticalityLevel: CriticalityLevel;
  allowedRoles: string[];
  requiresPostApproval: boolean;
  maxAmount?: number;
  expirationHours: number;
}

export const DEFAULT_APPROVAL_THRESHOLDS: ApprovalThreshold[] = [
  {
    minAmount: 0,
    maxAmount: 500,
    currency: 'USD',
    requiredRole: 'AUTO_APPROVE',
    approverLevel: 0,
    budgetHierarchy: 'VESSEL',
    costCenterRequired: false
  },
  {
    minAmount: 500,
    maxAmount: 5000,
    currency: 'USD',
    requiredRole: 'SUPERINTENDENT',
    approverLevel: 1,
    budgetHierarchy: 'VESSEL',
    costCenterRequired: true
  },
  {
    minAmount: 5000,
    maxAmount: 25000,
    currency: 'USD',
    requiredRole: 'PROCUREMENT_MANAGER',
    approverLevel: 2,
    budgetHierarchy: 'FLEET',
    costCenterRequired: true
  },
  {
    minAmount: 25000,
    maxAmount: Number.MAX_SAFE_INTEGER,
    currency: 'USD',
    requiredRole: 'FINANCE_TEAM',
    approverLevel: 3,
    budgetHierarchy: 'COMPANY',
    costCenterRequired: true
  }
];

export const DEFAULT_EMERGENCY_BYPASSES: EmergencyBypass[] = [
  {
    urgencyLevel: 'EMERGENCY',
    criticalityLevel: 'SAFETY_CRITICAL',
    allowedRoles: ['CAPTAIN', 'CHIEF_ENGINEER'],
    requiresPostApproval: true,
    expirationHours: 24
  },
  {
    urgencyLevel: 'EMERGENCY',
    criticalityLevel: 'OPERATIONAL_CRITICAL',
    allowedRoles: ['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT'],
    requiresPostApproval: true,
    maxAmount: 10000,
    expirationHours: 12
  },
  {
    urgencyLevel: 'URGENT',
    criticalityLevel: 'SAFETY_CRITICAL',
    allowedRoles: ['CAPTAIN', 'CHIEF_ENGINEER'],
    requiresPostApproval: false,
    maxAmount: 5000,
    expirationHours: 6
  }
];