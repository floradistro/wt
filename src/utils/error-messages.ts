/**
 * Error Messages Utility - Apple Engineering Standard
 *
 * Centralized error messages for consistent user experience
 * Converts technical errors into user-friendly messages
 *
 * Principles:
 * - User-friendly language (no technical jargon)
 * - Actionable (tell user what to do)
 * - Consistent tone
 * - Categorized by domain
 */

// ========================================
// ERROR CATEGORIES
// ========================================

export const ErrorMessages = {
  /**
   * Cart errors
   */
  cart: {
    outOfStock: (productName: string) =>
      `${productName} is out of stock. Please remove it from your cart or select a different product.`,

    insufficientStock: (productName: string, available: number) =>
      `Only ${available} ${available === 1 ? 'unit' : 'units'} of ${productName} available. Please reduce the quantity.`,

    invalidQuantity: () =>
      'Please enter a valid quantity (must be a positive number).',

    emptyCart: () =>
      'Your cart is empty. Add items before checking out.',

    loadFailed: () =>
      'Could not load your cart. Please try refreshing the app.',
  },

  /**
   * Payment errors
   */
  payment: {
    alreadyProcessing: () =>
      'Payment is already being processed. Please wait for the current transaction to complete.',

    invalidAmount: () =>
      'Invalid payment amount. Please check the total and try again.',

    insufficientFunds: () =>
      'Payment declined: insufficient funds. Please try a different payment method.',

    networkError: () =>
      'Payment could not be processed due to a network error. Please check your connection and try again.',

    timeout: () =>
      'Payment processing timed out. Please check if the transaction completed before retrying.',

    cancelled: () =>
      'Payment was cancelled.',

    authError: () =>
      'Authentication error. Please log out and log back in, then try again.',

    genericError: (message?: string) =>
      message || 'Payment failed. Please try again or contact support.',
  },

  /**
   * Inventory errors
   */
  inventory: {
    loadFailed: () =>
      'Could not load products. Please check your connection and try again.',

    noProducts: () =>
      'No products available at this location.',

    productNotFound: (productId: string) =>
      `Product ${productId} not found. It may have been removed from inventory.`,
  },

  /**
   * Customer errors
   */
  customer: {
    loadFailed: () =>
      'Could not load customers. Please try again.',

    createFailed: () =>
      'Could not create customer. Please check all required fields and try again.',

    updateFailed: () =>
      'Could not update customer information. Please try again.',

    deleteFailed: () =>
      'Could not delete customer. They may have existing orders.',

    searchFailed: () =>
      'Search failed. Please try again.',

    notFound: (name: string) =>
      `Customer "${name}" not found.`,

    invalidPhone: () =>
      'Please enter a valid phone number.',

    invalidEmail: () =>
      'Please enter a valid email address.',

    missingRequired: (field: string) =>
      `${field} is required.`,
  },

  /**
   * Loyalty errors
   */
  loyalty: {
    programNotActive: () =>
      'Loyalty program is not active for this location.',

    insufficientPoints: (available: number, attempted: number) =>
      `Customer has ${available} points, but ${attempted} were selected. Please adjust the redemption amount.`,

    loadFailed: () =>
      'Could not load loyalty information. Points may not be accurate.',

    updateFailed: () =>
      'Could not update loyalty points. The transaction was completed, but points may not have been applied.',
  },

  /**
   * Session errors
   */
  session: {
    notStarted: () =>
      'No active POS session. Please start a session before making sales.',

    alreadyStarted: () =>
      'A session is already active. Please close the current session first.',

    startFailed: () =>
      'Could not start POS session. Please try again.',

    endFailed: () =>
      'Could not close POS session. Please try again.',

    loadFailed: () =>
      'Could not load session information. Please restart the app.',
  },

  /**
   * Order errors
   */
  order: {
    loadFailed: () =>
      'Could not load orders. Please try again.',

    createFailed: () =>
      'Could not create order. Please check your connection and try again.',

    updateFailed: () =>
      'Could not update order. Please try again.',

    notFound: (orderNumber: string) =>
      `Order ${orderNumber} not found.`,

    invalidStatus: () =>
      'Invalid order status.',
  },

  /**
   * Product errors
   */
  product: {
    loadFailed: () =>
      'Could not load product details. Please try again.',

    updateFailed: () =>
      'Could not update product. Please try again.',

    deleteFailed: () =>
      'Could not delete product. It may be in active orders.',

    notFound: () =>
      'Product not found.',

    invalidPrice: () =>
      'Please enter a valid price (must be greater than 0).',

    missingImage: () =>
      'Product image could not be loaded.',
  },

  /**
   * Authentication errors
   */
  auth: {
    sessionExpired: () =>
      'Your session has expired. Please log in again.',

    invalidCredentials: () =>
      'Invalid email or password. Please try again.',

    networkError: () =>
      'Could not connect to server. Please check your internet connection.',

    unauthorized: () =>
      'You do not have permission to perform this action.',

    loginRequired: () =>
      'Please log in to continue.',
  },

  /**
   * Network errors
   */
  network: {
    offline: () =>
      'No internet connection. Some features may not work.',

    timeout: () =>
      'Request timed out. Please check your connection and try again.',

    serverError: () =>
      'Server error. Please try again later.',

    connectionFailed: () =>
      'Could not connect to server. Please check your internet connection.',
  },

  /**
   * System errors
   */
  system: {
    unknown: () =>
      'An unexpected error occurred. Please try again.',

    maintenanceMode: () =>
      'System is under maintenance. Please try again later.',

    updateRequired: () =>
      'Please update the app to continue.',

    permissionDenied: (permission: string) =>
      `Permission denied: ${permission}. Please enable it in Settings.`,
  },
} as const

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get user-friendly error message from error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check if it's one of our known error messages
    if (error.message.includes('already in progress')) {
      return ErrorMessages.payment.alreadyProcessing()
    }
    if (error.message.includes('session')) {
      return ErrorMessages.auth.sessionExpired()
    }
    if (error.message.includes('out of stock')) {
      return error.message // Already user-friendly
    }
    if (error.message.includes('network') || error.message.includes('Network')) {
      return ErrorMessages.network.connectionFailed()
    }
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return ErrorMessages.network.timeout()
    }
    if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
      return ErrorMessages.auth.unauthorized()
    }

    // Return the error message if it looks user-friendly
    if (error.message.length < 200 && !error.message.includes('Error:')) {
      return error.message
    }
  }

  // Default fallback
  return ErrorMessages.system.unknown()
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('connection') ||
      error.message.toLowerCase().includes('offline') ||
      error.name === 'NetworkError'
    )
  }
  return false
}

/**
 * Check if error is an auth error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('unauthenticated') ||
      error.message.toLowerCase().includes('session') ||
      error.message.toLowerCase().includes('auth')
    )
  }
  return false
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes('invalid') ||
      error.message.toLowerCase().includes('required') ||
      error.message.toLowerCase().includes('validation')
    )
  }
  return false
}
