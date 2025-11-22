/**
 * Tax Store - Apple Engineering Standard
 *
 * Principle: Location-aware tax configuration with intelligent caching
 * Replaces: Inline tax calculations scattered across components
 *
 * Benefits:
 * - Centralized tax logic
 * - Location-specific tax rates cached
 * - Easy to extend (multiple tax types, tax-inclusive pricing, etc.)
 * - Clean API: calculateTax(subtotal, locationId)
 * - AI can access tax config outside React
 */

import React from 'react'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

interface TaxConfig {
  salesTaxRate: number
  taxName?: string
  // Future extensions:
  // exciseTaxRate?: number
  // taxInclusive?: boolean
  // taxExemptCategories?: string[]
}

interface TaxCalculation {
  taxAmount: number
  taxRate: number
  taxName: string
  // Future: itemized breakdown
  // breakdown?: { name: string; amount: number }[]
}

interface TaxState {
  // Tax configurations per location (cached)
  taxConfigs: Record<string, TaxConfig>
  loading: boolean
  error: string | null

  // Actions
  loadTaxConfig: (locationId: string) => Promise<void>
  calculateTax: (subtotal: number, locationId: string) => TaxCalculation
  reset: () => void
}

const initialState = {
  taxConfigs: {},
  loading: false,
  error: null,
}

const DEFAULT_TAX_RATE = 0.08 // 8% fallback
const DEFAULT_TAX_NAME = 'Sales Tax'

export const useTaxStore = create<TaxState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Load tax configuration for a specific location
       * Results are cached to avoid repeated queries
       */
      loadTaxConfig: async (locationId: string) => {
        // Check cache first
        const existing = get().taxConfigs[locationId]
        if (existing) {
          logger.debug('[TaxStore] Using cached config for location:', locationId)
          return
        }

        set({ loading: true, error: null }, false, 'tax/loadConfig')

        try {
          logger.debug('[TaxStore] Loading tax config for location:', locationId)

          const { data: location, error } = await supabase
            .from('locations')
            .select('settings')
            .eq('id', locationId)
            .single()

          if (error) throw error

          const taxConfig = location?.settings?.tax_config || {}
          const config: TaxConfig = {
            salesTaxRate: taxConfig.sales_tax_rate || DEFAULT_TAX_RATE,
            taxName: taxConfig.tax_name || DEFAULT_TAX_NAME,
          }

          logger.debug('[TaxStore] Tax config loaded:', { locationId, config })

          set((state) => ({
            taxConfigs: {
              ...state.taxConfigs,
              [locationId]: config,
            },
            loading: false,
          }), false, 'tax/configLoaded')
        } catch (err) {
          logger.error('[TaxStore] Error loading tax config:', err)

          // Set default config on error
          set((state) => ({
            taxConfigs: {
              ...state.taxConfigs,
              [locationId]: {
                salesTaxRate: DEFAULT_TAX_RATE,
                taxName: DEFAULT_TAX_NAME,
              },
            },
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load tax config',
          }), false, 'tax/configError')
        }
      },

      /**
       * Calculate tax for a given subtotal and location
       * Uses cached config or default if not loaded
       */
      calculateTax: (subtotal: number, locationId: string): TaxCalculation => {
        const config = get().taxConfigs[locationId]

        if (!config) {
          logger.warn('[TaxStore] No config found for location, using default:', locationId)

          // Return default calculation
          return {
            taxAmount: subtotal * DEFAULT_TAX_RATE,
            taxRate: DEFAULT_TAX_RATE,
            taxName: DEFAULT_TAX_NAME,
          }
        }

        const taxAmount = subtotal * config.salesTaxRate

        return {
          taxAmount,
          taxRate: config.salesTaxRate,
          taxName: config.taxName || DEFAULT_TAX_NAME,
        }
      },

      /**
       * Reset entire store (for logout)
       */
      reset: () => {
        set(initialState, false, 'tax/reset')
      },
    }),
    { name: 'TaxStore' }
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get tax config for a specific location
export const useTaxConfig = (locationId: string) =>
  useTaxStore((state) => state.taxConfigs[locationId])

// Export tax actions as plain object (not a hook!)
export const taxActions = {
  get loadTaxConfig() { return useTaxStore.getState().loadTaxConfig },
  get calculateTax() { return useTaxStore.getState().calculateTax },
  get reset() { return useTaxStore.getState().reset },
}

// Legacy hook for backward compatibility
export const useTaxActions = () => taxActions

// Get loading state
export const useTaxLoading = () => useTaxStore((state) => state.loading)

// Get error state
export const useTaxError = () => useTaxStore((state) => state.error)

// Get all tax configs (for debugging)
export const useAllTaxConfigs = () => useTaxStore((state) => state.taxConfigs)

/**
 * Convenience hook: Auto-load tax config and return calculator
 * Usage: const { taxAmount, taxRate } = useTaxCalculation(subtotal, locationId)
 */
export const useTaxCalculation = (subtotal: number, locationId: string): TaxCalculation => {
  const actions = useTaxActions()

  // Auto-load config if needed (only runs once per location)
  React.useEffect(() => {
    if (locationId) {
      actions.loadTaxConfig(locationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // actions is memoized and stable, safe to omit from deps
  }, [locationId])

  return actions.calculateTax(subtotal, locationId)
}
