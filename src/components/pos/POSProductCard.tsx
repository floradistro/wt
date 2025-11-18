import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, Modal, ScrollView, Pressable } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useState, useRef, memo, forwardRef, useImperativeHandle } from 'react'

const { width } = Dimensions.get('window')
// Jobs Principle: 3-column grid accounting for cart sidebar
// Layout matches Products/Settings: 375px cart + product area (spacing from cart's marginRight only)
// Product area: 0px left padding (cart provides spacing) + cards + 20px right padding
// Cards: 3 columns with 16px gaps between them
const cartWidth = 375 // Match nav sidebar width exactly
const productGridPadding = 20 // Only right padding (layout.containerMargin)
const gapsBetweenCards = 16 * 2 // 2 gaps for 3 columns
const totalUsedWidth = cartWidth + productGridPadding + gapsBetweenCards
const cardWidth = (width - totalUsedWidth) / 3

interface PricingTier {
  qty: number
  price: string | number
  weight?: string
  label?: string
}

interface Product {
  id: string
  name: string
  image_url?: string | null
  vendor_logo_url?: string | null
  primary_category?: { name: string; slug: string }
  inventory_quantity?: number
  meta_data?: {
    pricing_mode?: 'single' | 'tiered'
    pricing_tiers?: PricingTier[]
  }
  regular_price?: number
}

interface POSProductCardProps {
  product: Product
  onAddToCart: (product: Product, tier?: PricingTier) => void
  activeFilters?: {
    category?: string
    strainTypes?: string[]
    consistencies?: string[]
    flavors?: string[]
  }
  matchingFilters?: string[]
}

const POSProductCard = forwardRef<any, POSProductCardProps>(({ product, onAddToCart, matchingFilters }, ref) => {
  const insets = useSafeAreaInsets()
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const modalSlideAnim = useRef(new Animated.Value(600)).current
  const modalOpacity = useRef(new Animated.Value(0)).current

  const _pricingMode = product.meta_data?.pricing_mode || 'single'
  const customTiers = product.meta_data?.pricing_tiers || []
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
    })
  }

  const handleTierPress = (tier?: PricingTier, index?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Jobs Principle: Instant visual feedback
    if (index !== undefined) {
      setSelectedTier(index)
    }

    // Add to cart
    onAddToCart(product, tier)

    // Jobs Principle: Auto-dismiss after brief visual confirmation
    setTimeout(() => {
      closePricingModal()
    }, 250)
  }

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
                source={{ uri: product.image_url }}
                style={styles.image}
                resizeMode="cover"
                accessible={true}
                accessibilityLabel={`${product.name} product image`}
                accessibilityRole="image"
              />
            ) : product.vendor_logo_url ? (
              <View style={styles.vendorLogoContainer}>
                <Image
                  source={{ uri: product.vendor_logo_url }}
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
                {product.primary_category?.name || 'Uncategorized'}
              </Text>
              <Text style={styles.dot}>•</Text>
              {/* JOBS PRINCIPLE: Show starting price */}
              <Text style={styles.fromPrice}>From ${lowestPrice.toFixed(2)}</Text>
            </View>
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

            {/* JOBS PRINCIPLE: Large, scannable pricing options */}
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
    aspectRatio: 4 / 5,
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
})
