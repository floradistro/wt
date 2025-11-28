/**
 * LocationsDetail
 * Locations overview - Jobs Principle: Clear location management
 */

import { View, Text, StyleSheet, ScrollView, Pressable, Animated } from "react-native"
import { detailCommonStyles } from "./detailCommon.styles"
import { useState, useEffect } from "react"
// Removed LiquidGlassView - using plain View with borderless style
import * as Haptics from "expo-haptics"
import { colors, typography, spacing, radius } from "@/theme/tokens"
import { layout } from "@/theme/layout"
import { TitleSection } from "@/components/shared"
import type { Location } from "@/types/pos"
import { usePaymentProcessors, usePaymentProcessorsLoading, usePaymentProcessorsError } from "@/stores/payment-processors-settings.store"
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
  headerOpacity,
  vendorLogo,
  locations,
}: {
  headerOpacity: Animated.Value
  vendorLogo?: string | null
  locations: Location[]
}) {
  // ✅ Read from stores instead of props
  const paymentProcessors = usePaymentProcessors()
  const processorsLoading = usePaymentProcessorsLoading()
  const processorsError = usePaymentProcessorsError()

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)

  // Update selectedLocation if locations prop changes (e.g., after save)
  useEffect(() => {
    if (selectedLocation) {
      const updatedLocation = locations.find(loc => loc.id === selectedLocation.id)
      if (updatedLocation) {
        setSelectedLocation(updatedLocation)
      }
    }
  }, [locations])

  // If location selected, show detailed view
  if (selectedLocation) {
    return (
      <LocationConfigurationDetail
        location={selectedLocation}
        headerOpacity={headerOpacity}
        onBack={() => setSelectedLocation(null)}
      />
    )
  }

  const formatAddress = (location: Location) => {
    const parts = [
      location.address_line1,
      location.city,
      location.state,
    ].filter(Boolean)
    return parts.join(', ') || 'No address'
  }

  if (!locations || locations.length === 0) {
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
            title="Locations & Access"
            logo={vendorLogo}
          />

          <View
            style={[styles.emptyState, { paddingTop: spacing.xxxl }]}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel="No locations assigned. Contact your administrator to get access."
          >
            <View style={styles.emptyStateIcon}>
              <LocationIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText} accessible={false}>No locations assigned</Text>
            <Text style={styles.emptyStateSubtext} accessible={false}>Contact your administrator to get access</Text>
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
          title="Locations & Access"
          logo={vendorLogo}
          subtitle={`${locations.length} ${locations.length === 1 ? 'location' : 'locations'}`}
        />

        {/* Locations List - MATCHES ProductsListView Structure */}
        <View style={styles.cardWrapper}>
          <View style={styles.listCardGlass}>
            {locations.map((location, index) => {
              const isLast = index === locations.length - 1
              const locationAddress = formatAddress(location)

              return (
                <Pressable
                  key={location.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedLocation(location)
                  }}
                  style={[styles.listItem, isLast && styles.listItemLast]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${location.name}, ${locationAddress}`}
                >
                  {/* Location Icon */}
                  <View style={styles.locationIcon}>
                    <LocationIcon color={'rgba(235,235,245,0.6)'} />
                  </View>

                  {/* Location Info */}
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName} numberOfLines={1}>{location.name}</Text>
                    <Text style={styles.locationAddress} numberOfLines={1}>{locationAddress}</Text>
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

const styles = StyleSheet.create({
  ...detailCommonStyles,
  // Location Icon - Matches ProductItem icon
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Location Info - Matches ProductItem productInfo
  locationInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  locationAddress: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
})

export { LocationsDetail }
