/**
 * Custom Error Classes
 * Provides structured error handling for the application
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string;

  constructor(message: string, statusCode: number, errorCode: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errorCode = errorCode;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class VesselAccessError extends AppError {
  constructor(vesselId: string, userId: string) {
    super(`Access denied to vessel ${vesselId}`, 403, 'VESSEL_ACCESS_DENIED');
    this.name = 'VesselAccessError';
  }
}

export class EmergencyProcedureError extends AppError {
  constructor(message: string) {
    super(message, 400, 'EMERGENCY_PROCEDURE_ERROR');
    this.name = 'EmergencyProcedureError';
  }
}

export class WorkflowError extends AppError {
  constructor(message: string) {
    super(message, 400, 'WORKFLOW_ERROR');
    this.name = 'WorkflowError';
  }
}

export class OfflineSyncError extends AppError {
  constructor(message: string) {
    super(message, 400, 'OFFLINE_SYNC_ERROR');
    this.name = 'OfflineSyncError';
  }
}