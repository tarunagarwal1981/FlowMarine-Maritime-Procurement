import '@testing-library/jest-dom';

// Mock environment variables for tests
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_BASE_URL: 'http://localhost:3001/api',
    VITE_WS_URL: 'ws://localhost:3001',
    VITE_APP_NAME: 'FlowMarine',
    VITE_APP_VERSION: '1.0.0',
    VITE_PWA_NAME: 'FlowMarine',
    VITE_PWA_SHORT_NAME: 'FlowMarine',
    VITE_PWA_DESCRIPTION: 'Maritime Procurement Workflow Platform',
    VITE_ENABLE_OFFLINE_MODE: 'true',
    VITE_ENABLE_ANALYTICS: 'false',
    VITE_ENABLE_DEBUG: 'true',
  },
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage
const localStorageMock = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {},
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});