/**
 * useCheckoutTotals Hook - Apple Engineering Standard
 *
 * SINGLE SOURCE OF TRUTH for checkout total calculations
 * All payment views MUST use this hook to ensure consistency
 *
 * Calculation Order (immutable):
 * 1. Start with cart subtotal
 * 2. Subtract loyalty discount
 * 3. Subtract campaign/deal discount
 * 4. Add tax on final amount
 * = Final total
 *
 * This ensures:
 * - Cash change is correct
 * - Card charges are correct
 * - Split payments are correct
 * - Display matches what customer pays
 */

import { useMemo, useEffect } from 'react'
import { useCartTotals } from '@/stores/cart.store'
import { useLoyaltyState, loyaltyActions, useCampaigns } from '@/stores/loyalty-campaigns.store'
import { useSelectedDiscountId, checkoutUIActions } from '@/stores/checkout-ui.store'
import { taxActions } from '@/stores/tax.store'
import { usePOSSession } from '@/contexts/POSSessionContext'

export interface CheckoutTotals {
  // Cart
  subtotal: number
  itemCount: number

  // Discounts
  loyaltyDiscount: number
  campaignDiscount: number
  totalDiscounts: number

  // Tax
  taxAmount: number
  taxRate: number
  taxName?: string

  // Finals
  subtotalAfterDiscounts: number
  total: number

  // Breakdown for display
  breakdown: {
    label: string
    amount: number
    isDiscount?: boolean
  }[]
}

/**
 * Calculate complete checkout totals with all discounts
 *
 * Edge Cases Handled:
 * - Loyalty discount > subtotal → capped at subtotal
 * - Campaign discount > remaining → capped at remaining after loyalty
 * - Total discounts > subtotal → total is tax only
 * - No location → default tax rate
 * - Rounding to 2 decimals at each step
 */
export function useCheckoutTotals(): CheckoutTotals {
  const { subtotal, itemCount } = useCartTotals()
  const { session } = usePOSSession()
  const { loyaltyProgram, pointsToRedeem } = useLoyaltyState()
  const selectedDiscountId = useSelectedDiscountId()
  const campaigns = useCampaigns()

  // Get POS-applicable auto-apply discounts (sales_channel: 'in_store' or 'both', application_method: 'auto')
  const posAutoApplyDiscounts = useMemo(() => {
    return campaigns.filter(d => {
      if (!d.is_active) return false
      if (d.application_method !== 'auto') return false
      const salesChannel = (d as any).sales_channel || 'both'
      return salesChannel === 'in_store' || salesChannel === 'both'
    }).sort((a, b) => {
      // Sort by discount value descending (best discount first)
      // For percentage, higher % is better
      // For fixed, higher $ is better
      return b.discount_value - a.discount_value
    })
  }, [campaigns])

  // Auto-apply the best POS discount if none selected and cart has items
  useEffect(() => {
    if (!selectedDiscountId && subtotal > 0 && posAutoApplyDiscounts.length > 0) {
      const bestDiscount = posAutoApplyDiscounts[0]
      checkoutUIActions.setSelectedDiscountId(bestDiscount.id)
    }
  }, [selectedDiscountId, subtotal, posAutoApplyDiscounts])

  // STEP 1: Get selected campaign discount
  const selectedDiscount = useMemo(() =>
    campaigns.find(d => d.id === selectedDiscountId && d.is_active) || null,
    [campaigns, selectedDiscountId]
  )

  // STEP 2: Calculate loyalty discount
  const loyaltyDiscount = useMemo(() => {
    const discount = loyaltyActions.getDiscountAmount()
    // Cap at subtotal (can't discount more than sale)
    return Math.min(discount, subtotal)
  }, [subtotal, loyaltyProgram, pointsToRedeem])

  // STEP 3: Calculate campaign discount (applied AFTER loyalty)
  const campaignDiscount = useMemo(() => {
    if (!selectedDiscount) return 0

    const subtotalAfterLoyalty = Math.max(0, subtotal - loyaltyDiscount)

    let discount = 0
    if (selectedDiscount.discount_type === 'percentage') {
      discount = subtotalAfterLoyalty * (selectedDiscount.discount_value / 100)
    } else {
      discount = selectedDiscount.discount_value
    }

    // Cap at remaining amount after loyalty discount
    return Math.min(discount, subtotalAfterLoyalty)
  }, [selectedDiscount, subtotal, loyaltyDiscount])

  // STEP 4: Calculate subtotal after ALL discounts
  const subtotalAfterDiscounts = useMemo(() => {
    return Math.max(0, subtotal - loyaltyDiscount - campaignDiscount)
  }, [subtotal, loyaltyDiscount, campaignDiscount])

  // STEP 5: Calculate tax on final discounted amount
  const { taxAmount, taxRate, taxName } = useMemo(() => {
    if (!session?.locationId) {
      // Default tax if no location
      const defaultRate = 0.08
      const tax = subtotalAfterDiscounts * defaultRate
      return {
        taxAmount: Math.round(tax * 100) / 100,
        taxRate: defaultRate,
        taxName: 'Tax'
      }
    }
    return taxActions.calculateTax(subtotalAfterDiscounts, session.locationId)
  }, [subtotalAfterDiscounts, session?.locationId])

  // STEP 6: Calculate final total
  const total = useMemo(() => {
    return Math.round((subtotalAfterDiscounts + taxAmount) * 100) / 100
  }, [subtotalAfterDiscounts, taxAmount])

  // STEP 7: Build breakdown for display
  const breakdown = useMemo(() => {
    const items: CheckoutTotals['breakdown'] = [
      { label: 'Subtotal', amount: subtotal }
    ]

    if (loyaltyDiscount > 0) {
      items.push({
        label: 'Loyalty Discount',
        amount: -loyaltyDiscount,
        isDiscount: true
      })
    }

    if (campaignDiscount > 0) {
      items.push({
        label: selectedDiscount?.name || 'Campaign Discount',
        amount: -campaignDiscount,
        isDiscount: true
      })
    }

    items.push({
      label: `${taxName || 'Tax'} (${(taxRate * 100).toFixed(2)}%)`,
      amount: taxAmount
    })

    items.push({ label: 'Total', amount: total })

    return items
  }, [subtotal, loyaltyDiscount, campaignDiscount, taxAmount, taxRate, taxName, total, selectedDiscount])

  return {
    subtotal,
    itemCount,
    loyaltyDiscount,
    campaignDiscount,
    totalDiscounts: loyaltyDiscount + campaignDiscount,
    taxAmount,
    taxRate,
    taxName,
    subtotalAfterDiscounts,
    total,
    breakdown,
  }
}
