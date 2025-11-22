/**
 * POSAddCustomerModal Component
 * Uses unified POSModal component - Apple-perfect design
 *
 * Features:
 * - Beautiful liquid glass design
 * - Landscape/tablet support with two-column layout
 * - Pre-filled from scanned ID data
 * - Smooth animations
 */

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { memo, useState, useEffect } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker'
import { colors, spacing, radius, borderWidth } from '@/theme/tokens'
import type { Customer } from '@/types/pos'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import { POSModal } from './POSModal'
import { logger } from '@/utils/logger'
import { createCustomer } from '@/services/customers.service'

const { width } = Dimensions.get('window')
const isTablet = width > 600

interface POSAddCustomerModalProps {
  visible: boolean
  vendorId: string
  prefilledData?: AAMVAData | null
  onCustomerCreated: (customer: Customer) => void
  onClose: () => void
}

function POSAddCustomerModal({
  visible,
  vendorId,
  prefilledData,
  onCustomerCreated,
  onClose,
}: POSAddCustomerModalProps) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [dobDate, setDobDate] = useState<Date>(new Date(2000, 0, 1))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')

  // Pre-fill form when modal opens with scanned data
  useEffect(() => {
    if (visible && prefilledData) {
      setFirstName(prefilledData.firstName || '')
      setMiddleName(prefilledData.middleName || '')
      setLastName(prefilledData.lastName || '')
      const dob = prefilledData.dateOfBirth || ''
      setDateOfBirth(dob)
      // Parse date string to Date object
      if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        setDobDate(new Date(dob))
      }
      setAddress(prefilledData.streetAddress || '')
      setCity(prefilledData.city || '')
      setState(prefilledData.state || '')
      setPostalCode(prefilledData.zipCode || '')
    } else if (visible && !prefilledData) {
      resetForm()
    }
  }, [visible, prefilledData])

  const resetForm = () => {
    setFirstName('')
    setMiddleName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setDateOfBirth('')
    setDobDate(new Date(2000, 0, 1))
    setShowDatePicker(false)
    setAddress('')
    setCity('')
    setState('')
    setPostalCode('')
    setError(null)
  }

  const handleDateFieldPress = () => {
    logger.debug('[DATE PICKER] Field pressed, showing picker')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowDatePicker(true)
  }

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setDobDate(selectedDate)
      // Format to YYYY-MM-DD
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      setDateOfBirth(`${year}-${month}-${day}`)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  const handleDateConfirm = () => {
    setShowDatePicker(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const handleClose = () => {
    if (creating) return
    resetForm()
    onClose()
  }

  const handleCreate = async () => {
    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError('First name and last name are required')
      return
    }

    // Validate date format if provided
    const dobTrimmed = dateOfBirth.trim()
    if (dobTrimmed && !/^\d{4}-\d{2}-\d{2}$/.test(dobTrimmed)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError('Date of birth must be in format YYYY-MM-DD (e.g., 1998-05-15)')
      return
    }

    setCreating(true)
    setError(null)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Use customers service (handles normalization, unique email generation, etc.)
      const serviceCustomer = await createCustomer({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        date_of_birth: dobTrimmed || undefined,
        street_address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        vendor_id: vendorId,
      })

      // Convert service Customer to POS Customer type
      const posCustomer: Customer = {
        id: serviceCustomer.id,
        first_name: serviceCustomer.first_name || '',
        last_name: serviceCustomer.last_name || '',
        email: serviceCustomer.email || '',
        phone: serviceCustomer.phone || null,
        display_name: serviceCustomer.full_name || `${serviceCustomer.first_name} ${serviceCustomer.last_name}`,
        date_of_birth: dobTrimmed || null,
        loyalty_points: serviceCustomer.loyalty_points || 0,
        loyalty_tier: 'bronze', // Default tier for new customers
        vendor_customer_number: serviceCustomer.id.slice(0, 8).toUpperCase(),
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      resetForm()
      onCustomerCreated(posCustomer)
    } catch (error) {
      logger.error('Create customer error:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(error instanceof Error ? error.message : 'Failed to create customer')
    } finally {
      setCreating(false) // ALWAYS reset creating state
    }
  }

  return (
    <POSModal
      visible={visible}
      title="NEW CUSTOMER"
      subtitle={prefilledData ? 'Review scanned information and complete details' : 'Enter customer information'}
      onClose={handleClose}
    >
      {/* Two-column layout for landscape */}
      <View style={styles.twoColumnContainer}>
        {/* Left Column - Personal Info */}
        <View style={styles.column}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[
              styles.section,
              !isLiquidGlassSupported && styles.sectionFallback,
            ]}
          >
            <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>

            {/* Name Row */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>FIRST NAME *</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="words"
                  editable={!creating}
                  accessibilityLabel="First name"
                  accessibilityHint="Required field"
                  accessibilityRole="text"
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>MIDDLE NAME</Text>
                <TextInput
                  style={styles.input}
                  value={middleName}
                  onChangeText={setMiddleName}
                  placeholder="Middle"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="words"
                  editable={!creating}
                  accessibilityLabel="Middle name"
                  accessibilityHint="Optional field"
                  accessibilityRole="text"
                />
              </View>
            </View>

            {/* Last Name */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>LAST NAME *</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="words"
                editable={!creating}
                accessibilityLabel="Last name"
                accessibilityHint="Required field"
                accessibilityRole="text"
              />
            </View>

            {/* Date of Birth */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                DATE OF BIRTH {prefilledData?.dateOfBirth && '(FROM ID)'}
              </Text>
              <TouchableOpacity
                onPress={handleDateFieldPress}
                disabled={creating}
                activeOpacity={0.7}
                style={[styles.input, styles.dateInputContainer]}
                accessibilityLabel="Date of birth"
                accessibilityHint="Optional field, tap to select date"
                accessibilityRole="button"
                accessibilityValue={{ text: dateOfBirth || 'No date selected' }}
              >
                <Text style={dateOfBirth ? styles.dateText : styles.datePlaceholder}>
                  {dateOfBirth || 'Tap to select date'}
                </Text>
              </TouchableOpacity>
            </View>
          </LiquidGlassView>
        </View>

        {/* Right Column - Contact & Address */}
        <View style={styles.column}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[
              styles.section,
              !isLiquidGlassSupported && styles.sectionFallback,
            ]}
          >
            <Text style={styles.sectionTitle}>CONTACT & ADDRESS</Text>

            {/* Phone */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PHONE</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="(704) 555-0100"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="phone-pad"
                editable={!creating}
                accessibilityLabel="Phone number"
                accessibilityHint="Optional field"
                accessibilityRole="text"
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EMAIL (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="customer@email.com"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!creating}
                accessibilityLabel="Email address"
                accessibilityHint="Optional field, auto-generated if empty"
                accessibilityRole="text"
              />
              <Text style={styles.helperText}>Auto-generated if empty</Text>
            </View>

            {/* Address */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                ADDRESS {prefilledData?.streetAddress && '(FROM ID)'}
              </Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Street address"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="words"
                editable={!creating}
                accessibilityLabel="Street address"
                accessibilityHint="Optional field"
                accessibilityRole="text"
              />
            </View>

            {/* City, State, ZIP */}
            <View style={styles.fieldRow}>
              <View style={[styles.fieldHalf, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>
                  CITY {prefilledData?.city && '(FROM ID)'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="words"
                  editable={!creating}
                  accessibilityLabel="City"
                  accessibilityHint="Optional field"
                  accessibilityRole="text"
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>
                  STATE {prefilledData?.state && '(FROM ID)'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={state}
                  onChangeText={(text) => setState(text.toUpperCase())}
                  placeholder="ST"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="characters"
                  maxLength={2}
                  editable={!creating}
                  accessibilityLabel="State"
                  accessibilityHint="Optional field, two letter state code"
                  accessibilityRole="text"
                />
              </View>
            </View>

            {/* Postal Code */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                POSTAL CODE {prefilledData?.zipCode && '(FROM ID)'}
              </Text>
              <TextInput
                style={styles.input}
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="ZIP code"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
                editable={!creating}
                accessibilityLabel="Postal code"
                accessibilityHint="Optional field"
                accessibilityRole="text"
              />
            </View>
          </LiquidGlassView>
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          tintColor="rgba(239,68,68,0.1)"
          style={[
            styles.errorAlert,
            !isLiquidGlassSupported && styles.errorAlertFallback,
          ]}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`Error: ${error}`}
          accessibilityLiveRegion="assertive"
        >
          <Text style={styles.errorAlertTitle} accessible={false}>❌ ERROR</Text>
          <Text style={styles.errorAlertText}>{error}</Text>
        </LiquidGlassView>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          interactive
          style={[
            styles.cancelButton,
            !isLiquidGlassSupported && styles.cancelButtonFallback,
          ]}
        >
          <TouchableOpacity
            style={styles.cancelButtonInner}
            onPress={handleClose}
            activeOpacity={0.7}
            disabled={creating}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityHint="Close this modal without creating a customer"
            accessibilityState={{ disabled: creating }}
          >
            <Text style={styles.cancelButtonText}>CANCEL</Text>
          </TouchableOpacity>
        </LiquidGlassView>

        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          interactive
          style={[
            styles.submitButton,
            !isLiquidGlassSupported && styles.submitButtonFallback,
            creating && styles.submitButtonDisabled,
          ]}
        >
          <TouchableOpacity
            style={styles.submitButtonInner}
            onPress={handleCreate}
            activeOpacity={0.7}
            disabled={creating}
            accessibilityRole="button"
            accessibilityLabel={creating ? 'Creating customer' : 'Create customer'}
            accessibilityHint="Save the new customer profile"
            accessibilityState={{ disabled: creating, busy: creating }}
          >
            <Text style={styles.submitButtonText}>
              {creating ? 'CREATING...' : 'CREATE CUSTOMER'}
            </Text>
          </TouchableOpacity>
        </LiquidGlassView>
      </View>

      {/* iOS-Style Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => {
          setShowDatePicker(false)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        accessibilityViewIsModal={true}
      >
        <TouchableOpacity
          style={styles.dateModalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowDatePicker(false)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close date picker"
          accessibilityHint="Double tap to dismiss date selection"
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.dateModalContent}
            accessible={true}
            accessibilityRole="none"
            accessibilityLabel="Date picker dialog. Select date of birth"
            onAccessibilityEscape={() => {
              setShowDatePicker(false)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
          >
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              style={[
                styles.datePickerCard,
                !isLiquidGlassSupported && styles.datePickerCardFallback,
              ]}
              accessible={false}
            >
              {/* Header */}
              <View style={styles.datePickerHeader} accessible={false}>
                <Text style={styles.datePickerTitle} accessibilityRole="header">SELECT DATE OF BIRTH</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowDatePicker(false)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={styles.datePickerCloseButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  accessibilityHint="Double tap to close date picker"
                >
                  <Text style={styles.datePickerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Native iOS Date Picker */}
              <View style={styles.datePickerWrapper}>
                <DateTimePicker
                  value={dobDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  textColor="#FFFFFF"
                  themeVariant="dark"
                  style={styles.nativeDatePicker}
                  accessibilityLabel="Date of birth picker"
                  accessibilityHint="Swipe up or down to change date"
                />
              </View>

              {/* Done Button */}
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                interactive
                style={[
                  styles.datePickerDoneButton,
                  !isLiquidGlassSupported && styles.datePickerDoneButtonFallback,
                ]}
                accessible={false}
              >
                <TouchableOpacity
                  style={styles.datePickerDoneButtonInner}
                  onPress={handleDateConfirm}
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                  accessibilityHint={`Double tap to confirm date ${dateOfBirth || 'selection'}`}
                >
                  <Text style={styles.datePickerDoneButtonText}>DONE</Text>
                </TouchableOpacity>
              </LiquidGlassView>
            </LiquidGlassView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </POSModal>
  )
}

const POSAddCustomerModalMemo = memo(POSAddCustomerModal)
export { POSAddCustomerModalMemo as POSAddCustomerModal }

const styles = StyleSheet.create({
  twoColumnContainer: {
    flexDirection: isTablet ? 'row' : 'column',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  column: {
    flex: 1,
  },
  section: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacing.md,
    overflow: 'hidden',
  },
  sectionFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(96,165,250,0.9)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: borderWidth.thick,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  dateInputContainer: {
    justifyContent: 'center',
    minHeight: 44, // Ensure adequate touch target
  },
  dateText: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  datePlaceholder: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: -0.1,
  },
  // Date Picker Modal Styles
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  datePickerCard: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  datePickerCardFallback: {
    backgroundColor: 'rgba(28,28,30,0.98)',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  datePickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  datePickerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerCloseText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.4,
  },
  datePickerWrapper: {
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  nativeDatePicker: {
    height: 200,
    width: '100%',
  },
  datePickerDoneButton: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(59,130,246,0.3)',
    marginTop: spacing.md,
  },
  datePickerDoneButtonFallback: {
    backgroundColor: 'rgba(59,130,246,0.8)',
  },
  datePickerDoneButtonInner: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  datePickerDoneButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  helperText: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.disabled,
    letterSpacing: 0,
    marginTop: spacing.xs,
  },
  errorAlert: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacing.md,
    overflow: 'hidden',
    borderWidth: borderWidth.regular,
    borderColor: colors.semantic.errorBorder,
  },
  errorAlertFallback: {
    backgroundColor: colors.semantic.errorBg,
  },
  errorAlertTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.semantic.error,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  errorAlertText: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cancelButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelButtonInner: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
  submitButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(59,130,246,0.3)',
  },
  submitButtonFallback: {
    backgroundColor: 'rgba(59,130,246,0.8)',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonInner: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  warningAlert: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacing.md,
    overflow: 'hidden',
    borderWidth: borderWidth.regular,
    borderColor: 'rgba(245,158,11,0.5)',
  },
  warningAlertFallback: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  warningAlertTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(245,158,11,1)',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  warningAlertText: {
    fontSize: 11,
    fontWeight: '300',
    color: colors.text.tertiary,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
  },
  duplicateCustomerCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  duplicateCustomerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  duplicateCustomerDetail: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  useExistingButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: 'rgba(59,130,246,0.5)',
    alignItems: 'center',
  },
  useExistingButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(96,165,250,1)',
    letterSpacing: 0.6,
  },
})
