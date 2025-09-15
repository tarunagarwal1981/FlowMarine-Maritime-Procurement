import AsyncStorage from '@react-native-async-storage/async-storage';

interface WorkflowPreferences {
  swipeGesturesEnabled: boolean;
  voiceInputEnabled: boolean;
  quickActionsEnabled: boolean;
  autoCompleteEnabled: boolean;
  contextualHelpEnabled: boolean;
  learningEnabled: boolean;
}

interface UserBehaviorData {
  mostUsedActions: Record<string, number>;
  frequentItems: Record<string, number>;
  preferredInputMethods: Record<string, number>;
  completionPatterns: Record<string, string[]>;
}

class WorkflowOptimizationService {
  private static instance: WorkflowOptimizationService;
  private preferences: WorkflowPreferences;
  private behaviorData: UserBehaviorData;

  // Singleton pattern implementation
  private constructor() {
    this.preferences = {
      swipeGesturesEnabled: true,
      voiceInputEnabled: true,
      quickActionsEnabled: true,
      autoCompleteEnabled: true,
      contextualHelpEnabled: true,
      learningEnabled: true,
    };

    this.behaviorData = {
      mostUsedActions: {},
      frequentItems: {},
      preferredInputMethods: {},
      completionPatterns: {},
    };

    this.loadPreferences();
    this.loadBehaviorData();
  }

  // Singleton getInstance method
  static getInstance(): WorkflowOptimizationService {
    if (!WorkflowOptimizationService.instance) {
      WorkflowOptimizationService.instance = new WorkflowOptimizationService();
    }
    return WorkflowOptimizationService.instance;
  }

  // Preferences Management
  async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('workflow_preferences');
      if (stored) {
        this.preferences = {...this.preferences, ...JSON.parse(stored)};
      }
    } catch (error) {
      console.error('Error loading workflow preferences:', error);
    }
  }

  async savePreferences(preferences: Partial<WorkflowPreferences>): Promise<void> {
    try {
      this.preferences = {...this.preferences, ...preferences};
      await AsyncStorage.setItem('workflow_preferences', JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Error saving workflow preferences:', error);
    }
  }

  getPreferences(): WorkflowPreferences {
    return this.preferences;
  }

  // Behavior Data Management
  async loadBehaviorData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('user_behavior_data');
      if (stored) {
        this.behaviorData = {...this.behaviorData, ...JSON.parse(stored)};
      }
    } catch (error) {
      console.error('Error loading behavior data:', error);
    }
  }

  async saveBehaviorData(): Promise<void> {
    try {
      await AsyncStorage.setItem('user_behavior_data', JSON.stringify(this.behaviorData));
    } catch (error) {
      console.error('Error saving behavior data:', error);
    }
  }

  // Action Tracking
  trackAction(action: string, context: string = 'general'): void {
    if (!this.preferences.learningEnabled) return;

    const key = `${context}:${action}`;
    this.behaviorData.mostUsedActions[key] = (this.behaviorData.mostUsedActions[key] || 0) + 1;
    this.saveBehaviorData();
  }

  getMostUsedActions(context: string = 'general', limit: number = 5): string[] {
    const contextActions = Object.entries(this.behaviorData.mostUsedActions)
      .filter(([key]) => key.startsWith(`${context}:`))
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([key]) => key.split(':')[1]);

    return contextActions;
  }

  // Item Usage Tracking
  trackItemUsage(item: string, context: string = 'general'): void {
    if (!this.preferences.learningEnabled) return;

    const key = `${context}:${item.toLowerCase()}`;
    this.behaviorData.frequentItems[key] = (this.behaviorData.frequentItems[key] || 0) + 1;
    this.saveBehaviorData();
  }

  getFrequentItems(context: string = 'general', limit: number = 10): string[] {
    const contextItems = Object.entries(this.behaviorData.frequentItems)
      .filter(([key]) => key.startsWith(`${context}:`))
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([key]) => key.split(':')[1]);

    return contextItems;
  }

  // Input Method Tracking
  trackInputMethod(method: 'typing' | 'voice' | 'selection', context: string = 'general'): void {
    if (!this.preferences.learningEnabled) return;

    const key = `${context}:${method}`;
    this.behaviorData.preferredInputMethods[key] = (this.behaviorData.preferredInputMethods[key] || 0) + 1;
    this.saveBehaviorData();
  }

  getPreferredInputMethod(context: string = 'general'): 'typing' | 'voice' | 'selection' {
    const contextMethods = Object.entries(this.behaviorData.preferredInputMethods)
      .filter(([key]) => key.startsWith(`${context}:`))
      .sort(([, a], [, b]) => b - a);

    if (contextMethods.length > 0) {
      return contextMethods[0][0].split(':')[1] as 'typing' | 'voice' | 'selection';
    }

    return 'typing'; // Default
  }

  // Completion Pattern Learning
  trackCompletionPattern(field: string, value: string, context: string = 'general'): void {
    if (!this.preferences.learningEnabled) return;

    const key = `${context}:${field}`;
    if (!this.behaviorData.completionPatterns[key]) {
      this.behaviorData.completionPatterns[key] = [];
    }

    const patterns = this.behaviorData.completionPatterns[key];
    if (!patterns.includes(value)) {
      patterns.push(value);
      // Keep only the most recent 20 patterns
      if (patterns.length > 20) {
        patterns.shift();
      }
    }

    this.saveBehaviorData();
  }

  getCompletionPatterns(field: string, context: string = 'general'): string[] {
    const key = `${context}:${field}`;
    return this.behaviorData.completionPatterns[key] || [];
  }

  // Smart Suggestions
  getSmartSuggestions(field: string, currentValue: string, context: string = 'general'): string[] {
    const patterns = this.getCompletionPatterns(field, context);
    const frequentItems = this.getFrequentItems(context);
    
    // Combine and filter suggestions based on current input
    const allSuggestions = [...patterns, ...frequentItems];
    const filtered = allSuggestions
      .filter(suggestion => 
        suggestion.toLowerCase().includes(currentValue.toLowerCase()) &&
        suggestion.toLowerCase() !== currentValue.toLowerCase()
      )
      .slice(0, 5);

    return [...new Set(filtered)]; // Remove duplicates
  }

  // Workflow Optimization Recommendations
  getWorkflowRecommendations(): {
    type: 'gesture' | 'voice' | 'autocomplete' | 'quickaction';
    message: string;
    action?: () => void;
  }[] {
    const recommendations = [];

    // Check if user might benefit from swipe gestures
    const approvalActions = this.behaviorData.mostUsedActions['approval:approve'] || 0;
    const rejectionActions = this.behaviorData.mostUsedActions['approval:reject'] || 0;
    
    if ((approvalActions + rejectionActions) > 10 && this.preferences.swipeGesturesEnabled) {
      recommendations.push({
        type: 'gesture' as const,
        message: 'You frequently approve/reject items. Try swiping right to approve or left to reject for faster workflow.',
      });
    }

    // Check if user might benefit from voice input
    const typingUsage = this.behaviorData.preferredInputMethods['general:typing'] || 0;
    const voiceUsage = this.behaviorData.preferredInputMethods['general:voice'] || 0;
    
    if (typingUsage > voiceUsage * 5 && this.preferences.voiceInputEnabled) {
      recommendations.push({
        type: 'voice' as const,
        message: 'Try using voice input for descriptions and justifications. Hold the microphone button to speak.',
      });
    }

    // Check if user might benefit from autocomplete
    const frequentItemsCount = Object.keys(this.behaviorData.frequentItems).length;
    if (frequentItemsCount > 5 && this.preferences.autoCompleteEnabled) {
      recommendations.push({
        type: 'autocomplete' as const,
        message: 'Smart autocomplete has learned your frequently used items. Start typing to see suggestions.',
      });
    }

    return recommendations;
  }

  // Reset Learning Data
  async resetLearningData(): Promise<void> {
    this.behaviorData = {
      mostUsedActions: {},
      frequentItems: {},
      preferredInputMethods: {},
      completionPatterns: {},
    };
    await this.saveBehaviorData();
  }

  // Export/Import Data (for backup/restore)
  async exportData(): Promise<string> {
    const data = {
      preferences: this.preferences,
      behaviorData: this.behaviorData,
      exportDate: new Date().toISOString(),
    };
    return JSON.stringify(data);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.preferences) {
        await this.savePreferences(data.preferences);
      }
      
      if (data.behaviorData) {
        this.behaviorData = data.behaviorData;
        await this.saveBehaviorData();
      }
    } catch (error) {
      console.error('Error importing workflow data:', error);
      throw new Error('Invalid data format');
    }
  }

  // Analytics
  getUsageAnalytics(): {
    totalActions: number;
    mostUsedFeature: string;
    preferredInputMethod: string;
    learningDataSize: number;
  } {
    const totalActions = Object.values(this.behaviorData.mostUsedActions)
      .reduce((sum, count) => sum + count, 0);

    const mostUsedAction = Object.entries(this.behaviorData.mostUsedActions)
      .sort(([, a], [, b]) => b - a)[0];

    const mostUsedFeature = mostUsedAction ? mostUsedAction[0] : 'None';

    const preferredInputMethod = this.getPreferredInputMethod();

    const learningDataSize = 
      Object.keys(this.behaviorData.mostUsedActions).length +
      Object.keys(this.behaviorData.frequentItems).length +
      Object.keys(this.behaviorData.preferredInputMethods).length +
      Object.keys(this.behaviorData.completionPatterns).length;

    return {
      totalActions,
      mostUsedFeature,
      preferredInputMethod,
      learningDataSize,
    };
  }
}

export default WorkflowOptimizationService;