/**
 * Editable Custom Fields Section
 * Shows category-defined custom fields for products
 *
 * State Management:
 * - Fetches category field definitions from vendor_product_fields
 * - Merges with product.custom_fields values
 * - Only allows editing values for category-defined fields
 * - New category fields appear immediately when added to category template
 */

import { View, Text, StyleSheet, TextInput } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import { supabase } from '@/lib/supabase/client'
import { useAppAuth } from '@/contexts/AppAuthContext'
import type { Product } from '@/types/products'
import {
  useIsEditing,
  useEditedCustomFields,
  productEditActions,
} from '@/stores/product-edit.store'

interface EditableCustomFieldsSectionProps {
  product: Product
}

interface CategoryField {
  field_id: string
  label: string
  type: string
  description?: string
}

export function EditableCustomFieldsSection({ product }: EditableCustomFieldsSectionProps) {
  const { vendor } = useAppAuth()

  // Read from store
  const isEditing = useIsEditing()
  const editedCustomFields = useEditedCustomFields()

  // Category field definitions
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const customFields = product?.custom_fields || {}

  // Load category field definitions
  const loadCategoryFields = useCallback(async () => {
    if (!product?.primary_category_id || !vendor?.id) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('vendor_product_fields')
        .select('field_id, field_definition, is_active')
        .eq('vendor_id', vendor.id)
        .eq('category_id', product.primary_category_id)
        .order('sort_order', { ascending: true })

      if (error) throw error

      // Extract field definitions
      const fields: CategoryField[] = (data || []).map((f: any) => ({
        field_id: f.field_id,
        label: f.field_definition?.label || f.field_id,
        type: f.field_definition?.type || 'text',
        description: f.field_definition?.description,
      }))

      setCategoryFields(fields)
      logger.info('[EditableCustomFieldsSection] Loaded category fields', {
        categoryId: product.primary_category_id,
        fieldCount: fields.length,
        fieldIds: fields.map(f => f.field_id),
        customFieldKeys: Object.keys(customFields),
      })
    } catch (error) {
      logger.error('[EditableCustomFieldsSection] Failed to load category fields:', error)
    } finally {
      setIsLoading(false)
    }
  }, [product?.primary_category_id, vendor?.id, customFields])

  useEffect(() => {
    loadCategoryFields()
  }, [loadCategoryFields])

  // Merge category fields with product custom fields
  // Only shows category-defined fields (product-specific extras are filtered on save)
  const mergedFields = useCallback(() => {
    const result: { key: string; label: string; value: any; isCategory: boolean }[] = []

    // Only show category-defined fields with their values
    // This ensures we don't display orphaned/duplicate fields
    for (const field of categoryFields) {
      const value = customFields[field.field_id] ?? ''
      result.push({
        key: field.field_id,
        label: field.label,
        value,
        isCategory: true,
      })
    }

    return result
  }, [categoryFields, customFields])

  // Initialize edited fields when entering edit mode
  useEffect(() => {
    if (isEditing && categoryFields.length > 0) {
      // Merge category fields into editedCustomFields
      const merged = { ...editedCustomFields }
      for (const field of categoryFields) {
        if (!(field.field_id in merged)) {
          merged[field.field_id] = customFields[field.field_id] ?? ''
        }
      }
      if (Object.keys(merged).length !== Object.keys(editedCustomFields).length) {
        productEditActions.updateField('editedCustomFields', merged)
      }
    }
  }, [isEditing, categoryFields])

  const handleUpdateFieldValue = (key: string, value: string) => {
    const updatedFields = {
      ...editedCustomFields,
      [key]: value,
    }
    productEditActions.updateField('editedCustomFields', updatedFields)
  }

  const formatKey = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '—'
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  const allFields = mergedFields()

  // Don't render if no fields at all and not editing
  if (!isLoading && allFields.length === 0 && !isEditing) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PRODUCT DETAILS</Text>
      <View style={styles.cardGlass}>
        {isEditing ? (
          <>
            {categoryFields.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No custom fields defined for this category</Text>
              </View>
            ) : (
              <>
                {/* Category fields (locked key, editable value) */}
                {categoryFields.map((field, index) => {
                  const value = editedCustomFields[field.field_id] ?? ''
                  const isLast = index === categoryFields.length - 1
                  return (
                    <View key={field.field_id} style={[styles.fieldEditRow, isLast && styles.fieldEditRowLast]}>
                      <View style={styles.fieldEditHeader}>
                        <View style={styles.fieldKeyLocked}>
                          <Text style={styles.fieldKeyLockedText}>{field.label}</Text>
                        </View>
                      </View>
                      <TextInput
                        style={styles.fieldValueInput}
                        value={String(value)}
                        onChangeText={(text) => handleUpdateFieldValue(field.field_id, text)}
                        placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
                        placeholderTextColor="rgba(235,235,245,0.3)"
                        multiline={field.type === 'text'}
                        keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
                      />
                    </View>
                  )
                })}
              </>
            )}
          </>
        ) : (
          <>
            {allFields.map((field, index) => {
              const isLast = index === allFields.length - 1
              const isEmpty = field.value === null || field.value === undefined || field.value === ''
              return (
                <View key={field.key} style={[styles.customFieldRow, isLast && styles.customFieldRowLast]}>
                  <Text style={styles.customFieldLabel}>{field.label}</Text>
                  <Text style={[styles.customFieldValue, isEmpty && styles.customFieldEmpty]} numberOfLines={2}>
                    {formatValue(field.value)}
                  </Text>
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
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 0,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Empty state
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

  // Field edit row
  fieldEditRow: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  fieldEditRowLast: {
    borderBottomWidth: 0,
  },
  fieldEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  fieldKeyLocked: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fieldKeyLockedText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.7)',
  },
  fieldValueInput: {
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    textAlignVertical: 'top',
  },

  // View mode
  customFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  customFieldRowLast: {
    borderBottomWidth: 0,
  },
  customFieldLabel: {
    fontSize: 17,
    color: '#fff',
    flex: 1,
  },
  customFieldValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    flex: 1,
    textAlign: 'right',
  },
  customFieldEmpty: {
    color: 'rgba(235,235,245,0.3)',
    fontStyle: 'italic',
  },
})
