/**
 * COA Service
 * Handles Certificate of Analysis (COA) CRUD operations and file uploads
 */

import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

export interface COA {
  id: string
  vendor_id: string
  product_id: string | null
  file_name: string
  file_url: string
  file_size: number | null
  file_type: string
  lab_name: string | null
  test_date: string | null
  expiry_date: string | null
  batch_number: string | null
  product_name_on_coa: string | null
  test_results: COATestResults
  is_active: boolean
  is_verified: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface COATestResults {
  thc?: string
  cbd?: string
  thca?: string
  cbda?: string
  cbg?: string
  cbn?: string
  total_cannabinoids?: string
  terpenes?: Record<string, string>
  total_terpenes?: string
  pesticides_passed?: boolean
  heavy_metals_passed?: boolean
  microbials_passed?: boolean
  mycotoxins_passed?: boolean
  solvents_passed?: boolean
}

export interface UploadCOAOptions {
  vendorId: string
  productId?: string
  uri: string
  fileName: string
  fileType?: string
  labName?: string
  testDate?: string
  batchNumber?: string
}

export interface CreateCOAParams {
  vendorId: string
  productId?: string
  fileName: string
  fileUrl: string
  fileSize?: number
  fileType?: string
  labName?: string
  testDate?: string
  expiryDate?: string
  batchNumber?: string
  productNameOnCoa?: string
  testResults?: COATestResults
}

/**
 * Add cache-busting query parameter to COA URL based on updated_at timestamp
 */
function addCacheBuster(coa: COA): COA {
  if (!coa.file_url) return coa
  const timestamp = new Date(coa.updated_at || coa.created_at).getTime()
  const separator = coa.file_url.includes('?') ? '&' : '?'
  return {
    ...coa,
    file_url: `${coa.file_url}${separator}t=${timestamp}`,
  }
}

/**
 * Get all COAs for a vendor
 */
export async function getCOAsForVendor(vendorId: string): Promise<COA[]> {
  try {
    logger.info('[COAService] Fetching COAs for vendor:', vendorId)

    const { data, error } = await supabase
      .from('vendor_coas')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('[COAService] Error fetching COAs:', error)
      throw error
    }

    logger.info('[COAService] Fetched COAs:', data?.length || 0)
    // Add cache-busting to URLs to ensure fresh content
    return (data || []).map(addCacheBuster)
  } catch (error) {
    logger.error('[COAService] Failed to fetch COAs:', error)
    throw error
  }
}

/**
 * Get COAs for a specific product
 */
export async function getCOAsForProduct(productId: string): Promise<COA[]> {
  try {
    logger.info('[COAService] Fetching COAs for product:', productId)

    const { data, error } = await supabase
      .from('vendor_coas')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('[COAService] Error fetching COAs:', error)
      throw error
    }

    logger.info('[COAService] Fetched COAs for product:', data?.length || 0)
    // Add cache-busting to URLs to ensure fresh content
    return (data || []).map(addCacheBuster)
  } catch (error) {
    logger.error('[COAService] Failed to fetch COAs:', error)
    throw error
  }
}

/**
 * Upload a COA file to Supabase storage
 */
export async function uploadCOAFile(
  options: UploadCOAOptions
): Promise<{ url: string; path: string; size: number }> {
  const { vendorId, productId, uri, fileName, fileType = 'application/pdf' } = options

  try {
    logger.info('[COAService] Uploading COA file', { vendorId, productId, fileName })

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    })

    // Decode base64 to ArrayBuffer
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const fileSize = byteArray.length

    // Generate path: vendorId/productId_timestamp_filename or vendorId/timestamp_filename
    const timestamp = Date.now()
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = productId
      ? `${vendorId}/${productId}_${timestamp}_${safeName}`
      : `${vendorId}/${timestamp}_${safeName}`

    logger.info('[COAService] Uploading to path:', path)

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('vendor-coas')
      .upload(path, byteArray, {
        contentType: fileType,
        cacheControl: 'no-cache, no-store, must-revalidate',
        upsert: true,
      })

    if (error) {
      logger.error('[COAService] Upload error:', error)
      throw error
    }

    logger.info('[COAService] Upload successful:', data.path)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('vendor-coas')
      .getPublicUrl(path)

    logger.info('[COAService] Public URL:', urlData.publicUrl)

    return {
      url: urlData.publicUrl,
      path,
      size: fileSize,
    }
  } catch (error) {
    logger.error('[COAService] Failed to upload COA file:', error)
    throw error
  }
}

/**
 * Create a COA record in the database
 */
export async function createCOA(params: CreateCOAParams): Promise<COA> {
  try {
    logger.info('[COAService] Creating COA record', params)

    const { data, error } = await supabase
      .from('vendor_coas')
      .insert({
        vendor_id: params.vendorId,
        product_id: params.productId || null,
        file_name: params.fileName,
        file_url: params.fileUrl,
        file_size: params.fileSize || null,
        file_type: params.fileType || 'application/pdf',
        lab_name: params.labName || null,
        test_date: params.testDate || null,
        expiry_date: params.expiryDate || null,
        batch_number: params.batchNumber || null,
        product_name_on_coa: params.productNameOnCoa || null,
        test_results: params.testResults || {},
        is_active: true,
        is_verified: false,
      })
      .select()
      .single()

    if (error) {
      logger.error('[COAService] Error creating COA:', error)
      throw error
    }

    logger.info('[COAService] COA created:', data.id)
    return data
  } catch (error) {
    logger.error('[COAService] Failed to create COA:', error)
    throw error
  }
}

/**
 * Link a COA to a product
 */
export async function linkCOAToProduct(coaId: string, productId: string): Promise<COA> {
  try {
    logger.info('[COAService] Linking COA to product', { coaId, productId })

    const { data, error } = await supabase
      .from('vendor_coas')
      .update({ product_id: productId })
      .eq('id', coaId)
      .select()
      .single()

    if (error) {
      logger.error('[COAService] Error linking COA:', error)
      throw error
    }

    logger.info('[COAService] COA linked to product')
    return data
  } catch (error) {
    logger.error('[COAService] Failed to link COA:', error)
    throw error
  }
}

/**
 * Unlink a COA from a product
 */
export async function unlinkCOAFromProduct(coaId: string): Promise<COA> {
  try {
    logger.info('[COAService] Unlinking COA from product', { coaId })

    const { data, error } = await supabase
      .from('vendor_coas')
      .update({ product_id: null })
      .eq('id', coaId)
      .select()
      .single()

    if (error) {
      logger.error('[COAService] Error unlinking COA:', error)
      throw error
    }

    logger.info('[COAService] COA unlinked from product')
    return data
  } catch (error) {
    logger.error('[COAService] Failed to unlink COA:', error)
    throw error
  }
}

/**
 * Delete a COA (soft delete)
 */
export async function deleteCOA(coaId: string): Promise<void> {
  try {
    logger.info('[COAService] Deleting COA:', coaId)

    const { error } = await supabase
      .from('vendor_coas')
      .update({ is_active: false })
      .eq('id', coaId)

    if (error) {
      logger.error('[COAService] Error deleting COA:', error)
      throw error
    }

    logger.info('[COAService] COA deleted (soft)')
  } catch (error) {
    logger.error('[COAService] Failed to delete COA:', error)
    throw error
  }
}

/**
 * Permanently delete a COA and its file
 */
export async function permanentlyDeleteCOA(coaId: string, filePath: string): Promise<void> {
  try {
    logger.info('[COAService] Permanently deleting COA:', coaId)

    // Delete from storage first
    const { error: storageError } = await supabase.storage
      .from('vendor-coas')
      .remove([filePath])

    if (storageError) {
      logger.warn('[COAService] Storage delete error (continuing):', storageError)
    }

    // Delete from database
    const { error } = await supabase
      .from('vendor_coas')
      .delete()
      .eq('id', coaId)

    if (error) {
      logger.error('[COAService] Error permanently deleting COA:', error)
      throw error
    }

    logger.info('[COAService] COA permanently deleted')
  } catch (error) {
    logger.error('[COAService] Failed to permanently delete COA:', error)
    throw error
  }
}

/**
 * Update COA test results
 */
export async function updateCOATestResults(
  coaId: string,
  testResults: COATestResults
): Promise<COA> {
  try {
    logger.info('[COAService] Updating COA test results:', coaId)

    const { data, error } = await supabase
      .from('vendor_coas')
      .update({ test_results: testResults })
      .eq('id', coaId)
      .select()
      .single()

    if (error) {
      logger.error('[COAService] Error updating test results:', error)
      throw error
    }

    logger.info('[COAService] COA test results updated')
    return data
  } catch (error) {
    logger.error('[COAService] Failed to update test results:', error)
    throw error
  }
}

/**
 * Pick a COA image from device photo library
 * For PDF support, rebuild native app after installing expo-document-picker
 */
export async function pickCOADocument(): Promise<{
  uri: string
  name: string
  size: number
  mimeType: string
} | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    })

    if (result.canceled) {
      return null
    }

    const asset = result.assets[0]
    const fileName = asset.fileName || `COA_${Date.now()}.jpg`
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg'
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const fileInfo = await FileSystem.getInfoAsync(asset.uri)
    const size = (fileInfo as any).size || 0

    return {
      uri: asset.uri,
      name: fileName,
      size,
      mimeType,
    }
  } catch (error) {
    logger.error('[COAService] Failed to pick image:', error)
    throw error
  }
}

/**
 * Calculate COA expiration status based on dates only
 */
export function getCOAStatus(coa: COA): 'valid' | 'expiring' | 'expired' {
  const now = new Date()
  let expiryDate: Date | null = null

  if (coa.expiry_date) {
    expiryDate = new Date(coa.expiry_date)
  } else if (coa.test_date) {
    // Default to 1 year from test date if no expiry specified
    expiryDate = new Date(coa.test_date)
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)
  }

  if (!expiryDate) {
    return 'valid'
  }

  if (now > expiryDate) {
    return 'expired'
  }

  // Expiring if within 30 days
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  if (expiryDate.getTime() - now.getTime() < thirtyDays) {
    return 'expiring'
  }

  return 'valid'
}
