/**
 * UserDetail Component
 * iOS Settings style detail view for user editing and viewing
 */

import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { layout } from '@/theme/layout'
import { spacing, radius, colors } from '@/theme/tokens'
import { Breadcrumb } from '@/components/shared'
import { useUsersActions } from '@/stores/users-management.store'

interface UserDetailProps {
  user?: any // undefined means creating new user
  onBack: () => void
  onUserSaved: () => void
}

interface SettingsRowProps {
  label: string
  value?: string
  placeholder?: string
  editable?: boolean
  onChangeText?: (text: string) => void
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  secureTextEntry?: boolean
}

function SettingsRow({ label, value, placeholder, editable, onChangeText, keyboardType = 'default', secureTextEntry }: SettingsRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {editable ? (
        <TextInput
          style={styles.rowInput}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="rgba(235,235,245,0.3)"
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
          secureTextEntry={secureTextEntry}
        />
      ) : (
        <Text style={styles.rowValue}>{value || '-'}</Text>
      )}
    </View>
  )
}

export function UserDetail({ user, onBack, onUserSaved }: UserDetailProps) {
  const isNewUser = !user
  const { createUser, updateUser } = useUsersActions()

  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'employee',
    password: '',
  })

  const handleSave = async () => {
    // Validation
    if (!formData.first_name.trim()) {
      Alert.alert('Error', 'First name is required')
      return
    }
    if (!formData.last_name.trim()) {
      Alert.alert('Error', 'Last name is required')
      return
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Email is required')
      return
    }

    setIsSaving(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      if (isNewUser) {
        // Creating new user
        if (!formData.password.trim()) {
          Alert.alert('Error', 'Password is required for new users')
          setIsSaving(false)
          return
        }
        const result = await createUser({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || undefined,
          role: formData.role as any,
          password: formData.password,
        })
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onUserSaved()
          onBack()
        } else {
          Alert.alert('Error', result.error || 'Failed to create user')
        }
      } else {
        // Updating existing user
        const result = await updateUser(user.id, {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || undefined,
          role: formData.role as any,
        })
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onUserSaved()
          onBack()
        } else {
          Alert.alert('Error', result.error || 'Failed to update user')
        }
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save user')
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
            { label: 'Team', onPress: onBack },
            { label: isNewUser ? 'New User' : `${formData.first_name} ${formData.last_name}` },
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

      {/* User Avatar Card */}
      <View style={styles.section}>
        <View style={styles.headerCardGlass}>
          <View style={styles.headerCard}>
            <View style={[styles.headerIcon, styles.headerIconPlaceholder]}>
              <Text style={styles.headerIconText}>
                {(formData.first_name[0] || '?').toUpperCase()}
                {(formData.last_name[0] || '').toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>
                {formData.first_name} {formData.last_name}
              </Text>
              <Text style={styles.headerSubtitle}>
                {formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Personal Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
        <View style={styles.cardGlass}>
          <SettingsRow
            label="First Name"
            value={formData.first_name}
            placeholder="First name"
            editable={true}
            onChangeText={(text) => setFormData({ ...formData, first_name: text })}
          />
          <SettingsRow
            label="Last Name"
            value={formData.last_name}
            placeholder="Last name"
            editable={true}
            onChangeText={(text) => setFormData({ ...formData, last_name: text })}
          />
          <View style={styles.rowLast}>
            <SettingsRow
              label="Email"
              value={formData.email}
              placeholder="email@example.com"
              editable={true}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
            />
          </View>
        </View>
      </View>

      {/* Contact Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONTACT</Text>
        <View style={styles.cardGlass}>
          <View style={styles.rowLast}>
            <SettingsRow
              label="Phone"
              value={formData.phone}
              placeholder="(555) 123-4567"
              editable={true}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </View>

      {/* Role Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ROLE & PERMISSIONS</Text>
        <View style={styles.cardGlass}>
          <Pressable
            style={styles.row}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              Alert.alert(
                'Select Role',
                '',
                [
                  { text: 'Employee', onPress: () => setFormData({ ...formData, role: 'employee' }) },
                  { text: 'Manager', onPress: () => setFormData({ ...formData, role: 'manager' }) },
                  { text: 'Admin', onPress: () => setFormData({ ...formData, role: 'admin' }) },
                  { text: 'Cancel', style: 'cancel' },
                ]
              )
            }}
          >
            <Text style={styles.rowLabel}>Role</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>
                {formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}
              </Text>
              <Text style={styles.rowChevron}>􀆊</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Password Section (only for new users) */}
      {isNewUser && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY</Text>
          <View style={styles.cardGlass}>
            <View style={styles.rowLast}>
              <SettingsRow
                label="Password"
                value={formData.password}
                placeholder="Enter password"
                editable={true}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry={true}
              />
            </View>
          </View>
        </View>
      )}
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
  headerIconText: {
    fontSize: 32,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.5,
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
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  rowChevron: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.3)',
  },
})
