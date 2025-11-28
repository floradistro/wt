/**
 * POSLocationSelector - Grid Layout
 * Beautiful centered grid with vendor logos
 */

import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, Dimensions, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect } from 'react'
import { getThumbnailImage } from '@/utils/image-transforms'

const { width } = Dimensions.get('window')
const isTablet = width > 600

interface Location {
  id: string
  name: string
  address_line1?: string
  city?: string
  state?: string
  is_primary: boolean
}

interface POSLocationSelectorProps {
  locations: Location[]
  vendorLogo?: string | null
  vendorName?: string
  onLocationSelected: (locationId: string, locationName: string) => void
  onCancel?: () => void
}

function LocationCard({
  location,
  index,
  vendorLogo,
  onPress,
}: {
  location: Location
  index: number
  vendorLogo?: string | null
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      delay: Math.min(index * 20, 100), // Max 100ms delay, faster animation
      useNativeDriver: true,
    }).start()
  }, [])

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  const addressText = [location.city, location.state].filter(Boolean).join(', ')

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.cardContainer}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${location.name}, ${addressText || 'Location'}`}
      accessibilityHint="Double tap to select this location"
    >
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.cardContent}>
          {/* Vendor Logo */}
          {vendorLogo ? (
            <View style={styles.logoContainer}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <Image
                source={{ uri: getThumbnailImage(vendorLogo) || vendorLogo }}
                style={styles.logo}
                resizeMode="contain"
                fadeDuration={0}
              />
            </View>
          ) : (
            <View style={[styles.logoContainer, styles.logoPlaceholder]}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={styles.logoPlaceholderText}>
                {location.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Location Name */}
          <Text style={styles.locationName} numberOfLines={2}>
            {location.name}
          </Text>

          {/* Address */}
          {addressText && (
            <Text style={styles.address} numberOfLines={1}>
              {addressText}
            </Text>
          )}

          {/* Primary Badge */}
          {location.is_primary && (
            <View style={styles.primaryBadge}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={styles.primaryBadgeText}>PRIMARY</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

function POSLocationSelector({ locations, vendorLogo, vendorName, onLocationSelected, onCancel }: POSLocationSelectorProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [])

  // Apple Standard: Show skeleton while loading, not empty state
  const showingSkeleton = locations.length === 0

  // Apple Standard: Subtle pulse animation for skeleton cards
  useEffect(() => {
    if (showingSkeleton) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start()
    }
  }, [showingSkeleton])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          {onCancel && (
            <Pressable onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          )}
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Select Location</Text>
            {vendorName && (
              <Text style={styles.headerSubtitle}>{vendorName}</Text>
            )}
          </View>
          {onCancel && <View style={styles.headerSpacer} />}
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {showingSkeleton ? (
            // Apple Standard: Show skeleton cards while loading (structure first, content later)
            [1, 2, 3, 4].map((_, index) => (
              <Animated.View
                key={`skeleton-${index}`}
                style={[styles.cardContainer, { opacity: pulseAnim }]}
              >
                <View style={[styles.card, styles.skeletonCard]}>
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                </View>
              </Animated.View>
            ))
          ) : (
            locations.map((location, index) => (
              <LocationCard
                key={location.id}
                location={location}
                index={index}
                vendorLogo={vendorLogo}
                onPress={() => onLocationSelected(location.id, location.name)}
              />
            ))
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

const POSLocationSelectorMemo = memo(POSLocationSelector)
export { POSLocationSelectorMemo as POSLocationSelector }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: isTablet ? 80 : 20,
    paddingVertical: isTablet ? 40 : 24,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isTablet ? 48 : 32,
    paddingTop: isTablet ? 20 : 10,
    paddingHorizontal: isTablet ? 20 : 10,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 70,
  },
  cancelButtonText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '400',
  },
  headerSpacer: {
    width: 70,
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: isTablet ? 34 : 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: isTablet ? 15 : 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: isTablet ? 24 : 20,
    maxWidth: isTablet ? 1000 : width - 40,
    alignSelf: 'center',
  },
  cardContainer: {
    width: isTablet ? 300 : (width - 60) / 2,
    height: isTablet ? 220 : 200,
  },
  card: {
    flex: 1,
    borderRadius: isTablet ? 32 : 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: isTablet ? 24 : 20,
  },
  // Logo
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: isTablet ? 20 : 18,
    marginBottom: isTablet ? 16 : 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
  },
  logoPlaceholder: {
    backgroundColor: 'transparent',
  },
  logoPlaceholderText: {
    fontSize: isTablet ? 32 : 28,
    fontWeight: '200',
    color: 'rgba(255,255,255,0.4)',
  },
  // Text
  locationName: {
    fontSize: isTablet ? 20 : 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  address: {
    fontSize: isTablet ? 13 : 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  // Apple Standard: Skeleton loading state (more visible, with pulse animation)
  skeletonCard: {
    opacity: 0.5, // Increased from 0.3 for better visibility
  },
  // Primary badge
  primaryBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(16,185,129,0.15)', // Match product list - borderless
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.6,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
})
