# Migrate Users to Dev Database

## Quick Solution (Recommended)

### Try Logging In First
Your dev branch was created from production, so users **might already exist**!

1. Open your app (connected to dev database)
2. Try logging in with your production credentials
3. If it works, you're done! ✅

---

## If Login Fails: Manual User Creation

### Step 1: Open Dev Database Dashboard
https://supabase.com/dashboard/project/zwcwrwctomlnvyswovhb/auth/users

### Step 2: Click "Add user" (top right)

### Step 3: Enter your details
- **Email**: (your production email)
- **Password**: (your production password)
- **Auto Confirm**: ✅ Check this box
- **Email confirm**: ✅ Check this box

### Step 4: Click "Create user"

Done! Now you can log in to the dev app.

---

## Alternative: Copy All Users Programmatically

If you need to copy ALL users from production:

### 1. Export from Production
Open: https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/editor

Run this SQL:
```sql
SELECT
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;
```

### 2. For each user, create in Dev Dashboard
Use the "Add user" button in dev dashboard for each email.

---

## Current Database URLs

**Production**: https://uaednwpxursknmwdeejn.supabase.co
**Development**: https://zwcwrwctomlnvyswovhb.supabase.co

**Dashboards:**
- [Production Auth](https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/auth/users)
- [Dev Auth](https://supabase.com/dashboard/project/zwcwrwctomlnvyswovhb/auth/users)
