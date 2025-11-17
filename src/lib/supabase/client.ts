import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'
import { logger } from '@/utils/logger'

// Get environment variables
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// Check if Supabase is configured
const isSupabaseConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')

if (!isSupabaseConfigured) {
  if (__DEV__) {
    logger.warn('Supabase not configured. Add credentials to .env file.', {
      supabaseUrl: supabaseUrl || 'missing',
      hasAnonKey: !!supabaseAnonKey
    })
  }
}

// Create Supabase client with fallback for unconfigured state
// Use dummy values if not configured to prevent initialization errors
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-anon-key',
  {
    auth: {
      storage: undefined, // We'll implement custom storage with AsyncStorage
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

// Export config status for use in auth flows
export const isSupabaseReady = isSupabaseConfigured
