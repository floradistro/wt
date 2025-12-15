/**
 * POSSwipeableBrowser - Invisible swipeable container for Products/Orders
 *
 * Apple-style horizontal swipe between:
 * - Products (default)
 * - Orders (swipe left)
 *
 * NO visible toggle - swipe only. Invisible UX.
 *
 * UNIFIED SEARCH BAR:
 * - Stays fixed at top while content swipes underneath
 * - Updates both product-filter.store and pos-order-filter.store
 * - Filter button opens the appropriate dropdown based on active tab
 */

import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  LayoutChangeEvent,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { BlurView } from 'expo-blur'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { layout } from '@/theme/layout'

// Components
import { POSProductBrowser } from './products/POSProductBrowser'
import { POSOrderFeed } from './orders/POSOrderFeed'
import { POSOrderCard } from './POSOrderCard'

// Stores - Unified search updates both
import { useSelectedOrderId } from '@/stores/orders-ui.store'
import { useOrders } from '@/stores/orders.store'
import {
  useProductFilters,
  useActiveFilterCount,
  productFilterActions,
} from '@/stores/product-filter.store'
import {
  usePOSOrderFilters,
  usePOSOrderActiveFilterCount,
  posOrderFilterActions,
  POS_ORDER_STATUS_GROUPS,
  type POSOrderStatusGroup,
} from '@/stores/pos-order-filter.store'
import { usePOSProductsState, usePOSProductsStore } from '@/stores/pos-products.store'
import { extractFieldValues } from '@/utils/product-transformers'
import { checkoutUIActions } from '@/stores/checkout-ui.store'
import { useSelectedCustomer, customerActions } from '@/stores/customer.store'

type Tab = 'products' | 'orders'

export function POSSwipeableBrowser() {
  const [activeTab, setActiveTab] = useState<Tab>('products')
  const [containerWidth, setContainerWidth] = useState(0)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current
  const activeTabRef = useRef<Tab>('products')
  const containerWidthRef = useRef(0)
  const insets = useSafeAreaInsets()
  const searchInputRef = useRef<TextInput>(null)

  // Search bar press animation
  const searchBarScale = useRef(new Animated.Value(1)).current

  // Filter dropdown animations
  const filterDropdownAnim = useRef(new Animated.Value(0)).current
  const filterScaleAnim = useRef(new Animated.Value(0.92)).current

  // Track active tab in ref for pan responder
  activeTabRef.current = activeTab
  containerWidthRef.current = containerWidth

  // ========================================
  // GLOBAL ORDER MODAL - For external triggers (e.g., from customer match)
  // ========================================
  const selectedOrderId = useSelectedOrderId()
  const orders = useOrders()
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return orders.find(o => o.id === selectedOrderId) || null
  }, [selectedOrderId, orders])

  // ========================================
  // CUSTOMER BUTTON - Opens customer selector or profile modal
  // ========================================
  const selectedCustomer = useSelectedCustomer()

  const handleCustomerPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (selectedCustomer) {
      // Customer already selected - show their profile
      checkoutUIActions.openModal('customerMatch', { viewProfile: selectedCustomer })
    } else {
      // No customer - open selector
      checkoutUIActions.openModal('customerSelector')
    }
  }, [selectedCustomer])

  const handleCustomerLongPress = useCallback(() => {
    if (selectedCustomer) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      customerActions.clearCustomer()
    }
  }, [selectedCustomer])

  // ========================================
  // UNIFIED SEARCH - Updates both stores
  // ========================================
  const productFilters = useProductFilters()
  const productFilterCount = useActiveFilterCount()
  const orderFilters = usePOSOrderFilters()
  const orderFilterCount = usePOSOrderActiveFilterCount()

  // Show the search query and filter count for the active tab
  const searchQuery = activeTab === 'products' ? productFilters.searchQuery : orderFilters.searchQuery
  const activeFilterCount = activeTab === 'products' ? productFilterCount : orderFilterCount
  const placeholder = activeTab === 'products' ? 'Search products...' : 'Search orders...'

  // ========================================
  // FILTER DROPDOWN DATA (for products tab)
  // ========================================
  const { categories } = usePOSProductsState()
  const products = usePOSProductsStore((state) => state.products)

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

  // Animate filter dropdown
  useEffect(() => {
    if (showFilterDropdown) {
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
  }, [showFilterDropdown, filterDropdownAnim, filterScaleAnim])

  // Update BOTH stores when search changes (keeps them in sync for seamless UX)
  const handleSearchChange = useCallback((query: string) => {
    productFilterActions.setSearchQuery(query)
    posOrderFilterActions.setSearchQuery(query)
  }, [])

  const handleClearSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productFilterActions.setSearchQuery('')
    posOrderFilterActions.setSearchQuery('')
  }, [])

  // Handle search focus - show filter dropdown for both tabs
  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowFilterDropdown(true)
  }, [])

  // Handle search blur
  const handleSearchBlur = useCallback(() => {
    setSearchFocused(false)
  }, [])

  // Handle search bar press - Apple-style interaction
  const handleSearchBarPressIn = useCallback(() => {
    Animated.spring(searchBarScale, {
      toValue: 0.98,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start()
  }, [searchBarScale])

  const handleSearchBarPressOut = useCallback(() => {
    Animated.spring(searchBarScale, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start()
  }, [searchBarScale])

  const handleSearchBarPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    searchInputRef.current?.focus()
  }, [])

  // Handle category selection (toggle - tap again to deselect)
  const handleCategoryPress = useCallback((category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Toggle: if already selected, clear it (set to 'All')
    if (productFilters.category === category) {
      productFilterActions.setCategory('All')
    } else {
      productFilterActions.setCategory(category)
    }
  }, [productFilters.category])

  // Handle clear filters (for both tabs)
  const handleClearAllFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (activeTab === 'products') {
      productFilterActions.clearFilters()
    } else {
      posOrderFilterActions.clearFilters()
    }
  }, [activeTab])

  // Double-tap to close filter dropdown (consistent gesture pattern)
  const lastFilterTapRef = useRef<number>(0)
  const handleFilterDoubleTap = useCallback(() => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (now - lastFilterTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected - close dropdown
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setShowFilterDropdown(false)
      lastFilterTapRef.current = 0
    } else {
      lastFilterTapRef.current = now
    }
  }, [])

  // Handle order status group selection (toggle - tap again to deselect)
  const handleOrderStatusGroupPress = useCallback((group: POSOrderStatusGroup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Toggle: if already selected, reset to 'all'
    if (orderFilters.statusGroup === group) {
      posOrderFilterActions.setStatusGroup('all')
    } else {
      posOrderFilterActions.setStatusGroup(group)
    }
  }, [orderFilters.statusGroup])

  // Handle order type selection (toggle - tap again to deselect)
  const handleOrderTypePress = useCallback((type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Toggle: if already selected, reset to 'all'
    if (orderFilters.orderType === type) {
      posOrderFilterActions.setOrderType('all')
    } else {
      posOrderFilterActions.setOrderType(type)
    }
  }, [orderFilters.orderType])

  // Dynamic positioning with safe area insets
  // Content starts immediately after safe area - no extra padding
  const searchBarContainerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: insets.top,  // No extra padding - starts right at safe area
    left: Math.max(layout.pos.searchBarLeft, insets.left),
    right: Math.max(layout.pos.searchBarRight, insets.right),
    zIndex: 1001, // Above filter overlay (999) and dropdown (1000)
  }), [insets.top, insets.left, insets.right])

  // Handle layout to get actual container width
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout
    setContainerWidth(width)
    containerWidthRef.current = width
  }, [])

  // Navigate to tab
  const navigateToTab = useCallback((tab: Tab) => {
    if (containerWidth === 0) return

    const toValue = tab === 'products' ? 0 : -containerWidth

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    Animated.spring(translateX, {
      toValue,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start()

    setActiveTab(tab)
  }, [translateX, containerWidth])

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to significant horizontal swipes
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
      },
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      },
      onPanResponderMove: (_, gestureState) => {
        // Use ref for current width
        const width = containerWidthRef.current || 800

        // Calculate constrained position
        const baseOffset = activeTabRef.current === 'products' ? 0 : -width
        let newX = baseOffset + gestureState.dx

        // Add resistance at edges
        if (newX > 0) {
          newX = newX * 0.3
        } else if (newX < -width) {
          newX = -width + (newX + width) * 0.3
        }

        translateX.setValue(newX)
      },
      onPanResponderRelease: (_, gestureState) => {
        const width = containerWidthRef.current || 800
        const { dx, vx } = gestureState
        const SWIPE_THRESHOLD = width * 0.2
        const VELOCITY_THRESHOLD = 0.3

        // Determine target based on gesture
        let targetTab: Tab = activeTabRef.current

        if (activeTabRef.current === 'products') {
          // Currently on products - swipe left to go to orders
          if (dx < -SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD) {
            targetTab = 'orders'
          }
        } else {
          // Currently on orders - swipe right to go to products
          if (dx > SWIPE_THRESHOLD || vx > VELOCITY_THRESHOLD) {
            targetTab = 'products'
          }
        }

        // Animate to target
        const toValue = targetTab === 'products' ? 0 : -width

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        Animated.spring(translateX, {
          toValue,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }).start()

        setActiveTab(targetTab)
      },
    })
  ).current

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.slidingContainer,
            {
              width: containerWidth * 2,
              transform: [{ translateX }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Products View */}
          <View style={{ width: containerWidth, height: '100%' }}>
            <POSProductBrowser />
          </View>

          {/* Orders View */}
          <View style={{ width: containerWidth, height: '100%' }}>
            <POSOrderFeed />
          </View>
        </Animated.View>
      )}

      {/* Unified Search Bar - Fixed position above swipeable content */}
      <View style={searchBarContainerStyle}>
        <Pressable
          onPressIn={handleSearchBarPressIn}
          onPressOut={handleSearchBarPressOut}
          onPress={handleSearchBarPress}
          style={styles.unifiedSearchBar}
        >
          <Animated.View style={{ transform: [{ scale: searchBarScale }] }}>
            <LiquidGlassView
              key="pos-unified-search-bar"
              style={[
                styles.unifiedSearchBarPill,
                searchFocused && styles.unifiedSearchBarPillFocused,
                !isLiquidGlassSupported && styles.fallback,
              ]}
              effect="clear"
              colorScheme="dark"
            >
              {/* Tab Indicator - Shows current view */}
              <View style={styles.tabIndicator}>
                <Text style={[
                  styles.tabText,
                  activeTab === 'products' && styles.tabTextActive
                ]}>
                  Products
                </Text>
                <Text style={styles.tabDivider}>|</Text>
                <Text style={[
                  styles.tabText,
                  activeTab === 'orders' && styles.tabTextActive
                ]}>
                  Orders
                </Text>
              </View>

              {/* Search Icon */}
              <View style={styles.searchIconContainer}>
                <View style={[
                  styles.searchIconCircle,
                  searchFocused && styles.searchIconCircleFocused
                ]} />
                <View style={[
                  styles.searchIconHandle,
                  searchFocused && styles.searchIconHandleFocused
                ]} />
              </View>

              {/* Search Input */}
              <TextInput
                ref={searchInputRef}
                style={styles.unifiedSearchInput}
                placeholder={placeholder}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={searchQuery}
                onChangeText={handleSearchChange}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                accessibilityLabel={`Search ${activeTab}`}
                accessibilityRole="search"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="never"
              />

              {/* Clear Search Button */}
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearSearch}
                  style={styles.clearSearchButton}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.clearSearchIcon}>
                    <Text style={styles.clearSearchText}>×</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Customer/Scan Button - Right side of search bar */}
              <TouchableOpacity
                onPress={handleCustomerPress}
                onLongPress={handleCustomerLongPress}
                delayLongPress={400}
                style={selectedCustomer ? styles.customerButtonWithInfo : styles.customerButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={selectedCustomer ? `Customer: ${selectedCustomer.first_name}` : "Select customer or scan ID"}
                accessibilityHint={selectedCustomer ? "Tap to view profile, hold to clear" : "Tap to select customer"}
              >
                {selectedCustomer ? (
                  <View style={styles.customerButtonActive}>
                    <Text style={styles.customerButtonInitials} numberOfLines={1}>
                      {(selectedCustomer.first_name?.[0] || '').toUpperCase()}{(selectedCustomer.last_name?.[0] || '').toUpperCase()}
                    </Text>
                    {(selectedCustomer.loyalty_points ?? 0) > 0 && (
                      <Text style={styles.customerButtonPoints}>
                        {(selectedCustomer.loyalty_points ?? 0).toLocaleString()}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.customerButtonInactive}>
                    {/* Person icon - minimal line style */}
                    <View style={styles.personIconHead} />
                    <View style={styles.personIconBody} />
                  </View>
                )}
              </TouchableOpacity>
            </LiquidGlassView>
          </Animated.View>
        </Pressable>
      </View>

      {/* Filter Dropdown - Shows when search is focused */}
      {showFilterDropdown && (
        <>
          {/* Blur Overlay - Same as product/order modals */}
          <Animated.View
            style={[
              styles.filterOverlay,
              { opacity: filterDropdownAnim }
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowFilterDropdown(false)}
            >
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            </Pressable>
          </Animated.View>

          {/* Filter Dropdown Content */}
          <Animated.View
            style={[
              styles.filterDropdownWrapper,
              {
                top: insets.top + layout.pos.searchBarHeight + 8,
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
            {/* Double-tap anywhere on dropdown to close */}
            <Pressable onPress={handleFilterDoubleTap} style={styles.filterDropdownContainer}>
              {/* True Glass Background */}
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

              {/* Header with Clear button */}
              <View style={styles.filterHeader}>
                <Pressable
                  onPress={handleClearAllFilters}
                  style={styles.filterHeaderButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.filterHeaderButtonText}>Clear</Text>
                </Pressable>
                <Text style={styles.filterHeaderTitle}>
                  {activeTab === 'products' ? 'Filter Products' : 'Filter Orders'}
                </Text>
                {/* Empty spacer to balance layout */}
                <View style={styles.filterHeaderButton} />
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.filterScrollView}
                contentContainerStyle={styles.filterScrollContent}
              >
                {activeTab === 'products' ? (
                  <>
                    {/* Categories Section */}
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionLabel}>CATEGORY</Text>
                      <View style={styles.filterGroupContainer}>
                        {categories.map((category, index) => {
                          const isSelected = productFilters.category === category
                          const isFirst = index === 0
                          const isLast = index === categories.length - 1
                          return (
                            <Pressable
                              key={`filter-category-${category}`}
                              onPress={() => handleCategoryPress(category)}
                              style={[
                                styles.filterItemPressable,
                                isFirst && styles.filterItemFirst,
                                isLast && styles.filterItemLast,
                                isSelected && styles.filterItemSelected,
                              ]}
                            >
                              <Text style={styles.filterItemText}>{category}</Text>
                              {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                            </Pressable>
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
                            const isSelected = productFilters.strainTypes.includes(strainType)
                            const isFirst = index === 0
                            const isLast = index === availableStrainTypes.length - 1
                            return (
                              <Pressable
                                key={`filter-strain-${strainType}`}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                  productFilterActions.toggleStrainType(strainType)
                                }}
                                style={[
                                  styles.filterItemPressable,
                                  isFirst && styles.filterItemFirst,
                                  isLast && styles.filterItemLast,
                                  isSelected && styles.filterItemSelected,
                                ]}
                              >
                                <Text style={styles.filterItemText}>{strainType}</Text>
                                {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                              </Pressable>
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
                            const isSelected = productFilters.consistencies.includes(consistency)
                            const isFirst = index === 0
                            const isLast = index === availableConsistencies.length - 1
                            return (
                              <Pressable
                                key={`filter-consistency-${consistency}`}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                  productFilterActions.toggleConsistency(consistency)
                                }}
                                style={[
                                  styles.filterItemPressable,
                                  isFirst && styles.filterItemFirst,
                                  isLast && styles.filterItemLast,
                                  isSelected && styles.filterItemSelected,
                                ]}
                              >
                                <Text style={styles.filterItemText}>{consistency}</Text>
                                {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                              </Pressable>
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
                            const isSelected = productFilters.flavors.includes(flavor)
                            const isFirst = index === 0
                            const isLast = index === availableFlavors.length - 1
                            return (
                              <Pressable
                                key={`filter-flavor-${flavor}`}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                  productFilterActions.toggleFlavor(flavor)
                                }}
                                style={[
                                  styles.filterItemPressable,
                                  isFirst && styles.filterItemFirst,
                                  isLast && styles.filterItemLast,
                                  isSelected && styles.filterItemSelected,
                                ]}
                              >
                                <Text style={styles.filterItemText}>{flavor}</Text>
                                {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                              </Pressable>
                            )
                          })}
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {/* Order Status Group Section */}
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionLabel}>STATUS</Text>
                      <View style={styles.filterGroupContainer}>
                        {(['all', 'active', 'shipping', 'completed', 'cancelled', 'errors'] as const).map((group, index) => {
                          const isSelected = orderFilters.statusGroup === group
                          const isFirst = index === 0
                          const isLast = index === 5
                          const labels: Record<string, string> = {
                            all: 'All Orders',
                            active: 'Active',
                            shipping: 'Shipping',
                            completed: 'Completed',
                            cancelled: 'Cancelled',
                            errors: 'Errors',
                          }
                          return (
                            <Pressable
                              key={`filter-status-${group}`}
                              onPress={() => handleOrderStatusGroupPress(group)}
                              style={[
                                styles.filterItemPressable,
                                isFirst && styles.filterItemFirst,
                                isLast && styles.filterItemLast,
                                isSelected && styles.filterItemSelected,
                              ]}
                            >
                              <Text style={styles.filterItemText}>{labels[group]}</Text>
                              {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                            </Pressable>
                          )
                        })}
                      </View>
                    </View>

                    {/* Order Type Section */}
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionLabel}>ORDER TYPE</Text>
                      <View style={styles.filterGroupContainer}>
                        {(['all', 'walk_in', 'pickup', 'delivery', 'shipping'] as const).map((type, index) => {
                          const isSelected = orderFilters.orderType === type
                          const isFirst = index === 0
                          const isLast = index === 4
                          const labels: Record<string, string> = {
                            all: 'All Types',
                            walk_in: 'Walk-in',
                            pickup: 'Pickup',
                            delivery: 'Delivery',
                            shipping: 'Shipping',
                          }
                          return (
                            <Pressable
                              key={`filter-type-${type}`}
                              onPress={() => handleOrderTypePress(type)}
                              style={[
                                styles.filterItemPressable,
                                isFirst && styles.filterItemFirst,
                                isLast && styles.filterItemLast,
                                isSelected && styles.filterItemSelected,
                              ]}
                            >
                              <Text style={styles.filterItemText}>{labels[type]}</Text>
                              {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                            </Pressable>
                          )
                        })}
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </>
      )}

      {/* Global Order Modal Trigger - Hidden card that opens modal when selectedOrderId is set */}
      {/* This allows any component (e.g., POSCustomerMatchModal) to trigger order modal via ordersUIActions.selectOrder() */}
      {selectedOrder && (
        <POSOrderCard order={selectedOrder} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  slidingContainer: {
    flexDirection: 'row',
    height: '100%',
  },
  // Unified Search Bar Styles
  unifiedSearchBar: {
    alignSelf: 'stretch',
  },
  unifiedSearchBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.pos.searchBarHeight,
    borderRadius: layout.pos.searchBarHeight / 2,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  unifiedSearchBarPillFocused: {
    borderColor: 'rgba(255,255,255,0.35)',
  },
  fallback: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // Tab Indicator
  tabIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: -0.2,
  },
  tabTextActive: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  tabDivider: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.15)',
    marginHorizontal: 6,
  },
  // Search Icon
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
  searchIconCircleFocused: {
    borderColor: 'rgba(255,255,255,0.8)',
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
  searchIconHandleFocused: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  // Search Input
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
  // Clear Button
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
  // Customer Button - Right side of search bar
  customerButton: {
    width: 32,
    height: 32,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerButtonWithInfo: {
    height: 32,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerButtonActive: {
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  customerButtonInitials: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },
  customerButtonPoints: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  customerButtonInactive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personIconHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
  },
  personIconBody: {
    width: 12,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  // Filter Dropdown Styles - True Glass (same as product/order modals)
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  filterDropdownWrapper: {
    position: 'absolute',
    left: 8,
    right: 8,
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
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterHeaderButton: {
    minWidth: 60,
  },
  filterHeaderButtonText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.4,
  },
  filterHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.4,
  },
  filterHeaderDoneText: {
    fontWeight: '600',
    textAlign: 'right',
  },
  filterScrollView: {
    maxHeight: 460,
    backgroundColor: 'transparent',
  },
  filterScrollContent: {
    paddingVertical: 8,
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
  filterGroupContainer: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterItemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  filterItemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
