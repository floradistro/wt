import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { AuthService } from '../features/auth/services/auth.service'
import { useLocationFilter } from './location-filter.store'
import { usePOSSessionStore } from './posSession.store'

interface AuthState {
  // State
  user: User | null
  session: Session | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
  clearError: () => void
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  // Initial state
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  // Login
  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null })

      const { user, session } = await AuthService.login(email, password)

      set({
        user,
        session,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      })
      throw error
    }
  },

  // Logout
  logout: async () => {
    try {
      set({ isLoading: true, error: null })

      await AuthService.logout()

      // Reset all stores on logout (Apple principle: Clean slate)
      useLocationFilter.getState().reset()
      usePOSSessionStore.getState().reset()

      set({
        user: null,
        session: null,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      })
      throw error
    }
  },

  // Restore session from storage
  restoreSession: async () => {
    try {
      set({ isLoading: true, error: null })

      const { user, session } = await AuthService.restoreSession()

      set({
        user,
        session,
        isLoading: false,
        isInitialized: true,
        error: null,
      })
    } catch (error) {
      set({
        user: null,
        session: null,
        isLoading: false,
        isInitialized: true,
        error: error instanceof Error ? error.message : 'Session restore failed',
      })
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Set user (for external updates)
  setUser: (user: User | null) => set({ user }),

  // Set session (for external updates)
  setSession: (session: Session | null) => set({ session }),
}))

// Selector hooks for better performance
export const useAuth = () => {
  const user = useAuthStore((state) => state.user)
  const session = useAuthStore((state) => state.session)
  const isLoading = useAuthStore((state) => state.isLoading)
  const error = useAuthStore((state) => state.error)

  return { user, session, isLoading, error }
}

export const useAuthActions = () => {
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const restoreSession = useAuthStore((state) => state.restoreSession)
  const clearError = useAuthStore((state) => state.clearError)

  return { login, logout, restoreSession, clearError }
}
