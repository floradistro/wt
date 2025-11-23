// Jest setup file to mock React Native globals

// Define __DEV__ for React Native
global.__DEV__ = true

// Save native timer implementations before mocking
const nativeClearTimeout = clearTimeout.bind(global)
const nativeSetTimeout = setTimeout.bind(global)
const nativeClearInterval = clearInterval.bind(global)
const nativeSetInterval = setInterval.bind(global)

// Mock global timers - avoids the TypeScript error in React Native's jest setup
global.clearTimeout = (id) => nativeClearTimeout(id)
global.setTimeout = (fn, ms) => nativeSetTimeout(fn, ms)
global.clearInterval = (id) => nativeClearInterval(id)
global.setInterval = (fn, ms) => nativeSetInterval(fn, ms)

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'http://localhost:54321',
        supabaseAnonKey: 'test-anon-key',
      },
    },
  },
}))

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}))

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}))

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setTags: jest.fn(),
  Sentry: {
    init: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setContext: jest.fn(),
    setUser: jest.fn(),
    setTag: jest.fn(),
    setTags: jest.fn(),
  },
}))

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}))

// Mock expo-modules-core Platform
jest.mock('expo-modules-core', () => ({
  Platform: {
    OS: 'ios',
  },
}))
