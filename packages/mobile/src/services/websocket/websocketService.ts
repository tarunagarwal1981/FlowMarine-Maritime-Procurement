import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isConnected = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const wsUrl = `${this.config.url}${token ? `?token=${token}` : ''}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', { connected: false });

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', { error: error.message || 'WebSocket error' });
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.isConnecting = false;
      this.emit('error', { error: 'Failed to connect to WebSocket' });
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  send(message: any): void {
    if (this.ws && this.isConnected) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  subscribe(eventType: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  unsubscribe(eventType: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in WebSocket event handler:', error);
        }
      });
    }
  }

  private emit(eventType: string, data: any): void {
    const message: WebSocketMessage = {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    };
    this.handleMessage(message);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval) {
      this.heartbeatTimer = setInterval(() => {
        this.send({ type: 'ping', timestamp: new Date().toISOString() });
      }, this.config.heartbeatInterval);
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get connecting(): boolean {
    return this.isConnecting;
  }
}

// Dashboard-specific WebSocket service
class DashboardWebSocketService extends WebSocketService {
  constructor() {
    const wsUrl = __DEV__ 
      ? 'ws://localhost:3001/ws/dashboard'
      : 'wss://api.flowmarine.com/ws/dashboard';

    super({ url: wsUrl });
  }

  subscribeToVesselAnalytics(vesselId: string): void {
    this.send({
      type: 'SUBSCRIBE_VESSEL_ANALYTICS',
      vesselId,
      timestamp: new Date().toISOString(),
    });
  }

  unsubscribeFromVesselAnalytics(vesselId: string): void {
    this.send({
      type: 'UNSUBSCRIBE_VESSEL_ANALYTICS',
      vesselId,
      timestamp: new Date().toISOString(),
    });
  }

  subscribeToSpendUpdates(): void {
    this.send({
      type: 'SUBSCRIBE_SPEND_UPDATES',
      timestamp: new Date().toISOString(),
    });
  }

  subscribeToBudgetAlerts(): void {
    this.send({
      type: 'SUBSCRIBE_BUDGET_ALERTS',
      timestamp: new Date().toISOString(),
    });
  }
}

export const dashboardWebSocketService = new DashboardWebSocketService();