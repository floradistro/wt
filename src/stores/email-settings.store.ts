/**
 * Email Settings Store
 * Manages vendor email configuration
 */

import { create } from 'zustand'
import { EmailService, VendorEmailSettings, TemplateSlug } from '@/services/email.service'
import { logger } from '@/utils/logger'

interface EmailSettingsState {
  // State
  settings: VendorEmailSettings | null
  isLoading: boolean
  isSendingTest: boolean
  testingTemplate: TemplateSlug | null
  error: string | null

  // Actions
  loadSettings: (vendorId: string) => Promise<void>
  updateSettings: (vendorId: string, updates: Partial<VendorEmailSettings>) => Promise<boolean>
  sendTestEmail: (vendorId: string, to: string, templateSlug?: TemplateSlug) => Promise<boolean>
  reset: () => void
}

export const useEmailSettingsStore = create<EmailSettingsState>((set, get) => ({
  // Initial state
  settings: null,
  isLoading: false,
  isSendingTest: false,
  testingTemplate: null,
  error: null,

  // Load vendor email settings
  loadSettings: async (vendorId: string) => {
    set({ isLoading: true, error: null })

    try {
      const settings = await EmailService.getVendorSettings(vendorId)
      set({ settings, isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load email settings'
      logger.error('Error loading email settings', { error })
      set({ error: errorMessage, isLoading: false })
    }
  },

  // Update vendor email settings
  updateSettings: async (vendorId, updates) => {
    set({ isLoading: true, error: null })

    try {
      const updatedSettings = await EmailService.updateVendorSettings(vendorId, updates)

      if (updatedSettings) {
        set({ settings: updatedSettings, isLoading: false })
        return true
      } else {
        throw new Error('Failed to update email settings')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update email settings'
      logger.error('Error updating email settings', { error })
      set({ error: errorMessage, isLoading: false })
      return false
    }
  },

  // Send test email
  sendTestEmail: async (vendorId: string, to: string, templateSlug?: TemplateSlug) => {
    set({ isSendingTest: true, testingTemplate: templateSlug || null, error: null })

    try {
      const result = await EmailService.sendTestEmail({
        vendorId,
        to,
        templateSlug,
      })

      if (result.success) {
        logger.info('Test email sent', { resendId: result.resendId, templateSlug })
        set({ isSendingTest: false, testingTemplate: null })
        return true
      } else {
        throw new Error(result.error || 'Failed to send test email')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send test email'
      logger.error('Error sending test email', { error })
      set({ error: errorMessage, isSendingTest: false, testingTemplate: null })
      return false
    }
  },

  // Reset store
  reset: () => {
    set({
      settings: null,
      isLoading: false,
      isSendingTest: false,
      testingTemplate: null,
      error: null,
    })
  },
}))
