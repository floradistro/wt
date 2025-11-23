/**
 * POSSearchBar - ZERO PROPS ✅
 *
 * ZERO PROP DRILLING:
 * - No searchQuery prop - reads from product-filter.store
 * - No activeFilterCount prop - reads from product-filter.store
 * - Keeps coordination callbacks (onSearchChange, onFilterPress, onClearFilters)
 */

import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { memo, type ReactNode, useMemo } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { layout } from '@/theme/layout'

// Stores (ZERO PROP DRILLING - Apple Standard)
import { useProductFilters, useActiveFilterCount } from '@/stores/product-filter.store'

interface POSSearchBarProps {
  onSearchChange: (query: string) => void
  onFilterPress: () => void
  onClearFilters: () => void
  children?: ReactNode
  /** Show loading indicator while searching */
  isSearching?: boolean
  /** Placeholder text for search input */
  placeholder?: string
}

function POSSearchBar({
  onSearchChange,
  onFilterPress,
  onClearFilters,
  children,
  isSearching = false,
  placeholder = 'Search products...',
}: POSSearchBarProps) {
  // ========================================
  // STORE - TRUE ZERO PROPS (read from environment)
  // ========================================
  const filters = useProductFilters()
  const searchQuery = filters.searchQuery
  const activeFilterCount = useActiveFilterCount()
  const insets = useSafeAreaInsets()

  // Apple Engineering: Dynamic positioning with safe area insets
  // Ensures perfect alignment with product grid on all devices
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: layout.pos.searchBarTop,
    left: Math.max(layout.pos.searchBarLeft, insets.left),     // Account for notch/safe area
    right: Math.max(layout.pos.searchBarRight, insets.right),  // Account for notch/safe area
    zIndex: 10,
  }), [insets.left, insets.right])

  const handleClearSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSearchChange('')
  }

  return (
    <View style={containerStyle}>
      <View style={styles.unifiedSearchBar}>
        <LiquidGlassView
          style={[
            styles.unifiedSearchBarPill,
            !isLiquidGlassSupported && styles.fallback,
          ]}
          effect="clear"
          colorScheme="dark"
        >
          {/* Filter Button - Left Side - iOS 26 Style with Liquid Glass */}
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            interactive
            style={[
              styles.filterButton,
              activeFilterCount > 0 && styles.filterButtonActive,
              !isLiquidGlassSupported && styles.filterButtonFallback
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onFilterPress()
              }}
              style={styles.filterButtonInner}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Filter products"
              accessibilityHint={activeFilterCount > 0 ? `${activeFilterCount} filters active` : 'No filters active'}
              accessibilityValue={{ text: activeFilterCount > 0 ? `${activeFilterCount} active` : 'None' }}
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
          </LiquidGlassView>

          {activeFilterCount > 0 && (
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              interactive
              style={[
                styles.filterClearButton,
                !isLiquidGlassSupported && styles.filterClearButtonFallback
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onClearFilters()
                }}
                style={styles.filterClearButtonInner}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
                accessibilityHint={`Remove all ${activeFilterCount} active filters`}
              >
                <Text style={styles.filterClearText}>×</Text>
              </TouchableOpacity>
            </LiquidGlassView>
          )}

          {/* Search Icon - Left of input */}
          <View style={styles.searchIconContainer}>
            <View style={styles.searchIconCircle} />
            <View style={styles.searchIconHandle} />
          </View>

          {/* Search Input - Fills remaining space */}
          <TextInput
            style={styles.unifiedSearchInput}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchQuery}
            onChangeText={onSearchChange}
            accessibilityLabel="Search products"
            accessibilityHint="Type to filter products by name or category"
            accessibilityRole="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never" // We'll handle clear button ourselves
          />

          {/* Loading Indicator - Shows while searching */}
          {isSearching && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
            </View>
          )}

          {/* Clear Search Button - Shows when there's text */}
          {searchQuery.length > 0 && !isSearching && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearSearchButton}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              accessibilityHint="Remove search text"
            >
              <View style={styles.clearSearchIcon}>
                <Text style={styles.clearSearchText}>×</Text>
              </View>
            </TouchableOpacity>
          )}
        </LiquidGlassView>
      </View>
      {children}
    </View>
  )
}

const POSSearchBarMemo = memo(POSSearchBar)
export { POSSearchBarMemo as POSSearchBar }

const styles = StyleSheet.create({
  // Note: Position styles moved to dynamic containerStyle (uses safe area insets)
  unifiedSearchBar: {
    alignSelf: 'stretch',
  },
  unifiedSearchBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.pos.searchBarHeight, // 48px - from design system
    borderRadius: layout.pos.searchBarHeight / 2, // Perfect pill shape
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // iOS 26 Filter Button with Liquid Glass
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 6,
    overflow: 'hidden',
  },
  filterButtonActive: {
    // Liquid glass provides the visual effect
  },
  filterButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterButtonInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    overflow: 'hidden',
  },
  filterClearButtonFallback: {
    backgroundColor: 'rgba(255,60,60,0.15)',
  },
  filterClearButtonInner: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterClearText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,60,60,0.95)',
    marginTop: -2,
  },
  unifiedSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.2,
    paddingLeft: 4,
    paddingRight: 8,
    zIndex: 1,
  },
  // Search Icon (magnifying glass)
  searchIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  searchIconCircle: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  searchIconHandle: {
    position: 'absolute',
    width: 5,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
    top: 19,
    left: 20,
  },
  // Loading Indicator
  loadingContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  // Clear Search Button
  clearSearchButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  clearSearchIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    marginTop: -2,
  },
})
