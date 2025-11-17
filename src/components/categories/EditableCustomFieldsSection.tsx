/**
 * Editable Custom Fields Section (for Categories)
 * Manages custom fields for a category with inline editing
 * Matches the pattern from EditableCustomFieldsSection for products
 */

import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native'
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
  required: boolean
  description?: string
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
        .eq('email', user.email)
        .single()

      if (userError) throw userError

      // Load fields from vendor_product_fields table
      const { data, error } = await supabase
        .from('vendor_product_fields')
        .select('*')
        .eq('vendor_id', userData.vendor_id)
        .eq('is_active', true)
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
        required: f.required || false,
        description: f.description,
      })))
    }
  }, [allFields])

  const handleAddField = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newField: CustomField = {
      name: '',
      field_type: 'text',
      required: false,
      description: '',
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

  const handleSaveFields = async () => {
    if (!user?.email) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

      // Save to vendor_product_fields table with field_definition JSONB
      for (const field of editedFields) {
        const fieldDefinition = {
          label: field.name,
          type: field.field_type,
          options: field.options,
          required: field.required,
          description: field.description,
        }

        if (field.id) {
          // Update existing
          const { error } = await supabase
            .from('vendor_product_fields')
            .update({
              field_definition: fieldDefinition,
              updated_at: new Date().toISOString(),
            })
            .eq('id', field.id)
            .eq('vendor_id', userData.vendor_id)

          if (error) throw error
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
            })

          if (error) throw error
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      reload()
      onFieldsUpdated()
    } catch (error) {
      logger.error('Failed to save custom fields:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  // Auto-save when exiting edit mode
  useEffect(() => {
    if (!isEditing && editedFields.length > 0) {
      handleSaveFields()
    }
  }, [isEditing])

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
                  const isLast = index === editedFields.length - 1
                  return (
                    <View key={field.id || `field-${index}`} style={[styles.fieldEditRow, isLast && styles.fieldEditRowLast]}>
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

                      {/* Required Toggle */}
                      <Pressable
                        style={styles.requiredToggle}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          handleUpdateField(index, { required: !field.required })
                        }}
                      >
                        <Text style={styles.requiredLabel}>Required</Text>
                        <View style={[styles.toggle, field.required && styles.toggleActive]}>
                          <View style={[styles.toggleThumb, field.required && styles.toggleThumbActive]} />
                        </View>
                      </Pressable>

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
              return (
                <View key={field.id} style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldName}>{fieldName}</Text>
                    {field.description && (
                      <Text style={styles.fieldDescription}>{field.description}</Text>
                    )}
                    <View style={styles.fieldMeta}>
                      <Text style={styles.fieldMetaText}>
                        {fieldType?.toUpperCase() || 'TEXT'}
                      </Text>
                      {field.required && (
                        <>
                          <Text style={styles.fieldMetaDot}>•</Text>
                          <Text style={[styles.fieldMetaText, styles.fieldMetaRequired]}>Required</Text>
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
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
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
  requiredToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 10,
  },
  requiredLabel: {
    fontSize: 15,
    color: '#fff',
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#34c759',
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
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
  fieldMetaRequired: {
    color: '#ff9500',
  },
})
