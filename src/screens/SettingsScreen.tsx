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
import { useLoyaltyCampaignsStore, startLoyaltyCampaignsRealtimeMonitoring, stopLoyaltyCampaignsRealtimeMonitoring } from '@/stores/loyalty-campaigns.store'
import { usePaymentProcessorsSettingsStore } from '@/stores/payment-processors-settings.store'
import { useUserLocations } from '@/hooks/useUserLocations'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// Import all detail components
import {
  AccountDetail,
  DeveloperToolsDetail,
  LocationsDetail,
  UserManagementDetail,
  SupplierManagementDetail,
  LoyaltyManagementDetail,
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

function LoyaltyIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.loyaltyIconStar, { borderColor: color }]}>
        <View style={[styles.loyaltyIconSparkle, { backgroundColor: color }]} />
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
  const { locations: userLocations } = useUserLocations()

  const [vendorLogo, setVendorLogo] = useState<string | null>(null)

  // ✅ Load all Settings data on mount (Apple pattern: data lives in stores)
  useEffect(() => {
    if (!user?.id) return

    // Load data from all Settings stores
    useUsersManagementStore.getState().loadUsers(user.id)
    useSuppliersManagementStore.getState().loadSuppliers(user.id)
    useLoyaltyCampaignsStore.getState().loadProgram(user.id)
    useLoyaltyCampaignsStore.getState().loadCampaigns(user.id)
    usePaymentProcessorsSettingsStore.getState().loadProcessors(user.id)

    // Start real-time monitoring for loyalty & campaigns
    startLoyaltyCampaignsRealtimeMonitoring(user.id)

    return () => {
      // Clean up subscriptions when component unmounts
      stopLoyaltyCampaignsRealtimeMonitoring()
    }
  }, [user?.id])

  // iOS-style collapsing headers - instant transitions
  const accountHeaderOpacity = useRef(new Animated.Value(0)).current
  const locationsHeaderOpacity = useRef(new Animated.Value(0)).current
  const teamHeaderOpacity = useRef(new Animated.Value(0)).current
  const suppliersHeaderOpacity = useRef(new Animated.Value(0)).current
  const loyaltyHeaderOpacity = useRef(new Animated.Value(0)).current
  const devToolsHeaderOpacity = useRef(new Animated.Value(0)).current

  // Load vendor info
  useEffect(() => {
    async function loadVendorInfo() {
      if (!user?.email) return
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('vendor_id, vendors(id, store_name, logo_url)')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (userError || !userData) {
          logger.error('[SettingsScreen] User query error', { error: userError })
          return
        }

        if (userData?.vendors) {
          const vendor = userData.vendors as { logo_url?: string | null }
          setVendorLogo(vendor.logo_url || null)
        }
      } catch (error) {
        logger.error('Failed to load vendor info', { error })
      }
    }
    loadVendorInfo()
  }, [user])

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
      renderDetail: () => <AccountDetail user={user!} headerOpacity={accountHeaderOpacity} vendorLogo={vendorLogo} /> 
    },
    {
      id: 'locations',
      title: 'Locations & Access',
      icon: LocationIcon,
      badge: userLocations.length > 0 ? userLocations.length : undefined,
      renderDetail: () => <LocationsDetail
        headerOpacity={locationsHeaderOpacity}
        vendorLogo={vendorLogo}
      />
    },
    {
      id: 'team',
      title: 'Team',
      icon: TeamIcon,
      renderDetail: () => <UserManagementDetail
        headerOpacity={teamHeaderOpacity}
        vendorLogo={vendorLogo}
      />
    },
    {
      id: 'suppliers',
      title: 'Suppliers',
      icon: SuppliersIcon,
      renderDetail: () => <SupplierManagementDetail
        headerOpacity={suppliersHeaderOpacity}
        vendorLogo={vendorLogo}
      />
    },
    {
      id: 'loyalty',
      title: 'Loyalty & Rewards',
      icon: LoyaltyIcon,
      renderDetail: () => <LoyaltyManagementDetail
        headerOpacity={loyaltyHeaderOpacity}
        vendorLogo={vendorLogo}
      />
    },
    {
      id: 'devtools',
      title: 'Developer Tools',
      icon: DevToolsIcon,
      renderDetail: () => <DeveloperToolsDetail headerOpacity={devToolsHeaderOpacity} vendorLogo={vendorLogo} />
    },
  ], [
    // ✅ Minimal dependencies - only visual props needed
    // All data comes from stores, so no need for data/callback dependencies
    user, userName, userLocations, vendorLogo,
    accountHeaderOpacity, locationsHeaderOpacity, teamHeaderOpacity,
    suppliersHeaderOpacity, loyaltyHeaderOpacity, devToolsHeaderOpacity,
  ])

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('account')
  const [searchQuery, setSearchQuery] = useState('')

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        <NavSidebar
          width={layout.sidebarWidth}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          items={navItems}
          activeItemId={selectedCategoryId}
          onItemPress={setSelectedCategoryId}
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
  loyaltyIconStar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  loyaltyIconSparkle: {
    width: 8,
    height: 8,
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -4,
    marginLeft: -4,
    transform: [{ rotate: '45deg' }],
  },
})

const SettingsScreenMemo = memo(SettingsScreen)
export { SettingsScreenMemo as SettingsScreen }
