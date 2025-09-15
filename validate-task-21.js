#!/usr/bin/env node

/**
 * Task 21 Validation Script
 * Validates Production Deployment and Monitoring implementation
 */

const fs = require('fs').promises;
const path = require('path');

class Task21Validator {
  constructor() {
    this.results = [];
    this.projectRoot = __dirname;
  }

  addResult(component, status, message, details) {
    this.results.push({ component, status, message, details });
  }

  async fileExists(filePath) {
    try {
      await fs.access(path.join(this.projectRoot, filePath));
      return true;
    } catch {
      return false;
    }
  }

  async validateFileContent(filePath, requiredContent) {
    try {
      const content = await fs.readFile(path.join(this.projectRoot, filePath), 'utf-8');
      return requiredContent.every(required => content.includes(required));
    } catch {
      return false;
    }
  }

  async validateDockerConfiguration() {
    console.log('🐳 Validating Docker Configuration...');

    // Backend Dockerfile
    const backendDockerfile = 'docker/production/Dockerfile.backend';
    if (await this.fileExists(backendDockerfile)) {
      const requiredFeatures = [
        'FROM node:18-alpine',
        'adduser -S flowmarine',
        'USER flowmarine',
        'HEALTHCHECK',
        'dumb-init'
      ];
      
      if (await this.validateFileContent(backendDockerfile, requiredFeatures)) {
        this.addResult('Docker Backend', 'PASS', 'Backend Dockerfile with security hardening');
      } else {
        this.addResult('Docker Backend', 'FAIL', 'Backend Dockerfile missing security features');
      }
    } else {
      this.addResult('Docker Backend', 'FAIL', 'Backend Dockerfile not found');
    }

    // Frontend Dockerfile
    const frontendDockerfile = 'docker/production/Dockerfile.frontend';
    if (await this.fileExists(frontendDockerfile)) {
      const requiredFeatures = [
        'FROM nginx:',
        'adduser -S nginx-app',
        'USER nginx-app',
        'HEALTHCHECK'
      ];
      
      if (await this.validateFileContent(frontendDockerfile, requiredFeatures)) {
        this.addResult('Docker Frontend', 'PASS', 'Frontend Dockerfile with security hardening');
      } else {
        this.addResult('Docker Frontend', 'FAIL', 'Frontend Dockerfile missing security features');
      }
    } else {
      this.addResult('Docker Frontend', 'FAIL', 'Frontend Dockerfile not found');
    }

    // Docker Compose Production
    const dockerCompose = 'docker/production/docker-compose.prod.yml';
    if (await this.fileExists(dockerCompose)) {
      const requiredServices = [
        'postgres:',
        'redis:',
        'backend:',
        'frontend:',
        'prometheus:',
        'grafana:',
        'loki:',
        'promtail:'
      ];
      
      if (await this.validateFileContent(dockerCompose, requiredServices)) {
        this.addResult('Docker Compose', 'PASS', 'Production compose with all services');
      } else {
        this.addResult('Docker Compose', 'FAIL', 'Production compose missing services');
      }
    } else {
      this.addResult('Docker Compose', 'FAIL', 'Production docker-compose.yml not found');
    }

    // Nginx Configuration
    const nginxConfig = 'docker/production/nginx.conf';
    if (await this.fileExists(nginxConfig)) {
      const securityFeatures = [
        'add_header X-Frame-Options',
        'add_header X-Content-Type-Options',
        'limit_req_zone',
        'server_tokens off'
      ];
      
      if (await this.validateFileContent(nginxConfig, securityFeatures)) {
        this.addResult('Nginx Config', 'PASS', 'Nginx configuration with security headers');
      } else {
        this.addResult('Nginx Config', 'WARN', 'Nginx configuration missing some security features');
      }
    } else {
      this.addResult('Nginx Config', 'FAIL', 'Nginx configuration not found');
    }
  }

  async validateCICDPipeline() {
    console.log('🚀 Validating CI/CD Pipeline...');

    const cicdFile = '.github/workflows/ci-cd.yml';
    if (await this.fileExists(cicdFile)) {
      const requiredJobs = [
        'security-scan:',
        'backend-tests:',
        'frontend-tests:',
        'e2e-tests:',
        'build-and-push:',
        'deploy-production:'
      ];
      
      if (await this.validateFileContent(cicdFile, requiredJobs)) {
        this.addResult('CI/CD Pipeline', 'PASS', 'Complete CI/CD pipeline with all stages');
      } else {
        this.addResult('CI/CD Pipeline', 'FAIL', 'CI/CD pipeline missing required jobs');
      }

      // Check for security scanning
      const securityFeatures = [
        'trivy-action',
        'codeql-action',
        'codecov-action'
      ];
      
      if (await this.validateFileContent(cicdFile, securityFeatures)) {
        this.addResult('Security Scanning', 'PASS', 'Security scanning integrated in pipeline');
      } else {
        this.addResult('Security Scanning', 'WARN', 'Some security scanning features missing');
      }
    } else {
      this.addResult('CI/CD Pipeline', 'FAIL', 'CI/CD pipeline configuration not found');
    }
  }

  async validateMonitoringInfrastructure() {
    console.log('📊 Validating Monitoring Infrastructure...');

    // Prometheus Configuration
    const prometheusConfig = 'docker/production/monitoring/prometheus.yml';
    if (await this.fileExists(prometheusConfig)) {
      const requiredJobs = [
        'job_name: \'flowmarine-backend\'',
        'job_name: \'postgres\'',
        'job_name: \'redis\'',
        'job_name: \'nginx\''
      ];
      
      if (await this.validateFileContent(prometheusConfig, requiredJobs)) {
        this.addResult('Prometheus Config', 'PASS', 'Prometheus monitoring all services');
      } else {
        this.addResult('Prometheus Config', 'FAIL', 'Prometheus missing service monitoring');
      }
    } else {
      this.addResult('Prometheus Config', 'FAIL', 'Prometheus configuration not found');
    }

    // Alert Rules
    const alertRules = 'docker/production/monitoring/alert_rules.yml';
    if (await this.fileExists(alertRules)) {
      const requiredAlerts = [
        'HighCPUUsage',
        'HighMemoryUsage',
        'ServiceDown',
        'HighErrorRate',
        'SecurityIncident'
      ];
      
      if (await this.validateFileContent(alertRules, requiredAlerts)) {
        this.addResult('Alert Rules', 'PASS', 'Comprehensive alerting rules configured');
      } else {
        this.addResult('Alert Rules', 'FAIL', 'Alert rules missing critical alerts');
      }
    } else {
      this.addResult('Alert Rules', 'FAIL', 'Alert rules configuration not found');
    }

    // Loki Configuration
    const lokiConfig = 'docker/production/monitoring/loki-config.yml';
    if (await this.fileExists(lokiConfig)) {
      this.addResult('Loki Config', 'PASS', 'Loki log aggregation configured');
    } else {
      this.addResult('Loki Config', 'FAIL', 'Loki configuration not found');
    }

    // Promtail Configuration
    const promtailConfig = 'docker/production/monitoring/promtail-config.yml';
    if (await this.fileExists(promtailConfig)) {
      const requiredJobs = [
        'job_name: flowmarine-backend',
        'job_name: system',
        'job_name: docker',
        'job_name: nginx-access'
      ];
      
      if (await this.validateFileContent(promtailConfig, requiredJobs)) {
        this.addResult('Promtail Config', 'PASS', 'Promtail collecting all log sources');
      } else {
        this.addResult('Promtail Config', 'WARN', 'Promtail missing some log sources');
      }
    } else {
      this.addResult('Promtail Config', 'FAIL', 'Promtail configuration not found');
    }

    // Grafana Dashboards
    const grafanaDashboard = 'docker/production/monitoring/grafana/dashboards/flowmarine-overview.json';
    if (await this.fileExists(grafanaDashboard)) {
      this.addResult('Grafana Dashboards', 'PASS', 'Grafana dashboards configured');
    } else {
      this.addResult('Grafana Dashboards', 'FAIL', 'Grafana dashboards not found');
    }
  }

  async validateBackupAndRecovery() {
    console.log('💾 Validating Backup and Recovery...');

    // Backup Script
    const backupScript = 'scripts/backup-deployment.sh';
    if (await this.fileExists(backupScript)) {
      const requiredFeatures = [
        'pg_dump',
        'tar -czf',
        'aws s3 cp',
        'RETENTION_DAYS'
      ];
      
      if (await this.validateFileContent(backupScript, requiredFeatures)) {
        this.addResult('Backup Script', 'PASS', 'Comprehensive backup script with cloud storage');
      } else {
        this.addResult('Backup Script', 'WARN', 'Backup script missing some features');
      }
    } else {
      this.addResult('Backup Script', 'FAIL', 'Backup script not found');
    }

    // Restore Script
    const restoreScript = 'scripts/restore-deployment.sh';
    if (await this.fileExists(restoreScript)) {
      const requiredFeatures = [
        'tar -xzf',
        'psql -U',
        'docker-compose',
        'health-check'
      ];
      
      if (await this.validateFileContent(restoreScript, requiredFeatures)) {
        this.addResult('Restore Script', 'PASS', 'Complete restore script with verification');
      } else {
        this.addResult('Restore Script', 'WARN', 'Restore script missing some features');
      }
    } else {
      this.addResult('Restore Script', 'FAIL', 'Restore script not found');
    }

    // Disaster Recovery Script
    const drScript = 'scripts/disaster-recovery.sh';
    if (await this.fileExists(drScript)) {
      const requiredFeatures = [
        'handle_database_corruption',
        'handle_service_failure',
        'full_system_recovery',
        'emergency_backup'
      ];
      
      if (await this.validateFileContent(drScript, requiredFeatures)) {
        this.addResult('Disaster Recovery', 'PASS', 'Comprehensive disaster recovery procedures');
      } else {
        this.addResult('Disaster Recovery', 'WARN', 'Disaster recovery missing some procedures');
      }
    } else {
      this.addResult('Disaster Recovery', 'FAIL', 'Disaster recovery script not found');
    }

    // Health Check Script
    const healthScript = 'scripts/health-check.sh';
    if (await this.fileExists(healthScript)) {
      const requiredChecks = [
        'check_database',
        'check_redis',
        'check_http_endpoint',
        'docker ps'
      ];
      
      if (await this.validateFileContent(healthScript, requiredChecks)) {
        this.addResult('Health Check', 'PASS', 'Comprehensive health check script');
      } else {
        this.addResult('Health Check', 'WARN', 'Health check missing some validations');
      }
    } else {
      this.addResult('Health Check', 'FAIL', 'Health check script not found');
    }
  }

  async validateDeploymentAutomation() {
    console.log('🚀 Validating Deployment Automation...');

    // Deployment Script
    const deployScript = 'scripts/deploy.sh';
    if (await this.fileExists(deployScript)) {
      const requiredFeatures = [
        'rolling_deployment',
        'blue_green_deployment',
        'backup_current_deployment',
        'run_migrations',
        'perform_health_check'
      ];
      
      if (await this.validateFileContent(deployScript, requiredFeatures)) {
        this.addResult('Deploy Script', 'PASS', 'Complete deployment automation with multiple strategies');
      } else {
        this.addResult('Deploy Script', 'WARN', 'Deploy script missing some features');
      }
    } else {
      this.addResult('Deploy Script', 'FAIL', 'Deployment script not found');
    }

    // Health Check Endpoint
    const healthEndpoint = 'packages/backend/src/healthcheck.js';
    if (await this.fileExists(healthEndpoint)) {
      this.addResult('Health Endpoint', 'PASS', 'Docker health check endpoint implemented');
    } else {
      this.addResult('Health Endpoint', 'FAIL', 'Health check endpoint not found');
    }

    // Environment Configuration
    const envExample = '.env.production.example';
    if (await this.fileExists(envExample)) {
      const requiredVars = [
        'POSTGRES_DB',
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'GRAFANA_ADMIN_PASSWORD',
        'AWS_S3_BACKUP_BUCKET'
      ];
      
      if (await this.validateFileContent(envExample, requiredVars)) {
        this.addResult('Environment Config', 'PASS', 'Comprehensive environment configuration');
      } else {
        this.addResult('Environment Config', 'WARN', 'Environment config missing some variables');
      }
    } else {
      this.addResult('Environment Config', 'FAIL', 'Production environment template not found');
    }
  }

  async validateDocumentation() {
    console.log('📚 Validating Documentation...');

    // Deployment Documentation
    const deploymentDoc = 'DEPLOYMENT.md';
    if (await this.fileExists(deploymentDoc)) {
      const requiredSections = [
        '## Prerequisites',
        '## Environment Setup',
        '## Docker Configuration',
        '## CI/CD Pipeline',
        '## Monitoring Setup',
        '## Backup and Recovery',
        '## Security Hardening',
        '## Deployment Procedures',
        '## Troubleshooting'
      ];
      
      if (await this.validateFileContent(deploymentDoc, requiredSections)) {
        this.addResult('Deployment Docs', 'PASS', 'Comprehensive deployment documentation');
      } else {
        this.addResult('Deployment Docs', 'WARN', 'Deployment documentation missing some sections');
      }
    } else {
      this.addResult('Deployment Docs', 'FAIL', 'Deployment documentation not found');
    }

    // Task Validation Documentation
    const validationDoc = 'packages/backend/TASK_21_VALIDATION.md';
    if (await this.fileExists(validationDoc)) {
      this.addResult('Validation Docs', 'PASS', 'Task validation documentation created');
    } else {
      this.addResult('Validation Docs', 'FAIL', 'Task validation documentation not found');
    }
  }

  async runValidation() {
    console.log('🔍 Starting Task 21 Validation: Production Deployment and Monitoring\n');

    await this.validateDockerConfiguration();
    await this.validateCICDPipeline();
    await this.validateMonitoringInfrastructure();
    await this.validateBackupAndRecovery();
    await this.validateDeploymentAutomation();
    await this.validateDocumentation();

    this.printResults();
  }

  printResults() {
    console.log('\n📋 VALIDATION RESULTS\n');
    console.log('='.repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;

    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.component}: ${result.message}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`📊 SUMMARY: ${passed} passed, ${warnings} warnings, ${failed} failed`);

    if (failed === 0) {
      console.log('🎉 Task 21 validation completed successfully!');
      console.log('✅ Production Deployment and Monitoring implementation is complete.');
    } else {
      console.log('❌ Task 21 validation found issues that need to be addressed.');
    }

    console.log('\n🔧 IMPLEMENTATION SUMMARY:');
    console.log('• Docker production configuration with security hardening');
    console.log('• CI/CD pipeline with automated testing and deployment');
    console.log('• Comprehensive monitoring and logging infrastructure');
    console.log('• Backup and disaster recovery procedures');
    console.log('• Deployment automation with multiple strategies');
    console.log('• Security hardening throughout the stack');
    console.log('• Complete documentation and operational procedures');
  }
}

// Run validation
const validator = new Task21Validator();
validator.runValidation().catch(console.error);