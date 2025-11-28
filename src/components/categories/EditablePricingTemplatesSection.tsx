/**
 * Editable Pricing Templates Section
 * Manages pricing templates for a category with inline editing
 * Matches the pattern from EditablePricingSection
 */

import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native'
import * as Haptics from 'expo-haptics'
import { spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'

interface EditablePricingTemplatesSectionProps {
  categoryId: string
  isEditing: boolean
  onTemplatesUpdated: () => void
}

interface PriceBreak {
  id?: string
  label: string
  quantity: number
  unit: string
  price: number
  enabled: boolean
  sort_order: number
}

interface Template {
  id?: string
  name: string
  description?: string
  price_breaks: PriceBreak[]
}

export function EditablePricingTemplatesSection({
  categoryId,
  isEditing,
  onTemplatesUpdated,
}: EditablePricingTemplatesSectionProps) {
  const { user } = useAuth()

  // Load ALL templates for the vendor, then filter
  const [allTemplates, setAllTemplates] = useState<any[]>([])
  const [editedTemplates, setEditedTemplates] = useState<Template[]>([])
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Track raw text input for decimal fields during editing
  const [editingValues, setEditingValues] = useState<Record<string, string>>({})

  // Load all vendor templates (not filtered by category)
  const loadAllTemplates = useCallback(async () => {
    if (!user?.email) return

    try {
      setIsLoading(true)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      const { data, error } = await supabase
        .from('pricing_tier_templates')
        .select('*')
        .eq('vendor_id', userData.vendor_id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      // Filter to only templates assigned to this category
      const categoryTemplates = (data || []).filter((t: any) =>
        t.applicable_to_categories?.includes(categoryId) || t.category_id === categoryId
      )

      setAllTemplates(categoryTemplates)
      logger.info('Loaded pricing templates for category', {
        categoryId,
        totalCount: data?.length,
        categoryCount: categoryTemplates.length,
        allTemplates: categoryTemplates.map(t => ({
          id: t.id,
          name: t.name,
          has_default_tiers: !!t.default_tiers,
          has_price_breaks: !!t.price_breaks,
          default_tiers_length: t.default_tiers?.length,
          price_breaks_length: t.price_breaks?.length,
          first_tier: t.default_tiers?.[0] || t.price_breaks?.[0],
        }))
      })
    } catch (error) {
      logger.error('Failed to load pricing templates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, categoryId])

  useEffect(() => {
    loadAllTemplates()
  }, [loadAllTemplates])

  // Sync editedTemplates when templates load or when entering edit mode
  useEffect(() => {
    if (allTemplates.length > 0) {
      const mapped = allTemplates.map(t => {
        // Get the raw price breaks from either field
        const rawBreaks = t.default_tiers || t.price_breaks || []

        logger.info('Mapping template price breaks', {
          templateName: t.name,
          rawBreaks: rawBreaks,
          hasDefaultTiers: !!t.default_tiers,
          hasPriceBreaks: !!t.price_breaks,
        })

        // Transform to our expected structure if needed
        const normalizedBreaks = rawBreaks.map((b: any) => ({
          id: b.id,
          label: b.label || '',
          quantity: b.quantity || b.qty || 1,
          unit: b.unit || 'g',
          // Price field is called 'default_price' in database
          price: typeof b.default_price === 'number' ? b.default_price : (typeof b.price === 'number' ? b.price : (parseFloat(b.default_price || b.price) || 0)),
          enabled: b.enabled !== undefined ? b.enabled : true,
          sort_order: b.sort_order || 0,
        }))

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          price_breaks: normalizedBreaks,
        }
      })

      setEditedTemplates(mapped)
    } else if (allTemplates.length === 0 && isEditing) {
      // Reset to empty when no templates in edit mode
      setEditedTemplates([])
    }
  }, [allTemplates, isEditing])

  const handleAddTemplate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newTemplate: Template = {
      name: '',
      description: '',
      price_breaks: [],
    }
    setEditedTemplates([...editedTemplates, newTemplate])
  }

  const handleRemoveTemplate = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setEditedTemplates(editedTemplates.filter((_, i) => i !== index))
  }

  const handleUpdateTemplate = (index: number, updates: Partial<Template>) => {
    setEditedTemplates(
      editedTemplates.map((t, i) => i === index ? { ...t, ...updates } : t)
    )
  }

  const handleAddPriceBreak = (templateIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newBreak: PriceBreak = {
      label: '',
      quantity: 1,
      unit: 'g',
      price: 0,
      enabled: true,
      sort_order: editedTemplates[templateIndex].price_breaks.length + 1,
    }

    const updatedTemplate = { ...editedTemplates[templateIndex] }
    updatedTemplate.price_breaks = [...updatedTemplate.price_breaks, newBreak]
    handleUpdateTemplate(templateIndex, updatedTemplate)
  }

  const handleRemovePriceBreak = (templateIndex: number, breakIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const updatedTemplate = { ...editedTemplates[templateIndex] }
    updatedTemplate.price_breaks = updatedTemplate.price_breaks.filter((_, i) => i !== breakIndex)
    handleUpdateTemplate(templateIndex, updatedTemplate)
  }

  const handleUpdatePriceBreak = (templateIndex: number, breakIndex: number, updates: Partial<PriceBreak>) => {
    const updatedTemplate = { ...editedTemplates[templateIndex] }
    updatedTemplate.price_breaks = updatedTemplate.price_breaks.map((b, i) =>
      i === breakIndex ? { ...b, ...updates } : b
    )
    handleUpdateTemplate(templateIndex, updatedTemplate)
  }

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  }

  const updateProductsWithTemplate = async (templateId: string, vendorId: string, newTiers: any[]) => {
    try {
      logger.info('⚡ LIVE TEMPLATE LINK: Setting template reference for all products', {
        templateId,
        categoryId,
        message: 'Products will now read pricing from template dynamically',
      })

      // Call database function to set template reference (LIVE SYSTEM)
      // Products will read pricing from template at runtime - no more orphaned copies
      const { data, error } = await supabase.rpc('update_products_pricing_from_template', {
        p_category_id: categoryId,
        p_vendor_id: vendorId,
        p_template_id: templateId,
      })

      if (error) {
        if (error.code === 'PGRST202') {
          logger.error('❌ DATABASE FUNCTION NOT FOUND!', {
            error: 'update_products_pricing_from_template function does not exist',
            solution: 'Run in Supabase SQL Editor: NOTIFY pgrst, \'reload schema\';',
            details: error,
          })
          throw new Error('Database function not accessible. Schema cache needs reload.')
        }
        logger.error('❌ BULK UPDATE FAILED', {
          error: error.message || String(error),
          code: error.code,
          details: error,
        })
        throw error
      }

      const result = data?.[0]
      const updatedCount = result?.updated_count || 0
      const updatedIds = result?.updated_product_ids || []

      logger.info('✅ BULK UPDATE COMPLETE', {
        updatedCount,
        firstFewIds: updatedIds.slice(0, 3),
        message: `${updatedCount} product(s) updated instantly`,
      })
    } catch (error) {
      logger.error('Failed to bulk update products:', {
        error: error instanceof Error ? error.message : String(error),
        templateId,
        categoryId,
      })
      throw error
    }
  }

  const handleSaveTemplates = async () => {
    if (!user?.email) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      // Save templates - transform price_breaks to default_tiers format
      for (const template of editedTemplates) {
        // Transform price_breaks to match database schema (default_price field)
        const default_tiers = template.price_breaks.map((pb: any) => ({
          id: pb.id,
          label: pb.label,
          quantity: pb.quantity,
          unit: pb.unit,
          default_price: pb.price, // Map 'price' to 'default_price'
          sort_order: pb.sort_order,
        }))

        if (template.id) {
          // Update existing template
          logger.info('💾 Saving template update', {
            templateId: template.id,
            templateName: template.name,
            tierCount: default_tiers.length,
            firstTier: default_tiers[0],
          })

          const { data: updatedData, error } = await supabase
            .from('pricing_tier_templates')
            .update({
              name: template.name,
              description: template.description,
              default_tiers: default_tiers,
              updated_at: new Date().toISOString(),
            })
            .eq('id', template.id)
            .eq('vendor_id', userData.vendor_id)
            .select()
            .single()

          if (error) {
            logger.error('❌ Failed to save template', {
              error: error.message,
              templateId: template.id,
            })
            throw error
          }

          logger.info('✅ Template saved successfully', {
            templateId: template.id,
            updatedData: updatedData,
          })

          // CASCADE UPDATE: Update all products in this category with the new pricing
          logger.info('🔄 Triggering cascade update for template', {
            templateId: template.id,
            templateName: template.name,
          })
          await updateProductsWithTemplate(template.id, userData.vendor_id, default_tiers)
        } else {
          // Insert new - generate slug from name
          const slug = generateSlug(template.name)
          const { data: newTemplate, error } = await supabase
            .from('pricing_tier_templates')
            .insert({
              vendor_id: userData.vendor_id,
              category_id: categoryId,
              name: template.name,
              slug: slug,
              description: template.description,
              default_tiers: default_tiers,
              is_active: true,
            })
            .select()
            .single()

          if (error) throw error

          // CASCADE UPDATE: For new templates, also update existing products
          if (newTemplate) {
            logger.info('✨ New template created, updating existing products', {
              templateId: newTemplate.id,
              templateName: template.name,
            })
            await updateProductsWithTemplate(newTemplate.id, userData.vendor_id, default_tiers)
          }
        }
      }

      logger.info('✅ All templates saved successfully, reloading UI')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Reload templates from database
      await reload()

      logger.info('✅ Templates reloaded, triggering products refresh')

      // CRITICAL: Force products store to refresh after cascade update
      // This ensures UI shows updated pricing immediately
      const { productsActions, useProductsStore } = await import('@/stores/products.store')
      const { productsScreenActions } = await import('@/stores/products-list.store')

      await productsActions.refreshProducts()

      // Also refresh the selected product if one is open
      const freshProducts = useProductsStore.getState().products
      productsScreenActions.refreshSelectedProduct(freshProducts)

      onTemplatesUpdated()
    } catch (error) {
      logger.error('Failed to save templates:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  // Auto-save when exiting edit mode
  useEffect(() => {
    if (!isEditing && editedTemplates.length > 0) {
      handleSaveTemplates()
    }
  }, [isEditing])

  const reload = loadAllTemplates

  if (!isEditing && allTemplates.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PRICING TEMPLATES</Text>
        {isEditing && (
          <View style={styles.sectionActions}>
            <Pressable onPress={handleAddTemplate} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Template</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.cardGlass}>
        {isEditing ? (
          <>
            {editedTemplates.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Add pricing templates to define reusable pricing tiers for this category
                </Text>
              </View>
            ) : (
              <>
                {editedTemplates.map((template, templateIndex) => {
                  const isExpanded = expandedTemplateId === `${templateIndex}`
                  const isLast = templateIndex === editedTemplates.length - 1

                  return (
                    <View key={templateIndex} style={[styles.templateEditRow, isLast && styles.templateEditRowLast]}>
                      {/* Template Header */}
                      <View style={styles.templateEditHeader}>
                        <Pressable
                          style={styles.templateExpandButton}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            setExpandedTemplateId(isExpanded ? null : `${templateIndex}`)
                          }}
                        >
                          <Text style={styles.templateChevron}>
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                        </Pressable>
                        <TextInput
                          style={styles.templateNameInput}
                          value={template.name}
                          onChangeText={(text) => handleUpdateTemplate(templateIndex, { name: text })}
                          placeholder="Template name"
                          placeholderTextColor="rgba(235,235,245,0.3)"
                        />
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation()
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                            handleRemoveTemplate(templateIndex)
                          }}
                          style={styles.removeButton}
                        >
                          <Text style={styles.removeButtonText}>✕</Text>
                        </Pressable>
                      </View>

                      {/* Template Description */}
                      <TextInput
                        style={styles.templateDescInput}
                        value={template.description}
                        onChangeText={(text) => handleUpdateTemplate(templateIndex, { description: text })}
                        placeholder="Description (optional)"
                        placeholderTextColor="rgba(235,235,245,0.3)"
                      />

                      {/* Expanded: Price Breaks */}
                      {isExpanded && (
                        <View style={styles.priceBreaksContainer}>
                          <Text style={styles.priceBreaksLabel}>PRICE BREAKS</Text>
                          {template.price_breaks.map((priceBreak, breakIndex) => (
                            <View key={breakIndex} style={styles.priceBreakRow}>
                              <View style={styles.priceBreakHeader}>
                                <Text style={styles.priceBreakTitle}>Tier {breakIndex + 1}</Text>
                                {template.price_breaks.length > 1 && (
                                  <Pressable
                                    onPress={() => handleRemovePriceBreak(templateIndex, breakIndex)}
                                    style={styles.removePriceBreakButton}
                                  >
                                    <Text style={styles.removePriceBreakText}>✕</Text>
                                  </Pressable>
                                )}
                              </View>
                              <TextInput
                                style={styles.priceBreakLabelInput}
                                value={priceBreak.label}
                                onChangeText={(text) => handleUpdatePriceBreak(templateIndex, breakIndex, { label: text })}
                                placeholder="Label (e.g., 1 gram)"
                                placeholderTextColor="rgba(235,235,245,0.3)"
                              />
                              <View style={styles.priceBreakInputRow}>
                                <TextInput
                                  style={styles.priceBreakSmallInput}
                                  value={editingValues[`${templateIndex}-${breakIndex}-qty`] ?? (priceBreak.quantity === 0 ? '' : priceBreak.quantity.toString())}
                                  onChangeText={(text) => {
                                    // Allow empty, numbers, and decimal point
                                    if (text === '' || /^\d*\.?\d*$/.test(text)) {
                                      const key = `${templateIndex}-${breakIndex}-qty`
                                      setEditingValues({ ...editingValues, [key]: text })

                                      // Only update the actual value if it's a valid number
                                      if (text !== '' && text !== '.') {
                                        const parsed = parseFloat(text)
                                        if (!isNaN(parsed)) {
                                          handleUpdatePriceBreak(templateIndex, breakIndex, { quantity: parsed })
                                        }
                                      } else if (text === '') {
                                        handleUpdatePriceBreak(templateIndex, breakIndex, { quantity: 0 })
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    // Clear editing state on blur
                                    const key = `${templateIndex}-${breakIndex}-qty`
                                    const newEditingValues = { ...editingValues }
                                    delete newEditingValues[key]
                                    setEditingValues(newEditingValues)
                                  }}
                                  placeholder="Qty"
                                  placeholderTextColor="rgba(235,235,245,0.3)"
                                  keyboardType="decimal-pad"
                                />
                                <View style={styles.unitPickerContainer}>
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.unitPickerScroll}
                                    contentContainerStyle={styles.unitPickerContent}
                                  >
                                    {['g', 'ml', 'oz', 'unit', 'pack'].map((unit) => (
                                      <Pressable
                                        key={unit}
                                        style={[
                                          styles.unitOption,
                                          priceBreak.unit === unit && styles.unitOptionActive
                                        ]}
                                        onPress={() => {
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                          handleUpdatePriceBreak(templateIndex, breakIndex, { unit })
                                        }}
                                      >
                                        <Text style={[
                                          styles.unitOptionText,
                                          priceBreak.unit === unit && styles.unitOptionTextActive
                                        ]}>
                                          {unit}
                                        </Text>
                                      </Pressable>
                                    ))}
                                  </ScrollView>
                                </View>
                                <View style={styles.priceBreakPriceWrapper}>
                                  <Text style={styles.dollarSign}>$</Text>
                                  <TextInput
                                    style={styles.priceBreakPriceInput}
                                    value={editingValues[`${templateIndex}-${breakIndex}-price`] ?? (priceBreak.price > 0 ? priceBreak.price.toString() : '')}
                                    onChangeText={(text) => {
                                      // Allow empty, numbers, and decimal point
                                      if (text === '' || /^\d*\.?\d*$/.test(text)) {
                                        const key = `${templateIndex}-${breakIndex}-price`
                                        setEditingValues({ ...editingValues, [key]: text })

                                        // Only update the actual value if it's a valid number
                                        if (text !== '' && text !== '.') {
                                          const parsed = parseFloat(text)
                                          if (!isNaN(parsed)) {
                                            handleUpdatePriceBreak(templateIndex, breakIndex, { price: parsed })
                                          }
                                        } else if (text === '') {
                                          handleUpdatePriceBreak(templateIndex, breakIndex, { price: 0 })
                                        }
                                      }
                                    }}
                                    onBlur={() => {
                                      // Clear editing state on blur
                                      const key = `${templateIndex}-${breakIndex}-price`
                                      const newEditingValues = { ...editingValues }
                                      delete newEditingValues[key]
                                      setEditingValues(newEditingValues)
                                    }}
                                    placeholder="0.00"
                                    placeholderTextColor="rgba(235,235,245,0.3)"
                                    keyboardType="decimal-pad"
                                  />
                                </View>
                              </View>
                            </View>
                          ))}
                          <Pressable
                            style={styles.addPriceBreakButton}
                            onPress={() => handleAddPriceBreak(templateIndex)}
                          >
                            <Text style={styles.addPriceBreakText}>+ Add Price Break</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )
                })}
              </>
            )}
          </>
        ) : (
          <>
            {/* View Mode */}
            {allTemplates.map((template, index) => {
              const isLast = index === allTemplates.length - 1
              const priceBreaks = template.default_tiers || template.price_breaks || []
              return (
                <View key={template.id} style={[styles.templateRow, isLast && styles.templateRowLast]}>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    {template.description && (
                      <Text style={styles.templateDescription}>{template.description}</Text>
                    )}
                    <View style={styles.priceBreakChips}>
                      {priceBreaks.map((priceBreak: any, idx: number) => {
                        const price = priceBreak.default_price || priceBreak.price
                        return (
                          <View key={idx} style={styles.priceBreakChip}>
                            <Text style={styles.priceBreakChipText}>
                              {priceBreak.label}: ${typeof price === 'number' ? price.toFixed(2) : '—'}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                </View>
              )
            })}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: layout.containerMargin, // Handles own horizontal spacing
    marginBottom: layout.sectionSpacing,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.9)',
    letterSpacing: -0.2,
  },
  emptyContainer: {
    paddingVertical: layout.containerMargin * 2,
    paddingHorizontal: layout.containerMargin,
    alignItems: 'center',
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardGlassFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },

  // Template Edit Row
  templateEditRow: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
  },
  templateEditRowLast: {
  },
  templateEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  templateExpandButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateChevron: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  templateNameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  templateNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,69,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 15,
    color: '#ff453a',
    fontWeight: '600',
  },
  templateDescInput: {
    fontSize: 13,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },

  // Price Breaks Container
  priceBreaksContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  priceBreaksLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  priceBreakRow: {
    marginBottom: 12,
  },
  priceBreakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceBreakTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(235,235,245,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  removePriceBreakButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,69,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePriceBreakText: {
    fontSize: 13,
    color: '#ff453a',
    fontWeight: '600',
  },
  priceBreakLabelInput: {
    fontSize: 13,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  priceBreakInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priceBreakSmallInput: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    textAlign: 'center',
  },
  unitPickerContainer: {
    flex: 2,
    marginLeft: spacing.sm,
  },
  unitPickerScroll: {
    maxHeight: 40,
  },
  unitPickerContent: {
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  unitOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderCurve: 'continuous' as any,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  unitOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  unitOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  unitOptionTextActive: {
    color: '#fff',
  },
  priceBreakPriceWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dollarSign: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    marginRight: 4,
  },
  priceBreakPriceInput: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    textAlign: 'right',
  },
  addPriceBreakButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  addPriceBreakText: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '500',
  },

  // View Mode
  templateRow: {
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
  },
  templateRowLast: {
  },
  templateInfo: {
    gap: 8,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  templateDescription: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  priceBreakChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  priceBreakChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
  },
  priceBreakChipText: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.7)',
  },
})
