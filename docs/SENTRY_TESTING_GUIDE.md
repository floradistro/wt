# Sentry Integration Testing Guide

Complete guide to testing and verifying Sentry integration in WhaleTools Native.

---

## Prerequisites

### 1. Sentry Account Setup

✅ **Create Sentry Account**
- Go to https://sentry.io/signup/
- Create account (free tier works fine for testing)

✅ **Create Project**
1. Click "Create Project"
2. Select "React Native" as platform
3. Name it "whaletools-native"
4. Click "Create Project"

✅ **Get Your DSN**
1. After project creation, you'll see your DSN
2. Format: `https://[KEY]@[ORG].ingest.sentry.io/[PROJECT_ID]`
3. Copy this - you'll need it for `.env`

✅ **Get Auth Token** (optional, for source maps)
1. Go to Settings → Account → API → Auth Tokens
2. Click "Create New Token"
3. Give it "project:write" and "org:read" scopes
4. Copy the token

---

## Configuration

### 1. Update .env File

Add your Sentry credentials to `.env`:

```bash
# Sentry Error Monitoring
EXPO_PUBLIC_SENTRY_DSN=https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID
SENTRY_AUTH_TOKEN=your_auth_token_here
```

### 2. Verify Initialization

Check `App.tsx` has Sentry initialized:

```typescript
import { initializeSentry } from '@/utils/sentry'

// At the very start of your app
initializeSentry()
```

### 3. Restart App

After adding DSN, restart your development server:

```bash
# Kill existing server
# Then restart
npx expo start --clear
```

---

## Testing Methods

### Method 1: Using Test Screen (Recommended)

#### Step 1: Add Test Screen to Navigation

**Option A: Quick Dev Route** (Temporary)

Add to your `DashboardNavigator.tsx` or main navigator:

```typescript
import { SentryTestScreen } from '@/screens/SentryTestScreen'

// Add to your Stack.Navigator
<Stack.Screen
  name="SentryTest"
  component={SentryTestScreen}
  options={{ title: 'Sentry Tests' }}
/>
```

**Option B: Hidden Dev Menu** (Better for production)

Add a secret gesture or dev menu option that opens the test screen.

#### Step 2: Run Tests

1. **Quick Test** (1 event)
   - Tap "⚡️ Quick Test"
   - Sends simple message to Sentry
   - Use this to verify basic connectivity

2. **Individual Tests**
   - Tap each test button individually
   - Good for focused testing

3. **Full Test Suite** (7 events)
   - Tap "🚀 Run All Tests"
   - Sends all test scenarios
   - Takes ~7 seconds

#### Step 3: Check Sentry Dashboard

1. Go to https://sentry.io/
2. Select your "whaletools-native" project
3. Click "Issues" in left sidebar
4. You should see new test errors

---

### Method 2: Manual Code Testing

#### Quick Console Test

Open your app's console and run:

```typescript
import { quickSentryTest } from '@/utils/test-sentry'

// In your component or screen
useEffect(() => {
  quickSentryTest()
}, [])
```

#### Comprehensive Test

```typescript
import { runAllSentryTests } from '@/utils/test-sentry'

// Button press or effect
const handleTest = async () => {
  await runAllSentryTests()
  console.log('Check Sentry dashboard!')
}
```

---

### Method 3: Real Payment Flow Testing

#### Test Real Payment Errors

1. **Go to POS Screen**
2. **Add items to cart**
3. **Try payment with invalid processor**
   - This will trigger real Sentry error
4. **Check Sentry for payment error**

#### Test Health Check Errors

1. **Configure invalid processor endpoint**
2. **Watch health checks fail**
3. **Check Sentry for health check errors**

---

## What to Check in Sentry Dashboard

### Issues Tab

You should see errors with these characteristics:

#### ✅ Error Capture Test
- **Title**: "TEST: Sentry error capture verification"
- **Tags**: `test:error_capture`, `feature:sentry_integration`
- **Extra Data**: Test description, timestamp

#### ✅ Breadcrumbs Test
- **Title**: "TEST: Breadcrumb trail verification"
- **Breadcrumbs**: 4 steps showing user journey
  1. User opened payment modal
  2. User selected credit card payment
  3. Payment processing started
  4. Error occurred

#### ✅ Context Test
- **Title**: "TEST: Context data verification"
- **Context Sections**:
  - `payment`: amount, type, processor info
  - `customer`: ID, name, loyalty points

#### ✅ Payment Error Test
- **Title**: "Payment took too long (3 min timeout)"
- **Level**: Warning
- **Context**: Full payment details
- **Tags**: `payment.method:card`, `error.type:timeout`
- **Breadcrumbs**: Payment flow steps

#### ✅ Health Check Error
- **Title**: "Health check timeout"
- **Context**: Processor details
- **Tags**: `processor.operation:health_check`

#### ✅ Checkout Error
- **Title**: "Failed to create sale: Database connection timeout"
- **Context**: Full checkout details (cart, customer, totals)
- **Tags**: `checkout.operation:create_sale`

---

### Performance Tab

Click "Performance" in left sidebar. You should see:

#### ✅ Transactions

1. **test_payment_flow**
   - Operation: `test.payment`
   - Shows 3 spans:
     - Validate payment data (~100ms)
     - Call payment API (~500ms)
     - Save transaction (~200ms)
   - Total: ~800ms

2. **card_payment** (from payment error test)
   - Operation: `payment.process`
   - Status: `deadline_exceeded`
   - Tagged with error type

3. **processor_health_check**
   - Operation: `processor.health`
   - Shows health check duration

4. **pos_checkout**
   - Operation: `checkout.process`
   - Shows RPC call span

---

## Verification Checklist

### Basic Integration ✅

- [ ] DSN configured in `.env`
- [ ] Sentry initialized in `App.tsx`
- [ ] Console shows "[Sentry] Initialized successfully"
- [ ] Quick test sends message to dashboard
- [ ] Errors appear in Issues tab
- [ ] Transactions appear in Performance tab

### Data Quality ✅

- [ ] Breadcrumbs show event sequence
- [ ] Context includes relevant data
- [ ] Tags are applied correctly
- [ ] Error messages are clear
- [ ] Stack traces are readable
- [ ] Measurements recorded (amounts, durations)

### Payment Flow Integration ✅

- [ ] Payment errors captured
- [ ] Payment context includes amount, processor
- [ ] Payment breadcrumbs show full flow
- [ ] Error types categorized (timeout, network, etc.)
- [ ] Performance transactions tracked

### Processor Integration ✅

- [ ] Health check errors captured
- [ ] Processor context included
- [ ] Health check duration measured
- [ ] Test transactions tracked

### Checkout Integration ✅

- [ ] Checkout errors captured
- [ ] Full cart details in context
- [ ] Customer info included
- [ ] Loyalty data tracked
- [ ] RPC call timing measured

---

## Troubleshooting

### Not Seeing Events in Dashboard?

**Check 1: DSN Configured**
```bash
# In your terminal
echo $EXPO_PUBLIC_SENTRY_DSN
```
Should output your DSN, not undefined.

**Check 2: Sentry Initialized**
Look for console message:
```
[Sentry] Initialized successfully
```

**Check 3: Network Connection**
- Sentry needs internet to send events
- Check if device/simulator has internet

**Check 4: Project Selection**
- Make sure you're looking at correct project in dashboard
- Check organization (if you have multiple)

**Check 5: Time Delay**
- Events can take 10-30 seconds to appear
- Refresh dashboard after waiting

---

### Events Missing Data?

**Breadcrumbs Not Showing:**
- Breadcrumbs must be added BEFORE error
- Check order of `addBreadcrumb()` calls

**Context Not Showing:**
- Context must be set BEFORE error
- Check `setContext()` is called

**Performance Not Showing:**
- Check `tracesSampleRate` in config
- Dev mode should be 1.0 (100%)
- Make sure transaction is finished

---

### Common Issues

#### "DSN not configured" Warning

**Problem**: `.env` file doesn't have DSN

**Solution**:
1. Copy `.env.example` to `.env`
2. Add your actual DSN
3. Restart server with `--clear` flag

#### Events Not Appearing

**Problem**: Various causes

**Solutions**:
1. Wait 30 seconds and refresh
2. Check internet connection
3. Verify DSN is correct (no typos)
4. Check Sentry project is active
5. Look at browser network tab for errors

#### Source Maps Not Working

**Problem**: Stack traces show minified code

**Solution**:
1. Add `SENTRY_AUTH_TOKEN` to `.env`
2. Install Sentry CLI: `npm install -g @sentry/cli`
3. Upload source maps after build

---

## Production Checklist

Before deploying to production:

### Configuration ✅

- [ ] Production DSN in production `.env`
- [ ] `tracesSampleRate` set to 0.2 (20%)
- [ ] Source maps uploaded
- [ ] Release version configured
- [ ] Environment set to "production"

### Privacy ✅

- [ ] `beforeSend` filters PII (implemented ✅)
- [ ] `beforeBreadcrumb` filters sensitive data (implemented ✅)
- [ ] No card numbers in logs
- [ ] No CVV/PIN in errors
- [ ] Auth tokens filtered

### Alerts ✅

Set up alerts in Sentry:

1. **High Error Rate**
   - Alert when error rate > 5% in 5 minutes
   - Send to Slack/Email

2. **Payment Failures**
   - Alert when payment errors > 10 in 10 minutes
   - Critical priority

3. **Health Check Failures**
   - Alert when processor offline errors > 3
   - High priority

4. **Performance Degradation**
   - Alert when p95 transaction time > 60s
   - Medium priority

---

## Reference Commands

### Quick Test from Console

```javascript
import { quickSentryTest } from '@/utils/test-sentry'
quickSentryTest()
```

### Full Test Suite

```javascript
import { runAllSentryTests } from '@/utils/test-sentry'
await runAllSentryTests()
```

### Individual Tests

```javascript
import {
  testSentryErrorCapture,
  testSentryBreadcrumbs,
  testSentryContext,
  testSentryPerformance,
  testPaymentError,
  testProcessorHealthError,
  testCheckoutError,
} from '@/utils/test-sentry'

testPaymentError()      // Test payment timeout
testCheckoutError()     // Test transaction save failure
```

---

## Sentry Dashboard Links

**Main Dashboard**: https://sentry.io/

**Issues**: `https://sentry.io/organizations/YOUR_ORG/issues/`

**Performance**: `https://sentry.io/organizations/YOUR_ORG/performance/`

**Alerts**: `https://sentry.io/organizations/YOUR_ORG/alerts/`

**Settings**: `https://sentry.io/settings/YOUR_ORG/projects/whaletools-native/`

---

## Success Criteria

Your Sentry integration is working correctly when:

✅ Test events appear in dashboard within 30 seconds
✅ Breadcrumbs show complete event trail
✅ Context data is rich and useful
✅ Tags enable filtering by error type
✅ Performance transactions track timing
✅ No PII/sensitive data in errors
✅ Real payment errors are captured
✅ Stack traces are readable

---

**Status**: Production Ready ✅
**Last Updated**: 2025-11-17
**Next Steps**: Set up production alerts

