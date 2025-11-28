/**
 * Media Service
 * Handles image uploads to Supabase storage
 */

import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

export interface UploadImageOptions {
  vendorId: string
  productId?: string
  uri: string
  filename?: string
}

export interface UploadImageResult {
  url: string
  path: string
  filename: string
}

/**
 * Upload an image to Supabase storage
 */
export async function uploadProductImage(
  options: UploadImageOptions
): Promise<UploadImageResult> {
  const { vendorId, productId, uri, filename } = options

  try {
    logger.info('[MediaService] Uploading image', { vendorId, productId, uri })

    // Handle iOS photo library URIs - convert asset to file URI
    let fileUri = uri
    if (uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
      logger.info('[MediaService] Converting asset URI to file URI')
      // Extract asset ID from ph:// URI
      const assetId = uri.replace('ph://', '').split('/')[0]
      const asset = await MediaLibrary.getAssetInfoAsync(assetId)
      if (!asset.localUri) {
        throw new Error('Could not get local URI for asset')
      }
      fileUri = asset.localUri
      logger.info('[MediaService] Converted to file URI:', fileUri)
    }

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
    })

    // Decode base64 to ArrayBuffer
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)

    // Determine file extension from file URI
    const ext = fileUri.split('.').pop()?.toLowerCase() || 'jpg'

    // Generate filename
    const generatedFilename =
      filename || `${productId || 'product'}_${Date.now()}.${ext}`
    const path = `${vendorId}/${generatedFilename}`

    // Determine content type
    const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    logger.info('[MediaService] Uploading to path:', path)

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('vendor-product-images')
      .upload(path, byteArray, {
        contentType,
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      })

    if (error) {
      logger.error('[MediaService] Upload error:', error)
      throw error
    }

    logger.info('[MediaService] Upload successful:', data.path)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('vendor-product-images')
      .getPublicUrl(path)

    logger.info('[MediaService] Public URL:', urlData.publicUrl)

    return {
      url: urlData.publicUrl,
      path,
      filename: generatedFilename,
    }
  } catch (error) {
    logger.error('[MediaService] Failed to upload image:', error)
    throw error
  }
}

/**
 * Delete an image from Supabase storage
 */
export async function deleteProductImage(path: string): Promise<void> {
  try {
    logger.info('[MediaService] Deleting image:', path)

    const { error } = await supabase.storage
      .from('vendor-product-images')
      .remove([path])

    if (error) {
      logger.error('[MediaService] Delete error:', error)
      throw error
    }

    logger.info('[MediaService] Delete successful')
  } catch (error) {
    logger.error('[MediaService] Failed to delete image:', error)
    throw error
  }
}

/**
 * Update product's featured image
 */
export async function updateProductImage(
  productId: string,
  vendorId: string,
  imageUrl: string
): Promise<void> {
  try {
    logger.info('[MediaService] Updating product image', {
      productId,
      vendorId,
      imageUrl,
    })

    const { error } = await supabase
      .from('products')
      .update({ featured_image: imageUrl })
      .eq('id', productId)
      .eq('vendor_id', vendorId)

    if (error) {
      logger.error('[MediaService] Update product error:', error)
      throw error
    }

    logger.info('[MediaService] Product image updated successfully')
  } catch (error) {
    logger.error('[MediaService] Failed to update product image:', error)
    throw error
  }
}
