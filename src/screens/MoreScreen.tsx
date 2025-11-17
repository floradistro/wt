import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { useAuth, useAuthActions } from '@/stores/auth.store'
import * as Haptics from 'expo-haptics'
import { allSections, systemItems, type NavItem, type NavSection } from '@/lib/navigation'
import { useRef, useEffect } from 'react'

const { width } = Dimensions.get('window')
const isTablet = width > 600

// iOS App Icon Component - Larger, more refined for iPad
function AppIcon({ item, onPress }: { item: NavItem; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.94,
        useNativeDriver: true,
        speed: 50,
        bounciness: 6,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 6,
      }),
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const accessibilityLabel = item.comingSoon
    ? `${item.label}, coming soon${item.badge ? `, ${item.badge} notifications` : ''}`
    : `${item.label}${item.badge ? `, ${item.badge} notifications` : ''}`

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.appIconWrapper}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={item.comingSoon ? "Feature not yet available" : `Double tap to open ${item.label}`}
      accessibilityState={{ disabled: item.comingSoon }}
    >
      <Animated.View
        style={[
          styles.appIcon,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Glow effect on press */}
        <Animated.View
          style={[
            styles.iconGlowOuter,
            {
              opacity: glowAnim,
            },
          ]}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />

        {/* Icon background - glassmorphic */}
        <View style={styles.iconBg} accessibilityElementsHidden={true} importantForAccessibility="no">
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </View>

        <Text style={styles.iconEmoji} accessibilityElementsHidden={true} importantForAccessibility="no">{item.icon}</Text>

        {item.badge && (
          <View style={styles.badge} accessibilityElementsHidden={true} importantForAccessibility="no">
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
      </Animated.View>

      <Text style={styles.appLabel} numberOfLines={1} accessible={false}>
        {item.label}
      </Text>

      {item.comingSoon && (
        <View style={styles.comingSoonBadge} accessibilityElementsHidden={true} importantForAccessibility="no">
          <Text style={styles.comingSoonText}>SOON</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// Floating Section Card - iPad style
function AppSection({ section, index }: { section: NavSection; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 10,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const handleAppPress = (item: NavItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (item.comingSoon) {
      Alert.alert('Coming Soon', `${item.label} will be available in a future update.`)
    } else {
      Alert.alert(item.label, `Opening ${item.label}...`)
      // TODO: Navigate to item.href
    }
  }

  return (
    <Animated.View
      style={[
        styles.sectionCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Glassmorphic background */}
      <View style={styles.cardBg}>
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionDivider} />
      </View>

      <View style={styles.appGrid}>
        {section.items.map((item) => (
          <AppIcon key={item.id} item={item} onPress={() => handleAppPress(item)} />
        ))}
      </View>
    </Animated.View>
  )
}

export function MoreScreen() {
  const { user } = useAuth()
  const { logout } = useAuthActions()
  const headerFade = useRef(new Animated.Value(0)).current
  const headerSlide = useRef(new Animated.Value(-20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(headerSlide, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout()
          } catch (_error) {
            // Error handled by auth store
          }
        },
      },
    ])
  }

  const handleSystemPress = (item: NavItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Alert.alert(item.label, `Opening ${item.label}...`)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Elegant Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerFade,
              transform: [{ translateY: headerSlide }],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>⚓</Text>
            </View>
          </View>
          <Text style={styles.title}>WHALETOOLS</Text>
          {user && <Text style={styles.subtitle}>{user.email}</Text>}
        </Animated.View>

        {/* All Sections - Floating Cards */}
        {allSections.map((section, index) => (
          <AppSection key={section.id} section={section} index={index} />
        ))}

        {/* System Section - Floating Card */}
        <Animated.View
          style={[
            styles.sectionCard,
            {
              opacity: headerFade,
            },
          ]}
        >
          <View style={styles.cardBg}>
            <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SYSTEM</Text>
            <View style={styles.sectionDivider} />
          </View>

          <View style={styles.appGrid}>
            {systemItems.map((item) => (
              <AppIcon key={item.id} item={item} onPress={() => handleSystemPress(item)} />
            ))}
          </View>
        </Animated.View>

        {/* Sign Out Button - Floating */}
        <TouchableOpacity
          style={styles.logoutCard}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          accessibilityHint="Double tap to sign out of your account"
        >
          <View style={styles.logoutBg} accessibilityElementsHidden={true} importantForAccessibility="no">
            <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
          </View>
          <Text style={styles.logoutIcon} accessibilityElementsHidden={true} importantForAccessibility="no">🚪</Text>
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>

        {/* Elegant Footer */}
        <View style={styles.footer}>
          <Text style={styles.version}>Whaletools v1.0.0</Text>
          <View style={styles.footerDivider} />
          <Text style={styles.versionSubtext}>Designed in California</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140, // Extra space for dock
    paddingHorizontal: isTablet ? 40 : 20,
  },

  // Header - Refined
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 6,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },

  // Section Card - Floating Glassmorphic
  sectionCard: {
    marginBottom: 24,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sectionHeader: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 3,
    marginBottom: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // App Icon - Premium
  appIconWrapper: {
    width: isTablet ? '20%' : '25%', // 5 per row on iPad, 4 on iPhone
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  appIcon: {
    width: isTablet ? 76 : 68,
    height: isTablet ? 76 : 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  iconBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconGlowOuter: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  iconEmoji: {
    fontSize: isTablet ? 36 : 32,
    zIndex: 1,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 2.5,
    borderColor: '#000',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  appLabel: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    letterSpacing: 0.3,
    maxWidth: isTablet ? 80 : 70,
  },
  comingSoonBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  comingSoonText: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
  },

  // Logout Card
  logoutCard: {
    marginTop: 8,
    marginBottom: 32,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.25)',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  logoutBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,0,0,0.06)',
  },
  logoutIcon: {
    fontSize: 20,
    zIndex: 1,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,60,60,0.95)',
    letterSpacing: 3,
    zIndex: 1,
  },

  // Footer - Minimal
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  version: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
    marginBottom: 12,
  },
  footerDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  versionSubtext: {
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 2,
    fontStyle: 'italic',
  },
})
