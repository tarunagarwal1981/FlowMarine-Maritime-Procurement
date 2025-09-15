import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

class ApiService {
  private baseUrl: string;
  private defaultTimeout = 30000; // 30 seconds
  private maxRetries = 3;

  constructor() {
    // In a real app, this would come from environment config
    this.baseUrl = __DEV__ 
      ? 'http://localhost:3001/api' 
      : 'https://api.flowmarine.com/api';
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.maxRetries
    } = config;

    const token = await this.getAuthToken();
    const url = `${this.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
      ...(body && { body: JSON.stringify(body) }),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestConfig,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return {
          success: true,
          data,
        };
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            return {
              success: false,
              error: 'Request timeout',
            };
          }
          
          // Don't retry on 4xx errors (client errors)
          if (error.message.includes('HTTP 4')) {
            return {
              success: false,
              error: error.message,
            };
          }
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Network request failed',
    };
  }

  async get<T>(endpoint: string, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, config?: Omit<ApiRequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, config?: Omit<ApiRequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, config?: Omit<ApiRequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

export const apiService = new ApiService();