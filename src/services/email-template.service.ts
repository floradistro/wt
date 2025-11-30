/**
 * Email Template Service
 * Handles template CRUD, rendering with Handlebars-style variables
 */

import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// ============================================
// TYPES
// ============================================

export interface EmailTemplate {
  id: string
  vendor_id: string
  name: string
  slug: string
  type: 'transactional' | 'marketing'
  category: string | null
  subject: string
  preview_text: string | null
  html_content: string
  text_content: string | null
  from_name: string
  from_email: string | null
  reply_to: string | null
  variables: string[]
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface TemplateVariables {
  [key: string]: string | number | boolean | TemplateVariables[] | undefined
}

export type TemplateCategory =
  | 'receipt'
  | 'order_confirmation'
  | 'order_update'
  | 'welcome'
  | 'loyalty'
  | 'marketing'

// ============================================
// EMAIL TEMPLATE SERVICE
// ============================================

export class EmailTemplateService {
  /**
   * Get all templates for a vendor
   */
  static async getTemplates(vendorId: string): Promise<EmailTemplate[]> {
    console.log('📧 EmailTemplateService.getTemplates: Fetching templates for vendor', vendorId)

    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    console.log('📧 EmailTemplateService.getTemplates: Result -', { data: data?.length || 0, error })

    if (error) {
      console.error('❌ EmailTemplateService.getTemplates: Error', error)
      logger.error('Error fetching email templates', { error, vendorId })
      throw error
    }

    return data || []
  }

  /**
   * Get a single template by ID
   */
  static async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      logger.error('Error fetching email template', { error, templateId })
      throw error
    }

    return data
  }

  /**
   * Get the default template for a category
   */
  static async getDefaultTemplate(
    vendorId: string,
    category: TemplateCategory
  ): Promise<EmailTemplate | null> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('category', category)
      .eq('is_default', true)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No default found, try to get any active template for this category
        const { data: fallback } = await supabase
          .from('email_templates')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('category', category)
          .eq('is_active', true)
          .limit(1)
          .single()

        return fallback || null
      }
      logger.error('Error fetching default template', { error, vendorId, category })
      throw error
    }

    return data
  }

  /**
   * Get template by slug
   */
  static async getTemplateBySlug(
    vendorId: string,
    slug: string
  ): Promise<EmailTemplate | null> {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      logger.error('Error fetching template by slug', { error, vendorId, slug })
      throw error
    }

    return data
  }

  /**
   * Create a new template
   */
  static async createTemplate(
    vendorId: string,
    template: Omit<EmailTemplate, 'id' | 'vendor_id' | 'created_at' | 'updated_at'>,
    userId?: string
  ): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        vendor_id: vendorId,
        ...template,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      })
      .select()
      .single()

    if (error) {
      logger.error('Error creating email template', { error, vendorId })
      throw error
    }

    return data
  }

  /**
   * Update a template
   */
  static async updateTemplate(
    templateId: string,
    updates: Partial<Omit<EmailTemplate, 'id' | 'vendor_id' | 'created_at' | 'updated_at'>>,
    userId?: string
  ): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_templates')
      .update({
        ...updates,
        updated_by_user_id: userId,
      })
      .eq('id', templateId)
      .select()
      .single()

    if (error) {
      logger.error('Error updating email template', { error, templateId })
      throw error
    }

    return data
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      logger.error('Error deleting email template', { error, templateId })
      throw error
    }
  }

  /**
   * Duplicate a template
   */
  static async duplicateTemplate(
    templateId: string,
    newName: string,
    newSlug: string,
    userId?: string
  ): Promise<EmailTemplate> {
    const template = await this.getTemplate(templateId)
    if (!template) {
      throw new Error('Template not found')
    }

    return this.createTemplate(
      template.vendor_id,
      {
        name: newName,
        slug: newSlug,
        type: template.type,
        category: template.category,
        subject: template.subject,
        preview_text: template.preview_text,
        html_content: template.html_content,
        text_content: template.text_content,
        from_name: template.from_name,
        from_email: template.from_email,
        reply_to: template.reply_to,
        variables: template.variables,
        is_active: false, // Start as inactive
        is_default: false, // Can't be default
      },
      userId
    )
  }

  /**
   * Set a template as the default for its category
   */
  static async setAsDefault(templateId: string, vendorId: string): Promise<void> {
    const template = await this.getTemplate(templateId)
    if (!template) {
      throw new Error('Template not found')
    }

    // First, unset any existing defaults for this category
    await supabase
      .from('email_templates')
      .update({ is_default: false })
      .eq('vendor_id', vendorId)
      .eq('category', template.category)

    // Set this template as default
    await supabase
      .from('email_templates')
      .update({ is_default: true })
      .eq('id', templateId)
  }

  // ============================================
  // TEMPLATE RENDERING
  // ============================================

  /**
   * Render a template with variables
   * Supports Handlebars-style syntax: {{variable}}, {{#if}}, {{#each}}, {{#unless}}
   */
  static render(template: string, variables: TemplateVariables): string {
    let result = template

    // Process {{#each items}}...{{/each}} blocks
    result = this.processEachBlocks(result, variables)

    // Process {{#if variable}}...{{/if}} blocks
    result = this.processIfBlocks(result, variables)

    // Process {{#unless variable}}...{{/unless}} blocks
    result = this.processUnlessBlocks(result, variables)

    // Replace simple {{variable}} placeholders
    result = this.replaceVariables(result, variables)

    return result
  }

  /**
   * Render subject line with variables
   */
  static renderSubject(subject: string, variables: TemplateVariables): string {
    return this.replaceVariables(subject, variables)
  }

  /**
   * Process {{#each items}}...{{/each}} blocks
   */
  private static processEachBlocks(template: string, variables: TemplateVariables): string {
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g

    return template.replace(eachRegex, (match, arrayName, content) => {
      const array = variables[arrayName]
      if (!Array.isArray(array)) return ''

      return array
        .map((item) => {
          let itemContent = content
          // Replace item properties
          if (typeof item === 'object' && item !== null) {
            Object.entries(item).forEach(([key, value]) => {
              const valueRegex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
              itemContent = itemContent.replace(valueRegex, String(value ?? ''))
            })
          }
          return itemContent
        })
        .join('')
    })
  }

  /**
   * Process {{#if variable}}...{{else}}...{{/if}} blocks
   */
  private static processIfBlocks(template: string, variables: TemplateVariables): string {
    // Match {{#if var}}...{{else}}...{{/if}} or {{#if var}}...{{/if}}
    const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g

    return template.replace(ifRegex, (match, varName, ifContent, elseContent = '') => {
      const value = variables[varName]
      const isTruthy = value !== undefined && value !== null && value !== false && value !== ''

      return isTruthy ? ifContent : elseContent
    })
  }

  /**
   * Process {{#unless variable}}...{{/unless}} blocks
   */
  private static processUnlessBlocks(template: string, variables: TemplateVariables): string {
    const unlessRegex = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g

    return template.replace(unlessRegex, (match, varName, content) => {
      const value = variables[varName]
      const isFalsy = value === undefined || value === null || value === false || value === ''

      return isFalsy ? content : ''
    })
  }

  /**
   * Replace simple {{variable}} placeholders
   */
  private static replaceVariables(template: string, variables: TemplateVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = variables[varName]
      if (value === undefined || value === null) return ''
      return String(value)
    })
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Extract variable names from a template
   */
  static extractVariables(template: string): string[] {
    const variables = new Set<string>()

    // Match {{variable}}, {{#if variable}}, {{#each variable}}, {{#unless variable}}
    const regex = /\{\{#?(?:if|each|unless)?\s*(\w+)\}\}/g
    let match

    while ((match = regex.exec(template)) !== null) {
      if (match[1] && !['if', 'each', 'unless', 'else'].includes(match[1])) {
        variables.add(match[1])
      }
    }

    return Array.from(variables)
  }

  /**
   * Validate template syntax
   */
  static validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for unclosed blocks
    const ifOpens = (template.match(/\{\{#if\s+\w+\}\}/g) || []).length
    const ifCloses = (template.match(/\{\{\/if\}\}/g) || []).length
    if (ifOpens !== ifCloses) {
      errors.push(`Unclosed {{#if}} blocks: ${ifOpens} opens, ${ifCloses} closes`)
    }

    const eachOpens = (template.match(/\{\{#each\s+\w+\}\}/g) || []).length
    const eachCloses = (template.match(/\{\{\/each\}\}/g) || []).length
    if (eachOpens !== eachCloses) {
      errors.push(`Unclosed {{#each}} blocks: ${eachOpens} opens, ${eachCloses} closes`)
    }

    const unlessOpens = (template.match(/\{\{#unless\s+\w+\}\}/g) || []).length
    const unlessCloses = (template.match(/\{\{\/unless\}\}/g) || []).length
    if (unlessOpens !== unlessCloses) {
      errors.push(`Unclosed {{#unless}} blocks: ${unlessOpens} opens, ${unlessCloses} closes`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Generate preview data for a template category
   */
  static getPreviewData(category: TemplateCategory): TemplateVariables {
    const baseData = {
      vendor_name: 'Your Store',
      vendor_logo: '',
      email_header_image: '',
      year: new Date().getFullYear().toString(),
    }

    switch (category) {
      case 'receipt':
        return {
          ...baseData,
          order_number: 'ORD-12345',
          items: [
            { name: 'Sample Product 1', quantity: 2, price: '$39.99' },
            { name: 'Sample Product 2', quantity: 1, price: '$24.99' },
          ],
          subtotal: '$104.97',
          tax_amount: '$8.40',
          discount_amount: '$10.00',
          total: '$103.37',
        }

      case 'order_confirmation':
        return {
          ...baseData,
          order_number: 'ORD-12345',
          is_pickup: false,
          pickup_location: 'Main Store - 123 Main Street',
          estimated_time: '30 minutes',
          customer_name: 'John Doe',
          shipping_address: '123 Main Street\nNew York, NY 10001',
          items: [
            { name: 'Sample Product 1', quantity: 2, price: '$39.99' },
            { name: 'Sample Product 2', quantity: 1, price: '$24.99' },
          ],
          total: '$103.37',
        }

      case 'order_update':
        return {
          ...baseData,
          order_number: 'ORD-12345',
          pickup_location: 'Main Store - 123 Main Street',
          tracking_number: '1Z999AA10123456784',
          carrier: 'UPS',
          customer_name: 'John Doe',
          shipping_address: '123 Main Street\nNew York, NY 10001',
        }

      case 'welcome':
        return {
          ...baseData,
          customer_name: 'John',
          shop_url: 'https://yourstore.com',
        }

      case 'loyalty':
        return {
          ...baseData,
          points_earned: '150',
          points_balance: '1,250',
        }

      case 'marketing':
        return {
          ...baseData,
          discount_code: 'SAVE20',
          discount_amount: '20%',
          expiry_date: 'December 31, 2024',
        }

      default:
        return baseData
    }
  }
}
