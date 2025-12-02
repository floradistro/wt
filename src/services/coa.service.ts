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
  // Flat format keys (from uploadPdfToSupabase)
  thc?: string
  cbd?: string
  thca?: string
  '9thc'?: string // Delta-9 THC (from Δ9-THC stripped to 9thc)
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
  // Nested format (from uploadToVendor)
  totalTHC?: number
  totalCBD?: number
  totalCannabinoids?: number
  cannabinoids?: Array<{
    name: string
    percentWeight: number
    mgPerG?: number
    loq?: number
    lod?: number
    result?: string
  }>
  sampleType?: string
  strain?: string
  // Allow any additional keys
  [key: string]: string | number | boolean | Record<string, string> | Array<unknown> | undefined
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

export interface ParsedCOAField {
  field_id: string
  value: string
  confidence: 'high' | 'medium' | 'low'
}

export interface ParseCOAResult {
  success: boolean
  parsed_fields: ParsedCOAField[]
  lab_name?: string | null
  test_date?: string | null
  batch_number?: string | null
  error?: string
}

export interface CategoryFieldDefinition {
  field_id: string
  label: string
  type: string
  description?: string
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
 * @param activeOnly - If true, only return active COAs (default: false to get all)
 */
export async function getCOAsForVendor(vendorId: string, activeOnly: boolean = false): Promise<COA[]> {
  try {
    logger.info('[COAService] Fetching COAs for vendor:', vendorId, { activeOnly })

    let query = supabase
      .from('vendor_coas')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })

    // Only filter by is_active if explicitly requested
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

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
 * COA test_results field to product custom_fields mapping
 * Maps COA cannabinoid keys to product custom field keys
 */
const COA_TO_CUSTOM_FIELD_MAP: Record<string, string[]> = {
  // COA key -> possible product custom field keys (first match wins)
  'thca': ['thca_percentage', 'thca_%', 'thca'],
  '9thc': ['d9_percentage', 'd9_%', 'd9', 'delta9_percentage', 'delta_9'],
}

/**
 * Cannabinoid name mapping (from COA cannabinoids array to flat keys)
 */
const CANNABINOID_NAME_TO_KEY: Record<string, string> = {
  'THCa': 'thca',
  'thca': 'thca',
  'THCA': 'thca',
  'Δ9-THC': '9thc',
  'd9-thc': '9thc',
  'D9-THC': '9thc',
  'Delta-9 THC': '9thc',
  'delta9thc': '9thc',
}

/**
 * Extract flat cannabinoid values from test_results
 * Handles both formats:
 * 1. Flat: { thca: "28.5", 9thc: "0.21" }
 * 2. Nested: { cannabinoids: [{ name: "THCa", percentWeight: 28.5 }, ...] }
 */
function extractCannabinoidValues(testResults: COATestResults): Record<string, string> {
  const values: Record<string, string> = {}

  // Check for nested cannabinoids array
  const cannabinoids = testResults.cannabinoids as Array<{
    name: string
    percentWeight: number
  }> | undefined

  if (Array.isArray(cannabinoids)) {
    for (const c of cannabinoids) {
      if (c.name && c.percentWeight !== undefined && c.percentWeight > 0) {
        // Map cannabinoid name to key
        const key = CANNABINOID_NAME_TO_KEY[c.name] ||
          c.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        values[key] = c.percentWeight.toString()
      }
    }
  }

  // Also check for flat keys (these take precedence if both exist)
  if (testResults.thca) {
    values['thca'] = String(testResults.thca)
  }
  if (testResults['9thc']) {
    values['9thc'] = String(testResults['9thc'])
  }

  return values
}

/**
 * Auto-fill product custom fields from COA test_results
 * Looks up the product's category field definitions to know which fields to fill
 */
async function autoFillProductCustomFields(
  productId: string,
  testResults: COATestResults
): Promise<void> {
  if (!testResults || Object.keys(testResults).length === 0) {
    logger.info('[COAService] No test_results to auto-fill')
    return
  }

  try {
    // Extract cannabinoid values (handles both flat and nested formats)
    const cannabinoidValues = extractCannabinoidValues(testResults)
    logger.info('[COAService] Extracted cannabinoid values', cannabinoidValues)

    if (Object.keys(cannabinoidValues).length === 0) {
      logger.info('[COAService] No cannabinoid values found in test_results')
      return
    }

    // Get product with category_id and current custom_fields
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('custom_fields, category_id, vendor_id')
      .eq('id', productId)
      .single()

    if (fetchError || !product) {
      logger.error('[COAService] Failed to fetch product for auto-fill:', fetchError)
      return
    }

    // Get category field definitions to know which fields exist for this category
    const { data: categoryFields, error: fieldsError } = await supabase
      .from('vendor_product_fields')
      .select('field_id')
      .eq('category_id', product.category_id)
      .eq('vendor_id', product.vendor_id)

    if (fieldsError) {
      logger.error('[COAService] Failed to fetch category fields:', fieldsError)
      return
    }

    // Build set of valid field IDs for this category
    const validFieldIds = new Set(categoryFields?.map(f => f.field_id) || [])
    logger.info('[COAService] Valid category field IDs', Array.from(validFieldIds))

    const currentFields = (product?.custom_fields as Record<string, unknown>) || {}
    const updatedFields = { ...currentFields }
    let hasUpdates = false

    // Map cannabinoid values to custom_fields
    for (const [coaKey, customFieldKeys] of Object.entries(COA_TO_CUSTOM_FIELD_MAP)) {
      const coaValue = cannabinoidValues[coaKey]
      if (coaValue === undefined || coaValue === null || coaValue === '') continue

      // Find matching custom field key that exists in category definition
      for (const fieldKey of customFieldKeys) {
        if (validFieldIds.has(fieldKey)) {
          // Only update if the field is empty or doesn't exist in product
          const currentValue = currentFields[fieldKey]
          if (currentValue === undefined || currentValue === null || currentValue === '') {
            updatedFields[fieldKey] = coaValue
            hasUpdates = true
            logger.info('[COAService] Auto-filling field from COA', {
              fieldKey,
              coaKey,
              value: coaValue
            })
          }
          break // Found the matching field, stop looking
        }
      }
    }

    // Also check for exact key matches (e.g., if category has 'thca' field)
    for (const [coaKey, coaValue] of Object.entries(cannabinoidValues)) {
      if (validFieldIds.has(coaKey)) {
        const currentValue = currentFields[coaKey]
        if (currentValue === undefined || currentValue === null || currentValue === '') {
          updatedFields[coaKey] = coaValue
          hasUpdates = true
          logger.info('[COAService] Auto-filling exact match field from COA', {
            fieldKey: coaKey,
            value: coaValue
          })
        }
      }
    }

    if (hasUpdates) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ custom_fields: updatedFields })
        .eq('id', productId)

      if (updateError) {
        logger.error('[COAService] Failed to update product custom_fields:', updateError)
      } else {
        logger.info('[COAService] Product custom_fields auto-filled from COA', {
          productId,
          fieldsUpdated: Object.keys(updatedFields).filter(k =>
            updatedFields[k] !== currentFields[k]
          )
        })
      }
    } else {
      logger.info('[COAService] No matching fields to auto-fill', {
        productId,
        cannabinoidKeys: Object.keys(cannabinoidValues),
        categoryFields: Array.from(validFieldIds)
      })
    }
  } catch (error) {
    logger.error('[COAService] Error in autoFillProductCustomFields:', error)
    // Don't throw - this is a non-critical enhancement
  }
}

/**
 * Link a COA to a product
 * Also auto-fills product custom fields from COA test_results
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

    // Auto-fill product custom fields from COA test_results
    if (data?.test_results) {
      await autoFillProductCustomFields(productId, data.test_results)
    }

    logger.info('[COAService] COA linked to product')
    return data
  } catch (error) {
    logger.error('[COAService] Failed to link COA:', error)
    throw error
  }
}

/**
 * Check if a COA has cannabinoid data that can be synced
 */
export function coaHasCannabinoidData(coa: COA): boolean {
  if (!coa.test_results || Object.keys(coa.test_results).length === 0) {
    return false
  }
  const values = extractCannabinoidValues(coa.test_results)
  return Object.keys(values).length > 0
}

/**
 * Count COAs that have syncable cannabinoid data
 */
export function countCOAsWithSyncableData(coas: COA[]): number {
  return coas.filter(c => c.product_id && coaHasCannabinoidData(c)).length
}

/**
 * Sync COA data to product custom fields for already-linked COAs
 * Use this to backfill existing products that have COAs but missing custom field values
 */
export async function syncCOADataToProduct(coa: COA): Promise<boolean> {
  if (!coa.product_id) {
    return false
  }

  if (!coaHasCannabinoidData(coa)) {
    return false
  }

  try {
    await autoFillProductCustomFields(coa.product_id, coa.test_results)
    return true
  } catch (error) {
    logger.error('[COAService] Error syncing COA data to product:', error)
    return false
  }
}

/**
 * Bulk sync COA data to products for all linked COAs
 * Returns count of successfully synced products
 */
export async function bulkSyncCOADataToProducts(coas: COA[]): Promise<{ synced: number; total: number }> {
  const linkedCoas = coas.filter(c => c.product_id && coaHasCannabinoidData(c))
  let synced = 0

  for (const coa of linkedCoas) {
    const success = await syncCOADataToProduct(coa)
    if (success) synced++
  }

  logger.info('[COAService] Bulk sync complete', { synced, total: linkedCoas.length })
  return { synced, total: linkedCoas.length }
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

/**
 * Parse COA using AI (Claude Vision)
 * Extracts field values from COA PDF and returns structured data
 *
 * @param coaId - The COA record ID
 * @param productId - The product ID (used to get category fields)
 * @param vendorId - The vendor ID
 * @returns Parsed fields with confidence levels
 */
export async function parseCOAWithAI(
  coaId: string,
  productId: string,
  vendorId: string
): Promise<ParseCOAResult> {
  try {
    logger.info('[COAService] Starting AI parse for COA', { coaId, productId })

    // Get product's category to fetch field definitions
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('primary_category_id')
      .eq('id', productId)
      .single()

    if (productError || !product?.primary_category_id) {
      logger.error('[COAService] Failed to get product category', productError)
      return {
        success: false,
        parsed_fields: [],
        error: 'Product not found or has no category',
      }
    }

    // Fetch category field definitions
    const { data: categoryFields, error: fieldsError } = await supabase
      .from('vendor_product_fields')
      .select('field_id, field_definition')
      .eq('vendor_id', vendorId)
      .eq('category_id', product.primary_category_id)
      .order('sort_order', { ascending: true })

    if (fieldsError) {
      logger.error('[COAService] Failed to get category fields', fieldsError)
    }

    // Map to field definitions for the AI
    const fieldDefinitions: CategoryFieldDefinition[] = (categoryFields || []).map((f: any) => ({
      field_id: f.field_id,
      label: f.field_definition?.label || f.field_id,
      type: f.field_definition?.type || 'text',
      description: f.field_definition?.description,
    }))

    logger.info('[COAService] Calling parse-coa edge function', {
      coaId,
      fieldCount: fieldDefinitions.length,
    })

    // Call the edge function
    const { data, error } = await supabase.functions.invoke('parse-coa', {
      body: {
        coa_id: coaId,
        product_id: productId,
        vendor_id: vendorId,
        category_fields: fieldDefinitions,
      },
    })

    // Log the raw response for debugging
    logger.info('[COAService] Edge function response', { data, error: error?.message })

    if (error) {
      // Log full error details including nested context
      const ctx = (error as any).context

      // Try to read the response body from context
      let responseBody: any = null
      if (ctx && typeof ctx.json === 'function') {
        try {
          responseBody = await ctx.json()
          logger.error('[COAService] Error response body:', responseBody)
        } catch (e) {
          logger.error('[COAService] Could not parse error response body')
        }
      }

      logger.error('[COAService] Edge function error details', {
        message: error.message,
        name: error.name,
        status: ctx?.status,
        responseBody,
      })

      // Use response body error if available
      const errorMessage = responseBody?.error || responseBody?.message || responseBody?.details ||
                          data?.error || data?.message || error.message || 'Failed to parse COA'

      return {
        success: false,
        parsed_fields: [],
        error: errorMessage,
      }
    }

    logger.info('[COAService] COA parsed successfully', {
      fieldsExtracted: data?.parsed_fields?.length || 0,
      labName: data?.lab_name,
    })

    return {
      success: true,
      parsed_fields: data.parsed_fields || [],
      lab_name: data.lab_name,
      test_date: data.test_date,
      batch_number: data.batch_number,
    }
  } catch (error) {
    logger.error('[COAService] parseCOAWithAI failed:', error)
    return {
      success: false,
      parsed_fields: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Parse COA and auto-fill product custom fields
 * Only fills empty fields, preserves existing values
 *
 * @param coaId - The COA record ID
 * @param productId - The product to update
 * @param vendorId - The vendor ID
 * @returns Object with parse results and fields updated
 */
export interface FieldComparison {
  field_id: string
  label: string
  coaValue: string
  productValue: string | null
  status: 'filled' | 'matched' | 'conflict' | 'skipped'
  confidence: 'high' | 'medium' | 'low'
}

export async function parseCOAAndFillProduct(
  coaId: string,
  productId: string,
  vendorId: string
): Promise<{
  success: boolean
  parseResult: ParseCOAResult
  fieldsUpdated: string[]
  fieldComparisons: FieldComparison[]
  error?: string
}> {
  try {
    // Step 1: Parse COA with AI
    const parseResult = await parseCOAWithAI(coaId, productId, vendorId)

    if (!parseResult.success || parseResult.parsed_fields.length === 0) {
      return {
        success: false,
        parseResult,
        fieldsUpdated: [],
        fieldComparisons: [],
        error: parseResult.error || 'No fields extracted from COA',
      }
    }

    // Step 2: Get current product custom_fields
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('custom_fields, primary_category_id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return {
        success: false,
        parseResult,
        fieldsUpdated: [],
        fieldComparisons: [],
        error: 'Failed to fetch product',
      }
    }

    // Step 3: Get valid category field definitions (with labels)
    const { data: categoryFields } = await supabase
      .from('vendor_product_fields')
      .select('field_id, field_definition')
      .eq('vendor_id', vendorId)
      .eq('category_id', product.primary_category_id)

    // Build map of field_id -> label (from field_definition JSON)
    const fieldMap = new Map(
      categoryFields?.map((f: any) => [
        f.field_id,
        f.field_definition?.label || f.field_id
      ]) || []
    )

    // Step 4: Merge parsed fields into custom_fields (only fill empty)
    const currentFields = (product.custom_fields as Record<string, any>) || {}
    const updatedFields = { ...currentFields }
    const fieldsUpdated: string[] = []
    const fieldComparisons: FieldComparison[] = []

    for (const parsed of parseResult.parsed_fields) {
      const label = fieldMap.get(parsed.field_id) || parsed.field_id
      const productValue = currentFields[parsed.field_id]
      const hasExistingValue = productValue !== undefined && productValue !== null && productValue !== ''

      // Determine comparison status
      let status: FieldComparison['status'] = 'skipped'

      if (!fieldMap.has(parsed.field_id)) {
        // Field not in category template
        status = 'skipped'
      } else if (!hasExistingValue && parsed.value && parsed.value.trim() !== '') {
        // Empty field, will fill
        status = 'filled'
        updatedFields[parsed.field_id] = parsed.value
        fieldsUpdated.push(parsed.field_id)
        logger.info('[COAService] Auto-filling field from COA', {
          fieldId: parsed.field_id,
          value: parsed.value,
          confidence: parsed.confidence,
        })
      } else if (hasExistingValue) {
        // Has existing value - check if it matches
        const coaVal = String(parsed.value).trim().toLowerCase()
        const prodVal = String(productValue).trim().toLowerCase()
        status = coaVal === prodVal ? 'matched' : 'conflict'
      }

      fieldComparisons.push({
        field_id: parsed.field_id,
        label,
        coaValue: parsed.value,
        productValue: hasExistingValue ? String(productValue) : null,
        status,
        confidence: parsed.confidence,
      })
    }

    // Step 5: Update product if any fields changed
    if (fieldsUpdated.length > 0) {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          custom_fields: updatedFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)

      if (updateError) {
        logger.error('[COAService] Failed to update product', updateError)
        return {
          success: false,
          parseResult,
          fieldsUpdated: [],
          fieldComparisons,
          error: 'Failed to update product fields',
        }
      }

      logger.info('[COAService] Product fields updated from COA', {
        productId,
        fieldsUpdated,
      })
    }

    return {
      success: true,
      parseResult,
      fieldsUpdated,
      fieldComparisons,
    }
  } catch (error) {
    logger.error('[COAService] parseCOAAndFillProduct failed:', error)
    return {
      success: false,
      parseResult: { success: false, parsed_fields: [], error: 'Parse failed' },
      fieldsUpdated: [],
      fieldComparisons: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
