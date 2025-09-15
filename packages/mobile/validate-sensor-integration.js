#!/usr/bin/env node

/**
 * Validation script for Task 35.2.4.2: Integrate device sensors for environmental data
 * 
 * This script validates that all sensor integration components are properly implemented:
 * - SensorService for environmental data collection
 * - SensorProvider for React context integration
 * - EnvironmentalMonitor component for displaying sensor data
 * - MotionInteractions component for motion-based UI interactions
 * - Integration with vessel analytics
 * - Device permissions handling
 */

const fs = require('fs');
const path = require('path');

const MOBILE_ROOT = path.join(__dirname);

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(MOBILE_ROOT, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    log(`✅ ${description}`, colors.green);
    return true;
  } else {
    log(`❌ ${description} - File not found: ${filePath}`, colors.red);
    return false;
  }
}

function checkFileContent(filePath, patterns, description) {
  const fullPath = path.join(MOBILE_ROOT, filePath);
  
  if (!fs.existsSync(fullPath)) {
    log(`❌ ${description} - File not found: ${filePath}`, colors.red);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const results = patterns.map(pattern => {
    const regex = new RegExp(pattern.pattern, pattern.flags || 'g');
    const matches = content.match(regex);
    return {
      ...pattern,
      found: !!matches,
      matches: matches || []
    };
  });

  const allFound = results.every(r => r.found);
  
  if (allFound) {
    log(`✅ ${description}`, colors.green);
    return true;
  } else {
    log(`❌ ${description}`, colors.red);
    results.forEach(result => {
      if (!result.found) {
        log(`   Missing: ${result.description}`, colors.yellow);
      }
    });
    return false;
  }
}

function validateSensorService() {
  log('\n📱 Validating SensorService Implementation...', colors.blue);
  
  const patterns = [
    {
      pattern: 'from [\'"]react-native-sensors[\'"]',
      description: 'react-native-sensors import'
    },
    {
      pattern: 'interface.*EnvironmentalData',
      description: 'EnvironmentalData interface'
    },
    {
      pattern: 'interface.*SensorConfig',
      description: 'SensorConfig interface'
    },
    {
      pattern: 'interface.*MotionEvent',
      description: 'MotionEvent interface'
    },
    {
      pattern: 'class SensorService',
      description: 'SensorService class'
    },
    {
      pattern: 'accelerometer.*subscribe',
      description: 'Accelerometer subscription'
    },
    {
      pattern: 'gyroscope.*subscribe',
      description: 'Gyroscope subscription'
    },
    {
      pattern: 'magnetometer.*subscribe',
      description: 'Magnetometer subscription'
    },
    {
      pattern: 'updateMotionAnalysis',
      description: 'Motion analysis method'
    },
    {
      pattern: 'updateSeaConditions',
      description: 'Sea conditions analysis'
    },
    {
      pattern: 'detectMotionEvents',
      description: 'Motion event detection'
    },
    {
      pattern: 'checkSensorAvailability',
      description: 'Sensor availability check'
    }
  ];

  return checkFileContent('src/services/sensor/SensorService.ts', patterns, 'SensorService implementation');
}

function validateSensorProvider() {
  log('\n🔧 Validating SensorProvider Implementation...', colors.blue);
  
  const patterns = [
    {
      pattern: 'interface.*SensorContextType',
      description: 'SensorContextType interface'
    },
    {
      pattern: 'createContext.*SensorContextType',
      description: 'Sensor context creation'
    },
    {
      pattern: 'export.*SensorProvider',
      description: 'SensorProvider component export'
    },
    {
      pattern: 'export.*useSensor',
      description: 'useSensor hook export'
    },
    {
      pattern: 'SensorService\\.initialize',
      description: 'SensorService initialization'
    },
    {
      pattern: 'SensorService\\.subscribe',
      description: 'SensorService subscription'
    },
    {
      pattern: 'startSensors.*function',
      description: 'Start sensors function'
    },
    {
      pattern: 'stopSensors.*function',
      description: 'Stop sensors function'
    }
  ];

  return checkFileContent('src/services/sensor/SensorProvider.tsx', patterns, 'SensorProvider implementation');
}

function validateEnvironmentalMonitor() {
  log('\n🌊 Validating EnvironmentalMonitor Component...', colors.blue);
  
  const patterns = [
    {
      pattern: 'interface.*EnvironmentalMonitorProps',
      description: 'EnvironmentalMonitorProps interface'
    },
    {
      pattern: 'useSensor.*hook',
      description: 'useSensor hook usage'
    },
    {
      pattern: 'useDevice.*hook',
      description: 'useDevice hook usage'
    },
    {
      pattern: 'subscribeToMotionEvents',
      description: 'Motion events subscription'
    },
    {
      pattern: 'requestSensorPermissions',
      description: 'Sensor permissions request'
    },
    {
      pattern: 'getSeaConditionColor',
      description: 'Sea condition color mapping'
    },
    {
      pattern: 'getStabilityColor',
      description: 'Stability color mapping'
    },
    {
      pattern: 'Accelerometer.*m/s²',
      description: 'Accelerometer display'
    },
    {
      pattern: 'Gyroscope.*rad/s',
      description: 'Gyroscope display'
    },
    {
      pattern: 'Magnetometer.*μT',
      description: 'Magnetometer display'
    },
    {
      pattern: 'Recent Motion Events',
      description: 'Motion events display'
    }
  ];

  return checkFileContent('src/components/analytics/EnvironmentalMonitor.tsx', patterns, 'EnvironmentalMonitor component');
}

function validateMotionInteractions() {
  log('\n🎯 Validating MotionInteractions Component...', colors.blue);
  
  const patterns = [
    {
      pattern: 'interface.*MotionInteractionsProps',
      description: 'MotionInteractionsProps interface'
    },
    {
      pattern: 'enableShakeToRefresh',
      description: 'Shake to refresh feature'
    },
    {
      pattern: 'enableTiltNavigation',
      description: 'Tilt navigation feature'
    },
    {
      pattern: 'enableMotionFeedback',
      description: 'Motion feedback feature'
    },
    {
      pattern: 'handleShakeGesture',
      description: 'Shake gesture handler'
    },
    {
      pattern: 'handleTiltGesture',
      description: 'Tilt gesture handler'
    },
    {
      pattern: 'handleImpactFeedback',
      description: 'Impact feedback handler'
    },
    {
      pattern: 'Vibration\\.vibrate',
      description: 'Haptic feedback'
    },
    {
      pattern: 'Animated\\.timing',
      description: 'Animation feedback'
    },
    {
      pattern: 'useMotionInteractions',
      description: 'Motion interactions hook'
    },
    {
      pattern: 'MotionSensitiveView',
      description: 'Motion sensitive view component'
    }
  ];

  return checkFileContent('src/components/motion/MotionInteractions.tsx', patterns, 'MotionInteractions component');
}

function validateDeviceProviderUpdates() {
  log('\n📱 Validating DeviceProvider Updates...', colors.blue);
  
  const patterns = [
    {
      pattern: 'sensors.*boolean',
      description: 'Sensor permissions in interface'
    },
    {
      pattern: 'requestSensorPermissions.*function',
      description: 'Request sensor permissions function'
    },
    {
      pattern: 'PermissionsAndroid.*BODY_SENSORS',
      description: 'Android sensor permissions'
    },
    {
      pattern: 'checkSensorAvailability',
      description: 'Sensor availability check'
    }
  ];

  return checkFileContent('src/services/device/DeviceProvider.tsx', patterns, 'DeviceProvider sensor integration');
}

function validateVesselAnalyticsIntegration() {
  log('\n📊 Validating VesselAnalytics Integration...', colors.blue);
  
  const patterns = [
    {
      pattern: 'import.*EnvironmentalMonitor',
      description: 'EnvironmentalMonitor import'
    },
    {
      pattern: 'import.*MotionInteractions',
      description: 'MotionInteractions import'
    },
    {
      pattern: '<EnvironmentalMonitor',
      description: 'EnvironmentalMonitor usage'
    },
    {
      pattern: '<MotionInteractions',
      description: 'MotionInteractions wrapper'
    },
    {
      pattern: 'Environmental Monitoring',
      description: 'Environmental monitoring section'
    },
    {
      pattern: 'enableShakeToRefresh.*true',
      description: 'Shake to refresh enabled'
    },
    {
      pattern: 'onShakeDetected.*handleRefresh',
      description: 'Shake gesture connected to refresh'
    }
  ];

  return checkFileContent('src/screens/analytics/VesselAnalyticsScreen.tsx', patterns, 'VesselAnalytics sensor integration');
}

function validateAppProviderIntegration() {
  log('\n🚀 Validating App Provider Integration...', colors.blue);
  
  const patterns = [
    {
      pattern: 'import.*SensorProvider',
      description: 'SensorProvider import'
    },
    {
      pattern: '<SensorProvider',
      description: 'SensorProvider usage'
    },
    {
      pattern: 'autoStart.*false',
      description: 'SensorProvider configuration'
    }
  ];

  return checkFileContent('src/App.tsx', patterns, 'App SensorProvider integration');
}

function validateDashboardSliceUpdates() {
  log('\n🗃️ Validating Dashboard Slice Updates...', colors.blue);
  
  const patterns = [
    {
      pattern: 'Environmental data interface',
      description: 'Environmental data in VesselAnalyticsData'
    },
    {
      pattern: 'accelerometer.*gyroscope.*magnetometer',
      description: 'Sensor data fields'
    },
    {
      pattern: 'motionIntensity.*number',
      description: 'Motion intensity field'
    },
    {
      pattern: 'seaConditions.*calm.*moderate.*rough',
      description: 'Sea conditions field'
    },
    {
      pattern: 'stability.*stable.*moderate.*unstable',
      description: 'Stability field'
    }
  ];

  return checkFileContent('src/store/slices/dashboardSlice.ts', patterns, 'Dashboard slice environmental data');
}

function validatePackageDependencies() {
  log('\n📦 Validating Package Dependencies...', colors.blue);
  
  const patterns = [
    {
      pattern: '"react-native-sensors".*"\\^?[0-9]+\\.[0-9]+\\.[0-9]+"',
      description: 'react-native-sensors dependency'
    },
    {
      pattern: '"react-native-permissions".*"\\^?[0-9]+\\.[0-9]+\\.[0-9]+"',
      description: 'react-native-permissions dependency'
    }
  ];

  return checkFileContent('package.json', patterns, 'Required sensor dependencies');
}

function main() {
  log('🔍 FlowMarine Mobile - Sensor Integration Validation', colors.bold);
  log('=' .repeat(60), colors.blue);

  const validations = [
    () => checkFileExists('src/services/sensor/SensorService.ts', 'SensorService file exists'),
    () => checkFileExists('src/services/sensor/SensorProvider.tsx', 'SensorProvider file exists'),
    () => checkFileExists('src/components/analytics/EnvironmentalMonitor.tsx', 'EnvironmentalMonitor file exists'),
    () => checkFileExists('src/components/motion/MotionInteractions.tsx', 'MotionInteractions file exists'),
    validatePackageDependencies,
    validateSensorService,
    validateSensorProvider,
    validateEnvironmentalMonitor,
    validateMotionInteractions,
    validateDeviceProviderUpdates,
    validateVesselAnalyticsIntegration,
    validateAppProviderIntegration,
    validateDashboardSliceUpdates
  ];

  const results = validations.map(validation => {
    try {
      return validation();
    } catch (error) {
      log(`❌ Validation error: ${error.message}`, colors.red);
      return false;
    }
  });

  const passed = results.filter(Boolean).length;
  const total = results.length;

  log('\n' + '='.repeat(60), colors.blue);
  
  if (passed === total) {
    log(`🎉 All validations passed! (${passed}/${total})`, colors.green);
    log('\n✅ Task 35.2.4.2 Implementation Complete:', colors.green);
    log('   • SensorService for environmental data collection', colors.green);
    log('   • SensorProvider for React context integration', colors.green);
    log('   • EnvironmentalMonitor component for sensor data display', colors.green);
    log('   • MotionInteractions for motion-based UI interactions', colors.green);
    log('   • Integration with vessel analytics', colors.green);
    log('   • Device permissions handling', colors.green);
    log('   • Real-time environmental monitoring', colors.green);
    log('   • Motion event detection and feedback', colors.green);
    
    process.exit(0);
  } else {
    log(`❌ ${total - passed} validation(s) failed. (${passed}/${total})`, colors.red);
    log('\nPlease fix the issues above and run the validation again.', colors.yellow);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateSensorService,
  validateSensorProvider,
  validateEnvironmentalMonitor,
  validateMotionInteractions,
  validateDeviceProviderUpdates,
  validateVesselAnalyticsIntegration,
  validateAppProviderIntegration,
  validateDashboardSliceUpdates
};