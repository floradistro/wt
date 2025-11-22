# 🔍 Session Debugging Guide - Real-time Diagnostics

**Date:** Nov 21, 2025
**Purpose:** Diagnose session beginning/ending issues and modal visibility problems

---

## 🎯 ISSUES TO DIAGNOSE

1. **Cash drawer modal not appearing** when creating new session
2. **Sessions not beginning/ending** properly
3. **Live state not updating** in register selector

---

## 📊 COMPREHENSIVE LOGGING ADDED

### POSSessionSetup.tsx
- ✅ **handleRegisterSelected** - Tracks register selection and modal flow
- ✅ **handleCashDrawerSubmit** - Tracks session creation via RPC
- ✅ **renderScreen** - Tracks what component is being rendered

### POSRegisterSelector.tsx
- ✅ **Realtime subscription** - Tracks connection status and events
- ✅ **loadRegisters** - Tracks sessions loaded for each register

### OpenCashDrawerModal.tsx
- ✅ **Render** - Tracks visibility prop

---

## 🧪 TESTING PROCEDURE

### Test 1: First Login - Location Selection
**Steps:**
1. Login to POS
2. Watch console logs

**Expected Logs:**
```
[POSSessionSetup] 🕐 Starting load...
[POSSessionSetup] ⏱️ User query: XXms
[POSSessionSetup] ✅ Vendor loaded: {...}
[POSSessionSetup] ✅ Locations query took XXms
[POSSessionSetup] 🎉 COMPLETE - Total: XXms
[POSSessionSetup] 🎬 renderScreen called - state: { activeModal: 'none', ... }
[POSSessionSetup] 📍 Rendering: POSLocationSelector
```

**Issues if:**
- ❌ Vendor join fails → check RLS policies on vendors table
- ❌ Locations query slow (>500ms) → need database indexes
- ❌ No locations returned → check user_locations table

---

### Test 2: Register Selection (No Active Session)
**Steps:**
1. Select a location
2. Select a register that has NO active session
3. Watch for cash drawer modal

**Expected Logs:**
```
[POSSessionSetup] 🎬 renderScreen called - state: { activeModal: 'registerSelector', ... }
[POSSessionSetup] 🖥️ Rendering: POSRegisterSelector

[POSRegisterSelector] 🔌 Setting up Realtime subscription for location: XXX
[POSRegisterSelector] ✅ Realtime subscribed successfully
[POSRegisterSelector] ✅ Loaded X registers, 0 active sessions in XXms
[POSRegisterSelector] 📊 No active sessions found for this location

[POSSessionSetup] 🎯 Register selected: XXX
[POSSessionSetup] ✅ Register name: Register 1
[POSSessionSetup] 🔍 Checking for active session on register: XXX
[POSSessionSetup] 📋 Active session check: { hasActiveSession: false, ... }
[POSSessionSetup] 💵 No active session found - need to count cash drawer
[POSSessionSetup] 🔓 Opening cash drawer modal...
[POSSessionSetup] ✅ Modal state changed to: cashDrawerOpen

[POSSessionSetup] 🎬 renderScreen called - state: { activeModal: 'cashDrawerOpen', ... }
[POSSessionSetup] ⏸️ Rendering: null (waiting for modal or session ready)

[OpenCashDrawerModal] Rendering - visible: true
```

**Issues if:**
- ❌ Modal state doesn't change to 'cashDrawerOpen' → check useModalState hook
- ❌ renderScreen still shows 'registerSelector' → React state update issue
- ❌ OpenCashDrawerModal shows visible: false → modal prop not updating
- ❌ Active session incorrectly detected → stale session in database

---

### Test 3: Register Selection (Existing Active Session)
**Steps:**
1. Select a register that HAS an active session
2. Should skip modal and resume session

**Expected Logs:**
```
[POSSessionSetup] 🎯 Register selected: XXX
[POSSessionSetup] 📋 Active session check: { hasActiveSession: true, sessionId: 'XXX', userName: {...} }
[POSSessionSetup] ♻️ Resuming existing session: #XXX
[POSSessionSetup] 🚀 Calling onSessionReady (existing session) with: {...}
```

**Issues if:**
- ❌ Shows modal instead of resuming → active session not being detected
- ❌ Wrong user name → check users join in query

---

### Test 4: Create New Session
**Steps:**
1. Open cash drawer modal (from Test 2)
2. Enter opening cash amount
3. Click "START SHIFT"

**Expected Logs:**
```
[POSSessionSetup] 💰 Cash drawer submit called: { openingCash: 100, ... }
[POSSessionSetup] 🔄 Calling get_or_create_session RPC...
[POSSessionSetup] ⏱️ RPC completed in XXms
[POSSessionSetup] ✅ Session created/retrieved: { id: 'XXX', session_number: 'XXX' }
[POSSessionSetup] 🎉 Session ready! Closing modal and notifying parent...
[POSSessionSetup] 🚀 Calling onSessionReady (new session) with: {...}

[POSRegisterSelector] 🔄 Realtime event received: { eventType: 'INSERT', ... }
[POSRegisterSelector] 🔁 Reloading registers due to session change...
[POSRegisterSelector] ✅ Loaded X registers, 1 active sessions in XXms
[POSRegisterSelector] 📊 Active session on register XXX: { userName: 'John Doe', ... }
```

**Issues if:**
- ❌ RPC error → check get_or_create_session function and RLS policies
- ❌ RPC slow (>500ms) → database performance issue
- ❌ No Realtime event received → check Supabase Realtime settings
- ❌ Registers don't update with new session → Realtime not working

---

### Test 5: Close Session (End Shift)
**Steps:**
1. Close a session from POS or database
2. Watch register selector update

**Expected Logs:**
```
[POSRegisterSelector] 🔄 Realtime event received: { eventType: 'UPDATE', new: { status: 'closed' }, ... }
[POSRegisterSelector] 🔁 Reloading registers due to session change...
[POSRegisterSelector] ✅ Loaded X registers, 0 active sessions in XXms
[POSRegisterSelector] 📊 No active sessions found for this location
```

**Issues if:**
- ❌ No Realtime event → Realtime not configured for UPDATE events
- ❌ Session still shows as active → session status not updated to 'closed'
- ❌ Registers don't update → check loadRegisters() execution

---

## 🐛 COMMON ISSUES AND SOLUTIONS

### Issue: Modal Not Appearing

**Symptoms:**
- Cash drawer modal doesn't show
- Console shows: `[OpenCashDrawerModal] Rendering - visible: false`
- Modal state is 'cashDrawerOpen' but modal not visible

**Diagnosis:**
```typescript
// Check renderScreen logs
[POSSessionSetup] 🎬 renderScreen called - state: {
  activeModal: 'cashDrawerOpen',  // ✅ Correct
  isCashDrawerOpen: true,         // ✅ Correct
  ...
}
[POSSessionSetup] ⏸️ Rendering: null  // ✅ Correct (modal should overlay)

// But modal shows:
[OpenCashDrawerModal] Rendering - visible: false  // ❌ WRONG!
```

**Root Cause:**
- React state not propagating to modal prop
- Modal component memoization preventing re-render
- Z-index issue (modal rendered behind something)

**Solutions:**
1. Remove `memo()` from OpenCashDrawerModal temporarily
2. Check modal container's `zIndex` in styles
3. Force re-render by adding key prop: `<OpenCashDrawerModal key={activeModal} .../>`

---

### Issue: Stale Active Sessions

**Symptoms:**
- Register shows as "IN USE" when it shouldn't be
- Console shows old employee names
- Session check returns activeSession when there isn't one

**Diagnosis:**
```typescript
[POSSessionSetup] 📋 Active session check: {
  hasActiveSession: true,  // ❌ Should be false
  sessionId: 'old-session-id',
  openedAt: '2025-11-20T...',  // ⚠️ From yesterday!
  currentUser: { ... }
}
```

**Root Cause:**
- Session not properly closed (status still 'open')
- 24-hour cutoff not working
- Database RLS preventing session updates

**Solutions:**
1. Manually close stale sessions:
   ```sql
   UPDATE pos_sessions
   SET status = 'closed', closed_at = NOW()
   WHERE status = 'open'
   AND opened_at < NOW() - INTERVAL '24 hours';
   ```
2. Check RLS policies allow session updates
3. Verify 24-hour cutoff logic in POSRegisterSelector.tsx:258-278

---

### Issue: Realtime Not Working

**Symptoms:**
- Sessions created but register selector doesn't update
- No Realtime event logs in console
- Subscription status not showing

**Diagnosis:**
```typescript
// Missing this log:
[POSRegisterSelector] ✅ Realtime subscribed successfully

// Or seeing this:
[POSRegisterSelector] ❌ Realtime subscription error: {...}
```

**Root Cause:**
- Supabase Realtime not enabled for pos_sessions table
- RLS policies blocking Realtime events
- Network/WebSocket issues

**Solutions:**
1. Enable Realtime in Supabase Dashboard:
   - Database → Replication
   - Enable for `pos_sessions` table
2. Check RLS policies allow SELECT on pos_sessions
3. Verify WebSocket connection in Network tab

---

### Issue: RPC get_or_create_session Failing

**Symptoms:**
- Cash drawer submit fails
- Console shows RPC error
- Session not created

**Diagnosis:**
```typescript
[POSSessionSetup] 🔄 Calling get_or_create_session RPC...
[POSSessionSetup] ❌ RPC error: { code: 'PGRST...' message: '...' }
```

**Common RPC Errors:**
- `42501` - Permission denied → RLS policy blocking insert
- `23505` - Unique constraint violation → Duplicate session
- `42883` - Function not found → RPC function doesn't exist
- `P0001` - Raised exception → Custom error in function

**Solutions:**
1. Check RLS policies on pos_sessions table
2. Verify get_or_create_session function exists:
   ```sql
   SELECT proname, prosrc FROM pg_proc WHERE proname = 'get_or_create_session';
   ```
3. Review function code for custom RAISE statements

---

## 🔧 QUICK DIAGNOSTICS

### Check Active Sessions in Database
```sql
SELECT
  s.id,
  s.session_number,
  s.status,
  s.opened_at,
  s.closed_at,
  r.register_name,
  l.name as location_name,
  u.full_name as user_name
FROM pos_sessions s
JOIN pos_registers r ON s.register_id = r.id
JOIN locations l ON r.location_id = l.id
JOIN users u ON s.user_id = u.id
WHERE s.status = 'open'
ORDER BY s.opened_at DESC;
```

### Check Realtime Replication Status
```sql
SELECT
  schemaname,
  tablename,
  replica_identity
FROM pg_tables
WHERE tablename = 'pos_sessions';
```
- Should show: `replica_identity = FULL` or `DEFAULT`

### Force Close Stale Sessions
```sql
UPDATE pos_sessions
SET
  status = 'closed',
  closed_at = NOW(),
  updated_at = NOW()
WHERE status = 'open'
  AND opened_at < NOW() - INTERVAL '24 hours'
RETURNING id, session_number, register_id;
```

---

## 📋 TESTING CHECKLIST

Run through this checklist and note any ❌ failures:

### Initial Setup
- [ ] User can login
- [ ] Vendor and locations load
- [ ] Location selector appears with locations
- [ ] Can select a location
- [ ] Register selector appears

### Register Selection - New Session
- [ ] Registers show as "AVAILABLE" when no active session
- [ ] Click register triggers handleRegisterSelected
- [ ] Console shows: "💵 No active session found"
- [ ] Console shows: "🔓 Opening cash drawer modal"
- [ ] Console shows: "✅ Modal state changed to: cashDrawerOpen"
- [ ] Cash drawer modal appears on screen
- [ ] Can enter opening cash amount
- [ ] Can click "START SHIFT"

### Session Creation
- [ ] Console shows: "💰 Cash drawer submit called"
- [ ] Console shows: "🔄 Calling get_or_create_session RPC"
- [ ] RPC completes in < 500ms
- [ ] Console shows: "✅ Session created/retrieved"
- [ ] Haptic feedback occurs
- [ ] Modal closes
- [ ] POS screen loads

### Realtime Updates
- [ ] Console shows: "✅ Realtime subscribed successfully"
- [ ] When session created, console shows: "🔄 Realtime event received: { eventType: 'INSERT' }"
- [ ] Register selector reloads and shows session
- [ ] Register card shows correct employee name
- [ ] Register card shows "IN USE" badge

### Session Close
- [ ] Can close session from POS
- [ ] Console shows: "🔄 Realtime event received: { eventType: 'UPDATE' }"
- [ ] Register selector updates
- [ ] Register shows as "AVAILABLE" again

---

## 🎓 NEXT STEPS

1. **Run tests** - Go through testing procedure above
2. **Collect logs** - Copy all console output during test
3. **Share findings** - Note which tests pass/fail
4. **Check database** - Run diagnostic SQL queries above

The logs will show EXACTLY where the flow breaks! 🔍
