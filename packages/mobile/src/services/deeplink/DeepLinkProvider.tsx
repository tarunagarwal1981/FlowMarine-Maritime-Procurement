import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { deepLinkService, DeepLinkService } from './DeepLinkService';

interface DeepLinkContextType {
  service: DeepLinkService;
  createLink: (screen: string, params?: Record<string, any>) => string;
  openLink: (url: string) => Promise<boolean>;
  generateShareLink: (type: 'requisition' | 'vendor' | 'analytics', id: string) => string;
}

const DeepLinkContext = createContext<DeepLinkContextType | undefined>(undefined);

interface DeepLinkProviderProps {
  children: ReactNode;
}

export const DeepLinkProvider: React.FC<DeepLinkProviderProps> = ({ children }) => {
  const navigation = useNavigation();

  useEffect(() => {
    // Set navigation reference for deep link service
    deepLinkService.setNavigationRef(navigation as any);

    // Initialize deep link handling
    const initializeDeepLinks = async () => {
      try {
        await deepLinkService.initialize();
      } catch (error) {
        console.error('Failed to initialize deep links:', error);
      }
    };

    initializeDeepLinks();
  }, [navigation]);

  const contextValue: DeepLinkContextType = {
    service: deepLinkService,
    createLink: (screen: string, params?: Record<string, any>) => {
      return deepLinkService.createDeepLink(screen, params);
    },
    openLink: (url: string) => {
      return deepLinkService.openDeepLink(url);
    },
    generateShareLink: (type: 'requisition' | 'vendor' | 'analytics', id: string) => {
      return deepLinkService.generateShareLink(type, id);
    },
  };

  return (
    <DeepLinkContext.Provider value={contextValue}>
      {children}
    </DeepLinkContext.Provider>
  );
};

export const useDeepLink = (): DeepLinkContextType => {
  const context = useContext(DeepLinkContext);
  if (!context) {
    throw new Error('useDeepLink must be used within a DeepLinkProvider');
  }
  return context;
};