#!/bin/bash

# FlowMarine Health Check Script
# This script performs comprehensive health checks on all services

set -e

# Configuration
MAX_RETRIES=30
RETRY_INTERVAL=10
HEALTH_CHECK_TIMEOUT=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "ℹ️  $message"
            ;;
    esac
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local timeout=${3:-$HEALTH_CHECK_TIMEOUT}
    
    if curl -f -s --max-time $timeout "$url" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to check database connection
check_database() {
    local container_name="flowmarine-postgres-prod"
    local db_name="${POSTGRES_DB:-flowmarine}"
    local db_user="${POSTGRES_USER:-flowmarine}"
    
    if docker exec "$container_name" pg_isready -U "$db_user" -d "$db_name" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to check Redis connection
check_redis() {
    local container_name="flowmarine-redis-prod"
    
    if docker exec "$container_name" redis-cli ping > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local check_function=$2
    local retries=0
    
    print_status "INFO" "Waiting for $service_name to be ready..."
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if $check_function; then
            print_status "OK" "$service_name is ready"
            return 0
        fi
        
        retries=$((retries + 1))
        print_status "INFO" "Attempt $retries/$MAX_RETRIES - $service_name not ready, waiting ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    print_status "ERROR" "$service_name failed to become ready after $MAX_RETRIES attempts"
    return 1
}

echo "Starting FlowMarine Health Check at $(date)"
echo "================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_status "ERROR" "Docker is not running or not accessible"
    exit 1
fi

print_status "OK" "Docker is running"

# Check if containers are running
CONTAINERS=("flowmarine-postgres-prod" "flowmarine-redis-prod" "flowmarine-backend-prod" "flowmarine-frontend-prod")
ALL_CONTAINERS_RUNNING=true

for container in "${CONTAINERS[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "^$container$"; then
        print_status "OK" "Container $container is running"
    else
        print_status "ERROR" "Container $container is not running"
        ALL_CONTAINERS_RUNNING=false
    fi
done

if [ "$ALL_CONTAINERS_RUNNING" = false ]; then
    print_status "ERROR" "Some containers are not running. Please check docker-compose logs."
    exit 1
fi

# Wait for and check database
wait_for_service "PostgreSQL" check_database || exit 1

# Check database connection count
DB_CONNECTIONS=$(docker exec flowmarine-postgres-prod psql -U "${POSTGRES_USER:-flowmarine}" -d "${POSTGRES_DB:-flowmarine}" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs)
if [ -n "$DB_CONNECTIONS" ] && [ "$DB_CONNECTIONS" -gt 0 ]; then
    print_status "OK" "Database has $DB_CONNECTIONS active connections"
else
    print_status "WARN" "Could not retrieve database connection count"
fi

# Wait for and check Redis
wait_for_service "Redis" check_redis || exit 1

# Check Redis memory usage
REDIS_MEMORY=$(docker exec flowmarine-redis-prod redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
if [ -n "$REDIS_MEMORY" ]; then
    print_status "OK" "Redis memory usage: $REDIS_MEMORY"
else
    print_status "WARN" "Could not retrieve Redis memory usage"
fi

# Wait for and check backend API
wait_for_service "Backend API" "check_http_endpoint http://localhost:3001/health" || exit 1

# Check backend metrics endpoint
if check_http_endpoint "http://localhost:3001/metrics"; then
    print_status "OK" "Backend metrics endpoint is accessible"
else
    print_status "WARN" "Backend metrics endpoint is not accessible"
fi

# Wait for and check frontend
wait_for_service "Frontend" "check_http_endpoint http://localhost/health" || exit 1

# Check main application endpoint
if check_http_endpoint "http://localhost/"; then
    print_status "OK" "Main application is accessible"
else
    print_status "ERROR" "Main application is not accessible"
    exit 1
fi

# Check API endpoints through frontend proxy
API_ENDPOINTS=("/api/auth/health" "/api/vessels/health" "/api/requisitions/health")
for endpoint in "${API_ENDPOINTS[@]}"; do
    if check_http_endpoint "http://localhost$endpoint"; then
        print_status "OK" "API endpoint $endpoint is accessible"
    else
        print_status "WARN" "API endpoint $endpoint is not accessible"
    fi
done

# Check WebSocket connection
if nc -z localhost 3001; then
    print_status "OK" "WebSocket port is accessible"
else
    print_status "WARN" "WebSocket port is not accessible"
fi

# Check monitoring services (if enabled)
MONITORING_SERVICES=("prometheus:9090" "grafana:3000" "loki:3100")
for service in "${MONITORING_SERVICES[@]}"; do
    service_name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    if docker ps --format "table {{.Names}}" | grep -q "$service_name"; then
        if check_http_endpoint "http://localhost:$port"; then
            print_status "OK" "$service_name monitoring service is accessible"
        else
            print_status "WARN" "$service_name monitoring service is not accessible"
        fi
    else
        print_status "INFO" "$service_name monitoring service is not running (optional)"
    fi
done

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    print_status "OK" "Disk usage is $DISK_USAGE%"
elif [ "$DISK_USAGE" -lt 95 ]; then
    print_status "WARN" "Disk usage is $DISK_USAGE% - consider cleanup"
else
    print_status "ERROR" "Disk usage is $DISK_USAGE% - immediate attention required"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEMORY_USAGE" -lt 85 ]; then
    print_status "OK" "Memory usage is $MEMORY_USAGE%"
elif [ "$MEMORY_USAGE" -lt 95 ]; then
    print_status "WARN" "Memory usage is $MEMORY_USAGE% - monitor closely"
else
    print_status "ERROR" "Memory usage is $MEMORY_USAGE% - immediate attention required"
fi

# Check load average
LOAD_AVERAGE=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CPU_CORES=$(nproc)
LOAD_PERCENTAGE=$(echo "$LOAD_AVERAGE * 100 / $CPU_CORES" | bc -l | cut -d. -f1)

if [ "$LOAD_PERCENTAGE" -lt 70 ]; then
    print_status "OK" "System load is ${LOAD_PERCENTAGE}% (${LOAD_AVERAGE} on ${CPU_CORES} cores)"
elif [ "$LOAD_PERCENTAGE" -lt 90 ]; then
    print_status "WARN" "System load is ${LOAD_PERCENTAGE}% (${LOAD_AVERAGE} on ${CPU_CORES} cores)"
else
    print_status "ERROR" "System load is ${LOAD_PERCENTAGE}% (${LOAD_AVERAGE} on ${CPU_CORES} cores)"
fi

echo "================================================"
print_status "OK" "Health check completed at $(date)"

# Return appropriate exit code
if [ "$ALL_CONTAINERS_RUNNING" = true ]; then
    echo "All critical services are healthy ✅"
    exit 0
else
    echo "Some issues detected ⚠️"
    exit 1
fi