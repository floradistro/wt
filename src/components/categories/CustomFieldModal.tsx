/**
 * CustomFieldModal Component
 * Create/Edit custom fields with 8 types
 * Apple Engineering: Auto-ID generation, conditional UI
 */

import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'
import { layout } from '@/theme/layout'
import { generateFieldId, type FieldType, type CustomField } from '@/hooks/useCustomFields'

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Text', icon: '􀅴' },
  { value: 'textarea', label: 'Text Area', icon: '􀌆' },
  { value: 'number', label: 'Number', icon: '􀆼' },
  { value: 'select', label: 'Dropdown', icon: '􀆅' },
  { value: 'checkbox', label: 'Checkbox', icon: '􀃳' },
  { value: 'date', label: 'Date', icon: '􀉉' },
  { value: 'url', label: 'URL', icon: '􀉣' },
  { value: 'email', label: 'Email', icon: '􀍕' },
]

interface CustomFieldModalProps {
  visible: boolean
  field?: CustomField | null
  categoryId: string | null
  onClose: () => void
  onSaved: () => void
}

export function CustomFieldModal({
  visible,
  field,
  categoryId,
  onClose,
  onSaved,
}: CustomFieldModalProps) {
  const { user } = useAuth()
  const [label, setLabel] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [autoGenerateId, setAutoGenerateId] = useState(true)
  const [type, setType] = useState<FieldType>('text')
  const [required, setRequired] = useState(false)
  const [placeholder, setPlaceholder] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState('') // One per line
  const [saving, setSaving] = useState(false)

  const isEditMode = !!field

  useEffect(() => {
    if (field) {
      setLabel(field.label)
      setFieldId(field.field_id)
      setAutoGenerateId(false)
      setType(field.type)
      setRequired(field.required)
      setPlaceholder(field.placeholder || '')
      setDescription(field.description || '')
      setOptions(field.options?.join('\n') || '')
    } else {
      setLabel('')
      setFieldId('')
      setAutoGenerateId(true)
      setType('text')
      setRequired(false)
      setPlaceholder('')
      setDescription('')
      setOptions('')
    }
  }, [field])

  // Auto-generate field_id
  useEffect(() => {
    if (autoGenerateId && label) {
      setFieldId(generateFieldId(label))
    }
  }, [label, autoGenerateId])

  const handleSave = async () => {
    if (!label.trim() || !fieldId.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user!.email)
        .single()

      if (userError) throw userError

      const fieldData = {
        field_id: fieldId,
        label,
        type,
        required,
        placeholder: placeholder || null,
        description: description || null,
        options: type === 'select' ? options.split('\n').filter(o => o.trim()) : null,
        category_id: categoryId,
        vendor_id: userData.vendor_id,
        is_active: true,
      }

      if (isEditMode) {
        const { error } = await supabase
          .from('vendor_custom_fields')
          .update({
            ...fieldData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', field.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('vendor_custom_fields')
          .insert(fieldData)

        if (error) throw error
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSaved()
      onClose()
    } catch (error) {
      logger.error('Failed to save custom field', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.background, !isLiquidGlassSupported && styles.backgroundFallback]}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Field' : 'New Field'}
            </Text>
            <Pressable onPress={handleSave} style={styles.headerButton} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#60A5FA" />
              ) : (
                <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Field Label *</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g., THC Percentage, Strain Type"
                placeholderTextColor="rgba(235,235,245,0.3)"
                autoFocus
              />
            </View>

            <View style={styles.section}>
              <View style={styles.fieldIdHeader}>
                <Text style={styles.label}>Field ID *</Text>
                {!isEditMode && (
                  <Pressable
                    onPress={() => setAutoGenerateId(!autoGenerateId)}
                    style={styles.autoButton}
                  >
                    <Text style={styles.autoButtonText}>
                      {autoGenerateId ? 'Auto ✓' : 'Manual'}
                    </Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={fieldId}
                onChangeText={(text) => {
                  setAutoGenerateId(false)
                  setFieldId(text)
                }}
                placeholder="field_id"
                placeholderTextColor="rgba(235,235,245,0.3)"
                editable={!autoGenerateId || isEditMode}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Field Type</Text>
              <View style={styles.typeGrid}>
                {FIELD_TYPES.map(ft => (
                  <Pressable
                    key={ft.value}
                    style={[styles.typeButton, type === ft.value && styles.typeButtonActive]}
                    onPress={() => setType(ft.value)}
                  >
                    <Text style={styles.typeIcon}>{ft.icon}</Text>
                    <Text style={[styles.typeLabel, type === ft.value && styles.typeLabelActive]}>
                      {ft.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {type === 'select' && (
              <View style={styles.section}>
                <Text style={styles.label}>Dropdown Options (one per line)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={options}
                  onChangeText={setOptions}
                  placeholder={'Indica\nSativa\nHybrid'}
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  multiline
                  numberOfLines={5}
                />
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Placeholder</Text>
              <TextInput
                style={styles.input}
                value={placeholder}
                onChangeText={setPlaceholder}
                placeholder="Optional placeholder text"
                placeholderTextColor="rgba(235,235,245,0.3)"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional help text"
                placeholderTextColor="rgba(235,235,245,0.3)"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.section}>
              <Pressable
                style={styles.toggleRow}
                onPress={() => setRequired(!required)}
              >
                <Text style={styles.toggleLabel}>Required Field</Text>
                <View style={[styles.toggle, required && styles.toggleActive]}>
                  {required && <View style={styles.toggleThumb} />}
                </View>
              </Pressable>
            </View>
          </ScrollView>
        </LiquidGlassView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  background: { flex: 1 },
  backgroundFallback: { backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.contentHorizontal,
    paddingVertical: layout.cardPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: { minWidth: 60 },
  headerButtonText: { fontSize: 17, color: 'rgba(235,235,245,0.6)' },
  headerButtonTextPrimary: { color: '#60A5FA', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
  content: { flex: 1, paddingHorizontal: layout.contentHorizontal },
  section: { marginTop: 24 },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(235,235,245,0.7)', marginBottom: 8 },
  input: {
    fontSize: 17,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  monoInput: { fontFamily: 'Courier', fontSize: 15 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  fieldIdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  autoButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
  },
  autoButtonText: { fontSize: 12, color: '#60A5FA', fontWeight: '600' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  typeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  typeIcon: { fontSize: 24 },
  typeLabel: { fontSize: 11, color: 'rgba(235,235,245,0.6)', textAlign: 'center' },
  typeLabelActive: { color: '#fff', fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleLabel: { fontSize: 17, color: '#fff' },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: '#34c759', alignItems: 'flex-end' },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#fff',
  },
})
