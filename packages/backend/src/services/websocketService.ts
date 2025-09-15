import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface DeliveryStatusUpdate {
  deliveryId: string;
  status: string;
  location?: string;
  estimatedDelivery?: Date;
  message?: string;
  timestamp: Date;
}

export interface NotificationData {
  type: 'delivery_update' | 'delivery_delayed' | 'delivery_delivered' | 'emergency_delivery';
  title: string;
  message: string;
  data: any;
  userId?: string;
  vesselId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds[]

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    logger.info('WebSocket service initialized');
  }

  /**
   * Authenticate socket connection
   */
  private async authenticateSocket(socket: any, next: any): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          vessels: {
            include: {
              vessel: true
            }
          }
        }
      });

      if (!user || !user.isActive) {
        return next(new Error('Invalid user'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.vessels = user.vessels.map(va => va.vessel.id);
      
      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: any): void {
    const userId = socket.userId;
    
    // Track connected user
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, []);
    }
    this.connectedUsers.get(userId)!.push(socket.id);

    // Join vessel rooms for vessel-specific updates
    socket.vessels.forEach((vesselId: string) => {
      socket.join(`vessel:${vesselId}`);
    });

    // Join user-specific room
    socket.join(`user:${userId}`);

    logger.info(`User ${userId} connected via WebSocket (${socket.id})`);

    // Handle disconnection
    socket.on('disconnect', () => {
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        const index = userSockets.indexOf(socket.id);
        if (index > -1) {
          userSockets.splice(index, 1);
        }
        if (userSockets.length === 0) {
          this.connectedUsers.delete(userId);
        }
      }
      logger.info(`User ${userId} disconnected from WebSocket (${socket.id})`);
    });

    // Handle delivery tracking subscription
    socket.on('subscribe_delivery', (deliveryId: string) => {
      socket.join(`delivery:${deliveryId}`);
      logger.info(`User ${userId} subscribed to delivery ${deliveryId}`);
    });

    // Handle delivery tracking unsubscription
    socket.on('unsubscribe_delivery', (deliveryId: string) => {
      socket.leave(`delivery:${deliveryId}`);
      logger.info(`User ${userId} unsubscribed from delivery ${deliveryId}`);
    });
  }

  /**
   * Send delivery status update to subscribers
   */
  async sendDeliveryUpdate(update: DeliveryStatusUpdate): Promise<void> {
    if (!this.io) return;

    try {
      // Get delivery details to determine recipients
      const delivery = await prisma.delivery.findUnique({
        where: { id: update.deliveryId },
        include: {
          purchaseOrder: {
            include: {
              vessel: true,
              vendor: true
            }
          }
        }
      });

      if (!delivery) {
        logger.error(`Delivery ${update.deliveryId} not found for WebSocket update`);
        return;
      }

      const notification: NotificationData = {
        type: 'delivery_update',
        title: 'Delivery Status Update',
        message: `Delivery ${delivery.deliveryNumber} status: ${update.status}`,
        data: {
          deliveryId: update.deliveryId,
          deliveryNumber: delivery.deliveryNumber,
          status: update.status,
          location: update.location,
          estimatedDelivery: update.estimatedDelivery,
          vesselName: delivery.purchaseOrder.vessel.name,
          vendorName: delivery.purchaseOrder.vendor.name
        },
        vesselId: delivery.purchaseOrder.vesselId,
        priority: this.getUpdatePriority(update.status)
      };

      // Send to delivery-specific room
      this.io.to(`delivery:${update.deliveryId}`).emit('delivery_update', notification);

      // Send to vessel-specific room
      this.io.to(`vessel:${delivery.purchaseOrder.vesselId}`).emit('delivery_update', notification);

      logger.info(`Delivery update sent for ${update.deliveryId}: ${update.status}`);
    } catch (error) {
      logger.error('Failed to send delivery update:', error);
    }
  }

  /**
   * Send notification to specific user
   */
  async sendUserNotification(userId: string, notification: NotificationData): Promise<void> {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit('notification', notification);
    logger.info(`Notification sent to user ${userId}: ${notification.title}`);
  }

  /**
   * Send notification to vessel users
   */
  async sendVesselNotification(vesselId: string, notification: NotificationData): Promise<void> {
    if (!this.io) return;

    this.io.to(`vessel:${vesselId}`).emit('notification', notification);
    logger.info(`Notification sent to vessel ${vesselId}: ${notification.title}`);
  }

  /**
   * Send emergency delivery notification
   */
  async sendEmergencyDeliveryNotification(deliveryId: string, message: string): Promise<void> {
    if (!this.io) return;

    try {
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          purchaseOrder: {
            include: {
              vessel: true,
              vendor: true
            }
          }
        }
      });

      if (!delivery) return;

      const notification: NotificationData = {
        type: 'emergency_delivery',
        title: 'Emergency Delivery Alert',
        message,
        data: {
          deliveryId,
          deliveryNumber: delivery.deliveryNumber,
          vesselName: delivery.purchaseOrder.vessel.name
        },
        vesselId: delivery.purchaseOrder.vesselId,
        priority: 'critical'
      };

      // Send to all connected users (emergency notifications)
      this.io.emit('emergency_notification', notification);

      logger.warn(`Emergency delivery notification sent for ${deliveryId}: ${message}`);
    } catch (error) {
      logger.error('Failed to send emergency delivery notification:', error);
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get update priority based on status
   */
  private getUpdatePriority(status: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'high';
      case 'delayed':
      case 'cancelled':
        return 'high';
      case 'in_transit':
        return 'medium';
      case 'scheduled':
        return 'low';
      default:
        return 'medium';
    }
  }
}

export const websocketService = new WebSocketService();