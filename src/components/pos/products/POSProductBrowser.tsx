/**
 * POSProductBrowser Component - Apple Engineering Standard
 * Jobs Principle: One focused responsibility - Product display and filtering
 *
 * ZERO PROP DRILLING ✅
 * Reads ALL state from stores - no props needed
 *
 * Handles:
 * - Product loading
 * - Product grid display
 * - Search functionality
 * - Category/strain/consistency/flavor filtering
 * - Filter dropdown UI
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { layout } from '@/theme/layout'

// POS Components
import { POSSearchBar } from '../search/POSSearchBar'
import { POSProductGrid } from './POSProductGrid'

// Context - Zero prop drilling!
import { usePOSSession } from '@/contexts/POSSessionContext'

// Stores (ZERO PROP DRILLING - Apple Engineering Standard)
import { productsActions, useProductsState } from '@/stores/products.store'
import { useProductsStore } from '@/stores/products.store'
import {
  useProductFilters,
  useActiveFilterCount,
  productFilterActions,
} from '@/stores/product-filter.store'

// Utils
import { applyFilters, extractFieldValues } from '@/utils/product-transformers'

// Types
import { logger } from '@/utils/logger'

export function POSProductBrowser() {
  // ========================================
  // CONTEXT - Zero prop drilling!
  // ========================================
  const { session } = usePOSSession()

  // ========================================
  // STORES - ZERO PROP DRILLING (Apple Standard)
  // ========================================
  const { categories, loading: storeLoading } = useProductsState()

  // Read raw data from stores
  const products = useProductsStore((state) => state.products)
  const filters = useProductFilters()
  const activeFilterCount = useActiveFilterCount()

  // ✅ ANTI-LOOP: Compute filtered/derived data with useMemo (NOT in selectors)
  const filteredProducts = useMemo(() =>
    applyFilters(products, filters),
    [products, filters]
  )

  const availableStrainTypes = useMemo(() =>
    extractFieldValues(products, 'strain_type'),
    [products]
  )

  const availableConsistencies = useMemo(() =>
    extractFieldValues(
      products.filter((p) => p.category === 'Concentrates'),
      'consistency'
    ),
    [products]
  )

  const availableFlavors = useMemo(() =>
    extractFieldValues(products, 'flavor'),
    [products]
  )

  // ========================================
  // LOCAL STATE (UI only - dropdown visibility)
  // ========================================
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  // Animations
  const filterDropdownAnim = useRef(new Animated.Value(0)).current
  const filterScaleAnim = useRef(new Animated.Value(0.92)).current

  // ========================================
  // EFFECTS
  // ========================================
  // Load products into products.store
  useEffect(() => {
    if (session?.locationId) {
      productsActions.loadProducts(session.locationId)
    }
  }, [session?.locationId])

  // No need to sync products - filter store reads directly from products store! (Apple pattern)

  // Animate filter dropdown
  useEffect(() => {
    if (showCategoryDropdown) {
      Animated.parallel([
        Animated.spring(filterDropdownAnim, {
          toValue: 1,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.spring(filterScaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(filterDropdownAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(filterScaleAnim, {
          toValue: 0.92,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [showCategoryDropdown, filterDropdownAnim, filterScaleAnim])

  // ========================================
  // HANDLERS - Use store actions (Apple Standard)
  // ========================================
  const handleCategoryPress = useCallback(
    (category: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      productFilterActions.setCategory(category)
      setShowCategoryDropdown(false)
    },
    []
  )

  const handleClearFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productFilterActions.clearFilters()
  }, [])

  const handleFilterPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowCategoryDropdown(true)
  }, [])

  // ========================================
  // RENDER
  // ========================================
  // Guard: Ensure session data exists (after all hooks)
  if (!session) {
    logger.warn('POSProductBrowser: Missing session from context')
    return null
  }

  return (
    <View style={styles.container}>
      {/* Filters Dropdown - Dock style with liquid glass */}
      {showCategoryDropdown && (
        <>
          <Animated.View
            style={[
              styles.filterOverlay,
              { opacity: filterDropdownAnim }
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowCategoryDropdown(false)}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.filterDropdownWrapper,
              {
                opacity: filterDropdownAnim,
                transform: [
                  { scale: filterScaleAnim },
                  {
                    translateY: filterDropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <LiquidGlassView
              key="pos-filter-dropdown-container"
              effect="regular"
              colorScheme="dark"
              style={[
                styles.filterDropdownContainer,
                !isLiquidGlassSupported && styles.filterDropdownFallback
              ]}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.filterScrollView}
                contentContainerStyle={styles.filterScrollContent}
              >
                {/* Categories Section */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionLabel}>CATEGORY</Text>
                  <View style={styles.filterGroupContainer}>
                    {categories.map((category, index) => {
                      const isSelected = filters.category === category
                      const isFirst = index === 0
                      const isLast = index === categories.length - 1
                      return (
                        <LiquidGlassView
                          key={`filter-category-${category}-${isSelected}`}
                          effect="clear"
                          colorScheme="dark"
                          interactive
                          style={[
                            styles.filterItem,
                            isFirst && styles.filterItemFirst,
                            isLast && styles.filterItemLast,
                            isSelected && styles.filterItemSelected,
                            !isLiquidGlassSupported && styles.filterItemFallback
                          ]}
                        >
                          <Pressable
                            onPress={() => handleCategoryPress(category)}
                            style={[
                              styles.filterItemPressable,
                              isLast && styles.filterItemPressableLast
                            ]}
                          >
                            <Text style={styles.filterItemText}>{category}</Text>
                            {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                          </Pressable>
                        </LiquidGlassView>
                      )
                    })}
                  </View>
                </View>

                {/* Strain Types Section */}
                {availableStrainTypes.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionLabel}>STRAIN TYPE</Text>
                    <View style={styles.filterGroupContainer}>
                      {availableStrainTypes.map((strainType, index) => {
                        const isSelected = filters.strainTypes.includes(strainType)
                        const isFirst = index === 0
                        const isLast = index === availableStrainTypes.length - 1
                        return (
                          <LiquidGlassView
                            key={`filter-strain-${strainType}-${isSelected}`}
                            effect="clear"
                            colorScheme="dark"
                            interactive
                            style={[
                              styles.filterItem,
                              isFirst && styles.filterItemFirst,
                              isLast && styles.filterItemLast,
                              isSelected && styles.filterItemSelected,
                              !isLiquidGlassSupported && styles.filterItemFallback
                            ]}
                          >
                            <Pressable
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                productFilterActions.toggleStrainType(strainType)
                              }}
                              style={[
                                styles.filterItemPressable,
                                isLast && styles.filterItemPressableLast
                              ]}
                            >
                              <Text style={styles.filterItemText}>{strainType}</Text>
                              {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                            </Pressable>
                          </LiquidGlassView>
                        )
                      })}
                    </View>
                  </View>
                )}

                {/* Consistencies Section */}
                {availableConsistencies.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionLabel}>CONSISTENCY</Text>
                    <View style={styles.filterGroupContainer}>
                      {availableConsistencies.map((consistency, index) => {
                        const isSelected = filters.consistencies.includes(consistency)
                        const isFirst = index === 0
                        const isLast = index === availableConsistencies.length - 1
                        return (
                          <LiquidGlassView
                            key={`filter-consistency-${consistency}-${isSelected}`}
                            effect="clear"
                            colorScheme="dark"
                            interactive
                            style={[
                              styles.filterItem,
                              isFirst && styles.filterItemFirst,
                              isLast && styles.filterItemLast,
                              isSelected && styles.filterItemSelected,
                              !isLiquidGlassSupported && styles.filterItemFallback
                            ]}
                          >
                            <Pressable
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                productFilterActions.toggleConsistency(consistency)
                              }}
                              style={[
                                styles.filterItemPressable,
                                isLast && styles.filterItemPressableLast
                              ]}
                            >
                              <Text style={styles.filterItemText}>{consistency}</Text>
                              {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                            </Pressable>
                          </LiquidGlassView>
                        )
                      })}
                    </View>
                  </View>
                )}

                {/* Flavors Section */}
                {availableFlavors.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionLabel}>FLAVOR</Text>
                    <View style={styles.filterGroupContainer}>
                      {availableFlavors.map((flavor, index) => {
                        const isSelected = filters.flavors.includes(flavor)
                        const isFirst = index === 0
                        const isLast = index === availableFlavors.length - 1
                        return (
                          <LiquidGlassView
                            key={`filter-flavor-${flavor}-${isSelected}`}
                            effect="clear"
                            colorScheme="dark"
                            interactive
                            style={[
                              styles.filterItem,
                              isFirst && styles.filterItemFirst,
                              isLast && styles.filterItemLast,
                              isSelected && styles.filterItemSelected,
                              !isLiquidGlassSupported && styles.filterItemFallback
                            ]}
                          >
                            <Pressable
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                productFilterActions.toggleFlavor(flavor)
                              }}
                              style={[
                                styles.filterItemPressable,
                                isLast && styles.filterItemPressableLast
                              ]}
                            >
                              <Text style={styles.filterItemText}>{flavor}</Text>
                              {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                            </Pressable>
                          </LiquidGlassView>
                        )
                      })}
                    </View>
                  </View>
                )}
              </ScrollView>
            </LiquidGlassView>
          </Animated.View>
        </>
      )}

      {/* Product Grid - ZERO PROPS ✅ */}
      <POSProductGrid />

      {/* Search Bar with Filters - ZERO PROPS ✅ */}
      <POSSearchBar
        onSearchChange={productFilterActions.setSearchQuery}
        onFilterPress={handleFilterPress}
        onClearFilters={handleClearFilters}
      />
    </View>
  )
}

// ========================================
// STYLES - Exact copy from POSScreen
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  // Filter Dropdown - Dock style with liquid glass transparency
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 999,
  },
  filterDropdownWrapper: {
    position: 'absolute',
    top: 56, // Just below search bar (8px top + 48px bar)
    left: 8, // Match product grid left padding
    right: 8, // Ultra-minimal to match cart margins
    zIndex: 1000,
  },
  filterDropdownContainer: {
    maxHeight: 520,
    borderRadius: 28,
    borderCurve: 'continuous',
    overflow: 'hidden',
    // Shadow for depth - Apple style
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 20,
    elevation: 12,
  },
  filterDropdownFallback: {
    backgroundColor: 'rgba(20,20,20,0.95)',
  },
  filterScrollView: {
    maxHeight: 520,
    backgroundColor: 'transparent',
  },
  filterScrollContent: {
    paddingVertical: layout.cardPadding,
    paddingHorizontal: layout.cardPadding,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  // Grouped List Container - iOS 26 Style
  filterGroupContainer: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  // Filter List Items - iOS 26 Grouped List Style
  filterItem: {
    overflow: 'hidden',
  },
  filterItemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  filterItemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  filterItemFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  filterItemPressable: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  filterItemPressableLast: {
    borderBottomWidth: 0,
  },
  filterItemText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.4,
  },
  filterItemCheck: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
})
