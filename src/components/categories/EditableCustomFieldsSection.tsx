/**
 * Editable Custom Fields Section (for Categories)
 * Manages custom fields for a category with inline editing
 * Matches the pattern from EditableCustomFieldsSection for products
 */

import { View, Text, StyleSheet, Pressable, TextInput, Switch } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import * as Haptics from 'expo-haptics'
import { spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'

interface EditableCustomFieldsSectionProps {
  categoryId: string
  isEditing: boolean
  onFieldsUpdated: () => void
}

interface CustomField {
  id?: string
  name: string
  field_type: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean'
  options?: string[]
  description?: string
  is_active?: boolean
}

export function EditableCustomFieldsSection({
  categoryId,
  isEditing,
  onFieldsUpdated,
}: EditableCustomFieldsSectionProps) {
  const { user } = useAuth()

  const [allFields, setAllFields] = useState<any[]>([])
  const [editedFields, setEditedFields] = useState<CustomField[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load all fields assigned to this category
  const loadAllFields = useCallback(async () => {
    if (!user?.email) return

    try {
      setIsLoading(true)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      // Load ALL fields from vendor_product_fields table
      // Note: Native app shows all fields regardless of is_active status
      // The is_active field only controls online storefront visibility
      const { data, error } = await supabase
        .from('vendor_product_fields')
        .select('*')
        .eq('vendor_id', userData.vendor_id)
        .order('sort_order', { ascending: true })

      if (error) throw error

      // Filter to only fields for this specific category (not global)
      const categoryFields = (data || []).filter((f: any) => f.category_id === categoryId)

      // Extract field definitions from the JSONB column
      const mappedFields = categoryFields.map((f: any) => ({
        ...f,
        ...(f.field_definition || {}), // Spread the field_definition JSONB
      }))

      setAllFields(mappedFields)
      logger.info('Loaded custom fields for category', {
        categoryId,
        count: data?.length
      })
    } catch (error) {
      logger.error('Failed to load custom fields:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, categoryId])

  useEffect(() => {
    loadAllFields()
  }, [loadAllFields])

  useEffect(() => {
    if (allFields.length > 0) {
      setEditedFields(allFields.map(f => ({
        id: f.id,
        name: f.label || f.name,
        field_type: f.type || f.field_type || 'text',
        options: f.options,
        description: f.description,
        is_active: f.is_active !== undefined ? f.is_active : true,
      })))
    }
  }, [allFields])

  const handleAddField = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newField: CustomField = {
      name: '',
      field_type: 'text',
      description: '',
      is_active: true,
    }
    setEditedFields([...editedFields, newField])
  }

  const handleRemoveField = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setEditedFields(editedFields.filter((_, i) => i !== index))
  }

  const handleUpdateField = (index: number, updates: Partial<CustomField>) => {
    setEditedFields(
      editedFields.map((f, i) => i === index ? { ...f, ...updates } : f)
    )
  }

  const handleSaveFields = useCallback(async () => {
    if (!user?.email) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      logger.info('[EditableCustomFieldsSection] 💾 Saving custom fields', {
        categoryId,
        fieldCount: editedFields.length
      })

      // Save to vendor_product_fields table with field_definition JSONB
      for (const field of editedFields) {
        const fieldDefinition = {
          label: field.name,
          type: field.field_type,
          options: field.options,
          description: field.description,
        }

        if (field.id) {
          // Update existing (no log spam)
          const { error } = await supabase
            .from('vendor_product_fields')
            .update({
              field_definition: fieldDefinition,
              is_active: field.is_active !== undefined ? field.is_active : true,
              updated_at: new Date().toISOString(),
              updated_by_user_id: user.id, // Track who updated
            })
            .eq('id', field.id)
            .eq('vendor_id', userData.vendor_id)

          if (error) {
            logger.error('[EditableCustomFieldsSection] Failed to update field', { fieldId: field.id, error })
            throw error
          }
        } else {
          // Insert new field for this category
          const fieldId = field.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
          const { error } = await supabase
            .from('vendor_product_fields')
            .insert({
              vendor_id: userData.vendor_id,
              category_id: categoryId,
              field_id: fieldId,
              field_definition: fieldDefinition,
              is_active: true,
              sort_order: editedFields.length + 1,
              created_by_user_id: user.id, // Required by RLS policy
              updated_by_user_id: user.id, // Required by RLS policy
            })

          if (error) {
            logger.error('[EditableCustomFieldsSection] Failed to insert field', { fieldId, error })
            throw error
          }
        }
      }

      logger.info('[EditableCustomFieldsSection] ✅ All fields saved successfully')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await loadAllFields()
      onFieldsUpdated()
    } catch (error) {
      logger.error('[EditableCustomFieldsSection] ❌ Failed to save custom fields:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }, [user, categoryId, editedFields, loadAllFields, onFieldsUpdated])

  // Auto-save when exiting edit mode (only watch isEditing to prevent spam)
  useEffect(() => {
    if (!isEditing && editedFields.length > 0) {
      handleSaveFields()
    }
  }, [isEditing]) // Only depend on isEditing, like pricing templates

  const reload = loadAllFields

  if (!isEditing && allFields.length === 0) return null

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'select', label: 'Select' },
    { value: 'multiselect', label: 'Multi-Select' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Yes/No' },
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>CUSTOM FIELDS</Text>
      <View style={styles.cardGlass}>
        {isEditing ? (
          <>
            {editedFields.length === 0 ? (
              <Pressable onPress={handleAddField} style={styles.emptyRow}>
                <Text style={styles.emptyText}>+ Add Custom Field</Text>
              </Pressable>
            ) : (
              <>
                {editedFields.map((field, index) => {
                  return (
                    <View key={field.id || `field-${index}`} style={styles.fieldEditRow}>
                      {/* Field Header */}
                      <View style={styles.fieldEditHeader}>
                        <TextInput
                          style={styles.fieldNameInput}
                          value={field.name}
                          onChangeText={(text) => handleUpdateField(index, { name: text })}
                          placeholder="Field name"
                          placeholderTextColor="rgba(235,235,245,0.3)"
                        />
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                            handleRemoveField(index)
                          }}
                          style={styles.removeButton}
                        >
                          <Text style={styles.removeButtonText}>✕</Text>
                        </Pressable>
                      </View>

                      {/* Field Type Picker */}
                      <View style={styles.fieldTypeRow}>
                        <Text style={styles.fieldTypeLabel}>Type:</Text>
                        <View style={styles.fieldTypeButtons}>
                          {fieldTypes.map(type => (
                            <Pressable
                              key={type.value}
                              style={[
                                styles.fieldTypeButton,
                                field.field_type === type.value && styles.fieldTypeButtonActive
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                handleUpdateField(index, { field_type: type.value as any })
                              }}
                            >
                              <Text style={[
                                styles.fieldTypeButtonText,
                                field.field_type === type.value && styles.fieldTypeButtonTextActive
                              ]}>
                                {type.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {/* Description */}
                      <TextInput
                        style={styles.fieldDescInput}
                        value={field.description}
                        onChangeText={(text) => handleUpdateField(index, { description: text })}
                        placeholder="Description (optional)"
                        placeholderTextColor="rgba(235,235,245,0.3)"
                      />

                      {/* Online Visibility Toggle */}
                      <View style={styles.onlineVisibilityRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.onlineVisibilityLabel}>Publish Online</Text>
                          <Text style={styles.onlineVisibilityDesc}>
                            {field.is_active
                              ? 'Field visible on storefront'
                              : 'Field hidden from storefront'}
                          </Text>
                        </View>
                        <Switch
                          value={field.is_active !== undefined ? field.is_active : true}
                          onValueChange={(value) => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            handleUpdateField(index, { is_active: value })
                          }}
                          trackColor={{ false: 'rgba(120,120,128,0.32)', true: '#60A5FA' }}
                          thumbColor="#fff"
                          ios_backgroundColor="rgba(120,120,128,0.32)"
                        />
                      </View>

                      {/* Options for select/multiselect */}
                      {(field.field_type === 'select' || field.field_type === 'multiselect') && (
                        <TextInput
                          style={styles.fieldOptionsInput}
                          value={(field.options || []).join(', ')}
                          onChangeText={(text) => handleUpdateField(index, {
                            options: text.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="Options (comma-separated)"
                          placeholderTextColor="rgba(235,235,245,0.3)"
                        />
                      )}
                    </View>
                  )
                })}
                {/* Add field button at bottom */}
                <Pressable onPress={handleAddField} style={[styles.addFieldButton, styles.fieldEditRowLast]}>
                  <Text style={styles.addFieldText}>+ Add Another Field</Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            {/* View Mode */}
            {allFields.map((field, index) => {
              const isLast = index === allFields.length - 1
              const fieldName = field.label || field.name
              const fieldType = field.type || field.field_type
              const isActive = field.is_active !== undefined ? field.is_active : true
              return (
                <View key={field.id} style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
                  <View style={styles.fieldInfo}>
                    <View style={styles.fieldNameRow}>
                      <Text style={styles.fieldName}>{fieldName}</Text>
                      {!isActive && (
                        <View style={styles.offlineBadge}>
                          <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                        </View>
                      )}
                    </View>
                    {field.description && (
                      <Text style={styles.fieldDescription}>{field.description}</Text>
                    )}
                    <View style={styles.fieldMeta}>
                      <Text style={styles.fieldMetaText}>
                        {fieldType?.toUpperCase() || 'TEXT'}
                      </Text>
                      {isActive && (
                        <>
                          <Text style={styles.fieldMetaDot}>•</Text>
                          <Text style={[styles.fieldMetaText, styles.fieldMetaOnline]}>Online</Text>
                        </>
                      )}
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 0, // No padding - inherits parent margin
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
  addFieldButton: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  addFieldText: {
    fontSize: 15,
    color: '#60A5FA',
    fontWeight: '500',
  },

  // Field Edit Row
  fieldEditRow: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
  },
  fieldEditRowLast: {
  },
  fieldEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  fieldNameInput: {
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
  fieldTypeRow: {
    marginBottom: 10,
  },
  fieldTypeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fieldTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fieldTypeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fieldTypeButtonText: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.7)',
    fontWeight: '500',
  },
  fieldTypeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  fieldDescInput: {
    fontSize: 13,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  fieldOptionsInput: {
    fontSize: 13,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },

  // View Mode
  fieldRow: {
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
  },
  fieldRowLast: {
  },
  fieldInfo: {
    gap: 4,
  },
  fieldName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  fieldDescription: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  fieldMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  fieldMetaText: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.5)',
    fontWeight: '600',
  },
  fieldMetaDot: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.3)',
  },
  fieldMetaOnline: {
    color: '#34c759',
  },
  onlineVisibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    marginTop: 10,
  },
  onlineVisibilityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  onlineVisibilityDesc: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.6)',
  },
  fieldNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,69,58,0.15)',
  },
  offlineBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ff453a',
    letterSpacing: 0.5,
  },
})
