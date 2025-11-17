/**
 * Products Screen
 * iPad Settings-style interface with Liquid Glass
 */

import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image, TextInput, Animated, useWindowDimensions } from 'react-native'
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useProducts, type Product, type PricingTier } from '@/hooks/useProducts'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'
import { EditableDescriptionSection, EditablePricingSection, EditableCustomFieldsSection } from '@/components/products'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { CategoryCard, CategoryDetail, CategoryModal, CustomFieldModal, FieldVisibilityModal, PricingTemplateModal } from '@/components/categories'
import { useCategories } from '@/hooks/useCategories'
import { useCustomFields } from '@/hooks/useCustomFields'
import { usePricingTemplates } from '@/hooks/usePricingTemplates'

type NavSection = 'all' | 'low-stock' | 'out-of-stock' | 'categories'

// Memoized Product Item to prevent flickering
const ProductItem = React.memo<{
  item: Product
  isLast: boolean
  isSelected: boolean
  categoryName: string | null
  onPress: () => void
}>(({
  item,
  isLast,
  isSelected,
  categoryName,
  onPress
}) => (
  <Pressable
    key={item.id}
    style={[
      styles.productItem,
      isSelected && styles.productItemActive,
      isLast && styles.productItemLast,
    ]}
    onPress={onPress}
    accessibilityRole="none"
  >
    {/* Icon/Thumbnail */}
    <View style={styles.productIcon}>
      {item.featured_image ? (
        <Image
          source={{ uri: item.featured_image }}
          style={styles.productIconImage}
        />
      ) : (
        <View style={[styles.productIconPlaceholder, styles.productIconImage]}>
          <Text style={styles.productIconText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
    </View>

    {/* Product Name & Category */}
    <View style={styles.productInfo}>
      <Text style={styles.productName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.productSKU} numberOfLines={1}>
        {categoryName || 'Uncategorized'}
      </Text>
    </View>

    {/* Stock Column - Color Coded */}
    <View style={styles.dataColumn}>
      <Text style={styles.dataLabel}>STOCK</Text>
      <Text
        style={[
          styles.dataValue,
          styles.stockValue,
          (item.total_stock ?? 0) === 0 && styles.stockOut,
          (item.total_stock ?? 0) > 0 && (item.total_stock ?? 0) < 10 && styles.stockLow,
          (item.total_stock ?? 0) >= 10 && styles.stockOk,
        ]}
      >
        {item.total_stock ?? 0}g
      </Text>
    </View>

    {/* Locations Column */}
    <View style={styles.dataColumn}>
      <Text style={styles.dataLabel}>LOCATIONS</Text>
      <Text style={styles.dataValue}>
        {item.inventory?.length || 0}
      </Text>
    </View>
  </Pressable>
))

ProductItem.displayName = 'ProductItem'

export function ProductsScreen() {
  const { user } = useAuth()
  const [activeNav, setActiveNav] = useState<NavSection>('all')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [navSearchQuery, setNavSearchQuery] = useState('')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [vendorLogo, setVendorLogo] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState<string>('')

  // Modal states for categories
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showFieldModal, setShowFieldModal] = useState(false)
  const [showVisibilityModal, setShowVisibilityModal] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)

  // Sliding animation
  const slideAnim = useRef(new Animated.Value(0)).current // 0 = list view, 1 = detail view

  // Scroll tracking for collapsing headers - using Animated.Value for iOS-style smooth transitions
  const categoriesHeaderOpacity = useRef(new Animated.Value(0)).current
  const productsHeaderOpacity = useRef(new Animated.Value(0)).current

  const { width } = useWindowDimensions()
  const contentWidth = width - layout.sidebarWidth

  // Load all products without search - we'll filter client-side
  const { products: allProducts, isLoading, reload } = useProducts({ search: '' })
  const { categories, isLoading: categoriesLoading, reload: reloadCategories } = useCategories({ includeGlobal: true, parentId: null })

  // Create a category lookup map for fast access
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(cat => map.set(cat.id, cat.name))
    return map
  }, [categories])

  // Load all fields and templates for the vendor to properly count assignments
  const { fields: allFields, reload: reloadFields } = useCustomFields({ includeInherited: false })
  const { templates: allTemplates, reload: reloadTemplates } = usePricingTemplates({})

  // Load vendor info for nav bar logo
  useEffect(() => {
    const loadVendorInfo = async () => {
      if (!user?.email) return
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('vendor_id, vendors(id, store_name, logo_url)')
          .eq('email', user.email)
          .single()

        if (userError) {
          logger.error('User query error', { error: userError })
          return
        }

        if (userData?.vendors) {
          const vendor = userData.vendors as any
          setVendorName(vendor.store_name || '')
          setVendorLogo(vendor.logo_url || null)
        }
      } catch (error) {
        logger.error('Failed to load vendor info', { error })
      }
    }
    loadVendorInfo()
  }, [user])

  const handleProductUpdated = () => {
    reload()
  }

  const handleCategoryUpdated = () => {
    reloadCategories()
    reloadFields()
    reloadTemplates()
  }

  // Memoize product selection handler
  const handleProductSelect = useCallback((product: Product) => {
    setSelectedProduct(product)
  }, [])

  // Filter products based on active nav and search query (client-side)
  const products = useMemo(() => {
    return allProducts.filter(product => {
      // First filter by nav section
      if (activeNav === 'low-stock') {
        const stock = product.total_stock ?? 0
        if (!(stock > 0 && stock < 10)) return false
      } else if (activeNav === 'out-of-stock') {
        if ((product.total_stock ?? 0) !== 0) return false
      }

      // Then filter by search query
      if (productSearchQuery) {
        const searchLower = productSearchQuery.toLowerCase()
        const nameMatch = product.name.toLowerCase().includes(searchLower)
        const skuMatch = product.sku?.toLowerCase().includes(searchLower)
        const categoryMatch = product.primary_category_id
          ? categoryMap.get(product.primary_category_id)?.toLowerCase().includes(searchLower)
          : false

        return nameMatch || skuMatch || categoryMatch
      }

      return true
    })
  }, [allProducts, activeNav, productSearchQuery, categoryMap])

  // Calculate counts for badges
  const lowStockCount = allProducts.filter(p => {
    const stock = p.total_stock ?? 0
    return stock > 0 && stock < 10
  }).length

  const outOfStockCount = allProducts.filter(p => (p.total_stock ?? 0) === 0).length

  // Nav items configuration
  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'all',
      icon: 'grid',
      label: 'All Products',
      count: allProducts.length,
    },
    {
      id: 'low-stock',
      icon: 'warning',
      label: 'Low Stock',
      count: lowStockCount,
      badge: 'warning' as const,
    },
    {
      id: 'out-of-stock',
      icon: 'box',
      label: 'Out of Stock',
      count: outOfStockCount,
      badge: 'error' as const,
    },
    {
      id: 'categories',
      icon: 'folder',
      label: 'Categories',
    },
  ], [allProducts.length, lowStockCount, outOfStockCount])

  // Animate when product/category is selected/deselected
  useEffect(() => {
    const shouldSlide = activeNav === 'categories' ? selectedCategoryId !== null : selectedProduct !== null
    Animated.spring(slideAnim, {
      toValue: shouldSlide ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  }, [selectedProduct, selectedCategoryId, activeNav, slideAnim])

  // Filter categories by nav search
  const filteredCategories = useMemo(() => {
    if (!navSearchQuery || activeNav !== 'categories') return categories
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(navSearchQuery.toLowerCase())
    )
  }, [categories, navSearchQuery, activeNav])

  const selectedCategory = categories.find(c => c.id === selectedCategoryId)

  // Calculate field and template counts for selected category
  const categoryFieldsCount = selectedCategoryId
    ? allFields.filter(f => f.category_id === selectedCategoryId).length
    : 0

  const categoryTemplatesCount = selectedCategoryId
    ? allTemplates.filter(t =>
    // @ts-expect-error - category_id will be added in database schema migration
        t.applicable_to_categories?.includes(selectedCategoryId) || t.category_id === selectedCategoryId
      ).length
    : 0

  // Calculate translateX for sliding panels using actual content width
  const listTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -contentWidth], // Slides left off screen (full content width)
  })

  const detailTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [contentWidth, 0], // Slides in from right (full content width)
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        {/* LEFT NAV SIDEBAR */}
        <NavSidebar
          width={layout.sidebarWidth}
          searchValue={navSearchQuery}
          onSearchChange={setNavSearchQuery}
          items={navItems}
          activeItemId={activeNav}
          onItemPress={(id) => setActiveNav(id as NavSection)}
          userName={user?.email?.split('@')[0] || 'User'}
          vendorName={vendorName}
          vendorLogo={vendorLogo}
        />

        {/* SLIDING CONTENT AREA */}
        <View style={styles.contentArea}>
          {/* MIDDLE LIST - Products or Categories */}
        <Animated.View
          style={[
            styles.productsList,
            {
              transform: [{ translateX: listTranslateX }],
            },
          ]}
        >
          {activeNav === 'categories' ? (
            // CATEGORIES VIEW
            categoriesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.text.secondary} />
              </View>
            ) : filteredCategories.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>􀈄</Text>
                <Text style={styles.emptyStateTitle}>No Categories</Text>
                <Text style={styles.emptyStateText}>
                  {navSearchQuery ? 'Try adjusting your search' : 'Create your first category to get started'}
                </Text>
                {!navSearchQuery && (
                  <Pressable
                    style={styles.emptyStateButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowCategoryModal(true)
                    }}
                  >
                    <Text style={styles.emptyStateButtonText}>+ Add Category</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.productsListContent}>
                {/* Fixed Header - appears on scroll */}
                <Animated.View style={[styles.fixedHeader, { opacity: categoriesHeaderOpacity }]}>
                  <Text style={styles.fixedHeaderTitle}>Categories</Text>
                </Animated.View>

                {/* Fade Gradient */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
                  style={styles.fadeGradient}
                  pointerEvents="none"
                />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingTop: 80, paddingBottom: layout.dockHeight }}
                  onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y
                    const threshold = 40
                    // Instant transition like iOS
                    categoriesHeaderOpacity.setValue(offsetY > threshold ? 1 : 0)
                  }}
                  scrollEventThrottle={16}
                >
                  {/* Large Title - scrolls with content */}
                  <View style={[styles.largeTitleContainer, styles.cardWrapper]}>
                    <Text style={styles.largeTitleHeader}>Categories</Text>
                    <Pressable
                      style={styles.addButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setShowCategoryModal(true)
                      }}
                    >
                      <Text style={styles.addButtonText}>+</Text>
                    </Pressable>
                  </View>

                  <View style={styles.cardWrapper}>
                    <View style={styles.productsCardGlass}>
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
                              setSelectedCategoryId(category.id)
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
          ) : (
            // PRODUCTS VIEW
            isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.text.secondary} />
              </View>
            ) : products.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>􀈄</Text>
                <Text style={styles.emptyStateTitle}>No Products Found</Text>
                <Text style={styles.emptyStateText}>
                  {activeNav === 'low-stock'
                    ? 'No products with low stock levels'
                    : activeNav === 'out-of-stock'
                    ? 'No products are out of stock'
                    : productSearchQuery
                    ? 'Try adjusting your search'
                    : 'No products available'}
                </Text>
              </View>
            ) : (
              <View style={styles.productsListContent}>
                {/* Fixed Header - appears on scroll */}
                <Animated.View style={[styles.fixedHeader, { opacity: productsHeaderOpacity }]}>
                  <Text style={styles.fixedHeaderTitle}>
                    {activeNav === 'all' ? 'All Products' : activeNav === 'low-stock' ? 'Low Stock' : 'Out of Stock'}
                  </Text>
                </Animated.View>

                {/* Fade Gradient */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
                  style={styles.fadeGradient}
                  pointerEvents="none"
                />

                {/* Sticky Search Bar - Top Right - Above Fade */}
                <View style={styles.stickySearchContainer}>
                  <LiquidGlassView
                    effect="regular"
                    colorScheme="dark"
                    style={[styles.stickySearchBar, !isLiquidGlassSupported && styles.stickySearchBarFallback]}
                    accessible={false}
                  >
                    <View style={styles.stickySearchInner} accessible={false}>
                      <View style={styles.searchIconContainer}>
                        <View style={styles.searchIconCircle} />
                        <View style={styles.searchIconHandle} />
                      </View>
                      <TextInput
                        style={styles.stickySearchInput}
                        placeholder="Search"
                        placeholderTextColor="rgba(235,235,245,0.6)"
                        value={productSearchQuery}
                        onChangeText={setProductSearchQuery}
                        accessible={true}
                        accessibilityLabel="Search products"
                        accessibilityHint="Type to filter the products list"
                      />
                    </View>
                  </LiquidGlassView>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingTop: 80, paddingBottom: layout.dockHeight }}
                  onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y
                    const threshold = 40
                    // Instant transition like iOS
                    productsHeaderOpacity.setValue(offsetY > threshold ? 1 : 0)
                  }}
                  scrollEventThrottle={16}
                >
                  {/* Large Title - scrolls with content */}
                  <View style={styles.cardWrapper}>
                    <Text style={styles.largeTitleHeader}>
                      {activeNav === 'all' ? 'All Products' : activeNav === 'low-stock' ? 'Low Stock' : 'Out of Stock'}
                    </Text>
                  </View>

                  <View style={styles.cardWrapper}>
                  <View style={styles.productsCardGlass}>
                    {products.map((item, index) => {
                    const isLast = index === products.length - 1
                    const categoryName = item.primary_category_id ? (categoryMap.get(item.primary_category_id) ?? null) : null

                    return (
                      <ProductItem
                        key={item.id}
                        item={item}
                        isLast={isLast}
                        isSelected={selectedProduct?.id === item.id}
                        categoryName={categoryName}
                        onPress={() => handleProductSelect(item)}
                      />
                    )
                  })}
                  </View>
                </View>
                </ScrollView>
              </View>
            )
          )}
        </Animated.View>

        {/* RIGHT DETAIL PANEL */}
        <Animated.View
          style={[
            styles.detailPanel,
            {
              transform: [{ translateX: detailTranslateX }],
            },
          ]}
        >
          {activeNav === 'categories' ? (
            // Category Detail
            selectedCategory ? (
              <CategoryDetail
                category={selectedCategory}
                onBack={() => setSelectedCategoryId(null)}
                onCategoryUpdated={handleCategoryUpdated}
                fieldsCount={categoryFieldsCount}
                templatesCount={categoryTemplatesCount}
              />
            ) : (
              <View style={styles.emptyDetail}>
                <Text style={styles.emptyTitle}>Select a category</Text>
                <Text style={styles.emptyText}>Choose a category from the list to view details</Text>
              </View>
            )
          ) : (
            // Product Detail
            selectedProduct ? (
              <ProductDetail product={selectedProduct} onBack={() => setSelectedProduct(null)} onProductUpdated={handleProductUpdated} />
            ) : (
              <View style={styles.emptyDetail}>
                <Text style={styles.emptyTitle}>Select a product</Text>
                <Text style={styles.emptyText}>
                  Choose a product from the list to view details
                </Text>
              </View>
            )
          )}
        </Animated.View>
      </View>
      </View>

      {/* CATEGORY MODALS */}
      <CategoryModal
        visible={showCategoryModal}
        categories={categories}
        onClose={() => setShowCategoryModal(false)}
        onSaved={() => {
          reloadCategories()
          setShowCategoryModal(false)
        }}
      />

      {selectedCategoryId && (
        <>
          <CustomFieldModal
            visible={showFieldModal}
            categoryId={selectedCategoryId}
            onClose={() => setShowFieldModal(false)}
            onSaved={() => {
              reloadFields()
              setShowFieldModal(false)
            }}
          />

          <PricingTemplateModal
            visible={showPricingModal}
            categoryId={selectedCategoryId}
            onClose={() => setShowPricingModal(false)}
            onSaved={() => {
              reloadTemplates()
              setShowPricingModal(false)
            }}
          />
        </>
      )}
    </SafeAreaView>
  )
}

function ProductDetail({ product, onBack, onProductUpdated }: { product: Product; onBack: () => void; onProductUpdated: () => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()

  // Edit state
  const [editedName, setEditedName] = useState(product.name)
  const [editedSKU, setEditedSKU] = useState(product.sku || '')
  const [editedDescription, setEditedDescription] = useState(product.description || '')
  const [editedPrice, setEditedPrice] = useState(product.price?.toString() || product.regular_price?.toString() || '')
  const [editedCostPrice, setEditedCostPrice] = useState(product.cost_price?.toString() || '')
  const [pricingMode, setPricingMode] = useState<'single' | 'tiered'>(product.pricing_data?.mode || 'single')
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(product.pricing_data?.tiers || [])
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(product.pricing_data?.template_id || null)
  const [editedCustomFields, setEditedCustomFields] = useState<Record<string, any>>(product.custom_fields || {})

  const displayPrice = product.price || product.regular_price || 0
  const hasMultipleLocations = (product.inventory?.length || 0) > 1

  // Load pricing templates when entering edit mode
  useEffect(() => {
    if (isEditing && product.primary_category_id) {
      loadPricingTemplates(product.primary_category_id)
    }
  }, [isEditing, product.primary_category_id])

  const loadPricingTemplates = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('pricing_tier_templates')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setAvailableTemplates(data || [])
    } catch (error) {
      logger.error('Failed to load pricing templates:', error)
    }
  }

  const handleSave = async () => {
    if (!user?.email) return

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

      const pricingData = {
        mode: pricingMode,
        single_price: pricingMode === 'single' ? parseFloat(editedPrice) || null : null,
        tiers: pricingMode === 'tiered' ? pricingTiers : undefined,
        template_id: selectedTemplateId,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: editedName,
          sku: editedSKU,
          description: editedDescription,
          price: parseFloat(editedPrice) || null,
          regular_price: parseFloat(editedPrice) || null,
          cost_price: parseFloat(editedCostPrice) || null,
          pricing_data: pricingData,
          custom_fields: editedCustomFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .eq('vendor_id', userData.vendor_id)

      if (updateError) throw updateError

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setIsEditing(false)
      // Trigger parent reload
      onProductUpdated()
    } catch (error) {
      logger.error('Failed to save product:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Reset to original values
    setEditedName(product.name)
    setEditedSKU(product.sku || '')
    setEditedDescription(product.description || '')
    setEditedPrice(product.price?.toString() || product.regular_price?.toString() || '')
    setEditedCostPrice(product.cost_price?.toString() || '')
    setPricingMode(product.pricing_data?.mode || 'single')
    setPricingTiers(product.pricing_data?.tiers || [])
    setSelectedTemplateId(product.pricing_data?.template_id || null)
    setEditedCustomFields(product.custom_fields || {})
    setIsEditing(false)
  }

  return (
    <ScrollView style={styles.detail} contentContainerStyle={{ paddingBottom: layout.dockHeight }}>
      {/* Header with Edit/Save toggle */}
      <View style={styles.detailHeader}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>􀆉 Products</Text>
        </Pressable>

        {isEditing ? (
          <View style={styles.editActions}>
            <Pressable onPress={handleCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.saveButton} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#60A5FA" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setIsEditing(true)
          }} style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {/* Header Card - Edit mode or view mode */}
      <View style={styles.headerCardContainer}>
        <View style={styles.headerCardGlass}>
          <View style={styles.headerCard}>
            {product.featured_image ? (
              <Image source={{ uri: product.featured_image }} style={styles.headerIcon} />
            ) : (
              <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                <Text style={styles.headerIconText}>
                  {(isEditing ? editedName : product.name).charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              {isEditing ? (
                <>
                  <TextInput
                    style={styles.headerTitleInput}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Product name"
                    placeholderTextColor="rgba(235,235,245,0.3)"
                  />
                  <TextInput
                    style={styles.headerSubtitleInput}
                    value={editedSKU}
                    onChangeText={setEditedSKU}
                    placeholder="SKU"
                    placeholderTextColor="rgba(235,235,245,0.3)"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.headerTitle}>{product.name}</Text>
                  <View style={styles.headerMeta}>
                    <Text style={styles.headerSubtitle}>{product.sku || 'No SKU'}</Text>
                    {product.status && (
                      <>
                        <Text style={styles.headerDot}>•</Text>
                        <Text style={[
                          styles.headerSubtitle,
                          product.status === 'published' && styles.statusTextPublished
                        ]}>
                          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                        </Text>
                      </>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Pricing Section */}
      <EditablePricingSection
        price={product.price}
        costPrice={product.cost_price}
        salePrice={product.sale_price}
        onSale={product.on_sale}
        pricingMode={pricingMode}
        pricingTiers={pricingTiers}
        templateId={selectedTemplateId}
        isEditing={isEditing}
        editedPrice={editedPrice}
        editedCostPrice={editedCostPrice}
        onPriceChange={setEditedPrice}
        onCostPriceChange={setEditedCostPrice}
        onPricingModeChange={setPricingMode}
        onTiersChange={setPricingTiers}
        onTemplateChange={setSelectedTemplateId}
        categoryId={product.primary_category_id}
        availableTemplates={availableTemplates}
        loadTemplates={loadPricingTemplates}
      />

      {/* Inventory Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INVENTORY</Text>
        <View style={styles.cardGlass}>
          <View style={styles.inventoryHeader}>
            <Text style={styles.rowLabel}>Total Stock</Text>
            <Text style={[
              styles.inventoryTotal,
              (product.total_stock ?? 0) === 0 && styles.stockOut,
              (product.total_stock ?? 0) > 0 && (product.total_stock ?? 0) < 10 && styles.stockLow,
              (product.total_stock ?? 0) >= 10 && styles.stockOk,
            ]}>
              {product.total_stock ?? 0}g
            </Text>
          </View>

          {/* Multi-location breakdown */}
          {hasMultipleLocations && product.inventory && (
            <View style={styles.locationBreakdown}>
              <View style={styles.locationDivider} />
              {product.inventory.map((inv, index) => (
                <View key={inv.location_id} style={styles.locationRow}>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{inv.location_name}</Text>
                    <View style={styles.locationBar}>
                      <View
                        style={[
                          styles.locationBarFill,
                          { width: `${((inv.quantity || 0) / (product.total_stock || 1)) * 100}%` }
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.locationStock}>{inv.quantity || 0}g</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Description */}
      <EditableDescriptionSection
        description={product.description}
        editedDescription={editedDescription}
        isEditing={isEditing}
        onChangeText={setEditedDescription}
      />

      {/* Custom Fields */}
      <EditableCustomFieldsSection
        customFields={product.custom_fields}
        editedCustomFields={editedCustomFields}
        isEditing={isEditing}
        onCustomFieldsChange={setEditedCustomFields}
      />

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIONS</Text>
        <View style={styles.cardGlass}>
          <SettingsRow label="Adjust Inventory" />
          <SettingsRow label="View Sales History" />
          {hasMultipleLocations && <SettingsRow label="Transfer Stock" />}
        </View>
      </View>
    </ScrollView>
  )
}

function SettingsRow({
  label,
  value,
  showChevron = true,
  onPress,
}: {
  label: string
  value?: string
  showChevron?: boolean
  onPress?: () => void
}) {
  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  return (
    <Pressable style={styles.row} onPress={handlePress} disabled={!onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {showChevron && <Text style={styles.rowChevron}>􀆊</Text>}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  // Content area - Contains sliding panels
  contentArea: {
    flex: 1,
    overflow: 'hidden',
  },

  // Sticky Search Bar - Top Right (matches nav bar size)
  stickySearchContainer: {
    position: 'absolute',
    top: layout.cardPadding,
    right: layout.cardPadding,
    zIndex: 30, // Above fade gradient (10) and fixed header (20)
    elevation: 30,
    width: 260,
  },
  stickySearchBar: {
    borderRadius: layout.pillRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
    minHeight: layout.minTouchTarget,
  },
  stickySearchBarFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  stickySearchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  searchIconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconCircle: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: 'rgba(235,235,245,0.6)',
  },
  searchIconHandle: {
    width: 5,
    height: 1.5,
    backgroundColor: 'rgba(235,235,245,0.6)',
    position: 'absolute',
    bottom: 0.5,
    right: 0.5,
    transform: [{ rotate: '45deg' }],
  },
  stickySearchInput: {
    flex: 1,
    fontSize: 17,
    color: '#fff',
    letterSpacing: -0.4,
  },

  // iOS Collapsing Headers
  fixedHeader: {
    position: 'absolute',
    top: layout.cardPadding, // Align with search bar top position
    left: 0,
    right: 0,
    height: layout.minTouchTarget, // Match search bar height
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Above fade gradient
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
    height: 120,
    zIndex: 10,
  },
  largeTitleHeader: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    paddingTop: 16,
    paddingBottom: 8,
  },
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
  },

  // MIDDLE PRODUCTS LIST
  productsList: {
    position: 'absolute',
    left: 0, // No left padding - navbar margin handles it
    top: 0,
    bottom: 0,
    right: layout.containerMargin, // Match navbar's right margin (12px)
    backgroundColor: '#000',
  },
  productsListContent: {
    flex: 1,
  },
  cardWrapper: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginVertical: layout.contentVertical,
  },
  productsCardContainer: {
    marginHorizontal: layout.contentHorizontal,
  },
  productsCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Solid glass effect for smooth scrolling
  },
  productItem: {
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
  productItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  productItemLast: {
    borderBottomWidth: 0,
  },
  productIcon: {
    width: 44,
    height: 44,
  },
  productIconImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  productIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIconText: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.6)',
  },
  productInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  productSKU: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  // Data Columns
  dataColumn: {
    minWidth: 80,
    alignItems: 'flex-end',
    gap: 2,
  },
  dataLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },

  // Stock Color Coding
  stockValue: {
    fontVariant: ['tabular-nums'],
  },
  stockOut: {
    color: '#ff3b30',
  },
  stockLow: {
    color: '#ff9500',
  },
  stockOk: {
    color: '#34c759',
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyStateIcon: {
    fontSize: 64,
    color: 'rgba(235,235,245,0.2)',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(235,235,245,0.8)',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },

  // RIGHT DETAIL PANEL
  detailPanel: {
    position: 'absolute',
    left: 0, // No left padding - navbar margin handles it
    top: 0,
    bottom: 0,
    right: layout.containerMargin, // Match navbar's right margin (12px)
    backgroundColor: '#000',
  },
  emptyDetail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
  },

  // DETAIL CONTENT
  detail: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    paddingVertical: layout.cardPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  editButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  saveButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  headerCardContainer: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginTop: layout.sectionSpacing,
    marginBottom: layout.sectionSpacing,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.cardPadding,
    gap: layout.cardPadding,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 28,
    color: 'rgba(235,235,245,0.6)',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerTitleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  headerSubtitleInput: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.9)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerDot: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.3)',
  },
  statusTextPublished: {
    color: '#34c759',
  },

  // SECTIONS
  section: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.cardPadding,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  rowChevron: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.3)',
  },
  descriptionContainer: {
    padding: 16,
  },
  descriptionText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    lineHeight: 22,
  },

  // Inventory
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  inventoryTotal: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Location Breakdown
  locationBreakdown: {
    paddingTop: 8,
  },
  locationDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 16,
  },
  locationInfo: {
    flex: 1,
    gap: 6,
  },
  locationName: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.9)',
    letterSpacing: -0.1,
  },
  locationBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  locationBarFill: {
    height: '100%',
    backgroundColor: '#34c759',
    borderRadius: 2,
  },
  locationStock: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.2,
    minWidth: 50,
    textAlign: 'right',
  },

  // Pricing Tiers
  pricingModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tierCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tiersContainer: {
    paddingVertical: 8,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  tierInfo: {
    flex: 1,
    gap: 2,
  },
  tierWeight: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.9)',
    letterSpacing: -0.2,
  },
  tierQty: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.1,
  },
  tierPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: -0.3,
    minWidth: 70,
    textAlign: 'right',
  },

  // Custom Fields
  customFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  customFieldRowLast: {
    borderBottomWidth: 0,
  },
  customFieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.1,
    flex: 1,
  },
  customFieldValue: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.9)',
    letterSpacing: -0.1,
    flex: 1,
    textAlign: 'right',
  },

  // Categories Section
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  listHeaderTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
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

  // CATEGORY LIST ITEMS (matching product list style)
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
})
