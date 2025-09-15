#!/bin/bash

# FlowMarine Disaster Recovery Script
# This script handles disaster recovery scenarios

set -e

# Configuration
BACKUP_DIR="/opt/flowmarine/backups"
RECOVERY_LOG="/var/log/flowmarine-recovery.log"
NOTIFICATION_WEBHOOK="${SLACK_WEBHOOK_URL}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${RECOVERY_LOG}"
}

# Notification function
send_notification() {
    local message=$1
    local emoji=$2
    
    if [ -n "${NOTIFICATION_WEBHOOK}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${emoji} FlowMarine DR: ${message}\"}" \
            "${NOTIFICATION_WEBHOOK}" 2>/dev/null || true
    fi
}

# Function to check system resources
check_system_resources() {
    log "INFO" "Checking system resources..."
    
    # Check disk space
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 95 ]; then
        log "ERROR" "Critical disk space: ${disk_usage}%"
        return 1
    fi
    
    # Check memory
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [ "$memory_usage" -gt 95 ]; then
        log "ERROR" "Critical memory usage: ${memory_usage}%"
        return 1
    fi
    
    log "INFO" "System resources OK - Disk: ${disk_usage}%, Memory: ${memory_usage}%"
    return 0
}

# Function to perform emergency backup
emergency_backup() {
    log "INFO" "Performing emergency backup..."
    
    local emergency_backup_name="emergency_backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="${BACKUP_DIR}/${emergency_backup_name}"
    
    mkdir -p "${backup_path}"
    
    # Quick database backup
    if docker ps | grep -q "flowmarine-postgres-prod"; then
        log "INFO" "Creating emergency database backup..."
        docker exec flowmarine-postgres-prod pg_dump -U "${POSTGRES_USER:-flowmarine}" -d "${POSTGRES_DB:-flowmarine}" \
            --no-owner --no-privileges > "${backup_path}/emergency_database.sql"
    fi
    
    # Backup critical configuration
    if [ -f "/opt/flowmarine/.env" ]; then
        cp /opt/flowmarine/.env "${backup_path}/"
    fi
    
    # Compress backup
    cd "${BACKUP_DIR}"
    tar -czf "${emergency_backup_name}.tar.gz" "${emergency_backup_name}/"
    rm -rf "${emergency_backup_name}/"
    
    log "INFO" "Emergency backup created: ${emergency_backup_name}.tar.gz"
    send_notification "Emergency backup created: ${emergency_backup_name}.tar.gz" "💾"
}

# Function to handle database corruption
handle_database_corruption() {
    log "ERROR" "Database corruption detected!"
    send_notification "Database corruption detected - initiating recovery" "🚨"
    
    # Stop services
    log "INFO" "Stopping services..."
    cd /opt/flowmarine
    docker-compose -f docker/production/docker-compose.prod.yml stop backend
    
    # Create emergency backup
    emergency_backup
    
    # Find latest backup
    local latest_backup=$(ls -t "${BACKUP_DIR}"/flowmarine_backup_*.tar.gz 2>/dev/null | head -1)
    
    if [ -n "${latest_backup}" ]; then
        log "INFO" "Restoring from latest backup: ${latest_backup}"
        ./scripts/restore-deployment.sh "${latest_backup}"
    else
        log "ERROR" "No backup found for restoration!"
        send_notification "CRITICAL: No backup found for database restoration!" "💥"
        return 1
    fi
}

# Function to handle service failures
handle_service_failure() {
    local failed_service=$1
    log "ERROR" "Service failure detected: ${failed_service}"
    send_notification "Service failure detected: ${failed_service}" "⚠️"
    
    case "${failed_service}" in
        "database")
            handle_database_corruption
            ;;
        "backend")
            log "INFO" "Restarting backend service..."
            cd /opt/flowmarine
            docker-compose -f docker/production/docker-compose.prod.yml restart backend
            sleep 30
            if ./scripts/health-check.sh; then
                log "INFO" "Backend service recovered"
                send_notification "Backend service recovered successfully" "✅"
            else
                log "ERROR" "Backend service failed to recover"
                send_notification "CRITICAL: Backend service failed to recover" "💥"
            fi
            ;;
        "frontend")
            log "INFO" "Restarting frontend service..."
            cd /opt/flowmarine
            docker-compose -f docker/production/docker-compose.prod.yml restart frontend
            sleep 15
            if curl -f http://localhost/health > /dev/null 2>&1; then
                log "INFO" "Frontend service recovered"
                send_notification "Frontend service recovered successfully" "✅"
            else
                log "ERROR" "Frontend service failed to recover"
                send_notification "CRITICAL: Frontend service failed to recover" "💥"
            fi
            ;;
        "redis")
            log "INFO" "Restarting Redis service..."
            cd /opt/flowmarine
            docker-compose -f docker/production/docker-compose.prod.yml restart redis
            sleep 10
            if docker exec flowmarine-redis-prod redis-cli ping > /dev/null 2>&1; then
                log "INFO" "Redis service recovered"
                send_notification "Redis service recovered successfully" "✅"
            else
                log "ERROR" "Redis service failed to recover"
                send_notification "CRITICAL: Redis service failed to recover" "💥"
            fi
            ;;
    esac
}

# Function to perform full system recovery
full_system_recovery() {
    log "INFO" "Initiating full system recovery..."
    send_notification "Initiating full system recovery procedure" "🔄"
    
    # Check system resources
    if ! check_system_resources; then
        log "ERROR" "Insufficient system resources for recovery"
        send_notification "CRITICAL: Insufficient system resources for recovery" "💥"
        return 1
    fi
    
    # Create emergency backup
    emergency_backup
    
    # Stop all services
    log "INFO" "Stopping all services..."
    cd /opt/flowmarine
    docker-compose -f docker/production/docker-compose.prod.yml down
    
    # Clean up containers and volumes (if specified)
    if [ "$1" = "--clean" ]; then
        log "INFO" "Cleaning up containers and volumes..."
        docker system prune -f
        docker volume prune -f
    fi
    
    # Find latest backup
    local latest_backup=$(ls -t "${BACKUP_DIR}"/flowmarine_backup_*.tar.gz 2>/dev/null | head -1)
    
    if [ -n "${latest_backup}" ]; then
        log "INFO" "Restoring from latest backup: ${latest_backup}"
        ./scripts/restore-deployment.sh "${latest_backup}"
        
        # Verify recovery
        sleep 60
        if ./scripts/health-check.sh; then
            log "INFO" "Full system recovery completed successfully"
            send_notification "Full system recovery completed successfully" "✅"
        else
            log "ERROR" "Full system recovery failed verification"
            send_notification "CRITICAL: Full system recovery failed verification" "💥"
            return 1
        fi
    else
        log "ERROR" "No backup found for full system recovery!"
        send_notification "CRITICAL: No backup found for full system recovery!" "💥"
        return 1
    fi
}

# Function to test disaster recovery procedures
test_recovery_procedures() {
    log "INFO" "Testing disaster recovery procedures..."
    
    # Test backup creation
    if ./scripts/backup-deployment.sh; then
        log "INFO" "Backup test: PASSED"
    else
        log "ERROR" "Backup test: FAILED"
        return 1
    fi
    
    # Test health check
    if ./scripts/health-check.sh; then
        log "INFO" "Health check test: PASSED"
    else
        log "ERROR" "Health check test: FAILED"
        return 1
    fi
    
    # Test monitoring connectivity
    if curl -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
        log "INFO" "Monitoring connectivity test: PASSED"
    else
        log "WARN" "Monitoring connectivity test: FAILED (non-critical)"
    fi
    
    log "INFO" "Disaster recovery procedures test completed"
    send_notification "Disaster recovery procedures test completed" "🧪"
}

# Main function
main() {
    local action=${1:-"help"}
    
    log "INFO" "FlowMarine Disaster Recovery Script started - Action: ${action}"
    
    case "${action}" in
        "database-corruption")
            handle_database_corruption
            ;;
        "service-failure")
            if [ -z "$2" ]; then
                echo "Usage: $0 service-failure <service_name>"
                echo "Services: database, backend, frontend, redis"
                exit 1
            fi
            handle_service_failure "$2"
            ;;
        "full-recovery")
            full_system_recovery "$2"
            ;;
        "emergency-backup")
            emergency_backup
            ;;
        "test")
            test_recovery_procedures
            ;;
        "help"|*)
            echo "FlowMarine Disaster Recovery Script"
            echo "Usage: $0 <action> [options]"
            echo ""
            echo "Actions:"
            echo "  database-corruption    - Handle database corruption"
            echo "  service-failure <name> - Handle specific service failure"
            echo "  full-recovery [--clean] - Perform full system recovery"
            echo "  emergency-backup       - Create emergency backup"
            echo "  test                   - Test recovery procedures"
            echo "  help                   - Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 service-failure backend"
            echo "  $0 full-recovery --clean"
            echo "  $0 test"
            ;;
    esac
}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "${RECOVERY_LOG}")"

# Run main function with all arguments
main "$@"