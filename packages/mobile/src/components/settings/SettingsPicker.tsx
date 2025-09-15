import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface PickerOption {
  label: string;
  value: string;
  subtitle?: string;
}

interface SettingsPickerProps {
  title: string;
  options: PickerOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  visible: boolean;
  onClose: () => void;
}

const SettingsPicker: React.FC<SettingsPickerProps> = ({
  title,
  options,
  selectedValue,
  onValueChange,
  visible,
  onClose,
}) => {
  const handleSelect = (value: string) => {
    onValueChange(value);
    onClose();
  };

  const renderOption = ({item}: {item: PickerOption}) => (
    <TouchableOpacity
      style={styles.option}
      onPress={() => handleSelect(item.value)}
      activeOpacity={0.7}>
      <View style={styles.optionContent}>
        <Text style={styles.optionLabel}>{item.label}</Text>
        {item.subtitle && (
          <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
        )}
      </View>
      {selectedValue === item.value && (
        <Icon name="check" size={24} color="#3b82f6" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </View>
        
        <FlatList
          data={options}
          renderItem={renderOption}
          keyExtractor={(item) => item.value}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  placeholder: {
    width: 40,
  },
  list: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
});

export default SettingsPicker;