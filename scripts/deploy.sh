#!/bin/bash

# FlowMarine Deployment Script
# This script handles deployment to different environments

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-"production"}
DEPLOY_MODE=${2:-"rolling"}

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
    echo -e "${timestamp} [${level}] ${message}"
}

# Function to check prerequisites
check_prerequisites() {
    log "INFO" "Checking deployment prerequisites..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log "ERROR" "Docker is not running or not accessible"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose > /dev/null 2>&1; then
        log "ERROR" "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f "${PROJECT_DIR}/.env.${ENVIRONMENT}" ]; then
        log "ERROR" "Environment file .env.${ENVIRONMENT} not found"
        log "INFO" "Please copy .env.${ENVIRONMENT}.example and configure it"
        exit 1
    fi
    
    # Check if required directories exist
    mkdir -p "${PROJECT_DIR}/logs"
    mkdir -p "${PROJECT_DIR}/backups"
    mkdir -p "${PROJECT_DIR}/uploads"
    
    log "INFO" "Prerequisites check passed"
}

# Function to backup current deployment
backup_current_deployment() {
    log "INFO" "Creating backup of current deployment..."
    
    if [ -f "${SCRIPT_DIR}/backup-deployment.sh" ]; then
        chmod +x "${SCRIPT_DIR}/backup-deployment.sh"
        "${SCRIPT_DIR}/backup-deployment.sh"
    else
        log "WARN" "Backup script not found, skipping backup"
    fi
}

# Function to pull latest images
pull_images() {
    log "INFO" "Pulling latest Docker images..."
    
    cd "${PROJECT_DIR}"
    docker-compose -f docker/production/docker-compose.prod.yml pull
    
    log "INFO" "Images pulled successfully"
}

# Function to run database migrations
run_migrations() {
    log "INFO" "Running database migrations..."
    
    cd "${PROJECT_DIR}"
    
    # Check if database is accessible
    if ! docker-compose -f docker/production/docker-compose.prod.yml exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"; then
        log "ERROR" "Database is not accessible"
        exit 1
    fi
    
    # Run migrations
    docker-compose -f docker/production/docker-compose.prod.yml run --rm backend npx prisma migrate deploy
    
    log "INFO" "Database migrations completed"
}

# Function to perform rolling deployment
rolling_deployment() {
    log "INFO" "Performing rolling deployment..."
    
    cd "${PROJECT_DIR}"
    
    # Update backend with zero downtime
    log "INFO" "Updating backend service..."
    docker-compose -f docker/production/docker-compose.prod.yml up -d --no-deps backend
    
    # Wait for backend to be healthy
    log "INFO" "Waiting for backend to be healthy..."
    sleep 30
    
    local retries=0
    local max_retries=12
    while [ $retries -lt $max_retries ]; do
        if curl -f http://localhost:3001/health > /dev/null 2>&1; then
            log "INFO" "Backend is healthy"
            break
        fi
        retries=$((retries + 1))
        log "INFO" "Backend not ready, waiting... ($retries/$max_retries)"
        sleep 10
    done
    
    if [ $retries -eq $max_retries ]; then
        log "ERROR" "Backend failed to become healthy"
        exit 1
    fi
    
    # Update frontend
    log "INFO" "Updating frontend service..."
    docker-compose -f docker/production/docker-compose.prod.yml up -d --no-deps frontend
    
    # Wait for frontend to be healthy
    log "INFO" "Waiting for frontend to be healthy..."
    sleep 15
    
    retries=0
    while [ $retries -lt $max_retries ]; do
        if curl -f http://localhost/health > /dev/null 2>&1; then
            log "INFO" "Frontend is healthy"
            break
        fi
        retries=$((retries + 1))
        log "INFO" "Frontend not ready, waiting... ($retries/$max_retries)"
        sleep 10
    done
    
    if [ $retries -eq $max_retries ]; then
        log "ERROR" "Frontend failed to become healthy"
        exit 1
    fi
    
    log "INFO" "Rolling deployment completed successfully"
}

# Function to perform blue-green deployment
blue_green_deployment() {
    log "INFO" "Performing blue-green deployment..."
    
    cd "${PROJECT_DIR}"
    
    # Create new deployment with different service names
    log "INFO" "Starting new deployment (green)..."
    
    # Copy compose file and modify service names
    cp docker/production/docker-compose.prod.yml docker/production/docker-compose.green.yml
    sed -i 's/flowmarine-\([^-]*\)-prod/flowmarine-\1-green/g' docker/production/docker-compose.green.yml
    sed -i 's/80:8080/8080:8080/g' docker/production/docker-compose.green.yml
    sed -i 's/443:8443/8443:8443/g' docker/production/docker-compose.green.yml
    
    # Start green deployment
    docker-compose -f docker/production/docker-compose.green.yml up -d
    
    # Wait for green deployment to be healthy
    log "INFO" "Waiting for green deployment to be healthy..."
    sleep 60
    
    local retries=0
    local max_retries=20
    while [ $retries -lt $max_retries ]; do
        if curl -f http://localhost:8080/health > /dev/null 2>&1; then
            log "INFO" "Green deployment is healthy"
            break
        fi
        retries=$((retries + 1))
        log "INFO" "Green deployment not ready, waiting... ($retries/$max_retries)"
        sleep 15
    done
    
    if [ $retries -eq $max_retries ]; then
        log "ERROR" "Green deployment failed to become healthy"
        # Cleanup green deployment
        docker-compose -f docker/production/docker-compose.green.yml down
        rm -f docker/production/docker-compose.green.yml
        exit 1
    fi
    
    # Switch traffic to green deployment (this would typically involve load balancer configuration)
    log "INFO" "Switching traffic to green deployment..."
    
    # Stop blue deployment
    docker-compose -f docker/production/docker-compose.prod.yml down
    
    # Rename green to production
    docker-compose -f docker/production/docker-compose.green.yml down
    sed -i 's/flowmarine-\([^-]*\)-green/flowmarine-\1-prod/g' docker/production/docker-compose.green.yml
    sed -i 's/8080:8080/80:8080/g' docker/production/docker-compose.green.yml
    sed -i 's/8443:8443/443:8443/g' docker/production/docker-compose.green.yml
    
    # Start production deployment
    docker-compose -f docker/production/docker-compose.green.yml up -d
    rm -f docker/production/docker-compose.green.yml
    
    log "INFO" "Blue-green deployment completed successfully"
}

# Function to perform health check
perform_health_check() {
    log "INFO" "Performing post-deployment health check..."
    
    if [ -f "${SCRIPT_DIR}/health-check.sh" ]; then
        chmod +x "${SCRIPT_DIR}/health-check.sh"
        if "${SCRIPT_DIR}/health-check.sh"; then
            log "INFO" "Health check passed"
            return 0
        else
            log "ERROR" "Health check failed"
            return 1
        fi
    else
        log "WARN" "Health check script not found"
        return 0
    fi
}

# Function to cleanup old images
cleanup_old_images() {
    log "INFO" "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old images (keep last 3 versions)
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
        grep "flowmarine" | \
        sort -k2 -r | \
        tail -n +4 | \
        awk '{print $1}' | \
        xargs -r docker rmi || true
    
    log "INFO" "Cleanup completed"
}

# Function to send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${SLACK_WEBHOOK_URL}" ]; then
        local emoji="✅"
        if [ "$status" = "failed" ]; then
            emoji="❌"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${emoji} FlowMarine Deployment: ${message}\"}" \
            "${SLACK_WEBHOOK_URL}" 2>/dev/null || true
    fi
}

# Function to rollback deployment
rollback_deployment() {
    log "ERROR" "Deployment failed, initiating rollback..."
    send_notification "failed" "Deployment failed, initiating rollback"
    
    # Find latest backup
    local latest_backup=$(ls -t "${PROJECT_DIR}/backups"/flowmarine_backup_*.tar.gz 2>/dev/null | head -1)
    
    if [ -n "${latest_backup}" ]; then
        log "INFO" "Rolling back to: ${latest_backup}"
        
        if [ -f "${SCRIPT_DIR}/restore-deployment.sh" ]; then
            chmod +x "${SCRIPT_DIR}/restore-deployment.sh"
            "${SCRIPT_DIR}/restore-deployment.sh" "${latest_backup}"
            
            if perform_health_check; then
                log "INFO" "Rollback completed successfully"
                send_notification "success" "Rollback completed successfully"
            else
                log "ERROR" "Rollback failed"
                send_notification "failed" "Rollback failed - manual intervention required"
            fi
        else
            log "ERROR" "Restore script not found"
            send_notification "failed" "Rollback failed - restore script not found"
        fi
    else
        log "ERROR" "No backup found for rollback"
        send_notification "failed" "Rollback failed - no backup found"
    fi
}

# Main deployment function
main() {
    log "INFO" "Starting FlowMarine deployment to ${ENVIRONMENT} environment"
    log "INFO" "Deployment mode: ${DEPLOY_MODE}"
    
    # Load environment variables
    if [ -f "${PROJECT_DIR}/.env.${ENVIRONMENT}" ]; then
        source "${PROJECT_DIR}/.env.${ENVIRONMENT}"
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    backup_current_deployment
    
    # Pull latest images
    pull_images
    
    # Run database migrations
    run_migrations
    
    # Perform deployment based on mode
    case "${DEPLOY_MODE}" in
        "rolling")
            rolling_deployment
            ;;
        "blue-green")
            blue_green_deployment
            ;;
        "recreate")
            log "INFO" "Performing recreate deployment..."
            cd "${PROJECT_DIR}"
            docker-compose -f docker/production/docker-compose.prod.yml down
            docker-compose -f docker/production/docker-compose.prod.yml up -d
            sleep 60
            ;;
        *)
            log "ERROR" "Unknown deployment mode: ${DEPLOY_MODE}"
            exit 1
            ;;
    esac
    
    # Perform health check
    if perform_health_check; then
        log "INFO" "Deployment completed successfully"
        send_notification "success" "Deployment to ${ENVIRONMENT} completed successfully"
        
        # Cleanup old images
        cleanup_old_images
    else
        log "ERROR" "Deployment health check failed"
        rollback_deployment
        exit 1
    fi
}

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    echo "FlowMarine Deployment Script"
    echo "Usage: $0 <environment> [deployment_mode]"
    echo ""
    echo "Environments: production, staging, development"
    echo "Deployment modes: rolling, blue-green, recreate"
    echo ""
    echo "Examples:"
    echo "  $0 production rolling"
    echo "  $0 staging blue-green"
    echo "  $0 development recreate"
    exit 1
fi

# Validate environment
case "${ENVIRONMENT}" in
    "production"|"staging"|"development")
        ;;
    *)
        log "ERROR" "Invalid environment: ${ENVIRONMENT}"
        log "INFO" "Valid environments: production, staging, development"
        exit 1
        ;;
esac

# Validate deployment mode
case "${DEPLOY_MODE}" in
    "rolling"|"blue-green"|"recreate")
        ;;
    *)
        log "ERROR" "Invalid deployment mode: ${DEPLOY_MODE}"
        log "INFO" "Valid modes: rolling, blue-green, recreate"
        exit 1
        ;;
esac

# Run main function
main