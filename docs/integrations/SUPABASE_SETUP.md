# 🚀 Supabase Setup - Quick Start

## ✅ Your Setup is Now BULLETPROOF

### What Was Fixed:
1. ✅ **Correct database password** configured in `.env`
2. ✅ **Access token** added for API operations
3. ✅ **Project linked** to Supabase CLI
4. ✅ **Safe migration script** created to prevent IP bans
5. ✅ **Comprehensive documentation** in `docs/SUPABASE_WORKFLOWS.md`

---

## 🎯 Quick Commands for Claude Code

### Use These Commands (They're Safe!)

```bash
# Check status and connection
./scripts/safe-migration.sh check

# List all migrations
./scripts/safe-migration.sh list

# Create a new migration
./scripts/safe-migration.sh create your_migration_name

# Push migrations to remote (with built-in delays)
./scripts/safe-migration.sh push
```

### Why These Commands Are Safe:
- ✅ Built-in delays between operations (prevents rate limiting)
- ✅ Proper error handling
- ✅ Uses correct credentials automatically
- ✅ Relinking on every operation (ensures fresh connection)
- ✅ Colorized output for easy debugging

---

## 📊 Current Status

**Your pending migrations:**
- Local migrations 073-080 have NOT been pushed to remote yet
- These are ready to push when you need them

**Database:**
- Project: `zwcwrwctomlnvyswovhb`
- Region: AWS US-East-2
- PostgreSQL: 17.6
- Status: ✅ Connected and working

---

## 🤖 For Claude Code - Migration Workflow

### Step 1: Create Migration
```bash
./scripts/safe-migration.sh create add_new_feature
```

### Step 2: Edit the SQL File
The script will create: `supabase/migrations/XXX_add_new_feature.sql`

### Step 3: Push to Remote
```bash
./scripts/safe-migration.sh push
```

**That's it!** The script handles:
- Rate limiting delays
- Proper authentication
- Connection management
- Error handling

---

## 🔧 Credentials (Already Configured)

Your `.env` file has the correct settings:

```bash
SUPABASE_DB_PASSWORD=Flipperspender12!!
SUPABASE_PROJECT_REF=zwcwrwctomlnvyswovhb
SUPABASE_ACCESS_TOKEN=sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10
```

**DO NOT change these unless credentials are rotated!**

---

## ⚠️ Important Rules for Claude

### DO ✅
1. **Always use `./scripts/safe-migration.sh`** instead of direct `supabase` commands
2. **Add delays** between operations (script does this automatically)
3. **Check status first** with `./scripts/safe-migration.sh check`
4. **Wait 3-5 seconds** between script calls if running multiple commands

### DON'T ❌
1. **Don't use direct `psql`** connections in loops
2. **Don't run rapid successive commands** without delays
3. **Don't bypass the safe script** unless specifically instructed
4. **Don't change credentials** without verifying with user

---

## 🐛 Troubleshooting

### "Connection refused" or "Authentication failed"

**Solution:**
```bash
# Wait 2 minutes, then:
rm -rf .supabase
./scripts/safe-migration.sh check
```

### "Rate limited" or "Too many connections"

**Solution:**
```bash
# Wait 15-30 minutes
# Then retry your operation
```

### Script not working

**Solution:**
```bash
# Make sure it's executable
chmod +x scripts/safe-migration.sh

# Check .env exists and has correct values
cat .env | grep SUPABASE_DB_PASSWORD
```

---

## 📚 Full Documentation

For complete details, see: **`docs/SUPABASE_WORKFLOWS.md`**

Topics covered:
- Why you were getting banned
- All migration methods
- Testing workflows
- IP ban protection strategies
- Emergency procedures
- Security best practices

---

## 🎉 You're All Set!

Your Supabase development environment is now:
- ✅ Properly authenticated
- ✅ Protected against IP bans
- ✅ Easy for Claude Code to use
- ✅ Safe for testing and migrations

**Next Steps:**
1. Review pending migrations (073-080) to see if they should be pushed
2. Use the safe script for all future migrations
3. Refer to docs when needed

---

## 💡 Quick Tips

**For Claude Code to run migrations safely:**
```bash
# Full workflow in one go:
./scripts/safe-migration.sh create my_feature && \
echo "Now edit supabase/migrations/XXX_my_feature.sql" && \
echo "Then run: ./scripts/safe-migration.sh push"
```

**Check what's pending:**
```bash
./scripts/safe-migration.sh list | grep -E "^\s+\d{3}\s+\|[\s]+\|"
```

**Emergency reset:**
```bash
rm -rf .supabase && ./scripts/safe-migration.sh check
```

---

**Setup completed on:** 2025-11-25
**Ready for production migrations!** 🚀
