# Payment System Test Plan - Apple Engineering Approach

## Overview
Comprehensive test plan for validating split payment and cash change calculation fixes.
Following Apple's principles: test real-world scenarios, edge cases, and failure modes.

## Critical Fixes Implemented

### 1. Campaign Discount Bug (HIGH PRIORITY)
**Issue**: Payment views were missing campaign discount from total calculation
- **Before**: Only subtracted loyalty discount
- **After**: Uses centralized `useCheckoutTotals()` hook with both discounts
- **Impact**: Cash change was incorrect by campaign discount amount

### 2. Split Payment Data Not Sent (CRITICAL)
**Issue**: Split payment amounts weren't included in Edge Function payload
- **Before**: Only sent `paymentMethod: 'split'` with no amounts
- **After**: Includes `splitPayments`, `cashAmount`, `cardAmount` in payload
- **Impact**: Card processor always charged full total instead of partial

### 3. Edge Function Split Payment Support (CRITICAL)
**Issue**: Edge Function had no split payment logic
- **Before**: Always charged `body.total` to card
- **After**: Uses `cardAmount` for split payments, `body.total` for card-only
- **Impact**: Card overcharged on split payments

---

## Test Cases

### A. Cash Payment Tests

#### A1. Cash Payment - No Discounts
**Scenario**: Basic cash sale with no loyalty or campaign discounts
```javascript
{
  items: [{ unitPrice: 10.00, quantity: 1 }],
  subtotal: 10.00,
  taxAmount: 1.00,
  total: 11.00,
  paymentMethod: 'cash',
  cashTendered: 20.00
}
```
**Expected**:
- Change due: $9.00
- Total charged: $11.00
- Database records: 1 cash transaction for $11.00

#### A2. Cash Payment - Loyalty Discount Only
**Scenario**: Sale with $5 loyalty discount
```javascript
{
  items: [{ unitPrice: 100.00, quantity: 1 }],
  subtotal: 100.00,
  loyaltyDiscountAmount: 5.00,
  taxAmount: 9.50,  // Tax on $95.00
  total: 104.50,
  paymentMethod: 'cash',
  cashTendered: 110.00
}
```
**Expected**:
- Change due: $5.50
- Total charged: $104.50 (NOT $109.50!)
- Loyalty points deducted from customer account

#### A3. Cash Payment - Campaign Discount Only
**Scenario**: Sale with $10 campaign discount
```javascript
{
  items: [{ unitPrice: 50.00, quantity: 1 }],
  subtotal: 50.00,
  campaignDiscountAmount: 10.00,
  taxAmount: 4.00,  // Tax on $40.00
  total: 44.00,
  paymentMethod: 'cash',
  cashTendered: 50.00
}
```
**Expected**:
- Change due: $6.00 (NOT $0.00!)
- Total charged: $44.00 (NOT $54.00!)
- Campaign tracked in order record

#### A4. Cash Payment - BOTH Discounts (Critical Edge Case)
**Scenario**: Sale with both loyalty AND campaign discounts
```javascript
{
  items: [{ unitPrice: 100.00, quantity: 1 }],
  subtotal: 100.00,
  loyaltyDiscountAmount: 10.00,
  campaignDiscountAmount: 5.00,  // Applied AFTER loyalty
  taxAmount: 8.50,  // Tax on $85.00
  total: 93.50,
  paymentMethod: 'cash',
  cashTendered: 100.00
}
```
**Expected**:
- Change due: $6.50
- Total charged: $93.50
- Both discounts applied in correct order
- Loyalty points deducted
- Campaign tracked

#### A5. Cash Payment - Exact Change
**Scenario**: Customer provides exact change
```javascript
{
  total: 42.37,
  paymentMethod: 'cash',
  cashTendered: 42.37
}
```
**Expected**:
- Change due: $0.00
- UI should show "No change" or "$0.00 change"

#### A6. Cash Payment - Insufficient Funds
**Scenario**: Customer provides less than total (should be blocked by UI)
```javascript
{
  total: 50.00,
  paymentMethod: 'cash',
  cashTendered: 40.00
}
```
**Expected**:
- Complete button disabled
- UI shows "INSUFFICIENT - need $10.00 more"
- Cannot complete transaction

---

### B. Split Payment Tests

#### B1. Split Payment - 50/50 Basic
**Scenario**: $100 sale split evenly between cash and card
```javascript
{
  items: [{ unitPrice: 100.00, quantity: 1 }],
  subtotal: 100.00,
  taxAmount: 10.00,
  total: 110.00,
  paymentMethod: 'split',
  splitPayments: [
    { method: 'cash', amount: 55.00 },
    { method: 'card', amount: 55.00 }
  ]
}
```
**Expected**:
- Cash transaction logged: $55.00
- Card charged: $55.00 (NOT $110.00!)
- Total: $110.00
- Database: 2 transactions (split-cash + split-card)

#### B2. Split Payment - With Loyalty Discount
**Scenario**: $100 sale, $10 loyalty discount, split payment
```javascript
{
  items: [{ unitPrice: 100.00, quantity: 1 }],
  subtotal: 100.00,
  loyaltyDiscountAmount: 10.00,
  taxAmount: 9.00,  // Tax on $90.00
  total: 99.00,
  paymentMethod: 'split',
  splitPayments: [
    { method: 'cash', amount: 50.00 },
    { method: 'card', amount: 49.00 }
  ]
}
```
**Expected**:
- Cash: $50.00
- Card: $49.00 (NOT $99.00!)
- Total: $99.00
- Loyalty points deducted
- Customer still earns points on remaining $90.00 subtotal

#### B3. Split Payment - With Campaign Discount
**Scenario**: $50 sale, $5 campaign discount, split payment
```javascript
{
  items: [{ unitPrice: 50.00, quantity: 1 }],
  subtotal: 50.00,
  campaignDiscountAmount: 5.00,
  taxAmount: 4.50,  // Tax on $45.00
  total: 49.50,
  paymentMethod: 'split',
  splitPayments: [
    { method: 'cash', amount: 25.00 },
    { method: 'card', amount: 24.50 }
  ]
}
```
**Expected**:
- Cash: $25.00
- Card: $24.50 (NOT $49.50!)
- Total: $49.50
- Campaign tracked

#### B4. Split Payment - BOTH Discounts (Critical)
**Scenario**: $200 sale with both discounts, 70/30 split
```javascript
{
  items: [{ unitPrice: 200.00, quantity: 1 }],
  subtotal: 200.00,
  loyaltyDiscountAmount: 20.00,
  campaignDiscountAmount: 10.00,
  taxAmount: 17.00,  // Tax on $170.00
  total: 187.00,
  paymentMethod: 'split',
  splitPayments: [
    { method: 'cash', amount: 130.00 },
    { method: 'card', amount: 57.00 }
  ]
}
```
**Expected**:
- Cash: $130.00
- Card: $57.00 (NOT $187.00!)
- Total: $187.00
- Both discounts applied
- Customer earns points on $170.00 subtotal (after discounts)

#### B5. Split Payment - Mostly Cash, Small Card
**Scenario**: Customer pays most in cash, small amount on card
```javascript
{
  total: 97.50,
  paymentMethod: 'split',
  splitPayments: [
    { method: 'cash', amount: 90.00 },
    { method: 'card', amount: 7.50 }
  ]
}
```
**Expected**:
- Cash: $90.00
- Card: $7.50 (verify small amounts work)
- Total: $97.50

#### B6. Split Payment - Mostly Card, Small Cash
**Scenario**: Opposite scenario - small cash, large card
```javascript
{
  total: 97.50,
  paymentMethod: 'split',
  splitPayments: [
    { method: 'cash', amount: 2.50 },
    { method: 'card', amount: 95.00 }
  ]
}
```
**Expected**:
- Cash: $2.50
- Card: $95.00
- Total: $97.50

---

### C. Card Payment Tests

#### C1. Card Payment - No Discounts
**Scenario**: Basic card payment
```javascript
{
  items: [{ unitPrice: 50.00, quantity: 1 }],
  subtotal: 50.00,
  taxAmount: 5.00,
  total: 55.00,
  paymentMethod: 'card'
}
```
**Expected**:
- Card charged: $55.00
- Database: 1 card transaction for $55.00

#### C2. Card Payment - With Discounts
**Scenario**: Card payment with both discounts
```javascript
{
  items: [{ unitPrice: 100.00, quantity: 1 }],
  subtotal: 100.00,
  loyaltyDiscountAmount: 10.00,
  campaignDiscountAmount: 5.00,
  taxAmount: 8.50,
  total: 93.50,
  paymentMethod: 'card'
}
```
**Expected**:
- Card charged: $93.50 (NOT $103.50!)
- Both discounts applied correctly

---

### D. Edge Function Rollback Tests

#### D1. Split Payment - Card Fails
**Scenario**: Split payment where card portion fails
```javascript
{
  total: 100.00,
  paymentMethod: 'split',
  splitPayments: [
    { method: 'cash', amount: 50.00 },
    { method: 'card', amount: 50.00 }  // Card declines
  ]
}
```
**Expected**:
- Cash transaction logged: $50.00
- Card fails
- Order status: CANCELLED
- Inventory holds released
- **Question**: Should cash be refunded? Or allow retry?
- Database: 1 split-cash + 1 failed split-card transaction

#### D2. Network Timeout During Card Processing
**Scenario**: Card processor times out
**Expected**:
- Order remains in PENDING state
- Retry mechanism kicks in OR
- Clear error message to retry
- Inventory holds maintained (timeout period)

---

### E. Loyalty Points Integration Tests

#### E1. Points Earned - Cash Payment
**Scenario**: Cash payment should earn loyalty points
```javascript
{
  subtotal: 100.00,
  loyaltyDiscountAmount: 0,
  total: 110.00,
  paymentMethod: 'cash',
  customerId: 'cust-123'
}
```
**Expected**:
- Points earned on $100.00 subtotal
- Points added to customer account
- Not blocked by cash payment method

#### E2. Points Earned - Split Payment
**Scenario**: Split payment should earn points on subtotal
```javascript
{
  subtotal: 200.00,
  loyaltyDiscountAmount: 10.00,
  total: 209.00,
  paymentMethod: 'split',
  splitPayments: [
    { method: 'cash', amount: 100.00 },
    { method: 'card', amount: 109.00 }
  ],
  customerId: 'cust-123'
}
```
**Expected**:
- Points earned on $190.00 (subtotal after loyalty discount)
- Points added regardless of split payment

#### E3. Points Spent - Partial Redemption
**Scenario**: Customer spends some points but still pays cash
```javascript
{
  subtotal: 100.00,
  loyaltyDiscountAmount: 25.00,  // Spent 250 points
  total: 82.50,  // $75 + tax
  paymentMethod: 'cash',
  cashTendered: 100.00,
  customerId: 'cust-123'
}
```
**Expected**:
- 250 points deducted
- Still earns points on $75.00 (remaining subtotal)
- Change: $17.50 (NOT $0.00!)

---

### F. Multi-Item Cart Tests

#### F1. Mixed Products - With Tiered Pricing
**Scenario**: Cart with multiple products at different tier quantities
```javascript
{
  items: [
    {
      productName: 'Product A',
      unitPrice: 30.00,
      quantity: 1,
      tierQty: 3.5,  // 3.5g tier
      tierName: '3.5g (Eighth)',
      lineTotal: 30.00
    },
    {
      productName: 'Product B',
      unitPrice: 50.00,
      quantity: 1,
      tierQty: 7,  // 7g tier
      tierName: '7g (Quarter)',
      lineTotal: 50.00
    }
  ],
  subtotal: 80.00,
  taxAmount: 8.00,
  total: 88.00,
  paymentMethod: 'cash',
  cashTendered: 100.00
}
```
**Expected**:
- Inventory deducted: 3.5 + 7 = 10.5 units
- Change: $12.00
- Order items created with correct tier_qty values

---

### G. Database Validation Tests

#### G1. Payment Transactions Table - Split Payment
**Scenario**: Verify database records are correct for split payment
**Expected Database State**:
```sql
-- Should create 2 records
SELECT * FROM payment_transactions WHERE order_id = 'order-123';

-- Record 1
payment_method: 'split-cash'
amount: 50.00
total_amount: 100.00

-- Record 2
payment_method: 'split-card'
amount: 50.00
total_amount: 100.00
```

#### G2. Order Record - Complete Data
**Scenario**: Verify order record has all required fields
**Expected**:
```sql
SELECT * FROM orders WHERE id = 'order-123';

-- Must have
status: 'completed'
payment_status: 'paid'
subtotal: 100.00
tax_amount: 10.00
total: 110.00
payment_method: 'split'
loyalty_discount_amount: (if applicable)
campaign_discount_amount: (if applicable)
```

---

## Testing Methodology

### Manual Testing Checklist
1. [ ] Test all Cash Payment scenarios (A1-A6)
2. [ ] Test all Split Payment scenarios (B1-B6)
3. [ ] Test all Card Payment scenarios (C1-C2)
4. [ ] Test Edge Function rollback (D1-D2)
5. [ ] Test Loyalty Points integration (E1-E3)
6. [ ] Test Multi-item carts (F1)
7. [ ] Validate Database records (G1-G2)

### Automated Testing (Future)
- Create Jest/Vitest tests for `useCheckoutTotals` hook
- Create integration tests for Edge Function
- Mock payment processor responses
- Verify idempotency works correctly

### Real-World Testing
1. **Staff Training**: Have staff test with real terminals
2. **Customer Scenarios**: Test with actual customer flows
3. **Peak Hours**: Test during busy times
4. **Network Issues**: Test with poor connectivity
5. **Receipt Printing**: Verify receipts show correct amounts

---

## Success Criteria

✅ **Cash Change Always Correct**
- Change calculation includes all discounts
- UI shows correct amount before completion
- Quick amount buttons calculate correctly

✅ **Split Payments Work Correctly**
- Card charged only the card portion (not full total)
- Cash recorded separately
- Database has 2 transaction records
- Order total matches sum of split amounts

✅ **Discounts Applied Consistently**
- Loyalty discount applied first
- Campaign discount applied to discounted subtotal
- Tax calculated on final discounted amount
- All payment views use same calculation (useCheckoutTotals)

✅ **Database Integrity**
- All transactions logged correctly
- Order records complete
- Inventory deducted properly
- Loyalty points updated atomically

✅ **Error Handling**
- Card failures rollback correctly
- Clear error messages
- No orphaned orders
- Inventory holds released on failure

---

## Known Risks & Mitigation

### Risk 1: Card Failure After Cash Accepted
**Scenario**: Split payment - cash accepted, then card fails
**Mitigation**:
- Order marked CANCELLED
- Staff manually refunds cash
- Future: Implement cash reversal or retry mechanism

### Risk 2: Network Timeout
**Scenario**: Request times out during payment processing
**Mitigation**:
- Idempotency key prevents duplicate charges
- Order remains PENDING for manual review
- Staff can check payment processor directly

### Risk 3: Decimal Rounding Errors
**Scenario**: Split amounts don't sum to exact total due to rounding
**Mitigation**:
- Frontend validates split amounts sum to total (within 0.01)
- Backend validates as well
- Use Math.round((amount * 100)) / 100 for consistency

---

## Deployment Plan

### Pre-Deployment
1. [ ] Review all code changes
2. [ ] Test on staging with real payment terminals
3. [ ] Verify database migration 116 applied
4. [ ] Test rollback procedure

### Deployment Steps
1. [ ] Deploy database migration 116 (tier_qty column)
2. [ ] Deploy updated Edge Function
3. [ ] Deploy updated mobile app (or test via Expo)
4. [ ] Monitor Sentry for errors
5. [ ] Test one cash, one split, one card payment

### Post-Deployment Monitoring
- Monitor Sentry for payment errors (first 24 hours)
- Check payment_transactions table for anomalies
- Verify cash change complaints stop
- Confirm split payments charge correct amounts

### Rollback Plan
If critical issues found:
1. Revert Edge Function to previous version
2. Revert mobile app deployment
3. Keep migration 116 (safe, just adds columns)
4. Investigate and fix before re-deploying

---

## Test Results Log

| Test | Date | Tester | Result | Notes |
|------|------|--------|--------|-------|
| A1   |      |        |        |       |
| A2   |      |        |        |       |
| A3   |      |        |        |       |
| A4   |      |        |        |       |
| B1   |      |        |        |       |
| B2   |      |        |        |       |
| B3   |      |        |        |       |
| B4   |      |        |        |       |
| C1   |      |        |        |       |
| C2   |      |        |        |       |

---

## Conclusion

This test plan covers:
- ✅ All payment methods (cash, card, split)
- ✅ All discount combinations (loyalty, campaign, both)
- ✅ Edge cases (exact change, insufficient funds, rounding)
- ✅ Failure scenarios (card declines, timeouts)
- ✅ Database integrity
- ✅ Real-world scenarios

Following Apple's engineering principles:
1. **Test real-world use cases** - Not just happy paths
2. **Validate edge cases** - Rounding, small amounts, exact change
3. **Plan for failure** - Timeouts, declines, rollbacks
4. **Verify data integrity** - Database records, inventory, loyalty
5. **Document thoroughly** - Clear expected results for each test
