#!/bin/bash

# FlowMarine Backup Script
# This script creates comprehensive backups of the FlowMarine system

set -euo pipefail

# Configuration
BACKUP_DIR="/opt/flowmarine/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30
LOG_FILE="/var/log/flowmarine/backup.log"

# Database configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="${POSTGRES_DB}"
DB_USER="${POSTGRES_USER}"
PGPASSWORD="${POSTGRES_PASSWORD}"

# S3 configuration (optional)
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting FlowMarine backup process"

# 1. Database Backup
log "Creating database backup..."
DB_BACKUP_FILE="$BACKUP_DIR/postgres_${TIMESTAMP}.sql.gz"

if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose --clean --if-exists --create \
    | gzip > "$DB_BACKUP_FILE"; then
    error_exit "Database backup failed"
fi

log "Database backup completed: $DB_BACKUP_FILE"

# 2. Redis Backup
log "Creating Redis backup..."
REDIS_BACKUP_FILE="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"

if ! docker exec flowmarine-redis-prod redis-cli BGSAVE; then
    error_exit "Redis backup initiation failed"
fi

# Wait for Redis backup to complete
sleep 5
if ! docker cp flowmarine-redis-prod:/data/dump.rdb "$REDIS_BACKUP_FILE"; then
    error_exit "Redis backup copy failed"
fi

log "Redis backup completed: $REDIS_BACKUP_FILE"

# 3. Application Files Backup
log "Creating application files backup..."
APP_BACKUP_FILE="$BACKUP_DIR/application_${TIMESTAMP}.tar.gz"

tar -czf "$APP_BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='coverage' \
    --exclude='.git' \
    -C /opt/flowmarine \
    . || error_exit "Application files backup failed"

log "Application files backup completed: $APP_BACKUP_FILE"

# 4. Configuration Backup
log "Creating configuration backup..."
CONFIG_BACKUP_FILE="$BACKUP_DIR/config_${TIMESTAMP}.tar.gz"

tar -czf "$CONFIG_BACKUP_FILE" \
    /opt/flowmarine/docker/production \
    /opt/flowmarine/.env* \
    /etc/nginx/sites-available/flowmarine* \
    /etc/ssl/certs/flowmarine* 2>/dev/null || true

log "Configuration backup completed: $CONFIG_BACKUP_FILE"

# 5. Uploaded Files Backup
log "Creating uploaded files backup..."
UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"

if [ -d "/opt/flowmarine/uploads" ]; then
    tar -czf "$UPLOADS_BACKUP_FILE" -C /opt/flowmarine uploads/ || error_exit "Uploads backup failed"
    log "Uploads backup completed: $UPLOADS_BACKUP_FILE"
else
    log "No uploads directory found, skipping uploads backup"
fi

# 6. Create backup manifest
log "Creating backup manifest..."
MANIFEST_FILE="$BACKUP_DIR/manifest_${TIMESTAMP}.json"

cat > "$MANIFEST_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -Iseconds)",
  "version": "$(git -C /opt/flowmarine rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "files": {
    "database": "$(basename "$DB_BACKUP_FILE")",
    "redis": "$(basename "$REDIS_BACKUP_FILE")",
    "application": "$(basename "$APP_BACKUP_FILE")",
    "configuration": "$(basename "$CONFIG_BACKUP_FILE")",
    "uploads": "$(basename "$UPLOADS_BACKUP_FILE")"
  },
  "sizes": {
    "database": $(stat -c%s "$DB_BACKUP_FILE"),
    "redis": $(stat -c%s "$REDIS_BACKUP_FILE"),
    "application": $(stat -c%s "$APP_BACKUP_FILE"),
    "configuration": $(stat -c%s "$CONFIG_BACKUP_FILE"),
    "uploads": $([ -f "$UPLOADS_BACKUP_FILE" ] && stat -c%s "$UPLOADS_BACKUP_FILE" || echo 0)
  }
}
EOF

log "Backup manifest created: $MANIFEST_FILE"

# 7. Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ]; then
    log "Uploading backups to S3..."
    
    aws s3 cp "$DB_BACKUP_FILE" "s3://$S3_BUCKET/flowmarine/backups/" --region "$AWS_REGION" || log "WARNING: Database backup upload to S3 failed"
    aws s3 cp "$REDIS_BACKUP_FILE" "s3://$S3_BUCKET/flowmarine/backups/" --region "$AWS_REGION" || log "WARNING: Redis backup upload to S3 failed"
    aws s3 cp "$APP_BACKUP_FILE" "s3://$S3_BUCKET/flowmarine/backups/" --region "$AWS_REGION" || log "WARNING: Application backup upload to S3 failed"
    aws s3 cp "$CONFIG_BACKUP_FILE" "s3://$S3_BUCKET/flowmarine/backups/" --region "$AWS_REGION" || log "WARNING: Configuration backup upload to S3 failed"
    
    if [ -f "$UPLOADS_BACKUP_FILE" ]; then
        aws s3 cp "$UPLOADS_BACKUP_FILE" "s3://$S3_BUCKET/flowmarine/backups/" --region "$AWS_REGION" || log "WARNING: Uploads backup upload to S3 failed"
    fi
    
    aws s3 cp "$MANIFEST_FILE" "s3://$S3_BUCKET/flowmarine/backups/" --region "$AWS_REGION" || log "WARNING: Manifest upload to S3 failed"
    
    log "S3 upload completed"
fi

# 8. Cleanup old backups
log "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.json" -mtime +$RETENTION_DAYS -delete

# 9. Verify backup integrity
log "Verifying backup integrity..."

# Test database backup
if ! gunzip -t "$DB_BACKUP_FILE"; then
    error_exit "Database backup integrity check failed"
fi

# Test tar archives
for file in "$APP_BACKUP_FILE" "$CONFIG_BACKUP_FILE"; do
    if [ -f "$file" ] && ! tar -tzf "$file" >/dev/null; then
        error_exit "Archive integrity check failed: $file"
    fi
done

log "Backup integrity verification completed"

# 10. Send notification (if configured)
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ FlowMarine backup completed successfully\n📅 Timestamp: $TIMESTAMP\n💾 Total size: $TOTAL_SIZE\"}" \
        "$SLACK_WEBHOOK_URL" || log "WARNING: Slack notification failed"
fi

log "FlowMarine backup process completed successfully"
log "Backup files created:"
log "  - Database: $DB_BACKUP_FILE"
log "  - Redis: $REDIS_BACKUP_FILE"
log "  - Application: $APP_BACKUP_FILE"
log "  - Configuration: $CONFIG_BACKUP_FILE"
log "  - Uploads: $UPLOADS_BACKUP_FILE"
log "  - Manifest: $MANIFEST_FILE"

exit 0