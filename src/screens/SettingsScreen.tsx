/**
 * Settings Screen - iPad Split-View Style
 * Jobs Principle: "Simple is hiding complexity, not removing it"
 *
 * THIS FILE IS NOW A THIN ORCHESTRATOR (~250 lines)
 * Detail logic moved to src/components/settings/details/
 *
 * Left sidebar: Categories
 * Right panel: Selected category detail
 * Just like iOS Settings on iPad
 */

import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { memo, useState, useMemo, useRef, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useAuth, useAuthActions } from '@/stores/auth.store'
import { useUsersManagementStore } from '@/stores/users-management.store'
import { useSuppliersManagementStore } from '@/stores/suppliers-management.store'
// Loyalty moved to Marketing screen
import { usePaymentProcessorsSettingsStore } from '@/stores/payment-processors-settings.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useLocationFilter } from '@/stores/location-filter.store'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { LocationSelectorModal } from '@/components/shared'
import { logger } from '@/utils/logger'

// Import all detail components (Loyalty moved to Marketing)
import {
  AccountDetail,
  DeveloperToolsDetail,
  LocationsDetail,
  UserManagementDetail,
  SupplierManagementDetail,
  EmailSettingsDetail,
  ShippingSettingsDetail,
} from '@/components/settings/details'

// Monochrome Icons for Settings Categories
function UserIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.userIconCircle, { borderColor: color }]}>
        <View style={[styles.userIconHead, { backgroundColor: color }]} />
      </View>
      <View style={[styles.userIconBody, { borderColor: color }]} />
    </View>
  )
}

function LocationIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.locationIconPin, { borderColor: color }]}>
        <View style={[styles.locationIconDot, { backgroundColor: color }]} />
      </View>
    </View>
  )
}

function DevToolsIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.devToolsIcon, { borderColor: color }]}>
        <View style={[styles.devToolsChevron1, { borderColor: color }]} />
        <View style={[styles.devToolsChevron2, { borderColor: color }]} />
        <View style={[styles.devToolsUnderscore, { backgroundColor: color }]} />
      </View>
    </View>
  )
}

function TeamIcon({ color }: { color: string}) {
  return (
    <View style={styles.iconContainer}>
      <View style={styles.teamIconContainer}>
        <View style={[styles.teamIconUser, { borderColor: color }]}>
          <View style={[styles.teamIconHead, { backgroundColor: color }]} />
          <View style={[styles.teamIconBody, { borderColor: color }]} />
        </View>
        <View style={[styles.teamIconUser, { borderColor: color, marginLeft: -2 }]}>
          <View style={[styles.teamIconHead, { backgroundColor: color }]} />
          <View style={[styles.teamIconBody, { borderColor: color }]} />
        </View>
      </View>
    </View>
  )
}

function SuppliersIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.suppliersIconBuilding, { borderColor: color }]}>
        <View style={[styles.suppliersIconDoor, { borderColor: color }]} />
      </View>
    </View>
  )
}

// LoyaltyIcon moved to Marketing screen

function EmailIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.emailIconEnvelope, { borderColor: color }]}>
        <View style={[styles.emailIconFlap, { borderColor: color }]} />
      </View>
    </View>
  )
}

function ShippingIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.shippingIconTruck, { borderColor: color }]}>
        <View style={[styles.shippingIconCab, { borderColor: color }]} />
        <View style={[styles.shippingIconWheel1, { backgroundColor: color }]} />
        <View style={[styles.shippingIconWheel2, { backgroundColor: color }]} />
      </View>
    </View>
  )
}

interface SettingsCategory {
  id: string
  title: string
  icon: React.ComponentType<{ color: string }>
  badge?: number
  renderDetail: () => React.JSX.Element
}

/**
 * Main SettingsScreen Component
 * Apple Pattern: Thin orchestrator delegates to detail components
 */
function SettingsScreen() {
  const { user } = useAuth()
  const { logout } = useAuthActions()
  const { vendor, locations } = useAppAuth()
  const { selectedLocationIds } = useLocationFilter()

  const [showLocationSelector, setShowLocationSelector] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('account')
  const [searchQuery, setSearchQuery] = useState('')

  // ⚡ PERFORMANCE: Lazy load - only load data when tab is selected
  // This prevents loading ALL settings data on mount (6+ API calls)
  useEffect(() => {
    if (!user?.id) return

    // Only load data for the currently selected tab
    switch (selectedCategoryId) {
      case 'team':
        useUsersManagementStore.getState().loadUsers(user.id)
        break
      case 'suppliers':
        useSuppliersManagementStore.getState().loadSuppliers(user.id)
        break
      // Loyalty moved to Marketing screen
      case 'locations':
        if (vendor?.id) {
          usePaymentProcessorsSettingsStore.getState().loadProcessors(vendor.id)
        }
        break
      // account and devtools don't need to load data
    }

    return () => {
      // Clean up subscriptions when tab changes or component unmounts
      // Loyalty cleanup moved to Marketing screen
    }
  }, [user?.id, vendor?.id, selectedCategoryId])

  // iOS-style collapsing headers - instant transitions
  const accountHeaderOpacity = useRef(new Animated.Value(0)).current
  const locationsHeaderOpacity = useRef(new Animated.Value(0)).current
  const emailHeaderOpacity = useRef(new Animated.Value(0)).current
  const teamHeaderOpacity = useRef(new Animated.Value(0)).current
  const suppliersHeaderOpacity = useRef(new Animated.Value(0)).current
  // loyaltyHeaderOpacity moved to Marketing screen
  const shippingHeaderOpacity = useRef(new Animated.Value(0)).current
  const devToolsHeaderOpacity = useRef(new Animated.Value(0)).current

  const userName = useMemo(() => {
    if (!user) return 'Account'
    return user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account'
  }, [user])

  // Categories configuration
  const categories: SettingsCategory[] = useMemo(() => [
    {
      id: 'account',
      title: userName,
      icon: UserIcon,
      renderDetail: () => <AccountDetail user={user!} headerOpacity={accountHeaderOpacity} vendorLogo={vendor?.logo_url || null} />
    },
    {
      id: 'locations',
      title: 'Locations & Access',
      icon: LocationIcon,
      badge: locations.length > 0 ? locations.length : undefined,
      renderDetail: () => <LocationsDetail
        headerOpacity={locationsHeaderOpacity}
        vendorLogo={vendor?.logo_url || null}
        locations={locations}
      />
    },
    {
      id: 'email',
      title: 'Email & Notifications',
      icon: EmailIcon,
      renderDetail: () => (
        <EmailSettingsDetail
          headerOpacity={emailHeaderOpacity}
          vendorLogo={vendor?.logo_url || null}
        />
      )
    },
    {
      id: 'team',
      title: 'Team',
      icon: TeamIcon,
      renderDetail: () => <UserManagementDetail
        headerOpacity={teamHeaderOpacity}
        vendorLogo={vendor?.logo_url || null}
      />
    },
    {
      id: 'suppliers',
      title: 'Suppliers',
      icon: SuppliersIcon,
      renderDetail: () => <SupplierManagementDetail
        headerOpacity={suppliersHeaderOpacity}
        vendorLogo={vendor?.logo_url || null}
      />
    },
    // Loyalty & Rewards moved to Marketing screen
    {
      id: 'shipping',
      title: 'Shipping',
      icon: ShippingIcon,
      renderDetail: () => <ShippingSettingsDetail
        headerOpacity={shippingHeaderOpacity}
        vendorLogo={vendor?.logo_url || null}
      />
    },
    {
      id: 'devtools',
      title: 'Developer Tools',
      icon: DevToolsIcon,
      renderDetail: () => <DeveloperToolsDetail headerOpacity={devToolsHeaderOpacity} vendorLogo={vendor?.logo_url || null} />
    },
  ], [
    // ✅ Minimal dependencies - only visual props needed
    // All data comes from stores, so no need for data/callback dependencies
    user, userName, locations, vendor,
    accountHeaderOpacity, locationsHeaderOpacity, emailHeaderOpacity, teamHeaderOpacity,
    suppliersHeaderOpacity, shippingHeaderOpacity, devToolsHeaderOpacity,
  ])

  // Convert categories to NavItems
  const navItems: NavItem[] = useMemo(() =>
    categories.map(cat => ({
      id: cat.id,
      icon: cat.icon,
      label: cat.title,
      count: cat.badge,
    })),
    [categories]
  )

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId) || categories[0],
    [categories, selectedCategoryId]
  )

  const handleSignOut = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    await logout()
  }

  // Handle user profile press (opens location selector)
  const handleUserProfilePress = () => {
    setShowLocationSelector(true)
  }

  // Compute selected location names for display
  const selectedLocationNames = useMemo(() => {
    if (selectedLocationIds.length === 0) {
      return ['All locations']
    }
    return locations
      .filter(loc => selectedLocationIds.includes(loc.id))
      .map(loc => loc.name)
  }, [selectedLocationIds, locations])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        <NavSidebar
          width={layout.sidebarWidth}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search..."
          items={navItems}
          activeItemId={selectedCategoryId}
          onItemPress={setSelectedCategoryId}
          vendorLogo={vendor?.logo_url || null}
          vendorName={vendor?.store_name || 'Settings'}
          selectedLocationNames={selectedLocationNames}
          onUserProfilePress={handleUserProfilePress}
          footer={
            <View style={styles.footerWrapper}>
              <Pressable
                onPress={handleSignOut}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={styles.signOutButton}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
          }
        />

        <View style={styles.detailPanel}>
          {selectedCategory.renderDetail()}
        </View>
      </View>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationSelector}
        onClose={() => setShowLocationSelector(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  detailPanel: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  footerWrapper: {
    padding: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.regular, // ✅ Using token
  },
  signOutButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.semantic.errorBg, // ✅ Using token instead of hardcoded rgba
    borderRadius: radius.md,
    alignItems: 'center',
  },
  signOutText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.semantic.error, // ✅ Using token (close to #FF3B30)
  },
  
  // Icon Styles
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    marginBottom: -2,
    zIndex: 1,
  },
  userIconHead: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 2,
    left: '50%',
    marginLeft: -3,
  },
  userIconBody: {
    width: 18,
    height: 12,
    borderRadius: 9,
    borderWidth: 1.5,
    borderTopWidth: 0,
  },
  locationIconPin: {
    width: 16,
    height: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '0deg' }],
  },
  locationIconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 4,
    left: '50%',
    marginLeft: -3,
  },
  devToolsIcon: {
    width: 22,
    height: 18,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devToolsChevron1: {
    width: 6,
    height: 6,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '45deg' }],
    marginRight: 2,
  },
  devToolsChevron2: {
    width: 6,
    height: 6,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '-45deg' }],
    marginLeft: 2,
  },
  devToolsUnderscore: {
    width: 8,
    height: 1.5,
    marginTop: 2,
  },
  teamIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIconUser: {
    width: 12,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 6,
  },
  teamIconHead: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    top: 1,
    left: '50%',
    marginLeft: -2,
  },
  teamIconBody: {
    width: 10,
    height: 7,
    borderRadius: 5,
    borderWidth: 1.5,
    borderTopWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: -0.75,
  },
  suppliersIconBuilding: {
    width: 18,
    height: 20,
    borderRadius: radius.xs,
    borderWidth: 1.5,
  },
  suppliersIconDoor: {
    width: 6,
    height: 8,
    borderWidth: 1.5,
    borderTopWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -3,
  },
  // Loyalty icon styles moved to Marketing screen
  emailIconEnvelope: {
    width: 20,
    height: 14,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    position: 'relative',
  },
  emailIconFlap: {
    width: 12,
    height: 12,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 0,
    borderTopWidth: 0,
    position: 'absolute',
    top: -1,
    left: 3,
    transform: [{ rotate: '45deg' }, { scaleY: 0.7 }],
  },
  // Shipping icon styles
  shippingIconTruck: {
    width: 22,
    height: 14,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    position: 'relative',
  },
  shippingIconCab: {
    width: 8,
    height: 10,
    borderWidth: 1.5,
    borderLeftWidth: 0,
    borderTopRightRadius: radius.xs,
    borderBottomRightRadius: radius.xs,
    position: 'absolute',
    right: -8,
    bottom: 0,
  },
  shippingIconWheel1: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: -3,
    left: 3,
  },
  shippingIconWheel2: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: -3,
    right: -5,
  },
})

const SettingsScreenMemo = memo(SettingsScreen)
export { SettingsScreenMemo as SettingsScreen }
