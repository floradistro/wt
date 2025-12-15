/**
 * Cash Management Service
 * Handles cash drops to safe, safe balance tracking, and drawer balance management
 */

import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// Types
export interface CashDropResult {
  success: boolean
  cash_drop_id?: string
  safe_transaction_id?: string
  drawer_balance_before?: number
  drawer_balance_after?: number
  safe_balance_before?: number
  safe_balance_after?: number
  error?: string
}

export interface SafeTransactionResult {
  success: boolean
  transaction_id?: string
  balance_before?: number
  balance_after?: number
  amount_recorded?: number
  error?: string
}

export interface CashDrop {
  id: string
  vendor_id: string
  location_id: string
  register_id: string
  session_id: string | null
  amount: number
  notes: string | null
  drawer_balance_before: number | null
  drawer_balance_after: number | null
  dropped_by_user_id: string | null
  dropped_by_name: string | null
  dropped_at: string
  created_at: string
}

export interface SafeTransaction {
  id: string
  vendor_id: string
  location_id: string
  transaction_type: 'cash_drop' | 'deposit' | 'withdrawal' | 'count' | 'adjustment'
  amount: number
  balance_before: number | null
  balance_after: number | null
  cash_drop_id: string | null
  session_id: string | null
  notes: string | null
  performed_by_user_id: string | null
  performed_by_name: string | null
  performed_at: string
  created_at: string
}

/**
 * Record a cash drop from drawer to safe
 */
export async function recordCashDrop(params: {
  vendorId: string
  locationId: string
  registerId: string
  sessionId: string
  amount: number
  notes?: string
  userId?: string
  userName?: string
}): Promise<CashDropResult> {
  try {
    logger.info('[CashManagement] Recording cash drop', {
      locationId: params.locationId,
      amount: params.amount,
    })

    const { data, error } = await supabase.rpc('record_cash_drop', {
      p_vendor_id: params.vendorId,
      p_location_id: params.locationId,
      p_register_id: params.registerId,
      p_session_id: params.sessionId,
      p_amount: params.amount,
      p_notes: params.notes || null,
      p_user_id: params.userId || null,
      p_user_name: params.userName || null,
    })

    if (error) {
      logger.error('[CashManagement] Error recording cash drop', error)
      return { success: false, error: error.message }
    }

    logger.info('[CashManagement] Cash drop recorded successfully', data)
    return data as CashDropResult
  } catch (err) {
    logger.error('[CashManagement] Exception recording cash drop', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Record a safe transaction (deposit, withdrawal, count, adjustment)
 */
export async function recordSafeTransaction(params: {
  vendorId: string
  locationId: string
  transactionType: 'deposit' | 'withdrawal' | 'count' | 'adjustment'
  amount: number
  notes?: string
  userId?: string
  userName?: string
}): Promise<SafeTransactionResult> {
  try {
    logger.info('[CashManagement] Recording safe transaction', {
      locationId: params.locationId,
      type: params.transactionType,
      amount: params.amount,
    })

    const { data, error } = await supabase.rpc('record_safe_transaction', {
      p_vendor_id: params.vendorId,
      p_location_id: params.locationId,
      p_transaction_type: params.transactionType,
      p_amount: params.amount,
      p_notes: params.notes || null,
      p_user_id: params.userId || null,
      p_user_name: params.userName || null,
    })

    if (error) {
      logger.error('[CashManagement] Error recording safe transaction', error)
      return { success: false, error: error.message }
    }

    logger.info('[CashManagement] Safe transaction recorded successfully', data)
    return data as SafeTransactionResult
  } catch (err) {
    logger.error('[CashManagement] Exception recording safe transaction', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Get current safe balance for a location
 */
export async function getSafeBalance(locationId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_safe_balance', {
      p_location_id: locationId,
    })

    if (error) {
      logger.error('[CashManagement] Error getting safe balance', error)
      return 0
    }

    return data || 0
  } catch (err) {
    logger.error('[CashManagement] Exception getting safe balance', err)
    return 0
  }
}

/**
 * Get current drawer balance for a session
 */
export async function getDrawerBalance(sessionId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_drawer_balance', {
      p_session_id: sessionId,
    })

    if (error) {
      logger.error('[CashManagement] Error getting drawer balance', error)
      return 0
    }

    return data || 0
  } catch (err) {
    logger.error('[CashManagement] Exception getting drawer balance', err)
    return 0
  }
}

/**
 * Get cash drops for a session
 */
export async function getSessionCashDrops(sessionId: string): Promise<CashDrop[]> {
  try {
    const { data, error } = await supabase
      .from('pos_cash_drops')
      .select('*')
      .eq('session_id', sessionId)
      .order('dropped_at', { ascending: false })

    if (error) {
      logger.error('[CashManagement] Error getting session cash drops', error)
      return []
    }

    return data || []
  } catch (err) {
    logger.error('[CashManagement] Exception getting session cash drops', err)
    return []
  }
}

/**
 * Get cash drops for a location (for daily reporting)
 */
export async function getLocationCashDrops(params: {
  locationId: string
  startDate?: Date
  endDate?: Date
}): Promise<CashDrop[]> {
  try {
    let query = supabase
      .from('pos_cash_drops')
      .select('*')
      .eq('location_id', params.locationId)
      .order('dropped_at', { ascending: false })

    if (params.startDate) {
      query = query.gte('dropped_at', params.startDate.toISOString())
    }
    if (params.endDate) {
      query = query.lte('dropped_at', params.endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      logger.error('[CashManagement] Error getting location cash drops', error)
      return []
    }

    return data || []
  } catch (err) {
    logger.error('[CashManagement] Exception getting location cash drops', err)
    return []
  }
}

/**
 * Get safe transactions for a location
 */
export async function getSafeTransactions(params: {
  locationId: string
  startDate?: Date
  endDate?: Date
  transactionType?: string
}): Promise<SafeTransaction[]> {
  try {
    let query = supabase
      .from('pos_safe_transactions')
      .select('*')
      .eq('location_id', params.locationId)
      .order('performed_at', { ascending: false })

    if (params.startDate) {
      query = query.gte('performed_at', params.startDate.toISOString())
    }
    if (params.endDate) {
      query = query.lte('performed_at', params.endDate.toISOString())
    }
    if (params.transactionType) {
      query = query.eq('transaction_type', params.transactionType)
    }

    const { data, error } = await query

    if (error) {
      logger.error('[CashManagement] Error getting safe transactions', error)
      return []
    }

    return data || []
  } catch (err) {
    logger.error('[CashManagement] Exception getting safe transactions', err)
    return []
  }
}

/**
 * Get safe balance summary for a location
 */
export async function getSafeBalanceSummary(locationId: string) {
  try {
    const { data, error } = await supabase
      .from('pos_safe_balances')
      .select('*')
      .eq('location_id', locationId)
      .single()

    if (error) {
      // No transactions yet - return empty summary
      if (error.code === 'PGRST116') {
        return {
          current_balance: 0,
          total_drops: 0,
          total_dropped: 0,
          total_deposits: 0,
          total_deposited: 0,
          last_transaction_at: null,
        }
      }
      logger.error('[CashManagement] Error getting safe balance summary', error)
      return null
    }

    return data
  } catch (err) {
    logger.error('[CashManagement] Exception getting safe balance summary', err)
    return null
  }
}
