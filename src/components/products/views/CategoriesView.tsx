/**
 * CategoriesView Component - REFACTORED
 * Apple Standard: Focused view for category management
 *
 * ZERO PROP DRILLING:
 * - Reads from useCategories hook
 * - Reads from products-list.store for state
 * - Reads from AppAuthContext for vendor
 * - Calls store actions directly
 */

import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native'
import * as Haptics from 'expo-haptics'
import { layout } from '@/theme/layout'
import { spacing, radius, colors } from '@/theme/tokens'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useCategories } from '@/hooks/useCategories'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'
import { TitleSection } from '@/components/shared'
import { getIconImage } from '@/utils/image-transforms'

/**
 * CategoriesView - ZERO PROPS ✅
 * Reads all state from stores and hooks
 */
export function CategoriesView() {
  // ========================================
  // STORES - TRUE ZERO PROPS
  // ========================================
  const { vendor } = useAppAuth()
  const searchQuery = useProductsScreenStore((state) => state.searchQuery)
  const selectedCategoryId = useProductsScreenStore((state) => state.selectedCategoryId)
  const { categories, isLoading } = useCategories({ includeGlobal: true, parentId: null })

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories
    const lowerSearch = searchQuery.toLowerCase()
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(lowerSearch) ||
      cat.description?.toLowerCase().includes(lowerSearch)
    )
  }, [categories, searchQuery])

  // Handle category selection
  const handleCategorySelect = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productsScreenActions.selectCategory(categoryId)
  }

  // Handle add category
  const handleAddCategory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productsScreenActions.openModal('createCategory')
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.text.secondary} />
      </View>
    )
  }

  if (filteredCategories.length === 0) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
        contentContainerStyle={{
          paddingBottom: layout.dockHeight,
          paddingRight: 0,
        }}
      >
          {/* Title Section */}
          <TitleSection
            title="Categories"
            logo={vendor?.logo_url}
            buttonText="+ New Category"
            onButtonPress={handleAddCategory}
            buttonAccessibilityLabel="Create new category"
          />

          {/* Empty State */}
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Categories</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try adjusting your search' : 'Categories will appear here once created'}
            </Text>
          </View>
        </ScrollView>
    )
  }

  return (
      <ScrollView
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
        contentContainerStyle={{
          paddingBottom: layout.dockHeight,
          paddingRight: 0,
        }}
      >
        {/* Title Section */}
        <TitleSection
          title="Categories"
          logo={vendor?.logo_url}
          buttonText="+ New Category"
          onButtonPress={handleAddCategory}
          buttonAccessibilityLabel="Create new category"
        />

        {/* Categories List */}
        <View style={styles.cardWrapper}>
          <View style={styles.categoriesCard}>
            {filteredCategories.map((category, index) => {
              const isSelected = selectedCategoryId === category.id
              const isLast = index === filteredCategories.length - 1

              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemActive,
                    isLast && styles.categoryItemLast,
                  ]}
                  onPress={() => handleCategorySelect(category.id)}
                  accessibilityRole="button"
                >
                  {/* Category Image/Icon - Apple Music Style */}
                  {category.featured_image ? (
                    <Image
                      source={{ uri: getIconImage(category.featured_image) || category.featured_image }}
                      style={styles.categoryIconImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.categoryIconPlaceholder, styles.categoryIconImage]}>
                      <Text style={styles.categoryIconText}>
                        {category.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {/* Category Name & Description */}
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {category.name}
                    </Text>
                    <Text style={styles.categoryDescription} numberOfLines={1}>
                      {category.description || 'No description'}
                    </Text>
                  </View>

                  {/* Product Count */}
                  <View style={styles.countColumn}>
                    <Text style={styles.countLabel}>PRODUCTS</Text>
                    <Text style={styles.countValue}>
                      {category.product_count || 0}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
      </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.huge,
    paddingVertical: 80,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  cardWrapper: {
    paddingHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  // Apple Music Style Card - Matches ProductsListView
  categoriesCard: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  // Apple Music Style List Items
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6, // Small vertical padding - Apple Music style
    paddingLeft: 12, // Small left padding for album art spacing
    paddingRight: layout.rowPaddingHorizontal,
    gap: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: 72,
  },
  categoryItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  categoryItemLast: {
    borderBottomWidth: 0,
  },
  // Apple Music Style Icon/Image
  categoryIconImage: {
    width: 60, // Slightly smaller to account for padding
    height: 60,
    borderRadius: 8, // iOS rounded corners - Apple Music style
  },
  categoryIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  // Category Info Section
  categoryInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
    paddingVertical: 0,
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
    textTransform: 'uppercase',
  },
  // Count Column (matches product data columns)
  countColumn: {
    minWidth: 100,
    alignItems: 'flex-end',
  },
  countLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  countValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
})
