import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';
import {Alert, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometryType: BiometryTypes | null;
  error?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  signature?: string;
  error?: string;
}

class BiometricService {
  private rnBiometrics: ReactNativeBiometrics;
  private readonly BIOMETRIC_KEY = 'flowmarine_biometric_key';
  private readonly BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

  constructor() {
    this.rnBiometrics = new ReactNativeBiometrics({
      allowDeviceCredentials: true,
    });
  }

  /**
   * Check if biometric authentication is available on the device
   */
  async checkBiometricCapabilities(): Promise<BiometricCapabilities> {
    try {
      const {available, biometryType, error} = await this.rnBiometrics.isSensorAvailable();
      
      return {
        isAvailable: available,
        biometryType,
        error,
      };
    } catch (error) {
      return {
        isAvailable: false,
        biometryType: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create biometric keys for authentication
   */
  async createBiometricKeys(): Promise<{success: boolean; publicKey?: string; error?: string}> {
    try {
      const {keysExist} = await this.rnBiometrics.biometricKeysExist();
      
      if (keysExist) {
        const {publicKey} = await this.rnBiometrics.createKeys();
        return {success: true, publicKey};
      }

      const {publicKey} = await this.rnBiometrics.createKeys();
      return {success: true, publicKey};
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create biometric keys',
      };
    }
  }

  /**
   * Authenticate user using biometrics
   */
  async authenticateWithBiometrics(
    promptMessage: string = 'Authenticate to access FlowMarine'
  ): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.checkBiometricCapabilities();
      
      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication not available',
        };
      }

      const epochTimeSeconds = Math.round(new Date().getTime() / 1000).toString();
      const payload = `${epochTimeSeconds}_flowmarine_auth`;

      const {success, signature, error} = await this.rnBiometrics.createSignature({
        promptMessage,
        payload,
        cancelButtonText: 'Cancel',
        fallbackPromptMessage: 'Use device passcode',
      });

      if (success && signature) {
        return {success: true, signature};
      }

      return {
        success: false,
        error: error || 'Authentication failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication error',
      };
    }
  }

  /**
   * Enable biometric authentication for the user
   */
  async enableBiometricAuth(): Promise<boolean> {
    try {
      const capabilities = await this.checkBiometricCapabilities();
      
      if (!capabilities.isAvailable) {
        Alert.alert(
          'Biometric Not Available',
          'Biometric authentication is not available on this device.'
        );
        return false;
      }

      const createKeysResult = await this.createBiometricKeys();
      
      if (!createKeysResult.success) {
        Alert.alert('Setup Failed', createKeysResult.error || 'Failed to setup biometric authentication');
        return false;
      }

      await AsyncStorage.setItem(this.BIOMETRIC_ENABLED_KEY, 'true');
      return true;
    } catch (error) {
      console.error('Error enabling biometric auth:', error);
      return false;
    }
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometricAuth(): Promise<boolean> {
    try {
      await this.rnBiometrics.deleteKeys();
      await AsyncStorage.removeItem(this.BIOMETRIC_ENABLED_KEY);
      return true;
    } catch (error) {
      console.error('Error disabling biometric auth:', error);
      return false;
    }
  }

  /**
   * Check if biometric authentication is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(this.BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get biometric type display name
   */
  getBiometricTypeDisplayName(biometryType: BiometryTypes | null): string {
    switch (biometryType) {
      case BiometryTypes.TouchID:
        return 'Touch ID';
      case BiometryTypes.FaceID:
        return 'Face ID';
      case BiometryTypes.Biometrics:
        return Platform.OS === 'android' ? 'Fingerprint' : 'Biometrics';
      default:
        return 'Biometric Authentication';
    }
  }

  /**
   * Show biometric setup dialog
   */
  async showBiometricSetupDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      const capabilities = this.checkBiometricCapabilities();
      
      capabilities.then((caps) => {
        if (!caps.isAvailable) {
          Alert.alert(
            'Biometric Not Available',
            'Biometric authentication is not available on this device.',
            [{text: 'OK', onPress: () => resolve(false)}]
          );
          return;
        }

        const biometricName = this.getBiometricTypeDisplayName(caps.biometryType);
        
        Alert.alert(
          'Enable Biometric Authentication',
          `Would you like to enable ${biometricName} for quick and secure access to FlowMarine?`,
          [
            {text: 'Not Now', onPress: () => resolve(false)},
            {
              text: 'Enable',
              onPress: async () => {
                const enabled = await this.enableBiometricAuth();
                resolve(enabled);
              },
            },
          ]
        );
      });
    });
  }
}

export default new BiometricService();