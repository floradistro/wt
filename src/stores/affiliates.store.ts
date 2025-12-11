/**
 * Affiliates Store - Affiliate Marketing State Management
 * Manages affiliate partners, conversions, and payouts
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// Types
export interface Affiliate {
  id: string
  vendor_id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  company_name?: string
  website_url?: string
  referral_code: string
  referral_link?: string
  commission_rate: number
  customer_discount_rate: number // Discount given to customer (0 = no discount)
  customer_discount_type: 'percentage' | 'fixed' // Type of discount
  status: 'pending' | 'active' | 'paused' | 'terminated'
  approved_at?: string
  approved_by?: string
  total_clicks: number
  total_orders: number
  total_revenue: number
  total_commission_earned: number
  total_commission_paid: number
  pending_commission: number
  payment_method?: 'bank_transfer' | 'paypal' | 'check' | 'venmo' | 'other'
  payment_details?: Record<string, any>
  minimum_payout: number
  notes?: string
  created_at: string
  updated_at: string
}

// Validated affiliate code result for checkout
export interface ValidatedAffiliateCode {
  affiliate_id: string
  first_name: string
  last_name: string
  referral_code: string
  commission_rate: number
  customer_discount_rate: number
  customer_discount_type: 'percentage' | 'fixed'
  is_valid: boolean
  error_message: string | null
}

export interface AffiliateConversion {
  id: string
  affiliate_id: string
  vendor_id: string
  order_id: string
  click_id?: string
  order_total: number
  order_subtotal: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  approved_at?: string
  approved_by?: string
  rejection_reason?: string
  payout_id?: string
  paid_at?: string
  created_at: string
  updated_at: string
  // Joined data
  affiliate?: Affiliate
  order?: {
    id: string
    order_number: string
    customer_name: string
  }
}

export interface AffiliatePayout {
  id: string
  affiliate_id: string
  vendor_id: string
  amount: number
  payment_method: string
  payment_reference?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  processed_at?: string
  processed_by?: string
  failure_reason?: string
  notes?: string
  created_at: string
  updated_at: string
  // Joined data
  affiliate?: Affiliate
}

export interface AffiliateStats {
  totalAffiliates: number
  activeAffiliates: number
  totalClicks: number
  totalConversions: number
  totalRevenue: number
  totalCommissionEarned: number
  totalCommissionPaid: number
  pendingCommission: number
  conversionRate: number
}

interface AffiliatesState {
  affiliates: Affiliate[]
  conversions: AffiliateConversion[]
  payouts: AffiliatePayout[]
  stats: AffiliateStats | null
  selectedAffiliate: Affiliate | null
  isLoading: boolean
  isLoadingConversions: boolean
  isLoadingPayouts: boolean
  error: string | null
}

interface AffiliatesActions {
  // Data loading
  loadAffiliates: (vendorId: string) => Promise<void>
  loadConversions: (vendorId: string, affiliateId?: string) => Promise<void>
  loadPayouts: (vendorId: string, affiliateId?: string) => Promise<void>
  loadStats: (vendorId: string) => Promise<void>

  // Affiliate CRUD
  createAffiliate: (vendorId: string, data: CreateAffiliateInput) => Promise<Affiliate | null>
  updateAffiliate: (id: string, data: UpdateAffiliateInput) => Promise<boolean>
  approveAffiliate: (id: string, approvedBy: string) => Promise<boolean>
  pauseAffiliate: (id: string) => Promise<boolean>
  terminateAffiliate: (id: string) => Promise<boolean>

  // Conversion management
  approveConversion: (conversionId: string, approvedBy: string) => Promise<boolean>
  rejectConversion: (conversionId: string, approvedBy: string, reason: string) => Promise<boolean>

  // Payout management
  createPayout: (affiliateId: string, processedBy: string) => Promise<string | null>
  completePayout: (payoutId: string, processedBy: string, reference?: string) => Promise<boolean>

  // Checkout integration
  validateAffiliateCode: (vendorId: string, code: string) => Promise<ValidatedAffiliateCode | null>
  calculateAffiliateDiscount: (subtotal: number, discountRate: number, discountType: 'percentage' | 'fixed') => number

  // UI
  selectAffiliate: (affiliate: Affiliate | null) => void
  clearError: () => void
}

export interface CreateAffiliateInput {
  email: string
  first_name: string
  last_name: string
  phone?: string
  company_name?: string
  website_url?: string
  commission_rate?: number
  customer_discount_rate?: number
  customer_discount_type?: 'percentage' | 'fixed'
  payment_method?: string
  minimum_payout?: number
  notes?: string
}

export interface UpdateAffiliateInput {
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  company_name?: string
  website_url?: string
  commission_rate?: number
  payment_method?: string
  payment_details?: Record<string, any>
  minimum_payout?: number
  notes?: string
}

type AffiliatesStore = AffiliatesState & AffiliatesActions

export const useAffiliatesStore = create<AffiliatesStore>((set, get) => ({
  // Initial state
  affiliates: [],
  conversions: [],
  payouts: [],
  stats: null,
  selectedAffiliate: null,
  isLoading: false,
  isLoadingConversions: false,
  isLoadingPayouts: false,
  error: null,

  // Load all affiliates for a vendor
  loadAffiliates: async (vendorId: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ affiliates: data || [], isLoading: false })
    } catch (err) {
      logger.error('[AffiliatesStore] Load affiliates error:', err)
      set({ error: 'Failed to load affiliates', isLoading: false })
    }
  },

  // Load conversions
  loadConversions: async (vendorId: string, affiliateId?: string) => {
    set({ isLoadingConversions: true })
    try {
      let query = supabase
        .from('affiliate_conversions')
        .select(`
          *,
          affiliate:affiliates(id, first_name, last_name, email, referral_code),
          order:orders(id, order_number)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId)
      }

      const { data, error } = await query

      if (error) throw error
      set({ conversions: data || [], isLoadingConversions: false })
    } catch (err) {
      logger.error('[AffiliatesStore] Load conversions error:', err)
      set({ isLoadingConversions: false })
    }
  },

  // Load payouts
  loadPayouts: async (vendorId: string, affiliateId?: string) => {
    set({ isLoadingPayouts: true })
    try {
      let query = supabase
        .from('affiliate_payouts')
        .select(`
          *,
          affiliate:affiliates(id, first_name, last_name, email)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (affiliateId) {
        query = query.eq('affiliate_id', affiliateId)
      }

      const { data, error } = await query

      if (error) throw error
      set({ payouts: data || [], isLoadingPayouts: false })
    } catch (err) {
      logger.error('[AffiliatesStore] Load payouts error:', err)
      set({ isLoadingPayouts: false })
    }
  },

  // Load aggregate stats
  loadStats: async (vendorId: string) => {
    try {
      const { data: affiliates, error } = await supabase
        .from('affiliates')
        .select('status, total_clicks, total_orders, total_revenue, total_commission_earned, total_commission_paid, pending_commission')
        .eq('vendor_id', vendorId)

      if (error) throw error

      const stats: AffiliateStats = {
        totalAffiliates: affiliates?.length || 0,
        activeAffiliates: affiliates?.filter(a => a.status === 'active').length || 0,
        totalClicks: affiliates?.reduce((sum, a) => sum + (a.total_clicks || 0), 0) || 0,
        totalConversions: affiliates?.reduce((sum, a) => sum + (a.total_orders || 0), 0) || 0,
        totalRevenue: affiliates?.reduce((sum, a) => sum + (a.total_revenue || 0), 0) || 0,
        totalCommissionEarned: affiliates?.reduce((sum, a) => sum + (a.total_commission_earned || 0), 0) || 0,
        totalCommissionPaid: affiliates?.reduce((sum, a) => sum + (a.total_commission_paid || 0), 0) || 0,
        pendingCommission: affiliates?.reduce((sum, a) => sum + (a.pending_commission || 0), 0) || 0,
        conversionRate: 0,
      }

      // Calculate conversion rate
      if (stats.totalClicks > 0) {
        stats.conversionRate = (stats.totalConversions / stats.totalClicks) * 100
      }

      set({ stats })
    } catch (err) {
      logger.error('[AffiliatesStore] Load stats error:', err)
    }
  },

  // Create new affiliate
  createAffiliate: async (vendorId: string, data: CreateAffiliateInput) => {
    try {
      // Generate referral code from name
      const baseName = data.first_name || data.email.split('@')[0]
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_referral_code', {
          p_vendor_id: vendorId,
          p_base_name: baseName,
        })

      if (codeError) throw codeError

      const { data: affiliate, error } = await supabase
        .from('affiliates')
        .insert({
          vendor_id: vendorId,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          company_name: data.company_name,
          website_url: data.website_url,
          commission_rate: data.commission_rate || 10.0,
          customer_discount_rate: data.customer_discount_rate || 0,
          customer_discount_type: data.customer_discount_type || 'percentage',
          referral_code: codeData,
          payment_method: data.payment_method,
          minimum_payout: data.minimum_payout || 50.0,
          notes: data.notes,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error

      // Add to local state
      set(state => ({
        affiliates: [affiliate, ...state.affiliates]
      }))

      return affiliate
    } catch (err) {
      logger.error('[AffiliatesStore] Create affiliate error:', err)
      set({ error: 'Failed to create affiliate' })
      return null
    }
  },

  // Update affiliate
  updateAffiliate: async (id: string, data: UpdateAffiliateInput) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update(data)
        .eq('id', id)

      if (error) throw error

      // Update local state
      set(state => ({
        affiliates: state.affiliates.map(a =>
          a.id === id ? { ...a, ...data } : a
        ),
        selectedAffiliate: state.selectedAffiliate?.id === id
          ? { ...state.selectedAffiliate, ...data }
          : state.selectedAffiliate
      }))

      return true
    } catch (err) {
      logger.error('[AffiliatesStore] Update affiliate error:', err)
      return false
    }
  },

  // Approve affiliate
  approveAffiliate: async (id: string, approvedBy: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({
          status: 'active',
          approved_at: new Date().toISOString(),
          approved_by: approvedBy,
        })
        .eq('id', id)

      if (error) throw error

      set(state => ({
        affiliates: state.affiliates.map(a =>
          a.id === id ? { ...a, status: 'active', approved_at: new Date().toISOString() } : a
        )
      }))

      return true
    } catch (err) {
      logger.error('[AffiliatesStore] Approve affiliate error:', err)
      return false
    }
  },

  // Pause affiliate
  pauseAffiliate: async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ status: 'paused' })
        .eq('id', id)

      if (error) throw error

      set(state => ({
        affiliates: state.affiliates.map(a =>
          a.id === id ? { ...a, status: 'paused' } : a
        )
      }))

      return true
    } catch (err) {
      logger.error('[AffiliatesStore] Pause affiliate error:', err)
      return false
    }
  },

  // Terminate affiliate
  terminateAffiliate: async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ status: 'terminated' })
        .eq('id', id)

      if (error) throw error

      set(state => ({
        affiliates: state.affiliates.map(a =>
          a.id === id ? { ...a, status: 'terminated' } : a
        )
      }))

      return true
    } catch (err) {
      logger.error('[AffiliatesStore] Terminate affiliate error:', err)
      return false
    }
  },

  // Approve conversion
  approveConversion: async (conversionId: string, approvedBy: string) => {
    try {
      const { data, error } = await supabase
        .rpc('approve_affiliate_conversion', {
          p_conversion_id: conversionId,
          p_approved_by: approvedBy,
        })

      if (error) throw error

      set(state => ({
        conversions: state.conversions.map(c =>
          c.id === conversionId ? { ...c, status: 'approved', approved_at: new Date().toISOString() } : c
        )
      }))

      return data as boolean
    } catch (err) {
      logger.error('[AffiliatesStore] Approve conversion error:', err)
      return false
    }
  },

  // Reject conversion
  rejectConversion: async (conversionId: string, approvedBy: string, reason: string) => {
    try {
      const { data, error } = await supabase
        .rpc('reject_affiliate_conversion', {
          p_conversion_id: conversionId,
          p_approved_by: approvedBy,
          p_reason: reason,
        })

      if (error) throw error

      set(state => ({
        conversions: state.conversions.map(c =>
          c.id === conversionId ? { ...c, status: 'rejected', rejection_reason: reason } : c
        )
      }))

      return data as boolean
    } catch (err) {
      logger.error('[AffiliatesStore] Reject conversion error:', err)
      return false
    }
  },

  // Create payout
  createPayout: async (affiliateId: string, processedBy: string) => {
    try {
      const { data, error } = await supabase
        .rpc('create_affiliate_payout', {
          p_affiliate_id: affiliateId,
          p_processed_by: processedBy,
        })

      if (error) throw error

      // Reload payouts to get the new one
      const affiliate = get().affiliates.find(a => a.id === affiliateId)
      if (affiliate) {
        get().loadPayouts(affiliate.vendor_id, affiliateId)
      }

      return data as string
    } catch (err) {
      logger.error('[AffiliatesStore] Create payout error:', err)
      set({ error: err instanceof Error ? err.message : 'Failed to create payout' })
      return null
    }
  },

  // Complete payout
  completePayout: async (payoutId: string, processedBy: string, reference?: string) => {
    try {
      const { data, error } = await supabase
        .rpc('complete_affiliate_payout', {
          p_payout_id: payoutId,
          p_processed_by: processedBy,
          p_payment_reference: reference,
        })

      if (error) throw error

      set(state => ({
        payouts: state.payouts.map(p =>
          p.id === payoutId
            ? { ...p, status: 'completed', processed_at: new Date().toISOString(), payment_reference: reference }
            : p
        )
      }))

      return data as boolean
    } catch (err) {
      logger.error('[AffiliatesStore] Complete payout error:', err)
      return false
    }
  },

  // Checkout integration

  // Validate affiliate code using SQL function
  validateAffiliateCode: async (vendorId: string, code: string) => {
    try {
      const { data, error } = await supabase.rpc('validate_affiliate_code', {
        p_vendor_id: vendorId,
        p_code: code.trim(),
      })

      if (error) {
        logger.error('[AffiliatesStore] Validate affiliate code error:', error)
        return null
      }

      // RPC returns an array with one row
      const result = data?.[0]
      if (!result) {
        return null
      }

      return {
        affiliate_id: result.affiliate_id,
        first_name: result.first_name,
        last_name: result.last_name,
        referral_code: result.referral_code,
        commission_rate: parseFloat(result.commission_rate) || 0,
        customer_discount_rate: parseFloat(result.customer_discount_rate) || 0,
        customer_discount_type: result.customer_discount_type || 'percentage',
        is_valid: result.is_valid,
        error_message: result.error_message,
      } as ValidatedAffiliateCode
    } catch (err) {
      logger.error('[AffiliatesStore] Validate affiliate code exception:', err)
      return null
    }
  },

  // Calculate discount amount (mirrors SQL function logic)
  calculateAffiliateDiscount: (subtotal: number, discountRate: number, discountType: 'percentage' | 'fixed') => {
    if (!discountRate || discountRate <= 0) {
      return 0
    }

    if (discountType === 'percentage') {
      return Math.round(subtotal * (discountRate / 100) * 100) / 100
    } else if (discountType === 'fixed') {
      // Fixed discount cannot exceed subtotal
      return Math.min(discountRate, subtotal)
    }

    return 0
  },

  // UI actions
  selectAffiliate: (affiliate) => set({ selectedAffiliate: affiliate }),
  clearError: () => set({ error: null }),

  // Real-time subscriptions
  subscribeToAffiliateUpdates: (vendorId: string) => {
    logger.info('[AffiliatesStore] Setting up real-time subscription for vendor:', vendorId)

    // Subscribe to affiliate_conversions changes
    const conversionsChannel = supabase
      .channel('affiliate-conversions-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'affiliate_conversions',
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          logger.info('[AffiliatesStore] New conversion received:', payload.new)
          // Reload conversions and stats to get fresh data
          const state = useAffiliatesStore.getState()
          await state.loadConversions(vendorId)
          await state.loadStats(vendorId)
          await state.loadAffiliates(vendorId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'affiliate_conversions',
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          logger.info('[AffiliatesStore] Conversion updated:', payload.new)
          const state = useAffiliatesStore.getState()
          await state.loadConversions(vendorId)
          await state.loadStats(vendorId)
          await state.loadAffiliates(vendorId)
        }
      )
      .subscribe()

    // Subscribe to affiliates changes (for stats updates)
    const affiliatesChannel = supabase
      .channel('affiliates-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'affiliates',
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          logger.info('[AffiliatesStore] Affiliate updated:', payload.new)
          const state = useAffiliatesStore.getState()
          await state.loadAffiliates(vendorId)
          await state.loadStats(vendorId)
        }
      )
      .subscribe()

    // Return cleanup function
    return () => {
      logger.info('[AffiliatesStore] Cleaning up real-time subscriptions')
      supabase.removeChannel(conversionsChannel)
      supabase.removeChannel(affiliatesChannel)
    }
  },
}))

// Selector hooks
export const useAffiliates = () => useAffiliatesStore(state => state.affiliates)
export const useAffiliateConversions = () => useAffiliatesStore(state => state.conversions)
export const useAffiliatePayouts = () => useAffiliatesStore(state => state.payouts)
export const useAffiliateStats = () => useAffiliatesStore(state => state.stats)
export const useSelectedAffiliate = () => useAffiliatesStore(state => state.selectedAffiliate)
export const useAffiliatesLoading = () => useAffiliatesStore(state => state.isLoading)
export const useAffiliatesError = () => useAffiliatesStore(state => state.error)

export const useAffiliatesActions = () => useAffiliatesStore(
  useShallow(state => ({
    loadAffiliates: state.loadAffiliates,
    loadConversions: state.loadConversions,
    loadPayouts: state.loadPayouts,
    loadStats: state.loadStats,
    createAffiliate: state.createAffiliate,
    updateAffiliate: state.updateAffiliate,
    approveAffiliate: state.approveAffiliate,
    pauseAffiliate: state.pauseAffiliate,
    terminateAffiliate: state.terminateAffiliate,
    approveConversion: state.approveConversion,
    rejectConversion: state.rejectConversion,
    createPayout: state.createPayout,
    completePayout: state.completePayout,
    validateAffiliateCode: state.validateAffiliateCode,
    calculateAffiliateDiscount: state.calculateAffiliateDiscount,
    subscribeToAffiliateUpdates: state.subscribeToAffiliateUpdates,
    selectAffiliate: state.selectAffiliate,
    clearError: state.clearError,
  }))
)
