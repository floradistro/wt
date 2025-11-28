/**
 * Email Settings Store
 * Manages vendor email configuration and settings
 */

import { create } from 'zustand'
import { EmailService, VendorEmailSettings, EmailSend } from '@/services/email.service'
import { logger } from '@/utils/logger'

interface EmailSettingsState {
  // State
  settings: VendorEmailSettings | null
  recentSends: EmailSend[]
  isLoading: boolean
  isSendingTest: boolean
  error: string | null

  // Actions
  loadSettings: (vendorId: string) => Promise<void>
  updateSettings: (
    vendorId: string,
    updates: Partial<Omit<VendorEmailSettings, 'id' | 'vendor_id' | 'created_at' | 'updated_at'>>,
    userId: string
  ) => Promise<boolean>
  loadRecentSends: (vendorId: string, limit?: number) => Promise<void>
  sendTestEmail: (vendorId: string, to: string) => Promise<boolean>
  reset: () => void
}

export const useEmailSettingsStore = create<EmailSettingsState>((set, get) => ({
  // Initial state
  settings: null,
  recentSends: [],
  isLoading: false,
  isSendingTest: false,
  error: null,

  // Load vendor email settings
  loadSettings: async (vendorId: string) => {
    set({ isLoading: true, error: null })

    try {
      logger.info('Loading email settings', { vendorId })

      const settings = await EmailService.getVendorSettings(vendorId)

      set({ settings, isLoading: false })
      logger.info('Email settings loaded', { hasSettings: !!settings })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load email settings'
      logger.error('Error loading email settings', { error })
      set({ error: errorMessage, isLoading: false })
    }
  },

  // Update vendor email settings
  updateSettings: async (vendorId, updates, userId) => {
    set({ isLoading: true, error: null })

    try {
      logger.info('Updating email settings', { vendorId, updates })

      const updatedSettings = await EmailService.upsertVendorSettings(vendorId, updates, userId)

      if (updatedSettings) {
        set({ settings: updatedSettings, isLoading: false })
        logger.info('Email settings updated successfully')
        return true
      } else {
        throw new Error('Failed to update email settings')
      }
    } catch (error) {
      console.error('❌ Store: Error updating email settings:')
      if (error && typeof error === 'object') {
        console.error('  - Type:', error.constructor?.name)
        console.error('  - Message:', (error as any).message)
        console.error('  - Code:', (error as any).code)
      } else {
        console.error('  - Raw:', error)
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to update email settings'
      logger.error('Error updating email settings', {
        message: error instanceof Error ? error.message : String(error),
        type: error?.constructor?.name,
      })
      set({ error: errorMessage, isLoading: false })
      return false
    }
  },

  // Load recent email sends
  loadRecentSends: async (vendorId: string, limit = 50) => {
    try {
      logger.info('Loading recent email sends', { vendorId, limit })

      const sends = await EmailService.getRecentSends(vendorId, limit)

      set({ recentSends: sends })
      logger.info('Recent email sends loaded', { count: sends.length })
    } catch (error) {
      logger.error('Error loading recent email sends', { error })
    }
  },

  // Send test email
  sendTestEmail: async (vendorId: string, to: string, vendorName?: string, vendorLogo?: string) => {
    set({ isSendingTest: true, error: null })

    try {
      logger.info('Sending test email', { vendorId, to })

      const { settings } = get()

      const result = await EmailService.sendTestEmail({
        vendorId,
        to,
        fromName: settings?.from_name,
        fromEmail: settings?.from_email,
        vendorName,
        vendorLogo,
      })

      if (result.success) {
        logger.info('Test email sent successfully', { resendId: result.resendId })
        set({ isSendingTest: false })

        // Reload recent sends to show the test email
        await get().loadRecentSends(vendorId, 10)

        return true
      } else {
        throw new Error(result.error || 'Failed to send test email')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send test email'
      logger.error('Error sending test email', { error })
      set({ error: errorMessage, isSendingTest: false })
      return false
    }
  },

  // Reset store
  reset: () => {
    set({
      settings: null,
      recentSends: [],
      isLoading: false,
      isSendingTest: false,
      error: null,
    })
  },
}))
