/**
 * Settings Screen - iPad Split-View Style
 * Jobs Principle: "Simple is hiding complexity, not removing it"
 *
 * Left sidebar: Categories (container, not full height)
 * Right panel: Selected category details
 * Just like iOS Settings on iPad
 */

import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, Alert, Animated } from 'react-native'
import { memo, useState, useMemo, useRef } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useAuth, useAuthActions } from '@/stores/auth.store'
import { useUserLocations, type UserLocationAccess } from '@/hooks/useUserLocations'
import { runAllSentryTests, quickSentryTest } from '@/utils/test-sentry'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'

const { width } = Dimensions.get('window')
const isTablet = width > 600

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


interface SettingsCategory {
  id: string
  title: string
  icon: React.ComponentType<{ color: string }>
  badge?: number
    // @ts-expect-error - React types issue
  renderDetail: () => JSX.Element
}

// Category detail views
function AccountDetail({ user, headerOpacity }: { user: any; headerOpacity: Animated.Value }) {
  // Get user initials from email or metadata
  const userEmail = user?.email || 'user@example.com'
  const userName = user?.user_metadata?.full_name || userEmail.split('@')[0]
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <View style={styles.detailContainer}>
      {/* Fixed Header - appears on scroll */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>{userName}</Text>
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
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
        }}
        scrollEventThrottle={16}
      >
        {/* Header with avatar - INSIDE ScrollView */}
        <View style={styles.detailHeader} accessible={false}>
          <View
            style={styles.avatarLarge}
            accessible={true}
            accessibilityRole="image"
            accessibilityLabel={`Profile picture, ${initials}`}
          >
            <Text style={styles.avatarLargeText} accessible={false}>{initials}</Text>
          </View>
          <Text style={styles.detailName} accessibilityRole="header">{userName}</Text>
          <Text style={styles.detailEmail}>{userEmail}</Text>
        </View>

        {/* Cards */}
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <View style={styles.cardDivider} />

              <DetailRow label="Name" value={userName} />
              <DetailRow label="Email" value={userEmail} />
              {user?.user_metadata?.phone && (
                <DetailRow label="Phone" value={user.user_metadata.phone} />
              )}
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
      </ScrollView>
    </View>
  )
}

function DeveloperToolsDetail({ headerOpacity }: { headerOpacity: Animated.Value }) {
  const [isRunning, setIsRunning] = useState(false)

  const handleQuickTest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    quickSentryTest()
    Alert.alert(
      'Test Sent',
      'Quick test message sent to Sentry.\n\nCheck your dashboard at:\nhttps://sentry.io/',
      [{ text: 'OK' }]
    )
  }

  const handleFullTest = async () => {
    Alert.alert(
      'Run All Sentry Tests?',
      'This will send 7 test events to Sentry over ~7 seconds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Tests',
          onPress: async () => {
            setIsRunning(true)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            await runAllSentryTests()
            setIsRunning(false)
            Alert.alert(
              'All Tests Complete',
              'Check your Sentry dashboard to see:\n\n' +
              '• 7 new errors in Issues\n' +
              '• 4 performance transactions\n' +
              '• Breadcrumbs & context\n' +
              '• Tags for filtering\n\n' +
              'Dashboard: https://sentry.io/',
              [{ text: 'OK' }]
            )
          },
        },
      ]
    )
  }

  return (
    <View style={styles.detailContainer}>
      {/* Fixed Header - appears on scroll */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Developer Tools</Text>
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
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
        }}
        scrollEventThrottle={16}
      >
        {/* Large Title - INSIDE ScrollView */}
        <View style={styles.cardWrapper}>
          <Text style={styles.detailTitle} accessibilityRole="header">Developer Tools</Text>
        </View>
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Sentry Integration</Text>
              <Text style={styles.cardDescription}>
                Test error tracking and performance monitoring
              </Text>
              <View style={styles.cardDivider} />

              <Pressable
                onPress={handleQuickTest}
                disabled={isRunning}
                style={styles.testButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Quick test, send one test message to Sentry"
                accessibilityHint="Double tap to send a test message"
                accessibilityState={{ disabled: isRunning }}
              >
                <Text style={styles.testButtonText} accessible={false}>Quick Test</Text>
                <Text style={styles.testButtonSubtext} accessible={false}>Send one test message</Text>
              </Pressable>

              <Pressable
                onPress={handleFullTest}
                disabled={isRunning}
                style={[styles.testButton, styles.testButtonLast]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={isRunning ? "Running tests" : "Run all tests, complete integration test, approximately 7 seconds"}
                accessibilityHint="Double tap to run all Sentry tests"
                accessibilityState={{ disabled: isRunning, busy: isRunning }}
              >
                {isRunning ? (
                  <ActivityIndicator color="rgba(235,235,245,0.6)" accessibilityElementsHidden={true} importantForAccessibility="no" />
                ) : (
                  <>
                    <Text style={styles.testButtonText} accessible={false}>Run All Tests</Text>
                    <Text style={styles.testButtonSubtext} accessible={false}>Complete integration test (~7s)</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  After running tests, check your Sentry dashboard at:
                </Text>
                <Text style={styles.infoBoxLink}>https://sentry.io/</Text>
              </View>
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>

        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>What Gets Tested</Text>
              <View style={styles.cardDivider} />

              <DetailRow label="Error Capture" value="Basic error reporting" />
              <DetailRow label="Breadcrumbs" value="Event trail before errors" />
              <DetailRow label="Context Data" value="Rich metadata" />
              <DetailRow label="Performance" value="Transaction tracking" />
              <DetailRow label="Payment Errors" value="Payment timeout simulation" />
              <DetailRow label="Health Checks" value="Terminal offline simulation" />
              <DetailRow label="Checkout Errors" value="Transaction save failures" />
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
      </ScrollView>
    </View>
  )
}

function LocationsDetail({ userLocations, headerOpacity }: { userLocations: UserLocationAccess[]; headerOpacity: Animated.Value }) {
  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      owner: 'Owner • Full Access',
      manager: 'Manager • Full Access',
      staff: 'Staff • POS Access',
    }
    return roleMap[role] || 'Access'
  }

  const formatAddress = (location: UserLocationAccess['location']) => {
    const parts = [
      location.address_line1,
      location.city,
      location.state,
    ].filter(Boolean)
    return parts.join(', ') || 'No address'
  }

  if (userLocations.length === 0) {
    return (
      <View style={styles.detailContainer}>
        <Text style={styles.detailTitle} accessibilityRole="header">Locations & Access</Text>
        <View
          style={styles.emptyState}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel="No locations assigned. Contact your administrator to get access."
        >
          <Text style={styles.emptyStateText} accessible={false}>No locations assigned</Text>
          <Text style={styles.emptyStateSubtext} accessible={false}>Contact your administrator to get access</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.detailContainer}>
      {/* Fixed Header - appears on scroll */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Locations & Access</Text>
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
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
        }}
        scrollEventThrottle={16}
      >
        {/* Large Title - INSIDE ScrollView */}
        <View style={styles.cardWrapper}>
          <Text style={styles.detailTitle} accessibilityRole="header">Locations & Access</Text>
        </View>
        {userLocations.map((userLocation) => {
          const locationAddress = formatAddress(userLocation.location)
          const roleDisplay = getRoleDisplay(userLocation.role)
          const accessibilityLabel = `${userLocation.location.name}. ${locationAddress}. ${roleDisplay}`

          return (
            <LiquidGlassContainerView key={userLocation.location.id} spacing={12} style={styles.cardWrapper}>
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                interactive
                style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={styles.locationCard}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  accessibilityHint="Double tap to view location details"
                >
                  <View style={styles.locationIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                    <LocationIcon color={colors.text.primary} />
                  </View>
                  <View style={styles.locationInfo} accessible={false}>
                    <Text style={styles.locationName} accessible={false}>{userLocation.location.name}</Text>
                    <Text style={styles.locationAddress} accessible={false}>{locationAddress}</Text>
                    <Text style={styles.locationRole} accessible={false}>{roleDisplay}</Text>
                  </View>
                  <Text style={styles.chevron} accessibilityElementsHidden={true} importantForAccessibility="no">›</Text>
                </Pressable>
              </LiquidGlassView>
            </LiquidGlassContainerView>
          )
        })}
      </ScrollView>
    </View>
  )
}


// Helper component for detail rows
function DetailRow({
  label,
  value,
  subtitle,
  showChevron
}: {
  label: string
  value?: string
  subtitle?: string
  showChevron?: boolean
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowLeft}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        {subtitle && <Text style={styles.detailRowSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.detailRowRight}>
        {value && <Text style={styles.detailRowValue}>{value}</Text>}
        {showChevron && <Text style={styles.chevronSmall}>›</Text>}
      </View>
    </View>
  )
}

function SettingsScreen() {
  const { user } = useAuth()
  const { logout } = useAuthActions()
  const { locations: userLocations, isLoading: locationsLoading } = useUserLocations()

  // iOS-style collapsing headers - instant transitions
  const accountHeaderOpacity = useRef(new Animated.Value(0)).current
  const locationsHeaderOpacity = useRef(new Animated.Value(0)).current
  const devToolsHeaderOpacity = useRef(new Animated.Value(0)).current

  // Get user name for account category
  const userName = useMemo(() => {
    if (!user) return 'Account'
    return user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account'
  }, [user])

  // Categories configuration - only show what we have real data for
  const categories: SettingsCategory[] = useMemo(() => [
    { id: 'account', title: userName, icon: UserIcon, renderDetail: () => <AccountDetail user={user} headerOpacity={accountHeaderOpacity} /> },
    {
      id: 'locations',
      title: 'Locations & Access',
      icon: LocationIcon,
      badge: userLocations.length > 0 ? userLocations.length : undefined,
      renderDetail: () => <LocationsDetail userLocations={userLocations} headerOpacity={locationsHeaderOpacity} />
    },
    {
      id: 'devtools',
      title: 'Developer Tools',
      icon: DevToolsIcon,
      renderDetail: () => <DeveloperToolsDetail headerOpacity={devToolsHeaderOpacity} />
    },
  ], [user, userName, userLocations, accountHeaderOpacity, locationsHeaderOpacity, devToolsHeaderOpacity])

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('account')
  const [searchQuery, setSearchQuery] = useState('')

  // Convert categories to NavItems for NavSidebar
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
        {/* LEFT NAV SIDEBAR */}
        <NavSidebar
          width={375}
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
                accessibilityHint="Double tap to sign out of your account"
                style={styles.signOutButton}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
          }
        />

        {/* Right Detail Panel */}
        <View style={styles.detailPanel}>
          {selectedCategory.renderDetail()}
        </View>
      </View>
    </SafeAreaView>
  )
}

const SettingsScreenMemo = memo(SettingsScreen)
export { SettingsScreenMemo as SettingsScreen }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  // Footer
  footerWrapper: {
    paddingHorizontal: layout.cardPadding,
  },
  signOutButton: {
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#ff3b30',
    letterSpacing: -0.4,
    textAlign: 'center',
  },

  // Icon Styles
  iconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User Icon
  userIconCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconHead: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  userIconBody: {
    width: 12,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    marginTop: -2,
  },

  // Location Icon
  locationIconPin: {
    width: 12,
    height: 16,
    borderWidth: 1.5,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 0,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyStateText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.4,
    marginBottom: spacing.xxs,
  },
  emptyStateSubtext: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Right Detail Panel
  detailPanel: {
    flex: 1,
    backgroundColor: colors.background.primary,
    // No padding - children handle their own padding for scroll indicator positioning
  },
  detailContainer: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    paddingTop: 16,
    paddingBottom: 8,
  },
  detailScroll: {
    flex: 1,
  },

  // iOS Collapsing Headers - matches ProductsScreen exactly
  fixedHeader: {
    position: 'absolute',
    top: layout.cardPadding,
    left: 0,
    right: 0,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },

  // Detail Header (for Account)
  detailHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: spacing.lg,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.glass.ultraThick,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: spacing.sm,
  },
  avatarLargeText: {
    fontSize: 38,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 1,
  },
  detailName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: 0.4,
    marginBottom: spacing.xxs,
  },
  detailEmail: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
    marginBottom: spacing.xxs,
  },
  detailRole: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },

  // Detail Cards
  cardWrapper: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginVertical: layout.contentVertical,
  },
  detailCard: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardInner: {
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.quaternary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: spacing.xs,
  },

  // Detail Rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailRowLeft: {
    flex: 1,
    gap: 2,
  },
  detailRowLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  detailRowSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  detailRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailRowValue: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.4,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.quaternary,
    marginTop: -2,
  },
  chevronSmall: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.quaternary,
    marginTop: -1,
  },

  // Location Cards
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  locationIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  locationName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  locationRole: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },

  // DevTools Icon
  devToolsIcon: {
    width: 16,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devToolsChevron1: {
    width: 5,
    height: 5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '-45deg' }],
    position: 'absolute',
    left: 2,
    top: 4,
  },
  devToolsChevron2: {
    width: 5,
    height: 5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '-45deg' }],
    position: 'absolute',
    left: 6,
    top: 4,
  },
  devToolsUnderscore: {
    width: 10,
    height: 1.5,
    position: 'absolute',
    bottom: 2,
    left: 3,
  },

  // Test Buttons
  cardDescription: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
    marginBottom: spacing.sm,
  },
  testButton: {
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.md,
    marginTop: spacing.sm,
    minHeight: 60,
    justifyContent: 'center',
  },
  testButtonLast: {
    marginBottom: 0,
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.9)',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  testButtonSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
  },
  infoBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glass.ultraThin,
  },
  infoBoxText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  infoBoxLink: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
    letterSpacing: -0.1,
  },
})
