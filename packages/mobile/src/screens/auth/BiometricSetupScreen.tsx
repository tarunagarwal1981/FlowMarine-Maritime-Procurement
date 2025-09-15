import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {setBiometricEnabled} from '../../store/slices/authSlice';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import {useBiometric} from '../../services/biometric/BiometricProvider';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type BiometricSetupScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'BiometricSetup'
>;
type BiometricSetupScreenRouteProp = RouteProp<AuthStackParamList, 'BiometricSetup'>;

interface Props {
  navigation: BiometricSetupScreenNavigationProp;
  route: BiometricSetupScreenRouteProp;
}

const BiometricSetupScreen: React.FC<Props> = ({navigation, route}) => {
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const {
    isBiometricAvailable,
    biometricType,
    authenticateWithBiometric,
    storeBiometricCredentials,
  } = useBiometric();

  const {email, token} = route.params;

  const handleEnableBiometric = async () => {
    setIsLoading(true);
    try {
      const result = await authenticateWithBiometric();
      if (result.success) {
        // Store credentials for biometric login
        await storeBiometricCredentials(email, token);
        dispatch(setBiometricEnabled(true));
        
        Alert.alert(
          'Success',
          'Biometric authentication has been enabled successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigation will be handled by AppNavigator based on auth state
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Biometric setup failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to enable biometric authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Biometric Setup',
      'You can enable biometric authentication later in settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Skip',
          onPress: () => {
            // Navigation will be handled by AppNavigator based on auth state
          },
        },
      ]
    );
  };

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'FaceID':
        return 'face';
      case 'TouchID':
      case 'Fingerprint':
        return 'fingerprint';
      default:
        return 'security';
    }
  };

  const getBiometricTitle = () => {
    switch (biometricType) {
      case 'FaceID':
        return 'Face ID';
      case 'TouchID':
        return 'Touch ID';
      case 'Fingerprint':
        return 'Fingerprint';
      default:
        return 'Biometric Authentication';
    }
  };

  if (!isBiometricAvailable) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <View style={styles.content}>
            <Icon name="error" size={80} color="#ef4444" />
            <Text style={styles.title}>Biometric Not Available</Text>
            <Text style={styles.description}>
              Your device doesn't support biometric authentication or it's not set up.
            </Text>
            <TouchableOpacity style={styles.continueButton} onPress={handleSkip}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name={getBiometricIcon()} size={80} color="#1e40af" />
          </View>

          <Text style={styles.title}>Enable {getBiometricTitle()}</Text>
          
          <Text style={styles.description}>
            Use {getBiometricTitle().toLowerCase()} to quickly and securely access your FlowMarine account.
          </Text>

          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <Icon name="speed" size={24} color="#10b981" />
              <Text style={styles.benefitText}>Quick access</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="security" size={24} color="#10b981" />
              <Text style={styles.benefitText}>Enhanced security</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="offline-pin" size={24} color="#10b981" />
              <Text style={styles.benefitText}>Offline capability</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.enableButton, isLoading && styles.enableButtonDisabled]}
              onPress={handleEnableBiometric}
              disabled={isLoading}>
              {isLoading ? (
                <LoadingSpinner size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon name={getBiometricIcon()} size={20} color="#ffffff" />
                  <Text style={styles.enableButtonText}>
                    Enable {getBiometricTitle()}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={isLoading}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            Your biometric data is stored securely on your device and never shared.
          </Text>
        </View>
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  benefitsContainer: {
    marginBottom: 40,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 24,
  },
  enableButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  enableButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  enableButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  skipButton: {
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 32,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default BiometricSetupScreen;