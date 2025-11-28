/**
 * Settings UI Store - Apple Engineering Standard
 *
 * Principle: Global state for Settings screen UI interactions
 * Manages: Modal states, edit modes, environment toggle
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
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logger } from '@/utils/logger'

// ========================================
// TYPES
// ========================================
type Environment = 'dev' | 'prod'
type ModalType = 'payment-processor' | 'supplier' | 'user' | null

interface SettingsUIState {
  // Environment Toggle
  currentEnvironment: Environment

  // UI State
  activeModal: ModalType
  isEditMode: boolean

  // Actions - Environment
  switchEnvironment: (env: Environment) => void
  toggleEnvironment: () => void

  // Actions - Modals
  openPaymentProcessorModal: () => void
  openSupplierModal: () => void
  openUserModal: () => void
  closeAllModals: () => void

  // Actions - Edit Mode
  toggleEditMode: () => void
  setEditMode: (enabled: boolean) => void

  // Internal
  reset: () => void
}

// ========================================
// STORE
// ========================================
const initialState = {
  currentEnvironment: 'dev' as Environment,
  activeModal: null as ModalType,
  isEditMode: false,
}

export const useSettingsUIStore = create<SettingsUIState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ========================================
        // ENVIRONMENT ACTIONS
        // ========================================

        /**
         * Switch to a specific environment
         */
        switchEnvironment: (env: Environment) => {
          logger.debug('[SettingsUIStore] Switching to environment:', env)
          set({ currentEnvironment: env })
        },

        /**
         * Toggle between DEV and PROD environments
         */
        toggleEnvironment: () => {
          const { currentEnvironment } = get()
          const newEnv = currentEnvironment === 'dev' ? 'prod' : 'dev'
          logger.debug('[SettingsUIStore] Toggling environment:', currentEnvironment, '→', newEnv)
          set({ currentEnvironment: newEnv })
        },

        // ========================================
        // MODAL ACTIONS
        // ========================================

        /**
         * Open payment processor modal
         */
        openPaymentProcessorModal: () => {
          logger.debug('[SettingsUIStore] Opening payment processor modal')
          set({ activeModal: 'payment-processor' })
        },

        /**
         * Open supplier modal
         */
        openSupplierModal: () => {
          logger.debug('[SettingsUIStore] Opening supplier modal')
          set({ activeModal: 'supplier' })
        },

        /**
         * Open user modal
         */
        openUserModal: () => {
          logger.debug('[SettingsUIStore] Opening user modal')
          set({ activeModal: 'user' })
        },

        /**
         * Close all modals
         */
        closeAllModals: () => {
          logger.debug('[SettingsUIStore] Closing all modals')
          set({ activeModal: null })
        },

        // ========================================
        // EDIT MODE ACTIONS
        // ========================================

        /**
         * Toggle edit mode
         */
        toggleEditMode: () => {
          const { isEditMode } = get()
          logger.debug('[SettingsUIStore] Toggling edit mode:', !isEditMode)
          set({ isEditMode: !isEditMode })
        },

        /**
         * Set edit mode explicitly
         */
        setEditMode: (enabled: boolean) => {
          logger.debug('[SettingsUIStore] Setting edit mode:', enabled)
          set({ isEditMode: enabled })
        },

        // ========================================
        // INTERNAL
        // ========================================

        /**
         * Reset store to initial state
         */
        reset: () => {
          logger.debug('[SettingsUIStore] Resetting to initial state')
          set(initialState)
        },
      }),
      {
        name: 'settings-ui-storage',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          currentEnvironment: state.currentEnvironment,
        }),
      }
    ),
    { name: 'SettingsUIStore' }
  )
)

// ========================================
// SELECTORS (ANTI-LOOP: Use useShallow for objects)
// ========================================

/**
 * Get current environment
 */
export const useCurrentEnvironment = () =>
  useSettingsUIStore((state) => state.currentEnvironment)

/**
 * Get active modal
 */
export const useActiveSettingsModal = () =>
  useSettingsUIStore((state) => state.activeModal)

/**
 * Get edit mode state
 */
export const useSettingsEditMode = () =>
  useSettingsUIStore((state) => state.isEditMode)

/**
 * Get all UI state (for debugging)
 */
export const useSettingsUIState = () =>
  useSettingsUIStore(
    useShallow((state) => ({
      currentEnvironment: state.currentEnvironment,
      activeModal: state.activeModal,
      isEditMode: state.isEditMode,
    }))
  )

// ========================================
// ACTIONS (ANTI-LOOP: Export as plain object with getters)
// ========================================
export const settingsUIActions = {
  get switchEnvironment() {
    return useSettingsUIStore.getState().switchEnvironment
  },
  get toggleEnvironment() {
    return useSettingsUIStore.getState().toggleEnvironment
  },
  get openPaymentProcessorModal() {
    return useSettingsUIStore.getState().openPaymentProcessorModal
  },
  get openSupplierModal() {
    return useSettingsUIStore.getState().openSupplierModal
  },
  get openUserModal() {
    return useSettingsUIStore.getState().openUserModal
  },
  get closeAllModals() {
    return useSettingsUIStore.getState().closeAllModals
  },
  get toggleEditMode() {
    return useSettingsUIStore.getState().toggleEditMode
  },
  get setEditMode() {
    return useSettingsUIStore.getState().setEditMode
  },
  get reset() {
    return useSettingsUIStore.getState().reset
  },
}
