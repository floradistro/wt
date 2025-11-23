/**
 * Editable Custom Fields Section
 * Allows adding, editing, and removing product-specific custom fields
 *
 * State Management:
 * - Reads custom fields from product-edit.store
 * - Supports dynamic field creation and removal
 * - Shows/hides based on edit mode and field existence
 */

import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native'
import * as Haptics from 'expo-haptics'
import { radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import {
  useIsEditing,
  useEditedCustomFields,
  useOriginalProduct,
  productEditActions,
} from '@/stores/product-edit.store'

export function EditableCustomFieldsSection() {
  // Read from store
  const isEditing = useIsEditing()
  const editedCustomFields = useEditedCustomFields()
  const originalProduct = useOriginalProduct()

  const customFields = originalProduct?.custom_fields || null

  // Don't render if no custom fields and not editing
  if (!customFields && !isEditing) return null
  if (Object.keys(customFields || {}).length === 0 && !isEditing) return null

  const handleAddField = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newKey = `custom_field_${Date.now()}`
    productEditActions.updateField('editedCustomFields', {
      ...editedCustomFields,
      [newKey]: '',
    })
  }

  const handleRemoveField = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const updated = { ...editedCustomFields }
    delete updated[key]
    productEditActions.updateField('editedCustomFields', updated)
  }

  const handleUpdateFieldKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return
    const updated = { ...editedCustomFields }
    const value = updated[oldKey]
    delete updated[oldKey]
    updated[newKey] = value
    productEditActions.updateField('editedCustomFields', updated)
  }

  const handleUpdateFieldValue = (key: string, value: string) => {
    productEditActions.updateField('editedCustomFields', {
      ...editedCustomFields,
      [key]: value,
    })
  }

  const formatKey = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatValue = (value: any) => {
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PRODUCT DETAILS</Text>
      <View style={styles.cardGlass}>
        {isEditing ? (
          <>
            {Object.entries(editedCustomFields).length === 0 ? (
              <Pressable onPress={handleAddField} style={styles.emptyRow}>
                <Text style={styles.emptyText}>+ Add Custom Field</Text>
              </Pressable>
            ) : (
              <>
                {Object.entries(editedCustomFields).map(([key, value], index, array) => {
                  const isLast = index === array.length - 1
                  return (
                    <View key={key} style={[styles.fieldEditRow, isLast && styles.fieldEditRowLast]}>
                      <View style={styles.fieldEditHeader}>
                        <TextInput
                          style={styles.fieldKeyInput}
                          value={key}
                          onChangeText={(newKey) => handleUpdateFieldKey(key, newKey)}
                          placeholder="Field name"
                          placeholderTextColor="rgba(235,235,245,0.3)"
                        />
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                            handleRemoveField(key)
                          }}
                          style={styles.removeButton}
                        >
                          <Text style={styles.removeButtonText}>✕</Text>
                        </Pressable>
                      </View>
                      <TextInput
                        style={styles.fieldValueInput}
                        value={String(value)}
                        onChangeText={(text) => handleUpdateFieldValue(key, text)}
                        placeholder="Value"
                        placeholderTextColor="rgba(235,235,245,0.3)"
                        multiline
                      />
                    </View>
                  )
                })}
                <Pressable onPress={handleAddField} style={styles.addFieldRow}>
                  <Text style={styles.addFieldText}>+ Add Field</Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            {Object.entries(customFields || {}).map(([key, value], index, array) => {
              if (!value) return null
              const isLast = index === array.length - 1
              return (
                <View key={key} style={[styles.customFieldRow, isLast && styles.customFieldRowLast]}>
                  <Text style={styles.customFieldLabel}>{formatKey(key)}</Text>
                  <Text style={styles.customFieldValue} numberOfLines={2}>
                    {formatValue(value)}
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
  fieldKeyInput: {
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
  fieldValueInput: {
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 70,
    textAlignVertical: 'top',
  },

  // Add field button
  addFieldRow: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
    alignItems: 'center',
  },
  addFieldText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '500',
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
})
