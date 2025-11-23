/**
 * User Management Modals - Apple-style modals for user management
 * Following iOS design patterns with LiquidGlass and smooth interactions
 * Optimized for both portrait and landscape orientations
 */

import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator, Alert, useWindowDimensions } from 'react-native'
import { useState, useEffect, useMemo } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { BlurView } from 'expo-blur'
import type { UserWithLocations } from '@/types/users'
import type { UserLocationAccess } from '@/types/users'
import { useActiveModal, useSelectedUser, useSettingsUIActions } from '@/stores/settings-ui.store'
import { useUsersActions } from '@/stores/users-management.store'
import { useUserLocations } from '@/hooks/useUserLocations'

// ✅ ZERO PROPS - Component reads everything from stores
export function UserManagementModals() {
  // Read modal state from store
  const activeModal = useActiveModal()
  const selectedUser = useSelectedUser()
  const { locations } = useUserLocations()

  // Get actions from stores
  const { closeModal } = useSettingsUIActions()
  const { createUser, updateUser, setUserPassword, assignLocations } = useUsersActions()

  return (
    <>
      {(activeModal === 'addUser' || activeModal === 'editUser') && (
        <AddEditUserModal
          user={selectedUser}
          onClose={closeModal}
          onCreateUser={createUser}
          onUpdateUser={updateUser}
        />
      )}
      {activeModal === 'setPassword' && selectedUser && (
        <SetPasswordModal
          user={selectedUser}
          onClose={closeModal}
          onSetPassword={setUserPassword}
        />
      )}
      {activeModal === 'assignLocations' && selectedUser && (
        <AssignLocationsModal
          user={selectedUser}
          locations={locations}
          onClose={closeModal}
          onAssignLocations={assignLocations}
        />
      )}
    </>
  )
}

// Add/Edit User Modal
function AddEditUserModal({
  user,
  onClose,
  onCreateUser,
  onUpdateUser,
}: {
  user: UserWithLocations | null
  onClose: () => void
  onCreateUser: any
  onUpdateUser: any
}) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'pos_staff',
    employee_id: user?.employee_id || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const roles = [
    { value: 'vendor_owner', label: 'Owner', description: 'Full access to all features' },
    { value: 'vendor_admin', label: 'Admin', description: 'Manage locations and staff' },
    { value: 'location_manager', label: 'Location Manager', description: 'Manage single location' },
    { value: 'pos_staff', label: 'POS Staff', description: 'Point of sale operations' },
    { value: 'inventory_staff', label: 'Inventory Staff', description: 'Inventory management' },
    { value: 'readonly', label: 'Read Only', description: 'View-only access' },
  ]

  // Calculate responsive dimensions
  const modalStyle = useMemo(() => ({
    width: isLandscape ? '85%' : '90%',
    maxWidth: isLandscape ? 900 : 600,
    maxHeight: isLandscape ? height * 0.85 : height * 0.85,
  }), [isLandscape, height])

  const scrollContentStyle = useMemo(() => ({
    maxHeight: isLandscape ? height * 0.5 : height * 0.6,
  }), [isLandscape, height])

  async function handleSubmit() {
    setError('')
    setLoading(true)

    try {
      let result
      if (user) {
        // Update existing user
        result = await onUpdateUser(user.id, formData)
      } else {
        // Create new user
        result = await onCreateUser(formData)
      }

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // ✅ Store actions auto-reload, no need for manual reload
        onClose()
      } else {
        setError(result.error || 'Failed to save user')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save user')
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
              <Text style={styles.modalTitle}>{user ? 'Edit User' : 'Add New User'}</Text>
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
              {/* Name Fields */}
              <View style={styles.formRow}>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.fieldLabel}>First Name *</Text>
                  <TextInput
                    value={formData.first_name}
                    onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                    style={styles.input}
                    placeholder="John"
                    placeholderTextColor={colors.text.quaternary}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.fieldLabel}>Last Name *</Text>
                  <TextInput
                    value={formData.last_name}
                    onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                    style={styles.input}
                    placeholder="Doe"
                    placeholderTextColor={colors.text.quaternary}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Email *</Text>
                <TextInput
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  style={[styles.input, user && styles.inputDisabled]}
                  placeholder="john.doe@example.com"
                  placeholderTextColor={colors.text.quaternary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!user}
                />
                {user && (
                  <Text style={styles.fieldHint}>Email cannot be changed after creation</Text>
                )}
              </View>

              {/* Phone & Employee ID */}
              <View style={styles.formRow}>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput
                    value={formData.phone}
                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                    style={styles.input}
                    placeholder="(555) 123-4567"
                    placeholderTextColor={colors.text.quaternary}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.formFieldHalf}>
                  <Text style={styles.fieldLabel}>Employee ID</Text>
                  <TextInput
                    value={formData.employee_id}
                    onChangeText={(text) => setFormData({ ...formData, employee_id: text })}
                    style={styles.input}
                    placeholder="Optional"
                    placeholderTextColor={colors.text.quaternary}
                  />
                </View>
              </View>

              {/* Role Selection */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Role *</Text>
                <View style={[styles.roleGrid, isLandscape && styles.roleGridLandscape]}>
                  {roles.map((role) => (
                    <Pressable
                      key={role.value}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setFormData({ ...formData, role: role.value as any })
                      }}
                      style={[
                        styles.roleOption,
                        isLandscape && styles.roleOptionLandscape,
                        formData.role === role.value && styles.roleOptionSelected,
                      ]}
                    >
                      <Text style={styles.roleOptionLabel}>{role.label}</Text>
                      <Text style={styles.roleOptionDescription}>{role.description}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Info Box */}
              {!user && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxText}>
                    A password reset email will be sent to the user&apos;s email address
                  </Text>
                </View>
              )}

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
                disabled={loading || !formData.first_name || !formData.last_name || !formData.email}
                style={[styles.button, styles.buttonPrimary]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>
                    {user ? 'Save Changes' : 'Add User'}
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

// Set Password Modal
function SetPasswordModal({
  user,
  onClose,
  onSetPassword,
}: {
  user: UserWithLocations
  onClose: () => void
  onSetPassword: any
}) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculate responsive dimensions
  const modalStyle = useMemo(() => ({
    width: isLandscape ? '70%' : '90%',
    maxWidth: isLandscape ? 700 : 450,
    maxHeight: isLandscape ? height * 0.7 : height * 0.5,
  }), [isLandscape, height])

  async function handleSubmit() {
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const result = await onSetPassword(user.id, password)
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert('Success', 'Password updated successfully')
        onClose()
      } else {
        setError(result.error || 'Failed to set password')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set password')
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
              <View>
                <Text style={styles.modalTitle}>Set Password</Text>
                <Text style={styles.modalSubtitle}>
                  {user.first_name} {user.last_name}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            {/* Form */}
            <View style={styles.modalBody}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>New Password *</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={colors.text.quaternary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Confirm Password *</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.text.quaternary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>

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
                disabled={loading || !password || !confirmPassword}
                style={[styles.button, styles.buttonPrimary]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Set Password</Text>
                )}
              </Pressable>
            </View>
          </LiquidGlassView>
        </View>
      </BlurView>
    </Modal>
  )
}

// Assign Locations Modal
function AssignLocationsModal({
  user,
  locations,
  onClose,
  onAssignLocations,
}: {
  user: UserWithLocations
  locations: UserLocationAccess[]
  onClose: () => void
  onAssignLocations: any
}) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculate responsive dimensions
  const modalStyle = useMemo(() => ({
    width: isLandscape ? '75%' : '90%',
    maxWidth: isLandscape ? 800 : 500,
    maxHeight: isLandscape ? height * 0.8 : height * 0.7,
  }), [isLandscape, height])

  const scrollContentStyle = useMemo(() => ({
    maxHeight: isLandscape ? height * 0.5 : height * 0.45,
  }), [isLandscape, height])

  // Load current assignments
  useEffect(() => {
    setSelectedLocationIds(user.locations.map((loc) => loc.id))
  }, [user])

  function toggleLocation(locationId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedLocationIds((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId]
    )
  }

  async function handleSubmit() {
    setError('')
    setLoading(true)

    try {
      const result = await onAssignLocations(user.id, selectedLocationIds)
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // ✅ Store actions auto-reload, no need for manual reload
        onClose()
      } else {
        setError(result.error || 'Failed to assign locations')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to assign locations')
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
              <View>
                <Text style={styles.modalTitle}>Assign Locations</Text>
                <Text style={styles.modalSubtitle}>
                  {user.first_name} {user.last_name}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            {/* Location List */}
            <ScrollView
              style={[styles.modalScroll, scrollContentStyle]}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {locations.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No locations available</Text>
                </View>
              ) : (
                locations.map((loc) => (
                  <Pressable
                    key={loc.location.id}
                    onPress={() => toggleLocation(loc.location.id)}
                    style={[
                      styles.locationOption,
                      selectedLocationIds.includes(loc.location.id) && styles.locationOptionSelected,
                    ]}
                  >
                    <View style={styles.checkbox}>
                      {selectedLocationIds.includes(loc.location.id) && (
                        <View style={styles.checkboxChecked} />
                      )}
                    </View>
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationName}>{loc.location.name}</Text>
                      {loc.location.is_primary && (
                        <Text style={styles.locationBadge}>PRIMARY</Text>
                      )}
                    </View>
                  </Pressable>
                ))
              )}

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
                disabled={loading || locations.length === 0}
                style={[styles.button, styles.buttonPrimary]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Save Locations</Text>
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
    // Dimensions now set dynamically per modal via useMemo
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
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    marginTop: 2,
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
    // maxHeight now set dynamically per modal via useMemo
  },
  modalScrollContent: {
    padding: spacing.lg,
  },
  modalBody: {
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
  fieldHint: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
    marginTop: spacing.xxs,
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
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  // Role Selection
  roleGrid: {
    gap: spacing.xs,
  },
  roleGridLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  roleOption: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  roleOptionLandscape: {
    width: '48%', // Two columns in landscape
  },
  roleOptionSelected: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  roleOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  roleOptionDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },

  // Location Options
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: spacing.xs,
  },
  locationOptionSelected: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.text.primary,
  },
  locationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  locationBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.quaternary,
    letterSpacing: 0.5,
  },

  // Info & Error Boxes
  infoBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginTop: spacing.sm,
  },
  infoBoxText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#60a5fa',
    letterSpacing: -0.1,
  },
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

  // Empty State
  emptyState: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
  },
})
