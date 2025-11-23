/**
 * Loyalty Store Tests
 * Tests for loyalty points calculations and redemption logic
 */

import { useLoyaltyStore } from '../loyalty.store'
import type { LoyaltyProgram } from '@/types/pos'

describe('LoyaltyStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useLoyaltyStore.getState().resetLoyalty()
  })

  describe('Points Calculation', () => {
    it('calculates discount amount correctly', () => {
      // Set loyalty program
      const program: LoyaltyProgram = {
        id: 'prog-1',
        vendor_id: 'vendor-1',
        name: 'Test Program',
        point_value: 0.01, // $0.01 per point
        points_per_dollar: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      useLoyaltyStore.setState({ loyaltyProgram: program })

      // Redeem 100 points
      useLoyaltyStore.getState().setPointsToRedeem(100)

      const discount = useLoyaltyStore.getState().getDiscountAmount()
      expect(discount).toBe(1.00) // 100 * 0.01
    })

    it('returns 0 discount when no points to redeem', () => {
      const program: LoyaltyProgram = {
        id: 'prog-1',
        vendor_id: 'vendor-1',
        name: 'Test Program',
        point_value: 0.01,
        points_per_dollar: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      useLoyaltyStore.setState({ loyaltyProgram: program })
      useLoyaltyStore.getState().setPointsToRedeem(0)

      const discount = useLoyaltyStore.getState().getDiscountAmount()
      expect(discount).toBe(0)
    })

    it('calculates max redeemable points based on subtotal', () => {
      const program: LoyaltyProgram = {
        id: 'prog-1',
        vendor_id: 'vendor-1',
        name: 'Test Program',
        point_value: 0.01,
        points_per_dollar: 1,
        max_redemption_percentage: 50, // Note: Not currently used by getMaxRedeemablePoints
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      useLoyaltyStore.setState({ loyaltyProgram: program, selectedCustomerId: 'customer-1' })

      const subtotal = 100
      const maxPoints = useLoyaltyStore.getState().getMaxRedeemablePoints(subtotal)

      // $100 / $0.01 per point = 10000 points
      expect(maxPoints).toBe(10000)
    })

    it('calculates points earned correctly', () => {
      const program: LoyaltyProgram = {
        id: 'prog-1',
        vendor_id: 'vendor-1',
        name: 'Test Program',
        point_value: 0.01,
        points_per_dollar: 1, // 1 point per dollar
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      useLoyaltyStore.setState({ loyaltyProgram: program, selectedCustomerId: 'customer-1' })

      const total = 50
      const earned = useLoyaltyStore.getState().getPointsEarned(total)

      expect(earned).toBe(50) // $50 * 1 point/dollar
    })

    it('handles fractional points correctly', () => {
      const program: LoyaltyProgram = {
        id: 'prog-1',
        vendor_id: 'vendor-1',
        name: 'Test Program',
        point_value: 0.01,
        points_per_dollar: 1.5, // 1.5 points per dollar
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      useLoyaltyStore.setState({ loyaltyProgram: program, selectedCustomerId: 'customer-1' })

      const total = 100
      const earned = useLoyaltyStore.getState().getPointsEarned(total)

      expect(earned).toBe(150) // $100 * 1.5 points/dollar
    })
  })

  describe('State Management', () => {
    it('sets points to redeem correctly', () => {
      useLoyaltyStore.getState().setPointsToRedeem(500)
      expect(useLoyaltyStore.getState().pointsToRedeem).toBe(500)

      useLoyaltyStore.getState().setPointsToRedeem(1000)
      expect(useLoyaltyStore.getState().pointsToRedeem).toBe(1000)
    })

    it('resets points when customer changes', () => {
      useLoyaltyStore.getState().setPointsToRedeem(500)
      expect(useLoyaltyStore.getState().pointsToRedeem).toBe(500)

      // Change customer - should reset points
      useLoyaltyStore.getState().setSelectedCustomerId('customer-1')
      expect(useLoyaltyStore.getState().pointsToRedeem).toBe(0)

      // Set points again
      useLoyaltyStore.getState().setPointsToRedeem(300)
      expect(useLoyaltyStore.getState().pointsToRedeem).toBe(300)

      // Change to different customer
      useLoyaltyStore.getState().setSelectedCustomerId('customer-2')
      expect(useLoyaltyStore.getState().pointsToRedeem).toBe(0)
    })

    it('resets loyalty state correctly', () => {
      const program: LoyaltyProgram = {
        id: 'prog-1',
        vendor_id: 'vendor-1',
        name: 'Test Program',
        point_value: 0.01,
        points_per_dollar: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      useLoyaltyStore.setState({ loyaltyProgram: program })
      useLoyaltyStore.getState().setPointsToRedeem(500)
      useLoyaltyStore.getState().setVendorId('vendor-1')
      useLoyaltyStore.getState().setSelectedCustomerId('customer-1')

      // Reset - only resets pointsToRedeem, not other state
      useLoyaltyStore.getState().resetLoyalty()

      // resetLoyalty only resets pointsToRedeem, not loyaltyProgram or selectedCustomerId
      expect(useLoyaltyStore.getState().pointsToRedeem).toBe(0)
      // Program and customer remain set
      expect(useLoyaltyStore.getState().loyaltyProgram).not.toBeNull()
      expect(useLoyaltyStore.getState().selectedCustomerId).toBe('customer-1')
    })
  })
})
