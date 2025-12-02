/**
 * AuthorizeNetModal - Configure Authorize.Net E-Commerce Gateway
 * Apple Engineering Standards: Clean, focused modal with validation
 */

import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Alert, Switch } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { usePaymentProcessorsSettingsStore } from '@/stores/payment-processors-settings.store'

interface AuthorizeNetModalProps {
  visible: boolean
  vendorId: string
  existingProcessor?: any | null
  onClose: () => void
  onSave: () => void
}

export function AuthorizeNetModal({
  visible,
  vendorId,
  existingProcessor,
  onClose,
  onSave,
}: AuthorizeNetModalProps) {
  const { createProcessor, updateProcessor } = usePaymentProcessorsSettingsStore()

  const [processorName, setProcessorName] = useState('E-Commerce Gateway')
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [apiLoginId, setApiLoginId] = useState('')
  const [transactionKey, setTransactionKey] = useState('')
  const [publicClientKey, setPublicClientKey] = useState('')
  const [signatureKey, setSignatureKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Load existing processor data
  useEffect(() => {
    if (existingProcessor) {
      setProcessorName(existingProcessor.processor_name || 'E-Commerce Gateway')
      setEnvironment(existingProcessor.environment || 'sandbox')
      setApiLoginId(existingProcessor.authorizenet_api_login_id || '')
      setTransactionKey(existingProcessor.authorizenet_transaction_key || '')
      setPublicClientKey(existingProcessor.authorizenet_public_client_key || '')
      setSignatureKey(existingProcessor.authorizenet_signature_key || '')
    } else {
      // Reset for new processor
      setProcessorName('E-Commerce Gateway')
      setEnvironment('sandbox')
      setApiLoginId('')
      setTransactionKey('')
      setPublicClientKey('')
      setSignatureKey('')
    }
  }, [existingProcessor, visible])

  const handleSave = async () => {
    // Validation
    if (!apiLoginId.trim()) {
      Alert.alert('Validation Error', 'API Login ID is required')
      return
    }
    if (!transactionKey.trim()) {
      Alert.alert('Validation Error', 'Transaction Key is required')
      return
    }
    if (!publicClientKey.trim()) {
      Alert.alert('Validation Error', 'Public Client Key is required for online payments')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsSaving(true)

    try {
      let result

      if (existingProcessor) {
        // Update existing processor
        result = await updateProcessor(existingProcessor.id, {
          processor_type: 'authorizenet',
          name: processorName.trim(),
          is_active: true,
          is_primary: false,
          config: {
            authorizenet_api_login_id: apiLoginId.trim(),
            authorizenet_transaction_key: transactionKey.trim(),
            authorizenet_public_client_key: publicClientKey.trim(),
            authorizenet_signature_key: signatureKey.trim() || null,
            environment,  // Now environment is included in updates
            is_ecommerce_processor: true,
          },
        })
      } else {
        // Create new processor
        result = await createProcessor(vendorId, {
          processor_type: 'authorizenet',
          name: processorName.trim(),
          is_active: true,
          is_primary: false,
          location_id: null, // E-commerce processors are vendor-level, not location-based
          config: {
            authorizenet_api_login_id: apiLoginId.trim(),
            authorizenet_transaction_key: transactionKey.trim(),
            authorizenet_public_client_key: publicClientKey.trim(),
            authorizenet_signature_key: signatureKey.trim() || null,
            environment,
            is_ecommerce_processor: true,
          },
        })
      }

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onSave()
        onClose()
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Error', result.error || 'Failed to save gateway configuration')
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save gateway')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

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
            {existingProcessor ? 'Edit Gateway' : 'Add Gateway'}
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
        <View style={{ flex: 1, padding: spacing.lg }}>
          {/* Gateway Name */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}>
              GATEWAY NAME
            </Text>
            <TextInput
              value={processorName}
              onChangeText={setProcessorName}
              placeholder="E-Commerce Gateway"
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
                  backgroundColor: environment === 'production' ? '#ef444420' : 'rgba(255,255,255,0.05)',
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: environment === 'production' ? '#ef4444' : 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  ...typography.body,
                  color: environment === 'production' ? '#ef4444' : colors.text.secondary,
                  fontWeight: environment === 'production' ? '600' : '400',
                }}>
                  Production
                </Text>
              </Pressable>
            </View>
          </View>

          {/* API Login ID */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}>
              API LOGIN ID *
            </Text>
            <TextInput
              value={apiLoginId}
              onChangeText={setApiLoginId}
              placeholder="Enter API Login ID"
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

          {/* Transaction Key */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}>
              TRANSACTION KEY *
            </Text>
            <TextInput
              value={transactionKey}
              onChangeText={setTransactionKey}
              placeholder="Enter Transaction Key"
              placeholderTextColor={colors.text.quaternary}
              secureTextEntry
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

          {/* Public Client Key */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}>
              PUBLIC CLIENT KEY *
            </Text>
            <TextInput
              value={publicClientKey}
              onChangeText={setPublicClientKey}
              placeholder="Enter Public Client Key"
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
              Required for Accept.js integration on your website (client-side tokenization)
            </Text>
          </View>

          {/* Signature Key (Optional) */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{
              ...typography.caption1,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}>
              SIGNATURE KEY (OPTIONAL)
            </Text>
            <TextInput
              value={signatureKey}
              onChangeText={setSignatureKey}
              placeholder="For webhook validation"
              placeholderTextColor={colors.text.quaternary}
              secureTextEntry
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
              Used for validating webhook notifications from Authorize.Net
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
              Get your credentials from the Authorize.Net Merchant Interface under Account → Security Settings → API Credentials & Keys
            </Text>
          </View>
        </View>

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
