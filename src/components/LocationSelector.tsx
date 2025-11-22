/**
 * LocationSelector Component
 * Modal for selecting location(s) to filter products by
 * Apple Engineering: Clean, minimal, iOS-style
 */

import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native'
import { useState, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import type { UserLocationAccess } from '@/hooks/useUserLocations'

interface LocationSelectorProps {
  visible: boolean
  userLocations: UserLocationAccess[]
  selectedLocationIds: string[] // Empty array = all locations
  onClose: () => void
  onSelect: (locationIds: string[]) => void
  context?: 'products' | 'orders' // What items are being filtered
}

export function LocationSelector({
  visible,
  userLocations,
  selectedLocationIds,
  onClose,
  onSelect,
  context = 'products', // Default to 'products' for backwards compatibility
}: LocationSelectorProps) {
  const [tempSelection, setTempSelection] = useState<string[]>(selectedLocationIds)

  // Get context-aware item label
  const itemLabel = context === 'orders' ? 'orders' : 'products'

  // Safe defaults for undefined userLocations
  const safeUserLocations = userLocations || []

  useEffect(() => {
    if (visible) {
      setTempSelection(selectedLocationIds)
    }
  }, [visible, selectedLocationIds])

  const handleToggleLocation = (locationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setTempSelection(prev => {
      if (prev.includes(locationId)) {
        // Remove location
        return prev.filter(id => id !== locationId)
      } else {
        // Add location
        return [...prev, locationId]
      }
    })
  }

  const handleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTempSelection([]) // Empty = all locations
  }

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    onSelect(tempSelection)
    onClose()
  }

  const isAllSelected = tempSelection.length === 0

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.background, !isLiquidGlassSupported && styles.backgroundFallback]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Filter Locations</Text>
            <Pressable onPress={handleApply} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>Apply</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            scrollIndicatorInsets={{ right: 2 }}
          >
            {/* All Locations Option */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FILTER BY</Text>
              <View style={styles.cardGlass}>
                <Pressable
                  style={styles.locationRow}
                  onPress={handleSelectAll}
                  accessible={true}
                  accessibilityRole="checkbox"
                  accessibilityLabel="All Locations"
                  accessibilityState={{ checked: isAllSelected }}
                >
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>All Locations</Text>
                    <Text style={styles.locationSubtext}>
                      Show {itemLabel} from all {safeUserLocations.length} location{safeUserLocations.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, isAllSelected && styles.checkboxActive]}>
                    {isAllSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Individual Locations */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LOCATIONS</Text>
              <View style={styles.cardGlass}>
                {safeUserLocations.map((userLocation, index) => {
                  const isSelected = tempSelection.includes(userLocation.location.id)
                  const isLast = index === safeUserLocations.length - 1
                  const address = [
                    userLocation.location.address_line1,
                    userLocation.location.city,
                    userLocation.location.state,
                  ].filter(Boolean).join(', ') || 'No address'

                  return (
                    <Pressable
                      key={userLocation.location.id}
                      style={[styles.locationRow, isLast && styles.locationRowLast]}
                      onPress={() => handleToggleLocation(userLocation.location.id)}
                      accessible={true}
                      accessibilityRole="checkbox"
                      accessibilityLabel={userLocation.location.name}
                      accessibilityState={{ checked: isSelected }}
                    >
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationName}>{userLocation.location.name}</Text>
                        <Text style={styles.locationSubtext}>{address}</Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </ScrollView>
        </LiquidGlassView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
  },
  backgroundFallback: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.contentHorizontal,
    paddingVertical: layout.cardPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.6)',
  },
  headerButtonTextPrimary: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.contentHorizontal,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.cardPadding,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  locationRowLast: {
    borderBottomWidth: 0,
  },
  locationInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  locationSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#60A5FA',
    borderColor: '#60A5FA',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
})
