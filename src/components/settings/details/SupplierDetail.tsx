/**
 * SupplierDetail Component
 * iOS Settings style detail view for supplier editing and viewing
 */

import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { layout } from '@/theme/layout'
import { spacing, radius, colors } from '@/theme/tokens'
import { Breadcrumb } from '@/components/shared'
import { useSuppliersActions } from '@/stores/suppliers-management.store'

interface SupplierDetailProps {
  supplier?: any // undefined means creating new supplier
  onBack: () => void
  onSupplierSaved: () => void
}

interface SettingsRowProps {
  label: string
  value?: string
  placeholder?: string
  editable?: boolean
  onChangeText?: (text: string) => void
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url'
  multiline?: boolean
}

function SettingsRow({ label, value, placeholder, editable, onChangeText, keyboardType = 'default', multiline }: SettingsRowProps) {
  return (
    <View style={[styles.row, multiline && styles.rowMultiline]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {editable ? (
        <TextInput
          style={[styles.rowInput, multiline && styles.rowInputMultiline]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="rgba(235,235,245,0.3)"
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      ) : (
        <Text style={styles.rowValue}>{value || '-'}</Text>
      )}
    </View>
  )
}

export function SupplierDetail({ supplier, onBack, onSupplierSaved }: SupplierDetailProps) {
  const isNewSupplier = !supplier
  const { createSupplier, updateSupplier } = useSuppliersActions()

  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    external_name: supplier?.external_name || '',
    contact_name: supplier?.contact_name || '',
    contact_email: supplier?.contact_email || '',
    contact_phone: supplier?.contact_phone || '',
    website: supplier?.website || '',
    notes: supplier?.notes || '',
  })

  const handleSave = async () => {
    // Validation
    if (!formData.external_name.trim()) {
      Alert.alert('Error', 'Supplier name is required')
      return
    }

    setIsSaving(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      if (isNewSupplier) {
        // Creating new supplier
        const result = await createSupplier({
          external_name: formData.external_name,
          contact_name: formData.contact_name || undefined,
          contact_email: formData.contact_email || undefined,
          contact_phone: formData.contact_phone || undefined,
          website: formData.website || undefined,
          notes: formData.notes || undefined,
        })
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onSupplierSaved()
          onBack()
        } else {
          Alert.alert('Error', result.error || 'Failed to create supplier')
        }
      } else {
        // Updating existing supplier
        const result = await updateSupplier(supplier.id, {
          external_name: formData.external_name,
          contact_name: formData.contact_name || undefined,
          contact_email: formData.contact_email || undefined,
          contact_phone: formData.contact_phone || undefined,
          website: formData.website || undefined,
          notes: formData.notes || undefined,
        })
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onSupplierSaved()
          onBack()
        } else {
          Alert.alert('Error', result.error || 'Failed to update supplier')
        }
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save supplier')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onBack()
  }

  return (
    <ScrollView
      style={styles.detail}
      contentContainerStyle={{ paddingBottom: layout.dockHeight, paddingRight: 0 }}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
    >
      {/* Header with Breadcrumb */}
      <View style={styles.detailHeader}>
        <Breadcrumb
          items={[
            { label: 'Suppliers', onPress: onBack },
            { label: isNewSupplier ? 'New Supplier' : formData.external_name },
          ]}
        />
        <View style={styles.headerActions}>
          <Pressable onPress={handleCancel} disabled={isSaving}>
            <Text style={[styles.actionText, styles.cancelText]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.actionText, styles.saveText]}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Supplier Icon Card */}
      <View style={styles.section}>
        <View style={styles.headerCardGlass}>
          <View style={styles.headerCard}>
            <View style={[styles.headerIcon, styles.headerIconPlaceholder]}>
              <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 14, height: 12, borderWidth: 1.5, borderColor: 'rgba(235,235,245,0.6)', borderTopWidth: 0, alignItems: 'center', justifyContent: 'flex-end' }}>
                  <View style={{ width: 6, height: 8, borderWidth: 1.5, borderColor: 'rgba(235,235,245,0.6)', marginBottom: 1 }} />
                </View>
              </View>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>
                {formData.external_name || 'New Supplier'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {formData.contact_name || 'No contact name'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Company Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>COMPANY INFORMATION</Text>
        <View style={styles.cardGlass}>
          <SettingsRow
            label="Company Name"
            value={formData.external_name}
            placeholder="Supplier name"
            editable={true}
            onChangeText={(text) => setFormData({ ...formData, external_name: text })}
          />
          <View style={styles.rowLast}>
            <SettingsRow
              label="Website"
              value={formData.website}
              placeholder="https://example.com"
              editable={true}
              onChangeText={(text) => setFormData({ ...formData, website: text })}
              keyboardType="url"
            />
          </View>
        </View>
      </View>

      {/* Contact Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
        <View style={styles.cardGlass}>
          <SettingsRow
            label="Contact Name"
            value={formData.contact_name}
            placeholder="John Doe"
            editable={true}
            onChangeText={(text) => setFormData({ ...formData, contact_name: text })}
          />
          <SettingsRow
            label="Email"
            value={formData.contact_email}
            placeholder="contact@example.com"
            editable={true}
            onChangeText={(text) => setFormData({ ...formData, contact_email: text })}
            keyboardType="email-address"
          />
          <View style={styles.rowLast}>
            <SettingsRow
              label="Phone"
              value={formData.contact_phone}
              placeholder="(555) 123-4567"
              editable={true}
              onChangeText={(text) => setFormData({ ...formData, contact_phone: text })}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>

      {/* Notes Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTES</Text>
        <View style={styles.cardGlass}>
          <View style={styles.rowLast}>
            <SettingsRow
              label="Notes"
              value={formData.notes}
              placeholder="Add notes about this supplier..."
              editable={true}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              multiline={true}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  detail: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.containerMargin,
    paddingTop: layout.contentStartTop,
    paddingBottom: spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelText: {
    color: 'rgba(235,235,245,0.6)',
  },
  saveText: {
    color: '#fff',
  },
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.containerMargin,
    gap: layout.containerMargin,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: layout.cardRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowMultiline: {
    alignItems: 'flex-start',
    minHeight: 80,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    minWidth: 100,
  },
  rowValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  rowInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    textAlign: 'right',
    paddingVertical: 4,
  },
  rowInputMultiline: {
    textAlign: 'left',
    minHeight: 60,
    paddingTop: 8,
  },
})
