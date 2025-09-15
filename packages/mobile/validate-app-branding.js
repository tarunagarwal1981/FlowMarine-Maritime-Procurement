#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Validation script for FlowMarine Mobile App Branding Implementation
 * Task 35.2.5.3: Add app icon, splash screen, and store assets
 */

const REQUIRED_FILES = [
  // App icons
  'src/assets/icons/app-icon.svg',
  'src/assets/icons/app-icon-background.svg',
  'src/assets/icons/app-icon-foreground.svg',
  'src/assets/icons/icon-config.json',
  
  // Splash screen
  'src/components/splash/SplashScreen.tsx',
  'src/services/splash/SplashService.ts',
  
  // Marketing materials
  'src/assets/marketing/screenshots/screenshot-config.json',
  'src/assets/marketing/screenshots/ScreenshotGenerator.tsx',
  'src/assets/marketing/store-metadata.json',
  
  // Deep linking
  'src/services/deeplink/DeepLinkService.ts',
  'src/services/deeplink/DeepLinkProvider.tsx',
  
  // Platform configurations
  'android/app/src/main/res/values/strings.xml',
  'android/app/src/main/res/values/styles.xml',
  'android/app/src/main/res/values/colors.xml',
  'android/app/src/main/res/drawable/splash_background.xml',
  'android/app/src/main/AndroidManifest.xml',
  'ios/FlowMarine/Info.plist',
];

const REQUIRED_COMPONENTS = [
  'SplashScreen',
  'SplashService',
  'DeepLinkService',
  'DeepLinkProvider',
  'ScreenshotGenerator',
];

function validateFileExists(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${filePath}`);
    return false;
  }
  console.log(`✅ Found: ${filePath}`);
  return true;
}

function validateFileContent(filePath, requiredContent) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const missing = requiredContent.filter(item => !content.includes(item));
  
  if (missing.length > 0) {
    console.error(`❌ ${filePath} missing required content: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

function validateSplashScreenImplementation() {
  console.log('\n🔍 Validating Splash Screen Implementation...');
  
  const splashScreenPath = 'src/components/splash/SplashScreen.tsx';
  const requiredElements = [
    'SplashScreen',
    'LinearGradient',
    'Animated',
    'onAnimationComplete',
    'FlowMarine',
    'Maritime Procurement Platform',
  ];
  
  return validateFileContent(splashScreenPath, requiredElements);
}

function validateDeepLinkingImplementation() {
  console.log('\n🔍 Validating Deep Linking Implementation...');
  
  const deepLinkServicePath = 'src/services/deeplink/DeepLinkService.ts';
  const requiredFeatures = [
    'DeepLinkService',
    'handleDeepLink',
    'createDeepLink',
    'flowmarine://',
    'app.flowmarine.com',
    'requisitions',
    'vendors',
    'analytics',
  ];
  
  return validateFileContent(deepLinkServicePath, requiredFeatures);
}

function validateAppConfiguration() {
  console.log('\n🔍 Validating App Configuration...');
  
  // Check App.tsx integration
  const appPath = 'src/App.tsx';
  const requiredIntegrations = [
    'SplashScreen',
    'DeepLinkProvider',
    'splashService',
    'deepLinkService',
    'linking',
  ];
  
  return validateFileContent(appPath, requiredIntegrations);
}

function validateMarketingAssets() {
  console.log('\n🔍 Validating Marketing Assets...');
  
  const metadataPath = 'src/assets/marketing/store-metadata.json';
  if (!fs.existsSync(path.join(__dirname, metadataPath))) {
    return false;
  }
  
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, metadataPath), 'utf8'));
    
    const requiredFields = [
      'appName',
      'descriptions',
      'keywords',
      'features',
      'screenshots',
      'privacy',
      'support',
      'requirements',
    ];
    
    const missing = requiredFields.filter(field => !metadata[field]);
    if (missing.length > 0) {
      console.error(`❌ Store metadata missing fields: ${missing.join(', ')}`);
      return false;
    }
    
    console.log('✅ Store metadata validation passed');
    return true;
  } catch (error) {
    console.error(`❌ Invalid JSON in store metadata: ${error.message}`);
    return false;
  }
}

function validatePlatformConfigurations() {
  console.log('\n🔍 Validating Platform Configurations...');
  
  // Android validation
  const androidManifest = 'android/app/src/main/AndroidManifest.xml';
  const androidRequirements = [
    'com.flowmarine.mobile',
    'SplashActivity',
    'flowmarine',
    'app.flowmarine.com',
    'CAMERA',
    'ACCESS_FINE_LOCATION',
    'USE_BIOMETRIC',
  ];
  
  const androidValid = validateFileContent(androidManifest, androidRequirements);
  
  // iOS validation
  const iosInfo = 'ios/FlowMarine/Info.plist';
  const iosRequirements = [
    'FlowMarine',
    'CFBundleURLSchemes',
    'flowmarine',
    'NSCameraUsageDescription',
    'NSLocationWhenInUseUsageDescription',
    'NSFaceIDUsageDescription',
    'com.apple.developer.associated-domains',
  ];
  
  const iosValid = validateFileContent(iosInfo, iosRequirements);
  
  return androidValid && iosValid;
}

function validateIconAssets() {
  console.log('\n🔍 Validating Icon Assets...');
  
  const iconConfigPath = 'src/assets/icons/icon-config.json';
  if (!fs.existsSync(path.join(__dirname, iconConfigPath))) {
    return false;
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, iconConfigPath), 'utf8'));
    
    if (!config.platforms || !config.platforms.ios || !config.platforms.android) {
      console.error('❌ Icon config missing platform configurations');
      return false;
    }
    
    console.log('✅ Icon configuration validation passed');
    return true;
  } catch (error) {
    console.error(`❌ Invalid icon configuration: ${error.message}`);
    return false;
  }
}

function runValidation() {
  console.log('🚀 FlowMarine Mobile App Branding Validation');
  console.log('='.repeat(50));
  
  let allValid = true;
  
  // Check required files
  console.log('\n📁 Checking Required Files...');
  for (const file of REQUIRED_FILES) {
    if (!validateFileExists(file)) {
      allValid = false;
    }
  }
  
  // Validate implementations
  if (!validateSplashScreenImplementation()) allValid = false;
  if (!validateDeepLinkingImplementation()) allValid = false;
  if (!validateAppConfiguration()) allValid = false;
  if (!validateMarketingAssets()) allValid = false;
  if (!validatePlatformConfigurations()) allValid = false;
  if (!validateIconAssets()) allValid = false;
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (allValid) {
    console.log('✅ All validations passed! App branding implementation is complete.');
    console.log('\n📱 Ready for:');
    console.log('   • App icon generation for multiple resolutions');
    console.log('   • Splash screen with FlowMarine branding');
    console.log('   • Deep linking navigation');
    console.log('   • App store submission with marketing materials');
    console.log('   • Platform-specific configurations');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Generate app icons using the SVG assets');
    console.log('   2. Test deep linking on both platforms');
    console.log('   3. Capture app store screenshots');
    console.log('   4. Submit to app stores with metadata');
    
    process.exit(0);
  } else {
    console.log('❌ Validation failed. Please fix the issues above.');
    process.exit(1);
  }
}

// Run validation
runValidation();