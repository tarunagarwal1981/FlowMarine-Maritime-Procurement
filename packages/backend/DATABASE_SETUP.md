# FlowMarine Database Setup Guide

## Overview

This document provides comprehensive instructions for setting up the FlowMarine database schema, including PostgreSQL configuration, Prisma migrations, and seed data.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- Redis 6+ installed and running
- npm/yarn/pnpm package manager

## Database Schema Overview

The FlowMarine database schema includes the following main entity groups:

### 1. User Management & Authentication
- **users**: Core user accounts with role-based access
- **permissions**: Granular permission system
- **user_permissions**: User-permission relationships
- **refresh_tokens**: JWT refresh token management
- **delegations**: Temporary authority delegation system

### 2. Vessel Management
- **vessels**: Vessel master data with specifications
- **vessel_assignments**: User-vessel relationships
- **vessel_certificates**: Certificate tracking and expiry management
- **vessel_specifications**: Technical specifications

### 3. Item Catalog & Maritime Integration
- **item_catalog**: IMPA/ISSA integrated parts catalog
- Supports maritime-specific categorization
- Vessel compatibility matrix
- Criticality level classification

### 4. Procurement Workflow
- **requisitions**: Purchase requests from vessels
- **requisition_items**: Line items with specifications
- **approvals**: Multi-level approval workflow
- Emergency override capabilities

### 5. Vendor & RFQ Management
- **vendors**: Comprehensive vendor profiles
- **vendor_service_areas**: Geographic coverage
- **vendor_port_capabilities**: Port-specific services
- **vendor_certifications**: Vendor qualifications
- **rfqs**: Request for quotation management
- **quotes**: Vendor quote responses with scoring

### 6. Purchase Orders & Delivery
- **purchase_orders**: PO generation and tracking
- **po_line_items**: Detailed line items
- **deliveries**: Delivery tracking with photo confirmation
- **invoices**: Invoice processing with OCR support

### 7. Financial Management
- **cost_centers**: Hierarchical cost allocation
- **budgets**: Multi-currency budget management
- **exchange_rates**: Real-time currency conversion

### 8. Audit & Compliance
- **audit_logs**: Comprehensive audit trail
- **system_settings**: Configurable system parameters
- **notification_templates**: Email/SMS templates

## Setup Instructions

### 1. Environment Configuration

Copy the environment template:
```bash
cp .env.example .env
```

Update the following critical settings in `.env`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/flowmarine_dev"
REDIS_URL="redis://localhost:6379"

# Security
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
REFRESH_TOKEN_SECRET="your-super-secret-refresh-token-key-change-this-in-production"
ENCRYPTION_KEY="your-32-character-encryption-key-here"

# Email (for notifications)
SMTP_HOST="your-smtp-host"
SMTP_USER="your-email@domain.com"
SMTP_PASS="your-app-password"
```

### 2. Database Creation

Create the PostgreSQL database:
```sql
CREATE DATABASE flowmarine_dev;
CREATE USER flowmarine WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE flowmarine_dev TO flowmarine;
```

### 3. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 4. Generate Prisma Client

```bash
npm run db:generate
```

### 5. Run Database Migrations

```bash
npm run db:migrate
```

### 6. Seed Development Data

```bash
npm run db:seed
```

## Database Indexing Strategy

The schema includes optimized indexing for:

### Performance Indexes
- **users**: email, role, isActive
- **vessels**: imoNumber, vesselType, engineType
- **requisitions**: vesselId, status, urgencyLevel, requisitionNumber
- **item_catalog**: impaCode, issaCode, category, criticalityLevel, name
- **vendors**: code, isActive, isApproved, overallScore
- **audit_logs**: userId, action, resource, createdAt, vesselId

### Composite Indexes
- **vessel_assignments**: userId + vesselId + startDate (unique)
- **user_permissions**: userId + permissionId (unique)
- **rfq_vendors**: rfqId + vendorId (unique)
- **exchange_rates**: fromCurrency + toCurrency + date (unique)
- **budgets**: startDate + endDate, vesselId + period
- **delegations**: startDate + endDate

### Foreign Key Indexes
All foreign key relationships are indexed for optimal join performance.

## Seed Data Overview

The seed script creates realistic maritime scenarios including:

### Test Users
- **Admin**: admin@flowmarine.com / password123
- **Superintendent**: superintendent@flowmarine.com / password123
- **Procurement Manager**: procurement@flowmarine.com / password123
- **Finance Team**: finance@flowmarine.com / password123
- **Captain (Atlantic)**: captain.atlantic@flowmarine.com / password123
- **Chief Engineer**: engineer.atlantic@flowmarine.com / password123
- **Vessel Crew**: crew.atlantic@flowmarine.com / password123
- **Captain (Pacific)**: captain.pacific@flowmarine.com / password123

### Sample Vessels
1. **MV Atlantic Pioneer** (Container Ship)
   - IMO: 9123456
   - Engine: MAN B&W 6S60MC-C
   - Route: New York → Rotterdam

2. **MV Pacific Explorer** (Bulk Carrier)
   - IMO: 9234567
   - Engine: Wartsila 6RT-flex58T-D
   - Route: Tokyo → Long Beach

3. **MV Nordic Star** (Tanker)
   - IMO: 9345678
   - Engine: MAN B&W 7S70MC-C
   - Route: Oslo → Houston

### Maritime Item Catalog
- Engine parts (cylinder heads, fuel injection pumps)
- Safety equipment (life jackets, fire pumps)
- Deck equipment (mooring ropes, navigation gear)
- Maintenance supplies (engine oil, electrical cables)
- All items include IMPA/ISSA codes and vessel compatibility

### Sample Requisitions
- **REQ-2024-001**: Urgent fuel injection pump replacement
- **REQ-2024-002**: Routine mooring rope replacement
- **REQ-2024-003**: Emergency fire pump replacement (with override)

## Security Features

### Data Protection
- **Password Hashing**: bcrypt with 12 rounds
- **Field-Level Encryption**: Sensitive banking data
- **JWT Tokens**: Secure authentication with refresh tokens
- **Account Lockout**: Protection against brute force attacks

### Audit Trail
- Complete transaction history
- User accountability tracking
- IP address and user agent logging
- Maritime compliance reporting

### Access Control
- Role-based permissions (RBAC)
- Vessel-specific access control
- Delegation system for crew rotations
- Emergency override procedures

## Maintenance Commands

### Database Operations
```bash
# Generate Prisma client
npm run db:generate

# Create and apply migration
npm run db:migrate

# Deploy migrations (production)
npm run db:migrate:prod

# Reset database (development only)
npm run db:reset

# Open Prisma Studio
npm run db:studio

# Seed database
npm run db:seed
```

### Development Tools
```bash
# Start development server
npm run dev

# Run tests
npm run test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## Production Considerations

### Performance Optimization
- Connection pooling configured
- Query optimization with proper indexing
- Materialized views for complex reports
- Table partitioning for large datasets

### Security Hardening
- Environment variable validation
- Rate limiting implementation
- HTTPS enforcement
- Database connection encryption

### Monitoring & Logging
- Structured logging with Winston
- Database query monitoring
- Performance metrics collection
- Error tracking and alerting

### Backup Strategy
- Automated daily backups
- Point-in-time recovery capability
- Cross-region backup replication
- Backup verification procedures

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify PostgreSQL is running
   - Check DATABASE_URL configuration
   - Ensure database exists and user has permissions

2. **Migration Errors**
   - Check for schema conflicts
   - Verify Prisma version compatibility
   - Review migration history

3. **Seed Data Errors**
   - Ensure database is empty before seeding
   - Check for constraint violations
   - Verify foreign key relationships

4. **Performance Issues**
   - Review query execution plans
   - Check index usage
   - Monitor connection pool utilization

### Support Resources
- Prisma Documentation: https://www.prisma.io/docs
- PostgreSQL Documentation: https://www.postgresql.org/docs
- Redis Documentation: https://redis.io/documentation

## Schema Validation

The database schema has been designed to meet all FlowMarine requirements:

✅ **Requirement 2.1**: IMPA/ISSA catalog integration
✅ **Requirement 2.2**: Vessel specifications and compatibility
✅ **Requirement 2.3**: Maritime category system
✅ **Requirement 13.1**: Comprehensive vessel data management
✅ **Requirement 13.2**: Certificate and inspection tracking

The schema supports all maritime-specific features including:
- Multi-vessel fleet management
- Role-based access control with maritime roles
- Emergency override procedures
- Comprehensive audit trails
- Multi-currency financial management
- Vendor performance tracking
- Real-time delivery coordination