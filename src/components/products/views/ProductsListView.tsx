/**
 * ProductsListView Component
 * Apple Standard: Focused products list with iOS section index
 *
 * Handles:
 * - Products list rendering with A-Z sections
 * - iOS section index (A-Z scroller on right side)
 * - Large title header with vendor logo
 * - Empty states
 */

import React, { useRef, useState, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated, PanResponder } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { ProductItem } from '@/components/products/list/ProductItem'
import { InventoryHealthModal } from '@/components/products/InventoryHealthModal'
import { TitleSection, LocationSelectorModal } from '@/components/shared'
import type { FilterPill } from '@/components/shared'
import { layout } from '@/theme/layout'
import { colors, spacing, radius } from '@/theme/tokens'
import type { Product } from '@/types/products'
import { useProductsScreenStore } from '@/stores/products-list.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useCategories } from '@/hooks/useCategories'

type ProductFilter = 'all' | 'low-stock' | 'out-of-stock'
type CategoryFilter = string | null // null means "All Categories"

interface ProductsListViewProps {
  products: Product[]
  vendorLogo?: string | null
  isLoading: boolean
}

function ProductsListViewComponent({
  products,
  vendorLogo,
  isLoading,
}: ProductsListViewProps) {
  // Read from stores - only get the ID to avoid re-renders when product object changes
  const selectedProductId = useProductsScreenStore(state => state.selectedProduct?.id)
  const selectProduct = useProductsScreenStore(state => state.selectProduct)
  const openModal = useProductsScreenStore(state => state.openModal)
  const { selectedLocationIds } = useLocationFilter()
  const { locations } = useAppAuth()
  const { categories } = useCategories({ includeGlobal: true }) // Get all categories including subcategories

  // Location selector modal state
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showHealthModal, setShowHealthModal] = useState(false)

  // Compute location display text
  const locationDisplayText = useMemo(() => {
    if (selectedLocationIds.length === 0) {
      return 'All Locations'
    }
    if (selectedLocationIds.length === 1) {
      const loc = locations.find(l => l.id === selectedLocationIds[0])
      return loc?.name || '1 Location'
    }
    return `${selectedLocationIds.length} Locations`
  }, [selectedLocationIds, locations])

  // Local filter state (replaces activeNav)
  const [activeFilter, setActiveFilter] = useState<ProductFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(null)

  // Compute category map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(cat => map.set(cat.id, cat.name))
    return map
  }, [categories])

  // Build hierarchical category structure with counts
  const { parentCategories, subcategoryMap } = useMemo(() => {
    // Count products per category
    const categoryCounts = new Map<string, number>()
    products.forEach(p => {
      if (p.primary_category_id) {
        const count = categoryCounts.get(p.primary_category_id) || 0
        categoryCounts.set(p.primary_category_id, count + 1)
      }
    })

    // Build category lookup
    const categoryLookup = new Map(categories.map(c => [c.id, c]))

    // Separate parents and children
    const parents: Array<{ id: string; name: string; count: number; hasSubcategories: boolean }> = []
    const subcatMap = new Map<string, Array<{ id: string; name: string; count: number }>>()

    // First pass: identify all parent IDs that have products (directly or via subcategories)
    const parentIdsWithProducts = new Set<string>()

    categories.forEach(cat => {
      const directCount = categoryCounts.get(cat.id) || 0
      if (directCount > 0) {
        if (cat.parent_id) {
          parentIdsWithProducts.add(cat.parent_id)
        } else {
          parentIdsWithProducts.add(cat.id)
        }
      }
    })

    // Second pass: build structure
    categories.forEach(cat => {
      const count = categoryCounts.get(cat.id) || 0

      if (cat.parent_id) {
        // This is a subcategory
        if (count > 0) {
          const existing = subcatMap.get(cat.parent_id) || []
          existing.push({ id: cat.id, name: cat.name, count })
          subcatMap.set(cat.parent_id, existing)
        }
      } else {
        // This is a parent category
        // Include if it has products directly OR has subcategories with products
        const hasSubsWithProducts = subcatMap.has(cat.id) ||
          categories.some(c => c.parent_id === cat.id && (categoryCounts.get(c.id) || 0) > 0)

        if (count > 0 || hasSubsWithProducts || parentIdsWithProducts.has(cat.id)) {
          parents.push({
            id: cat.id,
            name: cat.name,
            count,
            hasSubcategories: false, // Will update below
          })
        }
      }
    })

    // Update hasSubcategories flag
    parents.forEach(p => {
      p.hasSubcategories = subcatMap.has(p.id) && (subcatMap.get(p.id)?.length || 0) > 0
    })

    // Sort
    parents.sort((a, b) => a.name.localeCompare(b.name))
    subcatMap.forEach((subs) => subs.sort((a, b) => a.name.localeCompare(b.name)))

    return { parentCategories: parents, subcategoryMap: subcatMap }
  }, [categories, products])

  // Track expanded parent category
  const [expandedParent, setExpandedParent] = useState<string | null>(null)

  // Filter products based on active filter AND category (including subcategories)
  const filteredProducts = useMemo(() => {
    let filtered = products

    // Apply category filter first
    if (selectedCategory) {
      // Check if selected category is a parent with subcategories
      const subcats = subcategoryMap.get(selectedCategory)
      if (subcats && subcats.length > 0) {
        // Include products from parent AND all its subcategories
        const validCategoryIds = new Set([selectedCategory, ...subcats.map(s => s.id)])
        filtered = filtered.filter(p => p.primary_category_id && validCategoryIds.has(p.primary_category_id))
      } else {
        // Just filter by this specific category
        filtered = filtered.filter(p => p.primary_category_id === selectedCategory)
      }
    }

    // Then apply stock filter
    if (activeFilter === 'low-stock') {
      filtered = filtered.filter(p => (p.inventory_quantity || 0) > 0 && (p.inventory_quantity || 0) < 10)
    } else if (activeFilter === 'out-of-stock') {
      filtered = filtered.filter(p => (p.inventory_quantity || 0) === 0)
    }

    return filtered
  }, [products, activeFilter, selectedCategory, subcategoryMap])

  // Compute product sections (A-Z grouped)
  const productSections = useMemo((): [string, Product[]][] => {
    const grouped = filteredProducts.reduce((acc, product) => {
      const firstLetter = (product.name || '').charAt(0).toUpperCase()
      const letter = /[A-Z]/.test(firstLetter) ? firstLetter : '#'
      if (!acc[letter]) acc[letter] = []
      acc[letter].push(product)
      return acc
    }, {} as Record<string, Product[]>)

    return Object.entries(grouped).sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b)
    })
  }, [filteredProducts])

  // Define stock filter pills
  const filterPills: FilterPill[] = useMemo(() => {
    const lowStockCount = products.filter(p => (p.inventory_quantity || 0) > 0 && (p.inventory_quantity || 0) < 10).length
    const outOfStockCount = products.filter(p => (p.inventory_quantity || 0) === 0).length

    return [
      { id: 'all', label: 'All' },
      { id: 'low-stock', label: `Low Stock (${lowStockCount})` },
      { id: 'out-of-stock', label: `Out of Stock (${outOfStockCount})` },
    ]
  }, [products])

  // Single location pill for TitleSection - opens modal
  const locationPill: FilterPill[] = useMemo(() => {
    return [{ id: 'location', label: locationDisplayText }]
  }, [locationDisplayText])

  // Handle stock filter selection
  const handleFilterSelect = (filterId: string) => {
    setActiveFilter(filterId as ProductFilter)
  }

  // Handle location pill tap - always opens modal
  const handleLocationPillSelect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowLocationModal(true)
  }

  // Handle category filter selection
  const handleCategorySelect = (categoryId: string | null, isParent: boolean = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (categoryId === null) {
      // "All" selected - clear everything
      setSelectedCategory(null)
      setExpandedParent(null)
    } else if (isParent) {
      // Parent category tapped
      const hasSubcats = subcategoryMap.has(categoryId) && (subcategoryMap.get(categoryId)?.length || 0) > 0

      if (hasSubcats) {
        // Toggle expansion
        if (expandedParent === categoryId) {
          // Already expanded, select it and collapse
          setSelectedCategory(categoryId)
          setExpandedParent(null)
        } else {
          // Expand to show subcategories
          setExpandedParent(categoryId)
          setSelectedCategory(categoryId) // Also select parent to show all its products
        }
      } else {
        // No subcategories, just select
        setSelectedCategory(categoryId)
        setExpandedParent(null)
      }
    } else {
      // Subcategory selected
      setSelectedCategory(categoryId)
    }
  }

  // Handlers
  const onProductSelect = useCallback((product: Product) => {
    selectProduct(product)
  }, [selectProduct])

  const onAddProduct = useCallback(() => {
    openModal('createProduct')
  }, [openModal])

  const handleOpenLocationSelector = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowLocationModal(true)
  }, [])

  const handleOpenHealth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowHealthModal(true)
  }, [])

  // Location names (simplified - just show count for now)
  const selectedLocationNames = useMemo(() => {
    return selectedLocationIds.length > 0
      ? [`${selectedLocationIds.length} locations`]
      : ['All locations']
  }, [selectedLocationIds])
  // ========================================
  // SCROLL STATE
  // ========================================
  const scrollViewRef = useRef<ScrollView>(null)

  // ========================================
  // SECTION INDEX STATE (iOS A-Z Scroller)
  // ========================================
  const sectionYPositionsRef = useRef<Record<string, number>>({})
  const indexHeightRef = useRef(0)
  const indexTopRef = useRef(0)
  const lastScrolledLetterRef = useRef<string | null>(null)
  const currentLetterRef = useRef<string | null>(null)
  const [showSectionIndex, setShowSectionIndex] = useState(false)
  const [currentLetter, setCurrentLetter] = useState<string | null>(null)

  // Animated values for section index
  const indexOpacity = useRef(new Animated.Value(0)).current
  const previewOpacity = useRef(new Animated.Value(0)).current
  const previewScale = useRef(new Animated.Value(0)).current
  const touchIndicatorY = useRef(new Animated.Value(0)).current
  const previewY = useRef(new Animated.Value(0)).current
  const scrollProgress = useRef(new Animated.Value(0)).current

  // Get section index letters
  const sectionIndex = useMemo(() => {
    return productSections.map(([letter]) => letter)
  }, [productSections])

  // ========================================
  // SECTION INDEX HANDLERS
  // ========================================
  const handleIndexTouch = useCallback((absoluteY: number) => {
    if (sectionIndex.length === 0 || indexHeightRef.current === 0) return

    const relativeY = absoluteY - indexTopRef.current
    const clampedY = Math.max(0, Math.min(relativeY, indexHeightRef.current))
    const progress = clampedY / indexHeightRef.current
    scrollProgress.setValue(progress)

    Animated.spring(touchIndicatorY, {
      toValue: absoluteY,
      friction: 20,
      tension: 300,
      useNativeDriver: true,
    }).start()

    Animated.spring(previewY, {
      toValue: absoluteY,
      friction: 20,
      tension: 300,
      useNativeDriver: true,
    }).start()

    const index = Math.floor(progress * sectionIndex.length)
    const clampedIndex = Math.max(0, Math.min(index, sectionIndex.length - 1))
    const letter = sectionIndex[clampedIndex]

    currentLetterRef.current = letter
    requestAnimationFrame(() => {
      setCurrentLetter(letter)
    })

    if (letter === lastScrolledLetterRef.current) return
    lastScrolledLetterRef.current = letter

    const yPosition = sectionYPositionsRef.current[letter]
    if (yPosition !== undefined && scrollViewRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      scrollViewRef.current.scrollTo({ y: yPosition - 80, animated: false })
    }
  }, [sectionIndex, touchIndicatorY, previewY, scrollProgress])

  const showIndex = useCallback(() => {
    setShowSectionIndex(true)
    Animated.parallel([
      Animated.spring(indexOpacity, { toValue: 1, friction: 10, tension: 150, useNativeDriver: true }),
      Animated.spring(previewOpacity, { toValue: 1, friction: 9, tension: 140, useNativeDriver: true }),
      Animated.spring(previewScale, { toValue: 1, friction: 8, tension: 130, useNativeDriver: true }),
    ]).start()
  }, [indexOpacity, previewOpacity, previewScale])

  const hideIndex = useCallback(() => {
    Animated.parallel([
      Animated.spring(indexOpacity, { toValue: 0, friction: 12, tension: 140, useNativeDriver: true }),
      Animated.spring(previewOpacity, { toValue: 0, friction: 12, tension: 140, useNativeDriver: true }),
      Animated.spring(previewScale, { toValue: 0.85, friction: 11, tension: 130, useNativeDriver: true }),
    ]).start(() => {
      setShowSectionIndex(false)
      setCurrentLetter(null)
      currentLetterRef.current = null
    })
  }, [indexOpacity, previewOpacity, previewScale])

  const indexPanResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        showIndex()
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        handleIndexTouch(evt.nativeEvent.pageY)
      },
      onPanResponderMove: (evt) => {
        handleIndexTouch(evt.nativeEvent.pageY)
      },
      onPanResponderRelease: () => {
        lastScrolledLetterRef.current = null
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        hideIndex()
      },
      onPanResponderTerminate: () => {
        lastScrolledLetterRef.current = null
        hideIndex()
      },
    }),
    [handleIndexTouch, showIndex, hideIndex]
  )

  // ========================================
  // LOADING
  // ========================================
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.text.secondary} />
      </View>
    )
  }

  // ========================================
  // RENDER
  // ========================================
  return (
    <View style={styles.container}>
      <View style={styles.sectionListContainer}>
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={!showSectionIndex}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
          contentContainerStyle={{
            paddingBottom: layout.dockHeight,
            paddingRight: 0
          }}
        >
          {/* Title Section with Location Filter & Compliance Button */}
          <TitleSection
            title="Products"
            logo={vendorLogo}
            subtitle={`${filteredProducts.length} ${activeFilter === 'all' ? 'products' : activeFilter === 'low-stock' ? 'low stock' : 'out of stock'}${selectedCategory ? ` in ${categoryMap.get(selectedCategory)}` : ''}`}
            buttonText="+ Add Product"
            onButtonPress={onAddProduct}
            buttonAccessibilityLabel="Add new product"
            filterPills={locationPill}
            activeFilterId="location"
            onFilterSelect={handleLocationPillSelect}
            secondaryButtonText="Health"
            secondaryButtonIcon="pulse"
            secondaryButtonColor="#60a5fa"
            onSecondaryButtonPress={handleOpenHealth}
          />

          {/* Stock Filter Row */}
          <View style={styles.stockFilterWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stockFilterContainer}
            >
              {filterPills.map((pill) => (
                <Pressable
                  key={pill.id}
                  style={[
                    styles.stockFilterPill,
                    activeFilter === pill.id && styles.stockFilterPillActive,
                  ]}
                  onPress={() => handleFilterSelect(pill.id)}
                >
                  <Text style={[
                    styles.stockFilterText,
                    activeFilter === pill.id && styles.stockFilterTextActive,
                  ]}>
                    {pill.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Category Filter Pills */}
          {parentCategories.length > 0 && (
            <View style={styles.categoryFilterWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryFilterContainer}
              >
                {/* All pill */}
                <Pressable
                  style={[
                    styles.categoryPill,
                    selectedCategory === null && styles.categoryPillActive,
                  ]}
                  onPress={() => handleCategorySelect(null)}
                >
                  <Text style={[
                    styles.categoryPillText,
                    selectedCategory === null && styles.categoryPillTextActive,
                  ]}>
                    All
                  </Text>
                </Pressable>

                {/* Parent categories */}
                {parentCategories.map((cat) => {
                  const isExpanded = expandedParent === cat.id
                  const isSelected = selectedCategory === cat.id
                  const subcats = subcategoryMap.get(cat.id) || []
                  const totalCount = cat.count + subcats.reduce((sum, s) => sum + s.count, 0)

                  return (
                    <React.Fragment key={cat.id}>
                      <Pressable
                        style={[
                          styles.categoryPill,
                          isSelected && styles.categoryPillActive,
                        ]}
                        onPress={() => handleCategorySelect(cat.id, true)}
                      >
                        {cat.hasSubcategories && (
                          <Text style={[
                            styles.categoryExpandIcon,
                            isExpanded && styles.categoryExpandIconActive,
                          ]}>
                            {isExpanded ? '▼' : '▶'}
                          </Text>
                        )}
                        <Text style={[
                          styles.categoryPillText,
                          isSelected && styles.categoryPillTextActive,
                        ]}>
                          {cat.name}
                        </Text>
                        <Text style={[
                          styles.categoryPillCount,
                          isSelected && styles.categoryPillCountActive,
                        ]}>
                          {totalCount}
                        </Text>
                      </Pressable>

                      {/* Subcategories (shown when expanded) */}
                      {isExpanded && subcats.map((subcat) => (
                        <Pressable
                          key={subcat.id}
                          style={[
                            styles.categoryPill,
                            styles.subcategoryPill,
                            selectedCategory === subcat.id && styles.categoryPillActive,
                          ]}
                          onPress={() => handleCategorySelect(subcat.id, false)}
                        >
                          <Text style={[
                            styles.categoryPillText,
                            styles.subcategoryPillText,
                            selectedCategory === subcat.id && styles.categoryPillTextActive,
                          ]}>
                            {subcat.name}
                          </Text>
                          <Text style={[
                            styles.categoryPillCount,
                            selectedCategory === subcat.id && styles.categoryPillCountActive,
                          ]}>
                            {subcat.count}
                          </Text>
                        </Pressable>
                      ))}
                    </React.Fragment>
                  )
                })}
              </ScrollView>
            </View>
          )}

          {/* Empty State */}
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No Products Found</Text>
              <Text style={styles.emptyStateText}>
                {activeFilter === 'low-stock'
                  ? 'No products with low stock levels'
                  : activeFilter === 'out-of-stock'
                  ? 'No products are out of stock'
                  : 'No products available'}
              </Text>
            </View>
          ) : (
            <>
              {/* Product Sections (A-Z) */}
              {productSections.map(([letter, items]) => (
                <View
                  key={letter}
                  style={styles.alphabetSection}
                  onLayout={(event) => {
                    const layout = event.nativeEvent.layout
                    sectionYPositionsRef.current[letter] = layout.y
                  }}
                >
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>{letter}</Text>
                  </View>

                  <View style={styles.cardWrapper}>
                    <View style={styles.productsCardGlass}>
                      {items.map((item, index) => {
                        const isLast = index === items.length - 1
                        // Use item.category directly - it's already populated by transformer
                        const categoryName = item.category ?? null

                        return (
                          <ProductItem
                            key={item.id}
                            item={item}
                            isLast={isLast}
                            isSelected={selectedProductId === item.id}
                            categoryName={categoryName}
                            selectedLocationIds={selectedLocationIds}
                            locationNames={selectedLocationNames}
                            onPress={() => onProductSelect(item)}
                          />
                        )
                      })}
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* iOS Section Index (A-Z Scroller) */}
        {sectionIndex.length > 0 && (
          <>
            <View
              style={styles.sectionIndexTouchArea}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout
                indexHeightRef.current = height
                event.target.measure((x, y, width, height, pageX, pageY) => {
                  indexTopRef.current = pageY
                })
              }}
              {...indexPanResponder.panHandlers}
            />

            {showSectionIndex && (
              <>
                {currentLetter && (
                  <Animated.View
                    style={[
                      styles.letterPreviewContainer,
                      {
                        opacity: previewOpacity,
                        transform: [
                          { translateY: previewY },
                          { scale: previewScale },
                        ],
                      }
                    ]}
                    pointerEvents="none"
                  >
                    <View style={styles.letterPreviewBubble}>
                      <Text style={styles.letterPreviewText}>{currentLetter}</Text>
                    </View>
                  </Animated.View>
                )}

                <Animated.View
                  style={[
                    styles.touchIndicator,
                    {
                      opacity: indexOpacity,
                      transform: [{ translateY: touchIndicatorY }],
                    }
                  ]}
                  pointerEvents="none"
                />

                <Animated.View
                  style={[
                    styles.sectionIndexContainer,
                    { opacity: indexOpacity }
                  ]}
                  pointerEvents="none"
                >
                  {sectionIndex.map((letter) => {
                    const isActive = letter === currentLetter
                    return (
                      <View
                        key={letter}
                        style={[
                          styles.sectionIndexItem,
                          isActive && styles.sectionIndexItemActive,
                        ]}
                      >
                        <Text style={[
                          styles.sectionIndexText,
                          isActive && styles.sectionIndexTextActive,
                        ]}>{letter}</Text>
                      </View>
                    )
                  })}
                </Animated.View>
              </>
            )}
          </>
        )}
      </View>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
      />

      {/* Inventory Health Modal */}
      <InventoryHealthModal
        visible={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        products={products}
      />
    </View>
  )
}

// Memoize with custom equality check to prevent unnecessary re-renders
export const ProductsListView = React.memo(ProductsListViewComponent)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  sectionListContainer: {
    flex: 1,
    position: 'relative',
  },

  // Stock Filter Row
  stockFilterWrapper: {
    paddingHorizontal: layout.containerMargin,
    marginBottom: spacing.md,
  },
  stockFilterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  stockFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stockFilterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stockFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.2,
  },
  stockFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  cardWrapper: {
    paddingHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    marginTop: 100,
  },
  emptyStateIcon: {
    fontSize: 64,
    color: 'rgba(235,235,245,0.3)',
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  emptyStateText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
  alphabetSection: {
    marginBottom: 0,
  },
  sectionHeader: {
    paddingVertical: 4,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    marginTop: 12,
  },
  sectionHeaderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  productsCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Category Filter
  categoryFilterWrapper: {
    paddingHorizontal: layout.containerMargin,
    marginBottom: spacing.md,
  },
  categoryFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: layout.containerMargin,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.2,
  },
  categoryPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryPillCount: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.4)',
  },
  categoryPillCountActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  categoryExpandIcon: {
    fontSize: 8,
    color: 'rgba(235,235,245,0.5)',
    marginRight: 2,
  },
  categoryExpandIconActive: {
    color: 'rgba(235,235,245,0.8)',
  },
  subcategoryPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  subcategoryPillText: {
    fontSize: 13,
  },

  // iOS Section Index
  sectionIndexTouchArea: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    zIndex: 100,
    paddingVertical: 80,
  },
  sectionIndexContainer: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 6,
    zIndex: 101,
    width: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    marginVertical: 80,
    marginRight: 2,
  },
  sectionIndexItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 10,
    maxHeight: 18,
  },
  sectionIndexItemActive: {
    transform: [{ scale: 1.2 }],
  },
  sectionIndexText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: 0,
  },
  sectionIndexTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  touchIndicator: {
    position: 'absolute',
    top: -20,
    right: 8,
    width: 3,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 1.5,
    zIndex: 102,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  letterPreviewContainer: {
    position: 'absolute',
    top: -30,
    right: 50,
    zIndex: 103,
  },
  letterPreviewBubble: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  letterPreviewText: {
    fontSize: 38,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -1,
  },
})
