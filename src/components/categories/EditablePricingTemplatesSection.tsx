/**
 * Editable Pricing Templates Section
 * Manages pricing templates for a category with inline editing
 * Matches the pattern from EditablePricingSection
 */

import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
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

  // Load all vendor templates (not filtered by category)
  const loadAllTemplates = useCallback(async () => {
    if (!user?.email) return

    try {
      setIsLoading(true)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

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

  const handleSaveTemplates = async () => {
    if (!user?.email) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

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
          // Update existing
          const { error } = await supabase
            .from('pricing_tier_templates')
            .update({
              name: template.name,
              description: template.description,
              default_tiers: default_tiers,
              updated_at: new Date().toISOString(),
            })
            .eq('id', template.id)
            .eq('vendor_id', userData.vendor_id)

          if (error) throw error
        } else {
          // Insert new
          const { error } = await supabase
            .from('pricing_tier_templates')
            .insert({
              vendor_id: userData.vendor_id,
              category_id: categoryId,
              name: template.name,
              description: template.description,
              default_tiers: default_tiers,
              is_active: true,
            })

          if (error) throw error
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      reload()
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
      <Text style={styles.sectionTitle}>PRICING TEMPLATES</Text>
      <LiquidGlassContainerView spacing={12}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.cardGlass, !isLiquidGlassSupported && styles.cardGlassFallback]}
        >
        {isEditing ? (
          <>
            {editedTemplates.length === 0 ? (
              <Pressable onPress={handleAddTemplate} style={styles.emptyRow}>
                <Text style={styles.emptyText}>+ Add Pricing Template</Text>
              </Pressable>
            ) : (
              <>
                {editedTemplates.map((template, templateIndex) => {
                  const isExpanded = expandedTemplateId === `${templateIndex}`
                  const isLast = templateIndex === editedTemplates.length - 1

                  return (
                    <View key={templateIndex} style={[styles.templateEditRow, isLast && styles.templateEditRowLast]}>
                      {/* Template Header - Entire row is clickable to expand */}
                      <Pressable
                        style={styles.templateEditHeader}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setExpandedTemplateId(isExpanded ? null : `${templateIndex}`)
                        }}
                      >
                        <View style={styles.templateExpandButton}>
                          <Text style={styles.templateChevron}>
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.templateNameText}>{template.name}</Text>
                        </View>
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
                      </Pressable>

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
                                  value={priceBreak.quantity.toString()}
                                  onChangeText={(text) => handleUpdatePriceBreak(templateIndex, breakIndex, { quantity: parseFloat(text) || 0 })}
                                  placeholder="Qty"
                                  placeholderTextColor="rgba(235,235,245,0.3)"
                                  keyboardType="decimal-pad"
                                />
                                <TextInput
                                  style={styles.priceBreakSmallInput}
                                  value={priceBreak.unit}
                                  onChangeText={(text) => handleUpdatePriceBreak(templateIndex, breakIndex, { unit: text })}
                                  placeholder="Unit"
                                  placeholderTextColor="rgba(235,235,245,0.3)"
                                />
                                <View style={styles.priceBreakPriceWrapper}>
                                  <Text style={styles.dollarSign}>$</Text>
                                  <TextInput
                                    style={styles.priceBreakPriceInput}
                                    value={priceBreak.price > 0 ? priceBreak.price.toString() : ''}
                                    onChangeText={(text) => handleUpdatePriceBreak(templateIndex, breakIndex, { price: parseFloat(text) || 0 })}
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
        </LiquidGlassView>
      </LiquidGlassContainerView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: spacing.sm, // Consistent 12px spacing everywhere
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.cardPadding,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardGlassFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emptyRow: {
    paddingVertical: 20,
    paddingHorizontal: layout.rowPaddingHorizontal,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '500',
  },

  // Template Edit Row
  templateEditRow: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  templateEditRowLast: {
    borderBottomWidth: 0,
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
    fontSize: 17,
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
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  templateRowLast: {
    borderBottomWidth: 0,
  },
  templateInfo: {
    gap: 8,
  },
  templateName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
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
