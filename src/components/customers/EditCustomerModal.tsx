/**
 * Edit Customer Modal
 * Apple-style modal for creating/editing customers
 * Uses POSModal for consistency
 */

import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native'
import React, { useState, useCallback } from 'react'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { device } from '@/theme/tokens'
import { POSModal } from '@/components/pos/POSModal'
import { customersService, type Customer } from '@/services/customers.service'
import { logger } from '@/utils/logger'
import { findPotentialDuplicates } from '@/utils/customer-deduplication'
import * as Haptics from 'expo-haptics'

interface EditCustomerModalProps {
  visible: boolean
  customer?: Customer | null
  onClose: () => void
  onSuccess: (customer: Customer) => void
}

export function EditCustomerModal({
  visible,
  customer,
  onClose,
  onSuccess,
}: EditCustomerModalProps) {
  const isEditing = !!customer
  const isTablet = device.isTablet

  // Form State
  const [firstName, setFirstName] = useState(customer?.first_name || '')
  const [lastName, setLastName] = useState(customer?.last_name || '')
  const [email, setEmail] = useState(customer?.email || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal closes
  const handleClose = useCallback(() => {
    setFirstName(customer?.first_name || '')
    setLastName(customer?.last_name || '')
    setEmail(customer?.email || '')
    setPhone(customer?.phone || '')
    setIsSubmitting(false)
    onClose()
  }, [customer, onClose])

  // Format phone as user types
  const handlePhoneChange = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '')

    // Format as (XXX) XXX-XXXX
    let formatted = cleaned
    if (cleaned.length > 0) {
      if (cleaned.length <= 3) {
        formatted = cleaned
      } else if (cleaned.length <= 6) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
      } else {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
      }
    }

    setPhone(formatted)
  }

  // Check for duplicates
  const checkDuplicates = useCallback(async (): Promise<boolean> => {
    if (!email && !phone) return true

    try {
      // Get all customers to check for duplicates
      const allCustomers = await customersService.getCustomers()

      // Find potential duplicates
      const duplicates = findPotentialDuplicates(
        { email, phone, first_name: firstName, last_name: lastName },
        allCustomers
      )

      // Filter out current customer if editing
      const relevantDuplicates = isEditing
        ? duplicates.filter((d) => d.customer.id !== customer!.id)
        : duplicates

      if (relevantDuplicates.length > 0) {
        const duplicate = relevantDuplicates[0]
        const matchTypes = duplicate.matchTypes.join(', ')

        return new Promise((resolve) => {
          Alert.alert(
            'Potential Duplicate Found',
            `A customer with matching ${matchTypes} already exists:\n\n${duplicate.customer.full_name || 'Unknown'}\n${duplicate.customer.email || ''}\n${duplicate.customer.phone || ''}\n\nDo you want to continue anyway?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Continue',
                onPress: () => resolve(true),
              },
            ]
          )
        })
      }

      return true
    } catch (err) {
      logger.error('Failed to check duplicates:', err)
      return true // Continue if check fails
    }
  }, [email, phone, firstName, lastName, isEditing, customer])

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Validation
    if (!firstName && !lastName && !email && !phone) {
      Alert.alert('Validation Error', 'Please provide at least a name, email, or phone number.')
      return
    }

    try {
      setIsSubmitting(true)

      // Check for duplicates
      const shouldContinue = await checkDuplicates()
      if (!shouldContinue) {
        setIsSubmitting(false)
        return
      }

      // Prepare data
      const customerData = {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        email: email.trim().toLowerCase() || undefined,
        phone: phone.replace(/\D/g, '') || undefined, // Remove formatting
      }

      let result: Customer

      if (isEditing) {
        // Update existing customer
        result = await customersService.updateCustomer(customer!.id, customerData)
      } else {
        // Create new customer
        result = await customersService.createCustomer(customerData)
      }

      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSuccess(result)
      handleClose()
    } catch (err) {
      logger.error('Failed to save customer:', err)
      Alert.alert(
        'Error',
        isEditing ? 'Failed to update customer' : 'Failed to create customer'
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [firstName, lastName, email, phone, isEditing, customer, checkDuplicates, onSuccess, handleClose])

  return (
    <POSModal
      visible={visible}
      title={isEditing ? 'EDIT CUSTOMER' : 'NEW CUSTOMER'}
      subtitle={isEditing ? 'Update customer information' : 'Enter customer information'}
      onClose={handleClose}
      maxWidth={isTablet ? 700 : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name Fields */}
        <View style={[styles.row, isTablet && styles.twoColumn]}>
          <View style={[styles.field, isTablet && styles.fieldHalf]}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="John"
              placeholderTextColor={colors.text.placeholder}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={[styles.field, isTablet && styles.fieldHalf]}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Doe"
              placeholderTextColor={colors.text.placeholder}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor={colors.text.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        {/* Phone */}
        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="(555) 555-5555"
            placeholderTextColor={colors.text.placeholder}
            keyboardType="phone-pad"
            maxLength={14} // (XXX) XXX-XXXX
            returnKeyType="done"
          />
        </View>

        {/* Helper Text */}
        <Text style={styles.helperText}>
          At least one field (name, email, or phone) is required.
        </Text>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Customer'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </POSModal>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  row: {
    gap: spacing.md,
  },
  twoColumn: {
    flexDirection: 'row',
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    ...typography.subhead,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.input,
    color: colors.text.primary,
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  helperText: {
    ...typography.footnote,
    color: colors.text.tertiary,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  submitButton: {
    backgroundColor: colors.semantic.success,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
  },
  submitButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
  },
})
