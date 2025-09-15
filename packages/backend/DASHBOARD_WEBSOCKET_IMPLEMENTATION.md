# Dashboard WebSocket Service Implementation

## Overview

The Dashboard WebSocket Service provides real-time data streaming and updates for FlowMarine's analytics dashboards. This implementation supports multiple dashboard types with intelligent data change detection, subscription management, and performance optimization.

## Architecture

### Core Components

1. **DashboardWebSocketService** (`src/services/dashboardWebSocketService.ts`)
   - Real-time WebSocket server for dashboard updates
   - Subscription management for different dashboard types
   - Data change detection and notification system
   - Performance optimization with selective data updates

2. **DashboardController** (`src/controllers/dashboardController.ts`)
   - RESTful API endpoints for dashboard data
   - Request validation and error handling
   - Integration with analytics services

3. **Dashboard Routes** (`src/routes/dashboardRoutes.ts`)
   - Route definitions with proper authentication and authorization
   - Role-based access control
   - Rate limiting and audit logging

## Key Features

### Real-Time WebSocket Communication

- **Connection Path**: `/socket.io/dashboard`
- **Authentication**: JWT token-based authentication
- **Authorization**: Role-based permissions for data types
- **Rooms**: User-specific, vessel-specific, and role-based rooms

### Subscription Management

```typescript
interface DashboardSubscription {
  userId: string;
  socketId: string;
  dashboardType: 'executive' | 'operational' | 'financial' | 'custom';
  filters: DashboardFilters;
  dataTypes: string[];
  lastUpdate: Date;
}
```

### Supported Dashboard Types

1. **Executive Dashboard**
   - Fleet-wide spend analytics
   - Budget utilization tracking
   - Vendor performance scorecards
   - Cost savings and ROI tracking

2. **Operational Dashboard**
   - Cycle time and bottleneck analysis
   - Vessel-specific analytics
   - Port efficiency metrics
   - Inventory and demand analytics

3. **Financial Dashboard**
   - Multi-currency consolidation
   - Payment terms optimization
   - Cost analysis and variance tracking

### Data Change Detection

The service implements intelligent data change detection through:

- **Purchase Order Changes**: Monitors PO updates every 30 seconds
- **Budget Changes**: Tracks budget allocation changes every minute
- **Vendor Performance**: Updates vendor ratings every 2 minutes
- **Delivery Status**: Real-time delivery status monitoring

### Performance Optimization

- **Caching**: 15-minute TTL for analytics data
- **Selective Updates**: Only sends changed data to relevant subscribers
- **Connection Management**: Efficient subscription tracking and cleanup
- **Rate Limiting**: Dashboard-specific rate limits (30 requests/minute)

## API Endpoints

### Dashboard Data Endpoints

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| POST | `/api/dashboard/data` | Get comprehensive dashboard data | VIEW_ANALYTICS |
| GET | `/api/dashboard/spend-analytics` | Get spend analytics | VIEW_ANALYTICS |
| GET | `/api/dashboard/budget-utilization` | Get budget utilization | VIEW_BUDGET |
| GET | `/api/dashboard/vendor-performance` | Get vendor performance | VIEW_VENDORS |
| GET | `/api/dashboard/operational-metrics` | Get operational metrics | VIEW_OPERATIONS |
| GET | `/api/dashboard/financial-insights` | Get financial insights | VIEW_FINANCIAL_DATA |

### Management Endpoints

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/api/dashboard/subscription-stats` | Get WebSocket statistics | ADMIN |
| POST | `/api/dashboard/notification` | Send dashboard notification | ADMIN |
| GET | `/api/dashboard/health` | Dashboard health check | Authenticated |

### Vessel-Specific Endpoints

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/api/dashboard/vessel/:id/spend-analytics` | Vessel spend analytics | Vessel Access |
| GET | `/api/dashboard/vessel/:id/operational-metrics` | Vessel operational metrics | Vessel Access |

## WebSocket Events

### Client to Server Events

- `subscribe_dashboard`: Subscribe to dashboard updates
- `unsubscribe_dashboard`: Unsubscribe from dashboard updates
- `update_dashboard_filters`: Update subscription filters
- `request_dashboard_data`: Request immediate data update

### Server to Client Events

- `dashboard_data`: Initial dashboard data
- `dashboard_update`: Real-time data updates
- `dashboard_notification`: Dashboard notifications
- `dashboard_data_changed`: General data change notifications
- `dashboard_critical_notification`: Critical alerts

## Usage Examples

### WebSocket Client Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  path: '/socket.io/dashboard',
  auth: {
    token: 'your-jwt-token'
  }
});

// Subscribe to executive dashboard
socket.emit('subscribe_dashboard', {
  dashboardType: 'executive',
  dataTypes: ['spend_analytics', 'budget_utilization'],
  filters: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    vesselIds: ['vessel1', 'vessel2']
  },
  refreshInterval: 30000 // 30 seconds
});

// Listen for updates
socket.on('dashboard_update', (data) => {
  console.log('Dashboard update received:', data);
});
```

### REST API Usage

```javascript
// Get spend analytics
const response = await fetch('/api/dashboard/spend-analytics?' + new URLSearchParams({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  vesselIds: 'vessel1,vessel2',
  baseCurrency: 'USD'
}), {
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  }
});

const spendData = await response.json();
```

## Security Features

### Authentication & Authorization

- JWT token validation for all connections
- Role-based access control for data types
- Vessel-specific access validation
- Permission-based data filtering

### Rate Limiting

- Dashboard-specific rate limits (30 requests/minute)
- Adaptive rate limiting based on user role
- Connection-based throttling

### Audit Logging

- All dashboard access logged
- Subscription events tracked
- Security incidents recorded
- Performance metrics monitored

## Performance Considerations

### Caching Strategy

- Analytics data cached for 15 minutes
- Subscription state cached in memory
- Change detection optimized with timestamps
- Selective data updates to minimize bandwidth

### Connection Management

- Automatic cleanup of disconnected subscriptions
- Efficient room-based broadcasting
- Connection pooling and reuse
- Graceful degradation on high load

### Data Optimization

- Partial data updates for changed fields only
- Compression for large datasets
- Lazy loading for complex analytics
- Background data pre-aggregation

## Monitoring & Diagnostics

### Health Checks

- Service health endpoint: `/api/dashboard/health`
- Connection statistics tracking
- Performance metrics collection
- Error rate monitoring

### Statistics Available

```typescript
interface SubscriptionStatistics {
  totalSubscriptions: number;
  connectedUsers: number;
  subscriptionsByType: Record<string, number>;
  dataTypeUsage: Record<string, number>;
}
```

## Error Handling

### Connection Errors

- Automatic reconnection with exponential backoff
- Graceful degradation on service unavailability
- Client-side error recovery mechanisms
- Comprehensive error logging

### Data Errors

- Partial failure handling for analytics generation
- Fallback to cached data when possible
- Error notifications to affected subscribers
- Detailed error reporting for debugging

## Integration Points

### Analytics Service Integration

- Seamless integration with `DashboardAnalyticsService`
- Shared caching layer for performance
- Consistent data models and interfaces
- Error propagation and handling

### Existing WebSocket Service

- Coexists with existing notification WebSocket service
- Separate connection paths for different purposes
- Shared authentication and authorization logic
- Unified logging and monitoring

## Deployment Considerations

### Environment Variables

- `FRONTEND_URL`: Frontend URL for CORS configuration
- `JWT_SECRET`: JWT token secret for authentication
- `NODE_ENV`: Environment mode (development/production)

### Dependencies

- `socket.io`: WebSocket communication
- `jsonwebtoken`: JWT token handling
- `zod`: Request validation
- `@prisma/client`: Database access

### Scaling

- Horizontal scaling with Redis adapter support
- Load balancing considerations
- Session affinity for WebSocket connections
- Database connection pooling

## Testing

### Unit Tests

- Service method testing with mocked dependencies
- Permission validation testing
- Data transformation testing
- Error handling verification

### Integration Tests

- WebSocket connection testing
- End-to-end data flow testing
- Authentication and authorization testing
- Performance and load testing

## Future Enhancements

### Planned Features

- Redis adapter for horizontal scaling
- Advanced anomaly detection
- Custom dashboard builder
- Mobile-optimized data streaming
- Advanced filtering and search
- Export functionality integration

### Performance Improvements

- Database query optimization
- Advanced caching strategies
- Data compression techniques
- Connection pooling enhancements

## Conclusion

The Dashboard WebSocket Service provides a robust, scalable, and secure foundation for real-time dashboard functionality in FlowMarine. The implementation follows best practices for WebSocket communication, data management, and security while providing excellent performance and user experience.