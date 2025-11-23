/**
 * PaymentProcessorModal Component
 * Add/Edit payment processors - Steve Jobs simplicity
 * Progressive disclosure: Show only relevant fields
 */

import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native'
import { useState, useMemo, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import type { PaymentProcessor, ProcessorType, ProcessorFormData } from '@/types/payment-processors'

interface PaymentProcessorModalProps {
  visible: boolean
  processor: PaymentProcessor | null
  locationId?: string | null
  onClose: () => void
  onCreate: (data: ProcessorFormData) => Promise<{ success: boolean; error?: string }>
  onUpdate: (processorId: string, data: Partial<ProcessorFormData>) => Promise<{ success: boolean; error?: string }>
}

const PROCESSOR_TYPES: { value: ProcessorType; label: string; description: string }[] = [
  { value: 'dejavoo', label: 'Dejavoo', description: 'Countertop terminals' },
  { value: 'stripe', label: 'Stripe', description: 'Online payments' },
  { value: 'square', label: 'Square', description: 'POS system' },
  { value: 'authorizenet', label: 'Authorize.Net', description: 'Payment gateway' },
  { value: 'clover', label: 'Clover', description: 'POS system' },
]

export function PaymentProcessorModal({
  visible,
  processor,
  locationId,
  onClose,
  onCreate,
  onUpdate,
}: PaymentProcessorModalProps) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height
  const isEditing = !!processor

  const [formData, setFormData] = useState<ProcessorFormData>({
    processor_type: 'dejavoo',
    processor_name: '',
    location_id: locationId || null,
    environment: 'production',
    is_default: false,
  })

  const [saving, setSaving] = useState(false)

  // Initialize form when processor changes
  useEffect(() => {
    if (processor) {
      setFormData({
        processor_type: processor.processor_type,
        processor_name: processor.processor_name,
        location_id: processor.location_id,
        environment: processor.environment,
        is_default: processor.is_default,
        // Credentials
        dejavoo_authkey: processor.dejavoo_authkey || '',
        dejavoo_tpn: processor.dejavoo_tpn || '',
        dejavoo_register_id: processor.dejavoo_register_id || '',
        stripe_secret_key: processor.stripe_secret_key || '',
        stripe_publishable_key: processor.stripe_publishable_key || '',
        square_access_token: processor.square_access_token || '',
        square_location_id: processor.square_location_id || '',
        authorizenet_api_login_id: processor.authorizenet_api_login_id || '',
        authorizenet_transaction_key: processor.authorizenet_transaction_key || '',
        clover_api_token: processor.clover_api_token || '',
        clover_merchant_id: processor.clover_merchant_id || '',
      })
    } else {
      setFormData({
        processor_type: 'dejavoo',
        processor_name: '',
        location_id: locationId || null,
        environment: 'production',
        is_default: false,
      })
    }
  }, [processor, locationId])

  const modalStyle = useMemo(
    () => ({
      width: (isLandscape ? '70%' : '85%') as '70%' | '85%',
      maxWidth: isLandscape ? 800 : 600,
      height: isLandscape ? height * 0.75 : height * 0.7,
      maxHeight: isLandscape ? height * 0.85 : height * 0.8,
    }),
    [isLandscape, height]
  )

  const handleSave = async () => {
    if (!formData.processor_name.trim()) {
      Alert.alert('Required', 'Please enter a processor name')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSaving(true)

    try {
      let result
      if (isEditing) {
        result = await onUpdate(processor.id, formData)
      } else {
        result = await onCreate(formData)
      }

      if (result.success) {
        onClose()
      } else {
        Alert.alert('Error', result.error || 'Failed to save processor')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  // Render credential fields based on processor type
  const renderCredentialFields = () => {
    switch (formData.processor_type) {
      case 'dejavoo':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Auth Key</Text>
              <TextInput
                style={styles.input}
                value={formData.dejavoo_authkey}
                onChangeText={(text) => setFormData({ ...formData, dejavoo_authkey: text })}
                placeholder="10-character auth key"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>TPN (Terminal Profile Number)</Text>
              <TextInput
                style={styles.input}
                value={formData.dejavoo_tpn}
                onChangeText={(text) => setFormData({ ...formData, dejavoo_tpn: text })}
                placeholder="Terminal profile number"
                placeholderTextColor={colors.text.quaternary}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Register ID (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.dejavoo_register_id}
                onChangeText={(text) => setFormData({ ...formData, dejavoo_register_id: text })}
                placeholder="Register identifier"
                placeholderTextColor={colors.text.quaternary}
              />
            </View>
          </>
        )

      case 'stripe':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Secret Key</Text>
              <TextInput
                style={styles.input}
                value={formData.stripe_secret_key}
                onChangeText={(text) => setFormData({ ...formData, stripe_secret_key: text })}
                placeholder="sk_..."
                placeholderTextColor={colors.text.quaternary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Publishable Key</Text>
              <TextInput
                style={styles.input}
                value={formData.stripe_publishable_key}
                onChangeText={(text) => setFormData({ ...formData, stripe_publishable_key: text })}
                placeholder="pk_..."
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="none"
              />
            </View>
          </>
        )

      case 'square':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Access Token</Text>
              <TextInput
                style={styles.input}
                value={formData.square_access_token}
                onChangeText={(text) => setFormData({ ...formData, square_access_token: text })}
                placeholder="Access token"
                placeholderTextColor={colors.text.quaternary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Location ID</Text>
              <TextInput
                style={styles.input}
                value={formData.square_location_id}
                onChangeText={(text) => setFormData({ ...formData, square_location_id: text })}
                placeholder="Location identifier"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="none"
              />
            </View>
          </>
        )

      case 'authorizenet':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>API Login ID</Text>
              <TextInput
                style={styles.input}
                value={formData.authorizenet_api_login_id}
                onChangeText={(text) => setFormData({ ...formData, authorizenet_api_login_id: text })}
                placeholder="API login ID"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Transaction Key</Text>
              <TextInput
                style={styles.input}
                value={formData.authorizenet_transaction_key}
                onChangeText={(text) => setFormData({ ...formData, authorizenet_transaction_key: text })}
                placeholder="Transaction key"
                placeholderTextColor={colors.text.quaternary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </>
        )

      case 'clover':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>API Token</Text>
              <TextInput
                style={styles.input}
                value={formData.clover_api_token}
                onChangeText={(text) => setFormData({ ...formData, clover_api_token: text })}
                placeholder="API token"
                placeholderTextColor={colors.text.quaternary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Merchant ID</Text>
              <TextInput
                style={styles.input}
                value={formData.clover_merchant_id}
                onChangeText={(text) => setFormData({ ...formData, clover_merchant_id: text })}
                placeholder="Merchant identifier"
                placeholderTextColor={colors.text.quaternary}
                autoCapitalize="none"
              />
            </View>
          </>
        )
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.overlay}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.modal, modalStyle, !isLiquidGlassSupported && styles.modalFallback]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {isEditing ? 'Edit Processor' : 'Add Processor'}
            </Text>
            <Pressable onPress={handleSave} style={styles.headerButton} disabled={saving}>
              <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Processor Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Processor Name</Text>
              <TextInput
                style={styles.input}
                value={formData.processor_name}
                onChangeText={(text) => setFormData({ ...formData, processor_name: text })}
                placeholder="e.g. Front Counter Terminal"
                placeholderTextColor={colors.text.quaternary}
              />
            </View>

            {/* Processor Type */}
            <View style={styles.field}>
              <Text style={styles.label}>Processor Type</Text>
              <View style={styles.segmentedControl}>
                {PROCESSOR_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    style={[
                      styles.segment,
                      formData.processor_type === type.value && styles.segmentActive,
                      isEditing && styles.segmentDisabled,
                    ]}
                    onPress={() => {
                      if (!isEditing) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setFormData({ ...formData, processor_type: type.value })
                      }
                    }}
                    disabled={isEditing}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        formData.processor_type === type.value && styles.segmentTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {isEditing && (
                <Text style={styles.hint}>Processor type cannot be changed after creation</Text>
              )}
            </View>

            {/* Environment */}
            <View style={styles.field}>
              <Text style={styles.label}>Environment</Text>
              <View style={styles.segmentedControl}>
                <Pressable
                  style={[
                    styles.segment,
                    formData.environment === 'production' && styles.segmentActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setFormData({ ...formData, environment: 'production' })
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      formData.environment === 'production' && styles.segmentTextActive,
                    ]}
                  >
                    Production
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segment,
                    formData.environment === 'sandbox' && styles.segmentActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setFormData({ ...formData, environment: 'sandbox' })
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      formData.environment === 'sandbox' && styles.segmentTextActive,
                    ]}
                  >
                    Sandbox
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Credentials Section */}
            <Text style={styles.sectionTitle}>CREDENTIALS</Text>
            {renderCredentialFields()}

            <View style={{ height: 40 }} />
          </ScrollView>
        </LiquidGlassView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  modalFallback: {
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    minWidth: 70,
    paddingVertical: spacing.xs,
  },
  headerButtonText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  headerButtonTextPrimary: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  headerTitle: {
    ...typography.headline,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption1,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.footnote,
    color: colors.text.quaternary,
    marginTop: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.glass.thin,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    minHeight: 44,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.glass.thin,
    borderRadius: radius.lg,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#60A5FA',
  },
  segmentDisabled: {
    opacity: 0.5,
  },
  segmentText: {
    ...typography.footnote,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text.primary,
  },
  sectionTitle: {
    ...typography.caption1,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
})
