/**
 * Supplier Management Modals - Professional Apple-style modals
 * Clean, monochrome design matching current theme
 * Optimized for both portrait and landscape orientations
 */

import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator, Alert, useWindowDimensions } from 'react-native'
import { useState, useMemo } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { BlurView } from 'expo-blur'
import type { Supplier } from '@/types/suppliers'
import { useActiveModal, useSelectedSupplier, useSettingsUIActions } from '@/stores/settings-ui.store'
import { useSuppliersActions } from '@/stores/suppliers-management.store'

// ✅ ZERO PROPS - Component reads everything from stores
export function SupplierManagementModals() {
  // Read modal state from store
  const activeModal = useActiveModal()
  const selectedSupplier = useSelectedSupplier()

  // Get actions from stores
  const { closeModal } = useSettingsUIActions()
  const { createSupplier, updateSupplier } = useSuppliersActions()

  return (
    <>
      {(activeModal === 'addSupplier' || activeModal === 'editSupplier') && (
        <AddEditSupplierModal
          supplier={selectedSupplier}
          onClose={closeModal}
          onCreateSupplier={createSupplier}
          onUpdateSupplier={updateSupplier}
        />
      )}
    </>
  )
}

// Add/Edit Supplier Modal
function AddEditSupplierModal({
  supplier,
  onClose,
  onCreateSupplier,
  onUpdateSupplier,
}: {
  supplier: Supplier | null
  onClose: () => void
  onCreateSupplier: any
  onUpdateSupplier: any
}) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [formData, setFormData] = useState({
    external_name: supplier?.external_name || '',
    contact_name: supplier?.contact_name || '',
    contact_email: supplier?.contact_email || '',
    contact_phone: supplier?.contact_phone || '',
    address: supplier?.address || '',
    notes: supplier?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculate responsive dimensions
  const modalStyle = useMemo(() => ({
    width: isLandscape ? '75%' : '90%',
    maxWidth: isLandscape ? 800 : 600,
    maxHeight: isLandscape ? height * 0.85 : height * 0.85,
  }), [isLandscape, height])

  const scrollContentStyle = useMemo(() => ({
    maxHeight: isLandscape ? height * 0.6 : height * 0.65,
  }), [isLandscape, height])

  async function handleSubmit() {
    setError('')
    setLoading(true)

    try {
      let result
      if (supplier) {
        // Update existing supplier
        result = await onUpdateSupplier(supplier.id, formData)
      } else {
        // Create new supplier
        result = await onCreateSupplier(formData)
      }

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // ✅ Store actions auto-reload, no need for manual reload
        onClose()
      } else {
        setError(result.error || 'Failed to save supplier')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save supplier')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <BlurView intensity={40} style={styles.modalOverlay} tint="dark">
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalContainer, modalStyle]}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.modalContent, !isLiquidGlassSupported && styles.modalContentFallback]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{supplier ? 'Edit Supplier' : 'Add New Supplier'}</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            {/* Form */}
            <ScrollView
              style={[styles.modalScroll, scrollContentStyle]}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Supplier Name */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Supplier Name *</Text>
                <TextInput
                  value={formData.external_name}
                  onChangeText={(text) => setFormData({ ...formData, external_name: text })}
                  style={styles.input}
                  placeholder="Company or Supplier Name"
                  placeholderTextColor={colors.text.quaternary}
                />
              </View>

              {/* Contact Name & Email */}
              <View style={styles.formRow}>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.fieldLabel}>Contact Name</Text>
                  <TextInput
                    value={formData.contact_name}
                    onChangeText={(text) => setFormData({ ...formData, contact_name: text })}
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={colors.text.quaternary}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    value={formData.contact_email}
                    onChangeText={(text) => setFormData({ ...formData, contact_email: text })}
                    style={styles.input}
                    placeholder="contact@supplier.com"
                    placeholderTextColor={colors.text.quaternary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Phone */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  value={formData.contact_phone}
                  onChangeText={(text) => setFormData({ ...formData, contact_phone: text })}
                  style={styles.input}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={colors.text.quaternary}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Address */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Address</Text>
                <TextInput
                  value={formData.address}
                  onChangeText={(text) => setFormData({ ...formData, address: text })}
                  style={styles.input}
                  placeholder="123 Main St, City, State ZIP"
                  placeholderTextColor={colors.text.quaternary}
                />
              </View>

              {/* Notes */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Additional notes or payment terms"
                  placeholderTextColor={colors.text.quaternary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={onClose}
                disabled={loading}
                style={[styles.button, styles.buttonSecondary]}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={loading || !formData.external_name}
                style={[styles.button, styles.buttonPrimary]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>
                    {supplier ? 'Save Changes' : 'Add Supplier'}
                  </Text>
                )}
              </Pressable>
            </View>
          </LiquidGlassView>
        </View>
      </BlurView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    // Dimensions set dynamically per modal via useMemo
  },
  modalContent: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalContentFallback: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
  },

  // Modal Header
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.text.primary,
    marginTop: -4,
  },

  // Modal Body
  modalScroll: {
    // maxHeight set dynamically per modal via useMemo
  },
  modalScrollContent: {
    padding: spacing.lg,
  },

  // Form Fields
  formField: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formFieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.1,
    marginBottom: spacing.xs,
  },
  input: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  inputMultiline: {
    height: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },

  // Error Box
  errorBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#f87171',
    letterSpacing: -0.1,
  },

  // Modal Footer
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
})
