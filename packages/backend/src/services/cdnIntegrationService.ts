import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { logger } from '../utils/logger';
import { createHash } from 'crypto';
import { Readable } from 'stream';

interface CDNConfig {
  provider: 'aws-cloudfront' | 'cloudflare' | 'azure-cdn' | 'google-cdn';
  aws?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    distributionId: string;
  };
  cloudflare?: {
    apiToken: string;
    zoneId: string;
    accountId: string;
  };
  azure?: {
    subscriptionId: string;
    resourceGroupName: string;
    profileName: string;
    endpointName: string;
  };
  google?: {
    projectId: string;
    keyFilename: string;
  };
}

interface AssetMetadata {
  key: string;
  contentType: string;
  size: number;
  etag: string;
  lastModified: Date;
  cacheControl: string;
  cdnUrl: string;
}

interface CacheInvalidationResult {
  success: boolean;
  invalidationId?: string;
  error?: string;
}

export class CDNIntegrationService {
  private config: CDNConfig;
  private s3Client?: S3Client;
  private cloudFrontClient?: CloudFrontClient;
  private assetCache: Map<string, AssetMetadata> = new Map();

  constructor(config: CDNConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients(): void {
    switch (this.config.provider) {
      case 'aws-cloudfront':
        if (this.config.aws) {
          this.s3Client = new S3Client({
            region: this.config.aws.region,
            credentials: {
              accessKeyId: this.config.aws.accessKeyId,
              secretAccessKey: this.config.aws.secretAccessKey,
            },
          });

          this.cloudFrontClient = new CloudFrontClient({
            region: this.config.aws.region,
            credentials: {
              accessKeyId: this.config.aws.accessKeyId,
              secretAccessKey: this.config.aws.secretAccessKey,
            },
          });
        }
        break;
      // Add other CDN providers as needed
    }
  }

  // Asset upload and management
  async uploadAsset(
    key: string,
    content: Buffer | Readable,
    contentType: string,
    options?: {
      cacheControl?: string;
      metadata?: Record<string, string>;
      public?: boolean;
    }
  ): Promise<AssetMetadata> {
    try {
      const cacheControl = options?.cacheControl || this.getDefaultCacheControl(contentType);
      const etag = this.generateETag(content);

      switch (this.config.provider) {
        case 'aws-cloudfront':
          return await this.uploadToS3(key, content, contentType, cacheControl, options?.metadata);
        default:
          throw new Error(`Unsupported CDN provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error(`Failed to upload asset ${key}:`, error);
      throw error;
    }
  }

  private async uploadToS3(
    key: string,
    content: Buffer | Readable,
    contentType: string,
    cacheControl: string,
    metadata?: Record<string, string>
  ): Promise<AssetMetadata> {
    if (!this.s3Client || !this.config.aws) {
      throw new Error('S3 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: this.config.aws.bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
      CacheControl: cacheControl,
      Metadata: metadata,
    });

    const result = await this.s3Client.send(command);
    
    const assetMetadata: AssetMetadata = {
      key,
      contentType,
      size: content instanceof Buffer ? content.length : 0,
      etag: result.ETag || '',
      lastModified: new Date(),
      cacheControl,
      cdnUrl: `https://${this.config.aws.distributionId}.cloudfront.net/${key}`,
    };

    this.assetCache.set(key, assetMetadata);
    logger.info(`Uploaded asset to CDN: ${key}`);
    
    return assetMetadata;
  }

  // Asset optimization
  async optimizeAndUploadImage(
    key: string,
    imageBuffer: Buffer,
    options?: {
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
      resize?: { width: number; height: number };
      generateResponsiveVersions?: boolean;
    }
  ): Promise<AssetMetadata[]> {
    try {
      const results: AssetMetadata[] = [];
      
      // Generate optimized versions
      const optimizedVersions = await this.generateOptimizedVersions(imageBuffer, options);
      
      // Upload each version
      for (const version of optimizedVersions) {
        const versionKey = this.generateVersionKey(key, version.suffix);
        const metadata = await this.uploadAsset(
          versionKey,
          version.buffer,
          version.contentType,
          {
            cacheControl: 'public, max-age=31536000', // 1 year for images
            metadata: {
              originalKey: key,
              version: version.suffix,
              optimized: 'true',
            },
          }
        );
        results.push(metadata);
      }

      return results;
    } catch (error) {
      logger.error(`Failed to optimize and upload image ${key}:`, error);
      throw error;
    }
  }

  private async generateOptimizedVersions(
    imageBuffer: Buffer,
    options?: any
  ): Promise<Array<{ buffer: Buffer; suffix: string; contentType: string }>> {
    // This would typically use an image processing library like Sharp
    // For now, we'll return the original image with different suffixes
    const versions = [
      { buffer: imageBuffer, suffix: 'original', contentType: 'image/jpeg' },
    ];

    if (options?.generateResponsiveVersions) {
      // Generate responsive versions (would use actual image processing)
      versions.push(
        { buffer: imageBuffer, suffix: 'large', contentType: 'image/jpeg' },
        { buffer: imageBuffer, suffix: 'medium', contentType: 'image/jpeg' },
        { buffer: imageBuffer, suffix: 'small', contentType: 'image/jpeg' },
        { buffer: imageBuffer, suffix: 'thumbnail', contentType: 'image/jpeg' }
      );
    }

    return versions;
  }

  private generateVersionKey(originalKey: string, suffix: string): string {
    const parts = originalKey.split('.');
    const extension = parts.pop();
    const baseName = parts.join('.');
    return `${baseName}_${suffix}.${extension}`;
  }

  // Cache invalidation
  async invalidateCache(paths: string[]): Promise<CacheInvalidationResult> {
    try {
      switch (this.config.provider) {
        case 'aws-cloudfront':
          return await this.invalidateCloudFront(paths);
        default:
          throw new Error(`Cache invalidation not supported for provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error('Failed to invalidate cache:', error);
      return { success: false, error: error.message };
    }
  }

  private async invalidateCloudFront(paths: string[]): Promise<CacheInvalidationResult> {
    if (!this.cloudFrontClient || !this.config.aws) {
      throw new Error('CloudFront client not initialized');
    }

    const command = new CreateInvalidationCommand({
      DistributionId: this.config.aws.distributionId,
      InvalidationBatch: {
        Paths: {
          Quantity: paths.length,
          Items: paths.map(path => path.startsWith('/') ? path : `/${path}`),
        },
        CallerReference: `invalidation-${Date.now()}`,
      },
    });

    const result = await this.cloudFrontClient.send(command);
    
    logger.info(`Created CloudFront invalidation: ${result.Invalidation?.Id}`);
    
    return {
      success: true,
      invalidationId: result.Invalidation?.Id,
    };
  }

  // Asset management
  async deleteAsset(key: string): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'aws-cloudfront':
          await this.deleteFromS3(key);
          break;
        default:
          throw new Error(`Asset deletion not supported for provider: ${this.config.provider}`);
      }

      this.assetCache.delete(key);
      logger.info(`Deleted asset from CDN: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete asset ${key}:`, error);
      throw error;
    }
  }

  private async deleteFromS3(key: string): Promise<void> {
    if (!this.s3Client || !this.config.aws) {
      throw new Error('S3 client not initialized');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.config.aws.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  // Asset URL generation with optimization
  generateOptimizedUrl(
    key: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: string;
      fit?: 'cover' | 'contain' | 'fill';
    }
  ): string {
    const baseUrl = this.getAssetUrl(key);
    
    if (!options) {
      return baseUrl;
    }

    // Generate URL with transformation parameters
    // This would depend on your CDN's image transformation capabilities
    const params = new URLSearchParams();
    
    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.quality) params.append('q', options.quality.toString());
    if (options.format) params.append('f', options.format);
    if (options.fit) params.append('fit', options.fit);

    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }

  private getAssetUrl(key: string): string {
    const cached = this.assetCache.get(key);
    if (cached) {
      return cached.cdnUrl;
    }

    // Generate URL based on CDN provider
    switch (this.config.provider) {
      case 'aws-cloudfront':
        return `https://${this.config.aws?.distributionId}.cloudfront.net/${key}`;
      default:
        return key;
    }
  }

  // Performance optimization features
  async preloadAssets(keys: string[]): Promise<void> {
    logger.info(`Preloading ${keys.length} assets`);
    
    // This would typically involve:
    // 1. Warming up CDN edge caches
    // 2. Generating HTTP/2 Server Push headers
    // 3. Creating resource hints for browsers
    
    const preloadPromises = keys.map(async (key) => {
      try {
        // Simulate cache warming by making a HEAD request
        const url = this.getAssetUrl(key);
        await fetch(url, { method: 'HEAD' });
      } catch (error) {
        logger.warn(`Failed to preload asset ${key}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  // Generate resource hints for HTML
  generateResourceHints(assets: string[]): string[] {
    const hints: string[] = [];
    
    assets.forEach(asset => {
      const url = this.getAssetUrl(asset);
      const contentType = this.getContentType(asset);
      
      if (contentType.startsWith('image/')) {
        hints.push(`<link rel="preload" href="${url}" as="image">`);
      } else if (contentType === 'text/css') {
        hints.push(`<link rel="preload" href="${url}" as="style">`);
      } else if (contentType === 'application/javascript') {
        hints.push(`<link rel="preload" href="${url}" as="script">`);
      }
    });
    
    return hints;
  }

  // Utility methods
  private getDefaultCacheControl(contentType: string): string {
    if (contentType.startsWith('image/')) {
      return 'public, max-age=31536000'; // 1 year for images
    } else if (contentType === 'text/css' || contentType === 'application/javascript') {
      return 'public, max-age=2592000'; // 30 days for CSS/JS
    } else if (contentType === 'text/html') {
      return 'public, max-age=3600'; // 1 hour for HTML
    } else {
      return 'public, max-age=86400'; // 1 day default
    }
  }

  private getContentType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'pdf': 'application/pdf',
      'html': 'text/html',
      'txt': 'text/plain',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  private generateETag(content: Buffer | Readable): string {
    if (content instanceof Buffer) {
      return createHash('md5').update(content).digest('hex');
    }
    return createHash('md5').update(Date.now().toString()).digest('hex');
  }

  // Analytics and monitoring
  getAssetMetrics(): any {
    const assets = Array.from(this.assetCache.values());
    
    return {
      totalAssets: assets.length,
      totalSize: assets.reduce((sum, asset) => sum + asset.size, 0),
      contentTypes: assets.reduce((acc, asset) => {
        acc[asset.contentType] = (acc[asset.contentType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageSize: assets.length > 0 
        ? assets.reduce((sum, asset) => sum + asset.size, 0) / assets.length 
        : 0,
    };
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      switch (this.config.provider) {
        case 'aws-cloudfront':
          // Test S3 connectivity
          if (this.s3Client && this.config.aws) {
            await this.s3Client.send(new GetObjectCommand({
              Bucket: this.config.aws.bucketName,
              Key: 'health-check-test',
              Range: 'bytes=0-0', // Just get first byte
            }));
          }
          break;
      }

      return {
        healthy: true,
        details: {
          provider: this.config.provider,
          assetsCount: this.assetCache.size,
          lastCheck: new Date(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          provider: this.config.provider,
          error: error.message,
          lastCheck: new Date(),
        },
      };
    }
  }
}