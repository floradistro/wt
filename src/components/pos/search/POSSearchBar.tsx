import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native'
import { memo, type ReactNode } from 'react'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

interface POSSearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  activeFilterCount: number
  onFilterPress: () => void
  onClearFilters: () => void
  children?: ReactNode
}

function POSSearchBar({
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

          {/* Filter Button - Left Side - iOS 26 Style */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onFilterPress()
            }}
            style={[
              styles.filterButton,
              activeFilterCount > 0 && styles.filterButtonActive
            ]}
            activeOpacity={0.7}
          >
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : (
              <View style={styles.filterIconContainer}>
                <View style={styles.filterIconLine} />
                <View style={styles.filterIconLine} />
                <View style={styles.filterIconLine} />
              </View>
            )}
          </TouchableOpacity>

          {activeFilterCount > 0 && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onClearFilters()
              }}
              style={styles.filterClearButton}
              activeOpacity={0.7}
            >
              <Text style={styles.filterClearText}>×</Text>
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

const POSSearchBarMemo = memo(POSSearchBar)
export { POSSearchBarMemo as POSSearchBar }

const styles = StyleSheet.create({
  searchHeaderFloating: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
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
  // iOS 26 Filter Button
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  filterBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0,
  },
  filterIconContainer: {
    gap: 2,
  },
  filterIconLine: {
    width: 12,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 1,
  },
  filterClearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 4,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,60,60,0.15)',
  },
  filterClearText: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255,60,60,0.95)',
    marginTop: -2,
  },
  unifiedSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.3,
    paddingLeft: 12,
    paddingRight: 20,
    zIndex: 1,
  },
})
