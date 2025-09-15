import { Platform } from 'react-native';

export interface SplashConfig {
  minDisplayTime: number;
  fadeOutDuration: number;
  showVersionInfo: boolean;
  customBranding?: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
  };
}

export class SplashService {
  private static instance: SplashService;
  private config: SplashConfig;
  private startTime: number = 0;
  private isVisible: boolean = false;

  private constructor() {
    this.config = {
      minDisplayTime: 2000, // 2 seconds minimum
      fadeOutDuration: 500,
      showVersionInfo: true,
    };
  }

  public static getInstance(): SplashService {
    if (!SplashService.instance) {
      SplashService.instance = new SplashService();
    }
    return SplashService.instance;
  }

  public configure(config: Partial<SplashConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public show(): void {
    this.startTime = Date.now();
    this.isVisible = true;
    
    // Platform-specific splash screen handling
    if (Platform.OS === 'ios') {
      // iOS splash screen is handled by LaunchScreen.storyboard
      console.log('iOS splash screen shown via LaunchScreen');
    } else if (Platform.OS === 'android') {
      // Android splash screen is handled by splash theme
      console.log('Android splash screen shown via splash theme');
    }
  }

  public async hide(): Promise<void> {
    if (!this.isVisible) {
      return;
    }

    const elapsedTime = Date.now() - this.startTime;
    const remainingTime = Math.max(0, this.config.minDisplayTime - elapsedTime);

    if (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    this.isVisible = false;
  }

  public isShowing(): boolean {
    return this.isVisible;
  }

  public getConfig(): SplashConfig {
    return { ...this.config };
  }

  public async preloadAssets(): Promise<void> {
    // Preload critical assets during splash screen
    const assetPromises: Promise<any>[] = [];

    // Add asset preloading logic here
    // For example: fonts, images, initial data

    try {
      await Promise.all(assetPromises);
      console.log('Splash screen assets preloaded successfully');
    } catch (error) {
      console.error('Error preloading splash screen assets:', error);
    }
  }

  public async initializeApp(): Promise<void> {
    // Initialize critical app services during splash
    try {
      // Add initialization logic here
      await this.preloadAssets();
      
      // Simulate app initialization
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('App initialization completed');
    } catch (error) {
      console.error('Error during app initialization:', error);
      throw error;
    }
  }
}

export const splashService = SplashService.getInstance();