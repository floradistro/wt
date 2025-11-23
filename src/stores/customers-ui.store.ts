/**
 * Customers UI Store - Apple Engineering Standard
 *
 * Principle: Global state for UI interactions eliminates prop drilling
 * Replaces: CustomersScreen + CustomerDetail local state
 *
 * Benefits:
 * - Zero callback props
 * - Centralized modal management
 * - Clean component hierarchy
 * - Single source of truth for UI state
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
import type { Customer } from '@/services/customers.service'
import { logger } from '@/utils/logger'

// ========================================
// TYPES
// ========================================
type ModalType = 'edit' | 'loyalty' | null

interface CustomersUIState {
  // Selection State
  selectedCustomer: Customer | null

  // UI State
  isEditMode: boolean
  activeModal: ModalType

  // Actions - Selection
  selectCustomer: (customer: Customer) => void
  clearSelection: () => void

  // Actions - Edit Mode
  toggleEditMode: () => void
  setEditMode: (enabled: boolean) => void

  // Actions - Modals
  openEditModal: () => void
  closeEditModal: () => void
  openLoyaltyModal: () => void
  closeLoyaltyModal: () => void
  closeAllModals: () => void

  // Internal
  reset: () => void
}

// ========================================
// STORE
// ========================================
const initialState = {
  selectedCustomer: null,
  isEditMode: false,
  activeModal: null as ModalType,
}

export const useCustomersUIStore = create<CustomersUIState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========================================
      // SELECTION ACTIONS
      // ========================================

      /**
       * Select a customer (opens detail panel)
       */
      selectCustomer: (customer: Customer) => {
        logger.debug('[CustomersUIStore] Customer selected:', customer.id)
        set({
          selectedCustomer: customer,
          isEditMode: false,
          activeModal: null,
        })
      },

      /**
       * Clear customer selection (closes detail panel)
       */
      clearSelection: () => {
        logger.debug('[CustomersUIStore] Selection cleared')
        set({
          selectedCustomer: null,
          isEditMode: false,
          activeModal: null,
        })
      },

      // ========================================
      // EDIT MODE ACTIONS
      // ========================================

      /**
       * Toggle edit mode
       */
      toggleEditMode: () => {
        const { isEditMode } = get()
        logger.debug('[CustomersUIStore] Toggling edit mode:', !isEditMode)
        set({ isEditMode: !isEditMode })
      },

      /**
       * Set edit mode explicitly
       */
      setEditMode: (enabled: boolean) => {
        logger.debug('[CustomersUIStore] Setting edit mode:', enabled)
        set({ isEditMode: enabled })
      },

      // ========================================
      // MODAL ACTIONS
      // ========================================

      /**
       * Open edit customer modal
       */
      openEditModal: () => {
        logger.debug('[CustomersUIStore] Opening edit modal')
        set({ activeModal: 'edit' })
      },

      /**
       * Close edit customer modal
       */
      closeEditModal: () => {
        logger.debug('[CustomersUIStore] Closing edit modal')
        set({ activeModal: null })
      },

      /**
       * Open loyalty points modal
       */
      openLoyaltyModal: () => {
        logger.debug('[CustomersUIStore] Opening loyalty modal')
        set({ activeModal: 'loyalty' })
      },

      /**
       * Close loyalty points modal
       */
      closeLoyaltyModal: () => {
        logger.debug('[CustomersUIStore] Closing loyalty modal')
        set({ activeModal: null })
      },

      /**
       * Close all modals
       */
      closeAllModals: () => {
        logger.debug('[CustomersUIStore] Closing all modals')
        set({ activeModal: null })
      },

      // ========================================
      // INTERNAL
      // ========================================

      /**
       * Reset store to initial state
       */
      reset: () => {
        logger.debug('[CustomersUIStore] Resetting to initial state')
        set(initialState)
      },
    }),
    { name: 'CustomersUIStore' }
  )
)

// ========================================
// SELECTORS (ANTI-LOOP: Use useShallow for objects)
// ========================================

/**
 * Get selected customer
 */
export const useSelectedCustomerUI = () =>
  useCustomersUIStore((state) => state.selectedCustomer)

/**
 * Get edit mode state
 */
export const useIsEditMode = () =>
  useCustomersUIStore((state) => state.isEditMode)

/**
 * Get active modal
 */
export const useActiveModal = () =>
  useCustomersUIStore((state) => state.activeModal)

/**
 * Get all UI state (for debugging)
 */
export const useCustomersUIState = () =>
  useCustomersUIStore(
    useShallow((state) => ({
      selectedCustomer: state.selectedCustomer,
      isEditMode: state.isEditMode,
      activeModal: state.activeModal,
    }))
  )

// ========================================
// ACTIONS (ANTI-LOOP: Export as plain object with getters)
// ========================================
export const customersUIActions = {
  get selectCustomer() {
    return useCustomersUIStore.getState().selectCustomer
  },
  get clearSelection() {
    return useCustomersUIStore.getState().clearSelection
  },
  get toggleEditMode() {
    return useCustomersUIStore.getState().toggleEditMode
  },
  get setEditMode() {
    return useCustomersUIStore.getState().setEditMode
  },
  get openEditModal() {
    return useCustomersUIStore.getState().openEditModal
  },
  get closeEditModal() {
    return useCustomersUIStore.getState().closeEditModal
  },
  get openLoyaltyModal() {
    return useCustomersUIStore.getState().openLoyaltyModal
  },
  get closeLoyaltyModal() {
    return useCustomersUIStore.getState().closeLoyaltyModal
  },
  get closeAllModals() {
    return useCustomersUIStore.getState().closeAllModals
  },
  get reset() {
    return useCustomersUIStore.getState().reset
  },
}
