/**
 * Logger Utility with Sentry Integration
 * Jobs Principle: Clean, production-ready logging
 *
 * Features:
 * - Development-only debug logs
 * - Production error tracking with Sentry
 * - Contextual breadcrumbs
 * - Performance monitoring
 */

import * as Sentry from '@sentry/react-native'

/**
 * Logger configuration
 */
const IS_DEV = __DEV__
const IS_PROD = !__DEV__

/**
 * Log levels for categorization
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Logger interface
 */
export interface LogContext {
  [key: string]: any
}

/**
 * Logger class with Sentry integration
 */
class Logger {
  /**
   * Debug - Development only
   * Use for debugging, troubleshooting, verbose logging
   */
  debug(message: string, ...args: any[]) {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.log(`[DEBUG] ${message}`, ...args)
    }

    // Extract context if it's an object, otherwise create from args
    const context = args.length > 0 && typeof args[0] === 'object' && !Array.isArray(args[0])
      ? args[0]
      : args.length > 0
      ? { data: args }
      : undefined

    // Add breadcrumb for Sentry (even in dev, helps with error context)
    Sentry.addBreadcrumb({
      message,
      level: 'debug',
      data: context,
    })
  }

  /**
   * Info - Important events (both dev and prod)
   * Use for: Session started, payment completed, etc.
   */
  info(message: string, ...args: any[]) {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${message}`, ...args)
    }

    // Extract context if it's an object, otherwise create from args
    const context = args.length > 0 && typeof args[0] === 'object' && !Array.isArray(args[0])
      ? args[0]
      : args.length > 0
      ? { data: args }
      : undefined

    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data: context,
    })
  }

  /**
   * Warn - Warnings (both dev and prod)
   * Use for: Deprecated features, fallback values, potential issues
   */
  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args)

    // Extract context if it's an object, otherwise create from args
    const context = args.length > 0 && typeof args[0] === 'object' && !Array.isArray(args[0])
      ? args[0]
      : args.length > 0
      ? { data: args }
      : undefined

    Sentry.addBreadcrumb({
      message,
      level: 'warning',
      data: context,
    })

    // Capture warning in Sentry (production only)
    if (IS_PROD) {
      Sentry.captureMessage(message, {
        level: 'warning',
        contexts: { extra: context },
      })
    }
  }

  /**
   * Error - Errors (both dev and prod)
   * Use for: Caught exceptions, API failures, critical issues
   */
  error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args)

    // Try to extract Error object and context from args
    let error: Error | unknown = undefined
    let context: LogContext | undefined = undefined

    for (const arg of args) {
      if (arg instanceof Error) {
        error = arg
      } else if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
        context = context ? Object.assign({}, context, arg) : Object.assign({}, arg)
      } else if (arg !== undefined) {
        // Add other values to context
        if (!context) context = {}
        if (!context.data) context.data = []
        if (Array.isArray(context.data)) {
          context.data.push(arg)
        }
      }
    }

    // Capture error in Sentry (always, helps with debugging)
    if (error instanceof Error) {
      Sentry.captureException(error, {
        contexts: {
          extra: {
            ...context,
            message,
          },
        },
      })
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        contexts: { extra: { ...context, error } },
      })
    }
  }

  /**
   * Set user context for Sentry
   * Call this when user logs in
   */
  setUser(user: { id: string; email?: string; username?: string }) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    })
  }

  /**
   * Clear user context (on logout)
   */
  clearUser() {
    Sentry.setUser(null)
  }

  /**
   * Set custom context/tags
   * Use for: Session info, location, register, etc.
   */
  setContext(key: string, context: LogContext) {
    Sentry.setContext(key, context)
  }

  /**
   * Set tag (for filtering in Sentry)
   * Use for: environment, version, location_id, etc.
   */
  setTag(key: string, value: string) {
    Sentry.setTag(key, value)
  }

  /**
   * Start performance span
   * Use for: Measuring critical operations
   */
  startSpan(name: string, operation: string) {
    // In Sentry v7+, use startSpan instead of startTransaction
    // This is a simplified version for breadcrumb tracking
    const startTime = Date.now()
    return {
      finish: () => {
        const duration = Date.now() - startTime
        Sentry.addBreadcrumb({
          message: name,
          category: 'performance',
          level: 'info',
          data: { operation, duration },
        })
      }
    }
  }

  /**
   * Add breadcrumb manually
   * Use for: Custom events, user actions
   */
  breadcrumb(message: string, category?: string, data?: LogContext) {
    Sentry.addBreadcrumb({
      message,
      category: category || 'custom',
      data,
      level: 'info',
    })
  }

  /**
   * Flush Sentry events (before app closes)
   */
  async flush() {
    await Sentry.flush() // Flush all pending events
  }
}

/**
 * Singleton logger instance
 */
export const logger = new Logger()

/**
 * Convenience exports
 */
export default logger
