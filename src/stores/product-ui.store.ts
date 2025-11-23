/**
 * Product UI Store
 *
 * Manages UI state for the products feature.
 * Handles modal visibility, location selection, and adjustment results.
 *
 * Architecture:
 * - Separate from product-edit.store (UI state vs edit state)
 * - Used by modals and ProductDetail for coordination
 * - Stores adjustment results to trigger parent reloads
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

type ModalType = 'adjust-inventory' | 'sales-history' | 'create-product' | null

interface ProductUIState {
  // Modal state
  activeModal: ModalType
  modalData: Record<string, any> | null

  // Location selection for inventory operations
  selectedLocationId: string | undefined
  selectedLocationName: string | undefined

  // Adjustment result (for triggering parent reload)
  lastAdjustmentResult: { quantity_after: number; product_total_stock?: number } | null

  // Actions
  openModal: (id: ModalType, data?: any) => void
  closeModal: () => void
  isModalOpen: (id: ModalType) => boolean
  setLocation: (id: string, name: string) => void
  setAdjustmentResult: (result: { quantity_after: number; product_total_stock?: number } | null) => void
  reset: () => void
}

const initialState = {
  activeModal: null as ModalType,
  modalData: null,
  selectedLocationId: undefined,
  selectedLocationName: undefined,
  lastAdjustmentResult: null,
}

export const useProductUIStore = create<ProductUIState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      openModal: (id: ModalType, data?: any) => {
        set({ activeModal: id, modalData: data || null }, false, 'productUI/openModal')
      },

      closeModal: () => {
        set({ activeModal: null, modalData: null }, false, 'productUI/closeModal')
      },

      isModalOpen: (id: ModalType) => {
        return get().activeModal === id
      },

      setLocation: (id: string, name: string) => {
        set(
          {
            selectedLocationId: id,
            selectedLocationName: name,
          },
          false,
          'productUI/setLocation'
        )
      },

      setAdjustmentResult: (result: { quantity_after: number; product_total_stock?: number } | null) => {
        set(
          {
            lastAdjustmentResult: result,
          },
          false,
          'productUI/setAdjustmentResult'
        )
      },

      reset: () => {
        set(initialState, false, 'productUI/reset')
      },
    }),
    { name: 'ProductUIStore' }
  )
)

/**
 * Selectors
 */
export const useActiveModal = () => useProductUIStore((state) => state.activeModal)
export const useModalData = () => useProductUIStore((state) => state.modalData)
export const useSelectedLocation = () =>
  useProductUIStore(
    useShallow((state) => ({
      selectedLocationId: state.selectedLocationId,
      selectedLocationName: state.selectedLocationName,
    }))
  )
export const useLastAdjustmentResult = () => useProductUIStore((state) => state.lastAdjustmentResult)
export const useProductUIState = () =>
  useProductUIStore(
    useShallow((state) => ({
      activeModal: state.activeModal,
      modalData: state.modalData,
      selectedLocationId: state.selectedLocationId,
      selectedLocationName: state.selectedLocationName,
      lastAdjustmentResult: state.lastAdjustmentResult,
    }))
  )

/**
 * Actions (plain object, not a hook)
 */
export const productUIActions = {
  get openModal() {
    return useProductUIStore.getState().openModal
  },
  get closeModal() {
    return useProductUIStore.getState().closeModal
  },
  isModalOpen: (id: ModalType) => useProductUIStore.getState().activeModal === id,
  get setLocation() {
    return useProductUIStore.getState().setLocation
  },
  get setAdjustmentResult() {
    return useProductUIStore.getState().setAdjustmentResult
  },
  get reset() {
    return useProductUIStore.getState().reset
  },
}
