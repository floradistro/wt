/**
 * Settings UI Store - Modal Visibility & Selected Items
 * Apple Pattern: Centralized UI state management (no modal state as props)
 *
 * Similar to checkout-ui.store.ts in POS
 * Manages modal visibility and selected items for all Settings modals
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { UserWithLocations } from '@/types/users'
import type { Supplier } from '@/types/suppliers'
import type { PaymentProcessor } from '@/types/payment-processors'
import type { Campaign } from '@/types/campaigns'

export type SettingsModalType =
  // User Management Modals
  | 'addUser'
  | 'editUser'
  | 'setPassword'
  | 'assignLocations'
  // Supplier Management Modals
  | 'addSupplier'
  | 'editSupplier'
  // Payment Processor Modals
  | 'addProcessor'
  | 'editProcessor'
  // Campaign Modals
  | 'addCampaign'
  | 'editCampaign'
  | null

interface SettingsUIState {
  // Current active modal
  activeModal: SettingsModalType

  // Selected items for editing
  selectedUser: UserWithLocations | null
  selectedSupplier: Supplier | null
  selectedProcessor: PaymentProcessor | null
  selectedCampaign: Campaign | null
  selectedLocationId: string | null // For processor configuration

  // Actions
  openModal: (modal: SettingsModalType, item?: any, locationId?: string | null) => void
  closeModal: () => void
  reset: () => void
}

const initialState = {
  activeModal: null,
  selectedUser: null,
  selectedSupplier: null,
  selectedProcessor: null,
  selectedCampaign: null,
  selectedLocationId: null,
}

export const useSettingsUIStore = create<SettingsUIState>()(
  devtools(
    (set) => ({
      ...initialState,

      openModal: (modal, item = null, locationId = null) => {
        set((state) => {
          const updates: Partial<SettingsUIState> = {
            activeModal: modal,
            selectedLocationId: locationId,
          }

          // Set the appropriate selected item based on modal type
          if (modal === 'addUser' || modal === 'editUser' ||
              modal === 'setPassword' || modal === 'assignLocations') {
            updates.selectedUser = item
          } else if (modal === 'addSupplier' || modal === 'editSupplier') {
            updates.selectedSupplier = item
          } else if (modal === 'addProcessor' || modal === 'editProcessor') {
            updates.selectedProcessor = item
          } else if (modal === 'addCampaign' || modal === 'editCampaign') {
            updates.selectedCampaign = item
          }

          return updates as SettingsUIState
        })
      },

      closeModal: () => set(initialState),

      reset: () => set(initialState),
    }),
    { name: 'SettingsUIStore' }
  )
)

// ============================================================================
// FOCUSED SELECTORS (with useShallow to prevent infinite loops)
// ============================================================================

/**
 * Get the current active modal
 * Returns null if no modal is open
 */
export const useActiveModal = () =>
  useSettingsUIStore((state) => state.activeModal)

/**
 * Get the selected user for editing
 */
export const useSelectedUser = () =>
  useSettingsUIStore((state) => state.selectedUser)

/**
 * Get the selected supplier for editing
 */
export const useSelectedSupplier = () =>
  useSettingsUIStore((state) => state.selectedSupplier)

/**
 * Get the selected payment processor for editing
 */
export const useSelectedProcessor = () =>
  useSettingsUIStore((state) => state.selectedProcessor)

/**
 * Get the selected campaign for editing
 */
export const useSelectedCampaign = () =>
  useSettingsUIStore((state) => state.selectedCampaign)

/**
 * Get the selected location ID (for processor configuration)
 */
export const useSelectedLocationId = () =>
  useSettingsUIStore((state) => state.selectedLocationId)

/**
 * Get all UI actions (openModal, closeModal)
 * CRITICAL: Uses useShallow to prevent infinite loops
 */
export const useSettingsUIActions = () =>
  useSettingsUIStore(
    useShallow((state) => ({
      openModal: state.openModal,
      closeModal: state.closeModal,
    }))
  )

/**
 * Convenience hook: Check if a specific modal is open
 */
export const useIsModalOpen = (modalType: SettingsModalType) =>
  useSettingsUIStore((state) => state.activeModal === modalType)
