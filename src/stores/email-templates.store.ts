/**
 * Email Templates Store
 * Manages email template state and operations
 */

import { create } from 'zustand'
import { EmailTemplateService, EmailTemplate, TemplateCategory, TemplateVariables } from '@/services/email-template.service'
import { logger } from '@/utils/logger'

interface EmailTemplatesState {
  // State
  templates: EmailTemplate[]
  selectedTemplate: EmailTemplate | null
  isLoading: boolean
  isSaving: boolean
  error: string | null

  // Preview state
  previewHtml: string
  previewVariables: TemplateVariables

  // Actions
  loadTemplates: (vendorId: string) => Promise<void>
  selectTemplate: (template: EmailTemplate | null) => void
  createTemplate: (vendorId: string, template: Omit<EmailTemplate, 'id' | 'vendor_id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<EmailTemplate | null>
  updateTemplate: (templateId: string, updates: Partial<EmailTemplate>, userId?: string) => Promise<boolean>
  deleteTemplate: (templateId: string) => Promise<boolean>
  duplicateTemplate: (templateId: string, newName: string, newSlug: string, userId?: string) => Promise<EmailTemplate | null>
  setAsDefault: (templateId: string, vendorId: string) => Promise<boolean>

  // Preview
  updatePreview: (template: EmailTemplate, variables?: TemplateVariables) => void
  setPreviewVariables: (variables: TemplateVariables) => void

  reset: () => void
}

export const useEmailTemplatesStore = create<EmailTemplatesState>((set, get) => ({
  // Initial state
  templates: [],
  selectedTemplate: null,
  isLoading: false,
  isSaving: false,
  error: null,
  previewHtml: '',
  previewVariables: {},

  // Load all templates for a vendor
  loadTemplates: async (vendorId: string) => {
    console.log('📧 email-templates.store: loadTemplates called with vendorId =', vendorId)
    set({ isLoading: true, error: null })

    try {
      const templates = await EmailTemplateService.getTemplates(vendorId)
      console.log('📧 email-templates.store: Loaded', templates.length, 'templates')
      set({ templates, isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load templates'
      console.error('❌ email-templates.store: Error loading templates', error)
      logger.error('Error loading email templates', { error })
      set({ error: errorMessage, isLoading: false })
    }
  },

  // Select a template for editing
  selectTemplate: (template: EmailTemplate | null) => {
    set({ selectedTemplate: template })

    if (template) {
      // Generate preview with default variables for the category
      const category = (template.category || 'receipt') as TemplateCategory
      const previewVariables = EmailTemplateService.getPreviewData(category)
      console.log('📧 selectTemplate: category =', category)
      console.log('📧 selectTemplate: previewVariables =', previewVariables)
      console.log('📧 selectTemplate: html_content length =', template.html_content?.length)
      const previewHtml = EmailTemplateService.render(template.html_content, previewVariables)
      console.log('📧 selectTemplate: previewHtml length =', previewHtml?.length)
      console.log('📧 selectTemplate: previewHtml preview =', previewHtml?.substring(0, 200))
      set({ previewHtml, previewVariables })
    } else {
      set({ previewHtml: '', previewVariables: {} })
    }
  },

  // Create a new template
  createTemplate: async (vendorId, template, userId) => {
    set({ isSaving: true, error: null })

    try {
      const newTemplate = await EmailTemplateService.createTemplate(vendorId, template, userId)
      const { templates } = get()
      set({
        templates: [...templates, newTemplate],
        selectedTemplate: newTemplate,
        isSaving: false,
      })
      return newTemplate
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create template'
      logger.error('Error creating email template', { error })
      set({ error: errorMessage, isSaving: false })
      return null
    }
  },

  // Update a template
  updateTemplate: async (templateId, updates, userId) => {
    set({ isSaving: true, error: null })

    try {
      const updatedTemplate = await EmailTemplateService.updateTemplate(templateId, updates, userId)
      const { templates, selectedTemplate } = get()

      set({
        templates: templates.map((t) => (t.id === templateId ? updatedTemplate : t)),
        selectedTemplate: selectedTemplate?.id === templateId ? updatedTemplate : selectedTemplate,
        isSaving: false,
      })

      // Update preview
      if (selectedTemplate?.id === templateId) {
        const category = (updatedTemplate.category || 'receipt') as TemplateCategory
        const previewVariables = EmailTemplateService.getPreviewData(category)
        const previewHtml = EmailTemplateService.render(updatedTemplate.html_content, previewVariables)
        set({ previewHtml, previewVariables })
      }

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update template'
      logger.error('Error updating email template', { error })
      set({ error: errorMessage, isSaving: false })
      return false
    }
  },

  // Delete a template
  deleteTemplate: async (templateId) => {
    set({ isSaving: true, error: null })

    try {
      await EmailTemplateService.deleteTemplate(templateId)
      const { templates, selectedTemplate } = get()

      set({
        templates: templates.filter((t) => t.id !== templateId),
        selectedTemplate: selectedTemplate?.id === templateId ? null : selectedTemplate,
        isSaving: false,
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete template'
      logger.error('Error deleting email template', { error })
      set({ error: errorMessage, isSaving: false })
      return false
    }
  },

  // Duplicate a template
  duplicateTemplate: async (templateId, newName, newSlug, userId) => {
    set({ isSaving: true, error: null })

    try {
      const newTemplate = await EmailTemplateService.duplicateTemplate(templateId, newName, newSlug, userId)
      const { templates } = get()

      set({
        templates: [...templates, newTemplate],
        selectedTemplate: newTemplate,
        isSaving: false,
      })

      return newTemplate
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate template'
      logger.error('Error duplicating email template', { error })
      set({ error: errorMessage, isSaving: false })
      return null
    }
  },

  // Set a template as the default for its category
  setAsDefault: async (templateId, vendorId) => {
    set({ isSaving: true, error: null })

    try {
      await EmailTemplateService.setAsDefault(templateId, vendorId)

      // Reload templates to get updated is_default flags
      await get().loadTemplates(vendorId)

      set({ isSaving: false })
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set default template'
      logger.error('Error setting default template', { error })
      set({ error: errorMessage, isSaving: false })
      return false
    }
  },

  // Update preview with custom variables
  updatePreview: (template, variables) => {
    const category = (template.category || 'receipt') as TemplateCategory
    const previewVars = variables || EmailTemplateService.getPreviewData(category)
    const previewHtml = EmailTemplateService.render(template.html_content, previewVars)
    set({ previewHtml, previewVariables: previewVars })
  },

  // Set preview variables
  setPreviewVariables: (variables) => {
    const { selectedTemplate } = get()
    if (selectedTemplate) {
      const previewHtml = EmailTemplateService.render(selectedTemplate.html_content, variables)
      set({ previewHtml, previewVariables: variables })
    }
  },

  // Reset store
  reset: () => {
    set({
      templates: [],
      selectedTemplate: null,
      isLoading: false,
      isSaving: false,
      error: null,
      previewHtml: '',
      previewVariables: {},
    })
  },
}))
