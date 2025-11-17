/**
 * Settings Screen - iPad Split-View Style
 * Jobs Principle: "Simple is hiding complexity, not removing it"
 *
 * Left sidebar: Categories (container, not full height)
 * Right panel: Selected category details
 * Just like iOS Settings on iPad
 */

import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, Alert } from 'react-native'
import { memo, useState, useMemo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useAuth, useAuthActions } from '@/stores/auth.store'
import { useUserLocations, type UserLocationAccess } from '@/hooks/useUserLocations'
import { runAllSentryTests, quickSentryTest } from '@/utils/test-sentry'

const { width } = Dimensions.get('window')
const isTablet = width > 600

// Monochrome Icons (like Dock)
function SearchIcon({ color }: { color: string }) {
  return (
    <View style={styles.searchIconContainer}>
      <View style={[styles.searchIconCircle, { borderColor: color }]} />
      <View style={[styles.searchIconHandle, { backgroundColor: color }]} />
    </View>
  )
}

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
function AccountDetail({ user }: { user: any }) {
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
      {/* Header with avatar */}
      <View style={styles.detailHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{initials}</Text>
        </View>
        <Text style={styles.detailName}>{userName}</Text>
        <Text style={styles.detailEmail}>{userEmail}</Text>
      </View>

      {/* Cards */}
      <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: layout.dockHeight }}>
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

function DeveloperToolsDetail() {
  const [isRunning, setIsRunning] = useState(false)

  const handleQuickTest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    quickSentryTest()
    Alert.alert(
      'Test Sent ✅',
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
              'All Tests Complete! ✅',
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
      <Text style={styles.detailTitle}>Developer Tools</Text>

      <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: layout.dockHeight }}>
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>🔍 Sentry Integration</Text>
              <Text style={styles.cardDescription}>
                Test Sentry error tracking and performance monitoring
              </Text>
              <View style={styles.cardDivider} />

              <Pressable
                onPress={handleQuickTest}
                disabled={isRunning}
                style={styles.testButton}
              >
                <Text style={styles.testButtonText}>⚡️ Quick Test</Text>
                <Text style={styles.testButtonSubtext}>Send one test message</Text>
              </Pressable>

              <Pressable
                onPress={handleFullTest}
                disabled={isRunning}
                style={[styles.testButton, styles.testButtonPrimary]}
              >
                {isRunning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.testButtonTextPrimary}>🚀 Run All Tests</Text>
                    <Text style={styles.testButtonSubtextPrimary}>Complete integration test (~7s)</Text>
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
              <Text style={styles.cardTitle}>📊 What Gets Tested</Text>
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

function LocationsDetail({ userLocations }: { userLocations: UserLocationAccess[] }) {
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
        <Text style={styles.detailTitle}>Locations & Access</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No locations assigned</Text>
          <Text style={styles.emptyStateSubtext}>Contact your administrator to get access</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.detailContainer}>
      <Text style={styles.detailTitle}>Locations & Access</Text>

      <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: layout.dockHeight }}>
        {userLocations.map((userLocation) => (
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
              >
                <View style={styles.locationIconContainer}>
                  <LocationIcon color={colors.text.primary} />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationName}>{userLocation.location.name}</Text>
                  <Text style={styles.locationAddress}>{formatAddress(userLocation.location)}</Text>
                  <Text style={styles.locationRole}>{getRoleDisplay(userLocation.role)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </LiquidGlassView>
          </LiquidGlassContainerView>
        ))}
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

  // Get user name for account category
  const userName = useMemo(() => {
    if (!user) return 'Account'
    return user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account'
  }, [user])

  // Categories configuration - only show what we have real data for
  const categories: SettingsCategory[] = useMemo(() => [
    { id: 'account', title: userName, icon: UserIcon, renderDetail: () => <AccountDetail user={user} /> },
    {
      id: 'locations',
      title: 'Locations & Access',
      icon: LocationIcon,
      badge: userLocations.length > 0 ? userLocations.length : undefined,
      renderDetail: () => <LocationsDetail userLocations={userLocations} />
    },
    {
      id: 'devtools',
      title: 'Developer Tools',
      icon: DevToolsIcon,
      renderDetail: () => <DeveloperToolsDetail />
    },
  ], [user, userName, userLocations])

  const [selectedCategory, setSelectedCategory] = useState(categories[0])

  const handleSignOut = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    await logout()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.splitView}>
        {/* Left Sidebar - iOS Settings full height */}
        <View style={styles.sidebar}>
          {/* iOS-style container background */}
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.sidebarContainer, !isLiquidGlassSupported && styles.sidebarContainerFallback]}
          >
            {/* Scrollable Content */}
            <ScrollView
              style={styles.sidebarScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sidebarScrollContent}
            >
              {/* Spacer for fixed search bar */}
              <View style={styles.searchSpacer} />

            {/* User Profile Card - Pill */}
            <View style={styles.pillWrapper}>
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                interactive
                style={[styles.pill, !isLiquidGlassSupported && styles.pillFallback]}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedCategory(categories[0])
                  }}
                  style={styles.profilePill}
                >
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>
                      {userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{userName}</Text>
                    <Text style={styles.profileSubtitle}>Apple Account, iCloud+, and more</Text>
                  </View>
                </Pressable>
              </LiquidGlassView>
            </View>

            {/* Category Items - Floating with pill on selection */}
            {categories.slice(1).map((category) => {
              const isSelected = selectedCategory.id === category.id
              const IconComponent = category.icon
              const iconColor = colors.text.primary

              return (
                <View key={category.id} style={styles.categoryItemWrapper}>
                  {isSelected ? (
                    <LiquidGlassView
                      effect="regular"
                      colorScheme="dark"
                      style={[styles.categoryItemPill, !isLiquidGlassSupported && styles.pillFallback]}
                    >
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setSelectedCategory(category)
                        }}
                        style={styles.categoryItemContent}
                      >
                        <IconComponent color={iconColor} />
                        <Text style={styles.categoryItemText}>
                          {category.title}
                        </Text>
                        {category.badge && (
                          <View style={styles.pillBadge}>
                            <Text style={styles.pillBadgeText}>{category.badge}</Text>
                          </View>
                        )}
                        <Text style={styles.pillChevron}>›</Text>
                      </Pressable>
                    </LiquidGlassView>
                  ) : (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setSelectedCategory(category)
                      }}
                      style={styles.categoryItemContent}
                    >
                      <IconComponent color={iconColor} />
                      <Text style={styles.categoryItemText}>
                        {category.title}
                      </Text>
                      {category.badge && (
                        <View style={styles.pillBadge}>
                          <Text style={styles.pillBadgeText}>{category.badge}</Text>
                        </View>
                      )}
                      <Text style={styles.pillChevron}>›</Text>
                    </Pressable>
                  )}
                </View>
              )
            })}

            {/* Sign Out - Pill */}
            <View style={styles.pillWrapper}>
              <Pressable onPress={handleSignOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
            </ScrollView>

            {/* Search Bar - Floating overlay on top */}
            <View style={styles.searchContainer}>
            <LiquidGlassContainerView spacing={8}>
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                style={[styles.searchBarContainer, !isLiquidGlassSupported && styles.searchBarContainerFallback]}
              >
                <View
                  style={styles.searchInner}
                  accessible={true}
                  accessibilityRole="search"
                  accessibilityLabel="Search settings"
                  accessibilityHint="Search functionality coming soon"
                >
                  <SearchIcon color={colors.text.quaternary} />
                  <Text style={styles.searchPlaceholder} accessible={false}>Search</Text>
                </View>
              </LiquidGlassView>
            </LiquidGlassContainerView>
            </View>
          </LiquidGlassView>
        </View>

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

const SIDEBAR_WIDTH = 375

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  splitView: {
    flex: 1,
    flexDirection: 'row',
  },

  // Left Sidebar - iOS Settings full height
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.background.primary,
  },
  sidebarContainer: {
    flex: 1,
    margin: spacing.md,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  sidebarContainerFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarScrollContent: {
    paddingBottom: layout.dockHeight,
  },
  searchSpacer: {
    height: 72, // Height of fixed search bar
  },

  // Search Bar - Floating overlay on top
  searchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 10,
  },
  searchBarContainer: {
    borderRadius: 100, // Match pill shape
    borderCurve: 'continuous',
    overflow: 'hidden',
    minHeight: 44,
  },
  searchBarContainerFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.4,
  },

  // Search Icon
  searchIconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconCircle: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
  },
  searchIconHandle: {
    width: 5,
    height: 1.5,
    position: 'absolute',
    bottom: 0.5,
    right: 0.5,
    transform: [{ rotate: '45deg' }],
  },

  // Pill Wrapper
  pillWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  // Pill Container - True pill shape
  pill: {
    borderRadius: 100,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  pillFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Profile Pill
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 10,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass.ultraThick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  profileSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },

  // Category Items - Floating
  categoryItemWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoryItemPill: {
    borderRadius: 100,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  categoryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
    minHeight: 44,
  },
  categoryItemText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  pillBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.glass.ultraThick,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pillBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pillChevron: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.text.quaternary,
  },

  // Sign Out
  signOutText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#ff3b30',
    letterSpacing: -0.4,
    textAlign: 'center',
    paddingVertical: 12,
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
    paddingHorizontal: spacing.sm, // Consistent 12px spacing everywhere
  },
  detailContainer: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  detailTitle: {
    ...typography.title.large,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: spacing.lg,
  },
  detailScroll: {
    flex: 1,
  },

  // Detail Header (for Account)
  detailHeader: {
    alignItems: 'center',
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
    marginBottom: spacing.sm,
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
    borderWidth: 1,
    borderColor: colors.border.regular,
    backgroundColor: colors.glass.ultraThin,
    padding: spacing.md,
    marginTop: spacing.sm,
    minHeight: 60,
    justifyContent: 'center',
  },
  testButtonPrimary: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  testButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  testButtonTextPrimary: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  testButtonSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  testButtonSubtextPrimary: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
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
