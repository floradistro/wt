/**
 * POSLocationSelector - Refactored with Design System
 * Apple-quality location selection matching login design
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect } from 'react'
import { colors, typography, spacing, radius, blur, shadows, borderWidth, animation } from '@/theme/tokens'

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
}

function LocationCard({ location, index, onPress }: { location: Location; index: number; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * 80,
        ...animation.spring.gentle,
      }),
    ]).start()
  }, [])

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      ...animation.spring.snappy,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...animation.spring.snappy,
    }).start()
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={styles.locationCard}
    >
      <Animated.View
        style={[
          styles.locationCardInner,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Glass background - matches POS design */}
        <View style={styles.locationCardBg}>
          <BlurView intensity={blur.thin} tint="dark" style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.locationCardContent}>
          <View style={styles.locationHeader}>
            <Text style={styles.locationName}>{location.name}</Text>
            {location.is_primary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>PRIMARY</Text>
              </View>
            )}
          </View>

          {(location.address_line1 || location.city) && (
            <Text style={styles.locationAddress} numberOfLines={2}>
              {location.address_line1}
              {location.city && `, ${location.city}`}
              {location.state && `, ${location.state}`}
            </Text>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

function POSLocationSelector({ locations, vendorLogo, vendorName, onLocationSelected }: POSLocationSelectorProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      ...animation.timing.easeOut,
    }).start()
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header - matches login design */}
        <View style={styles.header}>
          {vendorLogo ? (
            <View style={styles.logoCircle}>
              <View style={styles.logoCircleBg}>
                <BlurView intensity={blur.thin} tint="dark" style={StyleSheet.absoluteFill} />
              </View>
              <Image source={{ uri: vendorLogo }} style={styles.logo} resizeMode="contain" />
            </View>
          ) : (
            <View style={styles.logoCircle}>
              <View style={styles.logoCircleBg}>
                <BlurView intensity={blur.thin} tint="dark" style={StyleSheet.absoluteFill} />
              </View>
              <Text style={styles.logoText}>
                {vendorName?.charAt(0).toUpperCase() || 'W'}
              </Text>
            </View>
          )}

          <Text style={styles.title}>{vendorName || 'WHALETOOLS'}</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>SELECT LOCATION</Text>
        </View>

        {/* Locations List */}
        <ScrollView
          style={styles.locationsList}
          contentContainerStyle={styles.locationsListContent}
          showsVerticalScrollIndicator={false}
        >
          {locations.map((location, index) => (
            <LocationCard
              key={location.id}
              location={location}
              index={index}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                onLocationSelected(location.id, location.name)
              }}
            />
          ))}

          {locations.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No locations available</Text>
              <Text style={styles.emptyStateSubtext}>
                Contact support to configure your locations
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const POSLocationSelectorMemo = memo(POSLocationSelector)
export { POSLocationSelectorMemo as POSLocationSelector }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  // Header - matches login design
  header: {
    alignItems: 'center',
    paddingTop: spacing.huge,
    paddingBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.round,
    overflow: 'hidden',
    borderWidth: borderWidth.regular,
    borderColor: colors.border.regular,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  logoCircleBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.glass.thin,
  },
  logo: {
    width: 50,
    height: 50,
  },
  logoText: {
    ...typography.display,
    color: colors.text.secondary,
  },
  title: {
    ...typography.title.large,
    fontWeight: '200',
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: colors.border.hairline,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.uppercase,
    color: colors.text.disabled,
    letterSpacing: 3,
  },
  // Locations list
  locationsList: {
    flex: 1,
  },
  locationsListContent: {
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  // Location card - matches POS card design
  locationCard: {
    marginBottom: 0,
  },
  locationCardInner: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: borderWidth.regular,
    borderColor: colors.border.regular,
    ...shadows.md,
  },
  locationCardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.glass.thin,
  },
  locationCardContent: {
    padding: spacing.lg,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  locationName: {
    ...typography.body.large,
    color: colors.text.primary,
    flex: 1,
  },
  primaryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.semantic.successBg,
    borderRadius: radius.xs,
    borderWidth: borderWidth.hairline,
    borderColor: colors.semantic.successBorder,
    marginLeft: spacing.sm,
  },
  primaryBadgeText: {
    ...typography.label.tiny,
    color: colors.semantic.success,
    letterSpacing: 1,
  },
  locationAddress: {
    ...typography.caption.regular,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  // Empty state
  emptyState: {
    paddingVertical: spacing.massive,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyStateText: {
    ...typography.body.regular,
    color: colors.text.subtle,
  },
  emptyStateSubtext: {
    ...typography.caption.regular,
    color: colors.text.ghost,
    textAlign: 'center',
  },
})
