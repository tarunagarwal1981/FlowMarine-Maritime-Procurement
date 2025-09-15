export const env = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  VITE_WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'FlowMarine',
  VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  VITE_PWA_NAME: import.meta.env.VITE_PWA_NAME || 'FlowMarine',
  VITE_PWA_SHORT_NAME: import.meta.env.VITE_PWA_SHORT_NAME || 'FlowMarine',
  VITE_PWA_DESCRIPTION: import.meta.env.VITE_PWA_DESCRIPTION || 'Maritime Procurement Workflow Platform',
  VITE_ENABLE_OFFLINE_MODE: import.meta.env.VITE_ENABLE_OFFLINE_MODE === 'true',
  VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  VITE_ENABLE_DEBUG: import.meta.env.VITE_ENABLE_DEBUG === 'true',
  VITE_MAPS_API_KEY: import.meta.env.VITE_MAPS_API_KEY || ''
};