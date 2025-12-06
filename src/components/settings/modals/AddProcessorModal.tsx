/**
 * AddProcessorModal - Add Payment Processor for Location (POS)
 * Apple Engineering Standards: Clean, focused modal with validation
 *
 * Currently supports Dejavoo terminals for in-store POS payments
 */

import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { usePaymentProcessorsSettingsStore } from '@/stores/payment-processors-settings.store'

type ProcessorType = 'dejavoo' | 'stripe' | 'square' | 'clover'

interface AddProcessorModalProps {
  visible: boolean
  vendorId: string
  locationId: string
  locationName: string
  existingProcessor?: any | null
  onClose: () => void
  onSave: () => void
}

export function AddProcessorModal({
  visible,
  vendorId,
  locationId,
  locationName,
  existingProcessor,
  onClose,
  onSave,
}: AddProcessorModalProps) {
  const { createProcessor, updateProcessor } = usePaymentProcessorsSettingsStore()

  // Form state
  const [processorType, setProcessorType] = useState<ProcessorType>('dejavoo')
  const [processorName, setProcessorName] = useState('')
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production')

  // Dejavoo-specific fields
  const [authKey, setAuthKey] = useState('')
  const [tpn, setTpn] = useState('')

  const [isSaving, setIsSaving] = useState(false)

  // Reset/load form when modal opens
  useEffect(() => {
    if (visible) {
      if (existingProcessor) {
        setProcessorType(existingProcessor.processor_type || 'dejavoo')
        setProcessorName(existingProcessor.processor_name || '')
        setEnvironment(existingProcessor.environment || 'production')
        setAuthKey(existingProcessor.dejavoo_authkey || '')
        setTpn(existingProcessor.dejavoo_tpn || '')
      } else {
        // Reset for new processor
        setProcessorType('dejavoo')
        setProcessorName(`${locationName} Terminal`)
        setEnvironment('production')
        setAuthKey('')
        setTpn('')
      }
    }
  }, [existingProcessor, visible, locationName])

  const handleSave = async () => {
    // Validation
    if (!processorName.trim()) {
      Alert.alert('Validation Error', 'Processor name is required')
      return
    }

    if (processorType === 'dejavoo') {
      if (!authKey.trim()) {
        Alert.alert('Validation Error', 'Auth Key is required')
        return
      }
      if (!tpn.trim()) {
        Alert.alert('Validation Error', 'TPN (Terminal ID) is required')
        return
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsSaving(true)

    try {
      let result

      const processorData = {
        processor_type: processorType,
        name: processorName.trim(),
        is_active: true,
        is_primary: false,
        location_id: locationId,
        config: {
          environment,
          dejavoo_authkey: authKey.trim(),
          dejavoo_tpn: tpn.trim(),
        },
      }

      if (existingProcessor) {
        result = await updateProcessor(existingProcessor.id, processorData)
      } else {
        result = await createProcessor(vendorId, processorData)
      }

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onSave()
        onClose()
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', result.error || 'Failed to save processor')
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save processor')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const processorTypes: { id: ProcessorType; name: string; description: string; available: boolean }[] = [
    { id: 'dejavoo', name: 'Dejavoo', description: 'Cloud-based terminal integration', available: true },
    { id: 'stripe', name: 'Stripe Terminal', description: 'Coming soon', available: false },
    { id: 'square', name: 'Square', description: 'Coming soon', available: false },
    { id: 'clover', name: 'Clover', description: 'Coming soon', available: false },
  ]

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(235,235,245,0.1)',
        }}>
          <Pressable onPress={handleCancel} disabled={isSaving}>
            <Text style={{ ...typography.body, color: colors.text.secondary }}>Cancel</Text>
          </Pressable>
          <Text style={{ ...typography.headline, color: colors.text.primary, fontWeight: '600' }}>
            {existingProcessor ? 'Edit Processor' : 'Add Processor'}
          </Text>
          <Pressable onPress={handleSave} disabled={isSaving}>
            <Text style={{
              ...typography.body,
              color: isSaving ? colors.text.quaternary : '#60A5FA',
              fontWeight: '600',
            }}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>

        {/* Form */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
          {/* Location Info */}
          <View style={{
            padding: spacing.md,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: radius.md,
            marginBottom: spacing.lg,
          }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}>
              LOCATION
            </Text>
            <Text style={{ ...typography.body, color: colors.text.primary }}>
              {locationName}
            </Text>
          </View>

          {/* Processor Type Selection */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.sm,
            }}>
              PROCESSOR TYPE
            </Text>
            <View style={{ gap: spacing.sm }}>
              {processorTypes.map((type) => (
                <Pressable
                  key={type.id}
                  onPress={() => {
                    if (type.available) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setProcessorType(type.id)
                    }
                  }}
                  disabled={isSaving || !type.available}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    backgroundColor: processorType === type.id ? '#60A5FA20' : 'rgba(255,255,255,0.05)',
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: processorType === type.id ? '#60A5FA' : 'rgba(255,255,255,0.1)',
                    opacity: type.available ? 1 : 0.5,
                  }}
                >
                  <View>
                    <Text style={{
                      ...typography.body,
                      color: processorType === type.id ? '#60A5FA' : colors.text.primary,
                      fontWeight: processorType === type.id ? '600' : '400',
                    }}>
                      {type.name}
                    </Text>
                    <Text style={{
                      ...typography.footnote,
                      color: colors.text.tertiary,
                      marginTop: 2,
                    }}>
                      {type.description}
                    </Text>
                  </View>
                  {processorType === type.id && (
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#60A5FA',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Processor Name */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}>
              PROCESSOR NAME *
            </Text>
            <TextInput
              value={processorName}
              onChangeText={setProcessorName}
              placeholder="e.g., Front Counter Terminal"
              placeholderTextColor={colors.text.quaternary}
              style={{
                ...typography.body,
                color: colors.text.primary,
                backgroundColor: 'rgba(255,255,255,0.05)',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
              editable={!isSaving}
            />
          </View>

          {/* Environment Toggle */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}>
              ENVIRONMENT
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setEnvironment('sandbox')
                }}
                disabled={isSaving}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  backgroundColor: environment === 'sandbox' ? '#60A5FA20' : 'rgba(255,255,255,0.05)',
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: environment === 'sandbox' ? '#60A5FA' : 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  ...typography.body,
                  color: environment === 'sandbox' ? '#60A5FA' : colors.text.secondary,
                  fontWeight: environment === 'sandbox' ? '600' : '400',
                }}>
                  Sandbox
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setEnvironment('production')
                }}
                disabled={isSaving}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  backgroundColor: environment === 'production' ? '#10b98120' : 'rgba(255,255,255,0.05)',
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: environment === 'production' ? '#10b981' : 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  ...typography.body,
                  color: environment === 'production' ? '#10b981' : colors.text.secondary,
                  fontWeight: environment === 'production' ? '600' : '400',
                }}>
                  Production
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Dejavoo-specific fields */}
          {processorType === 'dejavoo' && (
            <>
              {/* Auth Key */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={{
                  ...typography.caption1,
                  color: colors.text.tertiary,
                  textTransform: 'uppercase',
                  marginBottom: spacing.xs,
                }}>
                  AUTH KEY *
                </Text>
                <TextInput
                  value={authKey}
                  onChangeText={setAuthKey}
                  placeholder="Enter Auth Key from Dejavoo portal"
                  placeholderTextColor={colors.text.quaternary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    ...typography.body,
                    color: colors.text.primary,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                  editable={!isSaving}
                />
              </View>

              {/* TPN */}
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={{
                  ...typography.caption1,
                  color: colors.text.tertiary,
                  textTransform: 'uppercase',
                  marginBottom: spacing.xs,
                }}>
                  TPN (TERMINAL ID) *
                </Text>
                <TextInput
                  value={tpn}
                  onChangeText={setTpn}
                  placeholder="Enter Terminal ID (TPN)"
                  placeholderTextColor={colors.text.quaternary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    ...typography.body,
                    color: colors.text.primary,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                  editable={!isSaving}
                />
                <Text style={{
                  ...typography.footnote,
                  color: colors.text.quaternary,
                  marginTop: spacing.xs,
                }}>
                  The unique identifier for your Dejavoo terminal
                </Text>
              </View>

              {/* Help Text */}
              <View style={{
                padding: spacing.md,
                backgroundColor: 'rgba(96,165,250,0.1)',
                borderRadius: radius.md,
                borderLeftWidth: 3,
                borderLeftColor: '#60A5FA',
              }}>
                <Text style={{ ...typography.footnote, color: colors.text.secondary }}>
                  Get your Auth Key and TPN from the Dejavoo SpotOn portal or contact your payment processor representative.
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        {isSaving && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ActivityIndicator size="large" color="#60A5FA" />
          </View>
        )}
      </View>
    </Modal>
  )
}
