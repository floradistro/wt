/**
 * Editable Variant Templates Section
 * Manages product variant templates for a category (e.g., "Pre-Roll", "Edible")
 * Follows the pattern from EditablePricingTemplatesSection
 */

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Image, Switch } from 'react-native'
import * as Haptics from 'expo-haptics'
import { spacing, radius, colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'
import { MediaPickerModal } from '@/components/shared'
import { uploadProductImage } from '@/services/media.service'
import { getIconImage } from '@/utils/image-transforms'

interface EditableVariantTemplatesSectionProps {
  categoryId: string
  isEditing: boolean
  onTemplatesUpdated: () => void
}

export interface EditableVariantTemplatesSectionRef {
  refreshPricingTemplates: () => Promise<void>
}

interface VariantTemplate {
  id?: string
  variant_name: string
  variant_slug: string
  description?: string
  icon?: string
  conversion_ratio: number
  conversion_unit: string
  pricing_template_id?: string | null
  share_parent_inventory: boolean
  track_separate_inventory: boolean
  allow_on_demand_conversion: boolean
  featured_image_url?: string | null
  indicator_icon_url?: string | null
}

interface PricingTemplate {
  id: string
  name: string
  description?: string | null
}

export const EditableVariantTemplatesSection = forwardRef<EditableVariantTemplatesSectionRef, EditableVariantTemplatesSectionProps>(({
  categoryId,
  isEditing,
  onTemplatesUpdated,
}, ref) => {
  const { user } = useAuth()

  const [templates, setTemplates] = useState<VariantTemplate[]>([])
  const [editedTemplates, setEditedTemplates] = useState<VariantTemplate[]>([])
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingIconIndex, setUploadingIconIndex] = useState<number | null>(null)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [editingIconIndex, setEditingIconIndex] = useState<number | null>(null)
  const [availablePricingTemplates, setAvailablePricingTemplates] = useState<PricingTemplate[]>([])

  // Load pricing templates for this category
  const loadPricingTemplates = useCallback(async () => {
    if (!user?.email) return

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      const { data, error } = await supabase
        .from('pricing_tier_templates')
        .select('id, name, description')
        .eq('category_id', categoryId)
        .eq('vendor_id', userData.vendor_id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      setAvailablePricingTemplates(data || [])
      logger.info('Loaded pricing templates for category', {
        categoryId,
        count: data?.length,
      })
    } catch (error) {
      logger.error('Failed to load pricing templates:', error)
      setAvailablePricingTemplates([])
    }
  }, [user?.email, categoryId])

  // Load variant templates for this category
  const loadTemplates = useCallback(async () => {
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
        .from('category_variant_templates')
        .select('*')
        .eq('category_id', categoryId)
        .eq('vendor_id', userData.vendor_id)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) throw error

      setTemplates(data || [])
      setEditedTemplates(data || [])
      logger.info('Loaded variant templates', { count: data?.length })
    } catch (error) {
      logger.error('Failed to load variant templates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, categoryId])

  useEffect(() => {
    loadTemplates()
    loadPricingTemplates()
  }, [loadTemplates, loadPricingTemplates])

  // Sync edited templates when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditedTemplates([...templates])
    }
  }, [isEditing, templates])

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refreshPricingTemplates: async () => {
      logger.info('🔄 Refreshing pricing templates for variant section')
      await loadPricingTemplates()
    }
  }), [loadPricingTemplates])

  const handleAddTemplate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newTemplate: VariantTemplate = {
      variant_name: '',
      variant_slug: '',
      description: '',
      icon: '',
      conversion_ratio: 1.0,
      conversion_unit: 'g',
      share_parent_inventory: true,
      track_separate_inventory: false,
      allow_on_demand_conversion: true,
    }
    setEditedTemplates([...editedTemplates, newTemplate])
  }

  const handleDeleteTemplate = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditedTemplates(editedTemplates.filter((_, i) => i !== index))
  }

  const handleUpdateTemplate = (index: number, field: keyof VariantTemplate, value: any) => {
    const updated = [...editedTemplates]
    updated[index] = { ...updated[index], [field]: value }
    setEditedTemplates(updated)
  }

  const handlePickIcon = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingIconIndex(index)
    setShowMediaPicker(true)
  }

  const handleSelectImage = async (imageUri: string) => {
    if (editingIconIndex === null) return

    try {
      setUploadingIconIndex(editingIconIndex)
      setShowMediaPicker(false)

      let imageUrl = imageUri

      // Check if this is already a Supabase URL (existing image from gallery)
      if (imageUri.includes('supabase.co') || imageUri.startsWith('http')) {
        // Already uploaded - use it directly
        logger.info('Using existing image URL:', imageUri)
        imageUrl = imageUri
      } else {
        // New image from device - upload it
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('vendor_id')
          .eq('auth_user_id', user!.id)
          .maybeSingle()

        if (userError || !userData) throw userError || new Error('User record not found')

        // Upload using existing service
        const result = await uploadProductImage({
          uri: imageUri,
          vendorId: userData.vendor_id,
          filename: `variant-icon-${Date.now()}.jpg`,
        })

        imageUrl = result.url
      }

      // Update template with icon URL
      handleUpdateTemplate(editingIconIndex, 'icon', imageUrl)

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      logger.error('Failed to upload variant icon:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setUploadingIconIndex(null)
      setEditingIconIndex(null)
    }
  }

  const handleSave = async () => {
    if (!user?.email) return

    try {
      setIsSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      // Delete removed templates
      const deletedTemplateIds = templates
        .filter(t => !editedTemplates.find(e => e.id === t.id))
        .map(t => t.id)
        .filter(Boolean)

      if (deletedTemplateIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('category_variant_templates')
          .delete()
          .in('id', deletedTemplateIds)

        if (deleteError) throw deleteError
      }

      // Upsert templates
      for (const template of editedTemplates) {
        // Generate slug from name if not provided
        if (!template.variant_slug && template.variant_name) {
          template.variant_slug = template.variant_name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
        }

        const data: any = {
          category_id: categoryId,
          vendor_id: userData.vendor_id,
          variant_name: template.variant_name,
          variant_slug: template.variant_slug,
          description: template.description || null,
          icon: template.icon || '🎯',
          conversion_ratio: template.conversion_ratio,
          conversion_unit: template.conversion_unit,
          pricing_template_id: template.pricing_template_id || null,
          share_parent_inventory: template.share_parent_inventory,
          track_separate_inventory: template.track_separate_inventory,
          allow_on_demand_conversion: template.allow_on_demand_conversion,
          featured_image_url: template.featured_image_url || null,
          indicator_icon_url: template.indicator_icon_url || null,
          is_active: true,
          created_by_user_id: user.id,
        }

        logger.info('💾 Saving variant template:', {
          variant_name: template.variant_name,
          pricing_template_id: template.pricing_template_id,
          has_custom_pricing: !!template.pricing_template_id,
          operation: template.id ? 'UPDATE' : 'INSERT'
        })

        if (template.id) {
          // Update existing
          const { error } = await supabase
            .from('category_variant_templates')
            .update(data)
            .eq('id', template.id)

          if (error) throw error

          // Verify the update by reading it back
          const { data: verifyData, error: verifyError } = await supabase
            .from('category_variant_templates')
            .select('id, variant_name, pricing_template_id')
            .eq('id', template.id)
            .single()

          logger.info('✅ Variant template updated successfully:', {
            id: template.id,
            savedPricingTemplateId: template.pricing_template_id,
            verifiedPricingTemplateId: verifyData?.pricing_template_id,
            MATCH: verifyData?.pricing_template_id === template.pricing_template_id
          })
        } else {
          // Insert new
          const { error } = await supabase
            .from('category_variant_templates')
            .insert(data)

          if (error) throw error
          logger.info('✅ Variant template inserted successfully')
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await loadTemplates()
      onTemplatesUpdated()
    } catch (error) {
      logger.error('Failed to save variant templates:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>VARIANT TEMPLATES</Text>
        <View style={styles.cardGlass}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.text.secondary} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>VARIANT TEMPLATES</Text>
        {isEditing && (
          <View style={styles.sectionActions}>
            <Pressable onPress={handleAddTemplate} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Variant</Text>
            </Pressable>
            {editedTemplates.length > 0 && (
              <Pressable onPress={handleSave} style={styles.saveButton} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#60A5FA" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>

      <View style={styles.cardGlass}>
        {(isEditing ? editedTemplates : templates).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isEditing
                ? 'Add variant templates to allow alternate product forms (e.g., Pre-Roll, Edible)'
                : 'No variant templates configured'}
            </Text>
          </View>
        ) : (
          <View>
            {(isEditing ? editedTemplates : templates).map((template, index) => {
              const isExpanded = expandedTemplateId === template.id

              return (
                <View key={template.id || `new-${index}`}>
                  {index > 0 && <View style={styles.divider} />}

                  {isEditing ? (
                    // EDIT MODE
                    <View style={styles.templateEditContainer}>
                      <View style={styles.templateEditHeader}>
                        <TextInput
                          style={styles.nameInput}
                          value={template.variant_name}
                          onChangeText={(text) => handleUpdateTemplate(index, 'variant_name', text)}
                          placeholder="Variant name (e.g., Pre-Roll)"
                          placeholderTextColor="rgba(235,235,245,0.3)"
                        />
                        <Pressable
                          onPress={() => handleDeleteTemplate(index)}
                          style={styles.deleteButton}
                        >
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        </Pressable>
                      </View>

                      <TextInput
                        style={styles.descriptionInput}
                        value={template.description || ''}
                        onChangeText={(text) => handleUpdateTemplate(index, 'description', text)}
                        placeholder="Description (optional)"
                        placeholderTextColor="rgba(235,235,245,0.3)"
                        multiline
                      />

                      {/* Icon Picker */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Icon</Text>
                        <View style={styles.iconPickerRow}>
                          {template.icon?.startsWith('http') ? (
                            <Image source={{ uri: getIconImage(template.icon) || template.icon }} style={styles.iconPreview} />
                          ) : (
                            <View style={styles.iconPreview}>
                              <View style={styles.iconPlaceholder}>
                                <Text style={styles.iconPlaceholderText}>?</Text>
                              </View>
                            </View>
                          )}
                          <Pressable
                            style={styles.pickIconButton}
                            onPress={() => handlePickIcon(index)}
                            disabled={uploadingIconIndex === index}
                          >
                            {uploadingIconIndex === index ? (
                              <ActivityIndicator size="small" color={colors.text.secondary} />
                            ) : (
                              <Text style={styles.pickIconButtonText}>
                                {template.icon?.startsWith('http') ? 'Change Image' : 'Upload Image'}
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      </View>

                      {/* Conversion Settings */}
                      <View style={styles.templateEditRow}>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Conversion Ratio</Text>
                          <TextInput
                            style={styles.smallInput}
                            value={template.conversion_ratio.toString()}
                            onChangeText={(text) =>
                              handleUpdateTemplate(index, 'conversion_ratio', parseFloat(text) || 1.0)
                            }
                            placeholder="1.0"
                            placeholderTextColor="rgba(235,235,245,0.3)"
                            keyboardType="decimal-pad"
                          />
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Unit</Text>
                          <TextInput
                            style={styles.smallInput}
                            value={template.conversion_unit}
                            onChangeText={(text) => handleUpdateTemplate(index, 'conversion_unit', text)}
                            placeholder="g"
                            placeholderTextColor="rgba(235,235,245,0.3)"
                          />
                        </View>
                      </View>

                      {/* Pricing Template Picker */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Pricing Template (Optional)</Text>
                        <Text style={styles.inputHelp}>
                          {availablePricingTemplates.length === 0
                            ? 'No pricing templates found. Scroll up to "PRICING TEMPLATES" section to create one first.'
                            : 'Select a custom pricing template for this variant, or leave unset to use parent product pricing'}
                        </Text>
                        {availablePricingTemplates.length > 0 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.pricingTemplateScroll}
                            contentContainerStyle={styles.pricingTemplateScrollContent}
                          >
                            {/* None option */}
                            <Pressable
                              style={[
                                styles.pricingTemplateOption,
                                !template.pricing_template_id && styles.pricingTemplateOptionActive
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                handleUpdateTemplate(index, 'pricing_template_id', null)
                              }}
                            >
                              <Text style={[
                                styles.pricingTemplateOptionText,
                                !template.pricing_template_id && styles.pricingTemplateOptionTextActive
                              ]}>
                                Use Parent Pricing
                              </Text>
                            </Pressable>

                            {/* Available pricing templates */}
                            {availablePricingTemplates.map((pricingTemplate) => (
                              <Pressable
                                key={pricingTemplate.id}
                                style={[
                                  styles.pricingTemplateOption,
                                  template.pricing_template_id === pricingTemplate.id && styles.pricingTemplateOptionActive
                                ]}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                  handleUpdateTemplate(index, 'pricing_template_id', pricingTemplate.id)
                                }}
                              >
                                <Text style={[
                                  styles.pricingTemplateOptionText,
                                  template.pricing_template_id === pricingTemplate.id && styles.pricingTemplateOptionTextActive
                                ]}>
                                  {pricingTemplate.name}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        )}
                      </View>

                      {/* iOS-style Toggles */}
                      <View style={styles.toggleGroup}>
                        <View style={styles.toggleRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.toggleLabel}>Use parent inventory when out of stock</Text>
                            <Text style={styles.toggleHelp}>
                              Converts parent automatically (e.g., 0.7g flower → 1 pre-roll)
                            </Text>
                          </View>
                          <Switch
                            value={template.share_parent_inventory}
                            onValueChange={(value) =>
                              handleUpdateTemplate(index, 'share_parent_inventory', value)
                            }
                            trackColor={{ false: 'rgba(120,120,128,0.16)', true: '#34C759' }}
                            thumbColor="#fff"
                            ios_backgroundColor="rgba(120,120,128,0.16)"
                          />
                        </View>

                        <View style={styles.toggleRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.toggleLabel}>Allow on-demand conversion</Text>
                          </View>
                          <Switch
                            value={template.allow_on_demand_conversion}
                            onValueChange={(value) =>
                              handleUpdateTemplate(index, 'allow_on_demand_conversion', value)
                            }
                            trackColor={{ false: 'rgba(120,120,128,0.16)', true: '#34C759' }}
                            thumbColor="#fff"
                            ios_backgroundColor="rgba(120,120,128,0.16)"
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    // VIEW MODE - Chevron-in-title pattern
                    <Pressable
                      style={styles.templateRow}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setExpandedTemplateId(isExpanded ? null : template.id || null)
                      }}
                    >
                      <View style={styles.templateIcon}>
                        {template.icon?.startsWith('http') ? (
                          <Image source={{ uri: getIconImage(template.icon) || template.icon }} style={styles.templateIconImage} />
                        ) : (
                          <View style={styles.iconPlaceholder}>
                            <Text style={styles.iconPlaceholderText}>?</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.templateInfo}>
                        <View style={styles.templateHeader}>
                          <Text style={styles.templateName}>{template.variant_name}</Text>
                          <Text style={[styles.chevron, isExpanded && styles.chevronExpanded]}>􀆊</Text>
                        </View>
                        <Text style={styles.templateMeta}>
                          {template.conversion_ratio}
                          {template.conversion_unit} conversion
                          {template.share_parent_inventory ? ' • Shares inventory' : ''}
                          {template.pricing_template_id ? ' • Custom pricing' : ''}
                        </Text>
                        {isExpanded && template.description && (
                          <Text style={styles.templateDescription}>{template.description}</Text>
                        )}
                        {isExpanded && template.pricing_template_id && (
                          <Text style={styles.templatePricingInfo}>
                            Pricing: {availablePricingTemplates.find(pt => pt.id === template.pricing_template_id)?.name || 'Custom'}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* Media Picker Modal */}
      <MediaPickerModal
        visible={showMediaPicker}
        onClose={() => {
          setShowMediaPicker(false)
          setEditingIconIndex(null)
        }}
        onSelect={handleSelectImage}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
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
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  saveButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.glass.thick,
    borderWidth: 1,
    borderColor: colors.border.emphasis,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  loadingContainer: {
    paddingVertical: layout.containerMargin * 2,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: layout.containerMargin * 2,
    paddingHorizontal: layout.containerMargin,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    gap: spacing.md,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateIconText: {
    fontSize: 24,
  },
  templateIconImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  templateInfo: {
    flex: 1,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  templateMeta: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  templateDescription: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.5)',
    marginTop: 4,
    lineHeight: 18,
  },
  templatePricingInfo: {
    fontSize: 13,
    color: 'rgba(99,179,237,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 16,
    color: 'rgba(235,235,245,0.4)',
    transform: [{ rotate: '0deg' }],
    marginLeft: spacing.sm,
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: layout.containerMargin,
  },
  templateEditContainer: {
    padding: layout.containerMargin,
    gap: spacing.md,
  },
  templateEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  deleteButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
  },
  descriptionInput: {
    fontSize: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    minHeight: 70,
    lineHeight: 20,
  },
  templateEditRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  inputHelp: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.5)',
    lineHeight: 16,
    marginBottom: 8,
  },
  smallInput: {
    fontSize: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  toggleGroup: {
    gap: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleLabel: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleHelp: {
    fontSize: 13,
    color: colors.text.subtle,
    lineHeight: 18,
  },
  iconPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconPreview: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconPreviewText: {
    fontSize: 28,
  },
  pickIconButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.glass.thick,
    borderWidth: 1,
    borderColor: colors.border.emphasis,
    minWidth: 120,
    alignItems: 'center',
  },
  pickIconButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  iconPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  iconPlaceholderText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '600',
  },
  // Pricing Template Picker
  pricingTemplateScroll: {
    marginTop: spacing.sm,
  },
  pricingTemplateScrollContent: {
    gap: spacing.sm,
    paddingRight: layout.containerMargin,
  },
  pricingTemplateOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderCurve: 'continuous' as const,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pricingTemplateOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pricingTemplateOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.2,
  },
  pricingTemplateOptionTextActive: {
    color: '#fff',
  },
})
