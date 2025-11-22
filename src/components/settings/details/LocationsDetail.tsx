/**
 * LocationsDetail
 * Locations overview - Jobs Principle: Clear location management
 */

import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Image } from "react-native"
import { detailCommonStyles } from "./detailCommon.styles"
import { useState } from "react"
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from "@callstack/liquid-glass"
import { LinearGradient } from "expo-linear-gradient"
import * as Haptics from "expo-haptics"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import type { UserLocationAccess } from "@/hooks/useUserLocations"
import type { PaymentProcessor } from "@/hooks/usePaymentProcessors"
import { LocationConfigurationDetail } from "./LocationConfigurationDetail"

function LocationIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 12,
        height: 16,
        borderWidth: 1.5,
        borderColor: color,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 0,
        transform: [{ rotate: '45deg' }],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
      </View>
    </View>
  )
}

function LocationsDetail({
  userLocations,
  headerOpacity,
  paymentProcessors,
  processorsLoading,
  processorsError,
  createProcessor,
  updateProcessor,
  deleteProcessor,
  testConnection,
  setAsDefault,
  toggleProcessorStatus,
  reloadProcessors,
  vendorLogo,
}: {
  userLocations: UserLocationAccess[]
  headerOpacity: Animated.Value
  paymentProcessors: PaymentProcessor[]
  processorsLoading: boolean
  processorsError: string | null
  createProcessor: any
  updateProcessor: any
  deleteProcessor: any
  testConnection: any
  setAsDefault: any
  toggleProcessorStatus: any
  reloadProcessors: () => void
  vendorLogo?: string | null
}) {
  const [selectedLocation, setSelectedLocation] = useState<UserLocationAccess | null>(null)

  // If location selected, show detailed view
  if (selectedLocation) {
    const locationProcessors = paymentProcessors.filter(p => p.location_id === selectedLocation.location.id)

    return (
      <LocationConfigurationDetail
        location={selectedLocation}
        processors={locationProcessors}
        processorsLoading={processorsLoading}
        processorsError={processorsError}
        headerOpacity={headerOpacity}
        onBack={() => setSelectedLocation(null)}
        onCreateProcessor={createProcessor}
        onUpdateProcessor={updateProcessor}
        onDeleteProcessor={deleteProcessor}
        onTestConnection={testConnection}
        onSetAsDefault={setAsDefault}
        onToggleStatus={toggleProcessorStatus}
        onReload={reloadProcessors}
      />
    )
  }

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
              <Text style={styles.detailTitleLarge}>Locations & Access</Text>
            </View>
          </View>
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
                    setSelectedLocation(userLocation)
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

const styles = StyleSheet.create({
  ...detailCommonStyles,
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  vendorLogoInline: {
    width: 80,
    height: 80,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  detailTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    paddingTop: 16,
    paddingBottom: 8,
  },
  detailTitleLarge: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
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
  chevron: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.quaternary,
    marginTop: -2,
  },
})

export { LocationsDetail }
