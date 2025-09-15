#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔄 Validating Mobile Workflow Optimizations Implementation...\n');

const requiredFiles = [
  'src/components/workflow/SwipeGestureHandler.tsx',
  'src/components/workflow/VoiceToTextInput.tsx',
  'src/components/workflow/QuickActionBar.tsx',
  'src/components/workflow/SmartFormAutoComplete.tsx',
  'src/components/workflow/ContextualHelp.tsx',
  'src/services/workflow/WorkflowOptimizationService.ts',
];

const enhancedFiles = [
  'src/screens/requisitions/RequisitionListScreen.tsx',
  'src/screens/requisitions/RequisitionCreateScreen.tsx',
];

let allValid = true;

// Check if all required files exist
console.log('📁 Checking required workflow optimization files...');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing`);
    allValid = false;
  }
});

console.log('\n📱 Checking enhanced screen files...');
enhancedFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing`);
    allValid = false;
  }
});

// Validate SwipeGestureHandler implementation
console.log('\n🔍 Validating SwipeGestureHandler implementation...');
try {
  const swipeHandlerPath = path.join(__dirname, 'src/components/workflow/SwipeGestureHandler.tsx');
  const swipeHandlerContent = fs.readFileSync(swipeHandlerPath, 'utf8');
  
  const requiredFeatures = [
    'PanResponder',
    'onSwipeLeft',
    'onSwipeRight',
    'leftAction',
    'rightAction',
    'threshold',
    'Animated.View',
  ];
  
  requiredFeatures.forEach(feature => {
    if (swipeHandlerContent.includes(feature)) {
      console.log(`✅ SwipeGestureHandler includes ${feature}`);
    } else {
      console.log(`❌ SwipeGestureHandler missing ${feature}`);
      allValid = false;
    }
  });
} catch (error) {
  console.log(`❌ Error validating SwipeGestureHandler: ${error.message}`);
  allValid = false;
}

// Validate VoiceToTextInput implementation
console.log('\n🎤 Validating VoiceToTextInput implementation...');
try {
  const voiceInputPath = path.join(__dirname, 'src/components/workflow/VoiceToTextInput.tsx');
  const voiceInputContent = fs.readFileSync(voiceInputPath, 'utf8');
  
  const requiredFeatures = [
    'react-native-permissions',
    'PERMISSIONS',
    'microphone',
    'isListening',
    'startListening',
    'stopListening',
    'onLongPress',
  ];
  
  requiredFeatures.forEach(feature => {
    if (voiceInputContent.includes(feature)) {
      console.log(`✅ VoiceToTextInput includes ${feature}`);
    } else {
      console.log(`❌ VoiceToTextInput missing ${feature}`);
      allValid = false;
    }
  });
} catch (error) {
  console.log(`❌ Error validating VoiceToTextInput: ${error.message}`);
  allValid = false;
}

// Validate QuickActionBar implementation
console.log('\n⚡ Validating QuickActionBar implementation...');
try {
  const quickActionPath = path.join(__dirname, 'src/components/workflow/QuickActionBar.tsx');
  const quickActionContent = fs.readFileSync(quickActionPath, 'utf8');
  
  const requiredFeatures = [
    'QuickAction',
    'getCommonQuickActions',
    'getRequisitionQuickActions',
    'ScrollView',
    'horizontal',
    'badge',
    'onPress',
  ];
  
  requiredFeatures.forEach(feature => {
    if (quickActionContent.includes(feature)) {
      console.log(`✅ QuickActionBar includes ${feature}`);
    } else {
      console.log(`❌ QuickActionBar missing ${feature}`);
      allValid = false;
    }
  });
} catch (error) {
  console.log(`❌ Error validating QuickActionBar: ${error.message}`);
  allValid = false;
}

// Validate SmartFormAutoComplete implementation
console.log('\n🧠 Validating SmartFormAutoComplete implementation...');
try {
  const autoCompletePath = path.join(__dirname, 'src/components/workflow/SmartFormAutoComplete.tsx');
  const autoCompleteContent = fs.readFileSync(autoCompletePath, 'utf8');
  
  const requiredFeatures = [
    'AutoCompleteItem',
    'fuzzy matching',
    'userPreferences',
    'learningEnabled',
    'getMaritimeItemSuggestions',
    'getVesselSuggestions',
    'getPortSuggestions',
    'filteredSuggestions',
    'onSelectItem',
  ];
  
  requiredFeatures.forEach(feature => {
    if (autoCompleteContent.includes(feature)) {
      console.log(`✅ SmartFormAutoComplete includes ${feature}`);
    } else {
      console.log(`❌ SmartFormAutoComplete missing ${feature}`);
      allValid = false;
    }
  });
} catch (error) {
  console.log(`❌ Error validating SmartFormAutoComplete: ${error.message}`);
  allValid = false;
}

// Validate ContextualHelp implementation
console.log('\n❓ Validating ContextualHelp implementation...');
try {
  const helpPath = path.join(__dirname, 'src/components/workflow/ContextualHelp.tsx');
  const helpContent = fs.readFileSync(helpPath, 'utf8');
  
  const requiredFeatures = [
    'HelpTip',
    'getRequisitionHelpTips',
    'getApprovalHelpTips',
    'getDashboardHelpTips',
    'Modal',
    'showOnce',
    'dismissedTips',
    'Tooltip',
  ];
  
  requiredFeatures.forEach(feature => {
    if (helpContent.includes(feature)) {
      console.log(`✅ ContextualHelp includes ${feature}`);
    } else {
      console.log(`❌ ContextualHelp missing ${feature}`);
      allValid = false;
    }
  });
} catch (error) {
  console.log(`❌ Error validating ContextualHelp: ${error.message}`);
  allValid = false;
}

// Validate WorkflowOptimizationService implementation
console.log('\n🔧 Validating WorkflowOptimizationService implementation...');
try {
  const servicePath = path.join(__dirname, 'src/services/workflow/WorkflowOptimizationService.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  
  const requiredFeatures = [
    'WorkflowPreferences',
    'UserBehaviorData',
    'trackAction',
    'trackItemUsage',
    'trackInputMethod',
    'trackCompletionPattern',
    'getSmartSuggestions',
    'getWorkflowRecommendations',
    'AsyncStorage',
    'singleton',
  ];
  
  requiredFeatures.forEach(feature => {
    if (serviceContent.toLowerCase().includes(feature.toLowerCase())) {
      console.log(`✅ WorkflowOptimizationService includes ${feature}`);
    } else {
      console.log(`❌ WorkflowOptimizationService missing ${feature}`);
      allValid = false;
    }
  });
} catch (error) {
  console.log(`❌ Error validating WorkflowOptimizationService: ${error.message}`);
  allValid = false;
}

// Validate enhanced RequisitionListScreen
console.log('\n📋 Validating enhanced RequisitionListScreen...');
try {
  const listScreenPath = path.join(__dirname, 'src/screens/requisitions/RequisitionListScreen.tsx');
  const listScreenContent = fs.readFileSync(listScreenPath, 'utf8');
  
  const requiredFeatures = [
    'SwipeGestureHandler',
    'QuickActionBar',
    'ContextualHelp',
    'WorkflowOptimizationService',
    'handleQuickApprove',
    'handleQuickReject',
    'trackAction',
    'getCommonQuickActions',
  ];
  
  requiredFeatures.forEach(feature => {
    if (listScreenContent.includes(feature)) {
      console.log(`✅ RequisitionListScreen includes ${feature}`);
    } else {
      console.log(`❌ RequisitionListScreen missing ${feature}`);
      allValid = false;
    }
  });
} catch (error) {
  console.log(`❌ Error validating RequisitionListScreen: ${error.message}`);
  allValid = false;
}

// Validate enhanced RequisitionCreateScreen
console.log('\n📝 Validating enhanced RequisitionCreateScreen...');
try {
  const createScreenPath = path.join(__dirname, 'src/screens/requisitions/RequisitionCreateScreen.tsx');
  const createScreenContent = fs.readFileSync(createScreenPath, 'utf8');
  
  const requiredFeatures = [
    'VoiceToTextInput',
    'SmartFormAutoComplete',
    'QuickActionBar',
    'ContextualHelp',
    'WorkflowOptimizationService',
    'trackInputMethod',
    'trackItemUsage',
    'trackCompletionPattern',
    'getMaritimeItemSuggestions',
    'getPortSuggestions',
  ];
  
  requiredFeatures.forEach(feature => {
    if (createScreenContent.includes(feature)) {
      console.log(`✅ RequisitionCreateScreen includes ${feature}`);
    } else {
      console.log(`❌ RequisitionCreateScreen missing ${feature}`);
      allValid = false;
    }
  });
} catch (error) {
  console.log(`❌ Error validating RequisitionCreateScreen: ${error.message}`);
  allValid = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('✅ All workflow optimization components implemented successfully!');
  console.log('\n📱 Mobile Workflow Optimizations Include:');
  console.log('   • Swipe gestures for quick approve/reject actions');
  console.log('   • Voice-to-text input for descriptions and justifications');
  console.log('   • Quick action shortcuts for common tasks');
  console.log('   • Smart form auto-completion with learning');
  console.log('   • Contextual help and tooltips');
  console.log('   • User behavior tracking and optimization');
  console.log('\n🎯 Features Ready for Testing:');
  console.log('   • Swipe right/left on requisitions to approve/reject');
  console.log('   • Hold microphone button for voice input');
  console.log('   • Use quick action bar for common tasks');
  console.log('   • Smart suggestions based on usage patterns');
  console.log('   • Contextual help tips for guidance');
} else {
  console.log('❌ Some workflow optimization components are missing or incomplete.');
  console.log('Please check the errors above and ensure all components are properly implemented.');
}
console.log('='.repeat(50));