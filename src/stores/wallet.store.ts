/**
 * Wallet Store
 * Apple Engineering: Single source of truth for Apple Wallet pass state
 *
 * ANTI-LOOP DESIGN:
 * - ✅ All selectors ONLY return values (no setState, no calculations)
 * - ✅ All mutations happen in actions
 * - ✅ No subscriptions that call setState in the store itself
 * - ✅ No useEffects (stores don't use React hooks)
 * - ✅ Actions exported as plain objects with getters
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { walletService } from '@/services/wallet.service'
import { logger } from '@/utils/logger'

// ========================================
// TYPES
// ========================================
interface WalletState {
  // State
  isDownloading: boolean
  downloadedFileUri: string | null
  error: string | null
  lastDownloadedCustomerId: string | null

  // Actions
  downloadPass: (customerId: string, vendorId: string) => Promise<string | null>
  clearDownload: () => void
  clearError: () => void
  reset: () => void
}

// ========================================
// STORE
// ========================================
export const useWalletStore = create<WalletState>()(
  devtools(
    (set, get) => ({
      // State
      isDownloading: false,
      downloadedFileUri: null,
      error: null,
      lastDownloadedCustomerId: null,

      // Actions
      downloadPass: async (customerId: string, vendorId: string) => {
        set({ isDownloading: true, error: null })

        try {
          logger.debug('[Wallet Store] Starting pass download for customer:', customerId)

          const result = await walletService.downloadWalletPass(customerId, vendorId)

          if (result.success && result.fileUri) {
            set({
              isDownloading: false,
              downloadedFileUri: result.fileUri,
              lastDownloadedCustomerId: customerId,
            })
            logger.debug('[Wallet Store] Pass downloaded successfully:', result.fileUri)
            return result.fileUri
          } else {
            set({
              isDownloading: false,
              error: result.error || 'Failed to download pass',
            })
            logger.error('[Wallet Store] Failed to download pass:', result.error)
            return null
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          logger.error('[Wallet Store] Error downloading pass:', error)
          set({
            isDownloading: false,
            error: errorMessage,
          })
          return null
        }
      },

      clearDownload: () => {
        set({
          downloadedFileUri: null,
          lastDownloadedCustomerId: null,
        })
      },

      clearError: () => {
        set({ error: null })
      },

      reset: () => {
        set({
          isDownloading: false,
          downloadedFileUri: null,
          error: null,
          lastDownloadedCustomerId: null,
        })
      },
    }),
    { name: 'WalletStore' }
  )
)

// ========================================
// SELECTORS (ANTI-LOOP: Use useShallow for objects)
// ========================================
// ✅ Primitive values - direct selectors (no useShallow needed)
export const useWalletIsDownloading = () =>
  useWalletStore((state) => state.isDownloading)

export const useWalletError = () =>
  useWalletStore((state) => state.error)

export const useWalletDownloadedFileUri = () =>
  useWalletStore((state) => state.downloadedFileUri)

// ✅ Object return - use useShallow to prevent infinite re-renders
export const useWalletState = () =>
  useWalletStore(
    useShallow((state) => ({
      isDownloading: state.isDownloading,
      downloadedFileUri: state.downloadedFileUri,
      error: state.error,
      lastDownloadedCustomerId: state.lastDownloadedCustomerId,
    }))
  )

// ========================================
// ACTIONS (ANTI-LOOP: Export as plain object with getters, NOT hooks)
// ========================================
export const walletActions = {
  get downloadPass() { return useWalletStore.getState().downloadPass },
  get clearDownload() { return useWalletStore.getState().clearDownload },
  get clearError() { return useWalletStore.getState().clearError },
  get reset() { return useWalletStore.getState().reset },
}
