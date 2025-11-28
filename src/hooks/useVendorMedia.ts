/**
 * useVendorMedia Hook
 * Fetches vendor's media library from Supabase storage
 * Zero Prop Drilling: Components fetch their own data
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'

export interface VendorMediaFile {
  id: string
  name: string
  url: string
  path: string
  size: number
  created_at: string
  metadata?: {
    width?: number
    height?: number
    size?: number
  }
}

export interface UseVendorMediaResult {
  images: VendorMediaFile[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useVendorMedia(): UseVendorMediaResult {
  const { vendor } = useAppAuth()
  const [images, setImages] = useState<VendorMediaFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadImages = useCallback(async () => {
    if (!vendor?.id) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      logger.info('[useVendorMedia] Loading images for vendor:', vendor.id)

      // List all files in vendor's folder
      const { data: files, error: listError } = await supabase.storage
        .from('vendor-product-images')
        .list(vendor.id, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      logger.info('[useVendorMedia] Supabase list response:', {
        filesCount: files?.length,
        files: files,
        error: listError,
      })

      if (listError) {
        logger.error('[useVendorMedia] Supabase list error:', listError)
        throw new Error(listError.message || 'Failed to load images')
      }

      if (!files || files.length === 0) {
        logger.info('[useVendorMedia] No images found for vendor:', vendor.id)
        setImages([])
        setIsLoading(false)
        return
      }

      // Filter out folders and get public URLs
      const imageFiles = files
        .filter((file) => {
          // Only include image files
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
          // Exclude .emptyFolderPlaceholder files
          const isNotPlaceholder = file.name !== '.emptyFolderPlaceholder'
          logger.info('[useVendorMedia] File filter check:', {
            name: file.name,
            isImage,
            isNotPlaceholder,
            included: isImage && isNotPlaceholder,
          })
          return isImage && isNotPlaceholder
        })
        .map((file) => {
          const path = `${vendor.id}/${file.name}`
          const { data: urlData } = supabase.storage
            .from('vendor-product-images')
            .getPublicUrl(path)

          logger.info('[useVendorMedia] Generated public URL:', {
            name: file.name,
            path,
            url: urlData.publicUrl,
          })

          return {
            id: file.id,
            name: file.name,
            url: urlData.publicUrl,
            path,
            size: file.metadata?.size || 0,
            created_at: file.created_at,
            metadata: file.metadata,
          }
        })

      logger.info('[useVendorMedia] Loaded images:', {
        totalFiles: files.length,
        imageFiles: imageFiles.length,
        images: imageFiles,
      })
      setImages(imageFiles)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load images'
      logger.error('[useVendorMedia] Failed to load images:', err)
      setError(errorMessage)
      setImages([])
    } finally {
      setIsLoading(false)
    }
  }, [vendor?.id])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  return {
    images,
    isLoading,
    error,
    reload: loadImages,
  }
}
