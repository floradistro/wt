import { create } from 'zustand'
import { useAuthStore } from './auth.store'

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

  // Actions
  checkStatus: async (locationId?: string, registerId?: string) => {
    const startTime = Date.now()
    const { isEnabled, locationId: storedLocationId, registerId: storedRegisterId, addActivityLog } = get()
    const targetLocationId = locationId || storedLocationId
    const _targetRegisterId = registerId || storedRegisterId

    // If not enabled, mark as disconnected
    if (!isEnabled) {
      set({
        status: 'disconnected',
        lastCheck: Date.now(),
        errorMessage: 'Payment processor not configured'
      })
      return
    }

    set({ status: 'checking' })

    try {
      // JOBS PRINCIPLE: Use whaletools payment processor health API
      // This checks all Dejavoo terminals at the current location
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

      if (!targetLocationId) {
        addActivityLog('error', 'No location selected')
        set({
          status: 'disconnected',
          lastCheck: Date.now(),
          errorMessage: 'No location selected',
        })
        return
      }

      // Get auth session for API authentication
      const session = useAuthStore.getState().session
      if (!session?.access_token) {
        addActivityLog('error', 'Authentication required')
        set({
          status: 'error',
          lastCheck: Date.now(),
          errorMessage: 'Authentication required',
        })
        return
      }

      const HEALTH_ENDPOINT = `${BASE_URL}/api/pos/payment-processors/health?locationId=${targetLocationId}`


      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()
        const results = data.results || []


        // JOBS PRINCIPLE: Filter to current register's processor only
        // Each register has one assigned processor
        let currentProcessor: ProcessorInfo | null = null

        // For now, use first processor if no registerId specified
        // In production, we'd filter by registerId from register data
        if (results.length > 0) {
          currentProcessor = results[0]
        }

        // Count online and total processors
        const onlineCount = results.filter((r: any) => r.is_live === true).length
        const totalCount = results.length
        const allOffline = totalCount > 0 && results.every((r: any) => r.is_live === false)

        if (onlineCount > 0) {

          addActivityLog('health_check', 'Health check successful', {
            is_live: true,
            duration_ms: duration
          })

          if (currentProcessor?.is_live) {
            addActivityLog('success', `${currentProcessor.processor_name || 'Terminal'} online`, {
              is_live: true,
              duration_ms: duration
            })
          }

          set({
            status: 'connected',
            lastCheck: Date.now(),
            errorMessage: null,
            processors: results,
            currentProcessor,
            onlineCount,
            totalCount,
          })
        } else if (allOffline) {
          const errors = results
            .filter((r: any) => r.error)
            .map((r: any) => r.error)
            .join(', ')


          addActivityLog('error', 'All processors offline', {
            is_live: false,
            duration_ms: duration
          })

          set({
            status: 'error',
            lastCheck: Date.now(),
            errorMessage: errors || 'All processors offline',
            processors: results,
            currentProcessor: null,
            onlineCount: 0,
            totalCount,
          })
        } else {
          // No processors configured

          addActivityLog('error', 'No processors configured')

          set({
            status: 'disconnected',
            lastCheck: Date.now(),
            errorMessage: 'No processors configured',
            processors: [],
            currentProcessor: null,
            onlineCount: 0,
            totalCount: 0,
          })
        }
      } else {
        const errorText = await response.text()
        console.error('❌ Health check failed:', response.status, errorText)

        addActivityLog('error', `Health check failed: ${response.status}`, {
          is_live: false,
          duration_ms: duration
        })

        set({
          status: 'error',
          lastCheck: Date.now(),
          errorMessage: `Health check failed: ${response.status}`,
        })
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      // JOBS: Distinguish between timeout and network errors
      const isTimeout = error.name === 'AbortError'
      const errorMsg = isTimeout ? 'Health check timeout (5s)' : (error.message || 'Connection failed')

      addActivityLog('error', errorMsg, {
        is_live: false,
        duration_ms: duration
      })

      set({
        status: 'error',
        lastCheck: Date.now(),
        errorMessage: errorMsg,
      })
    }
  },

  // JOBS PRINCIPLE: Test terminal with small transaction to verify it works
  sendTestTransaction: async () => {
    const startTime = Date.now()
    const { currentProcessor, addActivityLog } = get()

    if (!currentProcessor) {
      addActivityLog('error', 'No processor available for testing')
      return { success: false, message: 'No processor configured' }
    }

    addActivityLog('health_check', 'Sending test transaction...')

    try {
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
      const session = useAuthStore.getState().session

      if (!session?.access_token) {
        addActivityLog('error', 'Authentication required')
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
          return { success: true, message: 'Test successful' }
        } else {
          addActivityLog('error', `Test declined: ${data.message || 'Unknown error'}`, {
            is_live: false,
            duration_ms: duration
          })
          return { success: false, message: data.message || 'Test declined' }
        }
      } else {
        const errorText = await response.text()
        console.error('❌ Test transaction failed:', response.status, errorText)
        addActivityLog('error', `Test failed: ${response.status}`, {
          is_live: false,
          duration_ms: duration
        })
        return { success: false, message: `Test failed: ${response.status}` }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      const isTimeout = error.name === 'AbortError'
      const errorMsg = isTimeout ? 'Test timeout (30s)' : (error.message || 'Connection failed')

      console.error('❌ Test transaction error:', error)
      addActivityLog('error', errorMsg, {
        is_live: false,
        duration_ms: duration
      })

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

// JOBS PRINCIPLE: Auto-retry mechanism for bulletproof reliability
// Check status every 30 seconds when enabled
let statusCheckInterval: NodeJS.Timeout | null = null

export function startPaymentProcessorMonitoring(locationId?: string, registerId?: string) {
  if (statusCheckInterval) return

  // Initial check
  const { locationId: storedLocationId, registerId: storedRegisterId } = usePaymentProcessor.getState()
  const targetLocationId = locationId || storedLocationId
  const targetRegisterId = registerId || storedRegisterId

  if (targetLocationId) {
    usePaymentProcessor.getState().checkStatus(targetLocationId, targetRegisterId || undefined)
  }

  // Periodic checks every 30 seconds
  statusCheckInterval = setInterval(() => {
    const { isEnabled, locationId: currentLocationId, registerId: currentRegisterId } = usePaymentProcessor.getState()
    if (isEnabled && currentLocationId) {
      usePaymentProcessor.getState().checkStatus(currentLocationId, currentRegisterId || undefined)
    }
  }, 30000)
}

export function stopPaymentProcessorMonitoring() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval)
    statusCheckInterval = null
  }
}
