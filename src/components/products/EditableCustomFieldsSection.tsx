/**
 * Editable Custom Fields Section
 * Allows adding, editing, and removing product-specific custom fields
 */

import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { layout } from '@/theme/layout'

interface EditableCustomFieldsSectionProps {
  customFields: Record<string, any> | null | undefined
  editedCustomFields: Record<string, any>
  isEditing: boolean
  onCustomFieldsChange: (fields: Record<string, any>) => void
}

export function EditableCustomFieldsSection({
  customFields,
  editedCustomFields,
  isEditing,
  onCustomFieldsChange,
}: EditableCustomFieldsSectionProps) {
  // Don't render if no custom fields and not editing
  if (!customFields && !isEditing) return null
  if (Object.keys(customFields || {}).length === 0 && !isEditing) return null

  const handleAddField = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newKey = `custom_field_${Date.now()}`
    onCustomFieldsChange({
      ...editedCustomFields,
      [newKey]: '',
    })
  }

  const handleRemoveField = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const updated = { ...editedCustomFields }
    delete updated[key]
    onCustomFieldsChange(updated)
  }

  const handleUpdateFieldKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return
    const updated = { ...editedCustomFields }
    const value = updated[oldKey]
    delete updated[oldKey]
    updated[newKey] = value
    onCustomFieldsChange(updated)
  }

  const handleUpdateFieldValue = (key: string, value: string) => {
    onCustomFieldsChange({
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
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PRODUCT DETAILS</Text>
        {isEditing && (
          <Pressable onPress={handleAddField}>
            <Text style={styles.addButton}>+ Add Field</Text>
          </Pressable>
        )}
      </View>
      <LiquidGlassView
        effect="regular"
        colorScheme="dark"
        style={[styles.cardGlass, !isLiquidGlassSupported && styles.cardGlassFallback]}
      >
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
      </LiquidGlassView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: layout.contentHorizontal,
    marginBottom: layout.sectionSpacing,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: layout.cardPadding,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  addButton: {
    fontSize: 13,
    color: '#60A5FA',
    fontWeight: '600',
  },
  cardGlass: {
    borderRadius: layout.cardRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardGlassFallback: {
    backgroundColor: '#1c1c1e',
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
