/**
 * Sentry Initialization for React Native
 * Production-ready error monitoring and performance tracking
 */

import * as Sentry from '@sentry/react-native'
import Constants from 'expo-constants'

/**
 * Initialize Sentry
 * Call this ONCE at app startup (in App.tsx or index.ts)
 */
export function initializeSentry() {
  // Only initialize if DSN is configured
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

  if (!dsn) {
    if (__DEV__) {
      console.warn('[Sentry] DSN not configured. Sentry will not be initialized.')
      console.warn('[Sentry] Add EXPO_PUBLIC_SENTRY_DSN to your .env file')
    }
    return
  }

  Sentry.init({
    dsn,

    // Environment
    environment: __DEV__ ? 'development' : 'production',

    // Release tracking (helps identify which version has issues)
    release: Constants.expoConfig?.version || '1.0.0',
    dist: Constants.expoConfig?.android?.versionCode?.toString() || '1',

    // Performance Monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.2, // 100% in dev, 20% in prod

    // Enable automatic breadcrumbs
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000, // 30 seconds

    // Native crash reporting
    enableNative: true,
    enableNativeCrashHandling: true,

    // Attach screenshots on errors (helpful for debugging)
    attachScreenshot: true,

    // Before send hook - filter sensitive data
    beforeSend(event) {
      // Filter out sensitive data from error reports
      if (event.request) {
        delete event.request.cookies
      }

      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.Authorization
        delete event.request.headers['X-Auth-Token']
      }

      // Remove sensitive data from extras
      if (event.extra) {
        delete event.extra.password
        delete event.extra.cardNumber
        delete event.extra.cvv
        delete event.extra.pin
      }

      return event
    },

    // Before breadcrumb hook - filter sensitive breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out sensitive data from breadcrumbs
      if (breadcrumb.data) {
        delete breadcrumb.data.password
        delete breadcrumb.data.cardNumber
        delete breadcrumb.data.cvv
        delete breadcrumb.data.pin
      }

      return breadcrumb
    },

    // Integration-specific options
    integrations: [
      // Use the default integrations
      // Performance tracing is automatically enabled with tracesSampleRate
    ],
  })

  // Set global tags
  Sentry.setTag('platform', Constants.platform?.ios ? 'ios' : 'android')
  Sentry.setTag('app_version', Constants.expoConfig?.version || '1.0.0')

  if (__DEV__) {
    console.log('[Sentry] Initialized successfully')
  }
}

/**
 * Wrap root component with Sentry error boundary
 * Use in App.tsx: export default Sentry.wrap(App)
 */
export { Sentry }
