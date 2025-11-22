import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Session, User } from '@supabase/supabase-js'
import { AuthService } from '../features/auth/services/auth.service'
import { useLocationFilter } from './location-filter.store'
import { usePOSSessionStore } from './posSession.store'
import { useCartStore } from './cart.store'
import { usePaymentStore } from './payment.store'
import { useTaxStore } from './tax.store'
import { useCheckoutUIStore } from './checkout-ui.store'
import { logger } from '@/utils/logger'

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

      // Set Sentry user context for error tracking
      if (user) {
        logger.setUser({
          id: user.id,
          email: user.email,
        })
      }

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

      // Clear Sentry user context
      logger.clearUser()

      // Reset all stores on logout (Apple principle: Clean slate)
      useLocationFilter.getState().reset()
      usePOSSessionStore.getState().reset()
      useCartStore.getState().reset()
      usePaymentStore.getState().resetPayment()
      useTaxStore.getState().reset()
      useCheckoutUIStore.getState().reset()

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

      // Set Sentry user context if session restored
      if (user) {
        logger.setUser({
          id: user.id,
          email: user.email,
        })
      }

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
  setUser: (user: User | null) => {
    // Update Sentry user context
    if (user) {
      logger.setUser({
        id: user.id,
        email: user.email,
      })
    } else {
      logger.clearUser()
    }
    set({ user })
  },

  // Set session (for external updates)
  setSession: (session: Session | null) => set({ session }),
}))

// Selector hooks for better performance
// ✅ CRITICAL: Use useShallow to prevent new object on every render
export const useAuth = () => {
  return useAuthStore(
    useShallow((state) => ({
      user: state.user,
      session: state.session,
      isLoading: state.isLoading,
      error: state.error,
    }))
  )
}

// Export auth actions as plain object (not a hook!)
export const authActions = {
  get login() { return useAuthStore.getState().login },
  get logout() { return useAuthStore.getState().logout },
  get restoreSession() { return useAuthStore.getState().restoreSession },
  get clearError() { return useAuthStore.getState().clearError },
}

// Legacy hook for backward compatibility
export const useAuthActions = () => authActions
