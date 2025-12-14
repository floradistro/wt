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

// Modal stack entry for navigation history
interface ModalStackEntry {
  id: string
  data?: Record<string, any>
}

// Safety limit for modal stack depth (prevents memory leaks from infinite navigation)
const MAX_MODAL_STACK_DEPTH = 5

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
  // Now with stack for navigation history
  activeModal: string | null
  modalData: Record<string, any> | null
  modalStack: ModalStackEntry[]  // Stack for modal history
  modalSuspended: boolean  // True when modal is temporarily hidden (e.g., viewing order)

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
  pushModal: (id: string, data?: any) => void  // Push to stack, keep history
  closeModal: () => void
  popModal: () => void  // Pop from stack, return to previous
  suspendModal: () => void  // Temporarily hide modal (keeps state)
  resumeModal: () => void  // Show modal again after suspend
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
  modalStack: [] as ModalStackEntry[],
  modalSuspended: false,
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
       * Open a modal with optional data (clears stack - fresh start)
       * ANTI-LOOP: Simple setState - no side effects
       */
      openModal: (id: string, data?: any) => {
        set({ activeModal: id, modalData: data || null, modalStack: [] }, false, 'checkoutUI/openModal')
      },

      /**
       * Push a modal onto stack (saves current to history, opens new)
       * Modal visually closes then new one opens - no stacking
       * Use when opening a new modal FROM another modal
       *
       * Safety: Enforces MAX_MODAL_STACK_DEPTH to prevent memory issues
       */
      pushModal: (id: string, data?: any) => {
        const { activeModal, modalData, modalStack } = get()

        // Safety check: prevent infinite stack growth
        if (modalStack.length >= MAX_MODAL_STACK_DEPTH) {
          logger.warn(`[CheckoutUI] Modal stack depth limit reached (${MAX_MODAL_STACK_DEPTH}). Clearing stack.`)
          // Clear stack and open fresh - prevents memory issues
          set({ activeModal: id, modalData: data || null, modalStack: [] }, false, 'checkoutUI/pushModal')
          return
        }

        // Save current modal to stack for back navigation
        const newStack = activeModal
          ? [...modalStack, { id: activeModal, data: modalData || undefined }]
          : modalStack
        // Set new modal (old one closes, new one opens)
        set({ activeModal: id, modalData: data || null, modalStack: newStack }, false, 'checkoutUI/pushModal')
      },

      /**
       * Close the active modal (clears everything)
       * ANTI-LOOP: Simple setState - no side effects
       */
      closeModal: () => {
        set({ activeModal: null, modalData: null, modalStack: [] }, false, 'checkoutUI/closeModal')
      },

      /**
       * Pop modal from stack (return to previous modal)
       * Use when closing a modal that was pushed from another modal
       */
      popModal: () => {
        const { modalStack } = get()
        if (modalStack.length === 0) {
          // No stack - just close
          set({ activeModal: null, modalData: null, modalSuspended: false }, false, 'checkoutUI/popModal')
          return
        }
        // Pop last modal from stack
        const newStack = [...modalStack]
        const previousModal = newStack.pop()
        set({
          activeModal: previousModal?.id || null,
          modalData: previousModal?.data || null,
          modalStack: newStack,
          modalSuspended: false,
        }, false, 'checkoutUI/popModal')
      },

      /**
       * Temporarily hide the current modal (keeps state for resume)
       * Use when opening an external modal (like order detail)
       */
      suspendModal: () => {
        set({ modalSuspended: true }, false, 'checkoutUI/suspendModal')
      },

      /**
       * Show the modal again after suspend
       */
      resumeModal: () => {
        set({ modalSuspended: false }, false, 'checkoutUI/resumeModal')
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

// Get modal stack (for checking if we can go back)
export const useModalStack = () =>
  useCheckoutUIStore((state) => state.modalStack)

// Check if there's modal history (can go back)
export const useHasModalHistory = () =>
  useCheckoutUIStore((state) => state.modalStack.length > 0)

// Check if modal is suspended (temporarily hidden)
export const useModalSuspended = () =>
  useCheckoutUIStore((state) => state.modalSuspended)

// Export checkout UI actions as plain object (not a hook!)
export const checkoutUIActions = {
  get setSelectedDiscountId() { return useCheckoutUIStore.getState().setSelectedDiscountId },
  get setTierSelectorProductId() { return useCheckoutUIStore.getState().setTierSelectorProductId },
  get setStaffDiscountItemId() { return useCheckoutUIStore.getState().setStaffDiscountItemId },
  get setShowDiscountSelector() { return useCheckoutUIStore.getState().setShowDiscountSelector },
  get openModal() { return useCheckoutUIStore.getState().openModal },
  get pushModal() { return useCheckoutUIStore.getState().pushModal },
  get closeModal() { return useCheckoutUIStore.getState().closeModal },
  get popModal() { return useCheckoutUIStore.getState().popModal },
  get suspendModal() { return useCheckoutUIStore.getState().suspendModal },
  get resumeModal() { return useCheckoutUIStore.getState().resumeModal },
  get setErrorModal() { return useCheckoutUIStore.getState().setErrorModal },
  // isModalOpen is still available for non-reactive checks if needed
  isModalOpen: (id: string) => useCheckoutUIStore.getState().activeModal === id,
  hasModalHistory: () => useCheckoutUIStore.getState().modalStack.length > 0,
  isModalSuspended: () => useCheckoutUIStore.getState().modalSuspended,
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
