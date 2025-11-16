/**
 * POSScreen - Refactored with Design System
 * Apple-quality POS interface
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Modal, Pressable } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { startPaymentProcessorMonitoring, stopPaymentProcessorMonitoring, usePaymentProcessor } from '@/stores/payment-processor.store'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'

// POS Components
import {
  POSLocationSelector,
  POSRegisterSelector,
  OpenCashDrawerModal,
  CloseCashDrawerModal,
  POSUnifiedCustomerSelector,
  POSPaymentModal,
  POSSaleSuccessModal,
  POSCart,
  POSSearchBar,
  POSProductGrid,
} from '@/components/pos'
import type { PaymentData } from '@/components/pos/POSPaymentModal'

// POS Hooks - Now using our new consolidated hooks!
import { useCart, useLoyalty, useFilters, useModalState } from '@/hooks/pos'

// Product Transformers - Using our new utilities!
import { transformInventoryToProducts, extractCategories } from '@/utils/product-transformers'

// Design System
import { colors, spacing, radius, borderWidth, device } from '@/theme'

// POS Types
import type { Vendor, Customer, Location, Product, SessionInfo } from '@/types/pos'

const { width, height: _height } = Dimensions.get('window')
const isTablet = device.isTablet

/**
 * POSScreen Component
 * Jobs Principle: Still needs refactoring into smaller components,
 * but now uses consolidated state management and utilities
 */
export function POSScreen() {
  const { user } = useAuth()
  const _insets = useSafeAreaInsets()
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)

  // ========================================
  // SESSION & SETUP STATE
  // ========================================
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [selectedRegister, setSelectedRegister] = useState<{ id: string; name: string } | null>(null)
  const [customUserId, setCustomUserId] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<{
    sessionNumber: string
    totalSales: number
    totalCash: number
    openingCash: number
  } | null>(null)

  // ========================================
  // PRODUCT STATE
  // ========================================
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>(['All'])
  const [loading, setLoading] = useState(true)

  // ========================================
  // FILTERS - Using new consolidated hook!
  // ========================================
  const {
    filters,
    filteredProducts,
    activeFilterCount,
    matchingFiltersMap,
    setSearchQuery,
    setCategory,
    clearFilters,
  } = useFilters(products)

  // ========================================
  // MODALS - Using new state machine hook!
  // ========================================
  const {
    openModal,
    closeModal,
    isModalOpen,
  } = useModalState()

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  // ========================================
  // CUSTOMER STATE
  // ========================================
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const [_processingCheckout, setProcessingCheckout] = useState(false)

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successData, setSuccessData] = useState<{
    orderNumber: string
    transactionNumber?: string
    total: number
    paymentMethod: string
    authorizationCode?: string
    cardType?: string
    cardLast4?: string
    itemCount: number
    processorName?: string
    inventoryDeducted?: boolean
    loyaltyPointsAdded?: number
    loyaltyPointsRedeemed?: number
  } | null>(null)

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current

  // ========================================
  // CART & LOYALTY - Using existing hooks
  // ========================================
  const {
    cart,
    discountingItemId,
    addToCart,
    updateQuantity,
    changeTier,
    applyManualDiscount,
    removeManualDiscount,
    clearCart,
    setDiscountingItemId,
    subtotal,
    itemCount,
  } = useCart()

  const {
    loyaltyProgram,
    loyaltyPointsToRedeem,
    setLoyaltyPointsToRedeem,
    resetLoyalty,
    getMaxRedeemablePoints,
    loyaltyDiscountAmount,
  } = useLoyalty(vendor?.id || null, selectedCustomer)

  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    loadVendorAndLocations()
  }, [])

  useEffect(() => {
    if (sessionInfo?.locationId) {
      loadProducts()
    }
  }, [sessionInfo?.locationId])

  // Payment processor monitoring
  useEffect(() => {
    if (sessionInfo?.locationId && sessionInfo?.registerId) {
      usePaymentProcessor.getState().setLocationId(sessionInfo.locationId)
      usePaymentProcessor.getState().setRegisterId(sessionInfo.registerId)

      stopPaymentProcessorMonitoring()
      startPaymentProcessorMonitoring(sessionInfo.locationId, sessionInfo.registerId)
    }

    return () => {
      stopPaymentProcessorMonitoring()
    }
  }, [sessionInfo?.locationId, sessionInfo?.registerId])

  // ========================================
  // DATA LOADING
  // ========================================
  const loadVendorAndLocations = async () => {
    try {
      setLoading(true)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, vendor_id, vendors(id, store_name, logo_url)')
        .eq('email', user?.email)
        .single()

      if (userError) throw userError

      const vendorData = userData.vendors as any
      setVendor(vendorData)
      setCustomUserId(userData.id)

      const isAdmin = ['vendor_owner', 'vendor_admin'].includes(userData.role)

      let locs: Location[] = []

      if (isAdmin) {
        const { data: allLocations, error: allLocationsError } = await supabase
          .from('locations')
          .select('id, name, address_line1, city, state, is_primary')
          .eq('vendor_id', userData.vendor_id)
          .eq('is_active', true)
          .eq('pos_enabled', true)
          .order('is_primary', { ascending: false })
          .order('name')

        if (allLocationsError) throw allLocationsError
        locs = allLocations || []
      } else {
        const { data: locationsData, error: locationsError } = await supabase
          .from('user_locations')
          .select(`
            location_id,
            locations!inner (
              id,
              name,
              address_line1,
              city,
              state,
              is_primary
            )
          `)
          .eq('user_id', userData.id)

        if (locationsError) throw locationsError

        locs = (locationsData || []).map((ul: any) => ul.locations).filter(Boolean)
      }

      setLocations(locs)
    } catch (error) {
      console.error('Error loading vendor/locations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    if (!sessionInfo?.locationId) return

    try {
      setLoading(true)

      const { data: inventoryData, error } = await supabase
        .from('inventory')
        .select(`
          id,
          product_id,
          quantity,
          reserved_quantity,
          available_quantity,
          products (
            id,
            name,
            regular_price,
            featured_image,
            description,
            short_description,
            custom_fields,
            pricing_data,
            vendor_id,
            primary_category:categories!primary_category_id(id, name),
            product_categories (
              categories (
                name
              )
            ),
            vendors (
              id,
              store_name,
              logo_url
            )
          )
        `)
        .eq('location_id', sessionInfo.locationId)
        .gt('quantity', 0)

      if (error) throw error

      // JOBS PRINCIPLE: Using our new transformer utility!
      const transformedProducts = transformInventoryToProducts(inventoryData || [])
      setProducts(transformedProducts)

      // JOBS PRINCIPLE: Using our new category extractor!
      const uniqueCategories = extractCategories(transformedProducts)
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  // ========================================
  // SESSION HANDLERS
  // ========================================
  const handleLocationSelected = async (locationId: string, locationName: string) => {
    try {
      const { data: location } = await supabase
        .from('locations')
        .select('settings')
        .eq('id', locationId)
        .single()

      const taxConfig = location?.settings?.tax_config || {}
      const taxRate = taxConfig.sales_tax_rate || 0.08
      const taxName = taxConfig.tax_name || undefined

      setSessionInfo({
        locationId,
        locationName,
        registerId: '',
        registerName: '',
        sessionId: '',
        taxRate,
        taxName,
      })
      openModal('registerSelector')
    } catch (error) {
      console.error('Error loading location tax config:', error)
      setSessionInfo({
        locationId,
        locationName,
        registerId: '',
        registerName: '',
        sessionId: '',
        taxRate: 0.08,
      })
      openModal('registerSelector')
    }
  }

  const handleRegisterSelected = async (registerId: string) => {
    try {
      const { data: registerData } = await supabase
        .from('pos_registers')
        .select('register_name')
        .eq('id', registerId)
        .single()

      const registerName = registerData?.register_name || 'Register'

      const { data: activeSession } = await supabase
        .from('pos_sessions')
        .select('id, session_number')
        .eq('register_id', registerId)
        .eq('status', 'open')
        .single()

      if (activeSession) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setSessionInfo((prev) => ({
          ...prev!,
          registerId,
          registerName,
          sessionId: activeSession.id,
        }))
        closeModal()
      } else {
        setSelectedRegister({ id: registerId, name: registerName })
        openModal('cashDrawerOpen')
      }
    } catch (error) {
      console.error('Error handling register selection:', error)
    }
  }

  const handleBackToLocationSelector = () => {
    closeModal()
    setSessionInfo(null)
  }

  const handleCashDrawerSubmit = async (openingCash: number, _notes: string) => {
    if (!selectedRegister || !sessionInfo || !customUserId || !vendor) return

    try {
      const { data, error } = await supabase.rpc('get_or_create_session', {
        p_location_id: sessionInfo.locationId,
        p_opening_cash: openingCash,
        p_register_id: selectedRegister.id,
        p_user_id: customUserId,
        p_vendor_id: vendor.id,
      })

      if (error) throw error

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      setSessionInfo((prev) => ({
        ...prev!,
        registerId: selectedRegister.id,
        registerName: selectedRegister.name,
        sessionId: data.id,
      }))

      setSessionData({
        sessionNumber: data.session_number || 'Unknown',
        totalSales: 0,
        totalCash: 0,
        openingCash,
      })

      closeModal()
      setSelectedRegister(null)
    } catch (error) {
      console.error('Error in cash drawer submit:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCashDrawerCancel = () => {
    closeModal()
    setSelectedRegister(null)
  }

  const handleEndSession = async () => {
    if (!sessionInfo?.sessionId) return

    try {
      const { data: session, error } = await supabase
        .from('pos_sessions')
        .select('session_number, total_sales, total_cash, opening_cash')
        .eq('id', sessionInfo.sessionId)
        .single()

      if (error || !session) {
        console.error('Error loading session data:', error)
        return
      }

      setSessionData({
        sessionNumber: session.session_number,
        totalSales: session.total_sales || 0,
        totalCash: session.total_cash || 0,
        openingCash: session.opening_cash || 0,
      })

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      openModal('cashDrawerClose')
    } catch (error) {
      console.error('Error in handleEndSession:', error)
    }
  }

  const handleCloseDrawerSubmit = async (closingCash: number, _notes: string) => {
    if (!sessionInfo?.sessionId) return

    try {
      const { data, error } = await supabase.rpc('close_pos_session', {
        p_session_id: sessionInfo.sessionId,
        p_closing_cash: closingCash,
        p_closing_notes: _notes || null,
      })

      if (error) throw error
      if (!data.success) {
        throw new Error(data.error || 'Failed to close session')
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      closeModal()
      setSessionInfo(null)
      setSessionData(null)
      clearCart()
      resetLoyalty()
    } catch (error) {
      console.error('Error closing session:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCloseDrawerCancel = () => {
    closeModal()
  }

  // ========================================
  // CHECKOUT & PAYMENT
  // ========================================
  const subtotalAfterLoyalty = Math.max(0, subtotal - loyaltyDiscountAmount)
  const taxRate = sessionInfo?.taxRate || 0.08
  const taxAmount = subtotalAfterLoyalty * taxRate
  const total = subtotalAfterLoyalty + taxAmount

  const loyaltyPointsEarned = useMemo(() => {
    if (!selectedCustomer) return 0
    const pointValue = loyaltyProgram?.point_value || 1.0
    return Math.floor(total / pointValue)
  }, [total, loyaltyProgram, selectedCustomer])

  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    openModal('payment')
  }, [cart.length, openModal])

  const handlePaymentComplete = async (paymentData: PaymentData) => {
    if (!sessionInfo || !vendor || !customUserId) return

    setProcessingCheckout(true)

    try {
      const items = cart.map((item) => ({
        productId: item.productId,
        productName: item.productName || item.name,
        unitPrice: item.adjustedPrice !== undefined ? item.adjustedPrice : item.price,
        quantity: item.quantity,
        lineTotal: (item.adjustedPrice !== undefined ? item.adjustedPrice : item.price) * item.quantity,
        inventoryId: item.inventoryId,
        manualDiscountType: item.manualDiscountType,
        manualDiscountValue: item.manualDiscountValue,
        originalPrice: item.originalPrice,
      }))

      const requestBody = {
        locationId: sessionInfo.locationId,
        vendorId: vendor.id,
        sessionId: sessionInfo.sessionId,
        userId: customUserId,
        items,
        subtotal,
        taxAmount,
        total,
        paymentMethod: paymentData.paymentMethod,
        cashTendered: paymentData.cashTendered,
        changeGiven: paymentData.changeGiven,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer
          ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
          : 'Walk-In',
        authorizationCode: paymentData.authorizationCode,
        paymentTransactionId: paymentData.transactionId,
        cardType: paymentData.cardType,
        cardLast4: paymentData.cardLast4,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem,
        loyaltyDiscountAmount,
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Authentication required')
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/pos/sales/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create sale')
      }

      // Extract transaction details from API response
      const orderNumber = result.order?.order_number || result.sale?.order_number || 'Unknown'
      const transactionNumber = result.transaction?.transaction_number

      // Calculate loyalty points earned from the sale
      const loyaltyPointsAdded = result.loyalty?.points_earned || 0

      // Prepare success modal data
      setSuccessData({
        orderNumber,
        transactionNumber,
        total,
        paymentMethod: paymentData.paymentMethod,
        authorizationCode: paymentData.authorizationCode,
        cardType: paymentData.cardType,
        cardLast4: paymentData.cardLast4,
        itemCount,
        processorName: currentProcessor?.processor_name,
        inventoryDeducted: true, // Backend handles this automatically
        loyaltyPointsAdded,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem || undefined,
      })

      // Clear cart and close payment modal
      clearCart()
      setSelectedCustomer(null)
      resetLoyalty()
      closeModal()

      // Show success modal (haptic is triggered by modal)
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Checkout error:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to process sale'}`)
    } finally {
      setProcessingCheckout(false)
    }
  }

  const handleClearCart = useCallback(() => {
    clearCart()
    setSelectedCustomer(null)
    resetLoyalty()
  }, [clearCart, resetLoyalty])

  // ========================================
  // FILTER HANDLERS - Now using consolidated hook!
  // ========================================
  const handleCategoryPress = useCallback(
    (category: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setCategory(category)
      setShowCategoryDropdown(false)
    },
    [setCategory]
  )

  const handleClearCustomer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCustomer(null)
  }, [])

  const handleClearFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    clearFilters()
  }, [clearFilters])

  // ========================================
  // RENDER HELPERS
  // ========================================
  const renderCashDrawerModals = () => (
    <>
      <OpenCashDrawerModal
        visible={isModalOpen('cashDrawerOpen')}
        onSubmit={handleCashDrawerSubmit}
        onCancel={handleCashDrawerCancel}
      />
      {sessionData && (
        <CloseCashDrawerModal
          visible={isModalOpen('cashDrawerClose')}
          sessionNumber={sessionData.sessionNumber}
          totalSales={sessionData.totalSales}
          totalCash={sessionData.totalCash}
          openingCash={sessionData.openingCash}
          onSubmit={handleCloseDrawerSubmit}
          onCancel={handleCloseDrawerCancel}
        />
      )}
      <POSSaleSuccessModal
        visible={showSuccessModal}
        saleData={successData}
        onClose={() => setShowSuccessModal(false)}
      />
    </>
  )

  // ========================================
  // RENDER SCREENS
  // ========================================
  if (!sessionInfo && !isModalOpen('registerSelector')) {
    return (
      <>
        <POSLocationSelector
          locations={locations}
          vendorLogo={vendor?.logo_url}
          vendorName={vendor?.store_name}
          onLocationSelected={handleLocationSelected}
        />
        {renderCashDrawerModals()}
      </>
    )
  }

  if (isModalOpen('registerSelector')) {
    return (
      <>
        <POSRegisterSelector
          locationId={sessionInfo!.locationId}
          locationName={sessionInfo!.locationName}
          vendorLogo={vendor?.logo_url}
          onRegisterSelected={handleRegisterSelected}
          onBackToLocationSelector={handleBackToLocationSelector}
        />
        {renderCashDrawerModals()}
      </>
    )
  }

  // ========================================
  // MAIN POS INTERFACE
  // ========================================
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {renderCashDrawerModals()}

      {/* Unified Customer Selector */}
      {vendor && (
        <POSUnifiedCustomerSelector
          visible={isModalOpen('customerSelector')}
          vendorId={vendor.id}
          onCustomerSelected={(customer) => {
            setSelectedCustomer(customer)
            closeModal()
          }}
          onNoMatchFoundWithData={(_data: AAMVAData) => {
            closeModal()
          }}
          onClose={closeModal}
        />
      )}

      {/* Payment Modal */}
      <POSPaymentModal
        visible={isModalOpen('payment')}
        total={total}
        subtotal={subtotal}
        taxAmount={taxAmount}
        taxRate={taxRate}
        taxName={sessionInfo?.taxName}
        loyaltyDiscountAmount={loyaltyDiscountAmount}
        loyaltyPointsEarned={loyaltyPointsEarned}
        currentLoyaltyPoints={selectedCustomer?.loyalty_points || 0}
        pointValue={loyaltyProgram?.point_value || 0.01}
        maxRedeemablePoints={getMaxRedeemablePoints(subtotal)}
        itemCount={itemCount}
        customerName={
          selectedCustomer
            ? selectedCustomer.display_name ||
              `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim() ||
              selectedCustomer.email
            : undefined
        }
        onApplyLoyaltyPoints={setLoyaltyPointsToRedeem}
        onPaymentComplete={handlePaymentComplete}
        onCancel={closeModal}
        hasPaymentProcessor={true}
        locationId={sessionInfo?.locationId}
        registerId={sessionInfo?.registerId}
      />

      {/* Category Dropdown Modal */}
      <Modal
        visible={showCategoryDropdown}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <Pressable style={styles.categoryModalOverlay} onPress={() => setShowCategoryDropdown(false)}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <View style={[styles.categoryModalContent, { left: isTablet ? width / 2 - 200 : width / 2 - 150, top: isTablet ? 100 : 120 }]}>
          <View style={styles.categoryModalBg}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          </View>

          <View style={styles.categoryModalHandle} />
          <Text style={styles.categoryModalTitle}>Category</Text>

          <ScrollView style={styles.categoryModalScroll} contentContainerStyle={styles.categoryModalList} showsVerticalScrollIndicator={false}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.7}
                style={[styles.categoryModalItem, filters.category === category && styles.categoryModalItemActive]}
              >
                <Text style={[styles.categoryModalItemText, filters.category === category && styles.categoryModalItemTextActive]}>{category}</Text>
                {filters.category === category && <Text style={styles.categoryModalItemCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Main Layout */}
      <Animated.View style={[styles.mainLayout, { opacity: fadeAnim }]}>
        {/* Left Column - Products */}
        <View style={styles.leftColumn}>
          <POSProductGrid
            products={filteredProducts as any}
            loading={loading}
            onAddToCart={addToCart}
            activeFilters={{
              category: filters.category,
              strainTypes: filters.strainTypes,
              consistencies: filters.consistencies,
              flavors: filters.flavors,
            }}
            matchingFiltersMap={matchingFiltersMap}
          />

          {/* Search Bar with Filters */}
          <POSSearchBar
            searchQuery={filters.searchQuery}
            onSearchChange={setSearchQuery}
            activeFilterCount={activeFilterCount}
            onFilterPress={() => {
              // Toggle filters dropdown (handled inline for now)
            }}
            onClearFilters={handleClearFilters}
          >
            {/* Filters dropdown content would go here */}
          </POSSearchBar>
        </View>

        {/* Right Column - Cart */}
        <View style={styles.rightColumn}>
          <POSCart
            cart={cart}
            subtotal={subtotal}
            taxAmount={taxAmount}
            total={total}
            itemCount={itemCount}
            taxRate={taxRate}
            selectedCustomer={selectedCustomer}
            loyaltyPointsToRedeem={loyaltyPointsToRedeem}
            loyaltyProgram={loyaltyProgram}
            loyaltyDiscountAmount={loyaltyDiscountAmount}
            discountingItemId={discountingItemId}
            onAddItem={(id) => updateQuantity(id, 1)}
            onRemoveItem={(id) => updateQuantity(id, -1)}
            onChangeTier={changeTier}
            onApplyDiscount={applyManualDiscount}
            onRemoveDiscount={removeManualDiscount}
            onSelectCustomer={() => openModal('customerSelector')}
            onClearCustomer={handleClearCustomer}
            onSetLoyaltyPoints={setLoyaltyPointsToRedeem}
            onCheckout={handleCheckout}
            onClearCart={handleClearCart}
            onStartDiscounting={setDiscountingItemId}
            onCancelDiscounting={() => setDiscountingItemId(null)}
            onEndSession={handleEndSession}
            maxRedeemablePoints={getMaxRedeemablePoints(subtotal)}
            products={products}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

// ========================================
// STYLES - Using Design System Tokens
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  leftColumn: {
    flex: 1,
    position: 'relative',
  },
  rightColumn: {
    width: isTablet ? 380 : 320,
    paddingRight: spacing.xs,
  },
  categoryModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryModalContent: {
    position: 'absolute',
    width: isTablet ? 400 : 300,
    maxHeight: isTablet ? 500 : 400,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: borderWidth.regular,
    borderColor: colors.border.emphasis,
  },
  categoryModalBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.tertiary,
  },
  categoryModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.text.placeholder,
    borderRadius: radius.xs,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: colors.text.primary,
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  categoryModalScroll: {
    maxHeight: 300,
  },
  categoryModalList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  categoryModalItem: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.glass.ultraThin,
    borderWidth: borderWidth.regular,
    borderColor: colors.border.subtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryModalItemActive: {
    backgroundColor: colors.glass.thick,
    borderColor: colors.border.strong,
  },
  categoryModalItemText: {
    fontSize: 14,
    fontWeight: '300',
    color: colors.text.quaternary,
    letterSpacing: 0.3,
  },
  categoryModalItemTextActive: {
    color: colors.text.primary,
    fontWeight: '400',
  },
  categoryModalItemCheck: {
    fontSize: 16,
    color: colors.text.primary,
  },
})
