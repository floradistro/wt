import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

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
    console.warn('Supabase not configured. Add credentials to .env file.', {
      supabaseUrl: supabaseUrl || 'missing',
      hasAnonKey: !!supabaseAnonKey
    })
  }
}

// AsyncStorage adapter for Supabase auth
const AsyncStorageAdapter = {
  getItem: async (key: string) => {
    try {
      const value = await AsyncStorage.getItem(key)
      return value
    } catch (error) {
      console.error('AsyncStorage getItem error:', error)
      return null
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value)
    } catch (error) {
      console.error('AsyncStorage setItem error:', error)
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key)
    } catch (error) {
      console.error('AsyncStorage removeItem error:', error)
    }
  },
}

// Create Supabase client with fallback for unconfigured state
// Use dummy values if not configured to prevent initialization errors
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

// Export config status for use in auth flows
export const isSupabaseReady = isSupabaseConfigured
