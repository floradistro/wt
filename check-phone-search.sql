-- Check if phone number exists and how it's stored
SELECT 
  id,
  first_name,
  last_name,
  email,
  phone,
  vendor_id,
  LENGTH(phone) as phone_length,
  phone LIKE '%828%' as contains_828,
  phone LIKE '%8283204633%' as contains_full
FROM customers
WHERE phone LIKE '%828%' OR phone LIKE '%4633%'
ORDER BY created_at DESC
LIMIT 10;
