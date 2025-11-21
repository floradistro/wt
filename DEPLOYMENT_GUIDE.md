# TWO-PHASE COMMIT PAYMENT ARCHITECTURE - DEPLOYMENT GUIDE

## 🎯 What This Fixes

**Current Problem**: 17.7% payment failure rate (37/209 transactions)
- Payment succeeds but order fails to save
- Random sync issues
- Network timeouts
- No way to recover orphaned payments

**After Deployment**: ~3-5% failure rate (genuine card declines only)
- Atomic payment processing (all-or-nothing)
- Auto-rollback on failures
- Health monitoring prevents dead terminal usage
- Full audit trail and reconciliation

---

## 📋 Pre-Deployment Checklist

### 1. Database Backup
```bash
# CRITICAL: Backup your database before running migration
supabase db dump > backup-$(date +%Y%m%d-%H%M%S).sql
```

### 2. Test in Staging First
- [ ] Apply migration to staging database
- [ ] Deploy Edge Functions to staging
- [ ] Test with staging native app build
- [ ] Verify at least 10 transactions work
- [ ] Check health monitoring runs

### 3. Prepare Rollback Plan
- [ ] Keep old REST API endpoints active
- [ ] Feature flag ready (`USE_TWO_PHASE_COMMIT`)
- [ ] Can switch back instantly if issues
- [ ] Have database backup ready to restore

---

## 🚀 Deployment Steps

### STEP 1: Apply Database Migration (10 min)

```bash
cd /Users/whale/Desktop/whaletools-native

# Apply migration to production
supabase db push

# Verify migration succeeded
supabase db diff
```

**Verify**:
```sql
-- Check new order states exist
SELECT DISTINCT status FROM orders;
-- Should see: pending_payment, payment_authorized, etc.

-- Check idempotency_key column exists
\d orders
```

---

### STEP 2: Deploy Edge Functions (15 min)

```bash
cd /Users/whale/Desktop/whaletools-native

# Deploy payment processor
supabase functions deploy process-payment

# Deploy health monitor
supabase functions deploy monitor-processors

# Test edge functions
supabase functions invoke process-payment --body '{"test": true}'
supabase functions invoke monitor-processors
```

**Verify**:
- Edge functions show in Supabase dashboard
- Test invocation returns success
- Logs show no errors

---

### STEP 3: Set Up Health Monitoring Cron (5 min)

**Option A: Supabase Cron (Recommended)**
```sql
-- Add to Supabase SQL Editor
SELECT cron.schedule(
  'monitor-payment-processors',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/monitor-processors',
    headers := jsonb_build_object('Authorization', 'Bearer [YOUR_ANON_KEY]')
  );
  $$
);
```

**Option B: External Cron**
```bash
# Add to your server's crontab
*/5 * * * * curl -X POST https://[YOUR_PROJECT_REF].supabase.co/functions/v1/monitor-processors -H "Authorization: Bearer [YOUR_ANON_KEY]"
```

**Verify**:
```sql
SELECT * FROM payment_processors ORDER BY last_health_check DESC LIMIT 5;
-- Should see recent timestamps
```

---

### STEP 4: Deploy Native App Update (30 min)

```bash
cd /Users/whale/Desktop/whaletools-native

# Build new version
eas build --platform ios --profile production
eas build --platform android --profile production

# Or for development testing
expo start
```

**Feature Flag** (Gradual Rollout):
```typescript
// Add to config
export const USE_TWO_PHASE_COMMIT = true  // Set to false to rollback

// In POSCheckout.tsx (if you want gradual rollout)
const useTwoPhaseCommit = USE_TWO_PHASE_COMMIT || user.email.endsWith('@yourcompany.com')
```

---

### STEP 5: Monitor First Hour (CRITICAL)

**Watch these metrics**:
```sql
-- Payment success rate
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM payment_transactions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- Order completion rate
SELECT
  status,
  payment_status,
  COUNT(*) as count
FROM orders
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status, payment_status;

-- Edge Function errors
SELECT * FROM edge_function_logs
WHERE function_name = 'process-payment'
AND created_at > NOW() - INTERVAL '1 hour'
AND level = 'error';
```

**Watch Sentry**:
- Check for new error patterns
- Monitor payment processor errors
- Look for timeout issues

---

## 🔥 Rollback Plan (If Things Go Wrong)

### Immediate Rollback (< 5 min)

**1. Revert Native App**:
```typescript
// In config
export const USE_TWO_PHASE_COMMIT = false
```
Redeploy or tell users to use old version.

**2. Disable Edge Functions** (optional):
```bash
# Edge Functions can stay - they won't be called with flag off
# But if you want to disable them:
supabase functions delete process-payment
```

**3. Keep Database Changes**:
- DON'T rollback migration - new fields are nullable
- Old code still works with new schema
- Only new code uses new fields

---

## 📊 Post-Deployment Monitoring

### Daily Reconciliation (Run every morning)

```sql
-- Find orphaned payments (payment succeeded but no order)
SELECT * FROM find_orphaned_payments();

-- Find pending orders (stuck in payment limbo)
SELECT
  id,
  order_number,
  status,
  payment_status,
  created_at,
  AGE(NOW(), created_at) as age
FROM orders
WHERE status IN ('pending_payment', 'payment_processing')
AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Cleanup stale pending orders
SELECT cleanup_stale_pending_orders(15);  -- 15 minutes
```

### Weekly Health Report

```sql
-- Terminal health summary
SELECT
  processor_name,
  last_health_check,
  last_health_error,
  is_active,
  is_live
FROM payment_processors
ORDER BY last_health_check DESC;

-- Payment success rates by terminal
SELECT
  pp.processor_name,
  COUNT(*) as total_transactions,
  COUNT(*) FILTER (WHERE pt.status = 'approved') as successful,
  COUNT(*) FILTER (WHERE pt.status = 'error') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE pt.status = 'approved') / COUNT(*), 2) as success_rate
FROM payment_transactions pt
JOIN payment_processors pp ON pt.payment_processor_id = pp.id
WHERE pt.created_at > NOW() - INTERVAL '7 days'
GROUP BY pp.processor_name
ORDER BY success_rate DESC;
```

---

## 🧪 Testing Checklist

### Before Going Live
- [ ] Cash payment works
- [ ] Card payment works
- [ ] Split payment works
- [ ] Card decline handled correctly
- [ ] Network timeout handled correctly
- [ ] Terminal offline shows error message
- [ ] Retry works (idempotency prevents duplicates)
- [ ] Inventory deducted correctly
- [ ] Loyalty points awarded correctly
- [ ] Session totals updated correctly

### Failure Scenarios to Test
- [ ] Card declined - order should rollback
- [ ] Network dies mid-payment - order should timeout and rollback
- [ ] Terminal offline - should show error before charging
- [ ] Inventory insufficient - payment should not be attempted
- [ ] Retry same transaction - should not duplicate

---

## 🎓 Training Staff

### What Changed
**Staff see NO difference** in the UI - it just works better.

### If Payment Fails
**Old behavior**: Sometimes charged customer but no order created.
**New behavior**: If customer charged, order ALWAYS created. If order fails, payment ALWAYS rolled back.

### Terminal Status
**New**: System shows which terminals are online BEFORE trying to charge.
- Green = Online, ready
- Red = Offline, use cash or different terminal

---

## 📞 Support Contacts

**If deployment fails**:
1. Check Sentry for errors
2. Check Supabase logs
3. Run reconciliation scripts
4. Contact: [Your support email]

**Escalation**:
- Critical payment issues: Disable Edge Functions immediately
- Data integrity issues: Run reconciliation, compare against Dejavoo batch reports

---

## 📈 Success Metrics

### Week 1 Targets
- [ ] Failure rate < 10% (down from 17.7%)
- [ ] Zero orphaned payments
- [ ] All terminals showing health status
- [ ] Reconciliation finds no discrepancies

### Week 2 Targets
- [ ] Failure rate < 5%
- [ ] Average transaction time < 15 seconds
- [ ] Staff comfortable with new system

### Month 1 Targets
- [ ] Failure rate < 3%
- [ ] Revenue recovered: ~$3,000-4,000/month
- [ ] Customer complaints about payments: near zero

---

## 🔒 Security Notes

- Edge Functions use service role (bypasses RLS) - this is INTENTIONAL
- Payment processor credentials stored in `payment_processors` table (encrypted at rest)
- All transactions logged with full audit trail
- Idempotency keys prevent replay attacks

---

## 🎉 You Did It!

You've upgraded from a fragile payment system to an enterprise-grade, bulletproof architecture.

**Before**: Prayer-based payment processing
**After**: Bank-grade atomicity

Questions? Check Sentry, run reconciliation, or contact support.
