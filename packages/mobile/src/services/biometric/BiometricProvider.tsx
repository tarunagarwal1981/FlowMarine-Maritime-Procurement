import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import BiometricService, {BiometricCapabilities, BiometricAuthResult} from './BiometricService';

interface BiometricContextType {
  capabilities: BiometricCapabilities | null;
  isEnabled: boolean;
  isLoading: boolean;
  authenticate: (promptMessage?: string) => Promise<BiometricAuthResult>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<boolean>;
  showSetupDialog: () => Promise<boolean>;
}

const BiometricContext = createContext<BiometricContextType | undefined>(undefined);

interface BiometricProviderProps {
  children: ReactNode;
}

export const BiometricProvider: React.FC<BiometricProviderProps> = ({children}) => {
  const [capabilities, setCapabilities] = useState<BiometricCapabilities | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeBiometric();
  }, []);

  const initializeBiometric = async () => {
    try {
      setIsLoading(true);
      
      // Check device capabilities
      const caps = await BiometricService.checkBiometricCapabilities();
      setCapabilities(caps);
      
      // Check if biometric is enabled
      if (caps.isAvailable) {
        const enabled = await BiometricService.isBiometricEnabled();
        setIsEnabled(enabled);
      }
    } catch (error) {
      console.error('Error initializing biometric:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const authenticate = async (promptMessage?: string): Promise<BiometricAuthResult> => {
    if (!capabilities?.isAvailable || !isEnabled) {
      return {
        success: false,
        error: 'Biometric authentication not available or not enabled',
      };
    }

    return BiometricService.authenticateWithBiometrics(promptMessage);
  };

  const enableBiometric = async (): Promise<boolean> => {
    const success = await BiometricService.enableBiometricAuth();
    if (success) {
      setIsEnabled(true);
    }
    return success;
  };

  const disableBiometric = async (): Promise<boolean> => {
    const success = await BiometricService.disableBiometricAuth();
    if (success) {
      setIsEnabled(false);
    }
    return success;
  };

  const showSetupDialog = async (): Promise<boolean> => {
    const success = await BiometricService.showBiometricSetupDialog();
    if (success) {
      setIsEnabled(true);
    }
    return success;
  };

  const value: BiometricContextType = {
    capabilities,
    isEnabled,
    isLoading,
    authenticate,
    enableBiometric,
    disableBiometric,
    showSetupDialog,
  };

  return (
    <BiometricContext.Provider value={value}>
      {children}
    </BiometricContext.Provider>
  );
};

export const useBiometric = (): BiometricContextType => {
  const context = useContext(BiometricContext);
  if (!context) {
    throw new Error('useBiometric must be used within a BiometricProvider');
  }
  return context;
};