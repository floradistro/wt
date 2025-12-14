import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, Modal, ScrollView, Pressable, ActivityIndicator, LayoutAnimation, UIManager, Platform, TextInput, Alert, InteractionManager, Easing, Linking, PanResponder } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useState, useRef, memo, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react'

// Stores (ZERO PROP DRILLING - Apple Engineering Standard)
import { cartActions, useCartItems } from '@/stores/cart.store'
import { useProductFilters } from '@/stores/product-filter.store'
import { useTierSelectorProductId, checkoutUIActions } from '@/stores/checkout-ui.store'
import { posProductsActions } from '@/stores/pos-products.store'

// Context
import { usePOSSession } from '@/contexts/POSSessionContext'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useAuth } from '@/stores/auth.store'

// Utils
import { getMatchingFilters } from '@/utils/product-transformers'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { getMediumImage } from '@/utils/image-transforms'
import { createInventoryAdjustment } from '@/services/inventory-adjustments.service'
import { usePricingTemplates, PricingTemplate } from '@/hooks/usePricingTemplates'

import { layout } from '@/theme/layout'
import type { Product, ProductVariant, InventoryItem } from '@/types/pos'
import { AnimatedStockBar } from './AnimatedStockBar'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// COA type for lab results (from vendor_coas table)
interface COAData {
  id: string
  file_url?: string | null
  file_name?: string | null
  lab_name?: string | null
  test_date?: string | null
  expiry_date?: string | null
  batch_number?: string | null
  test_results?: {
    thc?: string | number
    cbd?: string | number
    thca?: string | number
    cbg?: string | number
    total_cannabinoids?: string | number
    [key: string]: any
  } | null
}

const { width } = Dimensions.get('window')
// Apple Music style: 4-column grid accounting for cart sidebar
// Product area: 8px left padding + cards + 8px right padding
// Cards: 4 columns with 12px gaps between them
const cartWidth = layout.sidebarWidth // Cart width (280px)
const productGridPadding = 8 + 8 // Left (8px) + right (8px) padding
const gapsBetweenCards = 12 * 3 // 3 gaps for 4 columns (12px each)
const totalUsedWidth = cartWidth + productGridPadding + gapsBetweenCards
const cardWidth = (width - totalUsedWidth) / 4

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
  const { session } = usePOSSession()
  const { user } = useAuth()
  const { vendor } = useAppAuth()

  // Product details state
  const [locationInventory, setLocationInventory] = useState<InventoryItem | null>(null)
  const [productCOA, setProductCOA] = useState<COAData | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showDetails, setShowDetails] = useState(true)

  // Edit mode state - invisible editing with long-hold gestures
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedStock, setEditedStock] = useState('')
  const [editedTiers, setEditedTiers] = useState<PricingTier[]>([])
  const [editedFields, setEditedFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [didSaveChanges, setDidSaveChanges] = useState(false)  // Track if we saved, to refresh on close
  // Saved values to display after exiting edit mode (until modal closes)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [savedDescription, setSavedDescription] = useState<string | null>(null)
  const [savedStock, setSavedStock] = useState<string | null>(null)
  const [savedFields, setSavedFields] = useState<Record<string, string> | null>(null)
  const [savedTiers, setSavedTiers] = useState<PricingTier[] | null>(null)
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(-1) // -1 = custom/original pricing
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const lastTapTime = useRef<number>(0)
  const saveProgressAnim = useRef(new Animated.Value(0)).current

  // Variant inventory conversion state (edit mode only)
  const [variantInventory, setVariantInventory] = useState<Array<{
    variant_template_id: string
    variant_name: string
    conversion_ratio: number
    quantity: number
    available_quantity: number
  }>>([])
  const [convertAmount, setConvertAmount] = useState('')
  const [convertingVariant, setConvertingVariant] = useState<string | null>(null)
  const [conversionLoading, setConversionLoading] = useState(false)
  const [showConversionMode, setShowConversionMode] = useState(false) // Replaces pricing tiers with conversion UI
  const [showPricingModal, setShowPricingModal] = useState(false)

  // Inventory adjustment reason state - replaces pricing tiers when stock changes
  const ADJUSTMENT_REASONS = ['Shrinkage', 'Stolen', "I don't know", 'Custom'] as const
  type AdjustmentReason = typeof ADJUSTMENT_REASONS[number]
  const [adjustmentReason, setAdjustmentReason] = useState<AdjustmentReason>('Shrinkage')
  const [customReasonText, setCustomReasonText] = useState('')
  const [showReasonSelector, setShowReasonSelector] = useState(false)
  const [originalStock, setOriginalStock] = useState<number | null>(null) // Track original for comparison

  // Load pricing templates for this product's category
  const { templates: pricingTemplates, isLoading: loadingTemplates } = usePricingTemplates({
    categoryId: product.primary_category_id
  })

  // Debug: Log when templates are loaded
  useEffect(() => {
    if (showPricingModal && !loadingTemplates) {
      logger.info('📋 Pricing templates loaded:', {
        productName: product.name,
        categoryId: product.primary_category_id,
        templatesCount: pricingTemplates.length,
        templates: pricingTemplates.map(t => ({
          name: t.name,
          tiersCount: t.default_tiers?.length || 0,
          firstTier: t.default_tiers?.[0],
        })),
      })
    }
  }, [showPricingModal, loadingTemplates, pricingTemplates])

  // ✅ ANTI-LOOP: Compute matching filters for this product with useMemo (NOT in selector)
  const matchingFilters = useMemo(() =>
    getMatchingFilters(product, filters),
    [product, filters]
  )
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [availableVariants, setAvailableVariants] = useState<ProductVariant[]>([])
  const [variantsLoaded, setVariantsLoaded] = useState(false) // Track if initial load complete
  const [variantInventoryLoaded, setVariantInventoryLoaded] = useState(false) // Track variant inventory load
  const [variantTiers, setVariantTiers] = useState<PricingTier[]>([])
  const [loadingVariantTiers, setLoadingVariantTiers] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const modalSlideAnim = useRef(new Animated.Value(600)).current
  const modalOpacity = useRef(new Animated.Value(0)).current
  const dragOffset = useRef(0)

  // PanResponder for smooth drag-to-dismiss - memoized for performance
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        dragOffset.current = 0
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragOffset.current = gestureState.dy
          // Direct setValue for instant 60fps feedback
          modalSlideAnim.setValue(gestureState.dy)
          modalOpacity.setValue(Math.max(0, 1 - gestureState.dy / 300))
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const DISMISS_THRESHOLD = 100
        const VELOCITY_THRESHOLD = 0.5

        if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > VELOCITY_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          // Fast exit animation
          Animated.parallel([
            Animated.timing(modalSlideAnim, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(modalOpacity, {
              toValue: 0,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setShowPricingModal(false)
            setSelectedTier(null)
            setSelectedVariant(null)
            setVariantTiers([])
            setLocationInventory(null)
            setProductCOA(null)
            setIsEditing(false)
            setEditedName('')
            setEditedDescription('')
            setEditedStock('')
            setEditedTiers([])
            setEditedFields({})
            setHasChanges(false)
            setDidSaveChanges(false)
            setSavedName(null)
            setSavedDescription(null)
            setSavedStock(null)
            setSavedFields(null)
            setSavedTiers(null)
            setSelectedTemplateIndex(-1)
            setShowConversionMode(false)
            setConvertingVariant(null)
            setConvertAmount('')
            checkoutUIActions.setTierSelectorProductId(null)
          })
        } else {
          // Snap back with optimized spring
          Animated.parallel([
            Animated.spring(modalSlideAnim, {
              toValue: 0,
              tension: 350,
              friction: 28,
              useNativeDriver: true,
            }),
            Animated.timing(modalOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start()
        }
      },
    }),
    [modalSlideAnim, modalOpacity]
  )

  // SINGLE SOURCE OF TRUTH: Read from live pricing template
  // FALLBACK: Support legacy pricing for products not yet migrated to templates
  // IMPORTANT: Memoized to prevent re-creating arrays on every render
  const productTiers = useMemo(() => {
    return product.pricing_template?.default_tiers?.map(t => ({
      break_id: t.id,
      label: t.label,
      qty: t.quantity,
      price: t.default_price,
      sort_order: t.sort_order,
    })) ||
    // Legacy fallback: Read from meta_data.pricing_tiers or pricing_data.tiers
    // Normalize legacy data: support both 'qty' and 'quantity' fields
    product.meta_data?.pricing_tiers?.map((t: any) => ({
      ...t,
      qty: t.qty || t.quantity || 1,
    })) ||
    product.pricing_data?.tiers?.map((t: any) => ({
      ...t,
      qty: t.qty || t.quantity || 1,
    })) ||
    product.pricing_tiers?.map((t: any) => ({
      ...t,
      qty: t.qty || t.quantity || 1,
    })) ||
    // Ultimate fallback: Create single-unit tier from regular_price
    (product.regular_price ? [{
      qty: 1,
      price: product.regular_price,
      label: '1 Unit',
      weight: '1',
    }] : [])
  }, [product])

  // Use variant tiers if variant is selected and has custom pricing, otherwise use product tiers
  // CRITICAL: Only use variant tiers if selectedVariant is NOT null
  const customTiers = (selectedVariant !== null && variantTiers.length > 0) ? variantTiers : productTiers

  // DEBUG: Log pricing source EVERY TIME it changes
  useEffect(() => {
    if (showPricingModal) {
      logger.info('🎨 [POSProductCard] Pricing source UPDATE:', {
        productName: product.name,
        selectedVariant: selectedVariant?.variant_name || 'NULL (Product tab)',
        hasSelectedVariant: selectedVariant !== null,
        variantTiersCount: variantTiers.length,
        productTiersCount: productTiers.length,
        customTiersCount: customTiers.length,
        usingVariantPricing: selectedVariant !== null && variantTiers.length > 0,
        firstProductTier: productTiers[0],
        firstVariantTier: variantTiers[0],
        firstCustomTier: customTiers[0],
      })
    }
  }, [selectedVariant, variantTiers, customTiers, showPricingModal])

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

  // Load product details (inventory + COA) when modal opens
  // Uses InteractionManager to defer loading until after animation completes
  useEffect(() => {
    if (!showPricingModal || !session?.locationId) return

    const locationId = session.locationId
    const locationName = session.locationName

    // Defer data loading until animations complete for smooth 60fps
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      loadProductDetails()
    })

    return () => interactionHandle.cancel()

    async function loadProductDetails() {
      try {
        setLoadingDetails(true)

        // Parallel fetch: inventory for location AND COA data
        const [inventoryResult, coaResult] = await Promise.all([
          // Fetch inventory for current POS location
          supabase
            .from('inventory_with_holds')
            .select(`
              id,
              product_id,
              location_id,
              total_quantity,
              held_quantity,
              available_quantity,
              locations (name)
            `)
            .eq('product_id', product.id)
            .eq('location_id', locationId)
            .single(),

          // Fetch most recent COA for this product from vendor_coas table
          supabase
            .from('vendor_coas')
            .select(`
              id,
              file_url,
              file_name,
              lab_name,
              test_date,
              expiry_date,
              batch_number,
              test_results
            `)
            .eq('product_id', product.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        ])

        // Set inventory
        if (inventoryResult.data && !inventoryResult.error) {
          setLocationInventory({
            id: inventoryResult.data.id,
            location_id: inventoryResult.data.location_id,
            location_name: (inventoryResult.data.locations as any)?.name || locationName,
            quantity: inventoryResult.data.total_quantity || 0,
            available_quantity: inventoryResult.data.available_quantity || 0,
            reserved_quantity: inventoryResult.data.held_quantity || 0,
          })
        } else {
          setLocationInventory(null)
        }

        // Set COA
        if (coaResult.data && !coaResult.error) {
          logger.info('COA loaded for product:', { productId: product.id, coa: coaResult.data })
          setProductCOA(coaResult.data as COAData)
        } else {
          logger.info('No COA found for product:', { productId: product.id, error: coaResult.error })
          setProductCOA(null)
        }

      } catch (error) {
        logger.error('Failed to load product details:', error)
      } finally {
        setLoadingDetails(false)
      }
    }
  }, [showPricingModal, product.id, session?.locationId])

  // Load available variants on MOUNT (not modal open) so data is ready immediately
  useEffect(() => {
    async function loadVariants() {
      try {
        const { data, error } = await supabase
          .from('v_product_variants')
          .select('*')
          .eq('product_id', product.id)
          .eq('is_enabled', true)
          .order('display_order', { ascending: true })

        if (error) throw error

        setAvailableVariants(data || [])
      } catch (error) {
        logger.error('Failed to load product variants:', error)
        setAvailableVariants([])
      } finally {
        setVariantsLoaded(true) // Mark loading complete regardless of result
      }
    }

    loadVariants()
  }, [product.id])

  // Load variant inventory on mount (when variants are available)
  useEffect(() => {
    if (availableVariants.length === 0 || !session?.locationId) return

    const loadVariantInventory = async () => {

      try {
        // Query variant_inventory for this product at this location
        const { data, error } = await supabase
          .from('variant_inventory')
          .select(`
            variant_template_id,
            quantity,
            category_variant_templates (
              variant_name,
              conversion_ratio
            )
          `)
          .eq('product_id', product.id)
          .eq('location_id', session.locationId)

        // If table doesn't exist yet, just use availableVariants with 0 stock
        if (error && error.code === 'PGRST205') {
          logger.warn('variant_inventory table not found - using availableVariants with 0 stock')
          const inventory = availableVariants.map(v => ({
            variant_template_id: v.variant_template_id,
            variant_name: v.variant_name,
            conversion_ratio: v.conversion_ratio,
            quantity: 0,
            available_quantity: 0,
          }))
          setVariantInventory(inventory)
          setVariantInventoryLoaded(true)
          return
        }

        if (error) throw error

        const inventory = (data || []).map((item: any) => ({
          variant_template_id: item.variant_template_id,
          variant_name: item.category_variant_templates?.variant_name || 'Unknown',
          conversion_ratio: item.category_variant_templates?.conversion_ratio || 1,
          quantity: item.quantity || 0,
          available_quantity: item.quantity || 0, // TODO: subtract holds
        }))

        // Add variants that don't have inventory yet
        availableVariants.forEach(v => {
          if (!inventory.find((i: any) => i.variant_template_id === v.variant_template_id)) {
            inventory.push({
              variant_template_id: v.variant_template_id,
              variant_name: v.variant_name,
              conversion_ratio: v.conversion_ratio,
              quantity: 0,
              available_quantity: 0,
            })
          }
        })

        setVariantInventory(inventory)
        setVariantInventoryLoaded(true)
      } catch (error) {
        logger.error('Failed to load variant inventory:', error)
        // Fallback: show variants with 0 stock so UI still appears
        const inventory = availableVariants.map(v => ({
          variant_template_id: v.variant_template_id,
          variant_name: v.variant_name,
          conversion_ratio: v.conversion_ratio,
          quantity: 0,
          available_quantity: 0,
        }))
        setVariantInventory(inventory)
        setVariantInventoryLoaded(true)
      }
    }

    loadVariantInventory()
  }, [session?.locationId, product.id, availableVariants])

  // Also set variantInventoryLoaded true if no variants (nothing to load)
  useEffect(() => {
    if (variantsLoaded && availableVariants.length === 0) {
      setVariantInventoryLoaded(true)
    }
  }, [variantsLoaded, availableVariants.length])

  // Convert parent inventory to variant
  const handleConvertToVariant = async (variantTemplateId: string) => {
    const amount = parseFloat(convertAmount)
    if (!amount || amount <= 0 || !session?.locationId || !user?.id) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to convert')
      return
    }

    const variant = variantInventory.find(v => v.variant_template_id === variantTemplateId)
    if (!variant) return

    const parentStock = parseFloat(editedStock || savedStock || String(locationInventory?.quantity ?? product.inventory_quantity ?? 0))
    if (amount > parentStock) {
      Alert.alert('Insufficient Stock', `Only ${parentStock}g available to convert`)
      return
    }

    try {
      setConversionLoading(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const { data, error } = await supabase.rpc('convert_parent_to_variant_inventory', {
        p_product_id: product.id,
        p_variant_template_id: variantTemplateId,
        p_location_id: session.locationId,
        p_parent_quantity_to_convert: amount,
        p_notes: `POS conversion by ${(user as any).first_name || 'user'}`,
        p_performed_by_user_id: user.id,
      })

      if (error) throw error

      const result = data?.[0]
      if (!result?.success) {
        throw new Error(result?.error_message || 'Conversion failed')
      }

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Animate the change
      LayoutAnimation.configureNext({
        duration: 300,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      })

      // Update local state immediately
      const variantQtyCreated = result.variant_quantity_created
      const newParentQty = result.new_parent_quantity

      // Update parent stock display
      setEditedStock(String(newParentQty))
      setSavedStock(String(newParentQty))

      // Update variant inventory display
      setVariantInventory(prev => prev.map(v =>
        v.variant_template_id === variantTemplateId
          ? { ...v, quantity: result.new_variant_quantity, available_quantity: result.new_variant_quantity }
          : v
      ))

      // Clear input and close conversion mode
      setConvertAmount('')
      setConvertingVariant(null)
      setShowConversionMode(false)
      setDidSaveChanges(true)

      // Also update the locationInventory for immediate display
      if (locationInventory) {
        setLocationInventory({
          ...locationInventory,
          quantity: newParentQty,
          available_quantity: newParentQty,
        })
      }

      logger.info('✅ Conversion successful:', {
        parentUsed: amount,
        variantCreated: variantQtyCreated,
        newParentStock: newParentQty,
        newVariantStock: result.new_variant_quantity,
      })

    } catch (error: any) {
      logger.error('Conversion failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Conversion Failed', error.message || 'Failed to convert inventory')
    } finally {
      setConversionLoading(false)
    }
  }

  // Apple-standard spring config
  const SPRING_OPEN = {
    tension: 300,
    friction: 26,
    useNativeDriver: true,
  }

  const openPricingModal = () => {
    if (!inStock) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowPricingModal(true)

    // Reset to start position
    modalSlideAnim.setValue(600)
    modalOpacity.setValue(0)

    // Apple-standard spring animation for buttery 60fps
    Animated.parallel([
      Animated.spring(modalSlideAnim, {
        toValue: 0,
        ...SPRING_OPEN,
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

  // Auto-open pricing modal when this product is selected for tier editing from cart
  // CRITICAL: Wait for ALL data to load to prevent layout shift
  useEffect(() => {
    if (tierSelectorProductId === product.id && !showPricingModal && variantsLoaded && variantInventoryLoaded) {
      openPricingModal()
    }
  }, [tierSelectorProductId, product.id, showPricingModal, variantsLoaded, variantInventoryLoaded])

  const closePricingModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Capture if we need to refresh before resetting state
    const shouldRefresh = didSaveChanges

    // Fast exit animation - no spring on dismiss (Apple pattern)
    Animated.parallel([
      Animated.timing(modalSlideAnim, {
        toValue: 600,
        duration: 200,
        useNativeDriver: true,
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
      // NOTE: Don't clear availableVariants - keep cached (component unmounts anyway)
      setVariantTiers([])
      setLocationInventory(null)
      setProductCOA(null)
      // Reset edit mode
      setIsEditing(false)
      setEditedName('')
      setEditedDescription('')
      setEditedStock('')
      setEditedTiers([])
      setEditedFields({})
      setHasChanges(false)
      setDidSaveChanges(false)
      // Reset saved display values
      setSavedName(null)
      setSavedDescription(null)
      setSavedStock(null)
      setSavedFields(null)
      setSavedTiers(null)
      // Reset template selection
      setSelectedTemplateIndex(-1)
      // Reset conversion mode
      setShowConversionMode(false)
      setConvertingVariant(null)
      setConvertAmount('')

      // Refresh products if we saved changes
      if (shouldRefresh) {
        posProductsActions.refreshProducts()
      }

      // Clear tier selector so hidden card unmounts
      checkoutUIActions.setTierSelectorProductId(null)
    })
  }

  // ========================================
  // GESTURE SYSTEM - Clear separation:
  // - Long-hold: ONLY enters edit mode
  // - Double-tap: Saves (if editing with changes) OR closes modal
  // ========================================

  // Long-hold: Enter edit mode ONLY (never saves)
  const handleLongPressIn = () => {
    if (saving || isEditing) return // No-op if already editing

    // Start progress animation for visual feedback
    Animated.timing(saveProgressAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start()

    longPressTimer.current = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      // Initialize all editable fields - use saved values if available, otherwise original
      setEditedName(savedName ?? product.name)
      setEditedDescription(savedDescription ?? product.description ?? '')
      const stockValue = locationInventory?.quantity || product.inventory_quantity || 0
      setEditedStock(savedStock ?? String(stockValue))
      setOriginalStock(stockValue) // Track original for reason selector
      setEditedTiers(savedTiers ? [...savedTiers] : [...customTiers])
      // Initialize custom fields - use saved values if available
      if (savedFields) {
        setEditedFields({ ...savedFields })
      } else {
        const fields: Record<string, string> = {}
        product.fields?.forEach(f => {
          fields[f.label] = f.value || ''
        })
        setEditedFields(fields)
      }
      setHasChanges(false)
      // Reset reason state
      setAdjustmentReason('Shrinkage')
      setCustomReasonText('')
      setShowReasonSelector(false)
      setIsEditing(true)
    }, 600)
  }

  const handleLongPressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    saveProgressAnim.setValue(0)
  }

  // Double-tap: Save (if editing) OR close modal (if not editing)
  const handleDoubleTap = () => {
    if (saving) return

    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (isEditing) {
        if (hasChanges) {
          // Editing with changes - save
          performSave()
        } else {
          // Editing with no changes - exit edit mode
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          setIsEditing(false)
        }
      } else {
        // Not editing - close modal
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        closePricingModal()
      }
      lastTapTime.current = 0 // Reset to prevent triple tap
    } else {
      lastTapTime.current = now
    }
  }

  // Track changes
  const markChanged = () => {
    if (!hasChanges) setHasChanges(true)
  }

  const performSave = async () => {
    if (!user?.id || !vendor?.id) {
      Alert.alert('Error', 'Authentication required')
      return
    }

    logger.info('🔥 performSave called:', {
      hasChanges,
      editedTiersCount: editedTiers.length,
      selectedTemplateIndex,
      editedTiers: editedTiers.map(t => ({ label: t.label, price: t.price, qty: t.qty })),
    })

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Build a single update object for the product
      const productUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      }

      // Track what we're updating for logging
      const changes: string[] = []

      // Name change
      if (editedName && editedName !== product.name) {
        productUpdates.name = editedName
        changes.push('name')
      }

      // Description change
      if (editedDescription !== (product.description ?? '')) {
        productUpdates.description = editedDescription
        changes.push('description')
      }

      // Pricing tiers change - ALWAYS save to pricing_data.tiers (website reads this first)
      // Save if we have edited tiers (don't check hasChanges - always save current tiers)
      if (editedTiers.length > 0) {
        // Save tier data to pricing_data (website priority 1)
        const tiersToSave = editedTiers.map((t, idx) => ({
          label: t.label || t.weight || '',
          quantity: t.qty || 1,
          price: parseFloat(String(t.price)) || 0,
          unit: 'g',
          sort_order: idx,
        }))

        productUpdates.pricing_data = {
          mode: 'tiered',
          tiers: tiersToSave,
        }

        // Also link the template if one was selected (for reference)
        if (selectedTemplateIndex >= 0 && pricingTemplates[selectedTemplateIndex]) {
          const selectedTemplate = pricingTemplates[selectedTemplateIndex]
          productUpdates.pricing_template_id = selectedTemplate.id
          logger.info('💾 Saving pricing with template:', {
            templateId: selectedTemplate.id,
            templateName: selectedTemplate.name,
            tiersCount: tiersToSave.length,
            tiers: tiersToSave,
          })
        } else {
          // Custom pricing - clear template link
          productUpdates.pricing_template_id = null
          logger.info('💾 Saving custom pricing:', {
            tiersCount: tiersToSave.length,
            tiers: tiersToSave,
          })
        }

        changes.push('pricing')
      }

      // Custom fields change - always save if we have edited fields
      if (Object.keys(editedFields).length > 0) {
        const customFields: Record<string, any> = {}
        Object.entries(editedFields).forEach(([label, value]) => {
          customFields[label] = value || ''
        })
        productUpdates.custom_fields = customFields
        changes.push('fields')
        logger.info('Saving custom fields:', { customFields })
      }

      // Perform the product update if there are changes
      if (changes.length > 0) {
        logger.info('📤 Sending to Supabase:', {
          productId: product.id,
          changes,
          productUpdates,
        })

        const { error: productError, data: savedData } = await supabase
          .from('products')
          .update(productUpdates)
          .eq('id', product.id)
          .eq('vendor_id', vendor.id)
          .select('pricing_data')
          .single()

        if (productError) {
          logger.error('❌ Supabase error:', productError)
          throw productError
        }

        logger.info('✅ Saved to database:', { savedPricingData: savedData?.pricing_data })
      } else {
        logger.info('⚠️ No changes to save')
      }

      // Handle inventory separately using the proper service
      const originalStockNum = locationInventory?.quantity ?? product.inventory_quantity ?? 0
      const newStock = parseFloat(editedStock)

      if (!isNaN(newStock) && newStock !== originalStockNum && session?.locationId) {
        const adjustment = newStock - originalStockNum

        // Build reason string from user selection
        const reasonText = adjustmentReason === 'Custom' && customReasonText
          ? customReasonText
          : adjustmentReason

        logger.info('Adjusting inventory:', {
          productId: product.id,
          from: originalStockNum,
          to: newStock,
          adjustment,
          reason: reasonText,
        })

        const { error: adjustmentError, metadata } = await createInventoryAdjustment(
          vendor.id,
          {
            product_id: product.id,
            location_id: session.locationId,
            adjustment_type: 'count_correction',
            quantity_change: adjustment,
            reason: reasonText,
            notes: `Adjusted from ${originalStockNum} to ${newStock} - ${reasonText}`,
          }
        )

        if (adjustmentError) throw adjustmentError
        changes.push('inventory')

        // Reset reason state after successful save
        setShowReasonSelector(false)
        setAdjustmentReason('Shrinkage')
        setCustomReasonText('')
      }

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Save the edited values so they display after exiting edit mode
      const fieldsCopy = { ...editedFields }
      logger.info('Setting saved fields:', { editedFields, fieldsCopy })
      setSavedName(editedName)
      setSavedDescription(editedDescription)
      setSavedStock(editedStock)
      setSavedFields(fieldsCopy)
      setSavedTiers([...editedTiers])

      // Crisp animation when exiting edit mode after save
      LayoutAnimation.configureNext(LayoutAnimation.create(
        200,
        LayoutAnimation.Types.easeOut,
        LayoutAnimation.Properties.opacity
      ))
      setIsEditing(false)
      setHasChanges(false)
      setDidSaveChanges(true)  // Flag to refresh when modal closes

      logger.info('Product updated successfully', { productId: product.id, changes })
    } catch (error: any) {
      logger.error('Failed to save product:', {
        error,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        productId: product.id
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', error?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
      saveProgressAnim.setValue(0)
    }
  }

  // Tier editing helpers
  const updateTierPrice = (index: number, price: string) => {
    const newTiers = [...editedTiers]
    newTiers[index] = { ...newTiers[index], price }
    setEditedTiers(newTiers)
    markChanged()
  }

  const updateTierLabel = (index: number, label: string) => {
    const newTiers = [...editedTiers]
    newTiers[index] = { ...newTiers[index], label, weight: label }
    setEditedTiers(newTiers)
    markChanged()
  }

  // Field editing helper
  const updateField = (label: string, value: string) => {
    setEditedFields(prev => ({ ...prev, [label]: value }))
    markChanged()
  }

  // Get display values (editing > saved > original)
  const displayName = isEditing ? editedName : (savedName ?? product.name)
  const displayStock = isEditing ? editedStock : (savedStock ?? String(locationInventory?.quantity ?? product.inventory_quantity ?? 0))

  // Cycle to next pricing template (called when tapping selected variant/original in edit mode)
  const cycleToNextTemplate = () => {
    if (pricingTemplates.length === 0) {
      logger.info('No pricing templates available to cycle')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Crisp animation for tier template switching
    LayoutAnimation.configureNext(LayoutAnimation.create(
      180,
      LayoutAnimation.Types.easeOut,
      LayoutAnimation.Properties.opacity
    ))

    // Cycle: -1 (custom) -> 0 -> 1 -> ... -> n-1 -> -1 (back to custom)
    const nextIndex = selectedTemplateIndex >= pricingTemplates.length - 1 ? -1 : selectedTemplateIndex + 1

    if (nextIndex === -1) {
      // Back to custom/original pricing
      setEditedTiers([...customTiers])
      setSelectedTemplateIndex(-1)
      logger.info('Cycled back to custom pricing', { tiersCount: customTiers.length })
    } else {
      // Apply template
      const template = pricingTemplates[nextIndex]
      logger.info('🔄 Cycling to template:', {
        templateName: template.name,
        index: nextIndex,
        rawDefaultTiers: template.default_tiers,
        hasDefaultTiers: !!template.default_tiers,
        tiersLength: template.default_tiers?.length || 0,
      })

      if (!template.default_tiers || template.default_tiers.length === 0) {
        logger.warn('Template has no default_tiers, skipping')
        // Skip to next template
        setSelectedTemplateIndex(nextIndex)
        return cycleToNextTemplate()
      }

      const newTiers: PricingTier[] = template.default_tiers
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(tier => ({
          qty: tier.quantity || 1,
          price: tier.default_price ?? 0,
          label: tier.label || '',
          weight: tier.label || '',
        }))

      logger.info('✅ Applied template tiers:', {
        templateName: template.name,
        newTiers: newTiers.map(t => ({ label: t.label, price: t.price, qty: t.qty })),
      })

      setEditedTiers(newTiers)
      setSelectedTemplateIndex(nextIndex)
    }

    markChanged()
  }

  // Get current template name for display
  const currentTemplateName = selectedTemplateIndex >= 0 && pricingTemplates[selectedTemplateIndex]
    ? pricingTemplates[selectedTemplateIndex].name
    : null

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
      // SMART INVENTORY: Pass variant inventory info for proper stock checking
      if (selectedVariant) {
        const variantInv = variantInventory.find(v => v.variant_template_id === selectedVariant.variant_template_id)
        const variantInventoryInfo = variantInv ? {
          variantQuantity: variantInv.quantity,
          parentQuantity: parseFloat(displayStock) || 0,
        } : undefined

        cartActions.addToCart(product, tier, selectedVariant, variantInventoryInfo)
      } else {
        cartActions.addToCart(product, tier, undefined, undefined)
      }
    }

    // Jobs Principle: Auto-dismiss after brief visual confirmation
    setTimeout(() => {
      closePricingModal()
    }, 250)
  }

  const handleVariantSelect = (variant: ProductVariant | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    logger.info('🎯 Variant tab clicked:', {
      clickedVariant: variant?.variant_name || 'PRODUCT TAB (null)',
      pricing_template_id: variant?.pricing_template_id || 'null',
      will_load_custom_pricing: !!variant?.pricing_template_id,
      currentSelectedVariant: selectedVariant?.variant_name || 'null',
      currentVariantTiersCount: variantTiers.length,
      isEditing,
    })

    // CRITICAL: Clear variant tiers immediately when switching to Product tab
    if (variant === null) {
      logger.info('🔄 Switching to Product tab - clearing variant pricing NOW')
      setVariantTiers([])
      // In edit mode, switch editedTiers to product's custom tiers
      if (isEditing) {
        setEditedTiers([...customTiers])
        logger.info('✅ Edit mode: Loaded product tiers for editing')
      }
      logger.info('✅ Variant tiers cleared - should show product pricing now')
    } else {
      logger.info('🔄 Switching to variant tab - will load variant pricing')
      // In edit mode, variant tiers will be loaded by useEffect and we update editedTiers there
    }

    setSelectedVariant(variant)
    setSelectedTier(null) // Reset tier selection when variant changes

    logger.info('✅ State updated:', {
      newSelectedVariant: variant?.variant_name || 'NULL',
      stateUpdateComplete: true,
    })
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
          // In edit mode, also update editedTiers when variant tiers load
          if (isEditing) {
            setEditedTiers([...tiers])
            logger.info('✅ Edit mode: Loaded variant tiers for editing')
          }
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
          if (isEditing) {
            setEditedTiers([])
          }
        }
      } catch (error) {
        logger.error('❌ Failed to load variant pricing:', error)
        setVariantTiers([])
        if (isEditing) {
          setEditedTiers([])
        }
      } finally {
        setLoadingVariantTiers(false)
      }
    }

    loadVariantPricing()
  }, [selectedVariant, isEditing])

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
        onLongPress={() => {
          // Long-press: Open modal directly in edit mode
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          // Initialize edit state
          setEditedName(savedName ?? product.name)
          setEditedDescription(savedDescription ?? product.description ?? '')
          const stockValue = locationInventory?.quantity || product.inventory_quantity || 0
          setEditedStock(savedStock ?? String(stockValue))
          setOriginalStock(stockValue) // Track original for reason selector
          setEditedTiers(savedTiers ? [...savedTiers] : [...customTiers])
          if (savedFields) {
            setEditedFields({ ...savedFields })
          } else {
            const fields: Record<string, string> = {}
            product.fields?.forEach(f => {
              fields[f.label] = f.value || ''
            })
            setEditedFields(fields)
          }
          setHasChanges(false)
          // Reset reason state
          setAdjustmentReason('Shrinkage')
          setCustomReasonText('')
          setShowReasonSelector(false)
          setIsEditing(true)
          // Open the pricing modal
          openPricingModal()
        }}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, starting at $${lowestPrice.toFixed(2)}`}
        accessibilityHint={inStock ? 'Tap to view pricing options. Long press to edit.' : 'Out of stock'}
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
              <>
                <Image
                  source={{ uri: getMediumImage(product.image_url) || product.image_url }}
                  style={styles.image}
                  resizeMode="cover"
                  accessible={true}
                  accessibilityLabel={`${product.name} product image`}
                  accessibilityRole="image"
                />
                {/* Jobs Principle: Subtle dimming filter for consistent look (matches shop page) */}
                <View style={styles.imageDimOverlay} pointerEvents="none" />
              </>
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
              {/* Stock indicator dot */}
              <View style={[
                styles.stockDot,
                (product.inventory_quantity || 0) === 0 && styles.stockDotOut,
                (product.inventory_quantity || 0) > 0 && (product.inventory_quantity || 0) <= 5 && styles.stockDotLow,
                (product.inventory_quantity || 0) > 5 && styles.stockDotGood,
              ]} />
              <Text style={styles.category} numberOfLines={1}>
                {product.category || 'Uncategorized'}
              </Text>
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
          {/* Reduced blur for performance */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closePricingModal}
          >
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          </Pressable>

          {/* Modal Sheet - Edgeless design (extends to screen edges) */}
          <Animated.View
            style={[
              styles.modalBorder,
              {
                marginLeft: 0,
                marginRight: 0,
                marginBottom: 0,
                maxHeight: Dimensions.get('window').height - insets.top - 20,
                transform: [{ translateY: modalSlideAnim }],
              },
            ]}
          >
            {/* Inner content container with clipped corners - Long press to edit, double tap to save */}
            <Pressable
              style={styles.modalContent}
              onPress={handleDoubleTap}
              onPressIn={handleLongPressIn}
              onPressOut={handleLongPressOut}
              delayLongPress={600}
            >
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

              {/* Pull Handle - drag to dismiss */}
              <View
                style={styles.modalHeaderRow}
                {...panResponder.panHandlers}
              >
                <View style={[
                  styles.pullHandle,
                  isEditing && styles.pullHandleEditing
                ]} />
                {/* Minimal edit mode indicator */}
                {isEditing && (
                  <View style={styles.editModeIndicator}>
                    <View style={styles.editModeDot} />
                  </View>
                )}
              </View>

              {/* Scrollable content wrapper for edit mode */}
              <ScrollView
                style={styles.modalScrollContent}
                contentContainerStyle={styles.modalScrollContentContainer}
                showsVerticalScrollIndicator={isEditing}
                scrollEnabled={isEditing}
                keyboardShouldPersistTaps="handled"
              >

              {/* Product Header - Balanced Two Column (stacked in edit mode) */}
              <View style={styles.productHeaderRow}>
                {/* Left: Large Image */}
                <View style={styles.productImageContainer}>
                  {product.image_url ? (
                    <Image
                      source={{ uri: getMediumImage(product.image_url) || product.image_url }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : product.vendor_logo_url ? (
                    <Image
                      source={{ uri: product.vendor_logo_url }}
                      style={styles.productImageVendor}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Text style={styles.productImagePlaceholderText}>
                        {displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Right: Name + Compact Details */}
                <View style={styles.productInfoColumn}>
                  {isEditing ? (
                    <>
                      {/* Editable Name - subtle styling */}
                      <TextInput
                        style={styles.editableNameInput}
                        value={editedName}
                        onChangeText={(text) => { setEditedName(text); markChanged() }}
                        placeholder="Product name"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        autoCapitalize="words"
                        selectTextOnFocus
                      />
                      <Text style={styles.productHeaderMeta}>
                        {product.category || 'Uncategorized'}
                      </Text>
                      {/* Editable Stock - inline */}
                      <View style={styles.editableStockRow}>
                        <Text style={styles.editableStockLabel}>Stock:</Text>
                        <TextInput
                          style={styles.editableStockInput}
                          value={editedStock}
                          onChangeText={(text) => {
                            setEditedStock(text)
                            markChanged()
                            // Show reason selector if stock changed from original
                            const newValue = parseFloat(text) || 0
                            if (originalStock !== null && newValue !== originalStock) {
                              if (!showReasonSelector) {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                                setShowReasonSelector(true)
                              }
                            } else if (showReasonSelector) {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                              setShowReasonSelector(false)
                            }
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          selectTextOnFocus
                        />
                        <Text style={styles.editableStockUnit}>g</Text>
                      </View>
                      {/* Variant Stock Display - tap to open conversion */}
                      {variantInventory.length > 0 && variantInventory.map((variant) => (
                        <TouchableOpacity
                          key={variant.variant_template_id}
                          style={styles.variantStockEditRow}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            setConvertingVariant(variant.variant_template_id)
                            setShowConversionMode(true)
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.variantStockEditLabel}>{variant.variant_name}:</Text>
                          <Text style={styles.variantStockEditValue}>{variant.quantity}</Text>
                          <Text style={styles.variantStockEditHint}>tap to convert</Text>
                        </TouchableOpacity>
                      ))}
                      {/* Editable Description */}
                      <TextInput
                        style={styles.editableDescriptionInput}
                        value={editedDescription}
                        onChangeText={(text) => { setEditedDescription(text); markChanged() }}
                        placeholder="Add product description..."
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.productHeaderName} numberOfLines={2}>
                        {displayName}
                      </Text>
                      <Text style={styles.productHeaderMeta}>
                        {product.category || 'Uncategorized'}
                      </Text>

                      {/* Stock Bars - Parent + Variants */}
                      <AnimatedStockBar
                        value={parseFloat(displayStock) || 0}
                        maxValue={100}
                        label={`${displayStock}g in stock`}
                        color={parseFloat(displayStock) <= 10 ? '#fbbf24' : '#10b981'}
                        lowThreshold={10}
                        delay={0}
                      />
                      {/* Variant Stock Bars */}
                      {variantInventory.map((variant, index) => (
                        <AnimatedStockBar
                          key={variant.variant_template_id}
                          value={variant.quantity}
                          maxValue={Math.max(50, variant.quantity)}
                          label={`${variant.quantity} ${variant.variant_name}`}
                          color={variant.quantity <= 5 ? '#fbbf24' : '#ef4444'}
                          lowThreshold={5}
                          delay={50 * (index + 1)}
                          variant
                        />
                      ))}

                      {/* Description - View Mode */}
                      {(savedDescription ?? product.description) && (
                        <Text style={styles.productDescription} numberOfLines={3}>
                          {savedDescription ?? product.description}
                        </Text>
                      )}
                    </>
                  )}

                  {/* Compact Details Grid */}
                  <View style={styles.detailsGrid}>
                    {/* COA Data - from test_results */}
                    {(() => {
                      const tr = productCOA?.test_results
                      const thc = tr?.thc ? parseFloat(String(tr.thc)) : 0
                      const thca = tr?.thca ? parseFloat(String(tr.thca)) : 0
                      const cbd = tr?.cbd ? parseFloat(String(tr.cbd)) : 0
                      const cbg = tr?.cbg ? parseFloat(String(tr.cbg)) : 0
                      return (
                        <>
                          {thc > 0 && (
                            <View style={styles.detailChip}>
                              <Text style={styles.detailChipLabel}>THC</Text>
                              <Text style={styles.detailChipValueGreen}>{thc.toFixed(1)}%</Text>
                            </View>
                          )}
                          {thca > 0 && (
                            <View style={styles.detailChip}>
                              <Text style={styles.detailChipLabel}>THCA</Text>
                              <Text style={styles.detailChipValueGreen}>{thca.toFixed(1)}%</Text>
                            </View>
                          )}
                          {cbd > 0 && (
                            <View style={styles.detailChip}>
                              <Text style={styles.detailChipLabel}>CBD</Text>
                              <Text style={styles.detailChipValueBlue}>{cbd.toFixed(1)}%</Text>
                            </View>
                          )}
                          {cbg > 0 && (
                            <View style={styles.detailChip}>
                              <Text style={styles.detailChipLabel}>CBG</Text>
                              <Text style={styles.detailChipValueGreen}>{cbg.toFixed(1)}%</Text>
                            </View>
                          )}
                        </>
                      )
                    })()}
                    {/* Product Fields - Editable in place */}
                    {isEditing ? (
                      // Edit mode: Show editable chips
                      Object.entries(editedFields).map(([label, value]) => (
                        <View key={label} style={[styles.detailChip, styles.detailChipEditing]}>
                          <Text style={styles.detailChipLabel}>{label}</Text>
                          <TextInput
                            style={styles.detailChipInput}
                            value={value}
                            onChangeText={(text) => updateField(label, text)}
                            placeholder="—"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                          />
                        </View>
                      ))
                    ) : savedFields ? (
                      // View mode with saved values: Show updated chips
                      Object.entries(savedFields).map(([label, value]) => (
                        <View key={label} style={styles.detailChip}>
                          <Text style={styles.detailChipLabel}>{label}</Text>
                          <Text style={styles.detailChipValue} numberOfLines={1}>{value || '—'}</Text>
                        </View>
                      ))
                    ) : (
                      // View mode: Read-only chips from original product
                      product.fields?.map((field, idx) => (
                        <View key={idx} style={styles.detailChip}>
                          <Text style={styles.detailChipLabel}>{field.label}</Text>
                          <Text style={styles.detailChipValue} numberOfLines={1}>{field.value}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>

            {/* VARIANT SELECTOR + COA BUTTON ROW */}
            {(availableVariants.length > 0 || productCOA?.file_url) && (
              <View style={styles.variantSelectorContainer}>
                <View style={styles.variantSelectorRow}>
                  {availableVariants.length > 0 && (
                    <View style={styles.variantOptions}>
                      {/* Parent product option (no variant) - shows template name when cycling */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          // In edit mode, if already selected, cycle through templates
                          if (isEditing && !selectedVariant && pricingTemplates.length > 0) {
                            cycleToNextTemplate()
                          } else {
                            handleVariantSelect(null)
                          }
                        }}
                        style={[
                          styles.variantOptionButton,
                          !selectedVariant && styles.variantOptionButtonActive,
                          isEditing && !selectedVariant && pricingTemplates.length > 0 && styles.variantOptionButtonCyclable
                        ]}
                      >
                        <Text style={[
                          styles.variantOptionText,
                          !selectedVariant && styles.variantOptionTextActive
                        ]}>
                          {isEditing && !selectedVariant && currentTemplateName ? currentTemplateName : 'Original'}
                        </Text>
                      </TouchableOpacity>

                      {/* Convert button - only in edit mode */}
                      {isEditing && variantInventory.length > 0 && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            LayoutAnimation.configureNext(LayoutAnimation.create(
                              180,
                              LayoutAnimation.Types.easeOut,
                              LayoutAnimation.Properties.opacity
                            ))
                            setShowConversionMode(!showConversionMode)
                            if (showConversionMode) {
                              setConvertingVariant(null)
                              setConvertAmount('')
                            }
                          }}
                          style={[
                            styles.convertIconButton,
                            showConversionMode && styles.convertIconButtonActive
                          ]}
                        >
                          <Text style={styles.convertIconText}>⇄</Text>
                        </TouchableOpacity>
                      )}

                      {/* Variant options */}
                      {availableVariants.map((variant) => {
                        const isSelected = selectedVariant?.variant_template_id === variant.variant_template_id
                        return (
                          <TouchableOpacity
                            key={variant.variant_template_id}
                            activeOpacity={0.7}
                            onPress={() => {
                              // In edit mode, if already selected, cycle through templates
                              if (isEditing && isSelected && pricingTemplates.length > 0) {
                                cycleToNextTemplate()
                              } else {
                                handleVariantSelect(variant)
                              }
                            }}
                            style={[
                              styles.variantOptionButton,
                              isSelected && styles.variantOptionButtonActive,
                              isEditing && isSelected && pricingTemplates.length > 0 && styles.variantOptionButtonCyclable
                            ]}
                          >
                            <Text style={[
                              styles.variantOptionText,
                              isSelected && styles.variantOptionTextActive
                            ]}>
                              {isEditing && isSelected && currentTemplateName ? currentTemplateName : variant.variant_name}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  )}

                  {/* COA Button - on the right side (or standalone if no variants) */}
                  {productCOA?.file_url && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        logger.info('COA button pressed, opening URL', { file_url: productCOA.file_url })
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        // Open COA directly in browser - more reliable than nested modal
                        if (productCOA.file_url) {
                          Linking.openURL(productCOA.file_url)
                        }
                      }}
                      style={[styles.coaButton, availableVariants.length === 0 && styles.coaButtonStandalone]}
                    >
                      <Text style={styles.coaButtonText}>COA</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Template name indicator - show when cycling in edit mode (no variants) */}
            {isEditing && availableVariants.length === 0 && pricingTemplates.length > 0 && (
              <TouchableOpacity
                onPress={cycleToNextTemplate}
                style={styles.templateCycleButton}
                activeOpacity={0.7}
              >
                <Text style={styles.templateCycleText}>
                  {currentTemplateName || 'Original'}
                </Text>
                <Text style={styles.templateCycleHint}>tap to change</Text>
              </TouchableOpacity>
            )}

            {/* PRICING TIERS OR CONVERSION UI (no loading state to prevent bounce) */}
            {showConversionMode && isEditing ? (
              /* CONVERSION MODE - Replaces pricing tiers */
              <View style={styles.conversionModeContainer}>
                <View style={styles.conversionModeHeader}>
                  <Text style={styles.conversionModeTitle}>Convert Stock</Text>
                  <Text style={styles.conversionModeSubtitle}>
                    {displayStock}g available
                  </Text>
                </View>

                {variantInventory.map((variant) => {
                  const isSelected = convertingVariant === variant.variant_template_id
                  const variantsProduced = convertAmount ? Math.floor(parseFloat(convertAmount) / variant.conversion_ratio) : 0

                  return (
                    <TouchableOpacity
                      key={variant.variant_template_id}
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        if (isSelected) {
                          setConvertingVariant(null)
                          setConvertAmount('')
                        } else {
                          setConvertingVariant(variant.variant_template_id)
                          setConvertAmount('')
                        }
                      }}
                      style={[
                        styles.conversionTierButton,
                        isSelected && styles.conversionTierButtonActive
                      ]}
                    >
                      <View style={styles.conversionTierContent}>
                        <View style={styles.conversionTierInfo}>
                          <Text style={styles.conversionTierName}>{variant.variant_name}</Text>
                          <Text style={styles.conversionTierRatio}>{variant.conversion_ratio}g each</Text>
                        </View>
                        <View style={styles.conversionTierStock}>
                          <Text style={[
                            styles.conversionTierQty,
                            variant.quantity > 0 && styles.conversionTierQtyPositive
                          ]}>
                            {variant.quantity}
                          </Text>
                        </View>
                      </View>

                      {/* Expanded conversion input */}
                      {isSelected && (
                        <View style={styles.conversionInputSection}>
                          <View style={styles.conversionInputRow}>
                            <View style={styles.conversionInputWrapper}>
                              <TextInput
                                style={styles.conversionInput}
                                value={convertAmount}
                                onChangeText={setConvertAmount}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                selectTextOnFocus
                                autoFocus
                              />
                              <Text style={styles.conversionInputUnit}>g</Text>
                            </View>
                            <Text style={styles.conversionArrow}>→</Text>
                            <Text style={styles.conversionResult}>
                              {variantsProduced} units
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.conversionConfirmButton,
                              (!convertAmount || variantsProduced <= 0 || conversionLoading) && styles.conversionConfirmButtonDisabled
                            ]}
                            onPress={() => handleConvertToVariant(variant.variant_template_id)}
                            disabled={!convertAmount || variantsProduced <= 0 || conversionLoading}
                            activeOpacity={0.7}
                          >
                            {conversionLoading ? (
                              <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                              <Text style={[
                                styles.conversionConfirmButtonText,
                                (!convertAmount || variantsProduced <= 0) && styles.conversionConfirmButtonTextDisabled
                              ]}>
                                Convert Now
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : (
              <ScrollView
                style={styles.tiersScroll}
                contentContainerStyle={styles.tiersContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* iOS 26 Grouped List Container */}
                <View style={styles.tierGroupContainer}>
                  {isEditing ? (
                    // EDIT MODE: Show reason selector when stock changed, otherwise show editable tier inputs
                    showReasonSelector ? (
                      // REASON SELECTOR - Magic transformation from pricing tiers
                      <>
                        {ADJUSTMENT_REASONS.map((reason, index) => (
                          <TouchableOpacity
                            key={reason}
                            activeOpacity={0.7}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                              setAdjustmentReason(reason)
                              if (reason !== 'Custom') {
                                setCustomReasonText('')
                              }
                            }}
                            style={[
                              styles.tierButton,
                              index === 0 && styles.tierButtonFirst,
                              index === ADJUSTMENT_REASONS.length - 1 && !customReasonText && styles.tierButtonLast,
                              adjustmentReason === reason && styles.tierButtonSelected,
                            ]}
                          >
                            <View style={styles.tierButtonContent}>
                              <Text style={[
                                styles.tierLabel,
                                adjustmentReason === reason && styles.tierLabelSelected,
                              ]}>{reason}</Text>
                              {adjustmentReason === reason && (
                                <Text style={styles.reasonCheckmark}>✓</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                        {/* Custom reason text input - appears when Custom is selected */}
                        {adjustmentReason === 'Custom' && (
                          <View style={[styles.tierButton, styles.tierButtonLast, styles.tierButtonEditing]}>
                            <TextInput
                              style={styles.customReasonInput}
                              value={customReasonText}
                              onChangeText={setCustomReasonText}
                              placeholder="Enter reason..."
                              placeholderTextColor="rgba(255,255,255,0.3)"
                              autoFocus
                            />
                          </View>
                        )}
                      </>
                    ) : (
                      // PRICING TIERS - Editable tier inputs
                      editedTiers.map((tier: PricingTier, index: number) => (
                        <View
                          key={`edit-${index}-${tier.label}-${selectedTemplateIndex}`}
                          style={[
                            styles.tierButton,
                            styles.tierButtonEditing,
                            index === 0 && styles.tierButtonFirst,
                            index === editedTiers.length - 1 && styles.tierButtonLast,
                          ]}
                        >
                          <View style={styles.tierButtonContent}>
                            <TextInput
                              style={styles.tierLabelInput}
                              value={tier.label || tier.weight || ''}
                              onChangeText={(text) => updateTierLabel(index, text)}
                              placeholder="Label"
                              placeholderTextColor="rgba(255,255,255,0.3)"
                            />
                            <View style={styles.tierPriceInputWrapper}>
                              <Text style={styles.tierPriceCurrency}>$</Text>
                              <TextInput
                                style={styles.tierPriceInput}
                                value={String(tier.price ?? 0)}
                                onChangeText={(text) => updateTierPrice(index, text)}
                                keyboardType="decimal-pad"
                                placeholder="0.00"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                              />
                            </View>
                          </View>
                        </View>
                      ))
                    )
                  ) : (savedTiers ?? customTiers).length > 0 ? (
                    // VIEW MODE: Tappable tiers (use savedTiers if available, otherwise customTiers)
                    (savedTiers ?? customTiers).map((tier: PricingTier, index: number) => {
                      const displayTiers = savedTiers ?? customTiers
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
                            index === displayTiers.length - 1 && styles.tierButtonLast,
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

            </ScrollView>
          </Pressable>
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
  // Apple Music Album Card - Clean, no background
  card: {
    borderRadius: 8,
    overflow: 'visible', // Allow text to flow outside
    backgroundColor: 'transparent', // No card background - Apple Music style
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1, // Square cards like album art
    backgroundColor: '#000', // Pure black background like Apple Music
    borderRadius: 8, // Rounded corners on image only
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // Apple Music style - no dimming, full brightness images
  imageDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent', // No dimming - full brightness like Apple Music
  },
  // Apple Music style fallback for missing images
  vendorLogoContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000', // Pure black like Apple Music
    padding: 20,
  },
  vendorLogo: {
    width: '100%',
    height: '100%',
    opacity: 0.4,
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000', // Pure black placeholder
  },
  placeholderText: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
  },
  // Apple Music style - minimal badge like the "E" explicit indicator
  filterTagsContainer: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    gap: 3,
    zIndex: 1,
    flexDirection: 'row',
  },
  filterTagWrapper: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.6)', // Semi-transparent dark background
    alignSelf: 'flex-end',
  },
  filterTagText: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
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
  // Apple Music style - text below image with minimal padding
  info: {
    paddingTop: 8,
    paddingBottom: 0,
    paddingHorizontal: 0, // No horizontal padding - text aligns with image edges
  },
  productName: {
    fontSize: 13,
    fontWeight: '400', // Regular weight like Apple Music
    color: '#fff',
    letterSpacing: 0,
    marginBottom: 2,
    lineHeight: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  category: {
    fontSize: 11,
    fontWeight: '400', // Regular weight
    color: 'rgba(255,255,255,0.55)', // Subtle gray like Apple Music artist names
    letterSpacing: 0,
    textTransform: 'none', // No uppercase - Apple Music style
  },
  dot: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  // Price shown like artist name
  fromPrice: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0,
  },
  // Stock indicator dot
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  stockDotGood: {
    backgroundColor: '#10b981', // Green - good stock
  },
  stockDotLow: {
    backgroundColor: '#fbbf24', // Amber - low stock (≤5)
  },
  stockDotOut: {
    backgroundColor: '#ef4444', // Red - out of stock
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBorder: {
    // Edgeless design - extends to screen edges, rounded top corners with shadow
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 40,
  },
  modalScrollContent: {
    // Let content determine size
  },
  modalScrollContentContainer: {
    paddingBottom: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    position: 'relative',
    // Larger touch target for drag-to-dismiss
    minHeight: 44,
  },
  pullHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  pullHandleEditing: {
    backgroundColor: '#10b981',
    width: 60,
  },
  editModeIndicator: {
    position: 'absolute',
    right: 20,
  },
  editModeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  // Product Header - Balanced Two Column
  productHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 16,
    alignItems: 'flex-start',
  },
  productImageContainer: {
    width: 180,
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImageVendor: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  productImagePlaceholderText: {
    fontSize: 48,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
  },
  productInfoColumn: {
    flex: 1,
    paddingTop: 4,
  },
  productHeaderName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  productHeaderMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
    marginBottom: 8,
  },
  // Edit Mode Styles
  editableNameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 4,
    padding: 8,
    paddingLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  editableStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 8,
    paddingLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.5)',
  },
  editableStockLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  editableStockInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    padding: 0,
    minWidth: 60,
  },
  editableStockUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  variantStockEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  variantStockEditLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  variantStockEditValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  variantStockEditHint: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 'auto',
  },
  stockBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stockBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 4,
  },
  stockBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
    minWidth: 80,
    textAlign: 'right',
  },
  stockBarTextLow: {
    color: '#fbbf24',
  },
  productDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 8,
  },
  editableDescriptionInput: {
    fontSize: 13,
    fontWeight: '400',
    color: '#fff',
    lineHeight: 18,
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
    minHeight: 60,
    maxHeight: 100,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    minHeight: 32, // Reserve space to prevent layout bounce on COA load
  },
  detailChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.2,
  },
  detailChipValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  detailChipValueGreen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: -0.2,
  },
  detailChipValueBlue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
    letterSpacing: -0.2,
  },
  detailChipEditing: {
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  detailChipInput: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    padding: 0,
    minWidth: 40,
  },

  tiersScroll: {
    // Removed flex: 1 - let it size based on content
  },
  tiersContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  // Template Picker - Almost invisible, subtle styling
  templatePickerContainer: {
    marginBottom: 12,
  },
  templatePickerButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  templatePickerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(16,185,129,0.8)',
    letterSpacing: 0.3,
  },
  templatePickerExpanded: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  templatePickerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  templateOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateOptionActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  templateOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  templateOptionTextActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  templateOptionTier: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'capitalize',
  },
  templatePickerCancel: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  templatePickerCancelText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
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
  // Selected tier label (for reason selector)
  tierLabelSelected: {
    fontWeight: '600',
  },
  // Checkmark for selected reason
  reasonCheckmark: {
    fontSize: 17,
    fontWeight: '600',
    color: '#10b981',
  },
  // Custom reason text input
  customReasonInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 0,
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
  variantSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
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
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // COA Button - matches variant option style
  coaButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderCurve: 'continuous' as const,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  coaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.2,
  },
  coaButtonStandalone: {
    // When no variants, COA button appears alone on the right
    marginLeft: 'auto',
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
  variantOptionButtonCyclable: {
    // Subtle pulse indicator that this button cycles through templates
    borderColor: 'rgba(16,185,129,0.4)',
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

  // Template cycle button (for products without variants)
  templateCycleButton: {
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templateCycleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
  },
  templateCycleHint: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.2,
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

  // ========================================
  // EDIT MODE STYLES - Invisible editing
  // ========================================
  tierButtonEditing: {
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  tierLabelInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
    padding: 0,
  },
  tierPriceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierPriceCurrency: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginRight: 2,
  },
  tierPriceInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: -0.5,
    padding: 0,
    minWidth: 80,
    textAlign: 'right',
  },

  // ========================================
  // VARIANT INVENTORY CONVERSION (Edit Mode)
  // ========================================
  variantInventorySection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  variantInventorySectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  variantInventoryRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  variantInventoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  variantInventoryInfo: {
    flex: 1,
  },
  variantInventoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  variantInventoryRatio: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  variantInventoryStock: {
    alignItems: 'flex-end',
  },
  variantInventoryQty: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },
  variantInventoryQtyPositive: {
    color: '#10b981',
  },
  variantInventoryUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  variantConversionContainer: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(16,185,129,0.2)',
    padding: 14,
  },
  variantConversionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  variantConversionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  variantConversionInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  variantConversionInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    minWidth: 50,
    textAlign: 'center',
    padding: 0,
  },
  variantConversionInputUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
  },
  variantConversionArrow: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },
  variantConversionResult: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    flex: 1,
    textAlign: 'right',
  },
  variantConversionButton: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  variantConversionButtonDisabled: {
    opacity: 0.4,
  },
  variantConversionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  variantConversionButtonTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },

  // Placeholder - variant bars removed from view mode to prevent layout shift
  _variantStockBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  _variantStockBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
    letterSpacing: -0.2,
    minWidth: 80,
  },

  // ========================================
  // CONVERT ICON BUTTON (Between Original and Variants)
  // ========================================
  convertIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  convertIconButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.3)',
    borderColor: '#ef4444',
  },
  convertIconText: {
    fontSize: 18,
    color: '#ef4444',
    fontWeight: '600',
  },

  // ========================================
  // CONVERSION MODE (Replaces pricing tiers)
  // ========================================
  conversionModeContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  conversionModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  conversionModeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
  conversionModeSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  conversionTierButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  conversionTierButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  conversionTierContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  conversionTierInfo: {
    flex: 1,
  },
  conversionTierName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  conversionTierRatio: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  conversionTierStock: {
    alignItems: 'flex-end',
  },
  conversionTierQty: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
  },
  conversionTierQtyPositive: {
    color: '#ef4444',
  },
  conversionInputSection: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.2)',
    padding: 16,
  },
  conversionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  conversionInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flex: 1,
  },
  conversionInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    padding: 0,
  },
  conversionInputUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 6,
  },
  conversionArrow: {
    fontSize: 20,
    color: '#ef4444',
    fontWeight: '600',
  },
  conversionResult: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
    flex: 1,
    textAlign: 'right',
  },
  conversionConfirmButton: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  conversionConfirmButtonDisabled: {
    opacity: 0.4,
  },
  conversionConfirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  conversionConfirmButtonTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
})
