/**
 * ProductsListView Component
 * Apple Standard: Focused products list with iOS section index
 *
 * Handles:
 * - Products list rendering with A-Z sections
 * - iOS section index (A-Z scroller on right side)
 * - Large title header with vendor logo
 * - Empty states
 * - Fixed header with fade gradient
 */

import React, { useRef, useState, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image, Animated, PanResponder } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { ProductItem } from '@/components/products/list/ProductItem'
import { layout } from '@/theme/layout'
import { colors, spacing, radius } from '@/theme/tokens'
import type { Product } from '@/types/products'
import { useProductsScreenStore } from '@/stores/products-list.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { useCategories } from '@/hooks/useCategories'

interface ProductsListViewProps {
  products: Product[]
  vendorLogo?: string | null
  isLoading: boolean
}

export function ProductsListView({
  products,
  vendorLogo,
  isLoading,
}: ProductsListViewProps) {
  // Read from stores
  const activeNav = useProductsScreenStore(state => state.activeNav)
  const selectedProduct = useProductsScreenStore(state => state.selectedProduct)
  const selectProduct = useProductsScreenStore(state => state.selectProduct)
  const openModal = useProductsScreenStore(state => state.openModal)
  const { selectedLocationIds } = useLocationFilter()
  const { categories } = useCategories({ includeGlobal: true, parentId: null })

  // Compute category map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(cat => map.set(cat.id, cat.name))
    return map
  }, [categories])

  // Compute product sections (A-Z grouped)
  const productSections = useMemo((): [string, Product[]][] => {
    const grouped = products.reduce((acc, product) => {
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
  }, [products])

  // Handlers
  const onProductSelect = useCallback((product: Product) => {
    selectProduct(product)
  }, [selectProduct])

  const onAddProduct = useCallback(() => {
    openModal('createProduct')
  }, [openModal])

  // Location names (simplified - just show count for now)
  const selectedLocationNames = useMemo(() => {
    return selectedLocationIds.length > 0
      ? [`${selectedLocationIds.length} locations`]
      : ['All locations']
  }, [selectedLocationIds])
  // ========================================
  // SCROLL & HEADER STATE
  // ========================================
  const productsHeaderOpacity = useRef(new Animated.Value(0)).current
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
  // TITLE & LOADING
  // ========================================
  const title = activeNav === 'all' ? 'All Products' : activeNav === 'low-stock' ? 'Low Stock' : 'Out of Stock'

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
      {/* Fixed Header */}
      <Animated.View style={[styles.fixedHeader, { opacity: productsHeaderOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>{title}</Text>
      </Animated.View>

      {/* Fade Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <View style={styles.sectionListContainer}>
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={!showSectionIndex}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
          contentContainerStyle={{
            paddingTop: layout.contentStartTop,
            paddingBottom: layout.dockHeight,
            paddingRight: 0
          }}
          onScroll={(e) => {
            const offsetY = e.nativeEvent.contentOffset.y
            const threshold = 40
            productsHeaderOpacity.setValue(offsetY > threshold ? 1 : 0)
          }}
          scrollEventThrottle={16}
        >
          {/* Large Title */}
          <View style={styles.cardWrapper}>
            <View style={styles.titleSectionContainer}>
              <View style={styles.largeTitleContainer}>
                <View style={styles.titleWithLogo}>
                  {vendorLogo && (
                    <Image
                      source={{ uri: vendorLogo }}
                      style={styles.vendorLogoInline}
                      resizeMode="contain"
                      fadeDuration={0}
                    />
                  )}
                  <Text style={styles.largeTitleHeader}>{title}</Text>
                </View>
                {activeNav === 'all' && (
                  <Pressable
                    style={styles.addProductButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      onAddProduct()
                    }}
                  >
                    <Text style={styles.addProductButtonText}>Add Product</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          {/* Empty State */}
          {products.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>􀈂</Text>
              <Text style={styles.emptyStateTitle}>No Products Found</Text>
              <Text style={styles.emptyStateText}>
                {activeNav === 'low-stock'
                  ? 'No products with low stock levels'
                  : activeNav === 'out-of-stock'
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
                        const categoryName = item.primary_category_id
                          ? (categoryMap.get(item.primary_category_id) ?? null)
                          : null

                        return (
                          <ProductItem
                            key={item.id}
                            item={item}
                            isLast={isLast}
                            isSelected={selectedProduct?.id === item.id}
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
    </View>
  )
}

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
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop,
    left: 0,
    right: 0,
    height: layout.searchBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },
  sectionListContainer: {
    flex: 1,
    position: 'relative',
  },
  cardWrapper: {
    paddingHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  titleSectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  vendorLogoInline: {
    width: 80,
    height: 80,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  largeTitleHeader: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.8,
  },
  addProductButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addProductButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
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
