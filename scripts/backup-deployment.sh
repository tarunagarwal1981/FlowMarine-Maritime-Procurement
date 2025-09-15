#!/bin/bash

# FlowMarine Backup Script
# This script creates backups of the database, uploaded files, and configuration

set -e

# Configuration
BACKUP_DIR="/opt/flowmarine/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="flowmarine_backup_${TIMESTAMP}"
RETENTION_DAYS=30

# Database configuration
DB_CONTAINER="flowmarine-postgres-prod"
DB_NAME="${POSTGRES_DB:-flowmarine}"
DB_USER="${POSTGRES_USER:-flowmarine}"

# Create backup directory
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

echo "Starting FlowMarine backup at $(date)"

# 1. Database backup
echo "Backing up PostgreSQL database..."
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges > "${BACKUP_DIR}/${BACKUP_NAME}/database.sql"

# 2. Backup uploaded files
echo "Backing up uploaded files..."
if [ -d "/opt/flowmarine/uploads" ]; then
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}/uploads.tar.gz" -C /opt/flowmarine uploads/
fi

# 3. Backup configuration files
echo "Backing up configuration files..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}/config.tar.gz" \
    -C /opt/flowmarine \
    docker/production/docker-compose.prod.yml \
    .env \
    docker/production/monitoring/ \
    scripts/

# 4. Backup logs (last 7 days)
echo "Backing up recent logs..."
find /opt/flowmarine/logs -name "*.log" -mtime -7 -exec tar -czf "${BACKUP_DIR}/${BACKUP_NAME}/logs.tar.gz" {} +

# 5. Create backup manifest
echo "Creating backup manifest..."
cat > "${BACKUP_DIR}/${BACKUP_NAME}/manifest.txt" << EOF
FlowMarine Backup Manifest
Backup Date: $(date)
Backup Name: ${BACKUP_NAME}
Database: ${DB_NAME}
Files Included:
- database.sql (PostgreSQL dump)
- uploads.tar.gz (User uploaded files)
- config.tar.gz (Configuration files)
- logs.tar.gz (Application logs - last 7 days)

Backup Size: $(du -sh "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1)
EOF

# 6. Compress entire backup
echo "Compressing backup..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/"
rm -rf "${BACKUP_NAME}/"

# 7. Upload to cloud storage (if configured)
if [ -n "${AWS_S3_BACKUP_BUCKET}" ]; then
    echo "Uploading backup to S3..."
    aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "s3://${AWS_S3_BACKUP_BUCKET}/flowmarine-backups/"
fi

# 8. Clean up old backups
echo "Cleaning up old backups..."
find "${BACKUP_DIR}" -name "flowmarine_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

# 9. Verify backup integrity
echo "Verifying backup integrity..."
if tar -tzf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" > /dev/null; then
    echo "Backup verification successful"
else
    echo "ERROR: Backup verification failed!"
    exit 1
fi

echo "Backup completed successfully: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Backup size: $(du -sh "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)"

# 10. Send notification (if configured)
if [ -n "${SLACK_WEBHOOK_URL}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ FlowMarine backup completed successfully: ${BACKUP_NAME}\"}" \
        "${SLACK_WEBHOOK_URL}"
fi

echo "Backup process completed at $(date)"