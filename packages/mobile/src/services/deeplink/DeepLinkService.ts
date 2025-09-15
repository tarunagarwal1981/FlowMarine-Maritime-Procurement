import { Linking, Alert } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';

export interface DeepLinkConfig {
  scheme: string;
  prefixes: string[];
  config: {
    screens: Record<string, string | { path: string; parse?: Record<string, (value: string) => any> }>;
  };
}

export interface DeepLinkHandler {
  pattern: RegExp;
  handler: (params: Record<string, string>, navigation: NavigationContainerRef<any>) => void;
}

export class DeepLinkService {
  private static instance: DeepLinkService;
  private navigationRef: NavigationContainerRef<any> | null = null;
  private handlers: DeepLinkHandler[] = [];
  private config: DeepLinkConfig;

  private constructor() {
    this.config = {
      scheme: 'flowmarine',
      prefixes: [
        'flowmarine://',
        'https://app.flowmarine.com',
        'https://flowmarine.com/app',
      ],
      config: {
        screens: {
          // Auth screens
          Login: 'auth/login',
          ForgotPassword: 'auth/forgot-password',
          ResetPassword: 'auth/reset-password/:token',
          
          // Main app screens
          Home: 'home',
          Dashboard: 'dashboard',
          
          // Requisition screens
          RequisitionList: 'requisitions',
          RequisitionDetail: 'requisitions/:id',
          RequisitionCreate: 'requisitions/create',
          RequisitionEdit: 'requisitions/:id/edit',
          
          // Vendor screens
          VendorList: 'vendors',
          VendorDetail: 'vendors/:id',
          VendorQuotes: 'vendors/:id/quotes',
          
          // Analytics screens
          Analytics: 'analytics',
          VesselAnalytics: 'analytics/vessel/:vesselId',
          SpendAnalytics: 'analytics/spend',
          VendorPerformance: 'analytics/vendors',
          
          // Settings screens
          Settings: 'settings',
          Profile: 'settings/profile',
          Notifications: 'settings/notifications',
          Security: 'settings/security',
          About: 'settings/about',
          
          // Emergency screens
          Emergency: 'emergency',
          EmergencyRequisition: 'emergency/requisition',
        },
      },
    };

    this.setupDefaultHandlers();
  }

  public static getInstance(): DeepLinkService {
    if (!DeepLinkService.instance) {
      DeepLinkService.instance = new DeepLinkService();
    }
    return DeepLinkService.instance;
  }

  public setNavigationRef(ref: NavigationContainerRef<any>): void {
    this.navigationRef = ref;
  }

  public getConfig(): DeepLinkConfig {
    return this.config;
  }

  public async initialize(): Promise<void> {
    try {
      // Handle initial URL if app was opened via deep link
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        this.handleDeepLink(initialUrl);
      }

      // Listen for incoming deep links while app is running
      const subscription = Linking.addEventListener('url', (event) => {
        this.handleDeepLink(event.url);
      });

      return () => subscription?.remove();
    } catch (error) {
      console.error('Error initializing deep link service:', error);
    }
  }

  public registerHandler(handler: DeepLinkHandler): void {
    this.handlers.push(handler);
  }

  public removeHandler(pattern: RegExp): void {
    this.handlers = this.handlers.filter(h => h.pattern.source !== pattern.source);
  }

  private setupDefaultHandlers(): void {
    // Requisition handlers
    this.registerHandler({
      pattern: /^.*\/requisitions\/([^\/]+)$/,
      handler: (params, navigation) => {
        navigation.navigate('RequisitionDetail', { id: params[1] });
      },
    });

    // Vendor handlers
    this.registerHandler({
      pattern: /^.*\/vendors\/([^\/]+)$/,
      handler: (params, navigation) => {
        navigation.navigate('VendorDetail', { id: params[1] });
      },
    });

    // Analytics handlers
    this.registerHandler({
      pattern: /^.*\/analytics\/vessel\/([^\/]+)$/,
      handler: (params, navigation) => {
        navigation.navigate('VesselAnalytics', { vesselId: params[1] });
      },
    });

    // Emergency handlers
    this.registerHandler({
      pattern: /^.*\/emergency\/requisition$/,
      handler: (params, navigation) => {
        navigation.navigate('EmergencyRequisition');
      },
    });

    // Share handlers
    this.registerHandler({
      pattern: /^.*\/share\/requisition\/([^\/]+)$/,
      handler: (params, navigation) => {
        navigation.navigate('RequisitionDetail', { 
          id: params[1],
          shared: true 
        });
      },
    });

    // Notification handlers
    this.registerHandler({
      pattern: /^.*\/notifications\/([^\/]+)$/,
      handler: (params, navigation) => {
        this.handleNotificationDeepLink(params[1], navigation);
      },
    });
  }

  private handleDeepLink(url: string): void {
    if (!this.navigationRef) {
      console.warn('Navigation ref not set, queuing deep link:', url);
      // Queue the deep link to handle after navigation is ready
      setTimeout(() => this.handleDeepLink(url), 1000);
      return;
    }

    try {
      // Parse URL
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;
      const searchParams = new URLSearchParams(parsedUrl.search);
      
      // Convert search params to object
      const queryParams: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });

      // Try custom handlers first
      for (const handler of this.handlers) {
        const match = path.match(handler.pattern);
        if (match) {
          handler.handler({ ...queryParams, ...match }, this.navigationRef);
          return;
        }
      }

      // Fallback to default navigation
      this.handleDefaultNavigation(path, queryParams);
    } catch (error) {
      console.error('Error handling deep link:', error);
      Alert.alert(
        'Invalid Link',
        'The link you followed is not valid or has expired.',
        [{ text: 'OK' }]
      );
    }
  }

  private handleDefaultNavigation(path: string, params: Record<string, string>): void {
    if (!this.navigationRef) return;

    // Remove leading slash
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const pathSegments = cleanPath.split('/');

    switch (pathSegments[0]) {
      case 'auth':
        this.handleAuthNavigation(pathSegments, params);
        break;
      case 'requisitions':
        this.handleRequisitionNavigation(pathSegments, params);
        break;
      case 'vendors':
        this.handleVendorNavigation(pathSegments, params);
        break;
      case 'analytics':
        this.handleAnalyticsNavigation(pathSegments, params);
        break;
      case 'settings':
        this.handleSettingsNavigation(pathSegments, params);
        break;
      case 'emergency':
        this.handleEmergencyNavigation(pathSegments, params);
        break;
      default:
        this.navigationRef.navigate('Home');
    }
  }

  private handleAuthNavigation(segments: string[], params: Record<string, string>): void {
    if (!this.navigationRef) return;

    switch (segments[1]) {
      case 'login':
        this.navigationRef.navigate('Login', params);
        break;
      case 'forgot-password':
        this.navigationRef.navigate('ForgotPassword');
        break;
      case 'reset-password':
        if (segments[2]) {
          this.navigationRef.navigate('ResetPassword', { token: segments[2] });
        }
        break;
      default:
        this.navigationRef.navigate('Login');
    }
  }

  private handleRequisitionNavigation(segments: string[], params: Record<string, string>): void {
    if (!this.navigationRef) return;

    if (segments[1]) {
      if (segments[1] === 'create') {
        this.navigationRef.navigate('RequisitionCreate', params);
      } else if (segments[2] === 'edit') {
        this.navigationRef.navigate('RequisitionEdit', { id: segments[1], ...params });
      } else {
        this.navigationRef.navigate('RequisitionDetail', { id: segments[1], ...params });
      }
    } else {
      this.navigationRef.navigate('RequisitionList', params);
    }
  }

  private handleVendorNavigation(segments: string[], params: Record<string, string>): void {
    if (!this.navigationRef) return;

    if (segments[1]) {
      if (segments[2] === 'quotes') {
        this.navigationRef.navigate('VendorQuotes', { id: segments[1], ...params });
      } else {
        this.navigationRef.navigate('VendorDetail', { id: segments[1], ...params });
      }
    } else {
      this.navigationRef.navigate('VendorList', params);
    }
  }

  private handleAnalyticsNavigation(segments: string[], params: Record<string, string>): void {
    if (!this.navigationRef) return;

    switch (segments[1]) {
      case 'vessel':
        if (segments[2]) {
          this.navigationRef.navigate('VesselAnalytics', { vesselId: segments[2], ...params });
        } else {
          this.navigationRef.navigate('Analytics', params);
        }
        break;
      case 'spend':
        this.navigationRef.navigate('SpendAnalytics', params);
        break;
      case 'vendors':
        this.navigationRef.navigate('VendorPerformance', params);
        break;
      default:
        this.navigationRef.navigate('Analytics', params);
    }
  }

  private handleSettingsNavigation(segments: string[], params: Record<string, string>): void {
    if (!this.navigationRef) return;

    switch (segments[1]) {
      case 'profile':
        this.navigationRef.navigate('Profile', params);
        break;
      case 'notifications':
        this.navigationRef.navigate('Notifications', params);
        break;
      case 'security':
        this.navigationRef.navigate('Security', params);
        break;
      case 'about':
        this.navigationRef.navigate('About', params);
        break;
      default:
        this.navigationRef.navigate('Settings', params);
    }
  }

  private handleEmergencyNavigation(segments: string[], params: Record<string, string>): void {
    if (!this.navigationRef) return;

    switch (segments[1]) {
      case 'requisition':
        this.navigationRef.navigate('EmergencyRequisition', params);
        break;
      default:
        this.navigationRef.navigate('Emergency', params);
    }
  }

  private handleNotificationDeepLink(notificationId: string, navigation: NavigationContainerRef<any>): void {
    // Handle notification-specific deep links
    // This could navigate to specific screens based on notification type
    console.log('Handling notification deep link:', notificationId);
    
    // Example: Parse notification ID to determine destination
    if (notificationId.startsWith('req-')) {
      const requisitionId = notificationId.replace('req-', '');
      navigation.navigate('RequisitionDetail', { id: requisitionId });
    } else if (notificationId.startsWith('vendor-')) {
      const vendorId = notificationId.replace('vendor-', '');
      navigation.navigate('VendorDetail', { id: vendorId });
    } else {
      navigation.navigate('Home');
    }
  }

  public createDeepLink(screen: string, params?: Record<string, any>): string {
    const baseUrl = this.config.prefixes[0];
    const screenConfig = this.config.config.screens[screen];
    
    if (!screenConfig) {
      throw new Error(`Screen ${screen} not found in deep link configuration`);
    }

    let path: string;
    if (typeof screenConfig === 'string') {
      path = screenConfig;
    } else {
      path = screenConfig.path;
    }

    // Replace path parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        path = path.replace(`:${key}`, String(value));
      });
    }

    return `${baseUrl}/${path}`;
  }

  public async openDeepLink(url: string): Promise<boolean> {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        console.warn('Cannot open URL:', url);
        return false;
      }
    } catch (error) {
      console.error('Error opening deep link:', error);
      return false;
    }
  }

  public generateShareLink(type: 'requisition' | 'vendor' | 'analytics', id: string): string {
    switch (type) {
      case 'requisition':
        return this.createDeepLink('RequisitionDetail', { id });
      case 'vendor':
        return this.createDeepLink('VendorDetail', { id });
      case 'analytics':
        return this.createDeepLink('VesselAnalytics', { vesselId: id });
      default:
        return this.createDeepLink('Home');
    }
  }
}

export const deepLinkService = DeepLinkService.getInstance();