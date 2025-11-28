/**
 * Purchase Orders Store
 *
 * Manages purchase orders state with real-time updates
 * - Optimistic UI updates for instant feedback
 * - Real-time Supabase subscriptions
 * - No prop drilling - components read directly from store
 */

import { create } from 'zustand'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { PurchaseOrder, PurchaseOrderType, PurchaseOrderStatus } from '@/services/purchase-orders.service'
import { getPurchaseOrders, getPurchaseOrderStats } from '@/services/purchase-orders.service'

interface PurchaseOrdersState {
  // Data
  purchaseOrders: PurchaseOrder[]
  stats: {
    total: number
    draft: number
    pending: number
    received: number
    totalValue: number
  }

  // UI State
  loading: boolean
  error: string | null
  statusFilter: PurchaseOrderStatus | 'all'

  // Real-time subscription
  subscription: RealtimeChannel | null

  // Actions
  loadPurchaseOrders: (params?: { locationIds?: string[]; status?: PurchaseOrderStatus }) => Promise<void>
  addPurchaseOrder: (po: PurchaseOrder) => void
  updatePurchaseOrder: (poId: string, updates: Partial<PurchaseOrder>) => void
  removePurchaseOrder: (poId: string) => void
  setStatusFilter: (status: PurchaseOrderStatus | 'all') => void
  subscribe: (vendorId: string, locationIds?: string[]) => void
  unsubscribe: () => void
  reset: () => void
}

const initialState = {
  purchaseOrders: [],
  stats: {
    total: 0,
    draft: 0,
    pending: 0,
    received: 0,
    totalValue: 0,
  },
  loading: false,
  error: null,
  statusFilter: 'all' as PurchaseOrderStatus | 'all',
  subscription: null,
}

export const usePurchaseOrdersStore = create<PurchaseOrdersState>((set, get) => ({
  ...initialState,

  loadPurchaseOrders: async (params = {}) => {
    set({ loading: true, error: null })

    try {
      const pos = await getPurchaseOrders(params)
      const stats = await getPurchaseOrderStats(params)

      set({
        purchaseOrders: pos,
        stats,
        loading: false,
      })

      logger.info('[PurchaseOrdersStore] Purchase orders loaded', {
        count: pos.length,
        stats,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load purchase orders'
      logger.error('[PurchaseOrdersStore] Failed to load purchase orders', { error })
      set({ error: message, loading: false })
    }
  },

  addPurchaseOrder: (po: PurchaseOrder) => {
    set((state) => ({
      purchaseOrders: [po, ...state.purchaseOrders],
      stats: {
        ...state.stats,
        total: state.stats.total + 1,
        draft: po.status === 'draft' ? state.stats.draft + 1 : state.stats.draft,
        pending: po.status === 'pending' ? state.stats.pending + 1 : state.stats.pending,
        received: po.status === 'received' ? state.stats.received + 1 : state.stats.received,
        totalValue: state.stats.totalValue + (po.total_amount || 0),
      },
    }))

    logger.debug('[PurchaseOrdersStore] Purchase order added optimistically', {
      poId: po.id,
      status: po.status,
    })
  },

  updatePurchaseOrder: (poId: string, updates: Partial<PurchaseOrder>) => {
    set((state) => {
      const index = state.purchaseOrders.findIndex((po) => po.id === poId)
      if (index === -1) return state

      const updatedPOs = [...state.purchaseOrders]
      const oldPO = updatedPOs[index]
      updatedPOs[index] = { ...oldPO, ...updates }

      // Recalculate stats
      const stats = { ...state.stats }

      // Adjust stats if status changed
      if (updates.status && updates.status !== oldPO.status) {
        if (oldPO.status === 'draft') stats.draft--
        if (oldPO.status === 'pending') stats.pending--
        if (oldPO.status === 'received') stats.received--

        if (updates.status === 'draft') stats.draft++
        if (updates.status === 'pending') stats.pending++
        if (updates.status === 'received') stats.received++
      }

      // Adjust total value if changed
      if (updates.total_amount !== undefined) {
        stats.totalValue = stats.totalValue - (oldPO.total_amount || 0) + (updates.total_amount || 0)
      }

      return {
        purchaseOrders: updatedPOs,
        stats,
      }
    })

    logger.info('[PurchaseOrdersStore] Purchase order updated optimistically', {
      poId,
      updates,
    })
  },

  removePurchaseOrder: (poId: string) => {
    set((state) => {
      const po = state.purchaseOrders.find((p) => p.id === poId)
      if (!po) return state

      return {
        purchaseOrders: state.purchaseOrders.filter((p) => p.id !== poId),
        stats: {
          ...state.stats,
          total: state.stats.total - 1,
          draft: po.status === 'draft' ? state.stats.draft - 1 : state.stats.draft,
          pending: po.status === 'pending' ? state.stats.pending - 1 : state.stats.pending,
          received: po.status === 'received' ? state.stats.received - 1 : state.stats.received,
          totalValue: state.stats.totalValue - (po.total_amount || 0),
        },
      }
    })

    logger.info('[PurchaseOrdersStore] Purchase order removed optimistically', { poId })
  },

  setStatusFilter: (status: PurchaseOrderStatus | 'all') => {
    set({ statusFilter: status })
    logger.info('[PurchaseOrdersStore] Status filter changed', { status })
  },

  subscribe: (vendorId: string, locationIds?: string[]) => {
    // Unsubscribe from existing subscription
    get().unsubscribe()

    const channel = supabase
      .channel('purchase-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch full PO with relations
            const { data } = await supabase
              .from('purchase_orders')
              .select(`
                *,
                suppliers (id, external_name),
                wholesale_customers (id, external_company_name),
                locations (id, name),
                purchase_order_items (*)
              `)
              .eq('id', payload.new.id)
              .single()

            if (data) {
              get().addPurchaseOrder(data as PurchaseOrder)
            }
          } else if (payload.eventType === 'UPDATE') {
            get().updatePurchaseOrder(payload.new.id, payload.new as Partial<PurchaseOrder>)
          } else if (payload.eventType === 'DELETE') {
            get().removePurchaseOrder(payload.old.id)
          }
        }
      )
      .subscribe()

    set({ subscription: channel })
  },

  unsubscribe: () => {
    const { subscription } = get()
    if (subscription) {
      supabase.removeChannel(subscription)
      set({ subscription: null })
    }
  },

  reset: () => {
    get().unsubscribe()
    set(initialState)
    logger.info('[PurchaseOrdersStore] Store reset')
  },
}))

// Export actions for easy access
export const purchaseOrdersActions = {
  get loadPurchaseOrders() {
    return usePurchaseOrdersStore.getState().loadPurchaseOrders
  },
  get addPurchaseOrder() {
    return usePurchaseOrdersStore.getState().addPurchaseOrder
  },
  get updatePurchaseOrder() {
    return usePurchaseOrdersStore.getState().updatePurchaseOrder
  },
  get removePurchaseOrder() {
    return usePurchaseOrdersStore.getState().removePurchaseOrder
  },
  get setStatusFilter() {
    return usePurchaseOrdersStore.getState().setStatusFilter
  },
  get subscribe() {
    return usePurchaseOrdersStore.getState().subscribe
  },
  get unsubscribe() {
    return usePurchaseOrdersStore.getState().unsubscribe
  },
  get reset() {
    return usePurchaseOrdersStore.getState().reset
  },
}
