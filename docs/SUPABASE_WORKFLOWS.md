# Supabase Development Workflows - BULLETPROOF GUIDE

## 🚨 CRITICAL INFORMATION

### Why You Were Getting Banned
1. **Direct database connections** - Every CLI command hit Supabase's production servers
2. **Wrong credentials** - Using incorrect passwords triggered repeated auth failures
3. **No rate limiting protection** - Multiple rapid connections from same IP
4. **Unlinked project** - CLI wasn't properly configured

### What We Fixed
1. ✅ Linked project with `supabase link`
2. ✅ Corrected database password in `.env`
3. ✅ Added access token for API operations
4. ✅ Configured proper connection pooling

---

## 📋 Prerequisites

### 1. Environment Setup
Your `.env` file MUST have these exact values:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://zwcwrwctomlnvyswovhb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Access (CORRECT CREDENTIALS)
SUPABASE_DB_PASSWORD=Flipperspender12!!
SUPABASE_PROJECT_REF=zwcwrwctomlnvyswovhb
SUPABASE_ACCESS_TOKEN=sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10
DATABASE_URL=postgresql://postgres:Flipperspender12!!@db.zwcwrwctomlnvyswovhb.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Verify Project is Linked
```bash
# Check current link status
supabase status

# If not linked, run:
supabase link --project-ref zwcwrwctomlnvyswovhb --password "Flipperspender12!!"
```

---

## 🔄 Migration Workflows

### Method 1: Safe Remote Migrations (RECOMMENDED for Claude Code)

This method uses the Supabase Management API, which has better rate limiting:

```bash
# 1. Create a new migration
supabase migration new your_migration_name

# 2. Edit the migration file in supabase/migrations/

# 3. Push to remote (uses Management API, not direct DB connection)
supabase db push

# 4. Verify migration applied
supabase migration list
```

**Why this is better:**
- Uses Management API with proper rate limiting
- Authenticated with access token (less likely to trigger bans)
- Handles connection pooling automatically
- Retry logic built-in

### Method 2: Direct Database Push (Use Sparingly)

Only use this for testing or when API push fails:

```bash
# Apply migration directly to database
# ⚠️ USE SPARINGLY - Can trigger rate limits
psql "$DATABASE_URL" -f supabase/migrations/XXX_your_migration.sql
```

### Method 3: Check Migration Status (Safe)

```bash
# List all migrations and their status
supabase migration list

# Check what's pending (doesn't connect to DB)
supabase migration repair --status
```

---

## 🧪 Testing Workflows

### 1. Test Migrations Locally (BEST PRACTICE)

Instead of testing directly on remote, use local Supabase:

```bash
# Start local Supabase instance
supabase start

# This runs:
# - Local PostgreSQL database
# - Local API server
# - Local Studio UI at http://localhost:54323

# Apply migrations locally
supabase db reset

# Test your changes locally first!
# Then when ready:
supabase db push
```

**Benefits:**
- No risk of IP bans
- Unlimited testing
- Faster iteration
- Can break things safely

### 2. Remote Testing (Use Rate-Limited Commands)

If you must test on remote:

```bash
# Check remote DB status (lightweight)
supabase db remote status

# Run a single query (better than direct psql)
supabase db execute --sql "SELECT version();"

# Pull remote schema for comparison
supabase db pull
```

---

## 🛡️ Protection Against IP Bans

### DO's ✅

1. **Use `supabase db push`** instead of direct psql connections
   ```bash
   # GOOD - Uses Management API
   supabase db push
   ```

2. **Add delays between operations**
   ```bash
   # If running multiple migrations
   supabase db push && sleep 2 && supabase migration list
   ```

3. **Use local development**
   ```bash
   # Start local instance for testing
   supabase start
   ```

4. **Check status before connecting**
   ```bash
   # Lightweight check
   supabase status
   ```

5. **Use migration repair for status checks**
   ```bash
   # Doesn't create new connections
   supabase migration repair --status
   ```

### DON'Ts ❌

1. **DON'T use direct psql in loops**
   ```bash
   # BAD - Creates new connection each time
   for file in migrations/*.sql; do
     psql "$DATABASE_URL" -f "$file"
   done
   ```

2. **DON'T run rapid successive commands**
   ```bash
   # BAD - Too fast
   supabase db push
   supabase db push
   supabase db push
   ```

3. **DON'T use wrong credentials**
   - Always use: `Flipperspender12!!`
   - NOT: `CeHQRZEfjrobyMLUpzwcXNAgMPmkyRCz`

4. **DON'T bypass the CLI**
   ```bash
   # BAD - Direct connection
   psql "$DATABASE_URL"

   # GOOD - Use CLI
   supabase db execute --sql "YOUR_QUERY"
   ```

---

## 🤖 Claude Code Best Practices

### For Claude to Run Migrations Safely:

1. **Always use this sequence:**
   ```bash
   # Step 1: Verify link (doesn't connect to DB)
   supabase status

   # Step 2: Create migration
   supabase migration new descriptive_name

   # Step 3: Edit migration file
   # (Claude edits the .sql file)

   # Step 4: Push using API
   supabase db push

   # Step 5: Verify (lightweight)
   supabase migration list
   ```

2. **Add delays between operations:**
   ```bash
   supabase db push && sleep 3 && supabase migration list
   ```

3. **Use environment variables:**
   ```bash
   # Instead of passing credentials each time
   export SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN
   supabase db push
   ```

4. **Check for errors before retrying:**
   ```bash
   if ! supabase db push; then
     echo "Push failed, waiting 10 seconds before retry..."
     sleep 10
     supabase db push
   fi
   ```

---

## 📊 Monitoring and Debugging

### Check if You're Being Rate Limited

```bash
# Test basic connectivity
curl -I https://zwcwrwctomlnvyswovhb.supabase.co/rest/v1/

# Check CLI status (safe)
supabase status

# Enable debug mode
supabase --debug db push
```

### If You Get Banned:

1. **Wait 15-30 minutes** - Rate limits usually reset
2. **Check Supabase dashboard** - Look for security alerts
3. **Verify credentials** - Wrong password = instant ban risk
4. **Contact Supabase support** - If ban persists

### Common Error Messages:

**"Connection refused"**
- Wait 15 minutes
- Check if credentials changed
- Verify project is active

**"Password authentication failed"**
- You're using wrong password
- Must use: `Flipperspender12!!`

**"Too many connections"**
- Using direct psql too much
- Switch to `supabase db push`
- Add delays between commands

---

## 🔐 Security Notes

### Credential Management

**Current credentials (DEV database):**
- Project Ref: `zwcwrwctomlnvyswovhb`
- Database Password: `Flipperspender12!!`
- Access Token: `sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10`

**IMPORTANT:**
- This is your DEV database - safe to experiment
- `.env` is in `.gitignore` - never commit it
- Access token can be rotated at: https://supabase.com/dashboard/account/tokens

---

## 🚀 Quick Reference

### Create and Apply Migration
```bash
supabase migration new add_feature
# Edit supabase/migrations/XXX_add_feature.sql
supabase db push
```

### Check Migration Status
```bash
supabase migration list
```

### Test Locally First
```bash
supabase start
supabase db reset
# Test changes
supabase db push  # When ready for remote
```

### Safe Remote Connection
```bash
# Use CLI commands instead of direct psql
supabase db execute --sql "SELECT * FROM products LIMIT 1;"
```

### Emergency: Reset Connection
```bash
# If things go wrong
supabase link --project-ref zwcwrwctomlnvyswovhb --password "Flipperspender12!!"
```

---

## 📞 Support

- **Supabase Docs**: https://supabase.com/docs/reference/cli
- **CLI Config**: https://supabase.com/docs/guides/local-development/cli/config
- **Rate Limits**: https://supabase.com/docs/guides/platform/going-into-prod#rate-limits

---

## ✅ Checklist for Claude Code

Before running migrations, verify:

- [ ] `supabase status` shows project is linked
- [ ] `.env` has correct password: `Flipperspender12!!`
- [ ] Access token is set: `sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10`
- [ ] Using `supabase db push` (NOT direct psql)
- [ ] Adding delays between commands (minimum 2-3 seconds)
- [ ] Testing locally first when possible

**If all checks pass: You're safe to run migrations! 🎉**
