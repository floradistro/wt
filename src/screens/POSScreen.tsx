import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Modal, Pressable } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useState, useRef, useEffect } from 'react'
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
  POSCustomerSelector,
  POSPaymentModal,
  POSIDScannerModal,
  POSCart,
  POSSearchBar,
  POSProductGrid,
} from '@/components/pos'
import type { PaymentData } from '@/components/pos/POSPaymentModal'

// POS Hooks
import { useCart, useLoyalty } from '@/hooks/pos'

// POS Types
import type { Vendor, Customer, Location, Product, PricingTier, SessionInfo, ProductField } from '@/types/pos'

const { width, height: _height } = Dimensions.get('window')
const isTablet = width > 600

// POSScreen Component
export function POSScreen() {
  const { user } = useAuth()
  const _insets = useSafeAreaInsets()

  // Session & Setup State
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

  // Product State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>(['All'])
  const [loading, setLoading] = useState(true)

  // Filter State
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false)
  const [selectedStrainTypes, setSelectedStrainTypes] = useState<string[]>([])
  const [selectedConsistencies, setSelectedConsistencies] = useState<string[]>([])
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)
  const [showIDScanner, setShowIDScanner] = useState(false)

  // Modal State
  const [showRegisterSelector, setShowRegisterSelector] = useState(false)
  const [showCashDrawerModal, setShowCashDrawerModal] = useState(false)
  const [showCloseDrawerModal, setShowCloseDrawerModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [_processingCheckout, setProcessingCheckout] = useState(false)

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current

  // JOBS PRINCIPLE: Use custom hooks for cart and loyalty logic
  const {
    cart,
    discountingItemId,
    addToCart,
    updateQuantity,
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

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  // Load vendor and locations
  useEffect(() => {
    loadVendorAndLocations()
  }, [])

  // Load products when session is set
  useEffect(() => {
    if (sessionInfo?.locationId) {
      loadProducts()
    }
  }, [sessionInfo?.locationId])

  // JOBS PRINCIPLE: Mission-critical payment processor monitoring
  // Update location ID and register ID, restart monitoring when session changes
  useEffect(() => {
    if (sessionInfo?.locationId && sessionInfo?.registerId) {

      usePaymentProcessor.getState().setLocationId(sessionInfo.locationId)
      usePaymentProcessor.getState().setRegisterId(sessionInfo.registerId)

      // Stop existing monitoring
      stopPaymentProcessorMonitoring()

      // Start with new location ID and register ID
      startPaymentProcessorMonitoring(sessionInfo.locationId, sessionInfo.registerId)
    }

    return () => {
      stopPaymentProcessorMonitoring()
    }
  }, [sessionInfo?.locationId, sessionInfo?.registerId])

  const loadVendorAndLocations = async () => {
    try {
      setLoading(true)


      // Get user's vendor by email (Auth user.id != custom users table id)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, vendor_id, vendors(id, store_name, logo_url)')
        .eq('email', user?.email)
        .single()

      if (userError) {
        console.error('❌ User query error:', userError)
        throw userError
      }


      const vendorData = userData.vendors as any
      setVendor(vendorData)
      setCustomUserId(userData.id) // Store custom user ID for session creation


      // Admin users (vendor_owner, vendor_admin) get ALL locations for their vendor
      // Regular users only get their assigned locations
      const isAdmin = ['vendor_owner', 'vendor_admin'].includes(userData.role)

      let locs: Location[] = []

      if (isAdmin) {

        // Get all active, POS-enabled locations for this vendor
        const { data: allLocations, error: allLocationsError } = await supabase
          .from('locations')
          .select('id, name, address_line1, city, state, is_primary')
          .eq('vendor_id', userData.vendor_id)
          .eq('is_active', true)
          .eq('pos_enabled', true)
          .order('is_primary', { ascending: false })
          .order('name')

        if (allLocationsError) {
          console.error('❌ All locations query error:', allLocationsError)
          throw allLocationsError
        }

        locs = allLocations || []
      } else {

        // Get user's assigned locations
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

        if (locationsError) {
          console.error('❌ Locations query error:', locationsError)
          throw locationsError
        }

        locs = (locationsData || [])
          .map((ul: any) => ul.locations)
          .filter(Boolean)

      }

      setLocations(locs)

    } catch (error) {
      console.error('💥 Error loading vendor/locations:', error)
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

      const transformedProducts: Product[] = (inventoryData || [])
        .filter((inv: any) => inv.products)
        .map((inv: any) => {
          const pricingData = inv.products.pricing_data || {}
          const pricingTiers: PricingTier[] = (pricingData.tiers || [])
            .filter((tier: any) => tier.enabled !== false && tier.price)
            .map((tier: any) => ({
              break_id: tier.id,
              label: tier.label,
              qty: tier.quantity || 1,
              price: parseFloat(tier.price),
              sort_order: tier.sort_order || 0,
            }))
            .sort((a: any, b: any) => a.sort_order - b.sort_order)

          let category = null
          if (inv.products.primary_category) {
            category = inv.products.primary_category.name
          } else {
            const productCategories = inv.products.product_categories || []
            if (productCategories.length > 0 && productCategories[0].categories) {
              category = productCategories[0].categories.name
            }
          }

          const vendor = inv.products.vendors || null

          // Parse custom fields from JSONB object
          // custom_fields is an object like { "strain_type": "Indica", "terpenes": "..." }
          // Convert to array of { label, value, type } objects
          const customFields = inv.products.custom_fields || {}
          const fields: ProductField[] = Object.entries(customFields).map(([key, value]) => ({
            label: key,
            value: String(value || ''),
            type: typeof value === 'number' ? 'number' : 'text',
          }))

          return {
            id: inv.products.id,
            name: inv.products.name,
            price: inv.products.regular_price || 0,
            image_url: inv.products.featured_image,
            category: category,
            description: inv.products.description || null,
            short_description: inv.products.short_description || null,
            inventory_quantity: inv.available_quantity,
            inventory_id: inv.id,
            pricing_tiers: pricingTiers,
            vendor: vendor
              ? {
                  id: vendor.id,
                  store_name: vendor.store_name,
                  logo_url: vendor.logo_url,
                }
              : null,
            fields: fields,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      setProducts(transformedProducts)

      const uniqueCategories = ['All', ...new Set(
        transformedProducts
          .map(p => p.category)
          .filter((c): c is string => c !== null)
      )]
      setCategories(uniqueCategories)

    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLocationSelected = async (locationId: string, locationName: string) => {
    // Jobs Principle: Load tax configuration immediately
    try {
      const { data: location } = await supabase
        .from('locations')
        .select('settings')
        .eq('id', locationId)
        .single()

      // Extract tax rate from location settings
      const taxConfig = location?.settings?.tax_config || {}
      const taxRate = taxConfig.sales_tax_rate || 0.08 // Fallback to 8% if not configured


      setSessionInfo(prev => ({
        ...prev!,
        locationId,
        locationName,
        taxRate
      }))
      setShowRegisterSelector(true)
    } catch (error) {
      console.error('Error loading location tax config:', error)
      // Fallback: Set session info with default tax rate
      setSessionInfo(prev => ({
        ...prev!,
        locationId,
        locationName,
        taxRate: 0.08
      }))
      setShowRegisterSelector(true)
    }
  }

  const handleRegisterSelected = async (registerId: string) => {
    try {
      // Get register details
      const { data: registerData } = await supabase
        .from('pos_registers')
        .select('register_name')
        .eq('id', registerId)
        .single()

      const registerName = registerData?.register_name || 'Register'

      // Check if register has an active session
      const { data: activeSession } = await supabase
        .from('pos_sessions')
        .select('id, session_number')
        .eq('register_id', registerId)
        .eq('status', 'open')
        .single()

      if (activeSession) {
        // Join existing session
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

        setSessionInfo(prev => ({
          ...prev!,
          registerId,
          registerName,
          sessionId: activeSession.id,
        }))
        setShowRegisterSelector(false)
      } else {
        // No active session - show cash drawer modal to start new one
        setSelectedRegister({ id: registerId, name: registerName })
        setShowCashDrawerModal(true)
      }
    } catch (error) {
      console.error('Error handling register selection:', error)
    }
  }

  const handleBackToLocationSelector = () => {
    setShowRegisterSelector(false)
    setSessionInfo(null)
  }

  const handleCashDrawerSubmit = async (openingCash: number, notes: string) => {
    if (!selectedRegister || !sessionInfo || !customUserId || !vendor) return

    try {

      // Call get_or_create_session RPC function
      const { data, error } = await supabase.rpc('get_or_create_session', {
        p_location_id: sessionInfo.locationId,
        p_opening_cash: openingCash,
        p_register_id: selectedRegister.id,
        p_user_id: customUserId,
        p_vendor_id: vendor.id,
      })

      if (error) {
        console.error('❌ Error creating session:', error)
        throw error
      }


      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Set session info and close modal
      setSessionInfo(prev => ({
        ...prev!,
        registerId: selectedRegister.id,
        registerName: selectedRegister.name,
        sessionId: data.id,
      }))

      // Store session data for closing later
      setSessionData({
        sessionNumber: data.session_number || 'Unknown',
        totalSales: 0,
        totalCash: 0,
        openingCash: openingCash,
      })

      setShowCashDrawerModal(false)
      setShowRegisterSelector(false)
      setSelectedRegister(null)
    } catch (error) {
      console.error('💥 Error in cash drawer submit:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCashDrawerCancel = () => {
    setShowCashDrawerModal(false)
    setSelectedRegister(null)
  }

  const handleEndSession = async () => {
    if (!sessionInfo?.sessionId) return

    try {
      // Load fresh session data
      const { data: session, error } = await supabase
        .from('pos_sessions')
        .select('session_number, total_sales, total_cash, opening_cash')
        .eq('id', sessionInfo.sessionId)
        .single()

      if (error || !session) {
        console.error('Error loading session data:', error)
        return
      }

      // Update session data and show close drawer modal
      setSessionData({
        sessionNumber: session.session_number,
        totalSales: session.total_sales || 0,
        totalCash: session.total_cash || 0,
        openingCash: session.opening_cash || 0,
      })

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setShowCloseDrawerModal(true)
    } catch (error) {
      console.error('Error in handleEndSession:', error)
    }
  }

  const handleCloseDrawerSubmit = async (closingCash: number, notes: string) => {
    if (!sessionInfo?.sessionId) return

    try {

      // Close the session via database function (uses SECURITY DEFINER to bypass RLS)
      const { data, error } = await supabase.rpc('close_pos_session', {
        p_session_id: sessionInfo.sessionId,
        p_closing_cash: closingCash,
        p_closing_notes: notes || null,
      })

      if (error) {
        console.error('Error calling close_pos_session:', error)
        throw error
      }


      if (!data.success) {
        console.error('Function returned error:', data.error)
        throw new Error(data.error || 'Failed to close session')
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Clear session and return to location selector
      setShowCloseDrawerModal(false)
      setSessionInfo(null)
      setSessionData(null)
      clearCart()
      resetLoyalty()
    } catch (error) {
      console.error('💥 Error closing session:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCloseDrawerCancel = () => {
    setShowCloseDrawerModal(false)
  }

  // JOBS PRINCIPLE: Calculate tax and total (uses values from hooks)
  const subtotalAfterLoyalty = Math.max(0, subtotal - loyaltyDiscountAmount)
  const taxRate = sessionInfo?.taxRate || 0.08
  const taxAmount = subtotalAfterLoyalty * taxRate
  const total = subtotalAfterLoyalty + taxAmount

  const handleCheckout = () => {
    if (cart.length === 0) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowPaymentModal(true)
  }

  const handlePaymentComplete = async (paymentData: PaymentData) => {
    if (!sessionInfo || !vendor || !customUserId) return

    setProcessingCheckout(true)

    try {

      // JOBS PRINCIPLE: Prepare cart items with staff discounts in API format
      const items = cart.map(item => ({
        productId: item.productId,
        productName: item.productName || item.name,
        unitPrice: item.adjustedPrice !== undefined ? item.adjustedPrice : item.price,
        quantity: item.quantity,
        lineTotal: (item.adjustedPrice !== undefined ? item.adjustedPrice : item.price) * item.quantity,
        inventoryId: item.inventoryId,
        // Include staff discount metadata
        manualDiscountType: item.manualDiscountType,
        manualDiscountValue: item.manualDiscountValue,
        originalPrice: item.originalPrice,
      }))

      // Build request payload
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
        // JOBS PRINCIPLE: Include loyalty points redemption
        loyaltyPointsRedeemed: loyaltyPointsToRedeem,
        loyaltyDiscountAmount,
      }


      // Get auth session for API call
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        console.error('❌ No auth session found')
        throw new Error('Authentication required')
      }

      // Call sales API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/pos/sales/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create sale')
      }


      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Clear cart and close modals
      clearCart()
      setSelectedCustomer(null)
      resetLoyalty()
      setShowPaymentModal(false)

      // Show success alert
      alert(`Sale Complete!\n\nOrder #${result.sale.order_number}\nTotal: $${total.toFixed(2)}`)
    } catch (error) {
      console.error('💥 Checkout error:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to process sale'}`)
    } finally {
      setProcessingCheckout(false)
    }
  }

  const handleClearCart = () => {
    clearCart()
    setSelectedCustomer(null)
    resetLoyalty()
  }

  // Get available custom field values
  const availableStrainTypes = Array.from(new Set(
    products
      .map(p => p.fields?.find(f => f.label === 'strain_type')?.value)
      .filter((v): v is string => !!v)
  )).sort()

  const availableConsistencies = Array.from(new Set(
    products
      .filter(p => p.category === 'Concentrates')
      .map(p => p.fields?.find(f => f.label === 'consistency')?.value)
      .filter((v): v is string => !!v)
  )).sort()

  const availableFlavors = Array.from(new Set(
    products
      .map(p => p.fields?.find(f => f.label === 'flavor')?.value)
      .filter((v): v is string => !!v)
  )).sort()

  const filteredProducts = products.filter((p) => {
    // Search filter
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())

    // Category filter
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory

    // Strain type filter
    if (selectedStrainTypes.length > 0) {
      const strainType = p.fields?.find(f => f.label === 'strain_type')?.value
      if (!strainType || !selectedStrainTypes.includes(strainType)) {
        return false
      }
    }

    // Consistency filter
    if (selectedConsistencies.length > 0) {
      const consistency = p.fields?.find(f => f.label === 'consistency')?.value
      if (!consistency || !selectedConsistencies.includes(consistency)) {
        return false
      }
    }

    // Flavor filter
    if (selectedFlavors.length > 0) {
      const flavor = p.fields?.find(f => f.label === 'flavor')?.value
      if (!flavor || !selectedFlavors.includes(flavor)) {
        return false
      }
    }

    return matchesSearch && matchesCategory
  })

  const handleCategoryPress = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCategory(category)
    setShowCategoryDropdown(false)
  }

  // Steve Jobs Principle: Seamless customer clearing - just a tap
  const handleClearCustomer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCustomer(null)
  }

  // Jobs Principle: Clear all filters with one action
  const handleClearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCategory('All')
    setSelectedStrainTypes([])
    setSelectedConsistencies([])
    setSelectedFlavors([])
    setShowFiltersDropdown(false)
  }

  // Count active filters (Jobs Principle: Show user what's active)
  const activeFilterCount = [
    selectedCategory !== 'All',
    selectedStrainTypes.length > 0,
    selectedConsistencies.length > 0,
    selectedFlavors.length > 0,
  ].filter(Boolean).length

  // Jobs Principle: Calculate matching filters map for product grid
  const matchingFiltersMap = new Map<string, string[]>()
  filteredProducts.forEach((product) => {
    const matchingFilters: string[] = []

    // Check if category filter is active and matches
    if (selectedCategory !== 'All' && product.category === selectedCategory) {
      matchingFilters.push(selectedCategory)
    }

    // Check strain type matches
    const productStrainType = product.fields?.find(f => f.label === 'strain_type')?.value
    if (productStrainType && selectedStrainTypes.includes(productStrainType)) {
      matchingFilters.push(productStrainType)
    }

    // Check consistency matches
    const productConsistency = product.fields?.find(f => f.label === 'consistency')?.value
    if (productConsistency && selectedConsistencies.includes(productConsistency)) {
      matchingFilters.push(productConsistency)
    }

    // Check flavor matches
    const productFlavor = product.fields?.find(f => f.label === 'flavor')?.value
    if (productFlavor && selectedFlavors.includes(productFlavor)) {
      matchingFilters.push(productFlavor)
    }

    if (matchingFilters.length > 0) {
      matchingFiltersMap.set(product.id, matchingFilters)
    }
  })

  // Render cash drawer modals globally so they work on any screen
  const renderCashDrawerModals = () => (
    <>
      <OpenCashDrawerModal
        visible={showCashDrawerModal}
        onSubmit={handleCashDrawerSubmit}
        onCancel={handleCashDrawerCancel}
      />
      {sessionData && (
        <CloseCashDrawerModal
          visible={showCloseDrawerModal}
          sessionNumber={sessionData.sessionNumber}
          totalSales={sessionData.totalSales}
          totalCash={sessionData.totalCash}
          openingCash={sessionData.openingCash}
          onSubmit={handleCloseDrawerSubmit}
          onCancel={handleCloseDrawerCancel}
        />
      )}
    </>
  )

  // Show location selector if no session
  if (!sessionInfo && !showRegisterSelector) {
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

  // Show register selector if location selected but no register
  if (showRegisterSelector) {
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

  // Show POS interface
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* JOBS: Removed 'bottom' edge to eliminate gap under app */}
      {renderCashDrawerModals()}

      {/* Customer Selector Modal */}
      {vendor && (
        <POSCustomerSelector
          visible={showCustomerSelector}
          vendorId={vendor.id}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={(customer) => setSelectedCustomer(customer)}
          onClose={() => setShowCustomerSelector(false)}
        />
      )}

      {/* ID Scanner Modal - Jobs Principle: Integrated scanning */}
      {vendor && (
        <POSIDScannerModal
          visible={showIDScanner}
          vendorId={vendor.id}
          onCustomerFound={(customer) => {
            setSelectedCustomer(customer)
            setShowIDScanner(false)
          }}
          onNoMatchFoundWithData={(_data: AAMVAData) => {
            // TODO: Open new customer form with pre-filled data
            setShowIDScanner(false)
          }}
          onClose={() => setShowIDScanner(false)}
        />
      )}

      {/* Payment Modal */}
      <POSPaymentModal
        visible={showPaymentModal}
        total={total}
        onPaymentComplete={handlePaymentComplete}
        onCancel={() => setShowPaymentModal(false)}
        hasPaymentProcessor={true} // JOBS: Processors are live
        locationId={sessionInfo?.locationId}
        registerId={sessionInfo?.registerId}
      />

      {/* Category Dropdown Modal - Jobs Principle: Landscape-optimized clean selection */}
      <Modal
        visible={showCategoryDropdown}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <Pressable
          style={styles.categoryModalOverlay}
          onPress={() => setShowCategoryDropdown(false)}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <View style={[styles.categoryModalContent, {
          left: isTablet ? width / 2 - 200 : width / 2 - 150,
          top: isTablet ? 100 : 120,
        }]}>
          <View style={styles.categoryModalBg}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          </View>

          <View style={styles.categoryModalHandle} />

          <Text style={styles.categoryModalTitle}>Category</Text>

          <ScrollView
            style={styles.categoryModalScroll}
            contentContainerStyle={styles.categoryModalList}
            showsVerticalScrollIndicator={false}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.7}
                style={[
                  styles.categoryModalItem,
                  selectedCategory === category && styles.categoryModalItemActive
                ]}
              >
                <Text style={[
                  styles.categoryModalItemText,
                  selectedCategory === category && styles.categoryModalItemTextActive
                ]}>
                  {category}
                </Text>
                {selectedCategory === category && (
                  <Text style={styles.categoryModalItemCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Jobs Principle: Two-column layout - Products left, Cart right (full height) */}
      <Animated.View style={[styles.mainLayout, {
        opacity: fadeAnim,
      }]}>
        {/* Left Column - Search + Products */}
        <View style={styles.leftColumn}>
          {/* Products Grid - Behind search bar */}
          <POSProductGrid
            products={filteredProducts as any}
            loading={loading}
            onAddToCart={addToCart}
            activeFilters={{
              category: selectedCategory,
              strainTypes: selectedStrainTypes,
              consistencies: selectedConsistencies,
              flavors: selectedFlavors,
            }}
            matchingFiltersMap={matchingFiltersMap}
          />

          {/* JOBS PRINCIPLE: Unified Search Bar - One seamless pill */}
          <POSSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeFilterCount={activeFilterCount}
            onFilterPress={() => setShowFiltersDropdown(!showFiltersDropdown)}
            onClearFilters={handleClearFilters}
          >
            {/* Jobs Principle: Filters Dropdown - Elegant & Organized */}
            {showFiltersDropdown && (
              <View style={styles.filtersDropdownContainer}>
                <View style={styles.filtersDropdownBg}>
                  <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                </View>

                {/* Header */}
                <View style={styles.filtersDropdownHeader}>
                  <Text style={styles.filtersDropdownTitle}>Filters</Text>
                  {activeFilterCount > 0 && (
                    <TouchableOpacity onPress={handleClearFilters} activeOpacity={0.7}>
                      <Text style={styles.filtersDropdownClearAll}>Clear All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  style={styles.filtersContentScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Category Filter */}
                  <View style={styles.filtersSection}>
                    <Text style={styles.filtersSectionLabel}>Category</Text>
                    <View>
                      {categories.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => handleCategoryPress(cat)}
                          activeOpacity={0.7}
                          style={[
                            styles.filterOption,
                            selectedCategory === cat && styles.filterOptionActive
                          ]}
                        >
                          <Text style={[
                            styles.filterOptionText,
                            selectedCategory === cat && styles.filterOptionTextActive
                          ]}>
                            {cat === 'All' ? 'All Categories' : cat}
                          </Text>
                          {selectedCategory === cat && (
                            <View style={styles.filterOptionIndicator}>
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Strain Type Filter - Multiple selection */}
                  {availableStrainTypes.length > 0 && (
                    <View style={styles.filtersSection}>
                      <Text style={styles.filtersSectionLabel}>Strain Type</Text>
                      <View>
                        {availableStrainTypes.map((strain) => {
                          const isSelected = selectedStrainTypes.includes(strain)
                          return (
                            <TouchableOpacity
                              key={strain}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                if (isSelected) {
                                  setSelectedStrainTypes(selectedStrainTypes.filter(s => s !== strain))
                                } else {
                                  setSelectedStrainTypes([...selectedStrainTypes, strain])
                                }
                              }}
                              activeOpacity={0.7}
                              style={[
                                styles.filterOption,
                                isSelected && styles.filterOptionActive
                              ]}
                            >
                              <Text style={[
                                styles.filterOptionText,
                                isSelected && styles.filterOptionTextActive
                              ]}>
                                {strain}
                              </Text>
                              {isSelected && (
                                <View style={styles.filterOptionIndicator}>
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✓</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </View>
                  )}

                  {/* Consistency Filter - Multiple selection */}
                  {availableConsistencies.length > 0 && (
                    <View style={styles.filtersSection}>
                      <Text style={styles.filtersSectionLabel}>Consistency</Text>
                      <View>
                        {availableConsistencies.map((consistency) => {
                          const isSelected = selectedConsistencies.includes(consistency)
                          return (
                            <TouchableOpacity
                              key={consistency}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                if (isSelected) {
                                  setSelectedConsistencies(selectedConsistencies.filter(c => c !== consistency))
                                } else {
                                  setSelectedConsistencies([...selectedConsistencies, consistency])
                                }
                              }}
                              activeOpacity={0.7}
                              style={[
                                styles.filterOption,
                                isSelected && styles.filterOptionActive
                              ]}
                            >
                              <Text style={[
                                styles.filterOptionText,
                                isSelected && styles.filterOptionTextActive
                              ]}>
                                {consistency}
                              </Text>
                              {isSelected && (
                                <View style={styles.filterOptionIndicator}>
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✓</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </View>
                  )}

                  {/* Flavor Filter - Multiple selection */}
                  {availableFlavors.length > 0 && (
                    <View style={styles.filtersSection}>
                      <Text style={styles.filtersSectionLabel}>Flavor</Text>
                      <View>
                        {availableFlavors.map((flavor) => {
                          const isSelected = selectedFlavors.includes(flavor)
                          return (
                            <TouchableOpacity
                              key={flavor}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                if (isSelected) {
                                  setSelectedFlavors(selectedFlavors.filter(f => f !== flavor))
                                } else {
                                  setSelectedFlavors([...selectedFlavors, flavor])
                                }
                              }}
                              activeOpacity={0.7}
                              style={[
                                styles.filterOption,
                                isSelected && styles.filterOptionActive
                              ]}
                            >
                              <Text style={[
                                styles.filterOptionText,
                                isSelected && styles.filterOptionTextActive
                              ]}>
                                {flavor}
                              </Text>
                              {isSelected && (
                                <View style={styles.filterOptionIndicator}>
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✓</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </POSSearchBar>

        </View>

        {/* Right Column - Full Height Cart */}
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
            onApplyDiscount={applyManualDiscount}
            onRemoveDiscount={removeManualDiscount}
            onSelectCustomer={() => setShowCustomerSelector(true)}
            onClearCustomer={handleClearCustomer}
            onSetLoyaltyPoints={setLoyaltyPointsToRedeem}
            onCheckout={handleCheckout}
            onClearCart={handleClearCart}
            onOpenIDScanner={() => setShowIDScanner(true)}
            onStartDiscounting={setDiscountingItemId}
            onCancelDiscounting={() => setDiscountingItemId(null)}
            onEndSession={handleEndSession}
            maxRedeemablePoints={getMaxRedeemablePoints(subtotal)}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Jobs Principle: Two-column layout - Products left, Cart right (full height)
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },

  // Left Column - Search + Products
  leftColumn: {
    flex: 1,
    position: 'relative', // iOS: Allow absolute positioning for floating search
  },

  // iOS Principle: Floating search bar like Settings
  filtersDropdownContainer: {
    marginHorizontal: isTablet ? 16 : 12, // JOBS: Match search bar padding
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 24, // JOBS: More rounded like search bar
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)', // iOS: Subtle liquid glass
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  filtersDropdownBg: {
    ...StyleSheet.absoluteFillObject,
    // iOS: Glass effect via BlurView (keep in JSX)
  },
  filtersDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  filtersDropdownTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  filtersDropdownClearAll: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,60,60,0.95)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filtersContentScroll: {
    maxHeight: 360,
  },
  filtersSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  filtersSectionLabel: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  filterOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16, // JOBS: More rounded pills
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', // iOS: Liquid glass
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterOptionActive: {
    backgroundColor: 'rgba(10,132,255,0.2)', // iOS: Blue glass when active
    borderColor: 'rgba(10,132,255,0.4)',
    borderWidth: 0,
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  filterOptionTextActive: {
    color: 'rgba(10,132,255,1)', // iOS: Blue text when active
    fontWeight: '500', // iOS: Semibold
  },
  filterOptionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10, // iOS: Circle checkmark container
    backgroundColor: 'rgba(10,132,255,1)', // iOS: Pure blue fill
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  categoryModalBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  categoryModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  categoryModalScroll: {
    maxHeight: 300,
  },
  categoryModalList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  categoryModalItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryModalItemActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  categoryModalItemText: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  categoryModalItemTextActive: {
    color: '#fff',
    fontWeight: '400',
  },
  categoryModalItemCheck: {
    fontSize: 16,
    color: '#fff',
  },
  rightColumn: {
    width: isTablet ? 380 : 320,
    paddingTop: 8,
    paddingBottom: 4,
    paddingRight: 8, // JOBS: Breathing room from screen edge
  },
})
