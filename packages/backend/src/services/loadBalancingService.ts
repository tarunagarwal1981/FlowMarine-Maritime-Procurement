import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { PerformanceMonitoringService } from './performanceMonitoringService';

interface ServerInstance {
  id: string;
  host: string;
  port: number;
  weight: number;
  currentConnections: number;
  maxConnections: number;
  healthy: boolean;
  lastHealthCheck: Date;
  responseTime: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface LoadBalancingStrategy {
  name: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'least-response-time' | 'ip-hash';
  config?: any;
}

interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    connectionCount: number;
  };
  scaleDownThreshold: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    connectionCount: number;
  };
  cooldownPeriod: number; // seconds
}

export class LoadBalancingService extends EventEmitter {
  private instances: Map<string, ServerInstance> = new Map();
  private strategy: LoadBalancingStrategy;
  private autoScalingConfig: AutoScalingConfig;
  private performanceMonitor: PerformanceMonitoringService;
  private roundRobinIndex = 0;
  private lastScalingAction = 0;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    strategy: LoadBalancingStrategy,
    autoScalingConfig: AutoScalingConfig,
    performanceMonitor: PerformanceMonitoringService
  ) {
    super();
    this.strategy = strategy;
    this.autoScalingConfig = autoScalingConfig;
    this.performanceMonitor = performanceMonitor;
    this.startHealthChecks();
    this.startAutoScalingMonitor();
  }

  // Server instance management
  addInstance(instance: Omit<ServerInstance, 'currentConnections' | 'healthy' | 'lastHealthCheck'>): void {
    const serverInstance: ServerInstance = {
      ...instance,
      currentConnections: 0,
      healthy: true,
      lastHealthCheck: new Date(),
    };

    this.instances.set(instance.id, serverInstance);
    logger.info(`Added server instance: ${instance.id} (${instance.host}:${instance.port})`);
    this.emit('instanceAdded', serverInstance);
  }

  removeInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      this.instances.delete(instanceId);
      logger.info(`Removed server instance: ${instanceId}`);
      this.emit('instanceRemoved', instance);
    }
  }

  // Load balancing algorithms
  selectInstance(clientIp?: string): ServerInstance | null {
    const healthyInstances = Array.from(this.instances.values()).filter(
      instance => instance.healthy && instance.currentConnections < instance.maxConnections
    );

    if (healthyInstances.length === 0) {
      logger.warn('No healthy instances available');
      return null;
    }

    switch (this.strategy.name) {
      case 'round-robin':
        return this.roundRobinSelection(healthyInstances);
      case 'weighted-round-robin':
        return this.weightedRoundRobinSelection(healthyInstances);
      case 'least-connections':
        return this.leastConnectionsSelection(healthyInstances);
      case 'least-response-time':
        return this.leastResponseTimeSelection(healthyInstances);
      case 'ip-hash':
        return this.ipHashSelection(healthyInstances, clientIp);
      default:
        return this.roundRobinSelection(healthyInstances);
    }
  }

  private roundRobinSelection(instances: ServerInstance[]): ServerInstance {
    const instance = instances[this.roundRobinIndex % instances.length];
    this.roundRobinIndex++;
    return instance;
  }

  private weightedRoundRobinSelection(instances: ServerInstance[]): ServerInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let randomWeight = Math.random() * totalWeight;

    for (const instance of instances) {
      randomWeight -= instance.weight;
      if (randomWeight <= 0) {
        return instance;
      }
    }

    return instances[0]; // Fallback
  }

  private leastConnectionsSelection(instances: ServerInstance[]): ServerInstance {
    return instances.reduce((least, current) =>
      current.currentConnections < least.currentConnections ? current : least
    );
  }

  private leastResponseTimeSelection(instances: ServerInstance[]): ServerInstance {
    return instances.reduce((fastest, current) =>
      current.responseTime < fastest.responseTime ? current : fastest
    );
  }

  private ipHashSelection(instances: ServerInstance[], clientIp?: string): ServerInstance {
    if (!clientIp) {
      return this.roundRobinSelection(instances);
    }

    const hash = this.hashString(clientIp);
    const index = hash % instances.length;
    return instances[index];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Connection tracking
  incrementConnections(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.currentConnections++;
      this.emit('connectionIncremented', instance);
    }
  }

  decrementConnections(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.currentConnections = Math.max(0, instance.currentConnections - 1);
      this.emit('connectionDecremented', instance);
    }
  }

  // Health checking
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.instances.values()).map(
      instance => this.checkInstanceHealth(instance)
    );

    await Promise.allSettled(healthCheckPromises);
  }

  private async checkInstanceHealth(instance: ServerInstance): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Perform HTTP health check
      const response = await fetch(`http://${instance.host}:${instance.port}/health`, {
        method: 'GET',
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;
      const wasHealthy = instance.healthy;
      
      instance.healthy = response.ok;
      instance.responseTime = responseTime;
      instance.lastHealthCheck = new Date();

      if (response.ok) {
        const healthData = await response.json();
        instance.cpuUsage = healthData.metrics?.resourceUsage?.cpuUsage || 0;
        instance.memoryUsage = healthData.metrics?.resourceUsage?.memoryUsage || 0;
      }

      // Emit events for health status changes
      if (!wasHealthy && instance.healthy) {
        logger.info(`Instance ${instance.id} is now healthy`);
        this.emit('instanceHealthy', instance);
      } else if (wasHealthy && !instance.healthy) {
        logger.warn(`Instance ${instance.id} is now unhealthy`);
        this.emit('instanceUnhealthy', instance);
      }

    } catch (error) {
      const wasHealthy = instance.healthy;
      instance.healthy = false;
      instance.lastHealthCheck = new Date();

      if (wasHealthy) {
        logger.error(`Health check failed for instance ${instance.id}:`, error);
        this.emit('instanceUnhealthy', instance);
      }
    }
  }

  // Auto-scaling functionality
  private startAutoScalingMonitor(): void {
    if (!this.autoScalingConfig.enabled) {
      return;
    }

    setInterval(() => {
      this.evaluateScaling();
    }, 60000); // Check every minute
  }

  private evaluateScaling(): void {
    const now = Date.now();
    const timeSinceLastAction = (now - this.lastScalingAction) / 1000;

    if (timeSinceLastAction < this.autoScalingConfig.cooldownPeriod) {
      return; // Still in cooldown period
    }

    const healthyInstances = Array.from(this.instances.values()).filter(i => i.healthy);
    const metrics = this.calculateAverageMetrics(healthyInstances);

    if (this.shouldScaleUp(metrics, healthyInstances.length)) {
      this.scaleUp();
    } else if (this.shouldScaleDown(metrics, healthyInstances.length)) {
      this.scaleDown();
    }
  }

  private calculateAverageMetrics(instances: ServerInstance[]): any {
    if (instances.length === 0) {
      return { cpuUsage: 0, memoryUsage: 0, responseTime: 0, connectionCount: 0 };
    }

    const totals = instances.reduce(
      (acc, instance) => ({
        cpuUsage: acc.cpuUsage + instance.cpuUsage,
        memoryUsage: acc.memoryUsage + instance.memoryUsage,
        responseTime: acc.responseTime + instance.responseTime,
        connectionCount: acc.connectionCount + instance.currentConnections,
      }),
      { cpuUsage: 0, memoryUsage: 0, responseTime: 0, connectionCount: 0 }
    );

    return {
      cpuUsage: totals.cpuUsage / instances.length,
      memoryUsage: totals.memoryUsage / instances.length,
      responseTime: totals.responseTime / instances.length,
      connectionCount: totals.connectionCount / instances.length,
    };
  }

  private shouldScaleUp(metrics: any, instanceCount: number): boolean {
    if (instanceCount >= this.autoScalingConfig.maxInstances) {
      return false;
    }

    const thresholds = this.autoScalingConfig.scaleUpThreshold;
    return (
      metrics.cpuUsage > thresholds.cpuUsage ||
      metrics.memoryUsage > thresholds.memoryUsage ||
      metrics.responseTime > thresholds.responseTime ||
      metrics.connectionCount > thresholds.connectionCount
    );
  }

  private shouldScaleDown(metrics: any, instanceCount: number): boolean {
    if (instanceCount <= this.autoScalingConfig.minInstances) {
      return false;
    }

    const thresholds = this.autoScalingConfig.scaleDownThreshold;
    return (
      metrics.cpuUsage < thresholds.cpuUsage &&
      metrics.memoryUsage < thresholds.memoryUsage &&
      metrics.responseTime < thresholds.responseTime &&
      metrics.connectionCount < thresholds.connectionCount
    );
  }

  private async scaleUp(): Promise<void> {
    try {
      logger.info('Scaling up: Adding new instance');
      this.lastScalingAction = Date.now();
      
      // This would typically integrate with container orchestration (Docker, Kubernetes)
      // or cloud auto-scaling services (AWS Auto Scaling, Azure Scale Sets)
      const newInstanceId = `instance_${Date.now()}`;
      
      // Simulate instance creation
      await this.createNewInstance(newInstanceId);
      
      this.emit('scaleUp', { instanceId: newInstanceId, timestamp: new Date() });
    } catch (error) {
      logger.error('Failed to scale up:', error);
    }
  }

  private async scaleDown(): Promise<void> {
    try {
      const healthyInstances = Array.from(this.instances.values()).filter(i => i.healthy);
      
      if (healthyInstances.length <= this.autoScalingConfig.minInstances) {
        return;
      }

      // Select instance with least connections for removal
      const instanceToRemove = healthyInstances.reduce((least, current) =>
        current.currentConnections < least.currentConnections ? current : least
      );

      logger.info(`Scaling down: Removing instance ${instanceToRemove.id}`);
      this.lastScalingAction = Date.now();
      
      await this.gracefullyRemoveInstance(instanceToRemove.id);
      
      this.emit('scaleDown', { instanceId: instanceToRemove.id, timestamp: new Date() });
    } catch (error) {
      logger.error('Failed to scale down:', error);
    }
  }

  private async createNewInstance(instanceId: string): Promise<void> {
    // This would integrate with your container orchestration platform
    // For now, we'll simulate adding a new instance
    const newInstance: ServerInstance = {
      id: instanceId,
      host: '127.0.0.1',
      port: 3000 + Math.floor(Math.random() * 1000),
      weight: 1,
      currentConnections: 0,
      maxConnections: 100,
      healthy: true,
      lastHealthCheck: new Date(),
      responseTime: 0,
      cpuUsage: 0,
      memoryUsage: 0,
    };

    this.instances.set(instanceId, newInstance);
    logger.info(`Created new instance: ${instanceId}`);
  }

  private async gracefullyRemoveInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    // Wait for existing connections to finish (with timeout)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (instance.currentConnections > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.removeInstance(instanceId);
    logger.info(`Gracefully removed instance: ${instanceId}`);
  }

  // Public API methods
  getInstances(): ServerInstance[] {
    return Array.from(this.instances.values());
  }

  getHealthyInstances(): ServerInstance[] {
    return Array.from(this.instances.values()).filter(instance => instance.healthy);
  }

  getInstanceStats(): any {
    const instances = Array.from(this.instances.values());
    const healthy = instances.filter(i => i.healthy);
    
    return {
      total: instances.length,
      healthy: healthy.length,
      unhealthy: instances.length - healthy.length,
      totalConnections: instances.reduce((sum, i) => sum + i.currentConnections, 0),
      averageResponseTime: healthy.length > 0 
        ? healthy.reduce((sum, i) => sum + i.responseTime, 0) / healthy.length 
        : 0,
      averageCpuUsage: healthy.length > 0
        ? healthy.reduce((sum, i) => sum + i.cpuUsage, 0) / healthy.length
        : 0,
      averageMemoryUsage: healthy.length > 0
        ? healthy.reduce((sum, i) => sum + i.memoryUsage, 0) / healthy.length
        : 0,
    };
  }

  updateStrategy(strategy: LoadBalancingStrategy): void {
    this.strategy = strategy;
    this.roundRobinIndex = 0; // Reset round-robin counter
    logger.info(`Updated load balancing strategy to: ${strategy.name}`);
  }

  updateAutoScalingConfig(config: Partial<AutoScalingConfig>): void {
    this.autoScalingConfig = { ...this.autoScalingConfig, ...config };
    logger.info('Updated auto-scaling configuration');
  }

  // Cleanup
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
    logger.info('Load balancing service shutdown completed');
  }
}