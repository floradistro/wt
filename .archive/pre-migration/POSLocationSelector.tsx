import {  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Image } from 'react-native'
import {  SafeAreaView } from 'react-native-safe-area-context'
import {  BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { memo,  useRef, useEffect } from 'react'

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
        tension: 50,
        friction: 10,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start()
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
        <View style={styles.locationCardBg}>
          <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
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
              {[location.address_line1, location.city, location.state].filter(Boolean).join(', ')}
            </Text>
          )}

          <View style={styles.selectButton}>
            <Text style={styles.selectButtonText}>SELECT</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

function POSLocationSelector({
  locations,
  vendorLogo,
  vendorName,
  onLocationSelected,
}: POSLocationSelectorProps) {
  const headerFade = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [])

  const handleLocationPress = (location: Location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onLocationSelected(location.id, location.name)
  }

  if (locations.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No locations available</Text>
          <Text style={styles.emptySubtext}>Contact your administrator</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: headerFade }]}>
          {vendorLogo && (
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Image source={{ uri: vendorLogo }} style={styles.logo} resizeMode="contain" />
              </View>
            </View>
          )}
          <Text style={styles.title}>SELECT LOCATION</Text>
          <Text style={styles.subtitle}>Choose which location to access</Text>
        </Animated.View>

        <View style={styles.locationsGrid}>
          {locations.map((location, index) => (
            <LocationCard
              key={location.id}
              location={location}
              index={index}
              onPress={() => handleLocationPress(location)}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Select a location to view registers</Text>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: isTablet ? 60 : 24,
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
  },
  emptySubtext: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 24,
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
    padding: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 4,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  locationsGrid: {
    gap: 16,
  },
  locationCard: {
    marginBottom: 16,
  },
  locationCardInner: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  locationCardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  locationCardContent: {
    padding: 24,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  locationName: {
    fontSize: 18,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.5,
  },
  primaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderRadius: 8,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(96,165,250,0.9)',
    letterSpacing: 1.5,
  },
  locationAddress: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
    marginBottom: 20,
  },
  selectButton: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 3,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
})
