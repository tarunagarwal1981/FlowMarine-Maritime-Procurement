class WebSocketService {
  connect() {
    console.log('WebSocket connected');
  }

  disconnect() {
    console.log('WebSocket disconnected');
  }

  isConnected() {
    return false;
  }

  requestNotificationPermission() {
    console.log('Notification permission requested');
  }
}

export const websocketService = new WebSocketService();