import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, Modal, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useState, useRef, memo, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react'

// Stores (ZERO PROP DRILLING - Apple Engineering Standard)
import { cartActions, useCartItems } from '@/stores/cart.store'
import { useProductFilters } from '@/stores/product-filter.store'
import { useTierSelectorProductId, checkoutUIActions } from '@/stores/checkout-ui.store'

// Utils
import { getMatchingFilters } from '@/utils/product-transformers'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { getMediumImage } from '@/utils/image-transforms'

import { layout } from '@/theme/layout'
import type { Product, ProductVariant } from '@/types/pos'

const { width } = Dimensions.get('window')
// Jobs Principle: 3-column grid accounting for cart sidebar
// ✅ FIXED: Layout matches iPad Settings: 320px cart + product area
// Product area: 8px left padding + cards + 20px right padding
// Cards: 3 columns with 16px gaps between them
const cartWidth = layout.sidebarWidth // ✅ FIXED: Use layout constant (320px, not hardcoded 375px)
const productGridPadding = 8 + 20 // Left (8px) + right (20px) padding
const gapsBetweenCards = 16 * 2 // 2 gaps for 3 columns (16px each)
const totalUsedWidth = cartWidth + productGridPadding + gapsBetweenCards
const cardWidth = (width - totalUsedWidth) / 3

interface PricingTier {
  qty: number
  price: string | number
  weight?: string
  label?: string
}

interface POSProductCardProps {
  product: Product
}

const POSProductCard = forwardRef<any, POSProductCardProps>(({ product }, ref) => {
  // ✅ ZERO PROP DRILLING: Read all state from stores
  const filters = useProductFilters()
  const tierSelectorProductId = useTierSelectorProductId()
  const cartItems = useCartItems()
  const insets = useSafeAreaInsets()

  // ✅ ANTI-LOOP: Compute matching filters for this product with useMemo (NOT in selector)
  const matchingFilters = useMemo(() =>
    getMatchingFilters(product, filters),
    [product, filters]
  )
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [availableVariants, setAvailableVariants] = useState<ProductVariant[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [variantTiers, setVariantTiers] = useState<PricingTier[]>([])
  const [loadingVariantTiers, setLoadingVariantTiers] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const modalSlideAnim = useRef(new Animated.Value(600)).current
  const modalOpacity = useRef(new Animated.Value(0)).current

  // SINGLE SOURCE OF TRUTH: Read from live pricing template
  const productTiers = product.pricing_template?.default_tiers?.map(t => ({
    break_id: t.id,
    label: t.label,
    qty: t.quantity,
    price: t.default_price,
    sort_order: t.sort_order,
  })) || []

  // Use variant tiers if variant is selected and has custom pricing, otherwise use product tiers
  const customTiers = selectedVariant && variantTiers.length > 0 ? variantTiers : productTiers
  const inStock = (product.inventory_quantity || 0) > 0

  // Jobs Principle: Show "From $X.XX"
  const lowestPrice = customTiers.length > 0
    ? Math.min(...customTiers.map((t: PricingTier) => parseFloat(String(t.price))))
    : product.regular_price || 0

  // Jobs Principle: Smart Default (pre-highlight most common option)
  // For cannabis: 3.5g (eighth) is most common
  const suggestedTierIndex = customTiers.findIndex((t: PricingTier) => {
    const weight = t.weight || t.label || ''
    const weightLower = weight.toLowerCase()
    return weightLower.includes('3.5') || weightLower.includes('eighth')
  })

  // Load available variants when modal opens
  useEffect(() => {
    const loadVariants = async () => {
      if (!showPricingModal) return

      try {
        setLoadingVariants(true)

        // Force fresh query by adding timestamp (prevents Supabase cache)
        const timestamp = Date.now()
        logger.info('🔄 Loading variants (forced fresh)...', { timestamp })

        const { data, error } = await supabase
          .from('v_product_variants')
          .select('*')
          .eq('product_id', product.id)
          .eq('is_enabled', true)
          .order('display_order', { ascending: true })

        if (error) throw error

        setAvailableVariants(data || [])
        logger.info('🔍 Loaded product variants with FULL DATA:', {
          productId: product.id,
          productName: product.name,
          variantsCount: data?.length,
          variants: data?.map(v => ({
            variant_name: v.variant_name,
            pricing_template_id: v.pricing_template_id,
            has_custom_pricing: !!v.pricing_template_id
          }))
        })
      } catch (error) {
        logger.error('Failed to load product variants:', error)
        setAvailableVariants([])
      } finally {
        setLoadingVariants(false)
      }
    }

    loadVariants()
  }, [showPricingModal, product.id])

  const openPricingModal = () => {
    if (!inStock) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowPricingModal(true)

    // Jobs Principle: Smooth, fast animation
    Animated.parallel([
      Animated.spring(modalSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }

  // Expose openPricingModal via ref
  useImperativeHandle(ref, () => ({
    openPricingModal,
  }))

  const closePricingModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    Animated.parallel([
      Animated.spring(modalSlideAnim, {
        toValue: 600,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowPricingModal(false)
      setSelectedTier(null)
      setSelectedVariant(null)
      setAvailableVariants([])
      setVariantTiers([])
    })
  }

  const handleTierPress = (tier?: PricingTier, index?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Jobs Principle: Instant visual feedback
    if (index !== undefined) {
      setSelectedTier(index)
    }

    // ✅ ZERO PROP DRILLING: Check if we're in tier change mode
    if (tierSelectorProductId) {
      // Tier change mode: Update existing cart item
      const cartItem = cartItems.find((item) => item.productId === tierSelectorProductId)
      if (cartItem && tier) {
        cartActions.changeTier(cartItem.id, product, tier)
      }
      // Clear tier selector mode
      checkoutUIActions.setTierSelectorProductId(null)
    } else {
      // Normal mode: Add to cart with optional variant
      cartActions.addToCart(product, tier, selectedVariant || undefined)
    }

    // Jobs Principle: Auto-dismiss after brief visual confirmation
    setTimeout(() => {
      closePricingModal()
    }, 250)
  }

  const handleVariantSelect = (variant: ProductVariant | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    logger.info('🎯 Variant selected:', {
      variantName: variant?.variant_name || 'None (parent product)',
      pricing_template_id: variant?.pricing_template_id || 'null',
      will_load_custom_pricing: !!variant?.pricing_template_id
    })

    setSelectedVariant(variant)
    setSelectedTier(null) // Reset tier selection when variant changes
  }

  // Load variant-specific pricing tiers when variant is selected
  useEffect(() => {
    const loadVariantPricing = async () => {
      // Reset if no variant or variant has no custom pricing
      if (!selectedVariant || !selectedVariant.pricing_template_id) {
        setVariantTiers([])
        return
      }

      try {
        setLoadingVariantTiers(true)
        logger.info('💰 Loading variant pricing tiers...', {
          variantName: selectedVariant.variant_name,
          pricingTemplateId: selectedVariant.pricing_template_id,
        })

        // Load pricing template with its tiers
        const { data, error } = await supabase
          .from('pricing_tier_templates')
          .select('id, name, default_tiers')
          .eq('id', selectedVariant.pricing_template_id)
          .single()

        if (error) {
          logger.error('❌ Error loading pricing template:', error)
          throw error
        }

        logger.info('📦 Raw pricing template data:', {
          templateId: data?.id,
          templateName: data?.name,
          hasTiers: !!data?.default_tiers,
          tiersCount: data?.default_tiers?.length || 0,
          rawTiers: data?.default_tiers,
          firstTier: data?.default_tiers?.[0]
        })

        if (data?.default_tiers && Array.isArray(data.default_tiers)) {
          // Transform DB tiers to PricingTier format
          // Note: DB stores price as 'default_price', not 'price'
          const tiers = data.default_tiers
            .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((tier: any) => ({
              qty: tier.quantity || 1,
              price: parseFloat(tier.default_price || tier.price) || 0, // Try default_price first, fallback to price
              label: tier.label || 'N/A',
              weight: tier.label || 'N/A', // For compatibility
            }))

          setVariantTiers(tiers)
          logger.info('✅ Loaded variant pricing tiers', {
            variantName: selectedVariant.variant_name,
            templateName: data.name,
            tiersCount: tiers.length,
            tiers: tiers.map(t => ({
              label: t.label,
              weight: t.weight,
              price: t.price,
              qty: t.qty
            })),
            fullTiers: tiers
          })
        } else {
          logger.warn('⚠️ No tiers found in pricing template')
          setVariantTiers([])
        }
      } catch (error) {
        logger.error('❌ Failed to load variant pricing:', error)
        setVariantTiers([])
      } finally {
        setLoadingVariantTiers(false)
      }
    }

    loadVariantPricing()
  }, [selectedVariant])

  const handleCardPress = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
    }).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
      }).start()
    })

    openPricingModal()
  }

  return (
    <>
      {/* JOBS PRINCIPLE: Clean Product Card */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleCardPress}
        disabled={!inStock}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, starting at $${lowestPrice.toFixed(2)}`}
        accessibilityHint={inStock ? 'Tap to view pricing options' : 'Out of stock'}
        accessibilityState={{ disabled: !inStock }}
      >
        <Animated.View
          style={[
            styles.card,
            {
              width: cardWidth,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* iOS: Subtle glass background */}
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Product Image - Edge to Edge */}
          <View style={styles.imageContainer}>
            {/* Jobs Principle: Smart fallback hierarchy - Product image → Vendor logo → Placeholder */}
            {product.image_url ? (
              <Image
                source={{ uri: getMediumImage(product.image_url) || product.image_url }}
                style={styles.image}
                resizeMode="cover"
                accessible={true}
                accessibilityLabel={`${product.name} product image`}
                accessibilityRole="image"
              />
            ) : product.vendor_logo_url ? (
              <View style={styles.vendorLogoContainer}>
                <Image
                  source={{ uri: getMediumImage(product.vendor_logo_url) || product.vendor_logo_url }}
                  style={styles.vendorLogo}
                  resizeMode="contain"
                        fadeDuration={0}
                  accessible={true}
                  accessibilityLabel="Vendor logo"
                  accessibilityRole="image"
                />
              </View>
            ) : (
              <View
                style={styles.placeholderContainer}
                accessible={true}
                accessibilityLabel="No product image available"
              >
                <Text style={styles.placeholderText}>NO IMAGE</Text>
              </View>
            )}

            {/* JOBS PRINCIPLE: Subtle filter tags - only show when filters active */}
            {matchingFilters && matchingFilters.length > 0 && (
              <View style={styles.filterTagsContainer}>
                {matchingFilters.slice(0, 2).map((filter) => (
                  <View key={filter} style={styles.filterTagWrapper}>
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                    <Text style={styles.filterTagText}>{filter}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Out of Stock */}
            {!inStock && (
              <View style={styles.outOfStockOverlay}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
              </View>
            )}
          </View>

          {/* Product Info */}
          <View style={styles.info}>
            <Text style={styles.productName} numberOfLines={1}>
              {product.name}
            </Text>
            <View style={styles.metadataRow}>
              <Text style={styles.category} numberOfLines={1}>
                {product.category || 'Uncategorized'}
              </Text>
              <Text style={styles.dot}>•</Text>
              {/* JOBS PRINCIPLE: Show starting price */}
              <Text style={styles.fromPrice}>From ${lowestPrice.toFixed(2)}</Text>
            </View>
            {/* JOBS PRINCIPLE: Subtle inventory count - only show when low or for awareness */}
            {inStock && (
              <Text style={[
                styles.inventoryCount,
                (product.inventory_quantity || 0) <= 5 && styles.inventoryCountLow
              ]}>
                {product.inventory_quantity} in stock
              </Text>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* JOBS PRINCIPLE: Clean Sheet Modal */}
      <Modal
        visible={showPricingModal}
        transparent
        animationType="none"
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={closePricingModal}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
          {/* JOBS PRINCIPLE: Tap outside to dismiss (no X button needed) */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closePricingModal}
          >
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          </Pressable>

          {/* Modal Sheet - Outer border container */}
          <Animated.View
            style={[
              styles.modalBorder,
              {
                marginLeft: insets.left,
                marginRight: insets.right,
                marginBottom: 0,
                transform: [{ translateY: modalSlideAnim }],
              },
            ]}
          >
            {/* Inner content container with clipped corners */}
            <View style={styles.modalContent}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

              {/* Pull Handle */}
              <View style={styles.pullHandle} />

            {/* JOBS PRINCIPLE: Just the product name, nothing else */}
            <Text style={styles.modalTitle} numberOfLines={2}>
              {product.name}
            </Text>

            {/* VARIANT SELECTOR - Show if variants available */}
            {loadingVariants ? (
              <View style={styles.variantLoadingContainer}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
              </View>
            ) : availableVariants.length > 0 ? (
              <View style={styles.variantSelectorContainer}>
                <Text style={styles.variantSelectorTitle}>VARIANT</Text>
                <View style={styles.variantOptions}>
                  {/* Parent product option (no variant) */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleVariantSelect(null)}
                    style={[
                      styles.variantOptionButton,
                      !selectedVariant && styles.variantOptionButtonActive
                    ]}
                  >
                    <Text style={[
                      styles.variantOptionText,
                      !selectedVariant && styles.variantOptionTextActive
                    ]}>
                      Original
                    </Text>
                  </TouchableOpacity>

                  {/* Variant options */}
                  {availableVariants.map((variant) => (
                    <TouchableOpacity
                      key={variant.variant_template_id}
                      activeOpacity={0.7}
                      onPress={() => handleVariantSelect(variant)}
                      style={[
                        styles.variantOptionButton,
                        selectedVariant?.variant_template_id === variant.variant_template_id && styles.variantOptionButtonActive
                      ]}
                    >
                      <Text style={[
                        styles.variantOptionText,
                        selectedVariant?.variant_template_id === variant.variant_template_id && styles.variantOptionTextActive
                      ]}>
                        {variant.variant_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {/* JOBS PRINCIPLE: Large, scannable pricing options */}
            {loadingVariantTiers ? (
              <View style={styles.tiersLoadingContainer}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                <Text style={styles.tiersLoadingText}>Loading pricing...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.tiersScroll}
                contentContainerStyle={styles.tiersContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* iOS 26 Grouped List Container */}
                <View style={styles.tierGroupContainer}>
                  {customTiers.length > 0 ? (
                  customTiers.map((tier: PricingTier, index: number) => {
                      const price = parseFloat(String(tier.price))
                      const isSelected = selectedTier === index
                      const isSuggested = index === suggestedTierIndex

                      return (
                        <TouchableOpacity
                          key={index}
                          activeOpacity={0.7}
                          onPress={() => handleTierPress(tier, index)}
                          style={[
                            styles.tierButton,
                            index === 0 && styles.tierButtonFirst,
                            index === customTiers.length - 1 && styles.tierButtonLast,
                            isSuggested && styles.tierButtonSuggested,
                            isSelected && styles.tierButtonSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`${tier.weight || tier.label || 'Option'} for $${price.toFixed(2)}`}
                          accessibilityHint={isSuggested ? 'Suggested option, add to cart' : 'Add to cart'}
                          accessibilityState={{ selected: isSelected }}
                        >
                          <View style={styles.tierButtonContent}>
                            <Text style={styles.tierLabel}>{tier.weight || tier.label || 'N/A'}</Text>
                            {/* JOBS PRINCIPLE: Price is HUGE and prominent */}
                            <Text style={styles.tierPrice}>${price.toFixed(2)}</Text>
                          </View>
                        </TouchableOpacity>
                      )
                  })
                ) : (
                  /* Single Price Product */
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleTierPress()}
                    style={[styles.tierButton, styles.tierButtonFirst, styles.tierButtonLast]}
                    accessibilityRole="button"
                    accessibilityLabel={`Add to cart for $${(product.regular_price || 0).toFixed(2)}`}
                    accessibilityHint="Add this product to your cart"
                  >
                    <View style={styles.tierButtonContent}>
                      <Text style={styles.tierLabel}>Add to cart</Text>
                      <Text style={styles.tierPrice}>
                        ${(product.regular_price || 0).toFixed(2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  )
})

POSProductCard.displayName = 'POSProductCard'

const POSProductCardMemo = memo(POSProductCard)
POSProductCardMemo.displayName = 'POSProductCard'
export { POSProductCardMemo as POSProductCard }

const styles = StyleSheet.create({
  // Clean Product Card - iOS liquid glass
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)', // iOS: Barely visible tint for glass
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1, // Square cards for better grid density
    backgroundColor: 'rgba(0,0,0,0.3)', // iOS: Subtle dark for images
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // Jobs Principle: Clean vendor logo fallback with subtle opacity
  vendorLogoContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 20,
  },
  vendorLogo: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  placeholderText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 0.5,
  },
  // JOBS PRINCIPLE: Subtle filter tags (top-right corner)
  filterTagsContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    gap: 4,
    zIndex: 1,
  },
  filterTagWrapper: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-end',
  },
  filterTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  info: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  category: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dot: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
  },
  // JOBS: Show starting price
  fromPrice: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  // JOBS PRINCIPLE: Subtle inventory indicator
  inventoryCount: {
    fontSize: 8,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  inventoryCountLow: {
    color: '#fbbf24', // Amber when low stock (≤5)
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBorder: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 40,
  },
  pullHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  // JOBS: Just product name, no subtitle
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  tiersScroll: {
    // Removed flex: 1 - let it size based on content
  },
  tiersContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  // iOS 26 Grouped List Container
  tierGroupContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  // iOS 26 List Items - Match customer/filter selector
  tierButton: {
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tierButtonFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tierButtonLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  // White glass effect for suggested/selected
  tierButtonSuggested: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tierButtonSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tierButtonContent: {
    flex: 1,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
  },
  // JOBS: Price is HUGE (28pt, not 24pt)
  tierPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },

  // Variant Selector
  variantLoadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  variantSelectorContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  variantSelectorTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  variantOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantOptionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderCurve: 'continuous' as const,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  variantOptionButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  variantOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.2,
  },
  variantOptionTextActive: {
    color: '#fff',
  },

  // Tiers Loading
  tiersLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  tiersLoadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.2,
  },
})
