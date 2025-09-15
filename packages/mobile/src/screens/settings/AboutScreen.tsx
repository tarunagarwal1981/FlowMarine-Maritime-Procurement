import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DeviceInfo from 'react-native-device-info';
import SettingsSection from '../../components/settings/SettingsSection';
import SettingsItem from '../../components/settings/SettingsItem';

const AboutScreen: React.FC = () => {
  const [appVersion, setAppVersion] = React.useState('1.0.0');
  const [buildNumber, setBuildNumber] = React.useState('1');
  const [deviceInfo, setDeviceInfo] = React.useState({
    brand: '',
    model: '',
    systemVersion: '',
  });

  React.useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    try {
      const version = DeviceInfo.getVersion();
      const build = DeviceInfo.getBuildNumber();
      const brand = await DeviceInfo.getBrand();
      const model = await DeviceInfo.getModel();
      const systemVersion = DeviceInfo.getSystemVersion();

      setAppVersion(version);
      setBuildNumber(build);
      setDeviceInfo({brand, model, systemVersion});
    } catch (error) {
      console.error('Error loading device info:', error);
    }
  };

  const handleOpenURL = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open link');
    });
  };

  const handleContactSupport = () => {
    const email = 'support@flowmarine.com';
    const subject = `FlowMarine Mobile Support - v${appVersion}`;
    const body = `
Device Information:
- App Version: ${appVersion} (${buildNumber})
- Device: ${deviceInfo.brand} ${deviceInfo.model}
- OS Version: ${deviceInfo.systemVersion}

Please describe your issue:

`;
    
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.openURL(mailtoUrl).catch(() => {
      Alert.alert(
        'Email Not Available',
        'Please contact support at support@flowmarine.com',
        [
          {text: 'Copy Email', onPress: () => {/* TODO: Copy to clipboard */}},
          {text: 'OK'},
        ]
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* App Information */}
        <View style={styles.appHeader}>
          <View style={styles.appIcon}>
            <Icon name="directions-boat" size={48} color="#1e40af" />
          </View>
          <Text style={styles.appName}>FlowMarine</Text>
          <Text style={styles.appTagline}>Maritime Procurement Platform</Text>
          <Text style={styles.appVersion}>Version {appVersion} ({buildNumber})</Text>
        </View>

        {/* App Information Section */}
        <SettingsSection title="Application">
          <SettingsItem
            title="Version"
            type="value"
            value={`${appVersion} (${buildNumber})`}
            icon="info"
          />
          <SettingsItem
            title="Release Notes"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/releases')}
            icon="description"
          />
          <SettingsItem
            title="Check for Updates"
            type="navigation"
            onPress={() => {/* TODO: Implement update check */}}
            icon="system-update"
          />
        </SettingsSection>

        {/* Device Information */}
        <SettingsSection title="Device Information">
          <SettingsItem
            title="Device"
            type="value"
            value={`${deviceInfo.brand} ${deviceInfo.model}`}
            icon="phone-android"
          />
          <SettingsItem
            title="Operating System"
            type="value"
            value={deviceInfo.systemVersion}
            icon="settings"
          />
        </SettingsSection>

        {/* Support & Feedback */}
        <SettingsSection title="Support & Feedback">
          <SettingsItem
            title="Contact Support"
            type="navigation"
            onPress={handleContactSupport}
            icon="support"
          />
          <SettingsItem
            title="User Guide"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/guide')}
            icon="help"
          />
          <SettingsItem
            title="FAQ"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/faq')}
            icon="quiz"
          />
          <SettingsItem
            title="Report a Bug"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/bug-report')}
            icon="bug-report"
          />
          <SettingsItem
            title="Feature Request"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/feature-request')}
            icon="lightbulb"
          />
        </SettingsSection>

        {/* Legal Information */}
        <SettingsSection title="Legal">
          <SettingsItem
            title="Terms of Service"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/terms')}
            icon="gavel"
          />
          <SettingsItem
            title="Privacy Policy"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/privacy')}
            icon="privacy-tip"
          />
          <SettingsItem
            title="End User License Agreement"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/eula')}
            icon="description"
          />
          <SettingsItem
            title="Open Source Licenses"
            type="navigation"
            onPress={() => {/* TODO: Show licenses screen */}}
            icon="code"
          />
        </SettingsSection>

        {/* Company Information */}
        <SettingsSection title="Company">
          <SettingsItem
            title="About FlowMarine"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com/about')}
            icon="business"
          />
          <SettingsItem
            title="Website"
            type="navigation"
            onPress={() => handleOpenURL('https://flowmarine.com')}
            icon="language"
          />
          <SettingsItem
            title="Follow Us"
            type="navigation"
            onPress={() => handleOpenURL('https://twitter.com/flowmarine')}
            icon="share"
          />
        </SettingsSection>

        {/* Copyright Notice */}
        <View style={styles.footer}>
          <Text style={styles.copyright}>
            © 2024 FlowMarine Technologies, Inc.
          </Text>
          <Text style={styles.copyright}>
            All rights reserved.
          </Text>
          <Text style={styles.footerNote}>
            FlowMarine is a comprehensive maritime procurement platform designed
            for shipping companies managing multiple vessels worldwide.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  appHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    marginBottom: 24,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  copyright: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerNote: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 12,
    paddingHorizontal: 16,
  },
});

export default AboutScreen;