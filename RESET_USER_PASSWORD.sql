-- ============================================================================
-- RESET USER PASSWORD: naiaharwood22@yahoo.com
-- ============================================================================
-- NOTE: You cannot directly set passwords in SQL because Supabase uses bcrypt
-- hashing. Use the Supabase Dashboard or Admin API instead.
--
-- OPTION 1: Use Supabase Dashboard
-- 1. Go to your Supabase project dashboard
-- 2. Go to Authentication > Users
-- 3. Search for "naiaharwood22@yahoo.com"
-- 4. Click the three dots menu
-- 5. Click "Send password recovery" OR "Reset password"
--
-- OPTION 2: Use the Admin API (run in your terminal)
-- You'll need your SUPABASE_SERVICE_ROLE_KEY
-- ============================================================================

-- First, let's verify the user exists and get their auth ID
SELECT
  id as auth_user_id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
WHERE email ILIKE '%naiaharwood%'
   OR email ILIKE '%harwood%';

-- Check customer record
SELECT
  id as customer_id,
  email,
  first_name,
  last_name,
  phone,
  auth_user_id,
  created_at
FROM customers
WHERE email ILIKE '%naiaharwood%'
   OR email ILIKE '%harwood%'
   OR phone LIKE '%980%234%7775%';
