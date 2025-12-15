# Authentication Patterns - WhaleTools

**CRITICAL**: This document defines the ONLY approved patterns for authentication in WhaleTools. Any deviation from these patterns will cause auth failures for edge-case users due to Row Level Security (RLS) policies.

## Table of Contents
1. [Core Principles](#core-principles)
2. [Querying the Users Table](#querying-the-users-table)
3. [Session Management](#session-management)
4. [Common Mistakes](#common-mistakes)
5. [Examples](#examples)

---

## Core Principles

### 1. ALWAYS Query by `auth_user_id`, NEVER by `email`

**WHY**: The RLS policy on the `users` table requires:
```sql
(auth_user_id = auth.uid())
```

This means:
- ✅ Queries using `auth_user_id` will work
- ❌ Queries using `email` will return 0 rows (not an error!)
- ❌ Even `.single()` won't throw - it just returns nothing

### 2. ALWAYS Use `.maybeSingle()`, NEVER `.single()`

**WHY**:
- `.single()` throws an error if 0 or 2+ rows are returned
- `.maybeSingle()` returns `null` if 0 rows, allowing you to check `!userData`
- With RLS, failed queries return 0 rows, not errors

### 3. ALWAYS Check Both `error` AND `!data`

**Pattern**:
```typescript
const { data, error } = await supabase
  .from('users')
  .select('...')
  .eq('auth_user_id', user.id)
  .maybeSingle()

if (error || !data) {
  throw error || new Error('User record not found')
}
```

---

## Querying the Users Table

### ✅ CORRECT Pattern

```typescript
const { data: userData, error: userError } = await supabase
  .from('users')
  .select('id, role, vendor_id')
  .eq('auth_user_id', user.id)  // ✅ Use auth_user_id from auth.user object
  .maybeSingle()                 // ✅ Use maybeSingle()

if (userError || !userData) {   // ✅ Check both error AND !data
  throw userError || new Error('User record not found')
}

// Now use userData.vendor_id safely
```

### ❌ WRONG Patterns

```typescript
// ❌ WRONG: Querying by email
const { data } = await supabase
  .from('users')
  .select('...')
  .eq('email', user.email)  // ❌ RLS will block this
  .single()

// ❌ WRONG: Using .single() instead of .maybeSingle()
const { data } = await supabase
  .from('users')
  .select('...')
  .eq('auth_user_id', user.id)
  .single()  // ❌ Will throw on 0 rows, but RLS returns 0 rows!

// ❌ WRONG: Only checking error, not !data
const { data, error } = await supabase
  .from('users')
  .select('...')
  .eq('auth_user_id', user.id)
  .maybeSingle()

if (error) {  // ❌ Doesn't catch when RLS returns 0 rows
  throw error
}
// userData might be null here!

// ❌ WRONG: Email fallback pattern
const { data: byAuthId } = await supabase
  .from('users')
  .select('...')
  .eq('auth_user_id', user.id)
  .maybeSingle()

if (!byAuthId) {
  // ❌ Fallback to email will also fail due to RLS
  const { data: byEmail } = await supabase
    .from('users')
    .select('...')
    .eq('email', user.email)
    .maybeSingle()
}
```

---

## Session Management

### Supabase Client Configuration

The Supabase client MUST be configured with AsyncStorage for session persistence:

```typescript
// ✅ CORRECT: src/lib/supabase/client.ts
const AsyncStorageAdapter = {
  getItem: async (key: string) => AsyncStorage.getItem(key),
  setItem: async (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: async (key: string) => AsyncStorage.removeItem(key),
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorageAdapter,  // ✅ Required for session persistence
    autoRefreshToken: true,         // ✅ Auto-refresh tokens
    persistSession: true,           // ✅ Persist across app restarts
    detectSessionInUrl: false,
  },
})
```

### Auth State Change Listener

The app MUST listen for auth state changes to keep the store in sync:

```typescript
// ✅ CORRECT: App.tsx
useEffect(() => {
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      useAuthStore.getState().setSession(session)
      useAuthStore.getState().setUser(session?.user ?? null)
    } else if (event === 'SIGNED_OUT') {
      useAuthStore.getState().setSession(null)
      useAuthStore.getState().setUser(null)
    } else if (event === 'SIGNED_IN') {
      useAuthStore.getState().setSession(session)
      useAuthStore.getState().setUser(session?.user ?? null)
    }
  })

  return () => authListener?.subscription?.unsubscribe()
}, [])
```

### Using getSession() in Components

When calling `getSession()` for authenticated operations:

```typescript
// ✅ CORRECT: Check for both error and missing token
const { data: { session }, error: sessionError } = await supabase.auth.getSession()

if (sessionError || !session?.access_token) {
  logger.warn('No active session')
  throw new Error('Session expired. Please log in again.')
}

// Now use session.access_token safely
```

### ❌ WRONG: Not handling missing sessions

```typescript
// ❌ WRONG: Only checking error
const { data: { session } } = await supabase.auth.getSession()

// session might be null!
fetch(url, {
  headers: {
    Authorization: `Bearer ${session.access_token}` // ❌ Crash!
  }
})
```

---

## Common Mistakes

### 1. Email-Based User Lookup

**Problem**: RLS policies block queries by email
**Impact**: Edge-case users like new accounts can't access the app
**Fix**: ALWAYS use `auth_user_id`

### 2. Using `.single()` Instead of `.maybeSingle()`

**Problem**: `.single()` throws on 0 rows, but RLS-blocked queries return 0 rows
**Impact**: Queries fail silently or throw confusing errors
**Fix**: ALWAYS use `.maybeSingle()` and check `!data`

### 3. Storage Set to `undefined`

**Problem**: Sessions aren't persisted, tokens aren't refreshed
**Impact**: Users get logged out after 1 hour, payments fail
**Fix**: Use AsyncStorageAdapter (see above)

### 4. No Auth State Change Listener

**Problem**: Store gets out of sync when tokens refresh
**Impact**: `getSession()` has fresh token but Zustand store has stale user
**Fix**: Add `onAuthStateChange` listener (see above)

### 5. Email Fallback Pattern

**Problem**: Falling back to email lookup when `auth_user_id` fails
**Impact**: Fallback also fails due to RLS, creates false sense of handling errors
**Fix**: Remove email fallbacks entirely - if `auth_user_id` fails, it's a real error

---

## Examples

### Example 1: Loading User's Vendor Info in a Hook

```typescript
// ✅ CORRECT
export function useProducts() {
  const { user } = useAuth()

  const loadProducts = useCallback(async () => {
    if (!user) return

    // Get vendor_id using auth_user_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('vendor_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      throw userError || new Error('User record not found')
    }

    // Load products for vendor
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', userData.vendor_id)

    return products
  }, [user])

  return { loadProducts }
}
```

### Example 2: Creating a Record with Vendor Association

```typescript
// ✅ CORRECT
async function createCategory(name: string) {
  const { user } = useAuth()
  if (!user) throw new Error('Not authenticated')

  // Get vendor_id
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('vendor_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (userError || !userData) {
    throw userError || new Error('User record not found')
  }

  // Create category
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name,
      vendor_id: userData.vendor_id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
```

### Example 3: Payment with Session Token

```typescript
// ✅ CORRECT
async function processPayment(amount: number) {
  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    throw new Error('Authentication required')
  }

  // Make authenticated API call
  const response = await fetch('/api/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ amount }),
  })

  return response.json()
}
```

---

## Summary Checklist

Before committing any code that queries the `users` table or uses sessions:

- [ ] Uses `.eq('auth_user_id', user.id)` NOT `.eq('email', ...)`
- [ ] Uses `.maybeSingle()` NOT `.single()`
- [ ] Checks both `error || !data` NOT just `error`
- [ ] No email fallback logic
- [ ] Session checks include `!session?.access_token`
- [ ] Supabase client has AsyncStorageAdapter
- [ ] App has `onAuthStateChange` listener

---

**Last Updated**: 2025-01-19
**Maintained By**: Engineering Team

If you encounter auth issues, check this document FIRST before debugging.
