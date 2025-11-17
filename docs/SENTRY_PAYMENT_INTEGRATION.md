# Sentry Integration - Payment System

## Overview

Comprehensive Sentry error tracking and performance monitoring integrated throughout the entire payment flow, following Apple engineering standards.

---

## Integration Points

### 1. POSPaymentModal - Card Payment Processing

**File:** `src/components/pos/POSPaymentModal.tsx`

**Features:**
- Performance transaction monitoring
- Payment context tracking
- Breadcrumb trail through payment stages
- Comprehensive error categorization
- Retry-ability tagging

**Implementation:**

```typescript
// Start transaction for performance monitoring
const transaction = Sentry.startTransaction({
  name: 'card_payment',
  op: 'payment.process',
})

// Set payment context
Sentry.setContext('payment', {
  type: 'card',
  amount: total,
  itemCount,
  hasProcessor: !!currentProcessor,
  processorName: currentProcessor?.processor_name,
  locationId,
  registerId,
})

// Breadcrumbs through payment stages
Sentry.addBreadcrumb({
  category: 'payment',
  message: 'Payment stage: initializing',
  level: 'info',
})

// API call tracking
const apiSpan = transaction.startChild({
  op: 'http.client',
  description: 'POST /api/pos/payment/process',
})
apiSpan.setHttpStatus(response.status)
apiSpan.finish()

// Success tracking
transaction.setStatus('ok')
transaction.setTag('payment.result', 'success')
transaction.setMeasurement('payment.amount', total, 'usd')
transaction.finish()

// Error tracking with full context
Sentry.captureException(error, {
  level: isTimeout ? 'warning' : 'error',
  contexts: {
    payment: {
      type: 'card',
      amount: total,
      stage: paymentStage,
      errorType,
      isTimeout,
      shouldRetry,
    },
    processor: {
      id: currentProcessor?.processor_id,
      name: currentProcessor?.processor_name,
    },
  },
  tags: {
    'payment.method': 'card',
    'error.type': errorType,
    'payment.retryable': shouldRetry.toString(),
  },
})
```

---

## Payment Stages Tracked

### Breadcrumb Trail

1. **Payment Initiated**
   ```typescript
   {
     category: 'payment',
     message: 'Card payment initiated',
     level: 'info',
     data: { amount, itemCount, processorStatus }
   }
   ```

2. **Processor Validation**
   ```typescript
   {
     category: 'payment',
     message: 'Processor validation passed',
     level: 'info'
   }
   ```

3. **Initializing**
   ```typescript
   {
     category: 'payment',
     message: 'Payment stage: initializing',
     level: 'info'
   }
   ```

4. **Sending to Terminal**
   ```typescript
   {
     category: 'payment',
     message: 'Payment stage: sending to terminal',
     level: 'info'
   }
   ```

5. **Waiting for Customer**
   ```typescript
   {
     category: 'payment',
     message: 'Payment stage: waiting for customer',
     level: 'info'
   }
   ```

6. **Processing Authorization**
   ```typescript
   {
     category: 'payment',
     message: 'Payment stage: processing authorization',
     level: 'info',
     data: { httpStatus }
   }
   ```

7. **Response Validated**
   ```typescript
   {
     category: 'payment',
     message: 'Payment response validated successfully',
     level: 'info',
     data: { hasAuthCode, hasTransactionId, cardType }
   }
   ```

8. **Approving**
   ```typescript
   {
     category: 'payment',
     message: 'Payment stage: approving',
     level: 'info'
   }
   ```

9. **Success**
   ```typescript
   {
     category: 'payment',
     message: 'Payment approved successfully',
     level: 'info',
     data: { cardType, cardLast4 }
   }
   ```

---

## Error Types Tracked

### 1. Timeout
```typescript
{
  errorType: 'timeout',
  level: 'warning',
  retryable: true,
  message: 'Payment took too long (3 min timeout)'
}
```

### 2. Session Expired
```typescript
{
  errorType: 'session_expired',
  level: 'error',
  retryable: false,
  message: 'Session expired. Please log in again.'
}
```

### 3. Terminal Offline
```typescript
{
  errorType: 'terminal_offline',
  level: 'error',
  retryable: true,
  message: 'Payment terminal is offline.'
}
```

### 4. Network Error
```typescript
{
  errorType: 'network_error',
  level: 'error',
  retryable: true,
  message: 'Network connection lost.'
}
```

### 5. Invalid Response
```typescript
{
  errorType: 'invalid_response',
  level: 'error',
  retryable: true,
  message: 'Invalid response from payment server.'
}
```

### 6. Generic Error
```typescript
{
  errorType: 'generic_error',
  level: 'error',
  retryable: true
}
```

---

## Performance Metrics

### Tracked Measurements

1. **Payment Amount**
   ```typescript
   transaction.setMeasurement('payment.amount', total, 'usd')
   ```

2. **API Call Duration**
   - Automatically tracked via Sentry span
   - Includes network roundtrip time
   - Terminal processing time

3. **Total Transaction Time**
   - From payment initiation to completion
   - Includes all stages and customer interaction

### Expected Performance

| Stage | Expected Duration |
|-------|------------------|
| Initializing | <100ms |
| Sending | <300ms |
| Waiting (Customer) | 5-30 seconds |
| Processing | 1-5 seconds |
| Approving | <500ms |
| **Total (Success)** | **15-40 seconds** |
| **Total (Timeout)** | **180 seconds** |

---

## Sentry Queries

### Find Payment Errors

```
error.message:payment OR error.type:*payment*
```

### Find Specific Error Types

```
tags.error.type:timeout
tags.error.type:terminal_offline
tags.error.type:network_error
tags.error.type:session_expired
```

### Find Retryable Errors

```
tags.payment.retryable:true
```

### Filter by Payment Method

```
tags.payment.method:card
tags.payment.method:cash
tags.payment.method:split
```

### Performance Monitoring

```
transaction.op:payment.process
transaction.name:card_payment
```

### Find High-Value Transactions

```
measurements.payment.amount:>100
```

---

## Alert Configuration

### Recommended Alerts

1. **High Error Rate**
   ```
   Alert when: Payment error rate > 5% in 5 minutes
   Query: tags.payment.method:* AND level:error
   ```

2. **Terminal Offline**
   ```
   Alert when: >3 terminal_offline errors in 5 minutes
   Query: tags.error.type:terminal_offline
   ```

3. **Timeout Spike**
   ```
   Alert when: >5 timeout errors in 10 minutes
   Query: tags.error.type:timeout
   ```

4. **Session Expiry Pattern**
   ```
   Alert when: >10 session_expired errors in 1 hour
   Query: tags.error.type:session_expired
   ```

5. **Slow Payments**
   ```
   Alert when: p95 transaction duration > 60 seconds
   Transaction: card_payment
   ```

---

## Data Privacy

### PII Protection

**Automatically filtered in `src/utils/sentry.ts`:**

```typescript
beforeSend(event) {
  // Filter sensitive data from error reports
  if (event.request?.headers) {
    delete event.request.headers.Authorization
    delete event.request.headers['X-Auth-Token']
  }

  if (event.extra) {
    delete event.extra.password
    delete event.extra.cardNumber
    delete event.extra.cvv
    delete event.extra.pin
  }

  return event
}

beforeBreadcrumb(breadcrumb) {
  // Filter sensitive data from breadcrumbs
  if (breadcrumb.data) {
    delete breadcrumb.data.password
    delete breadcrumb.data.cardNumber
    delete breadcrumb.data.cvv
    delete breadcrumb.data.pin
  }

  return breadcrumb
}
```

### Safe to Track

✅ Payment amount
✅ Card type (VISA, MC, etc.)
✅ Card last 4 digits
✅ Transaction ID
✅ Authorization code
✅ Processor name
✅ Error messages

### Never Tracked

❌ Full card number
❌ CVV
❌ PIN
❌ Auth tokens (filtered)
❌ Passwords

---

## Debugging with Sentry

### Using Breadcrumbs

Breadcrumbs show the exact path through the payment flow before an error:

```
1. Card payment initiated (amount: $42.50)
2. Processor validation passed
3. Payment stage: initializing
4. Payment stage: sending to terminal
5. Payment stage: waiting for customer
6. Payment stage: processing authorization (HTTP 200)
7. ERROR: Failed to parse payment response
```

This tells you:
- Payment reached the API successfully
- API returned HTTP 200
- Error occurred during response parsing
- Likely a malformed JSON response

### Using Context

Context provides snapshot of payment state:

```json
{
  "payment": {
    "type": "card",
    "amount": 42.50,
    "stage": "processing",
    "errorType": "invalid_response",
    "isTimeout": false,
    "shouldRetry": true
  },
  "processor": {
    "id": "abc-123",
    "name": "Dejavoo POS 1"
  }
}
```

### Using Tags

Tags enable quick filtering and categorization:

```
payment.method = card
error.type = invalid_response
payment.retryable = true
payment.result = failure
```

---

## Success Metrics

### KPIs to Monitor

1. **Payment Success Rate**
   - Target: >95%
   - Query: `transaction.status:ok / total payments`

2. **Timeout Rate**
   - Target: <2%
   - Query: `tags.error.type:timeout / total payments`

3. **Retry Success Rate**
   - Target: >80%
   - Query: Successful payments after retry

4. **Average Payment Duration**
   - Target: <30 seconds
   - Query: `avg(transaction.duration) WHERE transaction.name:card_payment`

5. **Terminal Availability**
   - Target: >99%
   - Query: `1 - (terminal_offline_errors / total_health_checks)`

---

## Troubleshooting Guide

### High Timeout Rate

**Symptoms:**
- >5% payments timing out
- Sentry shows `error.type:timeout` spike

**Investigation:**
1. Check breadcrumbs - which stage are timeouts occurring?
2. Check terminal connectivity
3. Review network latency metrics
4. Check if pattern is location-specific

**Solutions:**
- Restart terminal
- Check network configuration
- Contact processor support

### Frequent Invalid Response Errors

**Symptoms:**
- `error.type:invalid_response` increasing
- HTTP 200 responses that can't be parsed

**Investigation:**
1. Check error context for response preview
2. Look for pattern in timestamps
3. Check if backend was deployed recently

**Solutions:**
- Review backend API changes
- Add response logging temporarily
- Contact backend team

### Terminal Offline Pattern

**Symptoms:**
- Repeated `error.type:terminal_offline`
- Clustered by location

**Investigation:**
1. Filter by location_id
2. Check activity log for last successful connection
3. Review processor health check history

**Solutions:**
- Check terminal power/network
- Verify processor configuration
- Check RLS policies

---

## Testing Sentry Integration

### Manual Testing Checklist

- [ ] Successful payment tracked with correct amount
- [ ] All payment stages appear in breadcrumbs
- [ ] Timeout error captured with warning level
- [ ] Network error captured with error level
- [ ] Terminal offline error captured
- [ ] Session expiry error captured
- [ ] Transaction marked as success/failure correctly
- [ ] No PII leaked in error reports
- [ ] Performance metrics recorded
- [ ] Tags applied correctly

### Test Scenarios

1. **Successful Payment**
   ```
   Expected: transaction.status = ok
   Expected: payment.result tag = success
   Expected: payment.amount measurement recorded
   ```

2. **Simulated Timeout**
   ```
   Expected: error.type tag = timeout
   Expected: level = warning
   Expected: payment.retryable tag = true
   ```

3. **Network Failure**
   ```
   Expected: error.type tag = network_error
   Expected: breadcrumbs show failure point
   Expected: processor context included
   ```

---

## Best Practices

### 1. Use Transactions for Complete Flows
```typescript
const transaction = Sentry.startTransaction({ name: 'card_payment' })
try {
  // ... payment flow
  transaction.setStatus('ok')
} catch (error) {
  transaction.setStatus('error')
  Sentry.captureException(error)
} finally {
  transaction.finish()
}
```

### 2. Add Breadcrumbs at Key Points
```typescript
Sentry.addBreadcrumb({
  category: 'payment',
  message: 'Clear, descriptive message',
  level: 'info',
  data: { relevant: 'metadata' }
})
```

### 3. Set Meaningful Context
```typescript
Sentry.setContext('payment', {
  type: 'card',
  amount: total,
  // ... other relevant data
})
```

### 4. Use Tags for Filtering
```typescript
Sentry.setTag('payment.method', 'card')
Sentry.setTag('error.type', 'timeout')
```

### 5. Categorize Error Severity
```typescript
Sentry.captureException(error, {
  level: isTimeout ? 'warning' : 'error'
})
```

---

## Maintenance

### Regular Tasks

**Weekly:**
- Review error rates by type
- Check for new error patterns
- Verify alert thresholds

**Monthly:**
- Analyze performance trends
- Review timeout patterns
- Update alert configurations
- Clean up old issues

**Quarterly:**
- Review PII filtering
- Update error categorization
- Optimize performance monitoring
- Document new error types

---

## Related Documentation

- `PAYMENT_SYSTEM_FINAL.md` - Complete payment system documentation
- `PAYMENT_ERROR_HANDLING.md` - Error handling details
- `src/utils/sentry.ts` - Sentry configuration
- Sentry Dashboard - https://sentry.io/

---

**Status:** Production Ready ✅
**Last Updated:** 2025-11-17
**Quality Standard:** Apple Engineering Standards
**Coverage:** Comprehensive payment flow tracking

