import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import LoadingSpinner from '../components/common/LoadingSpinner';

const LoadingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        <Text style={styles.title}>FlowMarine</Text>
        <Text style={styles.subtitle}>Maritime Procurement Platform</Text>
        
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" color="#1e40af" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Initializing secure connection</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#bfdbfe',
    textAlign: 'center',
    marginBottom: 60,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  footer: {
    paddingBottom: 40,
  },
  footerText: {
    color: '#bfdbfe',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default LoadingScreen;