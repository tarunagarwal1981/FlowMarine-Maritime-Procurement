#!/bin/bash

# FlowMarine Restore Script
# This script restores from a backup created by backup-deployment.sh

set -e

# Check if backup file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    echo "Available backups:"
    ls -la /opt/flowmarine/backups/flowmarine_backup_*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="/tmp/flowmarine_restore_$(date +%s)"
DB_CONTAINER="flowmarine-postgres-prod"
DB_NAME="${POSTGRES_DB:-flowmarine}"
DB_USER="${POSTGRES_USER:-flowmarine}"

# Verify backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file ${BACKUP_FILE} not found!"
    exit 1
fi

echo "Starting FlowMarine restore from ${BACKUP_FILE} at $(date)"

# 1. Create temporary restore directory
mkdir -p "${RESTORE_DIR}"
cd "${RESTORE_DIR}"

# 2. Extract backup
echo "Extracting backup..."
tar -xzf "${BACKUP_FILE}"

# Find the backup directory
BACKUP_DIR=$(find . -maxdepth 1 -type d -name "flowmarine_backup_*" | head -1)
if [ -z "${BACKUP_DIR}" ]; then
    echo "ERROR: Could not find backup directory in archive!"
    exit 1
fi

cd "${BACKUP_DIR}"

# 3. Display backup manifest
if [ -f "manifest.txt" ]; then
    echo "Backup manifest:"
    cat manifest.txt
    echo ""
fi

# 4. Confirm restore
read -p "Do you want to proceed with the restore? This will overwrite current data! (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restore cancelled."
    rm -rf "${RESTORE_DIR}"
    exit 0
fi

# 5. Stop services
echo "Stopping FlowMarine services..."
cd /opt/flowmarine
docker-compose -f docker/production/docker-compose.prod.yml stop backend frontend

# 6. Restore database
if [ -f "${RESTORE_DIR}/${BACKUP_DIR}/database.sql" ]; then
    echo "Restoring PostgreSQL database..."
    
    # Create a backup of current database first
    echo "Creating backup of current database..."
    docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges > "/tmp/current_db_backup_$(date +%s).sql"
    
    # Drop and recreate database
    docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -c "CREATE DATABASE ${DB_NAME};"
    
    # Restore from backup
    docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" < "${RESTORE_DIR}/${BACKUP_DIR}/database.sql"
    
    echo "Database restored successfully"
else
    echo "WARNING: No database backup found in archive"
fi

# 7. Restore uploaded files
if [ -f "${RESTORE_DIR}/${BACKUP_DIR}/uploads.tar.gz" ]; then
    echo "Restoring uploaded files..."
    
    # Backup current uploads
    if [ -d "/opt/flowmarine/uploads" ]; then
        mv /opt/flowmarine/uploads "/opt/flowmarine/uploads_backup_$(date +%s)"
    fi
    
    # Extract uploads
    cd /opt/flowmarine
    tar -xzf "${RESTORE_DIR}/${BACKUP_DIR}/uploads.tar.gz"
    
    echo "Uploaded files restored successfully"
else
    echo "WARNING: No uploads backup found in archive"
fi

# 8. Restore configuration (optional)
if [ -f "${RESTORE_DIR}/${BACKUP_DIR}/config.tar.gz" ]; then
    read -p "Do you want to restore configuration files? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Restoring configuration files..."
        
        # Backup current config
        tar -czf "/opt/flowmarine/config_backup_$(date +%s).tar.gz" \
            docker/production/docker-compose.prod.yml \
            .env \
            docker/production/monitoring/ \
            scripts/ 2>/dev/null || true
        
        # Extract config
        cd /opt/flowmarine
        tar -xzf "${RESTORE_DIR}/${BACKUP_DIR}/config.tar.gz"
        
        echo "Configuration files restored successfully"
    fi
fi

# 9. Run database migrations (in case of schema changes)
echo "Running database migrations..."
docker-compose -f docker/production/docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# 10. Start services
echo "Starting FlowMarine services..."
docker-compose -f docker/production/docker-compose.prod.yml up -d

# 11. Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# 12. Health check
echo "Performing health check..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Health check passed - FlowMarine is running"
else
    echo "❌ Health check failed - Please check the logs"
    docker-compose -f docker/production/docker-compose.prod.yml logs --tail=50
fi

# 13. Clean up
echo "Cleaning up temporary files..."
rm -rf "${RESTORE_DIR}"

echo "Restore completed at $(date)"

# 14. Send notification (if configured)
if [ -n "${SLACK_WEBHOOK_URL}" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🔄 FlowMarine restore completed from backup: $(basename ${BACKUP_FILE})\"}" \
        "${SLACK_WEBHOOK_URL}"
fi

echo ""
echo "IMPORTANT: Please verify that all data has been restored correctly."
echo "Check the application logs and test critical functionality."