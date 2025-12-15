# ⚠️ SUPABASE CONNECTION - MUST READ

**This is the ONLY authoritative document for Supabase connections.**
**Last Updated:** November 16, 2025
**Status:** ✅ VERIFIED WORKING (361 orders)

---

## 🚨 CRITICAL: READ THIS FIRST

### **The ONLY Working Connection Format:**

```bash
PGPASSWORD='SelahEsco123!!' psql \
  -h db.uaednwpxursknmwdeejn.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres
```

### **The 3 Non-Negotiable Rules:**

1. **Port MUST be 5432** (NOT 6543)
2. **Username MUST be `postgres`** (NOT `postgres.uaednwpxursknmwdeejn`)
3. **Password MUST be `SelahEsco123!!`**

**Breaking any of these rules = Connection failure**

---

## 📋 Quick Start (Copy & Paste)

### **Method 1: Helper Scripts (Easiest)**

```bash
cd /Users/whale/Desktop/whaletools-native

# Run a query
./db-query.sh "SELECT COUNT(*) FROM orders;"

# Run a migration
./migrate.sh supabase/migrations/your_file.sql

# Interactive console
./db-console.sh
```

### **Method 2: Direct psql**

```bash
cd /Users/whale/Desktop/whaletools-native
source .env

PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.uaednwpxursknmwdeejn.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -c "YOUR SQL HERE"
```

---

## 🔐 Configuration

### **Credentials (Already Set Up)**

**Location 1:** `/Users/whale/Desktop/whaletools-native/.env`
```bash
SUPABASE_DB_PASSWORD=SelahEsco123!!
SUPABASE_PROJECT_REF=uaednwpxursknmwdeejn
DATABASE_URL=postgresql://postgres:SelahEsco123!!@db.uaednwpxursknmwdeejn.supabase.co:5432/postgres
```

**Location 2:** `~/.zshrc` (global)
Same credentials stored permanently in shell profile.

### **Network Whitelist**

**Your IP:** `76.36.43.19` (whitelisted as `76.36.43.19/32`)

**Dashboard:** https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/settings/database

---

## ❌ Common Errors & Fixes

### **Error 1: "password authentication failed for user postgres.uaednwpxursknmwdeejn"**

**Cause:** Wrong username format
**Fix:** Change `-U postgres.uaednwpxursknmwdeejn` to `-U postgres`

### **Error 2: "Connection refused"**

**Cause:** Your IP got banned
**Fix:**
1. Go to: https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/settings/database
2. Scroll to "Network Bans"
3. Click "Unban IP" next to `76.36.43.19`

### **Error 3: "SASL authentication failed"**

**Cause:** Using port 6543 (pooler)
**Fix:** Change `-p 6543` to `-p 5432`

### **Error 4: "password authentication failed for user postgres"**

**Cause:** Wrong password or not loaded from env
**Fix:**
```bash
source .env
echo $SUPABASE_DB_PASSWORD  # Should show: SelahEsco123!!
```

---

## 🛡️ Network Setup

### **Why You Get Banned**

Supabase has auto-ban protection. After 5-10 failed authentication attempts within 5 minutes, your IP gets auto-banned.

**Triggers:**
- Using wrong username format (`postgres.PROJECT_REF`)
- Using wrong port (6543)
- Using wrong password
- Retry loops on failure

### **Permanent Solution: IP Whitelist**

**Already Done:** Your IP `76.36.43.19` is whitelisted as `76.36.43.19/32`

**If IP Changes:**
1. Get new IP: `curl -s "https://api.ipify.org"`
2. Go to dashboard: https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/settings/database
3. Click "Add restriction"
4. Enter: `YOUR_NEW_IP/32`
5. Save

---

## 📊 Connection Matrix (What Works, What Doesn't)

| Port | Username | Password | Result |
|------|----------|----------|--------|
| 5432 | `postgres` | `SelahEsco123!!` | ✅ WORKS |
| 5432 | `postgres.uaednwpxursknmwdeejn` | `SelahEsco123!!` | ❌ FAILS - Wrong username |
| 6543 | `postgres` | `SelahEsco123!!` | ⚠️ UNRELIABLE - Pooler issues |
| 6543 | `postgres.uaednwpxursknmwdeejn` | `SelahEsco123!!` | ❌ FAILS - Old format |

**ONLY the first row works reliably.**

---

## 🚀 Helper Scripts

**Location:** `/Users/whale/Desktop/whaletools-native/`

### **1. migrate.sh**
Run SQL migration files.

```bash
./migrate.sh supabase/migrations/20251116_example.sql
```

**Features:**
- Tries port 5432 first (fast)
- Falls back to port 6543 if needed
- Auto-loads .env
- Shows clear output

### **2. db-query.sh**
Run quick SQL queries.

```bash
./db-query.sh "SELECT * FROM orders LIMIT 10;"
```

### **3. db-console.sh**
Interactive PostgreSQL console.

```bash
./db-console.sh
```

Then run SQL:
```sql
SELECT * FROM orders;
\dt public.*
\d+ orders
\q
```

---

## 🤖 For Claude Code (AI Assistant)

**ALWAYS use this exact pattern:**

```bash
# 1. Navigate to project
cd /Users/whale/Desktop/whaletools-native

# 2. Load environment
source .env

# 3. Run command (EXACT format required)
PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.uaednwpxursknmwdeejn.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -c "YOUR SQL"
```

**NEVER use:**
- ❌ Port 6543
- ❌ Username `postgres.uaednwpxursknmwdeejn`
- ❌ `supabase db dump` (requires Docker)
- ❌ `supabase link` without `--skip-pooler`

**ALWAYS use:**
- ✅ Port 5432
- ✅ Username `postgres`
- ✅ `pg_dump` for dumps
- ✅ Helper scripts when possible

---

## 📁 File Locations

```
/Users/whale/Desktop/whaletools-native/
├── .env                              # Credentials (DO NOT COMMIT)
├── migrate.sh                        # Migration runner
├── db-console.sh                     # Interactive console
├── db-query.sh                       # Quick queries
├── SUPABASE_MUST_READ.md            # THIS FILE (authoritative)
├── SUPABASE_CONNECTION_RULES.md     # Detailed rules reference
└── supabase/
    ├── config.toml                  # Supabase config
    ├── migrations/                  # SQL files go here
    └── .temp/
        └── project-ref              # Project link

~/.zshrc                              # Global credentials
```

---

## ✅ Verification Checklist

Run these to verify everything works:

```bash
cd /Users/whale/Desktop/whaletools-native

# 1. Check environment
source .env
echo $SUPABASE_DB_PASSWORD  # Should show: SelahEsco123!!

# 2. Test connection
./db-query.sh "SELECT 'Working!' as status;"

# 3. Count orders
./db-query.sh "SELECT COUNT(*) FROM orders;"

# 4. List tables
./db-query.sh "\dt public.*" | head -20
```

**Expected:** All commands succeed, order count shows 360+

---

## 🔧 Troubleshooting Decision Tree

```
Connection fails?
├─ "password authentication failed for user postgres.uaednwpxursknmwdeejn"
│  └─ Fix: Change username to 'postgres' (not postgres.PROJECT_REF)
│
├─ "Connection refused"
│  └─ Fix: Unban IP at dashboard → Network Bans section
│
├─ "SASL authentication failed"
│  └─ Fix: Change port from 6543 to 5432
│
├─ "password authentication failed for user postgres"
│  └─ Fix: Verify password is 'SelahEsco123!!' and env is loaded
│
└─ Other error
   └─ Check: IP whitelisted, .env loaded, using port 5432
```

---

## 📞 Emergency Quick Fix

If nothing works:

1. **Unban IP:**
   - Go to: https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/settings/database
   - Network Bans → Unban `76.36.43.19`

2. **Verify credentials:**
   ```bash
   cd /Users/whale/Desktop/whaletools-native
   source .env
   echo "Password: ${SUPABASE_DB_PASSWORD}"
   ```

3. **Test with helper script:**
   ```bash
   ./db-query.sh "SELECT 1;"
   ```

4. **If still fails, check:**
   - IP changed? Get new IP: `curl -s "https://api.ipify.org"`
   - Password changed? Check Supabase dashboard
   - Supabase down? Check: https://status.supabase.com/

---

## 🎯 Current Status (Verified)

**Last Test:** November 16, 2025

```
✅ Connection: Working
✅ Helper scripts: Working
✅ Database access: 361 orders
✅ IP whitelist: Active (76.36.43.19/32)
✅ Port 5432: Responding
✅ Username postgres: Authenticated
✅ Password: Correct
```

**System Status:** 100% OPERATIONAL

---

## 📖 Additional Reference

**For detailed connection rules:**
See: `SUPABASE_CONNECTION_RULES.md` in same directory

**For Supabase dashboard:**
https://supabase.com/dashboard/project/uaednwpxursknmwdeejn

**Project Details:**
- **Project:** floradistro.com
- **Ref:** uaednwpxursknmwdeejn
- **Region:** us-east-2
- **Database:** PostgreSQL 17.6

---

## ⚠️ IMPORTANT REMINDERS

1. **NEVER commit `.env` to git** - Contains sensitive credentials
2. **ALWAYS use port 5432** - Port 6543 is unreliable
3. **ALWAYS use username `postgres`** - Not the old pooler format
4. **Keep IP whitelisted** - Prevents auto-bans
5. **Use helper scripts** - They have correct settings built-in

---

**END OF DOCUMENT**

**This is the single source of truth for Supabase connections.**
**All other documents are deprecated and removed.**
**Last verified: November 16, 2025**
