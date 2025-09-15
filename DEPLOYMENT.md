# FlowMarine Production Deployment Guide

This document provides comprehensive instructions for deploying FlowMarine to production environments with monitoring, backup, and disaster recovery capabilities.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Configuration](#docker-configuration)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Monitoring Setup](#monitoring-setup)
6. [Backup and Recovery](#backup-and-recovery)
7. [Security Hardening](#security-hardening)
8. [Deployment Procedures](#deployment-procedures)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or later / CentOS 8 or later
- **CPU**: Minimum 4 cores, Recommended 8+ cores
- **Memory**: Minimum 8GB RAM, Recommended 16GB+ RAM
- **Storage**: Minimum 100GB SSD, Recommended 500GB+ SSD
- **Network**: Stable internet connection with sufficient bandwidth

### Software Requirements

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git 2.30+
- curl, wget, nc (netcat)
- AWS CLI (for S3 backups, optional)

### Installation Commands

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install additional tools
sudo apt install -y git curl wget netcat-openbsd bc
```

## Environment Setup

### 1. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/your-org/flowmarine.git
sudo chown -R $USER:$USER flowmarine
cd flowmarine
```

### 2. Configure Environment Variables

```bash
# Copy and configure production environment
cp .env.production.example .env.production

# Edit the configuration file
nano .env.production
```

### 3. Required Environment Variables

```bash
# Database Configuration
POSTGRES_DB=flowmarine_prod
POSTGRES_USER=flowmarine_user
POSTGRES_PASSWORD=your_secure_database_password_here

# Security Configuration
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_long
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_minimum_32_characters_long
ENCRYPTION_KEY=your_32_character_encryption_key_here

# External API Keys
EMAIL_SERVICE_API_KEY=your_email_service_api_key_here
BANKING_API_KEY=your_banking_api_key_here
EXCHANGE_RATE_API_KEY=your_exchange_rate_api_key_here
```

### 4. Create Required Directories

```bash
mkdir -p logs backups uploads
sudo chown -R $USER:$USER logs backups uploads
```

## Docker Configuration

### Production Docker Compose

The production deployment uses a multi-service architecture:

- **PostgreSQL**: Primary database with persistent storage
- **Redis**: Caching and session storage
- **Backend**: Node.js API server with security hardening
- **Frontend**: Nginx-served React application with security headers
- **Prometheus**: Metrics collection
- **Grafana**: Monitoring dashboards
- **Loki**: Log aggregation
- **Promtail**: Log collection

### Security Features

- Non-root user execution
- Read-only filesystems where possible
- Security options (`no-new-privileges`)
- Resource limits and health checks
- Network isolation
- Encrypted data at rest and in transit

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline includes:

1. **Security Scanning**: Trivy vulnerability scanner, CodeQL analysis
2. **Testing**: Unit tests, integration tests, E2E tests, security tests
3. **Building**: Multi-stage Docker builds with caching
4. **Deployment**: Automated deployment to staging/production
5. **Monitoring**: Health checks and notifications

### Pipeline Stages

```yaml
# .github/workflows/ci-cd.yml
- Security Scan
- Backend Tests (Unit, Integration, Security)
- Frontend Tests (Unit, Accessibility)
- E2E Tests
- Build and Push Images
- Deploy to Staging/Production
```

### Required Secrets

Configure these secrets in your GitHub repository:

```bash
# Production Server
PROD_HOST=your-production-server-ip
PROD_USER=deployment-user
PROD_SSH_KEY=your-ssh-private-key

# Container Registry
GITHUB_TOKEN=automatically-provided

# Notifications
SLACK_WEBHOOK=your-slack-webhook-url
```

## Monitoring Setup

### Prometheus Configuration

Monitors the following metrics:

- Application performance (response times, error rates)
- System resources (CPU, memory, disk)
- Database performance (connections, query times)
- Security events (failed logins, access violations)

### Grafana Dashboards

Pre-configured dashboards for:

- System overview
- Application performance
- Database monitoring
- Security monitoring
- Maritime-specific metrics

### Alerting Rules

Configured alerts for:

- High CPU/memory usage (>80%)
- Service downtime
- High error rates (>5%)
- Database connection issues
- Security incidents
- Disk space low (<10%)

### Log Management

- **Loki**: Centralized log storage
- **Promtail**: Log collection from all services
- **Structured logging**: JSON format with correlation IDs
- **Log retention**: Configurable retention policies

## Backup and Recovery

### Automated Backups

Daily automated backups include:

- PostgreSQL database dump
- Uploaded files and documents
- Configuration files
- Application logs (last 7 days)

### Backup Script Usage

```bash
# Create manual backup
./scripts/backup-deployment.sh

# Restore from backup
./scripts/restore-deployment.sh /path/to/backup.tar.gz

# Test disaster recovery procedures
./scripts/disaster-recovery.sh test
```

### Cloud Storage Integration

Optional S3 integration for off-site backups:

```bash
# Configure AWS credentials
aws configure

# Set S3 bucket in environment
export AWS_S3_BACKUP_BUCKET=flowmarine-backups
```

### Recovery Procedures

1. **Database Corruption**: Automatic detection and restoration
2. **Service Failures**: Automatic restart and health monitoring
3. **Full System Recovery**: Complete restoration from backup
4. **Disaster Recovery**: Multi-site failover capabilities

## Security Hardening

### Container Security

- Non-root user execution
- Read-only filesystems
- Minimal base images (Alpine Linux)
- Regular security updates
- Resource limits and quotas

### Network Security

- Internal network isolation
- Rate limiting and DDoS protection
- SSL/TLS encryption (HTTPS)
- Security headers (HSTS, CSP, etc.)
- IP-based access restrictions

### Application Security

- JWT token authentication
- Role-based access control (RBAC)
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

### Monitoring and Auditing

- Comprehensive audit logging
- Security incident detection
- Failed login attempt monitoring
- Real-time security alerts
- Compliance reporting

## Deployment Procedures

### Initial Deployment

```bash
# 1. Prepare environment
cp .env.production.example .env.production
# Edit .env.production with your configuration

# 2. Deploy infrastructure
./scripts/deploy.sh production rolling

# 3. Verify deployment
./scripts/health-check.sh

# 4. Set up monitoring
# Access Grafana at http://your-server:3000
# Default credentials: admin / (from GRAFANA_ADMIN_PASSWORD)
```

### Rolling Updates

```bash
# Deploy with zero downtime
./scripts/deploy.sh production rolling
```

### Blue-Green Deployment

```bash
# Deploy with blue-green strategy
./scripts/deploy.sh production blue-green
```

### Rollback Procedures

```bash
# Automatic rollback on failure
# Manual rollback to specific backup
./scripts/restore-deployment.sh /path/to/backup.tar.gz
```

## Monitoring and Maintenance

### Daily Operations

1. **Health Checks**: Automated via monitoring
2. **Log Review**: Check for errors and security events
3. **Performance Monitoring**: Review dashboards
4. **Backup Verification**: Ensure backups completed successfully

### Weekly Operations

1. **Security Updates**: Apply system and container updates
2. **Performance Review**: Analyze trends and optimize
3. **Capacity Planning**: Monitor resource usage
4. **Disaster Recovery Testing**: Test backup/restore procedures

### Monthly Operations

1. **Security Audit**: Review access logs and permissions
2. **Performance Optimization**: Database maintenance, index optimization
3. **Compliance Review**: Ensure regulatory compliance
4. **Documentation Updates**: Update procedures and configurations

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check container logs
docker-compose -f docker/production/docker-compose.prod.yml logs service-name

# Check system resources
df -h
free -h
docker system df
```

#### Database Connection Issues

```bash
# Check database status
docker exec flowmarine-postgres-prod pg_isready -U flowmarine_user -d flowmarine_prod

# Check connection count
docker exec flowmarine-postgres-prod psql -U flowmarine_user -d flowmarine_prod -c "SELECT count(*) FROM pg_stat_activity;"
```

#### High Memory Usage

```bash
# Check container resource usage
docker stats

# Restart services if needed
docker-compose -f docker/production/docker-compose.prod.yml restart backend
```

#### SSL Certificate Issues

```bash
# Check certificate expiration
openssl x509 -in /path/to/cert.pem -text -noout | grep "Not After"

# Renew Let's Encrypt certificate
certbot renew --nginx
```

### Emergency Procedures

#### Complete System Failure

```bash
# Initiate disaster recovery
./scripts/disaster-recovery.sh full-recovery

# If clean slate needed
./scripts/disaster-recovery.sh full-recovery --clean
```

#### Security Incident

```bash
# Check security logs
docker-compose -f docker/production/docker-compose.prod.yml logs backend | grep "SECURITY"

# Review audit logs
tail -f logs/audit.log

# Block suspicious IPs (if needed)
# Configure firewall rules
```

### Performance Optimization

#### Database Optimization

```bash
# Run database maintenance
docker exec flowmarine-postgres-prod psql -U flowmarine_user -d flowmarine_prod -c "VACUUM ANALYZE;"

# Check slow queries
docker exec flowmarine-postgres-prod psql -U flowmarine_user -d flowmarine_prod -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

#### Cache Optimization

```bash
# Check Redis memory usage
docker exec flowmarine-redis-prod redis-cli info memory

# Clear cache if needed
docker exec flowmarine-redis-prod redis-cli FLUSHALL
```

## Support and Maintenance

### Log Locations

- Application logs: `/opt/flowmarine/logs/`
- System logs: `/var/log/`
- Container logs: `docker-compose logs`

### Monitoring URLs

- Grafana: `http://your-server:3000`
- Prometheus: `http://your-server:9090`
- Application: `https://your-domain.com`

### Contact Information

- **Technical Support**: support@flowmarine.com
- **Security Issues**: security@flowmarine.com
- **Emergency Contact**: +1-XXX-XXX-XXXX

---

This deployment guide ensures a secure, monitored, and maintainable FlowMarine production environment with comprehensive backup and disaster recovery capabilities.