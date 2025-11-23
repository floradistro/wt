/**
 * Checkout UI Store - Apple Engineering Standard
 *
 * Principle: Centralized UI state for checkout flow + TRUE ZERO PROPS modal management
 * Replaces: Scattered local state and prop drilling in POSCart/POSCheckout + all modal props
 *
 * Benefits:
 * - Zero prop drilling for UI state
 * - TRUE ZERO PROPS - modals read state and call actions directly from store
 * - No callbacks passed as props - all actions in Zustand
 * - Accessible anywhere in checkout flow
 * - Redux DevTools visibility
 * - Clean separation: business logic (cart.store) vs UI state (checkout-ui.store)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import * as Haptics from 'expo-haptics'
import type { Customer } from '@/types/pos'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import type { PaymentData, SaleCompletionData } from '@/components/pos/payment'
import { logger } from '@/utils/logger'

interface CheckoutUIState {
  // Campaign discount selection
  selectedDiscountId: string | null

  // Tier selector state
  tierSelectorProductId: string | null

  // Staff discount modal
  staffDiscountItemId: string | null

  // Discount selector visibility
  showDiscountSelector: boolean

  // Modal state (ANTI-LOOP: Simple state, no circular dependencies)
  activeModal: string | null
  modalData: Record<string, any> | null

  // Error modal state
  errorModal: {
    visible: boolean
    title: string
    message: string
  }

  // UI Actions
  setSelectedDiscountId: (discountId: string | null) => void
  setTierSelectorProductId: (productId: string | null) => void
  setStaffDiscountItemId: (itemId: string | null) => void
  setShowDiscountSelector: (show: boolean) => void
  openModal: (id: string, data?: any) => void
  closeModal: () => void
  isModalOpen: (id: string) => boolean
  setErrorModal: (visible: boolean, title?: string, message?: string) => void
  reset: () => void

}

const initialState = {
  selectedDiscountId: null,
  tierSelectorProductId: null,
  staffDiscountItemId: null,
  showDiscountSelector: false,
  activeModal: null,
  modalData: null,
  errorModal: {
    visible: false,
    title: '',
    message: '',
  },
}

export const useCheckoutUIStore = create<CheckoutUIState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Set selected campaign discount
       */
      setSelectedDiscountId: (discountId: string | null) => {
        set({ selectedDiscountId: discountId }, false, 'checkoutUI/setSelectedDiscountId')
      },

      /**
       * Set which product's tier selector is open
       */
      setTierSelectorProductId: (productId: string | null) => {
        set({ tierSelectorProductId: productId }, false, 'checkoutUI/setTierSelectorProductId')
      },

      /**
       * Set which cart item's staff discount modal is open
       */
      setStaffDiscountItemId: (itemId: string | null) => {
        set({ staffDiscountItemId: itemId }, false, 'checkoutUI/setStaffDiscountItemId')
      },

      /**
       * Toggle discount selector visibility
       */
      setShowDiscountSelector: (show: boolean) => {
        set({ showDiscountSelector: show }, false, 'checkoutUI/setShowDiscountSelector')
      },

      /**
       * Open a modal with optional data
       * ANTI-LOOP: Simple setState - no side effects
       */
      openModal: (id: string, data?: any) => {
        set({ activeModal: id, modalData: data || null }, false, 'checkoutUI/openModal')
      },

      /**
       * Close the active modal
       * ANTI-LOOP: Simple setState - no side effects
       */
      closeModal: () => {
        set({ activeModal: null, modalData: null }, false, 'checkoutUI/closeModal')
      },

      /**
       * Check if a specific modal is open
       * ANTI-LOOP: Pure function - no setState
       * Note: This is a method in the store, but it can't use get() when called externally
       * So we export a separate function below that uses getState()
       */
      isModalOpen: (id: string) => {
        return get().activeModal === id
      },

      /**
       * Set error modal state
       */
      setErrorModal: (visible: boolean, title = '', message = '') => {
        set(
          { errorModal: { visible, title, message } },
          false,
          'checkoutUI/setErrorModal'
        )
      },

      /**
       * Reset entire UI state (for checkout completion or cart clear)
       */
      reset: () => {
        set(initialState, false, 'checkoutUI/reset')
      },
    }),
    { name: 'CheckoutUIStore' }
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get selected discount ID
export const useSelectedDiscountId = () =>
  useCheckoutUIStore((state) => state.selectedDiscountId)

// Get tier selector product ID
export const useTierSelectorProductId = () =>
  useCheckoutUIStore((state) => state.tierSelectorProductId)

// Get staff discount item ID
export const useStaffDiscountItemId = () =>
  useCheckoutUIStore((state) => state.staffDiscountItemId)

// Get discount selector visibility
export const useShowDiscountSelector = () =>
  useCheckoutUIStore((state) => state.showDiscountSelector)

// Get active modal ID
export const useActiveModal = () =>
  useCheckoutUIStore((state) => state.activeModal)

// Get modal data
export const useModalData = () =>
  useCheckoutUIStore((state) => state.modalData)

// Get error modal state
export const useErrorModal = () =>
  useCheckoutUIStore((state) => state.errorModal)

// Export checkout UI actions as plain object (not a hook!)
export const checkoutUIActions = {
  get setSelectedDiscountId() { return useCheckoutUIStore.getState().setSelectedDiscountId },
  get setTierSelectorProductId() { return useCheckoutUIStore.getState().setTierSelectorProductId },
  get setStaffDiscountItemId() { return useCheckoutUIStore.getState().setStaffDiscountItemId },
  get setShowDiscountSelector() { return useCheckoutUIStore.getState().setShowDiscountSelector },
  get openModal() { return useCheckoutUIStore.getState().openModal },
  get closeModal() { return useCheckoutUIStore.getState().closeModal },
  get setErrorModal() { return useCheckoutUIStore.getState().setErrorModal },
  // isModalOpen is still available for non-reactive checks if needed
  isModalOpen: (id: string) => useCheckoutUIStore.getState().activeModal === id,
  get reset() { return useCheckoutUIStore.getState().reset },
}

// Legacy hook for backward compatibility
export const useCheckoutUIActions = () => checkoutUIActions

// Get all UI state (for components that need everything)
export const useCheckoutUIState = () => useCheckoutUIStore(
  useShallow((state) => ({
    selectedDiscountId: state.selectedDiscountId,
    tierSelectorProductId: state.tierSelectorProductId,
    showDiscountSelector: state.showDiscountSelector,
    activeModal: state.activeModal,
    modalData: state.modalData,
  }))
)
