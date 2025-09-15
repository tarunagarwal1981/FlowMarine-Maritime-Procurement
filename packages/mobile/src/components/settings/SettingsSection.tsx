import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  description?: string;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
  description,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default SettingsSection;