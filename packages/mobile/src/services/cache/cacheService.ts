import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  prefix?: string;
}

class CacheService {
  private defaultTTL = 15 * 60 * 1000; // 15 minutes
  private defaultPrefix = 'cache:';

  /**
   * Store data in cache with expiration
   */
  async set<T>(
    key: string, 
    data: T, 
    options: CacheOptions = {}
  ): Promise<void> {
    const { ttl = this.defaultTTL, prefix = this.defaultPrefix } = options;
    const now = Date.now();
    
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    };

    try {
      await AsyncStorage.setItem(
        `${prefix}${key}`,
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.error('Error setting cache item:', error);
    }
  }

  /**
   * Get data from cache if not expired
   */
  async get<T>(
    key: string, 
    options: CacheOptions = {}
  ): Promise<T | null> {
    const { prefix = this.defaultPrefix } = options;

    try {
      const cached = await AsyncStorage.getItem(`${prefix}${key}`);
      if (!cached) {
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();

      // Check if expired
      if (now > cacheItem.expiresAt) {
        await this.remove(key, options);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error('Error getting cache item:', error);
      return null;
    }
  }

  /**
   * Get data from cache or fetch from source if not available/expired
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Remove item from cache
   */
  async remove(key: string, options: CacheOptions = {}): Promise<void> {
    const { prefix = this.defaultPrefix } = options;
    
    try {
      await AsyncStorage.removeItem(`${prefix}${key}`);
    } catch (error) {
      console.error('Error removing cache item:', error);
    }
  }

  /**
   * Clear all cache items with given prefix
   */
  async clear(prefix: string = this.defaultPrefix): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(prefix));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(prefix: string = this.defaultPrefix): Promise<{
    totalItems: number;
    expiredItems: number;
    totalSize: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(prefix));
      
      let totalItems = 0;
      let expiredItems = 0;
      let totalSize = 0;
      const now = Date.now();

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          totalItems++;
          totalSize += cached.length;

          try {
            const cacheItem: CacheItem<any> = JSON.parse(cached);
            if (now > cacheItem.expiresAt) {
              expiredItems++;
            }
          } catch {
            // Invalid cache item, count as expired
            expiredItems++;
          }
        }
      }

      return { totalItems, expiredItems, totalSize };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalItems: 0, expiredItems: 0, totalSize: 0 };
    }
  }

  /**
   * Clean up expired cache items
   */
  async cleanup(prefix: string = this.defaultPrefix): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(prefix));
      const now = Date.now();
      let cleanedCount = 0;

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          try {
            const cacheItem: CacheItem<any> = JSON.parse(cached);
            if (now > cacheItem.expiresAt) {
              await AsyncStorage.removeItem(key);
              cleanedCount++;
            }
          } catch {
            // Invalid cache item, remove it
            await AsyncStorage.removeItem(key);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      return 0;
    }
  }
}

export const cacheService = new CacheService();