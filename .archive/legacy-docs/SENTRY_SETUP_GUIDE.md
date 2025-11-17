# Sentry Setup Guide - Production Error Monitoring

**Status:** ✅ Installed and Configured
**Priority:** 🔴 CRITICAL for production

---

## 🎯 Why Sentry for React Native?

Sentry is **essential** for React Native apps because:

1. **Production Crashes** - See errors on users' devices you can't access
2. **Native Crashes** - Track iOS/Android native code crashes
3. **Performance Monitoring** - Identify slow screens and operations
4. **Release Tracking** - Know which app version has issues
5. **Real-time Alerts** - Get notified when errors spike
6. **User Context** - See which users are affected

**Bottom Line:** Without Sentry, you're flying blind in production!

---

## 📦 What's Been Installed

### Packages Added

```bash
@sentry/react-native  # Core Sentry SDK for React Native
```

### Files Created

1. **`src/utils/sentry.ts`** - Sentry initialization
2. **`src/utils/logger.ts`** - Logger utility with Sentry integration
3. **`.env.example`** - Updated with Sentry DSN

### Files Modified

1. **`App.tsx`** - Sentry initialization and error boundary
2. **`.env.example`** - Added EXPO_PUBLIC_SENTRY_DSN

---

## 🚀 Getting Started (5 Minutes)

### Step 1: Create Sentry Account

1. Go to https://sentry.io/signup/
2. Sign up for free (100k events/month included!)
3. Create a new project:
   - **Platform:** React Native
   - **Name:** WhaleTools Native
   - **Team:** Your team name

### Step 2: Get Your DSN

1. After creating the project, Sentry will show you a DSN (Data Source Name)
2. It looks like: `https://abc123@o123456.ingest.sentry.io/789012`
3. Copy this DSN - you'll need it next

### Step 3: Add DSN to Environment

1. Open `.env` file (create if it doesn't exist)
2. Add your Sentry DSN:

```bash
# Sentry Error Monitoring
EXPO_PUBLIC_SENTRY_DSN=https://your-actual-dsn-here@o123456.ingest.sentry.io/789012
```

**Important:**
- ✅ Add to `.env` (private, not committed)
- ❌ Don't commit DSN to git!
- ✅ `.env` is already in `.gitignore`

### Step 4: Verify Setup

```bash
# Rebuild app
npm run ios
# or
npm run android

# Check console for:
# [Sentry] Initialized successfully
```

---

## 📝 How to Use the Logger

### Replace Console Logs

**Before (Old Way):**
```typescript
console.log('[POS] Loading products')        // ❌ Development only
console.error('[API] Failed to fetch', error) // ❌ Not tracked
```

**After (New Way):**
```typescript
import { logger } from '@/utils/logger'

logger.debug('[POS] Loading products')       // ✅ Dev only, tracked
logger.error('[API] Failed to fetch', error)  // ✅ Sent to Sentry!
```

### Logger Methods

#### 1. `logger.debug()` - Development Only

Use for verbose logging, troubleshooting:

```typescript
logger.debug('Cart updated', {
  itemCount: cart.length,
  total: total
})
```

- ✅ Shows in dev console
- ❌ Not shown in production (performance)
- ✅ Added as Sentry breadcrumb (context for errors)

#### 2. `logger.info()` - Important Events

Use for significant events:

```typescript
logger.info('Payment completed', {
  orderId: order.id,
  amount: total,
  method: 'card'
})
```

- ✅ Shows in dev console
- ✅ Added as Sentry breadcrumb
- 📊 Helps understand user flow before errors

#### 3. `logger.warn()` - Warnings

Use for potential issues, fallbacks:

```typescript
logger.warn('Using fallback payment processor', {
  requestedProcessor: 'dejavoo',
  fallback: 'manual'
})
```

- ✅ Shows in dev/prod console
- ✅ Added as Sentry breadcrumb
- 📊 Captured in Sentry (production only)

#### 4. `logger.error()` - Errors

Use for caught exceptions, failures:

```typescript
try {
  await processPayment()
} catch (error) {
  logger.error('Payment processing failed', error, {
    orderId: order.id,
    amount: total
  })
}
```

- ✅ Shows in dev/prod console
- ✅ Captured in Sentry immediately
- 🚨 Creates error report with full context

### User Context

Set user info after login:

```typescript
import { logger } from '@/utils/logger'

// After successful login
logger.setUser({
  id: user.id,
  email: user.email,
  username: user.display_name
})

// On logout
logger.clearUser()
```

Now all errors will show which user was affected!

### Session Context

Set session/location context:

```typescript
// When session starts
logger.setContext('session', {
  sessionId: sessionInfo.sessionId,
  locationId: sessionInfo.locationId,
  registerId: sessionInfo.registerId,
  locationName: sessionInfo.locationName
})

// Now errors will include session context
logger.setTag('location_id', sessionInfo.locationId)
logger.setTag('register_id', sessionInfo.registerId)
```

### Performance Tracking

Track slow operations:

```typescript
import { logger } from '@/utils/logger'

// Start performance span
const span = logger.startSpan('load-products', 'db.query')

// Do work
await loadProducts()

// Finish span (adds breadcrumb with duration)
span.finish()
```

---

## 🎯 What Gets Tracked Automatically

Sentry automatically tracks:

### Errors

- ✅ Unhandled exceptions (crashes)
- ✅ Unhandled promise rejections
- ✅ Native crashes (iOS/Android)
- ✅ React component errors (via error boundary)

### Performance

- ✅ Screen load times
- ✅ Network requests (fetch/axios)
- ✅ User interactions (taps, swipes)
- ✅ Component render times

### Context

- ✅ Device info (model, OS version)
- ✅ App version
- ✅ User actions (breadcrumbs)
- ✅ Network state
- ✅ Battery level
- ✅ Memory usage

---

## 🔒 Security & Privacy

### What We Filter

The Sentry config automatically filters sensitive data:

**Removed from errors:**
- ❌ Passwords
- ❌ Card numbers
- ❌ CVV codes
- ❌ PINs
- ❌ Authorization headers
- ❌ Cookies

**How it works:**
```typescript
// In src/utils/sentry.ts
beforeSend(event) {
  // Remove sensitive data
  delete event.extra?.password
  delete event.extra?.cardNumber
  delete event.extra?.cvv
  return event
}
```

### Best Practices

1. ✅ **Never log sensitive data**
   ```typescript
   // ❌ Bad
   logger.debug('Payment data', { cardNumber, cvv })

   // ✅ Good
   logger.debug('Payment processed', { last4: card.last4 })
   ```

2. ✅ **Use context instead of logging PII**
   ```typescript
   // ❌ Bad
   logger.error('Error for user@email.com')

   // ✅ Good
   logger.setUser({ id: user.id, email: user.email })
   logger.error('User error occurred')
   ```

---

## 📊 Using the Sentry Dashboard

### View Errors

1. Go to https://sentry.io/
2. Select your project
3. Click "Issues" to see errors
4. Click any error to see:
   - Stack trace
   - User context
   - Breadcrumbs (events before error)
   - Device info
   - Tags (location, register, etc.)

### Set Up Alerts

1. Go to **Alerts** → **Create Alert**
2. Configure:
   - **When:** New error appears
   - **Then:** Email your team
3. Save alert

### View Performance

1. Click **Performance** tab
2. See:
   - Slowest screens
   - Slowest API calls
   - Transaction trends
   - User impact

### Releases

Track which version has issues:

1. Click **Releases** tab
2. See errors by app version
3. Know when to roll back

---

## 🧪 Testing Sentry Integration

### Test Error Capture

Add this button temporarily to test:

```typescript
import { logger } from '@/utils/logger'

// In your component
<Button onPress={() => {
  logger.error('Test error', new Error('This is a test'))
}}>
  Test Sentry
</Button>
```

1. Press button
2. Check Sentry dashboard (may take 1-2 minutes)
3. You should see the error!
4. Remove test button

### Test Crash Handling

```typescript
// Force a crash (test only!)
<Button onPress={() => {
  throw new Error('Crash test')
}}>
  Test Crash
</Button>
```

This will crash the app and send a report to Sentry.

---

## 📈 Production Monitoring

### What to Monitor

1. **Error Rate**
   - Spikes indicate new bugs
   - Track after releases

2. **Affected Users**
   - How many users hit errors
   - Prioritize fixes by impact

3. **Performance**
   - Slow screens
   - Slow API calls
   - Memory issues

4. **Releases**
   - Compare error rates between versions
   - Know when to rollback

### Weekly Checklist

- [ ] Review new errors
- [ ] Check error trends
- [ ] Review performance issues
- [ ] Update alert thresholds
- [ ] Archive resolved issues

---

## 🔧 Advanced Configuration

### Environment-Specific Settings

Already configured in `src/utils/sentry.ts`:

```typescript
// Development
- 100% performance sampling
- All breadcrumbs enabled
- Console warnings shown

// Production
- 20% performance sampling (cost optimization)
- Filtered sensitive data
- Optimized for performance
```

### Custom Integrations

Add more tracking:

```typescript
import * as Sentry from '@sentry/react-native'

// Track Redux state
Sentry.addIntegration(new Sentry.ReduxIntegration())

// Track specific libraries
Sentry.addIntegration(new Sentry.HttpIntegration())
```

### Source Maps

For better stack traces (future):

```bash
# Upload source maps to Sentry
npx @sentry/cli upload-sourcemaps ./build
```

---

## 💰 Cost & Limits

### Free Tier (Current)

- ✅ 100,000 events/month
- ✅ 30-day retention
- ✅ 1 team member
- ✅ Unlimited projects

**Enough for:** Small to medium apps (5,000-10,000 active users)

### When to Upgrade

Upgrade when you hit:
- ❌ 100k events/month limit
- ❌ Need more team members
- ❌ Need longer retention (90+ days)

**Team Plan:** $26/month for 500k events

---

## 🚨 Troubleshooting

### Sentry Not Initializing

**Issue:** No logs, no events in dashboard

**Fix:**
1. Check `.env` file exists
2. Verify DSN is correct
3. Rebuild app: `npm run ios`
4. Check console for `[Sentry] Initialized successfully`

### Events Not Appearing

**Issue:** Errors logged but not in dashboard

**Fix:**
1. Wait 1-2 minutes (Sentry has delay)
2. Check internet connection
3. Verify DSN is correct
4. Check Sentry project is active

### Too Many Events

**Issue:** Hitting 100k limit quickly

**Fix:**
1. Reduce `tracesSampleRate` in `sentry.ts`
2. Filter out noisy errors in `beforeSend`
3. Upgrade to paid plan

---

## ✅ Next Steps

1. **Set up Sentry account** (5 min)
2. **Add DSN to .env** (1 min)
3. **Test error tracking** (2 min)
4. **Set up alerts** (3 min)
5. **Replace console.log with logger** (ongoing)

---

## 📚 Resources

- **Sentry Docs:** https://docs.sentry.io/platforms/react-native/
- **Best Practices:** https://docs.sentry.io/product/best-practices/
- **Support:** support@sentry.io
- **Status:** https://status.sentry.io/

---

**Generated:** 2025-11-16
**Status:** ✅ Ready to use
**Priority:** 🔴 CRITICAL for production

**Bottom Line:** Sentry is now set up! Add your DSN to `.env`, rebuild the app, and you'll have production-grade error monitoring. Replace `console.log` with `logger` throughout the codebase for best results. 🎯
