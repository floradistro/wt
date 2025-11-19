-- DIAGNOSTIC: Kenedi Walker User Record Analysis
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check ALL user records for Kenedi (looking for duplicates)
SELECT
  'users_table' as source,
  id,
  email,
  auth_user_id,
  first_name,
  last_name,
  role,
  vendor_id,
  status,
  created_at,
  updated_at
FROM users
WHERE email ILIKE '%kenedi%'
   OR first_name ILIKE '%kenedi%'
   OR last_name ILIKE '%walker%'
ORDER BY created_at DESC;

-- 2. Check if there's a customer record for Kenedi
SELECT
  'customers_table' as source,
  id,
  email,
  auth_user_id,
  first_name,
  last_name,
  created_at
FROM customers
WHERE email ILIKE '%kenedi%'
   OR first_name ILIKE '%kenedi%'
   OR last_name ILIKE '%walker%';

-- 3. Check auth.users for Kenedi (need service role for this)
-- This shows if she has an auth account
SELECT
  id as auth_user_id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
WHERE email ILIKE '%kenedi%';

-- 4. Check user_locations assignments for Kenedi
SELECT
  ul.id,
  ul.user_id,
  u.email,
  u.auth_user_id,
  ul.location_id,
  l.name as location_name,
  u.created_at as user_created_at
FROM user_locations ul
JOIN users u ON ul.user_id = u.id
JOIN locations l ON ul.location_id = l.id
WHERE u.email ILIKE '%kenedi%'
   OR u.first_name ILIKE '%kenedi%';

-- 5. CRITICAL CHECK: Find records with NULL auth_user_id
SELECT
  'NULL_auth_user_id' as issue,
  id,
  email,
  first_name,
  last_name,
  role,
  created_at
FROM users
WHERE auth_user_id IS NULL
  AND (email ILIKE '%kenedi%' OR first_name ILIKE '%kenedi%');

-- 6. Compare Ayanna vs Kenedi (to see the difference)
SELECT
  'comparison' as type,
  email,
  auth_user_id,
  CASE WHEN auth_user_id IS NULL THEN 'MISSING' ELSE 'PRESENT' END as auth_status,
  role,
  created_at
FROM users
WHERE email ILIKE '%ayanna%'
   OR email ILIKE '%kenedi%'
ORDER BY created_at DESC;
