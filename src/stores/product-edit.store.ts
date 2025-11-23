/**
 * Product Edit Store
 *
 * Manages product editing state for the products feature.
 * Provides centralized state for edit mode, field values, pricing, and templates.
 *
 * Architecture:
 * - Used by ProductDetail and editable section components
 * - Auth data passed as arguments to actions (not stored)
 * - Integrates with Supabase for persistence
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { Product, PricingTier } from '@/types/products'

interface ProductEditState {
  // Current product being edited
  productId: string | null
  originalProduct: Product | null
  isEditing: boolean
  saving: boolean

  // Edit state (replaces ProductDetail's 10+ useState hooks)
  editedName: string
  editedSKU: string
  editedDescription: string
  editedPrice: string
  editedCostPrice: string
  pricingMode: 'single' | 'tiered'
  pricingTiers: PricingTier[]
  selectedTemplateId: string | null
  editedCustomFields: Record<string, any>

  // Templates
  availableTemplates: any[]
  loadingTemplates: boolean

  // Actions
  startEditing: (product: Product) => void
  stopEditing: () => void
  updateField: (field: keyof ProductEditState, value: any) => void
  setPricingMode: (mode: 'single' | 'tiered') => void
  updateTiers: (tiers: PricingTier[]) => void
  setTemplateId: (id: string) => void
  loadTemplates: (categoryId: string) => Promise<void>
  saveProduct: (userId: string, vendorId: string, onSuccess?: () => void) => Promise<void>
  cancelEdit: () => void
  reset: () => void
}

const initialState = {
  productId: null,
  originalProduct: null,
  isEditing: false,
  saving: false,
  editedName: '',
  editedSKU: '',
  editedDescription: '',
  editedPrice: '',
  editedCostPrice: '',
  pricingMode: 'single' as const,
  pricingTiers: [],
  selectedTemplateId: null,
  editedCustomFields: {},
  availableTemplates: [],
  loadingTemplates: false,
}

export const useProductEditStore = create<ProductEditState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Start editing a product
       * ANTI-LOOP: Simple state initialization - no side effects
       */
      startEditing: (product: Product) => {
        set(
          {
            productId: product.id,
            originalProduct: product,
            isEditing: true,
            editedName: product.name,
            editedSKU: product.sku || '',
            editedDescription: product.description || '',
            editedPrice: product.price?.toString() || product.regular_price?.toString() || '',
            editedCostPrice: product.cost_price?.toString() || '',
            pricingMode: product.pricing_data?.mode || 'single',
            pricingTiers: product.pricing_data?.tiers || [],
            selectedTemplateId: product.pricing_data?.template_id || null,
            editedCustomFields: product.custom_fields || {},
          },
          false,
          'productEdit/startEditing'
        )
      },

      /**
       * Stop editing (without saving)
       */
      stopEditing: () => {
        set({ isEditing: false }, false, 'productEdit/stopEditing')
      },

      /**
       * Update a single field
       * ANTI-LOOP: Simple setState - no circular dependencies
       */
      updateField: (field, value) => {
        set({ [field]: value } as any, false, `productEdit/updateField/${field}`)
      },

      /**
       * Set pricing mode
       */
      setPricingMode: (mode: 'single' | 'tiered') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        set({ pricingMode: mode }, false, 'productEdit/setPricingMode')
      },

      /**
       * Update pricing tiers
       */
      updateTiers: (tiers: PricingTier[]) => {
        set({ pricingTiers: tiers }, false, 'productEdit/updateTiers')
      },

      /**
       * Set selected template ID
       */
      setTemplateId: (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        set({ selectedTemplateId: id }, false, 'productEdit/setTemplateId')
      },

      /**
       * Load pricing templates for a category
       * ANTI-LOOP: Async operation returns data, doesn't call other actions
       */
      loadTemplates: async (categoryId: string) => {
        set({ loadingTemplates: true }, false, 'productEdit/loadTemplates/start')

        try {
          const { data, error } = await supabase
            .from('pricing_tier_templates')
            .select('*')
            .eq('category_id', categoryId)
            .eq('is_active', true)
            .order('display_order')

          if (error) throw error

          set(
            {
              availableTemplates: data || [],
              loadingTemplates: false,
            },
            false,
            'productEdit/loadTemplates/success'
          )
        } catch (error) {
          logger.error('Failed to load pricing templates:', error)
          set({ loadingTemplates: false }, false, 'productEdit/loadTemplates/error')
        }
      },

      /**
       * Save product changes
       * Context Boundary: Receives userId and vendorId from component (AppAuthContext)
       */
      saveProduct: async (userId: string, vendorId: string, onSuccess?: () => void) => {
        const state = get()

        if (!state.originalProduct) {
          logger.error('Cannot save - no product being edited')
          return
        }

        try {
          set({ saving: true }, false, 'productEdit/saveProduct/start')
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

          const pricingData = {
            mode: state.pricingMode,
            single_price: state.pricingMode === 'single' ? parseFloat(state.editedPrice) || null : null,
            tiers: state.pricingMode === 'tiered' ? state.pricingTiers : undefined,
            template_id: state.selectedTemplateId,
            updated_at: new Date().toISOString(),
          }

          const { error: updateError } = await supabase
            .from('products')
            .update({
              name: state.editedName,
              sku: state.editedSKU,
              description: state.editedDescription,
              cost_price: parseFloat(state.editedCostPrice) || null,
              pricing_data: pricingData,
              custom_fields: state.editedCustomFields,
              updated_at: new Date().toISOString(),
            })
            .eq('id', state.originalProduct.id)
            .eq('vendor_id', vendorId)

          if (updateError) throw updateError

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

          set({ isEditing: false, saving: false }, false, 'productEdit/saveProduct/success')

          // Call success callback if provided
          onSuccess?.()
        } catch (error) {
          logger.error('Failed to save product:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            details: JSON.stringify(error, null, 2),
          })
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          set({ saving: false }, false, 'productEdit/saveProduct/error')
        }
      },

      /**
       * Cancel editing and revert to original values
       */
      cancelEdit: () => {
        const { originalProduct } = get()

        if (!originalProduct) return

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        set(
          {
            isEditing: false,
            editedName: originalProduct.name,
            editedSKU: originalProduct.sku || '',
            editedDescription: originalProduct.description || '',
            editedPrice: originalProduct.price?.toString() || originalProduct.regular_price?.toString() || '',
            editedCostPrice: originalProduct.cost_price?.toString() || '',
            pricingMode: originalProduct.pricing_data?.mode || 'single',
            pricingTiers: originalProduct.pricing_data?.tiers || [],
            selectedTemplateId: originalProduct.pricing_data?.template_id || null,
            editedCustomFields: originalProduct.custom_fields || {},
          },
          false,
          'productEdit/cancelEdit'
        )
      },

      /**
       * Reset entire store (for logout)
       */
      reset: () => {
        set(initialState, false, 'productEdit/reset')
      },
    }),
    { name: 'ProductEditStore' }
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get editing state
export const useIsEditing = () => useProductEditStore((state) => state.isEditing)
export const useIsSaving = () => useProductEditStore((state) => state.saving)

// Get original product
export const useOriginalProduct = () => useProductEditStore((state) => state.originalProduct)

// Get edited fields
export const useEditedName = () => useProductEditStore((state) => state.editedName)
export const useEditedSKU = () => useProductEditStore((state) => state.editedSKU)
export const useEditedDescription = () => useProductEditStore((state) => state.editedDescription)

// Get pricing state
export const usePricingEditState = () =>
  useProductEditStore(
    useShallow((state) => ({
      editedPrice: state.editedPrice,
      editedCostPrice: state.editedCostPrice,
      pricingMode: state.pricingMode,
      pricingTiers: state.pricingTiers,
      selectedTemplateId: state.selectedTemplateId,
    }))
  )

// Get templates state
export const useTemplatesState = () =>
  useProductEditStore(
    useShallow((state) => ({
      availableTemplates: state.availableTemplates,
      loadingTemplates: state.loadingTemplates,
    }))
  )

// Get custom fields
export const useEditedCustomFields = () => useProductEditStore((state) => state.editedCustomFields)

// Get all edit state (for components that need everything)
export const useProductEditState = () =>
  useProductEditStore(
    useShallow((state) => ({
      productId: state.productId,
      originalProduct: state.originalProduct,
      isEditing: state.isEditing,
      saving: state.saving,
      editedName: state.editedName,
      editedSKU: state.editedSKU,
      editedDescription: state.editedDescription,
      editedPrice: state.editedPrice,
      editedCostPrice: state.editedCostPrice,
      pricingMode: state.pricingMode,
      pricingTiers: state.pricingTiers,
      selectedTemplateId: state.selectedTemplateId,
      editedCustomFields: state.editedCustomFields,
      availableTemplates: state.availableTemplates,
      loadingTemplates: state.loadingTemplates,
    }))
  )

/**
 * Export product edit actions as plain object (not a hook!)
 * Use these directly - they're always stable and never cause re-renders
 */
export const productEditActions = {
  get startEditing() {
    return useProductEditStore.getState().startEditing
  },
  get stopEditing() {
    return useProductEditStore.getState().stopEditing
  },
  get updateField() {
    return useProductEditStore.getState().updateField
  },
  get setPricingMode() {
    return useProductEditStore.getState().setPricingMode
  },
  get updateTiers() {
    return useProductEditStore.getState().updateTiers
  },
  get setTemplateId() {
    return useProductEditStore.getState().setTemplateId
  },
  get loadTemplates() {
    return useProductEditStore.getState().loadTemplates
  },
  get saveProduct() {
    return useProductEditStore.getState().saveProduct
  },
  get cancelEdit() {
    return useProductEditStore.getState().cancelEdit
  },
  get reset() {
    return useProductEditStore.getState().reset
  },
}
