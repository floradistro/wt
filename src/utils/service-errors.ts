/**
 * Service Error Utilities
 * Consistent error handling for all service functions
 */

import { logger } from './logger'
import * as Sentry from '@sentry/react-native'

/**
 * Service error types for better error discrimination
 */
export type ServiceErrorType =
  | 'NETWORK_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_ERROR'
  | 'PERMISSION_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR'

/**
 * Custom service error with type and context
 */
export class ServiceError extends Error {
  type: ServiceErrorType
  context?: Record<string, unknown>
  originalError?: unknown

  constructor(
    message: string,
    type: ServiceErrorType = 'UNKNOWN_ERROR',
    context?: Record<string, unknown>,
    originalError?: unknown
  ) {
    super(message)
    this.name = 'ServiceError'
    this.type = type
    this.context = context
    this.originalError = originalError
  }
}

/**
 * Wrap a service function with consistent error handling
 * - Logs errors with context
 * - Reports to Sentry in production
 * - Re-throws with ServiceError type
 */
export async function withServiceErrorHandling<T>(
  serviceName: string,
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    // Determine error type
    const errorType = getErrorType(error)
    const errorMessage = getErrorMessage(error)

    // Log with context
    logger.error(`[${serviceName}] ${operation} failed:`, {
      error: errorMessage,
      type: errorType,
      ...context,
    })

    // Report to Sentry (production only)
    Sentry.captureException(error, {
      tags: {
        service: serviceName,
        operation,
        errorType,
      },
      extra: context,
    })

    // Re-throw as ServiceError
    throw new ServiceError(
      `${operation}: ${errorMessage}`,
      errorType,
      context,
      error
    )
  }
}

/**
 * Determine error type from error object
 */
function getErrorType(error: unknown): ServiceErrorType {
  if (error instanceof ServiceError) {
    return error.type
  }

  // Check for Supabase/PostgreSQL error codes
  const errorCode = (error as any)?.code

  if (errorCode === 'PGRST116') return 'NOT_FOUND'
  if (errorCode === '23505') return 'DUPLICATE_ERROR' // Unique constraint violation
  if (errorCode === '23503') return 'VALIDATION_ERROR' // Foreign key violation
  if (errorCode === '42501') return 'PERMISSION_ERROR' // Insufficient privilege
  if (errorCode?.startsWith('PGRST')) return 'DATABASE_ERROR'

  // Check for network errors
  const message = getErrorMessage(error).toLowerCase()
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection')
  ) {
    return 'NETWORK_ERROR'
  }

  return 'UNKNOWN_ERROR'
}

/**
 * Extract error message from any error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'An unknown error occurred'
}

/**
 * Check if error is a specific type
 */
export function isServiceError(
  error: unknown,
  type?: ServiceErrorType
): error is ServiceError {
  if (!(error instanceof ServiceError)) return false
  if (type && error.type !== type) return false
  return true
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ServiceError) {
    switch (error.type) {
      case 'NETWORK_ERROR':
        return 'Unable to connect. Please check your internet connection.'
      case 'NOT_FOUND':
        return 'The requested item was not found.'
      case 'DUPLICATE_ERROR':
        return 'This item already exists.'
      case 'PERMISSION_ERROR':
        return 'You do not have permission to perform this action.'
      case 'VALIDATION_ERROR':
        return 'Invalid data provided. Please check your input.'
      default:
        return error.message
    }
  }
  return 'An unexpected error occurred. Please try again.'
}
