/**
 * Inventory Transfers Store
 *
 * Manages inventory transfers state with real-time updates
 * - Optimistic UI updates for instant feedback
 * - Real-time Supabase subscriptions
 * - No prop drilling - components read directly from store
 */

import { create } from 'zustand'
import { supabase } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  InventoryTransfer,
  TransferStatus,
  CreateTransferInput,
  ReceiveTransferInput,
} from '@/types/pos'
import * as transferService from '@/services/inventory-transfers.service'

interface TransfersState {
  // Data
  transfers: InventoryTransfer[]
  stats: {
    total: number
    draft: number
    in_transit: number
    completed: number
  }

  // UI State
  loading: boolean
  error: string | null
  statusFilter: TransferStatus | 'all'

  // Real-time subscription
  subscription: RealtimeChannel | null

  // Actions
  loadTransfers: (
    vendorId: string,
    filters?: {
      status?: TransferStatus
      source_location_id?: string
      destination_location_id?: string
    }
  ) => Promise<void>
  createTransfer: (
    vendorId: string,
    input: CreateTransferInput,
    userId?: string
  ) => Promise<string>
  createAndShipTransfer: (
    vendorId: string,
    input: CreateTransferInput,
    trackingNumber?: string,
    userId?: string
  ) => Promise<string>
  approveTransfer: (transferId: string, userId?: string) => Promise<void>
  markInTransit: (transferId: string, trackingNumber?: string) => Promise<void>
  completeTransfer: (
    transferId: string,
    input: ReceiveTransferInput,
    userId?: string
  ) => Promise<void>
  cancelTransfer: (
    transferId: string,
    reason?: string,
    userId?: string
  ) => Promise<void>
  updateTransferNotes: (transferId: string, notes: string) => Promise<void>
  deleteDraftTransfer: (transferId: string) => Promise<void>

  // Optimistic updates
  addTransfer: (transfer: InventoryTransfer) => void
  updateTransfer: (transferId: string, updates: Partial<InventoryTransfer>) => void
  removeTransfer: (transferId: string) => void

  // Filter
  setStatusFilter: (status: TransferStatus | 'all') => void

  // Real-time
  subscribe: (vendorId: string) => void
  unsubscribe: () => void
  reset: () => void
}

const initialState = {
  transfers: [],
  stats: {
    total: 0,
    draft: 0,
    in_transit: 0,
    completed: 0,
  },
  loading: false,
  error: null,
  statusFilter: 'all' as TransferStatus | 'all',
  subscription: null,
}

/**
 * Calculate stats from transfers array
 */
function calculateStats(transfers: InventoryTransfer[]) {
  return {
    total: transfers.length,
    draft: transfers.filter((t) => t.status === 'draft').length,
    in_transit: transfers.filter((t) => t.status === 'in_transit').length,
    completed: transfers.filter((t) => t.status === 'completed').length,
  }
}

export const useTransfersStore = create<TransfersState>((set, get) => ({
  ...initialState,

  loadTransfers: async (vendorId, filters) => {
    set({ loading: true, error: null })

    try {
      const transfers = await transferService.fetchTransfers(vendorId, filters)
      const stats = calculateStats(transfers)

      set({
        transfers,
        stats,
        loading: false,
      })

      console.log('[TransfersStore] Transfers loaded', {
        count: transfers.length,
        stats,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load transfers'
      console.error('[TransfersStore] Failed to load transfers', error)
      set({ error: message, loading: false })
    }
  },

  createTransfer: async (vendorId, input, userId) => {
    try {
      const transferId = await transferService.createTransfer(
        vendorId,
        input,
        userId
      )

      // Real-time will handle adding the transfer to the list
      console.log('[TransfersStore] Transfer created', { transferId })
      return transferId
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create transfer'
      console.error('[TransfersStore] Failed to create transfer', error)
      set({ error: message })
      throw error
    }
  },

  createAndShipTransfer: async (vendorId: string, input: CreateTransferInput, trackingNumber?: string, userId?: string) => {
    try {
      const transferId = await transferService.createAndShipTransfer(
        vendorId,
        input,
        trackingNumber,
        userId
      )

      // Real-time will handle adding the transfer to the list
      console.log('[TransfersStore] Transfer created and shipped atomically', { transferId })
      return transferId
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create and ship transfer'
      console.error('[TransfersStore] Failed to create and ship transfer', error)
      set({ error: message })
      throw error
    }
  },

  approveTransfer: async (transferId, userId) => {
    try {
      // Optimistic update
      get().updateTransfer(transferId, { status: 'approved' })

      await transferService.approveTransfer(transferId, userId)

      console.log('[TransfersStore] Transfer approved', { transferId })
    } catch (error) {
      // Revert on error - reload from server
      const vendorId = get().transfers[0]?.vendor_id
      if (vendorId) {
        await get().loadTransfers(vendorId)
      }

      const message =
        error instanceof Error ? error.message : 'Failed to approve transfer'
      console.error('[TransfersStore] Failed to approve transfer', error)
      set({ error: message })
      throw error
    }
  },

  markInTransit: async (transferId, trackingNumber) => {
    try {
      // No optimistic update - let real-time handle it to avoid duplicates
      await transferService.markTransferInTransit(transferId, trackingNumber)

      console.log('[TransfersStore] Transfer marked in transit', { transferId })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to mark transfer in transit'
      console.error('[TransfersStore] Failed to mark in transit', error)
      set({ error: message })
      throw error
    }
  },

  completeTransfer: async (transferId, input, userId) => {
    try {
      // Optimistic update
      get().updateTransfer(transferId, { status: 'completed' })

      const result = await transferService.completeTransfer(
        transferId,
        input,
        userId
      )

      console.log('[TransfersStore] Transfer completed', {
        transferId,
        result,
      })

      // Reload to get updated inventory
      const vendorId = get().transfers[0]?.vendor_id
      if (vendorId) {
        await get().loadTransfers(vendorId)
      }
    } catch (error) {
      // Revert on error
      const vendorId = get().transfers[0]?.vendor_id
      if (vendorId) {
        await get().loadTransfers(vendorId)
      }

      const message =
        error instanceof Error ? error.message : 'Failed to complete transfer'
      console.error('[TransfersStore] Failed to complete transfer', error)
      set({ error: message })
      throw error
    }
  },

  cancelTransfer: async (transferId, reason, userId) => {
    try {
      // Optimistic update
      get().updateTransfer(transferId, { status: 'cancelled' })

      await transferService.cancelTransfer(transferId, reason, userId)

      console.log('[TransfersStore] Transfer cancelled', { transferId })
    } catch (error) {
      // Revert on error
      const vendorId = get().transfers[0]?.vendor_id
      if (vendorId) {
        await get().loadTransfers(vendorId)
      }

      const message =
        error instanceof Error ? error.message : 'Failed to cancel transfer'
      console.error('[TransfersStore] Failed to cancel transfer', error)
      set({ error: message })
      throw error
    }
  },

  updateTransferNotes: async (transferId, notes) => {
    try {
      // Optimistic update
      get().updateTransfer(transferId, { notes })

      await transferService.updateTransferNotes(transferId, notes)

      console.log('[TransfersStore] Transfer notes updated', { transferId })
    } catch (error) {
      // Revert on error
      const vendorId = get().transfers[0]?.vendor_id
      if (vendorId) {
        await get().loadTransfers(vendorId)
      }

      const message =
        error instanceof Error ? error.message : 'Failed to update notes'
      console.error('[TransfersStore] Failed to update notes', error)
      set({ error: message })
      throw error
    }
  },

  deleteDraftTransfer: async (transferId) => {
    try {
      // Optimistic update
      get().removeTransfer(transferId)

      await transferService.deleteDraftTransfer(transferId)

      console.log('[TransfersStore] Draft transfer deleted', { transferId })
    } catch (error) {
      // Revert on error
      const vendorId = get().transfers[0]?.vendor_id
      if (vendorId) {
        await get().loadTransfers(vendorId)
      }

      const message =
        error instanceof Error ? error.message : 'Failed to delete transfer'
      console.error('[TransfersStore] Failed to delete transfer', error)
      set({ error: message })
      throw error
    }
  },

  // Filter
  setStatusFilter: (status) => {
    set({ statusFilter: status })
    console.log('[TransfersStore] Status filter changed', { status })
  },

  // Optimistic updates
  addTransfer: (transfer) => {
    set((state) => {
      const transfers = [transfer, ...state.transfers]
      return {
        transfers,
        stats: calculateStats(transfers),
      }
    })

    console.log('[TransfersStore] Transfer added optimistically', {
      transferId: transfer.id,
    })
  },

  updateTransfer: (transferId, updates) => {
    set((state) => {
      const index = state.transfers.findIndex((t) => t.id === transferId)
      if (index === -1) return state

      const transfers = [...state.transfers]
      transfers[index] = { ...transfers[index], ...updates }

      return {
        transfers,
        stats: calculateStats(transfers),
      }
    })

    console.log('[TransfersStore] Transfer updated optimistically', {
      transferId,
      updates,
    })
  },

  removeTransfer: (transferId) => {
    set((state) => {
      const transfers = state.transfers.filter((t) => t.id !== transferId)
      return {
        transfers,
        stats: calculateStats(transfers),
      }
    })

    console.log('[TransfersStore] Transfer removed optimistically', {
      transferId,
    })
  },

  // Real-time subscriptions
  subscribe: (vendorId) => {
    const { subscription } = get()

    // Unsubscribe if already subscribed
    if (subscription) {
      subscription.unsubscribe()
    }

    console.log('[TransfersStore] Subscribing to transfers', { vendorId })

    const channel = supabase
      .channel(`inventory_transfers:vendor:${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_transfers',
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          console.log('[TransfersStore] Transfer INSERT', payload)
          const transfer =
            await transferService.fetchTransferById(payload.new.id)
          if (transfer) {
            get().addTransfer(transfer)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory_transfers',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          console.log('[TransfersStore] Transfer UPDATE', payload)
          get().updateTransfer(payload.new.id, payload.new as any)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'inventory_transfers',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          console.log('[TransfersStore] Transfer DELETE', payload)
          get().removeTransfer(payload.old.id)
        }
      )
      .subscribe()

    set({ subscription: channel })
  },

  unsubscribe: () => {
    const { subscription } = get()
    if (subscription) {
      console.log('[TransfersStore] Unsubscribing from transfers')
      subscription.unsubscribe()
      set({ subscription: null })
    }
  },

  reset: () => {
    const { subscription } = get()
    if (subscription) {
      subscription.unsubscribe()
    }
    set(initialState)
    console.log('[TransfersStore] Store reset')
  },
}))
