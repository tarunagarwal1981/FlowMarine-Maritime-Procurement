import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface AutoCompleteItem {
  id: string;
  value: string;
  label: string;
  category?: string;
  metadata?: Record<string, any>;
}

interface SmartFormAutoCompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectItem?: (item: AutoCompleteItem) => void;
  placeholder?: string;
  data: AutoCompleteItem[];
  style?: any;
  maxSuggestions?: number;
  minQueryLength?: number;
  showCategories?: boolean;
  learningEnabled?: boolean;
  contextKey?: string; // For learning user preferences
}

const SmartFormAutoComplete: React.FC<SmartFormAutoCompleteProps> = ({
  value,
  onChangeText,
  onSelectItem,
  placeholder = 'Start typing...',
  data,
  style,
  maxSuggestions = 5,
  minQueryLength = 2,
  showCategories = true,
  learningEnabled = true,
  contextKey = 'default',
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userPreferences, setUserPreferences] = useState<Record<string, number>>({});

  // Load user preferences for this context
  useEffect(() => {
    if (learningEnabled) {
      loadUserPreferences();
    }
  }, [contextKey, learningEnabled]);

  const loadUserPreferences = async () => {
    try {
      // In a real app, this would load from AsyncStorage
      // For now, we'll simulate some preferences
      const mockPreferences: Record<string, number> = {
        'engine oil filter': 10,
        'fuel injector': 8,
        'safety equipment': 6,
        'navigation equipment': 4,
        'emergency repair': 9,
      };
      setUserPreferences(mockPreferences);
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const saveUserPreference = async (item: AutoCompleteItem) => {
    if (!learningEnabled) return;

    try {
      const key = item.value.toLowerCase();
      const currentScore = userPreferences[key] || 0;
      const newPreferences = {
        ...userPreferences,
        [key]: currentScore + 1,
      };
      
      setUserPreferences(newPreferences);
      
      // In a real app, save to AsyncStorage
      // await AsyncStorage.setItem(`autocomplete_${contextKey}`, JSON.stringify(newPreferences));
    } catch (error) {
      console.error('Error saving user preference:', error);
    }
  };

  // Smart filtering with fuzzy matching and user preferences
  const filteredSuggestions = useMemo(() => {
    if (!value || value.length < minQueryLength) {
      return [];
    }

    const query = value.toLowerCase().trim();
    
    // Score items based on relevance and user preferences
    const scoredItems = data
      .map(item => {
        const itemValue = item.value.toLowerCase();
        const itemLabel = item.label.toLowerCase();
        
        let score = 0;
        
        // Exact match gets highest score
        if (itemValue === query || itemLabel === query) {
          score += 100;
        }
        // Starts with query
        else if (itemValue.startsWith(query) || itemLabel.startsWith(query)) {
          score += 80;
        }
        // Contains query
        else if (itemValue.includes(query) || itemLabel.includes(query)) {
          score += 60;
        }
        // Fuzzy match (simple word matching)
        else {
          const queryWords = query.split(' ');
          const itemWords = [...itemValue.split(' '), ...itemLabel.split(' ')];
          const matchingWords = queryWords.filter(qWord =>
            itemWords.some(iWord => iWord.includes(qWord) || qWord.includes(iWord))
          );
          
          if (matchingWords.length > 0) {
            score += (matchingWords.length / queryWords.length) * 40;
          }
        }
        
        // Add user preference score
        const preferenceScore = userPreferences[itemValue] || 0;
        score += preferenceScore * 2;
        
        return {
          ...item,
          score,
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return scoredItems;
  }, [value, data, userPreferences, minQueryLength, maxSuggestions]);

  // Group suggestions by category if enabled
  const groupedSuggestions = useMemo(() => {
    if (!showCategories) {
      return [{category: null, items: filteredSuggestions}];
    }

    const groups: Record<string, AutoCompleteItem[]> = {};
    
    filteredSuggestions.forEach(item => {
      const category = item.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    return Object.entries(groups).map(([category, items]) => ({
      category,
      items,
    }));
  }, [filteredSuggestions, showCategories]);

  const handleSelectItem = (item: AutoCompleteItem) => {
    onChangeText(item.value);
    setShowSuggestions(false);
    saveUserPreference(item);
    
    if (onSelectItem) {
      onSelectItem(item);
    }
    
    Keyboard.dismiss();
  };

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setShowSuggestions(text.length >= minQueryLength);
  };

  const renderSuggestionItem = ({item}: {item: AutoCompleteItem}) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelectItem(item)}
    >
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionLabel}>{item.label}</Text>
        {item.value !== item.label && (
          <Text style={styles.suggestionValue}>{item.value}</Text>
        )}
        {item.metadata?.description && (
          <Text style={styles.suggestionDescription}>
            {item.metadata.description}
          </Text>
        )}
      </View>
      {userPreferences[item.value.toLowerCase()] > 0 && (
        <View style={styles.frequentBadge}>
          <Icon name="star" size={12} color="#f59e0b" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderCategoryHeader = (category: string | null) => {
    if (!category || !showCategories) return null;
    
    return (
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryTitle}>{category}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          onFocus={() => {
            if (value.length >= minQueryLength) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay hiding suggestions to allow for selection
            setTimeout(() => setShowSuggestions(false), 200);
          }}
        />
        
        {learningEnabled && (
          <View style={styles.smartIndicator}>
            <Icon name="psychology" size={16} color="#3b82f6" />
          </View>
        )}
      </View>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={groupedSuggestions}
            keyExtractor={(item, index) => `group-${index}`}
            renderItem={({item: group}) => (
              <View>
                {renderCategoryHeader(group.category)}
                <FlatList
                  data={group.items}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSuggestionItem}
                  scrollEnabled={false}
                />
              </View>
            )}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          />
        </View>
      )}
    </View>
  );
};

// Predefined data sets for common maritime procurement fields
export const getMaritimeItemSuggestions = (): AutoCompleteItem[] => [
  {
    id: '1',
    value: 'Engine Oil Filter',
    label: 'Engine Oil Filter - High Performance',
    category: 'Engine Parts',
    metadata: {
      description: 'High-performance oil filter for main engine',
      impaCode: '550123',
    },
  },
  {
    id: '2',
    value: 'Fuel Injector',
    label: 'Fuel Injector Assembly',
    category: 'Engine Parts',
    metadata: {
      description: 'Replacement fuel injector assembly',
      impaCode: '550456',
    },
  },
  {
    id: '3',
    value: 'Life Jackets',
    label: 'SOLAS Approved Life Jackets',
    category: 'Safety Equipment',
    metadata: {
      description: 'SOLAS approved life jackets',
      impaCode: '760001',
    },
  },
  {
    id: '4',
    value: 'Navigation Charts',
    label: 'Electronic Navigation Charts',
    category: 'Navigation Equipment',
    metadata: {
      description: 'Updated electronic navigation charts',
      impaCode: '920001',
    },
  },
  {
    id: '5',
    value: 'Emergency Flares',
    label: 'Emergency Signal Flares',
    category: 'Safety Equipment',
    metadata: {
      description: 'SOLAS compliant emergency flares',
      impaCode: '760123',
    },
  },
];

export const getVesselSuggestions = (): AutoCompleteItem[] => [
  {
    id: 'v1',
    value: 'MV Ocean Explorer',
    label: 'MV Ocean Explorer (Container)',
    category: 'Container Ships',
  },
  {
    id: 'v2',
    value: 'MV Atlantic Carrier',
    label: 'MV Atlantic Carrier (Bulk)',
    category: 'Bulk Carriers',
  },
  {
    id: 'v3',
    value: 'MV Pacific Star',
    label: 'MV Pacific Star (Tanker)',
    category: 'Tankers',
  },
];

export const getPortSuggestions = (): AutoCompleteItem[] => [
  {
    id: 'p1',
    value: 'Port of Singapore',
    label: 'Port of Singapore (SGSIN)',
    category: 'Major Ports',
  },
  {
    id: 'p2',
    value: 'Port of Rotterdam',
    label: 'Port of Rotterdam (NLRTM)',
    category: 'Major Ports',
  },
  {
    id: 'p3',
    value: 'Port of Shanghai',
    label: 'Port of Shanghai (CNSHA)',
    category: 'Major Ports',
  },
];

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    position: 'relative',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    paddingRight: 40,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  smartIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  categoryHeader: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  suggestionValue: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  suggestionDescription: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  frequentBadge: {
    marginLeft: 8,
  },
});

export default SmartFormAutoComplete;