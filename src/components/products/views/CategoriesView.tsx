/**
 * CategoriesView Component
 * Apple Standard: Focused view for category management
 *
 * Handles:
 * - Category list display
 * - Category selection
 * - Add category button
 * - Empty states
 */

import React, { useState, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { layout } from '@/theme/layout'
import { spacing, radius, colors } from '@/theme/tokens'

interface Category {
  id: string
  name: string
  description?: string | null
  product_count?: number
}

interface CategoriesViewProps {
  categories: Category[]
  selectedCategoryId: string | null
  onCategorySelect: (categoryId: string) => void
  onAddCategory: () => void
  isLoading: boolean
  vendorLogo?: string | null
  searchQuery?: string
}

export function CategoriesView({
  categories,
  selectedCategoryId,
  onCategorySelect,
  onAddCategory,
  isLoading,
  vendorLogo,
  searchQuery = '',
}: CategoriesViewProps) {
  const headerOpacity = useRef(new Animated.Value(0)).current

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories
    const lowerSearch = searchQuery.toLowerCase()
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(lowerSearch) ||
      cat.description?.toLowerCase().includes(lowerSearch)
    )
  }, [categories, searchQuery])

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.text.secondary} />
      </View>
    )
  }

  if (filteredCategories.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateIcon}>􀈄</Text>
        <Text style={styles.emptyStateTitle}>No Categories</Text>
        <Text style={styles.emptyStateText}>
          {searchQuery ? 'Try adjusting your search' : 'Create your first category to get started'}
        </Text>
        {!searchQuery && (
          <Pressable
            style={styles.emptyStateButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onAddCategory()
            }}
          >
            <Text style={styles.emptyStateButtonText}>+ Add Category</Text>
          </Pressable>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Categories</Text>
      </Animated.View>

      {/* Fade Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
        contentContainerStyle={{
          paddingTop: layout.contentStartTop,
          paddingBottom: layout.dockHeight,
          paddingRight: 0,
        }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
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
                <Text style={styles.largeTitleHeader}>Categories</Text>
              </View>
              <Pressable
                style={styles.addButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onAddCategory()
                }}
              >
                <Text style={styles.addButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Categories List */}
        <View style={styles.cardWrapper}>
          <View style={styles.categoriesCardGlass}>
            {filteredCategories.map((category, index) => {
              const isLast = index === filteredCategories.length - 1
              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    selectedCategoryId === category.id && styles.categoryItemActive,
                    isLast && styles.categoryItemLast,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onCategorySelect(category.id)
                  }}
                >
                  {/* Icon */}
                  <View style={styles.categoryIcon}>
                    <Text style={styles.categoryIconText}>
                      {category.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* Category Name & Description */}
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {category.name}
                    </Text>
                    {category.description && (
                      <Text style={styles.categoryDescription} numberOfLines={1}>
                        {category.description}
                      </Text>
                    )}
                  </View>

                  {/* Product Count Badge */}
                  {category.product_count !== undefined && category.product_count > 0 && (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{category.product_count}</Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

// ========================================
// STYLES
// ========================================
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
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
  emptyStateButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
  },
  emptyStateButtonText: {
    fontSize: 15,
    color: '#60A5FA',
    fontWeight: '600',
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: '#60A5FA',
    fontWeight: '300',
  },
  categoriesCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    gap: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: layout.minTouchTarget,
  },
  categoryItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  categoryItemLast: {
    borderBottomWidth: 0,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.6)',
  },
  categoryInfo: {
    flex: 1,
    gap: 2,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  categoryDescription: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
  },
  categoryBadge: {
    minWidth: 24,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
})
