/**
 * Wallet Service
 * Apple Engineering: Single responsibility - Fetch and manage Apple Wallet passes
 *
 * Handles communication with Supabase edge functions for wallet pass generation
 * Returns .pkpass file data for adding to Apple Wallet
 *
 * Edge Functions:
 * - wallet-pass: Generates .pkpass files
 * - wallet-api: Apple's required web service endpoints (device registration, pass updates)
 * - wallet-push: Sends APNs push notifications for real-time updates
 */

import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system/legacy'
import { logger } from '@/utils/logger'

// Supabase Edge Function URL for wallet passes
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
const WALLET_PASS_URL = `${SUPABASE_URL}/functions/v1/wallet-pass`

export interface WalletPassInfo {
  customerId: string
  vendorId: string
  points: number
  tier: string
  memberName: string
  memberSince: string
}

export interface WalletPassResult {
  success: boolean
  fileUri?: string
  error?: string
}

/**
 * Generate wallet pass URL for a customer
 * Uses Supabase edge function for pass generation
 */
export function getWalletPassUrl(customerId: string, vendorId: string): string {
  return `${WALLET_PASS_URL}?customer_id=${customerId}&vendor_id=${vendorId}`
}

/**
 * Download Apple Wallet pass for a customer
 * Returns the local file URI of the downloaded .pkpass file
 */
export async function downloadWalletPass(
  customerId: string,
  vendorId: string
): Promise<WalletPassResult> {
  try {
    const url = getWalletPassUrl(customerId, vendorId)
    const fileUri = `${FileSystem.cacheDirectory}loyalty-pass-${customerId.substring(0, 8)}.pkpass`

    logger.debug('[Wallet Service] Downloading pass from:', url)

    // Download the .pkpass file from Supabase edge function
    const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
      headers: {
        'Accept': 'application/vnd.apple.pkpass',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    })

    if (downloadResult.status !== 200) {
      logger.error('[Wallet Service] Download failed with status:', downloadResult.status)
      return {
        success: false,
        error: `Failed to download pass: HTTP ${downloadResult.status}`,
      }
    }

    // Verify the file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri)
    if (!fileInfo.exists) {
      return {
        success: false,
        error: 'Downloaded file not found',
      }
    }

    logger.debug('[Wallet Service] Pass downloaded successfully:', fileUri)

    return {
      success: true,
      fileUri,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[Wallet Service] Error downloading pass:', error)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Check if a customer has an existing wallet pass
 * Returns pass info if exists
 */
export async function checkWalletPassExists(
  customerId: string,
  vendorId: string
): Promise<{ exists: boolean; passInfo?: WalletPassInfo }> {
  // For now, we don't have a dedicated endpoint to check pass existence
  // The backend will create or update the pass on demand
  // This is a placeholder for future implementation if needed
  return { exists: false }
}

/**
 * Export service object for easier imports
 */
export const walletService = {
  getWalletPassUrl,
  downloadWalletPass,
  checkWalletPassExists,
}
