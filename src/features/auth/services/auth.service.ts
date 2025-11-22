import { supabase, isSupabaseReady } from '@/lib/supabase/client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Session, User } from '@supabase/supabase-js'

// Auth service for managing user authentication
export interface AuthResponse {
  session: Session | null
  user: User | null
}

export class AuthService {
  /**
   * Sign in with email and password
   */
  static async login(email: string, password: string): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    // Store session in AsyncStorage
    if (data.session) {
      await AsyncStorage.setItem('session', JSON.stringify(data.session))
    }

    return {
      session: data.session,
      user: data.user,
    }
  }

  /**
   * Sign out current user
   */
  static async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }

    // Clear session from AsyncStorage
    await AsyncStorage.removeItem('session')
  }

  /**
   * Get current session from AsyncStorage
   */
  static async getStoredSession(): Promise<Session | null> {
    try {
      const sessionJson = await AsyncStorage.getItem('session')
      if (!sessionJson) return null

      const session = JSON.parse(sessionJson)

      // Check if session is expired
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
      if (expiresAt < Date.now()) {
        await AsyncStorage.removeItem('session')
        return null
      }

      return session
    } catch (_error) {
      // Silent fail - session will be null and user will need to login
      return null
    }
  }

  /**
   * Restore session from storage and validate with Supabase
   */
  static async restoreSession(): Promise<AuthResponse> {
    const storedSession = await this.getStoredSession()

    if (!storedSession) {
      return { session: null, user: null }
    }

    // Validate session with Supabase
    const { data, error } = await supabase.auth.setSession({
      access_token: storedSession.access_token,
      refresh_token: storedSession.refresh_token,
    })

    if (error || !data.session) {
      await AsyncStorage.removeItem('session')
      return { session: null, user: null }
    }

    // Update stored session with refreshed data
    await AsyncStorage.setItem('session', JSON.stringify(data.session))

    return {
      session: data.session,
      user: data.user,
    }
  }

  /**
   * Get current user
   */
  static async getCurrentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser()
    return data.user
  }
}
