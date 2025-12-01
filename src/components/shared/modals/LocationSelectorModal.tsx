/**
 * LocationSelectorModal - Location Filter Selector
 * Built using FullScreenModal standard pattern
 *
 * Zero Props Architecture:
 * - Reads from location-filter.store for selected locations
 * - Reads from AppAuthContext for user locations
 * - Writes to location-filter.store when user selects
 *
 * Usage:
 * - Opens when user taps user badge in nav bar
 * - Allows multi-select of locations
 * - Empty selection = all locations
 */

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { FullScreenModal, modalStyles } from './FullScreenModal'
import { useLocationFilter } from '@/stores/location-filter.store'
import { useAppAuth } from '@/contexts/AppAuthContext'

interface LocationSelectorModalProps {
  visible: boolean
  onClose: () => void
}

export function LocationSelectorModal({ visible, onClose }: LocationSelectorModalProps) {
  // ========================================
  // ZERO PROPS - Read from stores/contexts
  // ========================================
  const { locations } = useAppAuth()
  const { selectedLocationIds, setSelectedLocationIds } = useLocationFilter()

  // Local state for temp selection (only commits on Done)
  const [tempSelection, setTempSelection] = useState<string[]>(selectedLocationIds)
  const [searchValue, setSearchValue] = useState('')

  // Sync temp selection when modal opens
  useEffect(() => {
    if (visible) {
      setTempSelection(selectedLocationIds)
      setSearchValue('')
    }
  }, [visible, selectedLocationIds])

  // ========================================
  // HANDLERS
  // ========================================
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

  const handleDone = () => {
    console.log('[LocationSelectorModal] Done pressed, setting locations:', tempSelection)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setSelectedLocationIds(tempSelection)
    console.log('[LocationSelectorModal] Locations set, closing modal')
    onClose()
  }

  // ========================================
  // COMPUTED VALUES
  // ========================================
  const isAllSelected = tempSelection.length === 0

  // Filter locations by search
  const filteredLocations = locations.filter(location => {
    if (!searchValue.trim()) return true
    const query = searchValue.toLowerCase()
    return (
      location.name.toLowerCase().includes(query) ||
      location.address_line1?.toLowerCase().includes(query) ||
      location.city?.toLowerCase().includes(query) ||
      location.state?.toLowerCase().includes(query)
    )
  })

  // ========================================
  // RENDER
  // ========================================
  return (
    <FullScreenModal
      visible={visible}
      onClose={handleDone}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder="Search locations..."
    >
      {/* All Locations Option */}
      <View style={styles.section}>
        <Text style={modalStyles.sectionLabel}>FILTER BY</Text>
        <View style={styles.card}>
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
                Show products from all {locations.length} location{locations.length !== 1 ? 's' : ''}
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
        <Text style={modalStyles.sectionLabel}>LOCATIONS</Text>
        <View style={styles.card}>
          {filteredLocations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No locations found</Text>
            </View>
          ) : (
            filteredLocations.map((location, index) => {
              const isSelected = tempSelection.includes(location.id)
              const isLast = index === filteredLocations.length - 1
              const address = [
                location.address_line1,
                location.city,
                location.state,
              ].filter(Boolean).join(', ') || 'No address'

              return (
                <Pressable
                  key={location.id}
                  style={[styles.locationRow, isLast && styles.locationRowLast]}
                  onPress={() => handleToggleLocation(location.id)}
                  accessible={true}
                  accessibilityRole="checkbox"
                  accessibilityLabel={location.name}
                  accessibilityState={{ checked: isSelected }}
                >
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{location.name}</Text>
                    <Text style={styles.locationSubtext}>{address}</Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
              )
            })
          )}
        </View>
      </View>
    </FullScreenModal>
  )
}

// ========================================
// STYLES
// ========================================
const styles = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  card: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 68,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  locationRowLast: {
    borderBottomWidth: 0,
  },
  locationInfo: {
    flex: 1,
    marginRight: 16,
  },
  locationName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  locationSubtext: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
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
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
})
