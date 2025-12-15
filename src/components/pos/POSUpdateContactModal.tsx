/**
 * POSUpdateContactModal
 *
 * Quick modal to update customer email/phone right from POS.
 * Appears when budtender taps the missing contact banner.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { POSModal } from './POSModal'
import { colors, spacing, radius } from '@/theme/tokens'
import { useSelectedCustomer, customerActions } from '@/stores/customer.store'
import { getCustomerContactStatus, isRealEmail, isValidPhone } from '@/utils/customer-contact'
import { normalizePhone, normalizeEmail } from '@/utils/data-normalization'
import { updateCustomer } from '@/services/customers.service'
import { logger } from '@/utils/logger'

interface POSUpdateContactModalProps {
  visible: boolean
  onClose: () => void
}

function POSUpdateContactModal({ visible, onClose }: POSUpdateContactModalProps) {
  const customer = useSelectedCustomer()
  const contactStatus = getCustomerContactStatus(customer)

  // Form state
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailInputRef = useRef<TextInput>(null)
  const phoneInputRef = useRef<TextInput>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (visible && customer) {
      // Pre-fill with existing values if they're real
      setEmail(isRealEmail(customer.email) ? customer.email || '' : '')
      setPhone(isValidPhone(customer.phone) ? customer.phone || '' : '')
      setError(null)

      // Focus appropriate field
      setTimeout(() => {
        if (contactStatus.needsEmail) {
          emailInputRef.current?.focus()
        } else if (contactStatus.needsPhone) {
          phoneInputRef.current?.focus()
        }
      }, 300)
    }
  }, [visible, customer])

  const handleSave = useCallback(async () => {
    if (!customer) return

    // Validate
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedEmail && !trimmedPhone) {
      setError('Please enter an email or phone number')
      return
    }

    // Validate email format if provided
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    // Validate phone format if provided
    const normalizedPhone = trimmedPhone ? normalizePhone(trimmedPhone) : null
    if (trimmedPhone && (!normalizedPhone || normalizedPhone.length < 10)) {
      setError('Please enter a valid phone number')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // Build update object
      const updates: Record<string, string> = {}
      if (trimmedEmail) {
        const normalized = normalizeEmail(trimmedEmail)
        if (normalized) {
          updates.email = normalized
        }
      }
      if (normalizedPhone) {
        updates.phone = normalizedPhone
      }

      // Update customer via service
      const updatedCustomer = await updateCustomer(customer.id, updates)

      logger.info('Updated customer contact info', {
        customerId: customer.id,
        addedEmail: !!trimmedEmail,
        addedPhone: !!normalizedPhone,
      })

      // Update the selected customer in store
      // Cast service response to pos Customer type (service types differ, but runtime data is compatible)
      customerActions.selectCustomer(updatedCustomer as unknown as Parameters<typeof customerActions.selectCustomer>[0])

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Keyboard.dismiss()
      onClose()
    } catch (err) {
      logger.error('Failed to update customer contact info', err)
      setError(err instanceof Error ? err.message : 'Failed to update customer')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsLoading(false)
    }
  }, [customer, email, phone, onClose])

  const handleClose = useCallback(() => {
    Keyboard.dismiss()
    onClose()
  }, [onClose])

  if (!customer) return null

  return (
    <POSModal
      visible={visible}
      title="UPDATE CONTACT INFO"
      subtitle={`${customer.first_name} ${customer.last_name}`}
      onClose={handleClose}
      showCloseButton
      maxWidth={450}
    >
      <View style={styles.content}>
        {/* Email Field */}
        {contactStatus.needsEmail && (
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="customer@email.com"
              placeholderTextColor={colors.text.disabled}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType={contactStatus.needsPhone ? 'next' : 'done'}
              onSubmitEditing={() => {
                if (contactStatus.needsPhone) {
                  phoneInputRef.current?.focus()
                } else {
                  handleSave()
                }
              }}
            />
          </View>
        )}

        {/* Phone Field */}
        {contactStatus.needsPhone && (
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
            <TextInput
              ref={phoneInputRef}
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.text.disabled}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Adding contact info allows you to send receipts, order updates, and marketing messages.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </POSModal>
  )
}

const POSUpdateContactModalMemo = memo(POSUpdateContactModal)
export { POSUpdateContactModalMemo as POSUpdateContactModal }

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.subtle,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF3B30',
    textAlign: 'center',
  },
  infoContainer: {
    marginBottom: spacing.lg,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#30D158',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.2,
  },
})
