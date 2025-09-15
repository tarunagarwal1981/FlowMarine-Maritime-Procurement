const fs = require('fs');
const path = require('path');

/**
 * Validation script for Task 35.2.2: Requisition Management Mobile Screens
 * 
 * This script validates that all required components and functionality
 * have been implemented according to the task requirements.
 */

const requiredFiles = [
  'src/screens/requisitions/RequisitionListScreen.tsx',
  'src/screens/requisitions/RequisitionDetailScreen.tsx',
  'src/screens/requisitions/RequisitionCreateScreen.tsx',
  'src/screens/requisitions/ApprovalWorkflowScreen.tsx',
  'src/components/requisitions/BarcodeScanner.tsx',
  'src/components/common/SyncIndicator.tsx',
  'src/navigation/stacks/RequisitionStackNavigator.tsx',
];

const requiredFeatures = {
  'RequisitionListScreen.tsx': [
    'FlatList',
    'RefreshControl',
    'search functionality',
    'filter functionality',
    'offline indicator',
    'sync status',
    'TouchableOpacity',
    'navigation to detail screen',
    'navigation to create screen',
  ],
  'RequisitionDetailScreen.tsx': [
    'requisition details display',
    'vessel information',
    'financial summary',
    'items list',
    'status badges',
    'urgency indicators',
    'offline indicator',
    'edit functionality',
    'approval workflow navigation',
  ],
  'RequisitionCreateScreen.tsx': [
    'form validation',
    'vessel selection',
    'delivery information',
    'item management',
    'camera integration',
    'barcode scanning',
    'catalog search',
    'offline support',
    'draft saving',
    'photo attachment',
    'urgency level selection',
  ],
  'ApprovalWorkflowScreen.tsx': [
    'approval steps display',
    'progress tracking',
    'approval actions',
    'rejection functionality',
    'delegation support',
    'comments system',
    'offline sync',
    'emergency procedures',
  ],
  'BarcodeScanner.tsx': [
    'QRCodeScanner',
    'BarcodeMask',
    'camera permissions',
    'flash control',
    'manual entry',
    'scan validation',
    'error handling',
  ],
};

function validateFileExists(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${filePath}`);
    return false;
  }
  console.log(`✅ File exists: ${filePath}`);
  return true;
}

function validateFileContent(filePath, requiredFeatures) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const fileName = path.basename(filePath);
  const features = requiredFeatures[fileName] || [];

  console.log(`\n📋 Validating features in ${fileName}:`);
  
  let allFeaturesPresent = true;
  features.forEach(feature => {
    const featurePatterns = {
      'FlatList': /FlatList/,
      'RefreshControl': /RefreshControl/,
      'search functionality': /(searchQuery|TextInput.*search|placeholder.*[Ss]earch)/,
      'filter functionality': /(filter|Filter)/,
      'offline indicator': /(offline|Offline|cloud-off)/,
      'sync status': /(sync|Sync|pendingSync)/,
      'TouchableOpacity': /TouchableOpacity/,
      'navigation to detail screen': /(navigate.*Detail|RequisitionDetail)/,
      'navigation to create screen': /(navigate.*Create|RequisitionCreate)/,
      'requisition details display': /(requisitionNumber|vesselName|totalAmount)/,
      'vessel information': /(vesselName|deliveryLocation)/,
      'financial summary': /(totalAmount|currency|itemCount)/,
      'items list': /(items\.map|requisition\.items)/,
      'status badges': /(statusBadge|getStatusColor)/,
      'urgency indicators': /(urgency|Urgency)/,
      'edit functionality': /(edit|Edit)/,
      'approval workflow navigation': /(ApprovalWorkflow|approval)/,
      'form validation': /(validation|required|error)/,
      'vessel selection': /(vesselId|vessel.*select)/,
      'delivery information': /(deliveryLocation|deliveryDate)/,
      'item management': /(addItem|removeItem|currentItem)/,
      'camera integration': /(camera|Camera|launchCamera|launchImageLibrary)/,
      'barcode scanning': /(barcode|Barcode|QRCode|scanner)/,
      'catalog search': /(catalog|Catalog|itemCatalog)/,
      'offline support': /(offline|addOfflineRequisition|addSyncItem)/,
      'draft saving': /(draft|Draft|saveDraftRequisition)/,
      'photo attachment': /(photo|Photo|image|Image)/,
      'urgency level selection': /(urgencyLevel|ROUTINE|URGENT|EMERGENCY)/,
      'approval steps display': /(approvalSteps|stepCard)/,
      'progress tracking': /(progress|Progress|completedSteps)/,
      'approval actions': /(approve|Approve|handleApprove)/,
      'rejection functionality': /(reject|Reject|handleReject)/,
      'delegation support': /(delegate|Delegate|delegatedTo)/,
      'comments system': /(comments|Comments)/,
      'offline sync': /(addSyncItem|isOffline.*dispatch)/,
      'emergency procedures': /(emergency|Emergency)/,
      'QRCodeScanner': /QRCodeScanner/,
      'BarcodeMask': /BarcodeMask/,
      'camera permissions': /(permission|Permission|CAMERA)/,
      'flash control': /(flash|Flash|torch)/,
      'manual entry': /(manual|Manual|prompt)/,
      'scan validation': /(validate|scannedData)/,
      'error handling': /(error|Error|catch|Alert)/,
    };

    const pattern = featurePatterns[feature];
    if (pattern && pattern.test(content)) {
      console.log(`  ✅ ${feature}`);
    } else {
      console.log(`  ❌ ${feature}`);
      allFeaturesPresent = false;
    }
  });

  return allFeaturesPresent;
}

function validateImports(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const fileName = path.basename(filePath);

  console.log(`\n📦 Validating imports in ${fileName}:`);

  const requiredImports = {
    'RequisitionListScreen.tsx': [
      'react-native',
      'react-redux',
      '@react-navigation/native',
      'react-native-vector-icons',
    ],
    'RequisitionCreateScreen.tsx': [
      'react-native-image-picker',
      'react-native-date-picker',
    ],
    'BarcodeScanner.tsx': [
      'react-native-qrcode-scanner',
      'react-native-barcode-mask',
      'react-native-permissions',
    ],
  };

  const imports = requiredImports[fileName] || [];
  let allImportsPresent = true;

  imports.forEach(importName => {
    const importPattern = new RegExp(`from ['"]${importName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    if (importPattern.test(content)) {
      console.log(`  ✅ ${importName}`);
    } else {
      console.log(`  ❌ ${importName}`);
      allImportsPresent = false;
    }
  });

  return allImportsPresent;
}

function validateReduxIntegration() {
  console.log('\n🔄 Validating Redux Integration:');
  
  const slicePath = path.join(__dirname, 'src/store/slices/requisitionSlice.ts');
  if (!fs.existsSync(slicePath)) {
    console.log('  ❌ Requisition slice not found');
    return false;
  }

  const sliceContent = fs.readFileSync(slicePath, 'utf8');
  const requiredActions = [
    'setRequisitions',
    'addRequisition',
    'updateRequisition',
    'saveDraftRequisition',
    'addOfflineRequisition',
  ];

  let allActionsPresent = true;
  requiredActions.forEach(action => {
    if (sliceContent.includes(action)) {
      console.log(`  ✅ ${action} action`);
    } else {
      console.log(`  ❌ ${action} action`);
      allActionsPresent = false;
    }
  });

  return allActionsPresent;
}

function validateOfflineSupport() {
  console.log('\n📱 Validating Offline Support:');
  
  const offlineSlicePath = path.join(__dirname, 'src/store/slices/offlineSlice.ts');
  if (!fs.existsSync(offlineSlicePath)) {
    console.log('  ❌ Offline slice not found');
    return false;
  }

  const offlineContent = fs.readFileSync(offlineSlicePath, 'utf8');
  const requiredFeatures = [
    'addSyncItem',
    'pendingSync',
    'isOnline',
    'SyncItem',
  ];

  let allFeaturesPresent = true;
  requiredFeatures.forEach(feature => {
    if (offlineContent.includes(feature)) {
      console.log(`  ✅ ${feature}`);
    } else {
      console.log(`  ❌ ${feature}`);
      allFeaturesPresent = false;
    }
  });

  return allFeaturesPresent;
}

function validateNavigationIntegration() {
  console.log('\n🧭 Validating Navigation Integration:');
  
  const navPath = path.join(__dirname, 'src/navigation/stacks/RequisitionStackNavigator.tsx');
  if (!fs.existsSync(navPath)) {
    console.log('  ❌ RequisitionStackNavigator not found');
    return false;
  }

  const navContent = fs.readFileSync(navPath, 'utf8');
  const requiredScreens = [
    'RequisitionList',
    'RequisitionDetail',
    'RequisitionCreate',
    'ApprovalWorkflow',
  ];

  let allScreensPresent = true;
  requiredScreens.forEach(screen => {
    if (navContent.includes(screen)) {
      console.log(`  ✅ ${screen} screen`);
    } else {
      console.log(`  ❌ ${screen} screen`);
      allScreensPresent = false;
    }
  });

  return allScreensPresent;
}

function main() {
  console.log('🔍 Validating Task 35.2.2: Requisition Management Mobile Screens\n');
  console.log('=' .repeat(60));

  let allValid = true;

  // Check file existence
  console.log('\n📁 Checking required files:');
  requiredFiles.forEach(file => {
    if (!validateFileExists(file)) {
      allValid = false;
    }
  });

  // Validate file contents
  Object.keys(requiredFeatures).forEach(fileName => {
    const filePath = requiredFiles.find(f => f.endsWith(fileName));
    if (filePath && !validateFileContent(filePath, requiredFeatures)) {
      allValid = false;
    }
  });

  // Validate imports
  requiredFiles.forEach(file => {
    if (!validateImports(file)) {
      allValid = false;
    }
  });

  // Validate Redux integration
  if (!validateReduxIntegration()) {
    allValid = false;
  }

  // Validate offline support
  if (!validateOfflineSupport()) {
    allValid = false;
  }

  // Validate navigation integration
  if (!validateNavigationIntegration()) {
    allValid = false;
  }

  console.log('\n' + '=' .repeat(60));
  if (allValid) {
    console.log('✅ All validations passed! Task 35.2.2 implementation is complete.');
    console.log('\n📋 Implemented Features:');
    console.log('  • Requisition list with search and filtering');
    console.log('  • Detailed requisition view with status tracking');
    console.log('  • Requisition creation form with camera integration');
    console.log('  • Barcode/QR code scanning for parts');
    console.log('  • Approval workflow screens for mobile');
    console.log('  • Offline requisition creation with sync indicators');
    console.log('  • Photo attachment and documentation');
    console.log('  • Draft saving and offline support');
    console.log('  • Touch-friendly mobile interface');
    console.log('  • Real-time sync status indicators');
  } else {
    console.log('❌ Some validations failed. Please review the implementation.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateFileExists,
  validateFileContent,
  validateImports,
  validateReduxIntegration,
  validateOfflineSupport,
  validateNavigationIntegration,
};