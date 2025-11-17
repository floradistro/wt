# Test Sentry Integration ✅

**Status:** Ready to test
**Date:** 2025-11-16

---

## ✅ Configuration Complete

Your Sentry is now fully configured with your actual credentials:

- **Organization:** whaletools
- **Project:** whaletools-native (ID: 4510373174771717)
- **DSN:** Configured in `.env`
- **Auth Token:** Configured in `.env` and `.sentryclirc`

---

## 🧪 Test Sentry Now

### Option 1: Quick Test with Test Button (Recommended)

Add this temporary test button to your app:

**In `App.tsx`, add this import:**
```typescript
import { logger } from './src/utils/logger'
```

**Add this test button after your login form (around line 252):**
```typescript
{/* TEMPORARY: Test Sentry - Remove after testing */}
<Button
  variant="secondary"
  size="large"
  fullWidth
  onPress={() => {
    logger.error('🧪 Test error from Sentry integration', new Error('This is a test error'), {
      testType: 'manual',
      timestamp: new Date().toISOString(),
      userAgent: 'WhaleTools Native App'
    })
    Alert.alert('Test Sent!', 'Check your Sentry dashboard in 1-2 minutes')
  }}
  style={{ marginTop: spacing.lg }}
>
  🧪 TEST SENTRY
</Button>
```

### Option 2: Test with Console Command

```bash
# Start the app
npm start

# In the Expo terminal, press 'i' for iOS or 'a' for Android
```

Then in the app, try the test button.

---

## 📊 View Results in Sentry

1. **Go to your Sentry dashboard:**
   https://sentry.io/organizations/whaletools/projects/whaletools-native/

2. **Navigate to Issues:**
   https://sentry.io/organizations/whaletools/issues/

3. **Wait 1-2 minutes** after pressing the test button

4. **You should see:**
   - New issue: "This is a test error"
   - Full stack trace
   - Device information
   - Breadcrumbs leading up to the error
   - Context data (testType, timestamp, userAgent)

---

## 🎯 What to Look For

When you click on the error in Sentry, you should see:

### Error Details
- **Message:** "This is a test error"
- **Type:** Error
- **Level:** error

### Context
- `testType`: "manual"
- `timestamp`: (current time)
- `userAgent`: "WhaleTools Native App"

### Device Info
- Device model
- OS version
- App version: 1.0.0

### Breadcrumbs
- Previous app events and user actions

---

## ✅ Success Criteria

- [ ] Test button added to app
- [ ] App rebuilds successfully
- [ ] Test button pressed
- [ ] Alert appears: "Test Sent!"
- [ ] Wait 1-2 minutes
- [ ] Error appears in Sentry dashboard
- [ ] Error details show correct context
- [ ] Remove test button from code

---

## 🔧 Rebuild the App

Since we added the DSN to `.env`, you need to rebuild:

```bash
# Clear cache and restart
npm start -- --clear

# Or kill the current process and restart
# Ctrl+C to stop, then:
npm start
```

Then press 'i' for iOS or 'a' for Android.

---

## 🐛 Troubleshooting

### "Sentry not initialized" in console

**Problem:** DSN not being read from .env

**Fix:**
1. Make sure `.env` file exists: `ls -la .env`
2. Make sure it has the DSN: `grep SENTRY_DSN .env`
3. Restart metro bundler with `npm start -- --clear`

### Error not appearing in Sentry

**Wait:** It can take 1-2 minutes for errors to appear
**Check:**
1. Internet connection is active
2. DSN is correct in `.env`
3. App was rebuilt after adding `.env`

### "Invalid DSN" error

**Fix:**
1. Double-check the DSN in `.env` matches:
   ```
   https://084642e519a1cb616b4c02060327eb9a@o4510333066674176.ingest.us.sentry.io/4510373174771717
   ```
2. Make sure there are no extra spaces or line breaks

---

## 🎉 After Successful Test

1. **Remove the test button** from App.tsx
2. **Start using logger throughout your app:**

```typescript
import { logger } from '@/utils/logger'

// Replace console.log with logger
logger.debug('POS screen loaded', { productCount: products.length })

// Catch errors
try {
  await processPayment()
} catch (error) {
  logger.error('Payment failed', error, { orderId: order.id })
}

// Set user context after login
logger.setUser({
  id: user.id,
  email: user.email,
  username: user.display_name
})
```

---

## 📈 Production Monitoring

Once confirmed working:

1. **Set up alerts:**
   - Go to Alerts → Create Alert
   - Configure: "When a new issue is created, send email"

2. **Review weekly:**
   - Check new errors
   - Review performance issues
   - Update error handling based on insights

3. **Replace console.log:**
   - Find: 60 console statements in codebase (see CODEBASE_CLEANUP_AUDIT.md)
   - Replace with appropriate logger methods

---

## 🔗 Quick Links

- **Sentry Dashboard:** https://sentry.io/organizations/whaletools/projects/whaletools-native/
- **Issues:** https://sentry.io/organizations/whaletools/issues/
- **Performance:** https://sentry.io/organizations/whaletools/performance/
- **Alerts:** https://sentry.io/organizations/whaletools/alerts/
- **Project Settings:** https://sentry.io/settings/whaletools/projects/whaletools-native/

---

**Next Step:** Add test button to App.tsx and rebuild the app! 🚀
