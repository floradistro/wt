/**
 * Products Screen Store - Apple Engineering Standard
 *
 * Manages UI state for ProductsScreen with all 6 views:
 * - Navigation (all, low-stock, out-of-stock, categories, purchase-orders, audits)
 * - Search query (separate from POS filter store)
 * - Location filter (multi-select)
 * - Selected items (product, category, purchase order)
 * - Modal states
 *
 * ZERO PROP DRILLING:
 * - ProductsScreen reads from this store
 * - All child views read from this store
 * - No props needed for data/state
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { Product } from '@/types/products'
import type { PurchaseOrder } from '@/services/purchase-orders.service'

type NavSection = 'all' | 'low-stock' | 'out-of-stock' | 'categories' | 'purchase-orders' | 'audits'

interface ProductsScreenState {
  // Navigation
  activeNav: NavSection

  // Search (specific to ProductsScreen, not POS)
  searchQuery: string

  // Location filter (multi-select)
  selectedLocationIds: string[]

  // Selections (one per view type)
  selectedProduct: Product | null
  selectedCategoryId: string | null
  selectedPurchaseOrder: PurchaseOrder | null

  // Modal states
  showCreateProduct: boolean
  showCreateCategory: boolean
  showCreatePO: boolean
  showReceivePO: boolean
  showCreateAudit: boolean

  // Actions
  setActiveNav: (nav: NavSection) => void
  setSearchQuery: (query: string) => void
  toggleLocation: (locationId: string) => void
  setSelectedLocations: (locationIds: string[]) => void
  clearLocationFilter: () => void
  selectProduct: (product: Product | null) => void
  selectCategory: (categoryId: string | null) => void
  selectPurchaseOrder: (po: PurchaseOrder | null) => void
  clearSelection: () => void
  openModal: (modal: 'createProduct' | 'createCategory' | 'createPO' | 'receivePO' | 'createAudit') => void
  closeAllModals: () => void
  reset: () => void
}

const initialState = {
  activeNav: 'all' as NavSection,
  searchQuery: '',
  selectedLocationIds: [],
  selectedProduct: null,
  selectedCategoryId: null,
  selectedPurchaseOrder: null,
  showCreateProduct: false,
  showCreateCategory: false,
  showCreatePO: false,
  showReceivePO: false,
  showCreateAudit: false,
}

export const useProductsScreenStore = create<ProductsScreenState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Set active navigation section
       */
      setActiveNav: (nav: NavSection) => {
        set({ activeNav: nav }, false, 'productsList/setActiveNav')
      },

      /**
       * Set search query
       */
      setSearchQuery: (query: string) => {
        set({ searchQuery: query }, false, 'productsList/setSearchQuery')
      },

      /**
       * Toggle location in filter
       */
      toggleLocation: (locationId: string) => {
        set((state) => {
          const isSelected = state.selectedLocationIds.includes(locationId)
          return {
            selectedLocationIds: isSelected
              ? state.selectedLocationIds.filter(id => id !== locationId)
              : [...state.selectedLocationIds, locationId]
          }
        }, false, 'productsList/toggleLocation')
      },

      /**
       * Set selected locations (batch)
       */
      setSelectedLocations: (locationIds: string[]) => {
        set({ selectedLocationIds: locationIds }, false, 'productsList/setSelectedLocations')
      },

      /**
       * Clear location filter
       */
      clearLocationFilter: () => {
        set({ selectedLocationIds: [] }, false, 'productsList/clearLocationFilter')
      },

      /**
       * Select a product (for detail view)
       */
      selectProduct: (product: Product | null) => {
        set({ selectedProduct: product }, false, 'productsScreen/selectProduct')
      },

      /**
       * Select a category (for detail view)
       */
      selectCategory: (categoryId: string | null) => {
        set({ selectedCategoryId: categoryId }, false, 'productsScreen/selectCategory')
      },

      /**
       * Select a purchase order (for detail view)
       */
      selectPurchaseOrder: (po: PurchaseOrder | null) => {
        set({ selectedPurchaseOrder: po }, false, 'productsScreen/selectPurchaseOrder')
      },

      /**
       * Clear all selections
       */
      clearSelection: () => {
        set({
          selectedProduct: null,
          selectedCategoryId: null,
          selectedPurchaseOrder: null,
        }, false, 'productsScreen/clearSelection')
      },

      /**
       * Open a modal
       */
      openModal: (modal: 'createProduct' | 'createCategory' | 'createPO' | 'receivePO' | 'createAudit') => {
        const updates: Partial<ProductsScreenState> = { showCreateProduct: false, showCreateCategory: false, showCreatePO: false, showReceivePO: false, showCreateAudit: false }

        switch (modal) {
          case 'createProduct':
            updates.showCreateProduct = true
            break
          case 'createCategory':
            updates.showCreateCategory = true
            break
          case 'createPO':
            updates.showCreatePO = true
            break
          case 'receivePO':
            updates.showReceivePO = true
            break
          case 'createAudit':
            updates.showCreateAudit = true
            break
        }

        set(updates, false, `productsScreen/openModal/${modal}`)
      },

      /**
       * Close all modals
       */
      closeAllModals: () => {
        set({
          showCreateProduct: false,
          showCreateCategory: false,
          showCreatePO: false,
          showReceivePO: false,
          showCreateAudit: false,
        }, false, 'productsScreen/closeAllModals')
      },

      /**
       * Reset entire store
       */
      reset: () => {
        set(initialState, false, 'productsScreen/reset')
      },
    }),
    { name: 'ProductsScreenStore' }
  )
)

/**
 * Selectors
 */
export const useActiveNav = () =>
  useProductsScreenStore((state) => state.activeNav)

export const useProductsSearchQuery = () =>
  useProductsScreenStore((state) => state.searchQuery)

export const useSelectedLocationIds = () =>
  useProductsScreenStore((state) => state.selectedLocationIds)

export const useSelectedProduct = () =>
  useProductsScreenStore((state) => state.selectedProduct)

export const useSelectedCategoryId = () =>
  useProductsScreenStore((state) => state.selectedCategoryId)

export const useSelectedPurchaseOrder = () =>
  useProductsScreenStore((state) => state.selectedPurchaseOrder)

export const useModalStates = () =>
  useProductsScreenStore(
    useShallow((state) => ({
      showCreateProduct: state.showCreateProduct,
      showCreateCategory: state.showCreateCategory,
      showCreatePO: state.showCreatePO,
      showReceivePO: state.showReceivePO,
      showCreateAudit: state.showCreateAudit,
    }))
  )

export const useProductsScreenState = () =>
  useProductsScreenStore(
    useShallow((state) => ({
      activeNav: state.activeNav,
      searchQuery: state.searchQuery,
      selectedLocationIds: state.selectedLocationIds,
      selectedProduct: state.selectedProduct,
      selectedCategoryId: state.selectedCategoryId,
      selectedPurchaseOrder: state.selectedPurchaseOrder,
    }))
  )

/**
 * Actions (plain object, not a hook)
 */
export const productsScreenActions = {
  get setActiveNav() { return useProductsScreenStore.getState().setActiveNav },
  get setSearchQuery() { return useProductsScreenStore.getState().setSearchQuery },
  get toggleLocation() { return useProductsScreenStore.getState().toggleLocation },
  get setSelectedLocations() { return useProductsScreenStore.getState().setSelectedLocations },
  get clearLocationFilter() { return useProductsScreenStore.getState().clearLocationFilter },
  get selectProduct() { return useProductsScreenStore.getState().selectProduct },
  get selectCategory() { return useProductsScreenStore.getState().selectCategory },
  get selectPurchaseOrder() { return useProductsScreenStore.getState().selectPurchaseOrder },
  get clearSelection() { return useProductsScreenStore.getState().clearSelection },
  get openModal() { return useProductsScreenStore.getState().openModal },
  get closeAllModals() { return useProductsScreenStore.getState().closeAllModals },
  get reset() { return useProductsScreenStore.getState().reset },
}

// Legacy exports for backwards compatibility
export const productsListActions = productsScreenActions
export const useProductsListStore = useProductsScreenStore
