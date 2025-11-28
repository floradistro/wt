/**
 * UserManagementDetail
 * User management and permissions - Jobs Principle: Clear user roles
 */

import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Animated } from "react-native"
import { useState } from "react"
// Removed LiquidGlassView - using plain View with borderless style
import * as Haptics from "expo-haptics"
import { colors, spacing } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import { TitleSection } from "@/components/shared"
import { useUsers, useUsersLoading, useUsersActions } from "@/stores/users-management.store"
import { UserDetail } from "./UserDetail"
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
  const { deleteUser, toggleUserStatus, loadUsers } = useUsersActions()

  // Navigation state
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // ✅ Use navigation instead of modals
  const handleAddUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsCreatingNew(true)
  }

  const handleEditUser = (user: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedUser(user)
  }

  const handleBack = () => {
    setSelectedUser(null)
    setIsCreatingNew(false)
  }

  const handleUserSaved = async () => {
    // Reload users list
    await loadUsers(users[0]?.vendor_id || '')
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

  // Show detail page if user selected or creating new
  if (selectedUser || isCreatingNew) {
    return (
      <UserDetail
        user={selectedUser}
        onBack={handleBack}
        onUserSaved={handleUserSaved}
      />
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
        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight, paddingRight: 0 }}
        >
          <TitleSection
            title="Team"
            logo={vendorLogo}
            buttonText="Add User"
            onButtonPress={handleAddUser}
          />

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <TeamIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No team members yet</Text>
            <Text style={styles.emptyStateSubtext}>Add users to manage your team</Text>
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.detailContainer}>
      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight, paddingRight: 0 }}
      >
        <TitleSection
          title="Team"
          logo={vendorLogo}
          subtitle={`${users.length} ${users.length === 1 ? 'team member' : 'team members'}`}
          buttonText="Add User"
          onButtonPress={handleAddUser}
        />

        {/* User List - MATCHES ProductsListView Structure */}
        <View style={styles.cardWrapper}>
          <View style={styles.listCardGlass}>
            {users.map((user, index) => {
              const isLast = index === users.length - 1
              const roleBadgeColor = getRoleBadgeColor(user.role)

              return (
                <Pressable
                  key={user.id}
                  style={[styles.listItem, isLast && styles.listItemLast]}
                  onPress={() => handleEditUser(user)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${user.first_name} ${user.last_name}, ${getRoleDisplay(user.role)}`}
                >
                  {/* Avatar Icon */}
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {user.first_name[0]}{user.last_name[0]}
                    </Text>
                  </View>

                  {/* User Info */}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.first_name} {user.last_name}
                    </Text>
                    <Text style={styles.userRole} numberOfLines={1}>
                      {getRoleDisplay(user.role)}
                    </Text>
                  </View>

                  {/* Right Side - Status */}
                  <View style={styles.userMeta}>
                    {user.status !== 'active' && (
                      <Text style={styles.inactiveLabel}>INACTIVE</Text>
                    )}
                    {user.location_count > 0 && (
                      <Text style={styles.locationCount}>
                        {user.location_count} {user.location_count === 1 ? 'loc' : 'locs'}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export { UserManagementDetail }
