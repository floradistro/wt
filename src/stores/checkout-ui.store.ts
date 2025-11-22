/**
 * Checkout UI Store - Apple Engineering Standard
 *
 * Principle: Centralized UI state for checkout flow
 * Replaces: Scattered local state and prop drilling in POSCart/POSCheckout
 *
 * Benefits:
 * - Zero prop drilling for UI state
 * - Accessible anywhere in checkout flow
 * - Redux DevTools visibility
 * - Clean separation: business logic (cart.store) vs UI state (checkout-ui.store)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

interface CheckoutUIState {
  // Campaign discount selection
  selectedDiscountId: string | null

  // Tier selector state
  tierSelectorProductId: string | null

  // Discount selector visibility
  showDiscountSelector: boolean

  // Actions
  setSelectedDiscountId: (discountId: string | null) => void
  setTierSelectorProductId: (productId: string | null) => void
  setShowDiscountSelector: (show: boolean) => void
  reset: () => void
}

const initialState = {
  selectedDiscountId: null,
  tierSelectorProductId: null,
  showDiscountSelector: false,
}

export const useCheckoutUIStore = create<CheckoutUIState>()(
  devtools(
    (set) => ({
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
       * Toggle discount selector visibility
       */
      setShowDiscountSelector: (show: boolean) => {
        set({ showDiscountSelector: show }, false, 'checkoutUI/setShowDiscountSelector')
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

// Get discount selector visibility
export const useShowDiscountSelector = () =>
  useCheckoutUIStore((state) => state.showDiscountSelector)

// Export checkout UI actions as plain object (not a hook!)
export const checkoutUIActions = {
  get setSelectedDiscountId() { return useCheckoutUIStore.getState().setSelectedDiscountId },
  get setTierSelectorProductId() { return useCheckoutUIStore.getState().setTierSelectorProductId },
  get setShowDiscountSelector() { return useCheckoutUIStore.getState().setShowDiscountSelector },
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
  }))
)
