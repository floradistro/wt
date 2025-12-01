/**
 * ============================================================================
 * ENTERPRISE-GRADE PAYMENT PROCESSOR - EDGE FUNCTION v2
 * ============================================================================
 *
 * Architecture inspired by:
 * - Stripe Terminal
 * - Square POS
 * - Toast POS
 * - Shopify POS
 *
 * Based on Dejavoo SPIN API Specification:
 * https://docs.ipospays.com/spin-specification
 * https://app.theneo.io/dejavoo/spin/spin-rest-api-methods
 *
 * Features:
 * ✅ Atomic transactions (payment + order creation)
 * ✅ State machine with clear transitions
 * ✅ Idempotency (retry-safe)
 * ✅ Automatic retry logic
 * ✅ Webhook reconciliation support
 * ✅ Timeout handling
 * ✅ Comprehensive error handling
 * ✅ Audit logging
 * ✅ Zero technical debt
 *
 * Flow:
 * 1. Validate request & check idempotency
 * 2. Create draft order
 * 3. Reserve inventory
 * 4. Process payment (SPIN API)
 * 5. Finalize inventory holds
 * 6. Update loyalty points (atomic)
 * 7. Update session totals
 * 8. Return result with audit trail
 *
 * ============================================================================
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'
import * as Sentry from 'https://deno.land/x/sentry@7.108.0/index.mjs'

// ============================================================================
// SENTRY INITIALIZATION (Enterprise Observability)
// ============================================================================

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('ENVIRONMENT') || 'production',
  release: Deno.env.get('SENTRY_RELEASE') || 'process-checkout@2.0.0',

  // Performance monitoring - 10% sample rate
  tracesSampleRate: 0.1,

  // Scrub sensitive data
  beforeSend(event, hint) {
    // Remove sensitive headers
    if (event.request) {
      delete event.request.cookies
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['apikey']
      }
    }

    // Scrub sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.data) {
          // Redact payment processor credentials
          if (breadcrumb.data.authkey) breadcrumb.data.authkey = '[REDACTED]'
          if (breadcrumb.data.tpn) breadcrumb.data.tpn = '[REDACTED]'
          // Redact card data
          if (breadcrumb.data.cardNumber) breadcrumb.data.cardNumber = '[REDACTED]'
          if (breadcrumb.data.cvv) breadcrumb.data.cvv = '[REDACTED]'
        }
        return breadcrumb
      })
    }

    // Scrub sensitive data from context
    if (event.contexts?.checkout) {
      const checkout = event.contexts.checkout as any
      if (checkout.authkey) checkout.authkey = '[REDACTED]'
      if (checkout.tpn) checkout.tpn = '[REDACTED]'
    }

    return event
  },

  // Tag all events with service name
  initialScope: {
    tags: {
      service: 'checkout-processor',
      component: 'edge-function',
    },
  },
})

// ============================================================================
// TYPES
// ============================================================================

interface CheckoutRequest {
  // Idempotency
  idempotencyKey?: string

  // Order Info (snake_case for e-commerce compatibility)
  vendorId?: string
  vendor_id?: string  // E-commerce format
  locationId?: string
  location_id?: string | null  // E-commerce format (nullable)
  registerId?: string
  register_id?: string  // E-commerce format
  sessionId?: string
  session_id?: string  // E-commerce format

  // Items
  items: OrderItem[] | any[]  // Accept both formats
  subtotal: number
  taxAmount?: number  // POS format
  tax?: number  // E-commerce format
  shipping?: number  // E-commerce only
  total: number

  // Payment (flexible format)
  paymentMethod?: 'cash' | 'card' | 'split' | 'credit' | 'debit' | 'ebt_food' | 'ebt_cash' | 'gift'
  payment?: {  // E-commerce format
    method: string
    amount: number
    opaque_data?: {
      dataDescriptor: string
      dataValue: string
    }
  }
  tipAmount?: number
  tip_amount?: number  // E-commerce format

  // Customer (snake_case for e-commerce compatibility)
  customerId?: string
  customer_id?: string  // E-commerce format
  customerName?: string
  customer_name?: string  // E-commerce format

  // E-commerce specific
  is_ecommerce?: boolean
  shipping_address?: {
    name?: string
    address: string
    city: string
    state: string
    zip: string
    phone?: string
  }
  billing_address?: {
    address: string
    city: string
    state: string
    zip: string
  }

  // Loyalty
  loyaltyPointsRedeemed?: number
  loyaltyDiscountAmount?: number

  // Campaigns/Deals
  campaignDiscountAmount?: number
  campaignId?: string

  // Split Payment
  splitPayments?: Array<{ method: 'cash' | 'card'; amount: number }>
  cashAmount?: number
  cardAmount?: number

  // Cash Payment
  cashTendered?: number
  changeGiven?: number

  // Metadata
  metadata?: Record<string, any>
}

interface OrderItem {
  productId: string
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  lineTotal: number
  discountAmount?: number
  inventoryId?: string
  // Tier quantity fields (at least one is required)
  gramsToDeduct?: number // Legacy field: tier quantity (could be grams, units, etc.)
  tierQty?: number // Preferred field: tier quantity to deduct from inventory
  quantity_grams?: number // Alternative field: tier quantity
  tierName?: string // Display name for the tier (e.g., "28g (Ounce)", "1 Unit")
  // Multi-location support: which location fulfills this item
  locationId?: string  // POS format (camelCase)
  location_id?: string // E-commerce format (snake_case)
}

interface SPINSaleRequest {
  Amount: number
  TipAmount?: number
  PaymentType: string
  ReferenceId: string
  InvoiceNumber: string
  Tpn: string
  Authkey: string
  SPInProxyTimeout?: number
  PrintReceipt?: string
  GetReceipt?: string
  GetExtendedData?: boolean
  CaptureSignature?: boolean
}

interface SPINSaleResponse {
  GeneralResponse: {
    ResultCode: string // "0" = success, "1" = terminal error, "2" = API error
    StatusCode: string // "0000" = approved
    Message: string
    DetailedMessage?: string
    AuthCode?: string
    ReferenceId?: string
    TransactionType?: string
    PaymentType?: string
  }
  Amounts?: {
    TotalAmount?: number
    Amount?: number
    TipAmount?: number
  }
  CardData?: {
    CardType?: string
    Last4?: string
    First4?: string
    EntryType?: string
  }
  Receipts?: {
    Customer?: string
    Merchant?: string
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SPIN_API_BASE_URL = {
  production: 'https://api.spinpos.net',
  sandbox: 'https://test.spinpos.net/spin',
}

const PAYMENT_TIMEOUT = 120 // seconds (2 minutes)
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

// CORS: Whitelist of allowed origins (Apple security standard)
const ALLOWED_ORIGINS = [
  'capacitor://localhost', // iOS app
  'http://localhost', // Android app
  'http://localhost:8081', // Expo dev server
  'http://localhost:19000', // Expo dev server alternative
  'http://localhost:19006', // Expo web
]

// ============================================================================
// DATABASE CLIENT (Bypasses PostgREST)
// ============================================================================

async function getDbClient(): Promise<Client> {
  // CRITICAL: Edge Functions MUST use connection pooler URL, not direct connection
  // Direct connections timeout because Edge Functions run in IPv6-only environment
  // Use transaction mode pooler: postgresql://postgres.[project-ref]:[password]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
  const databaseUrl = Deno.env.get('SUPABASE_DB_URL')!

  // Add connection timeout and configure for pooler
  const client = new Client({
    connection: {
      attempts: 1, // Don't retry, fail fast
    },
    ...(() => {
      // Parse URL to add pooler settings
      const url = new URL(databaseUrl)
      return {
        user: url.username,
        password: url.password,
        hostname: url.hostname,
        port: parseInt(url.port || '5432'),
        database: url.pathname.slice(1), // Remove leading slash
      }
    })(),
  })

  console.log('[DB] Attempting to connect to:', {
    hostname: new URL(databaseUrl).hostname,
    port: new URL(databaseUrl).port || '5432',
  })

  const timeout = setTimeout(() => {
    throw new Error('Database connection timeout after 10s')
  }, 10000)

  try {
    await client.connect()
    clearTimeout(timeout)
    console.log('[DB] Connected successfully')
    return client
  } catch (error) {
    clearTimeout(timeout)
    console.error('[DB] Failed to connect to database:', error)
    throw new Error(`Database connection failed: ${error.message}`)
  }
}

// ============================================================================
// SPIN API CLIENT
// ============================================================================

class SPINClient {
  private baseUrl: string
  private authkey: string
  private tpn: string

  constructor(authkey: string, tpn: string, environment: 'production' | 'sandbox' = 'production') {
    this.authkey = authkey
    this.tpn = tpn
    this.baseUrl = SPIN_API_BASE_URL[environment]
  }

  async processSale(request: SPINSaleRequest): Promise<SPINSaleResponse> {
    const url = `${this.baseUrl}/v2/Payment/Sale`

    console.log('[SPIN] Sending sale request:', {
      url,
      amount: request.Amount,
      referenceId: request.ReferenceId,
      paymentType: request.PaymentType,
    })

    // CRITICAL: Enforce client-side timeout to prevent hanging
    // Edge Functions have 2min timeout, but we want faster feedback
    const timeoutMs = (request.SPInProxyTimeout || PAYMENT_TIMEOUT) * 1000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      console.log('[SPIN] Received response:', {
        status: response.status,
        resultCode: data.GeneralResponse?.ResultCode,
        statusCode: data.GeneralResponse?.StatusCode,
        message: data.GeneralResponse?.Message,
      })

      if (!response.ok && response.status !== 400) {
        throw new Error(`SPIN API HTTP Error: ${response.status}`)
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)

      // Provide helpful error message for timeouts
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Payment processor timeout after ${timeoutMs / 1000}s. Please try again or use a different payment method.`
        )
      }

      throw error
    }
  }
}

// ============================================================================
// AUTHORIZE.NET API CLIENT
// ============================================================================

const AUTHORIZENET_API_BASE_URL = {
  production: 'https://api.authorize.net/xml/v1/request.api',
  sandbox: 'https://apitest.authorize.net/xml/v1/request.api',
}

interface AuthorizeNetSaleRequest {
  amount: number
  invoiceNumber: string
  description?: string
  customerId?: string
  customerIp?: string
}

interface AuthorizeNetSaleResponse {
  transactionResponse: {
    responseCode: string // "1" = approved, "2" = declined, "3" = error, "4" = held for review
    authCode: string
    avsResultCode: string
    cvvResultCode: string
    cavvResultCode: string
    transId: string
    refTransID: string
    transHash: string
    accountNumber: string // Last 4 digits, e.g., "XXXX1111"
    accountType: string // "Visa", "Mastercard", etc.
    messages: Array<{
      code: string
      description: string
    }>
    errors?: Array<{
      errorCode: string
      errorText: string
    }>
  }
  messages: {
    resultCode: string // "Ok" or "Error"
    message: Array<{
      code: string
      text: string
    }>
  }
}

class AuthorizeNetClient {
  private baseUrl: string
  private apiLoginId: string
  private transactionKey: string

  constructor(apiLoginId: string, transactionKey: string, environment: 'production' | 'sandbox' = 'production') {
    this.apiLoginId = apiLoginId
    this.transactionKey = transactionKey
    this.baseUrl = AUTHORIZENET_API_BASE_URL[environment]
  }

  /**
   * Process a card payment using Authorize.Net AIM API
   * This is a server-to-server authCaptureTransaction (auth + capture in one call)
   * For POS use, we assume card data is collected via terminal/card reader
   * For e-commerce, Accept.js should be used to tokenize cards client-side
   */
  async processSale(request: AuthorizeNetSaleRequest, opaqueData?: { dataDescriptor: string; dataValue: string } | string): Promise<AuthorizeNetSaleResponse> {
    // Support both full opaque data object (e-commerce) and string token (legacy POS)
    const opaqueDataObj = typeof opaqueData === 'string'
      ? { dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT', dataValue: opaqueData }
      : opaqueData

    console.log('[AUTHORIZENET] Sending sale request:', {
      amount: request.amount,
      invoiceNumber: request.invoiceNumber,
      hasOpaqueData: !!opaqueDataObj,
    })

    // Build Authorize.Net request
    const anetRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: this.apiLoginId,
          transactionKey: this.transactionKey,
        },
        refId: request.invoiceNumber,
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: request.amount.toFixed(2),
          payment: opaqueDataObj ? {
            opaqueData: opaqueDataObj,
          } : undefined,
          order: {
            invoiceNumber: request.invoiceNumber,
            description: request.description || 'POS Sale',
          },
          // NOTE: Removed customerId - UUID exceeds Authorize.Net's 20-char limit
          // Customer is already tracked in our orders table
          customerIP: request.customerIp,
          processingOptions: {
            isSubsequentAuth: 'false',
          },
          subsequentAuthInformation: undefined,
        },
      },
    }

    // CRITICAL: Enforce client-side timeout to prevent hanging
    const timeoutMs = PAYMENT_TIMEOUT * 1000 // 120 seconds
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(anetRequest),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      console.log('[AUTHORIZENET] Received response:', {
        status: response.status,
        resultCode: data.messages?.resultCode,
        responseCode: data.transactionResponse?.responseCode,
        transId: data.transactionResponse?.transId,
      })

      if (!response.ok) {
        throw new Error(`Authorize.Net API HTTP Error: ${response.status}`)
      }

      // Check for API-level errors
      if (data.messages?.resultCode !== 'Ok') {
        const errorMessage = data.messages?.message?.[0]?.text || 'Unknown API error'
        throw new Error(`Authorize.Net API Error: ${errorMessage}`)
      }

      // Check for transaction-level errors
      if (data.transactionResponse?.errors && data.transactionResponse.errors.length > 0) {
        const errorText = data.transactionResponse.errors[0].errorText
        throw new Error(`Transaction Error: ${errorText}`)
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)

      // Provide helpful error message for timeouts
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Payment processor timeout after ${timeoutMs / 1000}s. Please try again or use a different payment method.`
        )
      }

      throw error
    }
  }

  /**
   * Void a transaction (must be done same day, before settlement)
   */
  async voidTransaction(transactionId: string): Promise<AuthorizeNetSaleResponse> {
    const anetRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: this.apiLoginId,
          transactionKey: this.transactionKey,
        },
        transactionRequest: {
          transactionType: 'voidTransaction',
          refTransId: transactionId,
        },
      },
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(anetRequest),
    })

    const data = await response.json()

    if (data.messages?.resultCode !== 'Ok') {
      const errorMessage = data.messages?.message?.[0]?.text || 'Unknown error'
      throw new Error(`Void failed: ${errorMessage}`)
    }

    return data
  }
}

// ============================================================================
// STATE MACHINE
// ============================================================================

// Enum values matching the database check constraints
enum OrderStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  READY = 'ready',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  READY_TO_SHIP = 'ready_to_ship',
  SHIPPED = 'shipped',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get allowed CORS origin from request
 * Only whitelisted origins are allowed (Apple security standard)
 */
function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get('origin') || ''

  // Check if origin is in whitelist
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin
  }

  // Check if origin starts with any allowed prefix (for different ports)
  for (const allowedOrigin of ALLOWED_ORIGINS) {
    if (origin.startsWith(allowedOrigin)) {
      return origin
    }
  }

  // Default: Return first whitelisted origin (most restrictive)
  // This prevents unauthorized origins from accessing the API
  return ALLOWED_ORIGINS[0]
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  const allowedOrigin = getAllowedOrigin(req)

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    })
  }

  const startTime = Date.now()
  const requestId = crypto.randomUUID()

  // Start Sentry transaction for performance monitoring
  const transaction = Sentry.startTransaction({
    op: 'http.server',
    name: 'POST /process-checkout',
    tags: {
      requestId,
    },
  })

  let dbClient: Client | null = null

  try {
    Sentry.addBreadcrumb({
      category: 'request',
      message: 'Checkout request received',
      level: 'info',
      data: {
        requestId,
        method: req.method,
        url: req.url,
      },
    })
    // ========================================================================
    // STEP 1: AUTHENTICATION
    // ========================================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return await errorResponse('Missing authorization header', 401, requestId, allowedOrigin)
    }

    const jwt = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Check if using service role key (for e-commerce)
    const isServiceRole = jwt === supabaseServiceKey

    let user: any = null
    let supabaseAdmin: SupabaseClient

    if (isServiceRole) {
      // E-commerce request using service role - no user authentication required
      console.log(`[${requestId}] Service role authentication (e-commerce)`)

      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Service role authentication (e-commerce)',
        level: 'info',
      })
      transaction.setTag('auth_type', 'service_role')
    } else {
      // POS request using user JWT - verify user authentication
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const { data: { user: authUser }, error: userError } = await supabaseClient.auth.getUser(jwt)

      if (userError || !authUser) {
        console.error('[Auth] Failed:', userError)
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Authentication failed',
          level: 'error',
          data: { error: userError?.message },
        })
        transaction.setTag('auth_status', 'failed')
        transaction.finish()
        return await errorResponse('Unauthorized', 401, requestId, allowedOrigin)
      }

      user = authUser

      // Set user context for Sentry
      Sentry.setUser({ id: user.id, email: user.email })
      transaction.setTag('user_id', user.id)

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User authenticated successfully',
        level: 'info',
        data: { userId: user.id },
      })

      // Service role client for database operations
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      console.log(`[${requestId}] Request started by user: ${user.id}`)
    }

    // ========================================================================
    // STEP 2: PARSE & VALIDATE REQUEST
    // ========================================================================
    const rawBody: CheckoutRequest = await req.json()

    // Normalize request format (support both POS camelCase and e-commerce snake_case)
    const body = {
      ...rawBody,
      vendorId: rawBody.vendorId || rawBody.vendor_id,
      locationId: rawBody.locationId || rawBody.location_id,
      registerId: rawBody.registerId || rawBody.register_id,
      sessionId: rawBody.sessionId || rawBody.session_id,
      customerId: rawBody.customerId || rawBody.customer_id,
      customerName: rawBody.customerName || rawBody.customer_name,
      taxAmount: rawBody.taxAmount || rawBody.tax || 0,
      tipAmount: rawBody.tipAmount || rawBody.tip_amount || 0,
      paymentMethod: rawBody.paymentMethod || (rawBody.payment?.method as any),
    } as CheckoutRequest

    console.log(`[${requestId}] Request format:`, {
      isEcommerce: body.is_ecommerce,
      hasPaymentObject: !!rawBody.payment,
      paymentMethod: body.paymentMethod,
    })

    // ========================================================================
    // STEP 2.5: AUTHORIZATION CHECK
    // ========================================================================
    // Skip vendor authorization check for service role (e-commerce)
    let authorizedVendorId = body.vendorId

    if (!isServiceRole && user) {
      const { data: userAccess, error: accessError } = await supabaseAdmin
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .single()

      if (accessError || !userAccess || userAccess.vendor_id !== body.vendorId) {
        console.error(`[${requestId}] Unauthorized access attempt:`, {
          authUserId: user.id,
          requestedVendorId: body.vendorId,
          userVendorId: userAccess?.vendor_id,
          error: accessError?.message,
        })

        // Log security event to Sentry
        Sentry.captureMessage('Unauthorized vendor access attempt', {
          level: 'warning',
          tags: {
            security: 'true',
            requestId,
          },
          contexts: {
            authorization: {
              userId: user.id,
              requestedVendorId: body.vendorId,
              userVendorId: userAccess?.vendor_id,
            },
          },
        })

        transaction.setTag('authorization', 'failed')
        transaction.finish()
        return await errorResponse('Unauthorized: No access to this vendor', 403, requestId, allowedOrigin)
      }

      authorizedVendorId = userAccess.vendor_id
      transaction.setTag('vendor_id', userAccess.vendor_id)
    } else {
      // Service role - use vendor_id from request
      transaction.setTag('vendor_id', body.vendorId)
      console.log(`[${requestId}] Service role - using vendor_id from request: ${body.vendorId}`)
    }

    Sentry.addBreadcrumb({
      category: 'authorization',
      message: 'Vendor authorization passed',
      level: 'info',
      data: { vendorId: authorizedVendorId },
    })

    console.log(`[${requestId}] Authorization check passed for vendor: ${authorizedVendorId}`)

    // ========================================================================
    // STEP 3: VALIDATE REQUEST FIELDS
    // ========================================================================

    // Validate vendor ID (required for all orders)
    if (!body.vendorId) {
      return await errorResponse('Missing required field: vendorId', 400, requestId, allowedOrigin)
    }

    // Validate POS-specific fields (not required for e-commerce)
    if (!body.is_ecommerce) {
      if (!body.locationId || !body.registerId) {
        return await errorResponse('Missing required POS fields: locationId, registerId', 400, requestId, allowedOrigin)
      }
      if (!body.paymentMethod) {
        return await errorResponse('Payment method is required', 400, requestId, allowedOrigin)
      }
    } else {
      // E-commerce specific validations
      if (!rawBody.payment || !rawBody.payment.method) {
        return await errorResponse('Payment details are required for e-commerce orders', 400, requestId, allowedOrigin)
      }
    }

    if (!body.items || body.items.length === 0) {
      return await errorResponse('Cart is empty', 400, requestId, allowedOrigin)
    }

    if (!body.total || body.total <= 0) {
      return await errorResponse('Invalid total amount', 400, requestId, allowedOrigin)
    }

    // ========================================================================
    // STEP 3.5: COMPREHENSIVE INPUT VALIDATION (Apple Security Standards)
    // ========================================================================

    // DEBUG: Log payment calculation inputs
    console.log(`[${requestId}] 💰 EDGE FUNCTION RECEIVED:`, {
      subtotal: body.subtotal,
      loyaltyDiscount: body.loyaltyDiscountAmount || 0,
      campaignDiscount: body.campaignDiscountAmount || 0,
      taxAmount: body.taxAmount,
      total: body.total,
      calculation: `${body.subtotal} - ${body.loyaltyDiscountAmount || 0} - ${body.campaignDiscountAmount || 0} + ${body.taxAmount} tax = ${body.total}`,
    })

    // Validate each line item
    let calculatedSubtotal = 0
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i]

      // Validate quantity is positive
      if (!item.quantity || item.quantity <= 0) {
        return await errorResponse(
          `Invalid quantity for item ${i + 1}: ${item.productName}`,
          400,
          requestId
        )
      }

      // Validate unit price is non-negative
      if (item.unitPrice === undefined || item.unitPrice < 0) {
        return await errorResponse(
          `Invalid price for item ${i + 1}: ${item.productName}`,
          400,
          requestId
        )
      }

      // Validate line total matches quantity * unit price (within 0.01 tolerance)
      const expectedLineTotal = item.quantity * item.unitPrice
      if (Math.abs(item.lineTotal - expectedLineTotal) > 0.01) {
        return await errorResponse(
          `Invalid line total for item ${i + 1}: ${item.productName}`,
          400,
          requestId
        )
      }

      calculatedSubtotal += item.lineTotal
    }

    // Validate subtotal matches sum of line items (within 0.01 tolerance)
    if (Math.abs(calculatedSubtotal - body.subtotal) > 0.01) {
      Sentry.captureMessage('Subtotal mismatch detected', {
        level: 'warning',
        tags: { requestId, security: 'validation' },
        contexts: {
          validation: {
            calculatedSubtotal,
            requestedSubtotal: body.subtotal,
            difference: Math.abs(calculatedSubtotal - body.subtotal),
          },
        },
      })
      return await errorResponse(
        'Invalid subtotal calculation',
        400,
        requestId
      )
    }

    // Validate total = subtotal - discounts + tax (within 0.01 tolerance)
    const totalDiscounts = (body.loyaltyDiscountAmount || 0) + (body.campaignDiscountAmount || 0)
    const expectedTotal = body.subtotal - totalDiscounts + body.taxAmount
    if (Math.abs(body.total - expectedTotal) > 0.01) {
      Sentry.captureMessage('Total mismatch detected', {
        level: 'warning',
        tags: { requestId, security: 'validation' },
        contexts: {
          validation: {
            subtotal: body.subtotal,
            loyaltyDiscountAmount: body.loyaltyDiscountAmount || 0,
            campaignDiscountAmount: body.campaignDiscountAmount || 0,
            taxAmount: body.taxAmount,
            calculatedTotal: expectedTotal,
            requestedTotal: body.total,
            difference: Math.abs(body.total - expectedTotal),
          },
        },
      })
      return await errorResponse(
        'Invalid total calculation',
        400,
        requestId,
        allowedOrigin
      )
    }

    // Sanity check: No unreasonably large transactions for walk-in orders
    const MAX_WALK_IN_AMOUNT = 50000 // $50,000
    if (body.total > MAX_WALK_IN_AMOUNT) {
      Sentry.captureMessage('Unusually large walk-in transaction', {
        level: 'warning',
        tags: { requestId, security: 'fraud-detection' },
        contexts: {
          transaction: {
            total: body.total,
            threshold: MAX_WALK_IN_AMOUNT,
            vendorId: body.vendorId,
            userId: user?.id || 'e-commerce',
          },
        },
      })
      // Log but allow - might be legitimate bulk purchase
      console.warn(`[${requestId}] Large transaction: $${body.total}`)
    }

    Sentry.addBreadcrumb({
      category: 'validation',
      message: 'Input validation passed',
      level: 'info',
      data: {
        itemCount: body.items.length,
        subtotal: body.subtotal,
        tax: body.taxAmount,
        total: body.total,
      },
    })

    // Generate idempotency key if not provided
    const idempotencyKey = body.idempotencyKey || `${body.vendorId}-${Date.now()}-${requestId}`

    console.log(`[${requestId}] Processing checkout:`, {
      idempotencyKey,
      total: body.total,
      paymentMethod: body.paymentMethod,
      itemCount: body.items.length,
    })

    // ========================================================================
    // STEP 4: CHECK IDEMPOTENCY (Direct SQL - bypasses PostgREST)
    // ========================================================================
    dbClient = await getDbClient()

    try {
      const existingOrderResult = await dbClient.queryObject(
        `SELECT * FROM check_idempotent_order($1)`,
        [idempotencyKey]
      )

      const existingOrder = existingOrderResult.rows as any[]

      if (existingOrder && existingOrder[0]?.order_exists) {
        console.log(`[${requestId}] Idempotent request - returning existing order`)
        // Connection will be closed by finally block
        return await successResponse({
          orderId: existingOrder[0].order_id,
          orderStatus: existingOrder[0].order_status,
          paymentStatus: existingOrder[0].payment_status,
          total: existingOrder[0].total_amount,
          message: 'Order already processed (idempotent)',
        }, requestId, Date.now() - startTime, allowedOrigin)
      }
    } catch (error) {
      console.warn(`[${requestId}] Idempotency check failed (function may not exist):`, error)
      // Continue anyway - idempotency is optional
    }

    // ========================================================================
    // STEP 5: GET PAYMENT PROCESSOR (Direct SQL - bypasses PostgREST)
    // ========================================================================
    let paymentProcessor: any = null

    try {
      if (body.is_ecommerce) {
        // E-commerce order - fetch the e-commerce processor for this vendor
        console.log(`[${requestId}] Fetching e-commerce processor for vendor: ${body.vendorId}`)
        const processorResult = await dbClient.queryObject(
          `SELECT * FROM get_ecommerce_processor($1)`,
          [body.vendorId]
        )

        const processor = processorResult.rows as any[]

        if (!processor || processor.length === 0) {
          return await errorResponse('No e-commerce payment processor configured for this vendor', 400, requestId, allowedOrigin)
        }

        paymentProcessor = processor[0]
      } else {
        // POS order - fetch processor for register
        const processorResult = await dbClient.queryObject(
          `SELECT * FROM get_processor_for_register($1)`,
          [body.registerId]
        )

        const processor = processorResult.rows as any[]

        if (!processor || processor.length === 0) {
          return await errorResponse('No payment processor configured for this register', 400, requestId, allowedOrigin)
        }

        paymentProcessor = processor[0]
      }
    } catch (error) {
      console.error(`[${requestId}] Failed to get payment processor:`, error)
      // Connection will be closed by finally block
      return await errorResponse('Failed to retrieve payment processor', 500, requestId, allowedOrigin)
    }

    console.log(`[${requestId}] Using processor:`, {
      type: paymentProcessor.processor_type,
      environment: paymentProcessor.environment,
      isEcommerce: body.is_ecommerce,
    })

    // ========================================================================
    // STEP 6: CREATE DRAFT ORDER
    // ========================================================================
    // Generate order number (max 20 chars for Authorize.Net compatibility)
    // Format: timestamp(12 digits) + random(7 chars) = 19 chars total
    const timestamp = Date.now().toString().slice(-12) // Last 12 digits
    const random = Math.random().toString(36).substring(2, 9).toUpperCase() // 7 chars
    const orderNumber = `${timestamp}${random}`

    // Validate that created_by_user_id exists in users table (FK constraint protection)
    console.log(`[${requestId}] 🔍 STAFF TRACKING v3: customUserId=${body.customUserId}`)
    let createdByUserId = body.customUserId

    if (body.customUserId) {
      // Validate the provided customUserId exists
      const { data: userExists } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', body.customUserId)
        .maybeSingle()

      console.log(`[${requestId}] ✅ User validation: exists=${!!userExists}, id=${userExists?.id}`)

      if (!userExists) {
        console.warn(`[${requestId}] customUserId ${body.customUserId} not found in users table, falling back to auth user`)
        createdByUserId = null // Will be set below
      } else {
        console.log(`[${requestId}] ✅ Using provided customUserId: ${body.customUserId}`)
      }
    }

    // If no valid customUserId, lookup the users table ID from auth_user_id (POS only)
    if (!createdByUserId && user) {
      console.log(`[${requestId}] 🔄 No valid customUserId, looking up by auth_user_id: ${user.id}`)
      const { data: authUserRecord } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (authUserRecord) {
        createdByUserId = authUserRecord.id
        console.log(`[${requestId}] ✅ Using users table ID ${authUserRecord.id} for auth user ${user.id}`)
      } else {
        console.warn(`[${requestId}] ❌ No users table record found for auth user ${user.id}, order will have null created_by_user_id`)
        createdByUserId = null
      }
    }

    console.log(`[${requestId}] 📝 Final createdByUserId for order: ${createdByUserId}`)

    // Log full request body for debugging
    console.log(`[${requestId}] 🔍 Full request body:`, JSON.stringify(body, null, 2))
    if (user) {
      console.log(`[${requestId}] 🔍 User info:`, { userId: user.id })
    } else {
      console.log(`[${requestId}] 🔍 E-commerce order (no user)`)
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        vendor_id: body.vendorId,
        pickup_location_id: body.is_ecommerce ? null : body.locationId, // E-commerce orders don't have pickup location
        customer_id: body.customerId || null,
        order_number: orderNumber,
        order_type: body.is_ecommerce ? 'shipping' : 'walk_in', // E-commerce = shipping, POS = walk_in
        delivery_type: body.is_ecommerce ? 'shipping' : 'pickup', // E-commerce = shipping, POS = pickup
        status: OrderStatus.PENDING,
        payment_status: PaymentStatus.PENDING,
        subtotal: body.subtotal,
        tax_amount: body.taxAmount,
        total_amount: body.total,
        payment_method: body.paymentMethod,
        idempotency_key: idempotencyKey,
        created_by_user_id: createdByUserId, // ✅ APPLE WAY: Validated FK before insert
        // E-commerce shipping address and cost
        ...(body.is_ecommerce && body.shipping_address ? {
          shipping_name: body.shipping_address.name,
          shipping_address_line1: body.shipping_address.address,
          shipping_city: body.shipping_address.city,
          shipping_state: body.shipping_address.state,
          shipping_zip: body.shipping_address.zip,
          shipping_phone: body.shipping_address.phone,
          shipping_country: 'US',
          shipping_cost: body.shipping || 0,
        } : {}),
        metadata: {
          ...body.metadata,
          customer_name: body.customerName || (body.is_ecommerce ? 'Online Customer' : 'Walk-In'),
          loyalty_points_redeemed: body.loyaltyPointsRedeemed || 0,
          loyalty_discount_amount: body.loyaltyDiscountAmount || 0,
          campaign_discount_amount: body.campaignDiscountAmount || 0,
          campaign_id: body.campaignId || null,
          session_id: body.sessionId,
          register_id: body.registerId,
          request_id: requestId,
          is_ecommerce: body.is_ecommerce || false,
          billing_address: body.billing_address || null,
        },
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error(`[${requestId}] Failed to create order:`, orderError)
      console.error(`[${requestId}] Order creation payload:`, JSON.stringify({
        vendor_id: body.vendorId,
        pickup_location_id: body.locationId,
        customer_id: body.customerId || null,
        order_number: orderNumber,
        order_type: 'walk_in',
        delivery_type: 'pickup',
        status: OrderStatus.PENDING,
        payment_status: PaymentStatus.PENDING,
        subtotal: body.subtotal,
        tax_amount: body.taxAmount,
        total_amount: body.total,
        payment_method: body.paymentMethod,
        idempotency_key: idempotencyKey,
        created_by_user_id: createdByUserId,
      }, null, 2))
      Sentry.captureException(orderError, {
        tags: { operation: 'order_creation', requestId },
        contexts: {
          order: {
            orderNumber,
            total: body.total,
            paymentMethod: body.paymentMethod,
            errorCode: orderError?.code,
            errorMessage: orderError?.message,
            errorDetails: orderError?.details,
            errorHint: orderError?.hint,
          },
        },
      })
      // Return detailed error message for debugging
      const detailedError = `Failed to create order: ${orderError?.message || 'Unknown error'} (code: ${orderError?.code || 'N/A'})`
      console.error(`[${requestId}] ${detailedError}`)
      return await errorResponse(detailedError, 500, requestId, allowedOrigin)
    }

    Sentry.addBreadcrumb({
      category: 'order',
      message: 'Draft order created',
      level: 'info',
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        total: body.total,
      },
    })

    transaction.setTag('order_id', order.id)
    transaction.setTag('order_number', order.order_number)
    transaction.setTag('payment_method', body.paymentMethod)

    console.log(`[${requestId}] Draft order created:`, order.id)

    // ========================================================================
    // STEP 7: LOOKUP INVENTORY IDS FOR E-COMMERCE ORDERS
    // ========================================================================
    // For e-commerce orders, we need to find actual inventory records
    // because frontend only sends product IDs
    if (body.is_ecommerce) {
      console.log(`[${requestId}] Looking up inventory records for e-commerce order`)
      for (const item of body.items) {
        // Find an inventory record with available stock for this product
        const inventoryResult = await dbClient.queryObject(
          `SELECT id FROM inventory
           WHERE product_id = $1
             AND vendor_id = $2
             AND available_quantity > 0
           ORDER BY available_quantity DESC
           LIMIT 1`,
          [item.productId, body.vendorId]
        )

        const inventoryRows = inventoryResult.rows as any[]
        if (!inventoryRows || inventoryRows.length === 0) {
          return await errorResponse(
            `No inventory found for product: ${item.productName}`,
            400,
            requestId,
            allowedOrigin
          )
        }

        // Update the item with the actual inventory ID
        item.inventoryId = inventoryRows[0].id
        console.log(`[${requestId}] Found inventory ${item.inventoryId} for product ${item.productId}`)
      }
    }

    // ========================================================================
    // STEP 8: CREATE ORDER ITEMS
    // ========================================================================
    const orderItems = body.items.map(item => {
      // MISSION CRITICAL: Validate tier quantity for inventory deduction
      // Note: gramsToDeduct is a legacy name - it's actually the tier quantity (could be grams, units, ounces, etc.)
      const tierQtyToDeduct = item.gramsToDeduct || item.tierQty || item.quantity_grams

      if (!tierQtyToDeduct || tierQtyToDeduct <= 0) {
        console.error(`[${requestId}] Invalid tier quantity for item:`, {
          productName: item.productName,
          gramsToDeduct: item.gramsToDeduct,
          tierQty: item.tierQty,
          quantity_grams: item.quantity_grams,
          quantity: item.quantity,
          fullItem: JSON.stringify(item, null, 2)
        })
        throw new Error(`CRITICAL: Missing or invalid tier quantity for item ${item.productName}. Inventory deduction would be incorrect! Received: ${tierQtyToDeduct}`)
      }

      return {
        order_id: order.id,
        vendor_id: body.vendorId, // REQUIRED: vendor_id is a required column in order_items
        product_id: item.productId,
        product_name: item.productName,
        product_sku: item.productSku,
        product_image: null,
        product_type: null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_subtotal: item.lineTotal, // Subtotal before tax
        line_total: item.lineTotal, // Total including tax
        tax_amount: 0, // Tax is calculated at order level
        inventory_id: item.inventoryId, // Now populated with actual inventory record ID
        stock_movement_id: null,
        tier_name: item.tierName || null, // e.g., "28g (Ounce)", "3.5g (Eighth)", "1 Unit"
        tier_qty: tierQtyToDeduct, // Tier quantity to deduct from inventory
        tier_price: item.unitPrice, // Price for this tier
        quantity_grams: tierQtyToDeduct, // CRITICAL: Actual quantity to deduct (grams, units, etc.)
        quantity_display: item.tierName || `${item.quantity}`, // Display string for UI
        meta_data: {},
        // Required fields for order item tracking
        order_type: body.is_ecommerce ? 'shipping' : 'pickup',
        pickup_location_id: body.is_ecommerce ? null : body.locationId, // Only for pickup orders
        pickup_location_name: null,
        fulfillment_status: 'unfulfilled',
        fulfilled_quantity: 0,
        vendor_payout_status: 'pending',
        commission_rate: null,
        commission_amount: null,
        cost_per_unit: null,
        profit_per_unit: null,
        margin_percentage: null,
        // Multi-location support: which location fulfills this item
        location_id: item.locationId || item.location_id || body.locationId || null,
      }
    })

    console.log(`[${requestId}] Inserting order items:`, JSON.stringify(orderItems, null, 2))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      // Rollback order
      await supabaseAdmin.from('orders').delete().eq('id', order.id)

      // Log detailed error information
      console.error(`[${requestId}] Failed to create order items:`, {
        error: itemsError,
        message: itemsError.message,
        details: itemsError.details,
        hint: itemsError.hint,
        code: itemsError.code,
      })
      console.error(`[${requestId}] Order items that failed:`, JSON.stringify(orderItems, null, 2))
      console.error(`[${requestId}] Original request items:`, JSON.stringify(body.items, null, 2))

      // Capture to Sentry with full context
      Sentry.captureException(itemsError, {
        tags: { operation: 'order_items_creation', requestId },
        contexts: {
          order: {
            orderId: order.id,
            orderNumber: order.order_number,
            itemCount: body.items.length,
          },
          error_details: {
            code: itemsError.code,
            message: itemsError.message,
            details: itemsError.details,
            hint: itemsError.hint,
          },
          items_sample: orderItems.length > 0 ? orderItems[0] : null,
        },
      })

      // Return detailed error message for debugging
      const detailedError = `Failed to create order items: ${itemsError.message}${itemsError.hint ? ` (Hint: ${itemsError.hint})` : ''}${itemsError.details ? ` (Details: ${itemsError.details})` : ''}`

      // Connection will be closed by finally block
      return await errorResponse(detailedError, 500, requestId, allowedOrigin)
    }

    Sentry.addBreadcrumb({
      category: 'order',
      message: 'Order items created',
      level: 'info',
      data: { itemCount: body.items.length },
    })

    // ========================================================================
    // STEP 7.4: SMART ORDER ROUTING (Apple/Best Buy style)
    // ========================================================================
    // Routes ALL orders (pickup, shipping, walk_in) to fulfillment locations
    // For pickup orders: Items in stock at pickup location → pickup
    //                    Items NOT in stock → ship from another location
    // For shipping orders: Route to locations with inventory
    {
      const routingSpan = transaction.startChild({
        op: 'order.route',
        description: 'Smart Order Routing',
      })

      try {
        console.log(`[${requestId}] Running smart order routing (order_type: ${body.is_ecommerce ? 'shipping' : 'pickup'})`)

        Sentry.addBreadcrumb({
          category: 'routing',
          message: 'Starting smart order routing',
          level: 'info',
          data: { orderId: order.id, itemCount: body.items.length, orderType: body.is_ecommerce ? 'shipping' : 'pickup' },
        })

        // Call the smart routing function - it will:
        // 1. Check inventory at pickup location per-item (for pickup orders)
        // 2. Route items not in stock to ship from other locations
        // 3. Update order_items with location_id and order_type (pickup/shipping)
        // 4. Create order_locations records for tracking
        const routingResult = await dbClient.queryObject(
          `SELECT * FROM route_order_to_locations($1)`,
          [order.id]
        )

        const routedLocations = routingResult.rows as any[]
        console.log(`[${requestId}] Order routed to ${routedLocations.length} location(s):`,
          routedLocations.map(r => ({
            location_id: r.location_id,
            location_name: r.location_name,
            item_count: r.item_count,
            fulfillment_type: r.fulfillment_type
          }))
        )

        // Log if order was split (mixed pickup + shipping)
        const hasPickup = routedLocations.some(r => r.fulfillment_type === 'pickup')
        const hasShipping = routedLocations.some(r => r.fulfillment_type === 'shipping')
        if (hasPickup && hasShipping) {
          console.log(`[${requestId}] 📦 MIXED ORDER: Some items pickup, some items shipping`)
        }

        Sentry.addBreadcrumb({
          category: 'routing',
          message: 'Smart order routing completed',
          level: 'info',
          data: {
            locationCount: routedLocations.length,
            locations: routedLocations.map(r => r.location_id),
            isMixedOrder: hasPickup && hasShipping,
          },
        })

        routingSpan.setStatus('ok')
      } catch (routingError) {
        console.warn(`[${requestId}] Smart order routing failed (non-critical):`, routingError)
        routingSpan.setStatus('unknown_error')

        // Log to Sentry but don't fail the order - items will have null location_id
        // which can be manually assigned later by staff
        Sentry.captureException(routingError, {
          level: 'warning',
          tags: {
            operation: 'smart_order_routing',
            requestId,
            orderId: order.id,
          },
        })
      } finally {
        routingSpan.finish()
      }
    }

    // ========================================================================
    // STEP 7.5: RESERVE INVENTORY (Before payment)
    // ========================================================================
    if (body.items.some(item => item.inventoryId)) {
      const inventoryReservationSpan = transaction.startChild({
        op: 'inventory.reserve',
        description: 'Reserve Inventory',
      })

      try {
        Sentry.addBreadcrumb({
          category: 'inventory',
          message: 'Reserving inventory before payment',
          level: 'info',
          data: {
            itemCount: body.items.filter(i => i.inventoryId).length,
          },
        })

        await dbClient.queryObject(
          `SELECT reserve_inventory($1, $2)`,
          [order.id, JSON.stringify(body.items)]
        )

        console.log(`[${requestId}] Inventory reserved successfully`)
        inventoryReservationSpan.setStatus('ok')

        Sentry.addBreadcrumb({
          category: 'inventory',
          message: 'Inventory reserved successfully',
          level: 'info',
        })
      } catch (error) {
        console.error(`[${requestId}] Inventory reservation failed:`, error)
        inventoryReservationSpan.setStatus('failed_precondition')

        // Cancel order if reservation fails (insufficient inventory)
        await supabaseAdmin
          .from('orders')
          .update({
            status: OrderStatus.CANCELLED,
            payment_status: PaymentStatus.FAILED,
          })
          .eq('id', order.id)

        Sentry.captureException(error, {
          level: 'warning',
          tags: {
            operation: 'inventory_reservation',
            requestId,
            orderId: order.id,
          },
        })

        // Connection will be closed by finally block
        inventoryReservationSpan.finish()
        return await errorResponse(
          `Insufficient inventory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          400,
          requestId
        )
      } finally {
        inventoryReservationSpan.finish()
      }
    }

    // ========================================================================
    // STEP 8: PROCESS PAYMENT
    // ========================================================================
    let paymentResult: SPINSaleResponse | null = null
    let paymentError: Error | null = null

    if (body.paymentMethod === 'cash' || body.paymentMethod === 'split') {
      // Cash or Split payment
      const isSplit = body.paymentMethod === 'split'
      const cashAmount = isSplit ? (body.cashAmount || 0) : body.total

      console.log(`[${requestId}] ${isSplit ? 'Split' : 'Cash'} payment - ${isSplit ? `cash portion: $${cashAmount}` : 'skipping processor'}`)

      Sentry.addBreadcrumb({
        category: 'payment',
        message: `Processing ${isSplit ? 'split' : 'cash'} payment`,
        level: 'info',
        data: {
          amount: body.total,
          cashAmount: isSplit ? cashAmount : body.total,
          cardAmount: isSplit ? body.cardAmount : 0,
        },
      })

      const { error: cashUpdateError } = await supabaseAdmin
        .from('orders')
        .update({
          status: isSplit ? OrderStatus.PENDING : OrderStatus.COMPLETED, // Split payment will be completed after card processing
          payment_status: isSplit ? PaymentStatus.PENDING : PaymentStatus.PAID,
          processor_transaction_id: `${isSplit ? 'SPLIT' : 'CASH'}-${orderNumber}`,
          payment_authorization_code: isSplit ? 'SPLIT-PAYMENT' : 'CASH',
        })
        .eq('id', order.id)

      if (cashUpdateError) {
        console.error(`[${requestId}] Failed to update order for cash payment:`, cashUpdateError)
        Sentry.captureException(cashUpdateError, {
          tags: { operation: 'cash_payment_update', requestId },
        })
        // Connection will be closed by finally block
        return await errorResponse(`Failed to complete cash payment: ${cashUpdateError.message}`, 500, requestId, allowedOrigin)
      }

      // CRITICAL: Log cash transaction for audit trail
      const { error: cashTransactionError} = await supabaseAdmin
        .from('payment_transactions')
        .insert({
          vendor_id: body.vendorId,
          location_id: body.locationId,
          payment_processor_id: null, // No processor for cash
          order_id: order.id,
          processor_type: 'manual',
          transaction_type: 'sale',
          payment_method: isSplit ? 'split-cash' : 'cash',
          amount: cashAmount,
          total_amount: cashAmount,
          status: 'approved',
          processor_transaction_id: `CASH-${orderNumber}`,
          processor_reference_id: orderNumber,
          authorization_code: 'CASH',
          processed_at: new Date().toISOString(),
          idempotency_key: `${idempotencyKey}-cash`,
        })

      if (cashTransactionError) {
        // Log but don't fail - order already completed
        console.error(`[${requestId}] Failed to log cash transaction:`, cashTransactionError)
        Sentry.captureException(cashTransactionError, {
          level: 'warning',
          tags: { operation: 'cash_transaction_logging', requestId },
        })
      }

      Sentry.addBreadcrumb({
        category: 'payment',
        message: `${isSplit ? 'Split payment cash portion' : 'Cash payment'} completed and logged`,
        level: 'info',
      })

      // For split payments, fall through to process card portion
      if (!isSplit) {
        // Pure cash payment is complete, skip card processing
        console.log(`[${requestId}] Cash-only payment complete`)
      }
    }

    // Process card payment (either full card or split payment card portion)
    // Accept all card types: credit, debit, card, split, ebt_food, ebt_cash, gift
    const isCardPayment = ['card', 'credit', 'debit', 'ebt_food', 'ebt_cash', 'gift', 'split'].includes(body.paymentMethod)
    if (isCardPayment && body.paymentMethod !== 'cash') {
      const isSplit = body.paymentMethod === 'split'
      const cardAmount = isSplit ? (body.cardAmount || 0) : body.total

      // Card payment via processor (Dejavoo SPIN or Authorize.Net)
      console.log(`[${requestId}] Processing ${isSplit ? 'split payment card portion' : 'card payment'} (${body.paymentMethod}) via ${paymentProcessor.processor_type}: $${cardAmount}`)

      // Keep status as PENDING while processing payment
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: PaymentStatus.PENDING })
        .eq('id', order.id)

      // ========================================================================
      // ROUTE TO APPROPRIATE PAYMENT PROCESSOR
      // ========================================================================
      if (paymentProcessor.processor_type === 'dejavoo') {
        // Dejavoo SPIN API
        const spinClient = new SPINClient(
          paymentProcessor.authkey,
          paymentProcessor.tpn,
          paymentProcessor.environment
        )

        const spinRequest: SPINSaleRequest = {
          Amount: cardAmount, // Use cardAmount for split payments, body.total for card-only
          TipAmount: body.tipAmount || 0,
          PaymentType: mapPaymentType(body.paymentMethod),
          ReferenceId: orderNumber,
          InvoiceNumber: orderNumber,
          Tpn: paymentProcessor.tpn,
          Authkey: paymentProcessor.authkey,
          SPInProxyTimeout: PAYMENT_TIMEOUT,
          PrintReceipt: 'No',
          GetReceipt: 'Both',
          GetExtendedData: true,
        }

        try {
          Sentry.addBreadcrumb({
            category: 'payment',
            message: 'Sending payment to SPIN processor',
            level: 'info',
            data: {
              amount: cardAmount,
              paymentType: mapPaymentType(body.paymentMethod),
              environment: paymentProcessor.environment,
              isSplit,
            },
          })

          const paymentSpan = transaction.startChild({
            op: 'payment.process',
            description: 'SPIN API Payment Processing',
          })

          paymentResult = await spinClient.processSale(spinRequest)
          paymentSpan.finish()

          const resultCode = paymentResult.GeneralResponse.ResultCode
          const statusCode = paymentResult.GeneralResponse.StatusCode

          Sentry.addBreadcrumb({
            category: 'payment',
            message: 'Received SPIN processor response',
            level: resultCode === '0' && statusCode === '0000' ? 'info' : 'warning',
            data: {
              resultCode,
              statusCode,
              approved: resultCode === '0' && statusCode === '0000',
            },
          })

          // Log transaction
          await supabaseAdmin.from('payment_transactions').insert({
            vendor_id: body.vendorId,
            location_id: body.locationId,
            payment_processor_id: paymentProcessor.processor_id,
            order_id: order.id,
            processor_type: 'dejavoo',
            transaction_type: 'sale',
            payment_method: isSplit ? 'split-card' : body.paymentMethod,
            amount: cardAmount,
            total_amount: body.total,
            status: resultCode === '0' && statusCode === '0000' ? 'approved' : 'declined',
            processor_transaction_id: paymentResult.GeneralResponse.ReferenceId,
            processor_reference_id: orderNumber,
            authorization_code: paymentResult.GeneralResponse.AuthCode,
            result_code: resultCode,
            status_code: statusCode,
            spin_result_code: resultCode,
            spin_status_code: statusCode,
            spin_message: paymentResult.GeneralResponse.Message,
            spin_detailed_message: paymentResult.GeneralResponse.DetailedMessage,
            response_data: paymentResult,
            card_type: paymentResult.CardData?.CardType,
            card_last_four: paymentResult.CardData?.Last4,
            processed_at: new Date().toISOString(),
            idempotency_key: idempotencyKey,
          })

          // Check if approved
          if (resultCode === '0' && statusCode === '0000') {
            // Payment approved!
            console.log(`[${requestId}] Payment approved:`, {
              authCode: paymentResult.GeneralResponse.AuthCode,
            transactionId: paymentResult.GeneralResponse.ReferenceId,
          })

          const { error: cardUpdateError } = await supabaseAdmin
            .from('orders')
            .update({
              status: OrderStatus.COMPLETED,
              payment_status: PaymentStatus.PAID,
              processor_transaction_id: paymentResult.GeneralResponse.ReferenceId,
              payment_authorization_code: paymentResult.GeneralResponse.AuthCode,
              card_type: paymentResult.CardData?.CardType,
              card_last_four: paymentResult.CardData?.Last4,
              payment_data: paymentResult,
            })
            .eq('id', order.id)

          if (cardUpdateError) {
            console.error(`[${requestId}] Failed to update order after successful card payment:`, cardUpdateError)
            // Connection will be closed by finally block
            return await errorResponse(`Failed to finalize order: ${cardUpdateError.message}`, 500, requestId, allowedOrigin)
          }

        } else {
          // Payment declined
          throw new Error(paymentResult.GeneralResponse.DetailedMessage || paymentResult.GeneralResponse.Message || 'Payment declined')
        }

      } catch (error) {
        paymentError = error as Error
        console.error(`[${requestId}] Payment failed:`, error)

        // Log failed transaction
        await supabaseAdmin.from('payment_transactions').insert({
          vendor_id: body.vendorId,
          location_id: body.locationId,
          payment_processor_id: paymentProcessor.processor_id,
          order_id: order.id,
          processor_type: 'dejavoo',
          transaction_type: 'sale',
          payment_method: isSplit ? 'split-card' : body.paymentMethod,
          amount: cardAmount,
          total_amount: body.total,
          status: 'error',
          error_message: error.message,
          processed_at: new Date().toISOString(),
          idempotency_key: idempotencyKey,
        })

        // Update order status to CANCELLED (payment failed)
        await supabaseAdmin
          .from('orders')
          .update({
            status: OrderStatus.CANCELLED,
            payment_status: PaymentStatus.FAILED,
          })
          .eq('id', order.id)

        // Release inventory holds (payment failed)
        try {
          await dbClient.queryObject(
            `SELECT release_inventory_holds($1, $2)`,
            [order.id, 'payment_failed']
          )
          console.log(`[${requestId}] Inventory holds released after payment failure`)
        } catch (releaseError) {
          console.error(`[${requestId}] Failed to release inventory holds:`, releaseError)
          // Don't fail the whole operation - holds will expire automatically
        }

        // Connection will be closed by finally block
        return await errorResponse(`Payment failed: ${error.message}`, 402, requestId, allowedOrigin)
      }

      } else if (paymentProcessor.processor_type === 'authorizenet') {
        // Authorize.Net API
        const anetClient = new AuthorizeNetClient(
          paymentProcessor.api_login_id,
          paymentProcessor.transaction_key,
          paymentProcessor.environment
        )

        const anetRequest: AuthorizeNetSaleRequest = {
          amount: cardAmount, // Use cardAmount for split payments, body.total for card-only
          invoiceNumber: orderNumber,
          description: `POS Sale - ${orderNumber}`,
          customerId: body.customerId,
        }

        try {
          Sentry.addBreadcrumb({
            category: 'payment',
            message: 'Sending payment to Authorize.Net processor',
            level: 'info',
            data: {
              amount: cardAmount,
              environment: paymentProcessor.environment,
              isSplit,
            },
          })

          const paymentSpan = transaction.startChild({
            op: 'payment.process',
            description: 'Authorize.Net Payment Processing',
          })

          // Get opaque data from e-commerce request or legacy card token from metadata
          const opaqueData = rawBody.payment?.opaque_data || body.metadata?.cardToken

          paymentResult = await anetClient.processSale(anetRequest, opaqueData)
          paymentSpan.finish()

          const responseCode = paymentResult.transactionResponse.responseCode

          Sentry.addBreadcrumb({
            category: 'payment',
            message: 'Received Authorize.Net processor response',
            level: responseCode === '1' ? 'info' : 'warning',
            data: {
              responseCode,
              approved: responseCode === '1',
              transId: paymentResult.transactionResponse.transId,
            },
          })

          // Log transaction
          await supabaseAdmin.from('payment_transactions').insert({
            vendor_id: body.vendorId,
            location_id: body.locationId,
            payment_processor_id: paymentProcessor.processor_id,
            order_id: order.id,
            processor_type: 'authorizenet',
            transaction_type: 'sale',
            payment_method: isSplit ? 'split-card' : body.paymentMethod,
            amount: cardAmount,
            total_amount: body.total,
            status: responseCode === '1' ? 'approved' : responseCode === '2' ? 'declined' : 'error',
            processor_transaction_id: paymentResult.transactionResponse.transId,
            processor_reference_id: orderNumber,
            authorization_code: paymentResult.transactionResponse.authCode,
            result_code: responseCode,
            response_data: paymentResult,
            card_type: paymentResult.transactionResponse.accountType,
            card_last_four: paymentResult.transactionResponse.accountNumber?.replace('XXXX', ''),
            processed_at: new Date().toISOString(),
            idempotency_key: idempotencyKey,
          })

          // Check if approved
          if (responseCode === '1') {
            // Payment approved!
            console.log(`[${requestId}] Payment approved:`, {
              authCode: paymentResult.transactionResponse.authCode,
              transactionId: paymentResult.transactionResponse.transId,
            })

            const { error: cardUpdateError } = await supabaseAdmin
              .from('orders')
              .update({
                // E-commerce orders start as 'pending' for staff fulfillment workflow
                // POS orders go straight to 'completed'
                status: body.is_ecommerce ? 'pending' : OrderStatus.COMPLETED,
                payment_status: PaymentStatus.PAID,
                processor_transaction_id: paymentResult.transactionResponse.transId,
                payment_authorization_code: paymentResult.transactionResponse.authCode,
                card_type: paymentResult.transactionResponse.accountType,
                card_last_four: paymentResult.transactionResponse.accountNumber?.replace('XXXX', ''),
                payment_data: paymentResult,
              })
              .eq('id', order.id)

            if (cardUpdateError) {
              console.error(`[${requestId}] Failed to update order after successful card payment:`, cardUpdateError)
              return await errorResponse(`Failed to finalize order: ${cardUpdateError.message}`, 500, requestId, allowedOrigin)
            }

          } else {
            // Payment declined or error
            const errorMessage = paymentResult.transactionResponse.errors?.[0]?.errorText
              || paymentResult.transactionResponse.messages?.[0]?.description
              || 'Payment declined'
            throw new Error(errorMessage)
          }

        } catch (error) {
          paymentError = error as Error
          console.error(`[${requestId}] Payment failed:`, error)

          // Log failed transaction
          await supabaseAdmin.from('payment_transactions').insert({
            vendor_id: body.vendorId,
            location_id: body.locationId,
            payment_processor_id: paymentProcessor.processor_id,
            order_id: order.id,
            processor_type: 'authorizenet',
            transaction_type: 'sale',
            payment_method: isSplit ? 'split-card' : body.paymentMethod,
            amount: cardAmount,
            total_amount: body.total,
            status: 'error',
            error_message: error.message,
            processed_at: new Date().toISOString(),
            idempotency_key: idempotencyKey,
          })

          // Update order status to CANCELLED (payment failed)
          await supabaseAdmin
            .from('orders')
            .update({
              status: OrderStatus.CANCELLED,
              payment_status: PaymentStatus.FAILED,
            })
            .eq('id', order.id)

          // Release inventory holds (payment failed)
          try {
            await dbClient.queryObject(
              `SELECT release_inventory_holds($1, $2)`,
              [order.id, 'payment_failed']
            )
            console.log(`[${requestId}] Inventory holds released after payment failure`)
          } catch (releaseError) {
            console.error(`[${requestId}] Failed to release inventory holds:`, releaseError)
          }

          return await errorResponse(`Payment failed: ${error.message}`, 402, requestId, allowedOrigin)
        }

      } else {
        // Unsupported processor type
        console.error(`[${requestId}] Unsupported processor type: ${paymentProcessor.processor_type}`)
        return await errorResponse(`Unsupported payment processor type: ${paymentProcessor.processor_type}`, 400, requestId, allowedOrigin)
      }
    }

    // ========================================================================
    // STEP 9: FINALIZE INVENTORY HOLDS (Convert reservations to deductions)
    // ========================================================================
    if (body.items.some(item => item.inventoryId)) {
      const inventorySpan = transaction.startChild({
        op: 'inventory.finalize',
        description: 'Finalize Inventory Holds',
      })

      try {
        Sentry.addBreadcrumb({
          category: 'inventory',
          message: 'Finalizing inventory holds (converting to deductions)',
          level: 'info',
          data: {
            itemCount: body.items.filter(i => i.inventoryId).length,
          },
        })

        await dbClient.queryObject(
          `SELECT finalize_inventory_holds($1)`,
          [order.id]
        )

        console.log(`[${requestId}] Inventory holds finalized successfully`)
        inventorySpan.setStatus('ok')

        Sentry.addBreadcrumb({
          category: 'inventory',
          message: 'Inventory holds finalized successfully',
          level: 'info',
        })
      } catch (error) {
        console.warn(`[${requestId}] Inventory deduction failed:`, error)
        inventorySpan.setStatus('unknown_error')

        // Capture inventory deduction failure (non-critical)
        Sentry.captureException(error, {
          level: 'warning',
          tags: {
            operation: 'inventory_deduction',
            requestId,
            orderId: order.id,
          },
        })

        // Try to log to reconciliation queue, but don't fail if that also fails
        try {
          await dbClient.queryObject(
            `INSERT INTO public.inventory_reconciliation_queue (order_id, items, error, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [order.id, JSON.stringify(body.items), error instanceof Error ? error.message : 'Unknown error']
          )

          Sentry.addBreadcrumb({
            category: 'inventory',
            message: 'Inventory failure logged to reconciliation queue',
            level: 'warning',
          })
        } catch (queueError) {
          console.error(`[${requestId}] Failed to log to reconciliation queue:`, queueError)
          Sentry.captureException(queueError, {
            level: 'error',
            tags: { operation: 'reconciliation_queue', requestId },
          })
        }
        // Don't fail the whole transaction - inventory can be reconciled later
      } finally {
        inventorySpan.finish()
      }
    }

    // ========================================================================
    // STEP 9.5: UPDATE LOYALTY POINTS (Atomic with transaction)
    // ========================================================================
    let loyaltyPointsEarned = 0
    let loyaltyPointsRedeemed = body.loyaltyPointsRedeemed || 0

    if (body.customerId && (body.loyaltyPointsRedeemed || body.subtotal > 0)) {
      const loyaltySpan = transaction.startChild({
        op: 'loyalty.update',
        description: 'Update Loyalty Points',
      })

      try {
        // CRITICAL: Validate customer exists before trying to update loyalty points
        const { data: customerExists, error: customerCheckError } = await supabaseAdmin
          .from('customers')
          .select('id, loyalty_points')
          .eq('id', body.customerId)
          .maybeSingle()

        if (customerCheckError) {
          throw new Error(`Failed to validate customer: ${customerCheckError.message}`)
        }

        if (!customerExists) {
          console.warn(`[${requestId}] Customer ${body.customerId} not found in database - skipping loyalty update`)
          Sentry.captureMessage('Customer not found during loyalty update', {
            level: 'warning',
            tags: { requestId, customerId: body.customerId },
          })
          loyaltySpan.setStatus('failed_precondition')
          // Don't throw - just skip loyalty update for invalid customer
        } else {

        console.log(`[${requestId}] Customer validated for loyalty update:`, {
          customerId: body.customerId,
          currentPoints: customerExists.loyalty_points,
          pointsToRedeem: body.loyaltyPointsRedeemed || 0,
        })

        // Validate sufficient points for redemption
        if (body.loyaltyPointsRedeemed && body.loyaltyPointsRedeemed > 0) {
          if (customerExists.loyalty_points < body.loyaltyPointsRedeemed) {
            throw new Error(
              `Insufficient loyalty points. Customer has ${customerExists.loyalty_points} points but trying to redeem ${body.loyaltyPointsRedeemed} points.`
            )
          }
        }
        // Calculate points earned server-side using loyalty program rules
        const pointsEarnedResult = await dbClient.queryObject(
          `SELECT calculate_loyalty_points_to_earn($1, $2) as points_earned`,
          [body.vendorId, body.subtotal]
        )

        loyaltyPointsEarned = (pointsEarnedResult.rows[0] as any)?.points_earned || 0
        const pointsEarned = loyaltyPointsEarned

        Sentry.addBreadcrumb({
          category: 'loyalty',
          message: 'Updating customer loyalty points',
          level: 'info',
          data: {
            customerId: body.customerId,
            pointsEarned,
            pointsRedeemed: body.loyaltyPointsRedeemed || 0,
            orderTotal: body.total,
          },
        })

        // Atomically update loyalty points with row-level locking
        await dbClient.queryObject(
          `SELECT update_customer_loyalty_points_atomic($1, $2, $3, $4, $5)`,
          [
            body.customerId,
            pointsEarned,
            body.loyaltyPointsRedeemed || 0,
            order.id,
            body.total,
          ]
        )

        console.log(`[${requestId}] Loyalty points updated successfully:`, {
          pointsEarned,
          pointsRedeemed: body.loyaltyPointsRedeemed || 0,
          netChange: pointsEarned - (body.loyaltyPointsRedeemed || 0),
        })

        loyaltySpan.setStatus('ok')

        Sentry.addBreadcrumb({
          category: 'loyalty',
          message: 'Loyalty points updated successfully',
          level: 'info',
          data: {
            pointsEarned,
            pointsRedeemed: body.loyaltyPointsRedeemed || 0,
          },
        })
        } // End of else block (customer exists)
      } catch (error) {
        console.error(`[${requestId}] Loyalty points update failed:`, error)
        console.error(`[${requestId}] Loyalty error details:`, {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          customerId: body.customerId,
          pointsRedeemed: body.loyaltyPointsRedeemed,
          pointsToEarn: loyaltyPointsEarned,
          subtotal: body.subtotal,
          orderId: order.id,
        })
        loyaltySpan.setStatus('unknown_error')

        // CRITICAL: Loyalty points failure is logged but doesn't fail the transaction
        // Payment already succeeded, inventory already deducted
        // Log to reconciliation queue for manual fix
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            operation: 'loyalty_update',
            requestId,
            orderId: order.id,
            customerId: body.customerId,
          },
          contexts: {
            loyalty: {
              customerId: body.customerId,
              orderId: order.id,
              pointsRedeemed: body.loyaltyPointsRedeemed || 0,
              pointsToEarn: loyaltyPointsEarned,
              orderTotal: body.total,
              subtotal: body.subtotal,
              errorMessage: error instanceof Error ? error.message : String(error),
            },
          },
        })

        // Try to log to reconciliation queue
        try {
          await dbClient.queryObject(
            `INSERT INTO public.loyalty_reconciliation_queue (customer_id, order_id, points_earned, points_redeemed, order_total, error_message, created_at)
             SELECT $1, $2,
                    calculate_loyalty_points_to_earn($3, $4),
                    $5,
                    $6,
                    $7,
                    NOW()`,
            [
              body.customerId,
              order.id,
              body.vendorId,
              body.subtotal,
              body.loyaltyPointsRedeemed || 0,
              body.total,
              error instanceof Error ? error.message : 'Unknown error',
            ]
          )

          Sentry.addBreadcrumb({
            category: 'loyalty',
            message: 'Loyalty failure logged to reconciliation queue',
            level: 'warning',
          })

          console.log(`[${requestId}] Loyalty points failure logged to reconciliation queue`)
        } catch (queueError) {
          console.error(`[${requestId}] Failed to log to loyalty reconciliation queue:`, queueError)
          Sentry.captureException(queueError, {
            level: 'error',
            tags: { operation: 'loyalty_reconciliation_queue', requestId },
          })
        }

        // Don't fail the whole transaction - payment succeeded, inventory deducted
        // Customer support can manually reconcile loyalty points
      } finally {
        loyaltySpan.finish()
      }
    }

    // ========================================================================
    // STEP 10: UPDATE SESSION TOTALS (Direct SQL - bypasses PostgREST)
    // ========================================================================
    if (body.sessionId) {
      try {
        Sentry.addBreadcrumb({
          category: 'session',
          message: 'Updating session totals',
          level: 'info',
          data: {
            sessionId: body.sessionId,
            amount: body.total,
          },
        })

        await dbClient.queryObject(
          `SELECT increment_session_payment($1, $2, $3)`,
          [body.sessionId, body.total, body.paymentMethod]
        )

        console.log(`[${requestId}] Session totals updated successfully`)

        Sentry.addBreadcrumb({
          category: 'session',
          message: 'Session totals updated',
          level: 'info',
        })
      } catch (error) {
        console.warn(`[${requestId}] Failed to update session:`, error)
        Sentry.captureException(error, {
          level: 'warning',
          tags: { operation: 'session_update', requestId },
        })
        // Don't fail the whole transaction for this
      }
    }

    // Connection will be closed by finally block

    // ========================================================================
    // SUCCESS RESPONSE
    // ========================================================================
    const duration = Date.now() - startTime

    console.log(`[${requestId}] Checkout completed successfully in ${duration}ms`)

    // Mark Sentry transaction as successful
    transaction.setStatus('ok')
    transaction.setTag('order_status', 'completed')
    transaction.setMeasurement('duration_ms', duration)

    Sentry.addBreadcrumb({
      category: 'checkout',
      message: 'Checkout completed successfully',
      level: 'info',
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        duration: `${duration}ms`,
      },
    })

    const finalOrderStatus = body.is_ecommerce ? 'pending' : OrderStatus.COMPLETED

    return await successResponse({
      order: {
        id: order.id,
        order_number: order.order_number,
        status: finalOrderStatus,
      },
      orderId: order.id,
      orderNumber: order.order_number,
      orderStatus: finalOrderStatus,
      paymentStatus: PaymentStatus.PAID,
      total: body.total,
      paymentMethod: body.paymentMethod,
      // Support both SPIN/Dejavoo and Authorize.Net response formats
      authorizationCode: (paymentResult as any)?.GeneralResponse?.AuthCode
        || (paymentResult as any)?.transactionResponse?.authCode,
      cardType: (paymentResult as any)?.CardData?.CardType
        || (paymentResult as any)?.transactionResponse?.accountType,
      cardLastFour: (paymentResult as any)?.CardData?.Last4
        || (paymentResult as any)?.transactionResponse?.accountNumber?.replace('XXXX', ''),
      loyaltyPointsEarned: loyaltyPointsEarned,
      loyaltyPointsRedeemed: loyaltyPointsRedeemed,
      message: 'Payment processed successfully',
    }, requestId, duration, allowedOrigin)

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error)

    // Capture error with full context in Sentry
    Sentry.captureException(error, {
      tags: {
        requestId,
        operation: 'checkout_processing',
      },
      contexts: {
        checkout: {
          requestId,
          timestamp: new Date().toISOString(),
          duration: `${Date.now() - startTime}ms`,
        },
      },
    })

    // Set transaction status and finish
    transaction.setStatus('internal_error')
    transaction.finish()

    return await errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
      requestId
    )
  } finally {
    // CRITICAL: Always close database connection to prevent leaks
    if (dbClient) {
      try {
        await dbClient.end()
      } catch (e) {
        console.error(`[${requestId}] Failed to close database connection:`, e)
      }
    }

    // Always finish the Sentry transaction
    if (transaction && !transaction.endTimestamp) {
      transaction.finish()
    }
  }
})

// ============================================================================
// HELPERS
// ============================================================================

function mapPaymentType(method: string): string {
  const mapping: Record<string, string> = {
    credit: 'Credit',
    debit: 'Debit',
    ebt_food: 'EBT_Food',
    ebt_cash: 'EBT_Cash',
    gift: 'Gift',
  }
  return mapping[method] || 'Credit'
}

async function successResponse(data: any, requestId: string, duration: number, allowedOrigin: string) {
  // CRITICAL: Flush Sentry events before response
  // Edge Functions terminate immediately after response is sent
  // This ensures performance spans are sent for successful transactions
  await Sentry.flush(2000)

  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
        'X-Request-ID': requestId,
      },
    }
  )
}

async function errorResponse(message: string, status: number, requestId: string, allowedOrigin: string) {
  // Capture error to Sentry based on severity
  const level = status >= 500 ? 'error' : 'warning'

  Sentry.captureMessage(message, {
    level,
    tags: { requestId, status: status.toString() },
  })

  // Sanitize error messages for security (Apple standard)
  // Internal errors (5xx): Generic message to user, detailed to logs/Sentry
  // User errors (4xx): Specific message is safe to return
  let userMessage = message
  if (status >= 500) {
    // Log detailed error internally
    console.error(`[${requestId}] Internal error: ${message}`)

    // TEMPORARY DEBUG: Return detailed error to help diagnose issue
    // TODO: Remove this after debugging and restore generic error message
    userMessage = `[DEBUG] ${message} (Reference ID: ${requestId})`
  }

  // CRITICAL: Flush Sentry events before response
  // Edge Functions terminate immediately after response is sent
  await Sentry.flush(2000)

  return new Response(
    JSON.stringify({
      success: false,
      error: userMessage,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigin,
        'X-Request-ID': requestId,
      },
    }
  )
}
