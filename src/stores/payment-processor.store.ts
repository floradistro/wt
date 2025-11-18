import { create } from 'zustand'
import { useAuthStore } from './auth.store'
import { Sentry } from '@/utils/sentry'
import { logger } from '@/utils/logger'

export type ProcessorStatus = 'connected' | 'disconnected' | 'error' | 'checking'

export interface ProcessorInfo {
  processor_id: string
  processor_name?: string
  processor_type?: string
  is_live: boolean
  error?: string
  last_checked?: string
}

export interface ActivityLog {
  timestamp: number
  type: 'health_check' | 'success' | 'error'
  message: string
  is_live?: boolean
  duration_ms?: number
}

interface ProcessorState {
  status: ProcessorStatus
  lastCheck: number | null
  errorMessage: string | null
  isEnabled: boolean
  locationId: string | null
  registerId: string | null
  processors: ProcessorInfo[]
  currentProcessor: ProcessorInfo | null
  onlineCount: number
  totalCount: number
  activityLog: ActivityLog[]
  consecutiveFailures: number
  lastSuccessTime: number | null
}

interface ProcessorActions {
  checkStatus: (locationId?: string, registerId?: string) => Promise<void>
  sendTestTransaction: () => Promise<{ success: boolean; message: string }>
  setEnabled: (enabled: boolean) => void
  setLocationId: (locationId: string | null) => void
  setRegisterId: (registerId: string | null) => void
  addActivityLog: (type: ActivityLog['type'], message: string, metadata?: Partial<ActivityLog>) => void
  reset: () => void
}

type ProcessorStore = ProcessorState & ProcessorActions

// JOBS PRINCIPLE: Mission-critical payment processor status tracking
// Bulletproof health monitoring with automatic retries
export const usePaymentProcessor = create<ProcessorStore>((set, get) => ({
  // State
  status: 'checking',
  lastCheck: null,
  errorMessage: null,
  isEnabled: true, // JOBS: Enabled by default - processors are live
  locationId: null,
  registerId: null,
  processors: [],
  currentProcessor: null,
  onlineCount: 0,
  totalCount: 0,
  activityLog: [],
  consecutiveFailures: 0,
  lastSuccessTime: null,

  // Actions
  checkStatus: async (locationId?: string, registerId?: string) => {
    logger.debug('🔍 checkStatus called', { locationId, registerId })
    const startTime = Date.now()
    const { isEnabled, locationId: storedLocationId, addActivityLog } = get()
    const targetLocationId = locationId || storedLocationId

    logger.debug('🔍 checkStatus state:', { isEnabled, targetLocationId })

    // Start Sentry transaction for health check monitoring
    // Note: startTransaction not available in current SDK version
    // const transaction = Sentry.startTransaction({
    //   name: 'processor_health_check',
    //   op: 'processor.health',
    // })

    // Set processor context
    Sentry.setContext('processor', {
      locationId: targetLocationId,
      registerId,
      isEnabled,
    })

    // Breadcrumb: Health check initiated
    Sentry.addBreadcrumb({
      category: 'processor',
      message: 'Health check initiated',
      level: 'info',
      data: {
        locationId: targetLocationId,
        registerId,
        isEnabled,
      },
    })

    // If not enabled, mark as disconnected
    if (!isEnabled) {
      logger.debug('🔍 Processor not enabled')
      Sentry.addBreadcrumb({
        category: 'processor',
        message: 'Processor not enabled',
        level: 'info',
      })
      // transaction.setStatus('cancelled')
      // transaction.setTag('processor.result', 'not_enabled')
      // transaction.finish()
      set({
        status: 'disconnected',
        lastCheck: Date.now(),
        errorMessage: 'Payment processor not configured'
      })
      return
    }

    if (!targetLocationId) {
      logger.debug('🔍 No location ID')
      Sentry.addBreadcrumb({
        category: 'processor',
        message: 'No location selected',
        level: 'warning',
      })
      // transaction.setStatus('cancelled')
      // transaction.setTag('processor.result', 'no_location')
      // transaction.finish()
      set({
        status: 'disconnected',
        lastCheck: Date.now(),
        errorMessage: 'No location selected'
      })
      return
    }

    set({ status: 'checking' })
    logger.debug('🔍 Status set to checking')

    Sentry.addBreadcrumb({
      category: 'processor',
      message: 'Starting health check',
      level: 'info',
    })

    try {
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
      const HEALTH_ENDPOINT = `${BASE_URL}/api/pos/payment-processors/health?locationId=${targetLocationId}`

      logger.debug('🔍 Calling health endpoint:', HEALTH_ENDPOINT)

      const controller = new AbortController()
      // 30 second timeout for health check (increased from 10s to handle backend + Dejavoo API latency)
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      // Get auth token from store
      const session = useAuthStore.getState().session
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`🔍 Health check failed: ${response.status} ${response.statusText}`, { errorText })
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      logger.debug('🔍 Raw response data:', JSON.stringify(data, null, 2))
      const duration = Date.now() - startTime

      logger.debug('🔍 Health check response:', data)

      // Map backend response to ProcessorInfo format
      const results = (data.results || []).map((r: any) => ({
        processor_id: r.processor_id,
        processor_name: r.processor_name || 'Terminal',
        processor_type: r.processor_type || 'dejavoo',
        is_live: r.is_live ?? false,
        error: r.error,
        last_checked: r.last_checked
      }))

      if (results.length === 0) {
        logger.debug('🔍 No processors configured')
        addActivityLog('error', 'No processors configured for this location')

        Sentry.addBreadcrumb({
          category: 'processor',
          message: 'No processors configured for location',
          level: 'warning',
          data: {
            locationId: targetLocationId,
          },
        })

        // transaction.setStatus('not_found')
        // transaction.setTag('processor.result', 'no_processors')
        // transaction.setMeasurement('health_check.duration', duration, 'millisecond')
        // transaction.finish()

        set({
          status: 'disconnected',
          lastCheck: Date.now(),
          errorMessage: 'No processors configured for this location',
          processors: [],
          currentProcessor: null,
          onlineCount: 0,
          totalCount: 0,
        })
        return
      }

      // Use the mapped results directly
      const currentProcessor = results[0] || null // Use first processor
      const onlineCount = results.filter((p: any) => p.is_live).length
      const totalCount = results.length

      logger.debug('🔍 Processor status:', { currentProcessor, onlineCount, totalCount })

      if (currentProcessor && currentProcessor.is_live) {
        addActivityLog('success', `${currentProcessor.processor_name} ready`, {
          is_live: true,
          duration_ms: duration
        })

        Sentry.addBreadcrumb({
          category: 'processor',
          message: 'Processor connected and ready',
          level: 'info',
          data: {
            processorName: currentProcessor.processor_name,
            processorType: currentProcessor.processor_type,
            onlineCount,
            totalCount,
          },
        })

        // transaction.setStatus('ok')
        // transaction.setTag('processor.result', 'connected')
        // transaction.setTag('processor.name', currentProcessor.processor_name || 'unknown')
        // transaction.setMeasurement('health_check.duration', duration, 'millisecond')
        // transaction.setMeasurement('processor.online_count', onlineCount, 'none')
        // transaction.finish()

        set({
          status: 'connected',
          lastCheck: Date.now(),
          errorMessage: null,
          processors: results,
          currentProcessor,
          onlineCount,
          totalCount,
          consecutiveFailures: 0,
          lastSuccessTime: Date.now(),
        })
      } else {
        const errorMsg = currentProcessor?.error || 'Terminal offline'
        addActivityLog('error', errorMsg, {
          is_live: false,
          duration_ms: duration
        })

        Sentry.addBreadcrumb({
          category: 'processor',
          message: 'Processor offline or unavailable',
          level: 'warning',
          data: {
            processorName: currentProcessor?.processor_name,
            errorMsg,
            onlineCount,
            totalCount,
          },
        })

        // transaction.setStatus('unavailable')
        // transaction.setTag('processor.result', 'offline')
        // transaction.setTag('processor.name', currentProcessor?.processor_name || 'unknown')
        // transaction.setMeasurement('health_check.duration', duration, 'millisecond')
        // transaction.setMeasurement('processor.online_count', onlineCount, 'none')
        // transaction.finish()

        set({
          status: 'disconnected',
          lastCheck: Date.now(),
          errorMessage: errorMsg,
          processors: results,
          currentProcessor,
          onlineCount,
          totalCount,
        })
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      const isTimeout = error.name === 'AbortError'
      const errorMsg = isTimeout ? 'Health check timeout' : (error.message || 'Failed to check processor status')

      logger.error('🔍 Error checking processor status:', error)

      addActivityLog('error', errorMsg, {
        is_live: false,
        duration_ms: duration
      })

      Sentry.addBreadcrumb({
        category: 'processor',
        message: `Health check error: ${errorMsg}`,
        level: 'error',
        data: {
          isTimeout,
          duration,
        },
      })

      // Capture exception in Sentry
      // transaction.setStatus('internal_error')
      // transaction.setTag('processor.result', 'error')
      // transaction.setTag('error.type', isTimeout ? 'timeout' : 'network_error')
      // transaction.setMeasurement('health_check.duration', duration, 'millisecond')

      Sentry.captureException(error, {
        level: isTimeout ? 'warning' : 'error',
        contexts: {
          processor: {
            locationId: targetLocationId,
            registerId,
            isEnabled,
            errorMsg,
            isTimeout,
            duration,
          },
        },
        tags: {
          'processor.operation': 'health_check',
          'error.type': isTimeout ? 'timeout' : 'network_error',
        },
      })

      // transaction.finish()

      set((state) => ({
        status: 'error',
        lastCheck: Date.now(),
        errorMessage: errorMsg,
        consecutiveFailures: state.consecutiveFailures + 1,
      }))
    }
  },

  // JOBS PRINCIPLE: Test terminal with small transaction to verify it works
  sendTestTransaction: async () => {
    const startTime = Date.now()
    const { currentProcessor, addActivityLog } = get()

    // Start Sentry span for test transaction monitoring
    const span = logger.startSpan('processor_test_transaction', 'processor.test')

    Sentry.setContext('processor', {
      processorId: currentProcessor?.processor_id,
      processorName: currentProcessor?.processor_name,
    })

    if (!currentProcessor) {
      addActivityLog('error', 'No processor available for testing')
      Sentry.addBreadcrumb({
        category: 'processor',
        message: 'No processor available for test',
        level: 'warning',
      })
      // transaction.setStatus('failed_precondition')
      // transaction.setTag('test.result', 'no_processor')
      // transaction.finish()
      return { success: false, message: 'No processor configured' }
    }

    addActivityLog('health_check', 'Sending test transaction...')

    Sentry.addBreadcrumb({
      category: 'processor',
      message: 'Starting test transaction',
      level: 'info',
      data: {
        processorName: currentProcessor.processor_name,
        amount: 1.00,
      },
    })

    try {
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
      const session = useAuthStore.getState().session

      if (!session?.access_token) {
        addActivityLog('error', 'Authentication required')
        Sentry.addBreadcrumb({
          category: 'processor',
          message: 'Authentication required for test',
          level: 'error',
        })
        // transaction.setStatus('unauthenticated')
        // transaction.setTag('test.result', 'no_auth')
        // transaction.finish()
        return { success: false, message: 'Authentication required' }
      }

      const TEST_ENDPOINT = `${BASE_URL}/api/pos/payment-processors/test`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout for test transactions

      const response = await fetch(TEST_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          processorId: currentProcessor.processor_id,
          amount: 1.00, // $1.00 test charge
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()

        if (data.success) {
          addActivityLog('success', 'Test transaction approved', {
            is_live: true,
            duration_ms: duration
          })
          Sentry.addBreadcrumb({
            category: 'processor',
            message: 'Test transaction successful',
            level: 'info',
            data: { duration },
          })
          // transaction.setStatus('ok')
          // transaction.setTag('test.result', 'success')
          // transaction.setMeasurement('test_transaction.duration', duration, 'millisecond')
          // transaction.finish()
          return { success: true, message: 'Test successful' }
        } else {
          addActivityLog('error', `Test declined: ${data.message || 'Unknown error'}`, {
            is_live: false,
            duration_ms: duration
          })
          Sentry.addBreadcrumb({
            category: 'processor',
            message: 'Test transaction declined',
            level: 'warning',
            data: { message: data.message, duration },
          })
          // transaction.setStatus('failed_precondition')
          // transaction.setTag('test.result', 'declined')
          // transaction.setMeasurement('test_transaction.duration', duration, 'millisecond')
          // transaction.finish()
          return { success: false, message: data.message || 'Test declined' }
        }
      } else {
        const errorText = await response.text()
        logger.error('❌ Test transaction failed:', response.status, errorText)
        addActivityLog('error', `Test failed: ${response.status}`, {
          is_live: false,
          duration_ms: duration
        })
        Sentry.addBreadcrumb({
          category: 'processor',
          message: `Test transaction failed: HTTP ${response.status}`,
          level: 'error',
          data: { httpStatus: response.status, duration },
        })
        // transaction.setStatus('internal_error')
        // transaction.setTag('test.result', 'api_error')
        // transaction.setTag('http.status_code', response.status.toString())
        // transaction.setMeasurement('test_transaction.duration', duration, 'millisecond')
        // transaction.finish()
        return { success: false, message: `Test failed: ${response.status}` }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      const isTimeout = error.name === 'AbortError'
      const errorMsg = isTimeout ? 'Test timeout (30s)' : (error.message || 'Connection failed')

      logger.error('❌ Test transaction error:', error)
      addActivityLog('error', errorMsg, {
        is_live: false,
        duration_ms: duration
      })

      Sentry.addBreadcrumb({
        category: 'processor',
        message: `Test transaction error: ${errorMsg}`,
        level: 'error',
        data: { isTimeout, duration },
      })

      // transaction.setStatus('internal_error')
      // transaction.setTag('test.result', 'error')
      // transaction.setTag('error.type', isTimeout ? 'timeout' : 'network_error')
      // transaction.setMeasurement('test_transaction.duration', duration, 'millisecond')

      Sentry.captureException(error, {
        level: isTimeout ? 'warning' : 'error',
        contexts: {
          processor: {
            processorId: currentProcessor.processor_id,
            processorName: currentProcessor.processor_name,
            errorMsg,
            isTimeout,
            duration,
          },
        },
        tags: {
          'processor.operation': 'test_transaction',
          'error.type': isTimeout ? 'timeout' : 'network_error',
        },
      })

      // transaction.finish()

      return { success: false, message: errorMsg }
    }
  },

  setEnabled: (enabled: boolean) => {
    set({ isEnabled: enabled })
    // Immediately check status when enabled
    if (enabled) {
      const { locationId } = get()
      if (locationId) {
        get().checkStatus(locationId)
      }
    } else {
      set({
        status: 'disconnected',
        errorMessage: 'Payment processor disabled'
      })
    }
  },

  setLocationId: (locationId: string | null) => {
    set({ locationId })
    // Auto-check when location changes
    if (locationId && get().isEnabled) {
      const { registerId } = get()
      get().checkStatus(locationId, registerId || undefined)
    }
  },

  setRegisterId: (registerId: string | null) => {
    set({ registerId })
    // Auto-check when register changes
    if (registerId && get().isEnabled) {
      const { locationId } = get()
      if (locationId) {
        get().checkStatus(locationId, registerId)
      }
    }
  },

  addActivityLog: (type: ActivityLog['type'], message: string, metadata?: Partial<ActivityLog>) => {
    const newLog: ActivityLog = {
      timestamp: Date.now(),
      type,
      message,
      ...metadata
    }

    set((state) => ({
      activityLog: [newLog, ...state.activityLog].slice(0, 20) // Keep last 20 activities
    }))
  },

  reset: () => {
    set({
      status: 'checking',
      lastCheck: null,
      errorMessage: null,
      activityLog: [],
    })
  },
}))

// JOBS PRINCIPLE: Auto-retry mechanism with exponential backoff
// Check status with adaptive intervals based on connection stability
let statusCheckInterval: NodeJS.Timeout | null = null

// Calculate backoff interval based on consecutive failures
// 30s → 60s → 2m → 5m (caps at 5 minutes)
function getCheckInterval(consecutiveFailures: number): number {
  const baseInterval = 30000 // 30 seconds
  const maxInterval = 300000 // 5 minutes

  if (consecutiveFailures === 0) return baseInterval
  if (consecutiveFailures === 1) return 60000 // 1 minute
  if (consecutiveFailures === 2) return 120000 // 2 minutes

  return Math.min(maxInterval, baseInterval * Math.pow(2, consecutiveFailures))
}

export function startPaymentProcessorMonitoring(locationId?: string, registerId?: string) {
  logger.debug('🔌 Starting payment processor monitoring', { locationId, registerId })
  if (statusCheckInterval) {
    logger.debug('🔌 Monitoring already running, stopping existing')
    clearTimeout(statusCheckInterval)
    statusCheckInterval = null
  }

  // Set location and register IDs in store
  if (locationId) {
    usePaymentProcessor.getState().setLocationId(locationId)
  }
  if (registerId) {
    usePaymentProcessor.getState().setRegisterId(registerId)
  }

  // Initial check
  const { locationId: storedLocationId, registerId: storedRegisterId } = usePaymentProcessor.getState()
  const targetLocationId = locationId || storedLocationId
  const targetRegisterId = registerId || storedRegisterId

  logger.debug('🔌 Target IDs:', { targetLocationId, targetRegisterId })

  if (targetLocationId) {
    logger.debug('🔌 Running initial processor check')
    usePaymentProcessor.getState().checkStatus(targetLocationId, targetRegisterId || undefined)
  } else {
    logger.debug('🔌 No location ID - skipping check')
  }

  // Schedule next check with adaptive interval
  const scheduleNextCheck = () => {
    const { isEnabled, locationId: currentLocationId, registerId: currentRegisterId, consecutiveFailures } = usePaymentProcessor.getState()
    const interval = getCheckInterval(consecutiveFailures)

    logger.debug('🔌 Scheduling next check:', {
      interval: `${interval/1000}s`,
      consecutiveFailures,
      isEnabled,
      currentLocationId
    })

    statusCheckInterval = setTimeout(async () => {
      if (isEnabled && currentLocationId) {
        logger.debug('🔌 Executing periodic check')
        await usePaymentProcessor.getState().checkStatus(currentLocationId, currentRegisterId || undefined)
        // Schedule next check after this one completes
        scheduleNextCheck()
      }
    }, interval)
  }

  // Start the adaptive checking cycle
  scheduleNextCheck()
}

export function stopPaymentProcessorMonitoring() {
  if (statusCheckInterval) {
    clearTimeout(statusCheckInterval)
    statusCheckInterval = null
  }
}
