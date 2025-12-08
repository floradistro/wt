/**
 * OrderFilterBar - Shared date/location filter component
 * Used across FulfillmentBoard, InStoreSalesView, ErrorFeedView
 */

import React from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { colors, spacing } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useDateRange, useOrdersUIActions, type DateRange } from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { useAppAuth } from '@/contexts/AppAuthContext'

interface FilterPill {
  id: string
  label: string
}

const dateFilterPills: FilterPill[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 Days' },
  { id: 'month', label: '30 Days' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
]

interface OrderFilterBarProps {
  showLocationFilter?: boolean
}

export function OrderFilterBar({ showLocationFilter = true }: OrderFilterBarProps) {
  const { locations } = useAppAuth()
  const dateRange = useDateRange()
  const { setDateRange, openLocationSelector } = useOrdersUIActions()
  const { selectedLocationIds } = useLocationFilter()

  // Location button label
  const locationButtonLabel = selectedLocationIds.length === 0
    ? 'All Locations'
    : selectedLocationIds.length === 1
      ? locations.find(l => l.id === selectedLocationIds[0])?.name || '1 Location'
      : `${selectedLocationIds.length} Locations`

  const handleDateFilterSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setDateRange(id as DateRange)
  }

  return (
    <View style={styles.container}>
      {/* Date Range Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}
      >
        {dateFilterPills.map((pill) => (
          <Pressable
            key={pill.id}
            style={[
              styles.pill,
              dateRange === pill.id && styles.pillActive,
            ]}
            onPress={() => handleDateFilterSelect(pill.id)}
          >
            <Text style={[
              styles.pillText,
              dateRange === pill.id && styles.pillTextActive,
            ]}>
              {pill.label}
            </Text>
          </Pressable>
        ))}

        {/* Location Filter Button */}
        {showLocationFilter && (
          <Pressable
            style={[styles.pill, styles.locationPill]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              openLocationSelector()
            }}
          >
            <Ionicons name="location-outline" size={14} color="rgba(235,235,245,0.7)" />
            <Text style={styles.pillText}>{locationButtonLabel}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: spacing.md,
  },
  pillsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  locationPill: {
    marginLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.1)',
    paddingLeft: 14,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.2,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
})
