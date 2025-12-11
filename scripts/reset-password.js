/**
 * Reset User Password Script
 * Usage: node scripts/reset-password.js
 *
 * Make sure to set your environment variables or update the values below
 */

const { createClient } = require('@supabase/supabase-js');

// Load from .env or use environment variables
require('dotenv').config();
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// User to reset
const TARGET_EMAIL = 'naiaharwood22@yahoo.com';
const NEW_PASSWORD = 'Harwood123!';

async function resetPassword() {
  console.log('🔐 Resetting password for:', TARGET_EMAIL);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // First, find the user
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const user = users.users.find(u => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase());

    if (!user) {
      console.log('❌ User not found in auth.users');
      console.log('Available users:', users.users.map(u => u.email).slice(0, 10));
      return;
    }

    console.log('✅ Found user:', user.id);

    // Update the password
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: NEW_PASSWORD }
    );

    if (updateError) {
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    console.log('✅ Password reset successfully!');
    console.log('   Email:', TARGET_EMAIL);
    console.log('   New Password:', NEW_PASSWORD);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetPassword();
