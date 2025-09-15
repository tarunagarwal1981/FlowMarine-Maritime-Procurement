#!/bin/bash

# FlowMarine Restore Script
# This script restores FlowMarine system from backups

set -euo pipefail

# Configuration
BACKUP_DIR="/opt/flowmarine/backups"
LOG_FILE="/var/log/flowmarine/restore.log"

# Database configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="${POSTGRES_DB}"
DB_USER="${POSTGRES_USER}"
PGPASSWORD="${POSTGRES_PASSWORD}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS] TIMESTAMP"
    echo ""
    echo "Options:"
    echo "  -d, --database-only    Restore only database"
    echo "  -f, --files-only       Restore only application files"
    echo "  -c, --config-only      Restore only configuration"
    echo "  -u, --uploads-only     Restore only uploads"
    echo "  -s, --from-s3          Download from S3 before restore"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 20240101_120000                    # Full restore"
    echo "  $0 -d 20240101_120000                 # Database only"
    echo "  $0 -s 20240101_120000                 # Download from S3 and restore"
    exit 1
}

# Parse command line arguments
DATABASE_ONLY=false
FILES_ONLY=false
CONFIG_ONLY=false
UPLOADS_ONLY=false
FROM_S3=false
TIMESTAMP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--database-only)
            DATABASE_ONLY=true
            shift
            ;;
        -f|--files-only)
            FILES_ONLY=true
            shift
            ;;
        -c|--config-only)
            CONFIG_ONLY=true
            shift
            ;;
        -u|--uploads-only)
            UPLOADS_ONLY=true
            shift
            ;;
        -s|--from-s3)
            FROM_S3=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [ -z "$TIMESTAMP" ]; then
                TIMESTAMP="$1"
            else
                echo "Unknown option: $1"
                usage
            fi
            shift
            ;;
    esac
done

if [ -z "$TIMESTAMP" ]; then
    echo "Error: TIMESTAMP is required"
    usage
fi

# Validate timestamp format
if ! [[ "$TIMESTAMP" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
    error_exit "Invalid timestamp format. Expected: YYYYMMDD_HHMMSS"
fi

log "Starting FlowMarine restore process for timestamp: $TIMESTAMP"

# Define backup file paths
DB_BACKUP_FILE="$BACKUP_DIR/postgres_${TIMESTAMP}.sql.gz"
REDIS_BACKUP_FILE="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
APP_BACKUP_FILE="$BACKUP_DIR/application_${TIMESTAMP}.tar.gz"
CONFIG_BACKUP_FILE="$BACKUP_DIR/config_${TIMESTAMP}.tar.gz"
UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
MANIFEST_FILE="$BACKUP_DIR/manifest_${TIMESTAMP}.json"

# Download from S3 if requested
if [ "$FROM_S3" = true ]; then
    if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
        error_exit "S3 bucket not configured"
    fi
    
    log "Downloading backups from S3..."
    aws s3 cp "s3://$BACKUP_S3_BUCKET/flowmarine/backups/postgres_${TIMESTAMP}.sql.gz" "$DB_BACKUP_FILE" --region "${AWS_REGION:-us-east-1}" || error_exit "Failed to download database backup from S3"
    aws s3 cp "s3://$BACKUP_S3_BUCKET/flowmarine/backups/redis_${TIMESTAMP}.rdb" "$REDIS_BACKUP_FILE" --region "${AWS_REGION:-us-east-1}" || error_exit "Failed to download Redis backup from S3"
    aws s3 cp "s3://$BACKUP_S3_BUCKET/flowmarine/backups/application_${TIMESTAMP}.tar.gz" "$APP_BACKUP_FILE" --region "${AWS_REGION:-us-east-1}" || error_exit "Failed to download application backup from S3"
    aws s3 cp "s3://$BACKUP_S3_BUCKET/flowmarine/backups/config_${TIMESTAMP}.tar.gz" "$CONFIG_BACKUP_FILE" --region "${AWS_REGION:-us-east-1}" || error_exit "Failed to download configuration backup from S3"
    aws s3 cp "s3://$BACKUP_S3_BUCKET/flowmarine/backups/uploads_${TIMESTAMP}.tar.gz" "$UPLOADS_BACKUP_FILE" --region "${AWS_REGION:-us-east-1}" 2>/dev/null || log "WARNING: Uploads backup not found in S3"
    aws s3 cp "s3://$BACKUP_S3_BUCKET/flowmarine/backups/manifest_${TIMESTAMP}.json" "$MANIFEST_FILE" --region "${AWS_REGION:-us-east-1}" || error_exit "Failed to download manifest from S3"
    log "S3 download completed"
fi

# Verify backup files exist
if [ ! -f "$MANIFEST_FILE" ]; then
    error_exit "Manifest file not found: $MANIFEST_FILE"
fi

log "Verifying backup files..."
if [ "$DATABASE_ONLY" = false ] && [ "$FILES_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$UPLOADS_ONLY" = false ]; then
    # Full restore - check all files
    [ ! -f "$DB_BACKUP_FILE" ] && error_exit "Database backup not found: $DB_BACKUP_FILE"
    [ ! -f "$REDIS_BACKUP_FILE" ] && error_exit "Redis backup not found: $REDIS_BACKUP_FILE"
    [ ! -f "$APP_BACKUP_FILE" ] && error_exit "Application backup not found: $APP_BACKUP_FILE"
    [ ! -f "$CONFIG_BACKUP_FILE" ] && error_exit "Configuration backup not found: $CONFIG_BACKUP_FILE"
fi

# Create maintenance page
log "Enabling maintenance mode..."
docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml exec frontend \
    cp /usr/share/nginx/html/maintenance.html /usr/share/nginx/html/index.html 2>/dev/null || true

# Stop services for restore
log "Stopping FlowMarine services..."
docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml stop backend frontend || error_exit "Failed to stop services"

# Database restore
if [ "$DATABASE_ONLY" = true ] || [ "$FILES_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$UPLOADS_ONLY" = false ]; then
    log "Restoring database..."
    
    # Drop existing database and recreate
    docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml exec postgres \
        psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" || error_exit "Failed to drop database"
    
    docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml exec postgres \
        psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" || error_exit "Failed to create database"
    
    # Restore database
    gunzip -c "$DB_BACKUP_FILE" | docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME" || error_exit "Database restore failed"
    
    log "Database restore completed"
fi

# Redis restore
if [ "$DATABASE_ONLY" = false ] && [ "$FILES_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$UPLOADS_ONLY" = false ]; then
    log "Restoring Redis..."
    
    docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml stop redis
    docker cp "$REDIS_BACKUP_FILE" flowmarine-redis-prod:/data/dump.rdb || error_exit "Redis restore failed"
    docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml start redis
    
    log "Redis restore completed"
fi

# Application files restore
if [ "$FILES_ONLY" = true ] || [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$UPLOADS_ONLY" = false ]; then
    log "Restoring application files..."
    
    # Create backup of current application
    mv /opt/flowmarine /opt/flowmarine.backup.$(date +%s) 2>/dev/null || true
    mkdir -p /opt/flowmarine
    
    # Extract application files
    tar -xzf "$APP_BACKUP_FILE" -C /opt/flowmarine || error_exit "Application files restore failed"
    
    log "Application files restore completed"
fi

# Configuration restore
if [ "$CONFIG_ONLY" = true ] || [ "$DATABASE_ONLY" = false ] && [ "$FILES_ONLY" = false ] && [ "$UPLOADS_ONLY" = false ]; then
    log "Restoring configuration..."
    
    # Extract configuration files
    tar -xzf "$CONFIG_BACKUP_FILE" -C / || error_exit "Configuration restore failed"
    
    log "Configuration restore completed"
fi

# Uploads restore
if [ "$UPLOADS_ONLY" = true ] || [ "$DATABASE_ONLY" = false ] && [ "$FILES_ONLY" = false ] && [ "$CONFIG_ONLY" = false ]; then
    if [ -f "$UPLOADS_BACKUP_FILE" ]; then
        log "Restoring uploads..."
        
        # Remove existing uploads and restore
        rm -rf /opt/flowmarine/uploads
        tar -xzf "$UPLOADS_BACKUP_FILE" -C /opt/flowmarine || error_exit "Uploads restore failed"
        
        log "Uploads restore completed"
    else
        log "No uploads backup found, skipping uploads restore"
    fi
fi

# Set proper permissions
log "Setting proper permissions..."
chown -R 1001:1001 /opt/flowmarine/uploads 2>/dev/null || true
chmod -R 755 /opt/flowmarine/uploads 2>/dev/null || true

# Start services
log "Starting FlowMarine services..."
docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml up -d || error_exit "Failed to start services"

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 30

# Health check
log "Performing health check..."
for i in {1..10}; do
    if curl -f http://localhost/health >/dev/null 2>&1; then
        log "Health check passed"
        break
    fi
    if [ $i -eq 10 ]; then
        error_exit "Health check failed after 10 attempts"
    fi
    sleep 10
done

# Disable maintenance mode
log "Disabling maintenance mode..."
docker-compose -f /opt/flowmarine/docker/production/docker-compose.prod.yml restart frontend

# Send notification
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ FlowMarine restore completed successfully\n📅 Restored from: $TIMESTAMP\"}" \
        "$SLACK_WEBHOOK_URL" || log "WARNING: Slack notification failed"
fi

log "FlowMarine restore process completed successfully"
log "Restored from timestamp: $TIMESTAMP"

exit 0