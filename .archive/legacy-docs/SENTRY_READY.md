# 🎉 Sentry Integration Complete - Ready to Test!

**Status:** ✅ FULLY CONFIGURED
**Date:** 2025-11-16
**Organization:** whaletools
**Project:** whaletools-native

---

## ✅ What's Been Completed

### 1. Package Installation
- ✅ `@sentry/react-native` v7.6.0 installed
- ✅ TypeScript errors fixed (Sentry API v7 compatibility)

### 2. Code Integration
- ✅ `src/utils/sentry.ts` - Sentry initialization
- ✅ `src/utils/logger.ts` - Logger with Sentry integration
- ✅ `App.tsx` - Sentry initialized and error boundary wrapped

### 3. Configuration Files
- ✅ `.env` - Created with your actual DSN and auth token
- ✅ `.sentryclirc` - CLI configuration with your credentials
- ✅ `app.json` - Sentry Expo plugin added
- ✅ `.gitignore` - Updated to protect sensitive files

### 4. Security
- ✅ `.env` in `.gitignore` (won't be committed)
- ✅ `.sentryclirc` in `.gitignore` (won't be committed)
- ✅ Sensitive data filters in place (passwords, cards, etc.)

---

## 🔑 Your Sentry Credentials

**Organization:** whaletools
**Project:** whaletools-native
**Project ID:** 4510373174771717

**DSN (configured in `.env`):**
```
https://084642e519a1cb616b4c02060327eb9a@o4510333066674176.ingest.us.sentry.io/4510373174771717
```

**Dashboard URL:**
```
https://sentry.io/organizations/whaletools/projects/whaletools-native/
```

---

## 🚀 Next Steps - Test It Now!

### Step 1: Rebuild the App

Since we just added the `.env` file with your DSN, you need to rebuild:

```bash
# Clear cache and start fresh
npm start -- --clear
```

When Metro bundler starts, press:
- **`i`** for iOS simulator
- **`a`** for Android emulator

### Step 2: Add Test Button (Temporary)

Open `App.tsx` and add this test button after the login form (around line 252):

```typescript
{/* TEMPORARY: Test Sentry - Remove after testing */}
<Button
  variant="secondary"
  size="large"
  fullWidth
  onPress={() => {
    logger.error('🧪 Sentry test error', new Error('Test from WhaleTools app'), {
      testType: 'integration-test',
      timestamp: new Date().toISOString(),
    })
    Alert.alert('Test Sent!', 'Check Sentry dashboard in 1-2 minutes')
  }}
  style={{ marginTop: spacing.lg }}
>
  🧪 TEST SENTRY
</Button>
```

**Note:** The `logger` import is already at the top of App.tsx (line 35)

### Step 3: Test in the App

1. Wait for app to rebuild and load
2. Press the "🧪 TEST SENTRY" button
3. You should see an alert: "Test Sent!"
4. Wait 1-2 minutes for Sentry to process

### Step 4: Check Sentry Dashboard

Go to your issues page:
```
https://sentry.io/organizations/whaletools/issues/
```

You should see a new error with:
- **Title:** "Test from WhaleTools app"
- **Context:** testType, timestamp
- **Device info:** iOS/Android model, OS version
- **Breadcrumbs:** Events leading up to the error

### Step 5: Remove Test Button

Once you confirm it works, remove the test button from App.tsx.

---

## 📊 What Sentry Tracks Automatically

### Errors (Automatically Captured)
- ✅ Unhandled JavaScript exceptions
- ✅ Unhandled promise rejections
- ✅ Native crashes (iOS/Android)
- ✅ React component errors (via error boundary)

### Performance (20% Sample Rate in Production)
- ✅ Screen load times
- ✅ API request duration
- ✅ User interactions

### Context (Attached to Every Error)
- ✅ Device model and OS
- ✅ App version (1.0.0)
- ✅ Breadcrumbs (recent user actions)
- ✅ Network state
- ✅ Battery and memory

### Security (Automatically Filtered)
- ❌ Passwords (removed)
- ❌ Card numbers (removed)
- ❌ CVV codes (removed)
- ❌ Authorization headers (removed)

---

## 🎯 Using the Logger in Your Code

Replace `console.log` with `logger` throughout your app:

### Development Logging
```typescript
import { logger } from '@/utils/logger'

// Debug logs (dev only, not sent to Sentry in production)
logger.debug('POS screen loaded', { productCount: products.length })
```

### Production Error Tracking
```typescript
// Catch and log errors
try {
  await processPayment(order)
} catch (error) {
  logger.error('Payment processing failed', error, {
    orderId: order.id,
    amount: order.total,
    paymentMethod: 'card'
  })
  // Show user-friendly error
  Alert.alert('Payment Failed', 'Please try again')
}
```

### User Context (After Login)
```typescript
// Set user context so errors show which user was affected
logger.setUser({
  id: user.id,
  email: user.email,
  username: user.display_name
})

// Clear on logout
logger.clearUser()
```

### Important Events
```typescript
// Track important business events
logger.info('Cash drawer opened', {
  registerId: register.id,
  locationId: location.id,
  cashierId: user.id
})
```

### Performance Tracking
```typescript
// Measure slow operations
const span = logger.startSpan('load-products', 'db.query')
const products = await loadProducts()
span.finish() // Adds breadcrumb with duration
```

---

## 🔧 Sentry Dashboard Features

### View Errors
**URL:** https://sentry.io/organizations/whaletools/issues/

Click any error to see:
- Full stack trace with source code context
- User who experienced the error
- Breadcrumbs (actions before error)
- Device and OS information
- How many users affected
- Frequency and trends

### Performance Monitoring
**URL:** https://sentry.io/organizations/whaletools/performance/

See:
- Slowest screens
- Slowest API endpoints
- Transaction throughput
- P50, P75, P95 percentiles

### Set Up Alerts
**URL:** https://sentry.io/organizations/whaletools/alerts/

Create alerts for:
- New issues created
- Error frequency spikes
- Performance degradation
- Specific error types

**Recommended Alert:**
1. Click "Create Alert"
2. Trigger: "When a new issue is created"
3. Action: "Send email to your-email@example.com"
4. Save

---

## 📈 Production Best Practices

### 1. Replace Console Statements
You have ~60 console.log statements (see CODEBASE_CLEANUP_AUDIT.md):
- Replace `console.log` → `logger.debug`
- Replace `console.info` → `logger.info`
- Replace `console.warn` → `logger.warn`
- Replace `console.error` → `logger.error`

### 2. Add Context to Errors
Always include context when logging errors:

```typescript
// ❌ Bad - No context
logger.error('API call failed', error)

// ✅ Good - Rich context
logger.error('API call failed', error, {
  endpoint: '/api/products',
  method: 'GET',
  locationId: session.locationId,
  userId: user.id,
  retryAttempt: 1
})
```

### 3. Set User Context Early
```typescript
// In your auth store, after successful login
logger.setUser({
  id: user.id,
  email: user.email,
  username: user.display_name
})

// Set additional context
logger.setContext('session', {
  sessionId: session.id,
  locationId: session.locationId,
  registerId: session.registerId
})

logger.setTag('location_id', session.locationId)
logger.setTag('register_id', session.registerId)
```

### 4. Monitor Weekly
- [ ] Check new errors
- [ ] Review error trends
- [ ] Analyze performance issues
- [ ] Update alerts if needed
- [ ] Archive resolved issues

---

## 🐛 Troubleshooting

### App Won't Start After Rebuild

**Issue:** Metro bundler or app crashes

**Fix:**
1. Clear everything: `npm start -- --clear`
2. Delete node_modules: `rm -rf node_modules && npm install`
3. Restart: `npm start`

### "Sentry not initialized" Warning

**Issue:** DSN not found in .env

**Check:**
```bash
# Verify .env exists
ls -la .env

# Verify DSN is present
grep EXPO_PUBLIC_SENTRY_DSN .env
```

**Fix:**
1. Make sure `.env` file exists in project root
2. Make sure it contains the DSN line
3. Restart Metro bundler: `npm start -- --clear`

### Test Error Not Appearing in Sentry

**Wait:** Sentry can take 1-2 minutes to process events

**Check:**
1. Internet connection is active
2. DSN is correct in `.env` (no spaces/typos)
3. App was rebuilt after creating `.env`
4. Console shows `[Sentry] Initialized successfully` (in dev mode)

**Still not working?**
1. Check console for Sentry errors
2. Verify DSN at: https://sentry.io/settings/whaletools/projects/whaletools-native/keys/
3. Try browser: https://sentry.io/organizations/whaletools/issues/

---

## 📚 Documentation

**Setup Guides:**
- `SENTRY_SETUP_GUIDE.md` - Comprehensive usage guide
- `SENTRY_CONFIGURATION_COMPLETE.md` - Configuration details
- `TEST_SENTRY.md` - Testing instructions (this file)

**Quick Reference:**
```typescript
import { logger } from '@/utils/logger'

// Logging
logger.debug(msg, context)  // Dev only
logger.info(msg, context)   // Important events
logger.warn(msg, context)   // Warnings
logger.error(msg, error, context)  // Errors

// User context
logger.setUser({ id, email, username })
logger.clearUser()

// Custom context
logger.setContext('session', { sessionId, locationId })
logger.setTag('location_id', locationId)

// Performance
const span = logger.startSpan('operation', 'category')
span.finish()
```

---

## ✅ Testing Checklist

Complete these steps in order:

- [ ] **Rebuild app:** `npm start -- --clear`
- [ ] **Start simulator:** Press `i` (iOS) or `a` (Android)
- [ ] **App loads successfully**
- [ ] **Console shows:** `[Sentry] Initialized successfully`
- [ ] **Add test button** to App.tsx
- [ ] **App hot-reloads** with test button
- [ ] **Press test button**
- [ ] **Alert appears:** "Test Sent!"
- [ ] **Wait 2 minutes**
- [ ] **Check Sentry:** https://sentry.io/organizations/whaletools/issues/
- [ ] **Error appears** in dashboard
- [ ] **Click error** and review details
- [ ] **Remove test button** from App.tsx
- [ ] **Commit changes** (without .env or .sentryclirc)

---

## 🎉 Success!

Once the test error appears in your Sentry dashboard, you're all set!

**Your app now has:**
- ✅ Production error monitoring
- ✅ Performance tracking
- ✅ User context for debugging
- ✅ Automatic crash reporting
- ✅ Security filters for sensitive data

**Next:**
1. Set up email alerts in Sentry
2. Start replacing console.log with logger
3. Add user context after login
4. Monitor errors in production

---

**Dashboard:** https://sentry.io/organizations/whaletools/projects/whaletools-native/
**Support:** https://docs.sentry.io/platforms/react-native/

🚀 Happy monitoring!
