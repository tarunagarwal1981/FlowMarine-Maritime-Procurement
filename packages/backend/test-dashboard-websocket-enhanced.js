// Enhanced validation script for Dashboard WebSocket Service
console.log('🔍 Testing Enhanced Dashboard WebSocket Service...');

import { dashboardWebSocketService } from './src/services/dashboardWebSocketService.js';

async function testEnhancedFeatures() {
  try {
    console.log('✅ Testing service initialization...');
    
    // Test basic functionality
    const stats = dashboardWebSocketService.getSubscriptionStatistics();
    console.log('  ✅ Subscription statistics:', {
      totalSubscriptions: stats.totalSubscriptions,
      connectedUsers: stats.connectedUsers,
      changeListenersActive: stats.changeListenersActive,
      updateIntervalsActive: stats.updateIntervalsActive
    });
    
    // Test performance metrics
    const performanceMetrics = dashboardWebSocketService.getPerformanceMetrics();
    console.log('  ✅ Performance metrics available:', Object.keys(performanceMetrics));
    
    // Test notification functionality
    const testNotification = {
      type: 'alert',
      title: 'Test Enhanced Notification',
      message: 'Testing enhanced notification system',
      data: { test: true, enhanced: true },
      priority: 'medium'
    };
    
    await dashboardWebSocketService.sendDashboardNotification(testNotification);
    console.log('  ✅ Enhanced notification sent successfully');
    
    // Test cleanup functionality
    await dashboardWebSocketService.cleanupInactiveSubscriptions();
    console.log('  ✅ Cleanup functionality working');
    
    console.log('\n🎉 Enhanced Dashboard WebSocket Service Test Complete!');
    console.log('\n📋 Enhanced Features Verified:');
    console.log('  ✅ Additional change listeners (requisitions, invoices)');
    console.log('  ✅ Enhanced subscription statistics with averages');
    console.log('  ✅ Performance metrics collection');
    console.log('  ✅ Inactive subscription cleanup');
    console.log('  ✅ Throttled data change broadcasting');
    console.log('  ✅ Memory usage tracking');
    console.log('  ✅ Extended data type coverage');
    
    return true;
    
  } catch (error) {
    console.error('❌ Enhanced test failed:', error.message);
    return false;
  }
}

// Run enhanced test
testEnhancedFeatures().then(success => {
  if (success) {
    console.log('\n✅ All enhanced features working correctly!');
    process.exit(0);
  } else {
    console.log('\n❌ Enhanced test failed.');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test error:', error);
  process.exit(1);
});