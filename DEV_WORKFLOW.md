# Development Workflow Guide

## 🚨 NEVER BREAK PRODUCTION AGAIN

You now have **separate development and production databases**. Always develop on dev, then deploy to production when ready.

---

## Quick Commands

### Switch Environments

```bash
# Switch to DEVELOPMENT (safe to break)
npm run env:dev

# Switch to PRODUCTION (live customers!)
npm run env:prod
```

### Start App

```bash
# Start with development database
npm run start:dev

# Start with production database (BE CAREFUL!)
npm run start:prod
```

---

## Your Databases

### Development Branch
- **URL**: `https://zwcwrwctomlnvyswovhb.supabase.co`
- **Branch Name**: `dev-checkout-cleanup`
- **Purpose**: Safe testing, experiments, breaking things
- **Dashboard**: https://supabase.com/dashboard/project/zwcwrwctomlnvyswovhb

### Production (Main)
- **URL**: `https://uaednwpxursknmwdeejn.supabase.co`
- **Branch Name**: `main`
- **Purpose**: Live app, real customers
- **Dashboard**: https://supabase.com/dashboard/project/uaednwpxursknmwdeejn

---

## Typical Development Flow

### 1. Start Development
```bash
# Switch to dev environment
npm run env:dev

# Start app
npm start
```

### 2. Make Changes
- Edit code
- Test payments
- Break things (it's okay!)
- Create migrations if needed

### 3. Test Edge Functions on Dev
```bash
# Deploy Edge Function to DEV branch only
supabase functions deploy process-payment --project-ref zwcwrwctomlnvyswovhb

# Test with your iPad against dev database
```

### 4. When Everything Works
```bash
# Push migrations to production
supabase db push --project-ref uaednwpxursknmwdeejn

# Deploy Edge Function to production
supabase functions deploy process-payment --project-ref uaednwpxursknmwdeejn

# Switch app to production and test
npm run env:prod
npm start

# Deploy to TestFlight
```

---

## Database Operations

### View Your Branches
```bash
supabase branches list
```

### Copy Production Data to Dev (for testing)
```bash
# Dump production data
supabase db dump --project-ref uaednwpxursknmwdeejn --data-only > production-data.sql

# Load into dev branch
supabase db reset --project-ref zwcwrwctomlnvyswovhb < production-data.sql
```

### Apply Migrations

```bash
# To development
supabase db push --project-ref zwcwrwctomlnvyswovhb

# To production (when ready!)
supabase db push --project-ref uaednwpxursknmwdeejn
```

---

## Current Status

✅ Development branch created
✅ Environment files configured
✅ Easy switching commands added
🔄 Ready to develop checkout flow on dev branch
⏳ Production is untouched and safe

---

## Edge Function Development

Your `process-payment` Edge Function is ready to deploy.

**Deploy to DEV first:**
```bash
supabase functions deploy process-payment --project-ref zwcwrwctomlnvyswovhb
```

**Deploy to PROD when tested:**
```bash
supabase functions deploy process-payment --project-ref uaednwpxursknmwdeejn
```

---

## Safety Checklist

Before deploying to production:

- [ ] Tested thoroughly on dev branch
- [ ] All migrations applied and tested on dev
- [ ] Edge Functions tested on dev
- [ ] Payment flow tested with real terminal on dev
- [ ] No errors in Sentry from dev testing
- [ ] Ready to deploy to production

---

## Emergency Rollback

If something breaks in production:

### Rollback Edge Function
```bash
# List previous versions
supabase functions list --project-ref uaednwpxursknmwdeejn

# Redeploy previous version (not directly supported, keep backups!)
```

### Rollback Database
```bash
# You have migrations in supabase/migrations/
# Can manually revert by writing inverse migration
```

---

## Tips

1. **Always start with `npm run env:dev`** when developing
2. **Check your .env file** to confirm which database you're using
3. **Test everything on dev** before touching production
4. **Keep production credentials secret** - never commit .env files
5. **Use Sentry** to monitor errors in both environments

---

## Current Environment

Check which environment you're using:
```bash
cat .env | grep SUPABASE_URL
```

If you see `zwcwrwctomlnvyswovhb` → You're on DEV ✅
If you see `uaednwpxursknmwdeejn` → You're on PRODUCTION ⚠️
