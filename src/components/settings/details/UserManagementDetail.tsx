/**
 * UserManagementDetail
 * User management and permissions - Jobs Principle: Clear user roles
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Animated, Image } from "react-native"
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from "@callstack/liquid-glass"
import { LinearGradient } from "expo-linear-gradient"
import * as Haptics from "expo-haptics"
import { colors, spacing } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import { useUsers, useUsersLoading, useUsersActions } from "@/stores/users-management.store"
import { useSettingsUIActions } from "@/stores/settings-ui.store"
import { useUserLocations } from "@/hooks/useUserLocations"
import { UserManagementModals } from "../UserManagementModals"
import { TeamIcon } from "./icons"
import { getRoleDisplay, getRoleBadgeColor } from "./userManagement.utils"
import { styles } from "./userManagement.styles"

function UserManagementDetail({
  headerOpacity,
  vendorLogo,
}: {
  headerOpacity: Animated.Value
  vendorLogo?: string | null
}) {
  // ✅ Read from stores instead of props
  const users = useUsers()
  const isLoading = useUsersLoading()
  const { locations } = useUserLocations()
  const { deleteUser, toggleUserStatus } = useUsersActions()
  const { openModal } = useSettingsUIActions()

  // ✅ Use store actions instead of local state/callbacks
  const handleAddUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    openModal('addUser')
  }

  const handleEditUser = (user: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    openModal('editUser', user)
  }

  const handleSetPassword = (user: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    openModal('setPassword', user)
  }

  const handleAssignLocations = (user: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    openModal('assignLocations', user)
  }

  const handleToggleStatus = async (user: any) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    const statusText = newStatus === 'active' ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} User`,
      `Are you sure you want to ${statusText} ${user.first_name} ${user.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await toggleUserStatus(user.id, newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update user status')
            }
          },
        },
      ]
    )
  }

  const handleDeleteUser = (user: any) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.first_name} ${user.last_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            const result = await deleteUser(user.id)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete user')
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={styles.detailContainer}>
        <View style={[styles.emptyState, { paddingTop: layout.contentStartTop }]}>
          <ActivityIndicator color={colors.text.tertiary} />
          <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading team...</Text>
        </View>
      </View>
    )
  }

  if (users.length === 0) {
    return (
      <View style={styles.detailContainer}>
        {/* Fixed Header */}
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Team</Text>
        </Animated.View>

        {/* Fade Gradient */}
        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: layout.contentStartTop, paddingBottom: layout.dockHeight, paddingRight: 0 }}
        >
          <View style={styles.cardWrapper}>
            <Text style={styles.detailTitle}>Team</Text>
          </View>

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <TeamIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No team members yet</Text>
            <Text style={styles.emptyStateSubtext}>Add users to manage your team</Text>
            <Pressable
              onPress={handleAddUser}
              style={styles.addButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add first team member"
            >
              <Text style={styles.addButtonText}>Add User</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* ✅ Zero props - modal reads from stores */}
        <UserManagementModals />
      </View>
    )
  }

  return (
    <View style={styles.detailContainer}>
      {/* Fixed Header */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Team</Text>
        <Pressable
          onPress={handleAddUser}
          style={styles.fixedHeaderButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new team member"
        >
          <Text style={styles.fixedHeaderButtonText}>+</Text>
        </Pressable>
      </Animated.View>

      {/* Fade Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: layout.contentStartTop, paddingBottom: layout.dockHeight, paddingRight: 0 }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
        }}
        scrollEventThrottle={16}
      >
        {/* Title Section with Vendor Logo */}
        <View style={styles.cardWrapper}>
          <View style={styles.titleSectionContainer}>
            <View style={styles.titleWithLogo}>
              {vendorLogo ? (
                <Image
                  source={{ uri: vendorLogo }}
                  style={styles.vendorLogoInline}
                  resizeMode="contain"
                        fadeDuration={0}
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailTitleLarge}>Team</Text>
                <Pressable
                  onPress={handleAddUser}
                  style={styles.addButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Add new team member"
                >
                  <Text style={styles.addButtonText}>Add User</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* User Cards */}
        {users.map((user) => {
          const roleBadgeColor = getRoleBadgeColor(user.role)

          return (
            <LiquidGlassContainerView key={user.id} spacing={12} style={styles.cardWrapper}>
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                interactive
                style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
              >
                <View style={styles.userCard}>
                  {/* User Info */}
                  <View style={styles.userCardHeader}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {user.first_name[0]}{user.last_name[0]}
                      </Text>
                    </View>
                    <View style={styles.userCardInfo}>
                      <View style={styles.userCardTitleRow}>
                        <Text style={styles.userCardName}>
                          {user.first_name} {user.last_name}
                        </Text>
                        {user.status !== 'active' && (
                          <View style={styles.inactiveBadge}>
                            <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.userCardEmail}>{user.email}</Text>
                      {user.phone && (
                        <Text style={styles.userCardPhone}>{user.phone}</Text>
                      )}
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + '20', borderColor: roleBadgeColor + '40' }]}>
                      <Text style={[styles.roleBadgeText, { color: roleBadgeColor }]}>
                        {getRoleDisplay(user.role)}
                      </Text>
                    </View>
                  </View>

                  {/* Location Count */}
                  {user.location_count > 0 && (
                    <View style={styles.userCardMeta}>
                      <Text style={styles.userCardMetaText}>
                        {user.location_count} {user.location_count === 1 ? 'location' : 'locations'}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.userCardActions}>
                    <Pressable
                      onPress={() => handleEditUser(user)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleSetPassword(user)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Set password for ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonText}>Password</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleAssignLocations(user)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Assign locations to ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonText}>Locations</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleToggleStatus(user)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={user.status === 'active' ? `Deactivate ${user.first_name} ${user.last_name}` : `Activate ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonText}>
                        {user.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteUser(user)}
                      style={[styles.userActionButton, styles.userActionButtonDanger]}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonDangerText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </LiquidGlassView>
            </LiquidGlassContainerView>
          )
        })}
      </ScrollView>

      {/* ✅ Zero props - modal reads from stores */}
      <UserManagementModals />
    </View>
  )
}

export { UserManagementDetail }
