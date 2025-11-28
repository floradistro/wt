/**
 * Customers List Store - Apple Engineering Standard
 *
 * Principle: Global state for customer data eliminates prop drilling
 * Replaces: useCustomers hook + CustomersScreen local state
 *
 * Benefits:
 * - Zero prop drilling for customer data
 * - Centralized CRUD operations
 * - Real-time Supabase subscriptions
 * - Search & filter state management
 * - Single source of truth
 *
 * ANTI-LOOP DESIGN:
 * - ✅ All selectors ONLY return values
 * - ✅ All mutations happen in actions
 * - ✅ useShallow for object returns
 * - ✅ Redux DevTools integration
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { customersService, type Customer } from '@/services/customers.service'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// ========================================
// TYPES
// ========================================
type NavFilter = 'all' | 'top-customers' | 'recent'

interface CustomersListState {
  // Data
  customers: Customer[]
  loading: boolean
  error: string | null
  currentController: AbortController | null

  // Search & Filter State
  searchQuery: string
  activeNav: NavFilter

  // Actions - Data Loading
  loadCustomers: (vendorId: string) => Promise<void>
  searchCustomers: (vendorId: string, term: string) => Promise<void>
  refresh: (vendorId: string) => Promise<void>
  cancelLoadCustomers: () => void

  // Actions - CRUD
  createCustomer: (vendorId: string, data: Partial<Customer>) => Promise<Customer>
  updateCustomer: (customerId: string, updates: Partial<Customer>) => Promise<Customer>
  updateLoyaltyPoints: (customerId: string, pointsChange: number) => Promise<void>
  deleteCustomer: (customerId: string) => Promise<void>

  // Actions - Search & Filter
  setSearchQuery: (query: string) => void
  setActiveNav: (nav: NavFilter) => void

  // Internal
  setupRealtimeSubscription: () => void
  cleanupRealtimeSubscription: () => void
  reset: () => void
}

// ========================================
// STORE
// ========================================
const initialState = {
  customers: [],
  loading: false,
  error: null,
  currentController: null,
  searchQuery: '',
  activeNav: 'all' as NavFilter,
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

export const useCustomersListStore = create<CustomersListState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========================================
      // DATA LOADING ACTIONS
      // ========================================

      /**
       * Cancel any in-flight customer loading request
       */
      cancelLoadCustomers: () => {
        const { currentController } = get()
        if (currentController) {
          logger.debug('[CustomersListStore] Aborting previous request')
          currentController.abort()
          set({ currentController: null })
        }
      },

      /**
       * Load all customers for vendor
       */
      loadCustomers: async (vendorId: string) => {
        // Cancel any previous request
        get().cancelLoadCustomers()

        // Create new AbortController for this request
        const controller = new AbortController()

        try {
          set({ loading: true, error: null, currentController: controller })

          logger.info('[CustomersListStore] Loading customers for vendor:', vendorId)

          const data = await customersService.getCustomers({ vendorId })

          // Check if request was aborted
          if (controller.signal.aborted) {
            logger.debug('[CustomersListStore] Request was aborted (expected)')
            return
          }

          set({ customers: data, loading: false, currentController: null })
          logger.info('[CustomersListStore] Loaded customers:', data.length)
        } catch (err) {
          // Don't set error state if request was just aborted
          if (err instanceof Error && err.name === 'AbortError') {
            logger.debug('[CustomersListStore] Request aborted (expected)')
            return
          }

          logger.error('[CustomersListStore] Failed to load customers:', err)
          set({
            error: err instanceof Error ? err.message : 'Failed to load customers',
            loading: false,
            currentController: null,
          })
        }
      },

      /**
       * Search customers by term
       */
      searchCustomers: async (vendorId: string, term: string) => {
        // Cancel any previous search
        get().cancelLoadCustomers()

        // Create new AbortController for this search
        const controller = new AbortController()

        try {
          set({ loading: true, error: null, currentController: controller })

          logger.info('[CustomersListStore] Searching customers:', term)

          const data = await customersService.searchCustomers(term, undefined, vendorId)

          // Check if request was aborted
          if (controller.signal.aborted) {
            logger.debug('[CustomersListStore] Search was aborted (expected)')
            return
          }

          set({ customers: data, loading: false, currentController: null })
          logger.info('[CustomersListStore] Search results:', data.length)
        } catch (err) {
          // Don't set error state if request was just aborted
          if (err instanceof Error && err.name === 'AbortError') {
            logger.debug('[CustomersListStore] Search aborted (expected)')
            return
          }

          logger.error('[CustomersListStore] Search failed:', err)
          set({
            error: err instanceof Error ? err.message : 'Search failed',
            loading: false,
            currentController: null,
          })
        }
      },

      /**
       * Refresh customer list
       */
      refresh: async (vendorId: string) => {
        const { searchQuery } = get()
        if (searchQuery.trim()) {
          await get().searchCustomers(vendorId, searchQuery)
        } else {
          await get().loadCustomers(vendorId)
        }
      },

      // ========================================
      // CRUD ACTIONS
      // ========================================

      /**
       * Create new customer
       */
      createCustomer: async (vendorId: string, data: Partial<Customer>) => {
        try {
          set({ loading: true, error: null })

          logger.info('[CustomersListStore] Creating customer:', data)

          const newCustomer = await customersService.createCustomer({
            ...data,
            vendor_id: vendorId,
          })

          // Add to state
          set((state) => ({
            customers: [newCustomer, ...state.customers],
            loading: false,
          }))

          logger.info('[CustomersListStore] Customer created:', newCustomer.id)
          return newCustomer
        } catch (err) {
          logger.error('[CustomersListStore] Create failed:', err)
          set({
            error: err instanceof Error ? err.message : 'Failed to create customer',
            loading: false,
          })
          throw err
        }
      },

      /**
       * Update existing customer
       */
      updateCustomer: async (customerId: string, updates: Partial<Customer>) => {
        try {
          set({ loading: true, error: null })

          logger.info('[CustomersListStore] Updating customer:', customerId)

          const updatedCustomer = await customersService.updateCustomer(customerId, updates)

          // Update in state
          set((state) => ({
            customers: state.customers.map((c) =>
              c.id === customerId ? updatedCustomer : c
            ),
            loading: false,
          }))

          logger.info('[CustomersListStore] Customer updated:', customerId)
          return updatedCustomer
        } catch (err) {
          logger.error('[CustomersListStore] Update failed:', err)
          set({
            error: err instanceof Error ? err.message : 'Failed to update customer',
            loading: false,
          })
          throw err
        }
      },

      /**
       * Update customer loyalty points
       */
      updateLoyaltyPoints: async (customerId: string, pointsChange: number) => {
        try {
          set({ loading: true, error: null })

          logger.info('[CustomersListStore] Updating loyalty points:', {
            customerId,
            pointsChange,
          })

          await customersService.updateCustomerLoyaltyPoints(customerId, pointsChange)

          // Update in state
          set((state) => ({
            customers: state.customers.map((c) =>
              c.id === customerId
                ? { ...c, loyalty_points: c.loyalty_points + pointsChange }
                : c
            ),
            loading: false,
          }))

          logger.info('[CustomersListStore] Loyalty points updated')
        } catch (err) {
          logger.error('[CustomersListStore] Loyalty update failed:', err)
          set({
            error: err instanceof Error ? err.message : 'Failed to update loyalty points',
            loading: false,
          })
          throw err
        }
      },

      /**
       * Delete customer (soft delete)
       */
      deleteCustomer: async (customerId: string) => {
        try {
          set({ loading: true, error: null })

          logger.info('[CustomersListStore] Deleting customer:', customerId)

          await customersService.deleteCustomer(customerId)

          // Remove from state
          set((state) => ({
            customers: state.customers.filter((c) => c.id !== customerId),
            loading: false,
          }))

          logger.info('[CustomersListStore] Customer deleted')
        } catch (err) {
          logger.error('[CustomersListStore] Delete failed:', err)
          set({
            error: err instanceof Error ? err.message : 'Failed to delete customer',
            loading: false,
          })
          throw err
        }
      },

      // ========================================
      // SEARCH & FILTER ACTIONS
      // ========================================

      /**
       * Set search query
       */
      setSearchQuery: (query: string) => {
        set({ searchQuery: query })
      },

      /**
       * Set active navigation filter
       */
      setActiveNav: (nav: NavFilter) => {
        set({ activeNav: nav })
      },

      // ========================================
      // REALTIME SUBSCRIPTION
      // ========================================

      /**
       * Setup Supabase realtime subscription
       */
      setupRealtimeSubscription: () => {
        logger.debug('[CustomersListStore] Setting up real-time subscription')

        realtimeChannel = supabase
          .channel('customers-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'customers',
            },
            (payload) => {
              logger.debug('[CustomersListStore] Real-time update:', payload)

              if (payload.eventType === 'UPDATE' && payload.new) {
                // Update existing customer
                set((state) => ({
                  customers: state.customers.map((c) =>
                    c.id === (payload.new as Customer).id
                      ? (payload.new as Customer)
                      : c
                  ),
                }))
              } else if (payload.eventType === 'INSERT' && payload.new) {
                // Add new customer
                set((state) => ({
                  customers: [(payload.new as Customer), ...state.customers],
                }))
              } else if (payload.eventType === 'DELETE' && payload.old) {
                // Remove deleted customer
                set((state) => ({
                  customers: state.customers.filter(
                    (c) => c.id !== (payload.old as any).id
                  ),
                }))
              }
            }
          )
          .subscribe()
      },

      /**
       * Cleanup realtime subscription
       */
      cleanupRealtimeSubscription: () => {
        if (realtimeChannel) {
          logger.debug('[CustomersListStore] Cleaning up real-time subscription')
          supabase.removeChannel(realtimeChannel)
          realtimeChannel = null
        }
      },

      /**
       * Reset store to initial state
       */
      reset: () => {
        get().cancelLoadCustomers()
        get().cleanupRealtimeSubscription()
        set(initialState)
      },
    }),
    { name: 'CustomersListStore' }
  )
)

// ========================================
// SELECTORS (ANTI-LOOP: Use useShallow for objects)
// ========================================

/**
 * Get all customers
 */
export const useCustomersList = () =>
  useCustomersListStore((state) => state.customers)

/**
 * Get loading state
 */
export const useCustomersLoading = () =>
  useCustomersListStore((state) => state.loading)

/**
 * Get error state
 */
export const useCustomersError = () =>
  useCustomersListStore((state) => state.error)

/**
 * Get search query
 */
export const useSearchQuery = () =>
  useCustomersListStore((state) => state.searchQuery)

/**
 * Get active navigation filter
 */
export const useActiveNavFilter = () =>
  useCustomersListStore((state) => state.activeNav)

/**
 * ❌ DELETED: useFilteredCustomers - Computed sorting/slicing in selector caused infinite re-renders
 *
 * ✅ USE THIS PATTERN INSTEAD in components:
 *
 * const customers = useCustomersList()
 * const activeNav = useActiveNavFilter()
 *
 * const filteredCustomers = useMemo(() => {
 *   const filtered = [...customers]
 *   switch (activeNav) {
 *     case 'top-customers':
 *       return filtered.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).slice(0, 50)
 *     case 'recent':
 *       return filtered.sort((a, b) =>
 *         new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
 *       ).slice(0, 50)
 *     default:
 *       return filtered.sort((a, b) => {
 *         const nameA = (a.full_name || a.first_name || '').toLowerCase()
 *         const nameB = (b.full_name || b.first_name || '').toLowerCase()
 *         return nameA.localeCompare(nameB)
 *       })
 *   }
 * }, [customers, activeNav])
 */

/**
 * Get grouped customers (alphabetically) for 'all' view
 * ✅ FIXED: Return primitive dependencies, compute in component with useMemo
 *
 * ANTI-LOOP: Cannot compute objects/arrays in selector - causes infinite loop
 * Instead: Return only the raw data needed, component will useMemo the grouping
 */
export const useGroupedCustomers = () => {
  const { customers, activeNav } = useCustomersListStore(
    useShallow((state) => ({
      customers: state.customers,
      activeNav: state.activeNav,
    }))
  )

  // Return raw data - component MUST use useMemo to compute groups
  // DO NOT compute here - selector runs on every state change
  return { customers, activeNav }
}

// ========================================
// ACTIONS (ANTI-LOOP: Export as plain object with getters)
// ========================================
export const customersListActions = {
  get loadCustomers() {
    return useCustomersListStore.getState().loadCustomers
  },
  get searchCustomers() {
    return useCustomersListStore.getState().searchCustomers
  },
  get refresh() {
    return useCustomersListStore.getState().refresh
  },
  get cancelLoadCustomers() {
    return useCustomersListStore.getState().cancelLoadCustomers
  },
  get createCustomer() {
    return useCustomersListStore.getState().createCustomer
  },
  get updateCustomer() {
    return useCustomersListStore.getState().updateCustomer
  },
  get updateLoyaltyPoints() {
    return useCustomersListStore.getState().updateLoyaltyPoints
  },
  get deleteCustomer() {
    return useCustomersListStore.getState().deleteCustomer
  },
  get setSearchQuery() {
    return useCustomersListStore.getState().setSearchQuery
  },
  get setActiveNav() {
    return useCustomersListStore.getState().setActiveNav
  },
  get setupRealtimeSubscription() {
    return useCustomersListStore.getState().setupRealtimeSubscription
  },
  get cleanupRealtimeSubscription() {
    return useCustomersListStore.getState().cleanupRealtimeSubscription
  },
  get reset() {
    return useCustomersListStore.getState().reset
  },
}
