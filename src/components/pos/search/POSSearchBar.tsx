import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'

interface POSSearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  activeFilterCount: number
  onFilterPress: () => void
  onClearFilters: () => void
  children?: ReactNode
}

export function POSSearchBar({
  searchQuery,
  onSearchChange,
  activeFilterCount,
  onFilterPress,
  onClearFilters,
  children,
}: POSSearchBarProps) {
  return (
    <View style={styles.searchHeaderFloating}>
      <View style={styles.unifiedSearchBar}>
        <View style={styles.unifiedSearchBarPill}>
          {/* BlurView for glass effect */}
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Filter Button - Left Side */}
          {activeFilterCount > 0 ? (
            <View style={styles.filterButtonIntegrated}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onFilterPress()
                }}
                style={styles.filterButtonActiveSection}
                activeOpacity={0.7}
              >
                <Text style={styles.filterCount}>{activeFilterCount}</Text>
              </TouchableOpacity>

              <View style={styles.filterDivider} />

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onClearFilters()
                }}
                style={styles.filterClearSection}
                activeOpacity={0.7}
              >
                <Text style={styles.filterClearX}>×</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onFilterPress()
              }}
              style={styles.filterButtonIntegrated}
              activeOpacity={0.7}
            >
              <Text style={styles.filterIcon}>|||</Text>
            </TouchableOpacity>
          )}

          {/* Search Input - Fills remaining space */}
          <TextInput
            style={styles.unifiedSearchInput}
            placeholder="Search products..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
        </View>
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  searchHeaderFloating: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  unifiedSearchBar: {
    alignSelf: 'stretch',
  },
  unifiedSearchBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  filterButtonIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
  },
  filterButtonActiveSection: {
    paddingRight: 8,
  },
  filterCount: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(59,130,246,0.95)',
    letterSpacing: 0.5,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 8,
  },
  filterClearSection: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterClearX: {
    fontSize: 20,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
  },
  filterIcon: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -1,
    transform: [{ rotate: '90deg' }],
  },
  unifiedSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.3,
    paddingRight: 20,
    zIndex: 1,
  },
})
