/**
 * COA Store
 *
 * Manages Certificate of Analysis (COA) state for products.
 * Handles COA list, upload state, and selection.
 *
 * Architecture:
 * - Pure selectors that return values only
 * - All mutations in actions
 * - No circular dependencies
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { logger } from '@/utils/logger'
import type { COA } from '@/services/coa.service'
import {
  getCOAsForProduct,
  getCOAsForVendor,
  uploadCOAFile,
  createCOA,
  deleteCOA,
  linkCOAToProduct,
  pickCOADocument,
} from '@/services/coa.service'

interface COAState {
  // COAs for current product
  productCOAs: COA[]
  loadingProductCOAs: boolean

  // All vendor COAs (for linking)
  vendorCOAs: COA[]
  loadingVendorCOAs: boolean

  // Upload state
  uploading: boolean
  uploadProgress: number
  uploadError: string | null

  // Modal state
  showUploadModal: boolean
  showLinkModal: boolean
  showPreviewModal: boolean
  selectedCOA: COA | null

  // Actions
  loadProductCOAs: (productId: string) => Promise<void>
  loadVendorCOAs: (vendorId: string) => Promise<void>
  uploadCOA: (vendorId: string, productId: string | undefined) => Promise<COA | null>
  linkCOA: (coaId: string, productId: string) => Promise<void>
  removeCOA: (coaId: string) => Promise<void>
  openUploadModal: () => void
  closeUploadModal: () => void
  openLinkModal: () => void
  closeLinkModal: () => void
  openPreviewModal: (coa: COA) => void
  closePreviewModal: () => void
  reset: () => void
}

const initialState = {
  productCOAs: [] as COA[],
  loadingProductCOAs: false,
  vendorCOAs: [] as COA[],
  loadingVendorCOAs: false,
  uploading: false,
  uploadProgress: 0,
  uploadError: null as string | null,
  showUploadModal: false,
  showLinkModal: false,
  showPreviewModal: false,
  selectedCOA: null as COA | null,
}

export const useCOAStore = create<COAState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadProductCOAs: async (productId: string) => {
        set({ loadingProductCOAs: true }, false, 'coa/loadProductCOAs/start')
        try {
          const coas = await getCOAsForProduct(productId)
          set({ productCOAs: coas, loadingProductCOAs: false }, false, 'coa/loadProductCOAs/success')
        } catch (error) {
          logger.error('[COAStore] Failed to load product COAs:', error)
          set({ loadingProductCOAs: false }, false, 'coa/loadProductCOAs/error')
        }
      },

      loadVendorCOAs: async (vendorId: string) => {
        set({ loadingVendorCOAs: true }, false, 'coa/loadVendorCOAs/start')
        try {
          const coas = await getCOAsForVendor(vendorId)
          set({ vendorCOAs: coas, loadingVendorCOAs: false }, false, 'coa/loadVendorCOAs/success')
        } catch (error) {
          logger.error('[COAStore] Failed to load vendor COAs:', error)
          set({ loadingVendorCOAs: false }, false, 'coa/loadVendorCOAs/error')
        }
      },

      uploadCOA: async (vendorId: string, productId: string | undefined) => {
        try {
          // Pick document
          const doc = await pickCOADocument()
          if (!doc) {
            return null
          }

          set({ uploading: true, uploadProgress: 0, uploadError: null }, false, 'coa/upload/start')

          // Upload file
          set({ uploadProgress: 30 }, false, 'coa/upload/uploading')
          const uploadResult = await uploadCOAFile({
            vendorId,
            productId,
            uri: doc.uri,
            fileName: doc.name,
            fileType: doc.mimeType,
          })

          set({ uploadProgress: 70 }, false, 'coa/upload/creating')

          // Create record
          const coa = await createCOA({
            vendorId,
            productId,
            fileName: doc.name,
            fileUrl: uploadResult.url,
            fileSize: uploadResult.size,
            fileType: doc.mimeType,
          })

          set({ uploadProgress: 100 }, false, 'coa/upload/complete')

          // Refresh COAs
          if (productId) {
            await get().loadProductCOAs(productId)
          }

          set(
            { uploading: false, uploadProgress: 0, showUploadModal: false },
            false,
            'coa/upload/success'
          )

          return coa
        } catch (error) {
          logger.error('[COAStore] Upload failed:', error)
          set(
            {
              uploading: false,
              uploadProgress: 0,
              uploadError: error instanceof Error ? error.message : 'Upload failed',
            },
            false,
            'coa/upload/error'
          )
          return null
        }
      },

      linkCOA: async (coaId: string, productId: string) => {
        try {
          await linkCOAToProduct(coaId, productId)
          await get().loadProductCOAs(productId)
          set({ showLinkModal: false }, false, 'coa/link/success')
        } catch (error) {
          logger.error('[COAStore] Link failed:', error)
        }
      },

      removeCOA: async (coaId: string) => {
        try {
          await deleteCOA(coaId)
          // Update local state
          set(
            (state) => ({
              productCOAs: state.productCOAs.filter((c) => c.id !== coaId),
              vendorCOAs: state.vendorCOAs.filter((c) => c.id !== coaId),
            }),
            false,
            'coa/remove/success'
          )
        } catch (error) {
          logger.error('[COAStore] Remove failed:', error)
        }
      },

      openUploadModal: () => {
        set({ showUploadModal: true, uploadError: null }, false, 'coa/openUploadModal')
      },

      closeUploadModal: () => {
        set({ showUploadModal: false, uploadError: null }, false, 'coa/closeUploadModal')
      },

      openLinkModal: () => {
        set({ showLinkModal: true }, false, 'coa/openLinkModal')
      },

      closeLinkModal: () => {
        set({ showLinkModal: false }, false, 'coa/closeLinkModal')
      },

      openPreviewModal: (coa: COA) => {
        set({ showPreviewModal: true, selectedCOA: coa }, false, 'coa/openPreviewModal')
      },

      closePreviewModal: () => {
        set({ showPreviewModal: false, selectedCOA: null }, false, 'coa/closePreviewModal')
      },

      reset: () => {
        set(initialState, false, 'coa/reset')
      },
    }),
    { name: 'COAStore' }
  )
)

/**
 * Selectors
 */
export const useProductCOAs = () => useCOAStore((state) => state.productCOAs)
export const useLoadingProductCOAs = () => useCOAStore((state) => state.loadingProductCOAs)
export const useVendorCOAs = () => useCOAStore((state) => state.vendorCOAs)
export const useLoadingVendorCOAs = () => useCOAStore((state) => state.loadingVendorCOAs)
export const useUploading = () => useCOAStore((state) => state.uploading)
export const useUploadProgress = () => useCOAStore((state) => state.uploadProgress)
export const useUploadError = () => useCOAStore((state) => state.uploadError)
export const useShowUploadModal = () => useCOAStore((state) => state.showUploadModal)
export const useShowLinkModal = () => useCOAStore((state) => state.showLinkModal)
export const useShowPreviewModal = () => useCOAStore((state) => state.showPreviewModal)
export const useSelectedCOA = () => useCOAStore((state) => state.selectedCOA)

export const useCOAState = () =>
  useCOAStore(
    useShallow((state) => ({
      productCOAs: state.productCOAs,
      loadingProductCOAs: state.loadingProductCOAs,
      uploading: state.uploading,
      uploadProgress: state.uploadProgress,
      uploadError: state.uploadError,
      showUploadModal: state.showUploadModal,
      showLinkModal: state.showLinkModal,
      showPreviewModal: state.showPreviewModal,
      selectedCOA: state.selectedCOA,
    }))
  )

/**
 * Actions (plain object, not a hook)
 */
export const coaActions = {
  get loadProductCOAs() {
    return useCOAStore.getState().loadProductCOAs
  },
  get loadVendorCOAs() {
    return useCOAStore.getState().loadVendorCOAs
  },
  get uploadCOA() {
    return useCOAStore.getState().uploadCOA
  },
  get linkCOA() {
    return useCOAStore.getState().linkCOA
  },
  get removeCOA() {
    return useCOAStore.getState().removeCOA
  },
  get openUploadModal() {
    return useCOAStore.getState().openUploadModal
  },
  get closeUploadModal() {
    return useCOAStore.getState().closeUploadModal
  },
  get openLinkModal() {
    return useCOAStore.getState().openLinkModal
  },
  get closeLinkModal() {
    return useCOAStore.getState().closeLinkModal
  },
  get openPreviewModal() {
    return useCOAStore.getState().openPreviewModal
  },
  get closePreviewModal() {
    return useCOAStore.getState().closePreviewModal
  },
  get reset() {
    return useCOAStore.getState().reset
  },
}
