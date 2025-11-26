/**
 * CreateTransferModal Component
 *
 * SHOPPING FLOW PATTERN ✅
 * 1. Select source location
 * 2. Browse products by category (shopping experience)
 * 3. Add products to transfer
 * 4. Select destination location
 *
 * NO auto-focus keyboard - user browses first
 */

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useProductsStore } from '@/stores/products.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useTransfersStore } from '@/stores/inventory-transfers.store'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'
import { useCategories } from '@/hooks/useCategories'
import { logger } from '@/utils/logger'
import type { Product } from '@/types/pos'

interface TransferLineItem {
  id: string
  product: Product
  quantity: number
}

type ShoppingView = 'products'

/**
 * CreateTransferModal - ZERO PROPS ✅
 * Shopping flow: Location → Browse → Add → Destination
 */
export function CreateTransferModal() {
  const insets = useSafeAreaInsets()

  // ========================================
  // HOOKS & STORES - ZERO PROP DRILLING ✅
  // ========================================
  const { user, vendor, locations } = useAppAuth()
  const vendorId = vendor?.id || ''
  const showModal = useProductsScreenStore((state) => state.showCreateTransfer)
  const selectedTransfer = useProductsScreenStore((state) => state.selectedTransfer)

  // Real Zustand stores
  const products = useProductsStore((state) => state.products)
  const loadProducts = useProductsStore((state) => state.loadProducts)
  const createTransfer = useTransfersStore((state) => state.createTransfer)
  const updateTransfer = useTransfersStore((state) => state.updateTransfer)
  const approveTransfer = useTransfersStore((state) => state.approveTransfer)
  const { categories } = useCategories({ includeGlobal: true, parentId: null })

  // Editing mode flag
  const isEditingDraft = selectedTransfer?.status === 'draft'

  // ========================================
  // LOCAL STATE
  // ========================================
  const [selectedSourceLocationId, setSelectedSourceLocationId] = useState('')
  const [selectedDestLocationId, setSelectedDestLocationId] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [shoppingView, setShoppingView] = useState<ShoppingView>('products')
  const [lineItems, setLineItems] = useState<TransferLineItem[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shopping state
  const [productSearch, setProductSearch] = useState('')
  const [targetQuantity, setTargetQuantity] = useState('')
  const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({})
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const [showDestDropdown, setShowDestDropdown] = useState(false)
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null)
  const [editingCartQty, setEditingCartQty] = useState('')
  const manuallyEditedProducts = useRef<Set<string>>(new Set())
  const isSubmittingRef = useRef(false)
  const isDismissingRef = useRef(false)
  const inputRefs = useRef<Record<string, any>>({})
  const currentValueRef = useRef<{ productId: string; value: string } | null>(null)
  const lockoutRef = useRef(false)
  const shouldProcessOnHide = useRef(false)

  // Load products when source location is selected
  useEffect(() => {
    if (showModal && selectedSourceLocationId) {
      loadProducts(selectedSourceLocationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, selectedSourceLocationId])


  // Reset state when modal opens/closes OR pre-populate when editing draft
  useEffect(() => {
    console.log('[CreateTransferModal] useEffect triggered', {
      showModal,
      isEditingDraft,
      hasSelectedTransfer: !!selectedTransfer,
      selectedTransferId: selectedTransfer?.id,
      availableLocations: locations?.length || 0,
    })

    if (showModal) {
      if (isEditingDraft && selectedTransfer) {
        // Pre-populate form with draft transfer data
        console.log('[CreateTransferModal] Pre-populating draft transfer', {
          transferId: selectedTransfer.id,
          sourceLocationId: selectedTransfer.source_location_id,
          destLocationId: selectedTransfer.destination_location_id,
          itemCount: selectedTransfer.items?.length || 0,
          availableLocationIds: locations?.map(l => l.id) || [],
        })

        // Verify locations exist before setting
        const sourceExists = locations?.some(l => l.id === selectedTransfer.source_location_id)
        const destExists = locations?.some(l => l.id === selectedTransfer.destination_location_id)

        console.log('[CreateTransferModal] Location validation', {
          sourceExists,
          destExists,
          sourceId: selectedTransfer.source_location_id,
          destId: selectedTransfer.destination_location_id,
        })

        setSelectedSourceLocationId(selectedTransfer.source_location_id)
        setSelectedDestLocationId(selectedTransfer.destination_location_id)
        setNotes(selectedTransfer.notes || '')

        // Convert transfer items to line items (only include items with products)
        const draftLineItems: TransferLineItem[] = (selectedTransfer.items || [])
          .filter(item => item.product) // Only include items that have product data
          .map(item => ({
            id: item.id,
            product: item.product!,
            quantity: item.quantity,
          }))
        setLineItems(draftLineItems)

        console.log('[CreateTransferModal] Draft pre-populated - STATE SET', {
          sourceLocationId: selectedTransfer.source_location_id,
          destLocationId: selectedTransfer.destination_location_id,
          lineItems: draftLineItems.length,
        })

        // Clear other state
        setSelectedCategoryIds([])
        setShoppingView('products')
        setProductSearch('')
        setEditingQuantities({})
        setShowSourceDropdown(false)
        setShowDestDropdown(false)
        setError(null)
      } else {
        // Reset for new transfer
        console.log('[CreateTransferModal] Resetting for new transfer')
        setSelectedSourceLocationId('')
        setSelectedDestLocationId('')
        setSelectedCategoryIds([])
        setShoppingView('products')
        setLineItems([])
        setNotes('')
        setProductSearch('')
        setEditingQuantities({})
        setShowSourceDropdown(false)
        setShowDestDropdown(false)
        setError(null)
      }
    }
    // Note: NOT including locations in deps because we always set the IDs regardless
    // The memos will resolve them once locations are available
  }, [showModal, isEditingDraft, selectedTransfer?.id])

  const selectedSourceLocation = useMemo(() => {
    const found = locations?.find(l => l.id === selectedSourceLocationId)
    console.log('[CreateTransferModal] Source location memo', {
      selectedSourceLocationId,
      found: !!found,
      foundName: found?.name,
      availableLocationCount: locations?.length || 0,
    })
    return found
  }, [locations, selectedSourceLocationId])

  const selectedDestLocation = useMemo(() => {
    const found = locations?.find(l => l.id === selectedDestLocationId)
    console.log('[CreateTransferModal] Dest location memo', {
      selectedDestLocationId,
      found: !!found,
      foundName: found?.name,
      availableLocationCount: locations?.length || 0,
    })
    return found
  }, [locations, selectedDestLocationId])

  const selectedCategories = useMemo(
    () => categories.filter(c => selectedCategoryIds.includes(c.id)),
    [categories, selectedCategoryIds]
  )

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    if (!selectedSourceLocationId) return []

    let filtered = products

    // Filter by categories (multiple)
    if (selectedCategoryIds.length > 0) {
      filtered = filtered.filter(p =>
        p.primary_category_id && selectedCategoryIds.includes(p.primary_category_id)
      )
    }

    // Filter by search
    if (productSearch.trim()) {
      const query = productSearch.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [products, selectedCategoryIds, productSearch, selectedSourceLocationId])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    products.forEach(p => {
      if (p.primary_category_id) {
        counts.set(p.primary_category_id, (counts.get(p.primary_category_id) || 0) + 1)
      }
    })
    return counts
  }, [products])

  const handleSourceLocationSelect = (locationId: string) => {
    setSelectedSourceLocationId(locationId)
    setShoppingView('products') // Start shopping
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleDestLocationSelect = (locationId: string) => {
    setSelectedDestLocationId(locationId)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(categoryId)) {
        // Deselect - if it's the last one, show all products
        const newSelection = prev.filter(id => id !== categoryId)
        return newSelection
      } else {
        // Select
        return [...prev, categoryId]
      }
    })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleAddToTransfer = (product: Product, quantity: number = 1) => {
    // Check if already in cart
    const existing = lineItems.find(item => item.product.id === product.id)
    if (existing) {
      // Update quantity
      setLineItems(lineItems.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ))
    } else {
      // Add new item
      setLineItems([
        ...lineItems,
        {
          id: `temp-${Date.now()}-${product.id}`,
          product,
          quantity,
        },
      ])
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const handleQuantityInputChange = (productId: string, value: string) => {
    // Allow numbers and single decimal point
    const numericValue = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setEditingQuantities(prev => ({ ...prev, [productId]: numericValue }))

    // Store in ref for synchronous access
    currentValueRef.current = { productId, value: numericValue }
  }

  const handleQuantityInputSubmit = (product: Product, value: string) => {
    // BLOCK any new focuses
    isDismissingRef.current = true

    const qty = parseFloat(value)
    if (!isNaN(qty) && qty > 0) {
      handleAddToTransfer(product, qty)
      // Mark this product as manually edited (opted out of target mode)
      manuallyEditedProducts.current.add(product.id)
    }

    // FORCE dismiss keyboard IMMEDIATELY
    Keyboard.dismiss()

    // Clear editing state
    setEditingQuantities({})

    // Keep dismissing flag active for a moment
    setTimeout(() => {
      isDismissingRef.current = false
    }, 800)
  }

  const handleStartEditingQuantity = (productId: string, currentQty?: number) => {
    console.log('[CreateTransferModal] Opening quantity input', {
      productId,
      currentQty
    })

    const initialValue = currentQty ? String(currentQty) : ''

    // Store in ref
    currentValueRef.current = { productId, value: initialValue }

    // Open the input for this product
    setEditingQuantities({
      [productId]: initialValue
    })
  }

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveLineItem(itemId)
      return
    }
    setLineItems(lineItems.map(item =>
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ))
  }

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id))
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const handleSubmit = async () => {
    if (!selectedSourceLocationId || !selectedDestLocationId || lineItems.length === 0) {
      setError('Please select source location, destination location, and add products')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    try {
      setSaving(true)
      setError(null)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      if (isEditingDraft && selectedTransfer) {
        // Editing existing draft - mark it in_transit
        await useTransfersStore.getState().markInTransit(selectedTransfer.id, '')
      } else {
        // Create new transfer and ship atomically (no intermediate draft state)
        await useTransfersStore.getState().createAndShipTransfer(
          vendorId,
          {
            source_location_id: selectedSourceLocationId,
            destination_location_id: selectedDestLocationId,
            items: lineItems.map(item => ({
              product_id: item.product.id,
              quantity: item.quantity,
            })),
            notes: notes.trim() || undefined,
          },
          '', // tracking number
          user?.id
        )
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      handleClose(true) // Pass true to skip auto-save
    } catch (err) {
      logger.error('Failed to submit transfer', { error: err })
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit transfer'
      setError(errorMessage)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async (skipAutoSave = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Auto-save as draft if user has started filling out the form
    // BUT only if they didn't successfully submit (skip via parameter)
    const hasContent = selectedSourceLocationId && selectedDestLocationId && lineItems.length > 0
    const shouldAutoSave = hasContent && !skipAutoSave && !isEditingDraft

    console.log('[CreateTransferModal] handleClose - Detailed Debug', {
      selectedSourceLocationId,
      selectedDestLocationId,
      lineItemsCount: lineItems.length,
      hasContent,
      skipAutoSave,
      isEditingDraft,
      selectedTransferStatus: selectedTransfer?.status,
      shouldAutoSave,
    })

    if (shouldAutoSave) {
      // User is exiting an incomplete NEW transfer - auto-save as draft
      console.log('[CreateTransferModal] Auto-saving incomplete transfer as draft')
      try {
        const transferId = await createTransfer(
          vendorId,
          {
            source_location_id: selectedSourceLocationId,
            destination_location_id: selectedDestLocationId,
            items: lineItems.map(item => ({
              product_id: item.product.id,
              quantity: item.quantity,
            })),
            notes: notes.trim() || undefined,
          },
          user?.id
        )
        console.log('[CreateTransferModal] Draft saved successfully', { transferId })

        // Real-time subscription will automatically add the transfer to the list
        // No need to manually reload
      } catch (err) {
        console.error('[CreateTransferModal] Failed to auto-save draft', err)
        // Don't block closing on auto-save failure
      }
    } else {
      console.log('[CreateTransferModal] Skipping auto-save (skipAutoSave=true or editing draft)')
    }

    // Clear selection when closing
    productsScreenActions.selectTransfer(null)
    productsScreenActions.closeAllModals()
  }

  const canSave = selectedSourceLocationId && selectedDestLocationId && lineItems.length > 0 && !saving

  if (!showModal) return null

  // ========================================
  // RENDER SINGLE UNIFIED VIEW
  // ========================================
  const renderUnifiedView = () => {
    return (
      <View style={styles.unifiedContainer}>
        {/* Close Button (Absolute Top Right) */}
        <Pressable onPress={() => handleClose()} style={styles.closeButtonAbsolute}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>

        {/* 2-Column Layout: Products (Left) + Cart (Right) */}
        <View style={styles.mainTwoColumnLayout}>
          {/* LEFT COLUMN: Products */}
          <View style={styles.productsColumnFull}>
            {/* Source Location Header */}
            <View style={styles.columnHeader}>
              <View style={styles.columnHeaderRow}>
                <Text style={styles.columnHeaderLabel}>From</Text>
              </View>
              {/* Source Location Selector */}
              <View style={styles.locationSelectorWrapper}>
                <Pressable
                  style={styles.locationSelectorButton}
                  onPress={() => setShowSourceDropdown(!showSourceDropdown)}
                >
                  <Text style={styles.locationSelectorButtonText}>
                    {selectedSourceLocation?.name || 'Select Source Location'}
                  </Text>
                  <Text style={styles.locationSelectorIcon}>{showSourceDropdown ? '⌃' : '⌄'}</Text>
                </Pressable>

                {/* Source Location Dropdown */}
                {showSourceDropdown && (
                  <View style={styles.locationDropdownOverlay}>
                    <ScrollView style={styles.locationDropdownScroll} showsVerticalScrollIndicator={false}>
                      {locations.map(location => {
                        const isSelected = selectedSourceLocationId === location.id
                        const isDisabled = selectedDestLocationId === location.id
                        return (
                          <Pressable
                            key={location.id}
                            style={[
                              styles.locationDropdownItem,
                              isSelected && styles.locationDropdownItemSelected,
                              isDisabled && styles.locationDropdownItemDisabled,
                            ]}
                            onPress={() => {
                              if (!isDisabled) {
                                handleSourceLocationSelect(location.id)
                                setShowSourceDropdown(false)
                              }
                            }}
                            disabled={isDisabled}
                          >
                            <Text style={[
                              styles.locationDropdownItemText,
                              isSelected && styles.locationDropdownItemTextSelected,
                              isDisabled && styles.locationDropdownItemTextDisabled,
                            ]}>
                              {location.name}
                            </Text>
                            {isSelected && <Text style={styles.locationDropdownCheck}>✓</Text>}
                          </Pressable>
                        )
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Category Filter Pills */}
            {selectedSourceLocationId && (
              <View style={styles.categoryFiltersInline}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFiltersContent}>
                  <Pressable
                    style={[styles.categoryFilterPill, selectedCategoryIds.length === 0 && styles.categoryFilterPillActive]}
                    onPress={() => setSelectedCategoryIds([])}
                  >
                    <Text style={[styles.categoryFilterText, selectedCategoryIds.length === 0 && styles.categoryFilterTextActive]}>
                      All Products
                    </Text>
                  </Pressable>
                  {categories.map(category => {
                    const isSelected = selectedCategoryIds.includes(category.id)
                    const count = categoryCounts.get(category.id) || 0
                    return (
                      <Pressable
                        key={category.id}
                        style={[styles.categoryFilterPill, isSelected && styles.categoryFilterPillActive]}
                        onPress={() => handleCategoryToggle(category.id)}
                      >
                        <Text style={[styles.categoryFilterText, isSelected && styles.categoryFilterTextActive]}>
                          {category.name} ({count})
                        </Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {/* Product Search & Target Quantity */}
            {selectedSourceLocationId && (
              <>
                <View style={styles.searchBarContainer}>
                  <TextInput
                    style={styles.searchInput}
                    value={productSearch}
                    onChangeText={setProductSearch}
                    placeholder="Search products..."
                    placeholderTextColor="rgba(235,235,245,0.3)"
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={styles.targetQtyInput}
                    value={targetQuantity}
                    onChangeText={(val) => setTargetQuantity(val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                    placeholder="Target"
                    placeholderTextColor="rgba(235,235,245,0.3)"
                    keyboardType="decimal-pad"
                    maxLength={8}
                  />
                </View>

                {/* Product Grid - Wrapped to catch dismissal */}
                <View style={{ flex: 1 }}>
                  <ScrollView
                    style={styles.productGrid}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={!Object.keys(editingQuantities)[0]}
                  >
                    {filteredProducts.map(product => {
                const inCart = lineItems.find(item => item.product.id === product.id)
                const isEditingQty = editingQuantities[product.id] !== undefined
                const currentQty = editingQuantities[product.id]
                const hasValue = currentQty && parseInt(currentQty) > 0

                return (
                  <Pressable
                    key={product.id}
                    style={[
                      styles.productCard,
                      inCart && !isEditingQty && styles.productCardInCart,
                      isEditingQty && styles.productCardActive,
                      hasValue && styles.productCardSubmit,
                    ]}
onPress={() => {
                      // If editing THIS product and has value, submit it
                      if (isEditingQty && hasValue) {
                        console.log('[CreateTransferModal] Submit button tapped')

                        Keyboard.dismiss()

                        const qty = parseInt(currentQty, 10)
                        handleAddToTransfer(product, qty)
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

                        setEditingQuantities({})
                        currentValueRef.current = null
                        return
                      }

                      // Block if lockout is active
                      if (lockoutRef.current) {
                        return
                      }

                      // Block if currently submitting
                      if (isSubmittingRef.current) {
                        return
                      }

                      // Check if there's an active input on a DIFFERENT product
                      const activeProductId = Object.keys(editingQuantities)[0]

                      if (activeProductId && activeProductId !== product.id) {
                        // Block further clicks
                        isSubmittingRef.current = true

                        // Submit the previous product first
                        const value = editingQuantities[activeProductId]
                        const prevProduct = filteredProducts.find(p => p.id === activeProductId)

                        if (value && parseInt(value) > 0 && prevProduct) {
                          handleQuantityInputSubmit(prevProduct, value)
                        }

                        // Clear editing state FIRST (unmounts TextInput)
                        setEditingQuantities({})

                        // FORCE dismiss keyboard
                        Keyboard.dismiss()

                        // If target quantity is set, add immediately (but only if not already in cart OR manually edited)
                        if (targetQuantity && parseInt(targetQuantity) > 0) {
                          if (inCart || manuallyEditedProducts.current.has(product.id)) {
                            // Already in cart or was manually edited - do nothing
                            isSubmittingRef.current = false
                            return
                          }
                          const qty = parseFloat(targetQuantity)
                          handleAddToTransfer(product, qty)
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                          isSubmittingRef.current = false
                        } else {
                          // No target quantity - wait and open new input
                          setTimeout(() => {
                            handleStartEditingQuantity(product.id, inCart?.quantity)

                            // Wait for React to render, then focus
                            setTimeout(() => {
                              inputRefs.current[product.id]?.focus()
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                              isSubmittingRef.current = false
                            }, 100)
                          }, 600)
                        }
                      } else {
                        // If target quantity is set, add immediately (but only if not already in cart OR manually edited)
                        if (targetQuantity && parseInt(targetQuantity) > 0) {
                          if (inCart || manuallyEditedProducts.current.has(product.id)) {
                            // Already in cart or was manually edited - do nothing, user must tap badge to edit
                            return
                          }
                          const qty = parseFloat(targetQuantity)
                          handleAddToTransfer(product, qty)
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                        } else {
                          // No target quantity - open input for manual entry
                          handleStartEditingQuantity(product.id, inCart?.quantity)

                          // Manually focus after state updates
                          setTimeout(() => {
                            inputRefs.current[product.id]?.focus()
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          }, 50)
                        }
                      }
                    }}
                  >
                    {product.image_url && (
                      <Image source={{ uri: product.image_url }} style={styles.productImage} />
                    )}

                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      {hasValue ? (
                        <Text style={styles.tapToAddText}>Tap to add qty {currentQty}</Text>
                      ) : (
                        <Text style={styles.productStock}>
                          Stock: {product.inventory_quantity || 0}
                        </Text>
                      )}
                    </View>

                    {/* Quantity Input - ONLY NUMBER PAD - Always show while editing */}
                    {isEditingQty && (
                      <TextInput
                        ref={(ref) => {
                          if (ref) {
                            inputRefs.current[product.id] = ref
                          }
                        }}
                        key={product.id}
                        style={[
                          styles.quantityInput,
                          hasValue && styles.quantityInputWithValue,
                        ]}
                        value={editingQuantities[product.id]}
                        onChangeText={(val) => handleQuantityInputChange(product.id, val)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="rgba(235,235,245,0.3)"
                        autoFocus={true}
                        contextMenuHidden={true}
                        textContentType="none"
                        autoComplete="off"
                        autoCorrect={false}
                        spellCheck={false}
                        autoCapitalize="none"
                        maxLength={6}
                        importantForAutofill="no"
                      />
                    )}

                    {/* Show quantity badge if in cart and not editing */}
                    {inCart && !isEditingQty && (
                      <Pressable
                        style={styles.quantityBadge}
                        onPress={(e) => {
                          // Stop propagation so it doesn't trigger the product card's onPress
                          e.stopPropagation()

                          // Mark as manually edited (opted out of target mode)
                          manuallyEditedProducts.current.add(product.id)

                          // Open input to edit this product's quantity
                          handleStartEditingQuantity(product.id, inCart?.quantity)

                          setTimeout(() => {
                            inputRefs.current[product.id]?.focus()
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          }, 50)
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.quantityBadgeText}>{inCart.quantity}</Text>
                      </Pressable>
                    )}
                  </Pressable>
                )
                  })}
                  </ScrollView>
                </View>
              </>
            )}
          </View>

          {/* RIGHT COLUMN: Cart */}
          <View style={styles.cartColumnFull}>
            {/* Destination Location Header */}
            <View style={styles.columnHeader}>
              <View style={styles.columnHeaderRow}>
                <Text style={styles.columnHeaderLabel}>To</Text>
              </View>
              {/* Destination Location Selector */}
              <View style={styles.locationSelectorWrapper}>
                <Pressable
                  style={styles.locationSelectorButton}
                  onPress={() => setShowDestDropdown(!showDestDropdown)}
                >
                  <Text style={styles.locationSelectorButtonText}>
                    {selectedDestLocation?.name || 'Select Destination'}
                  </Text>
                  <Text style={styles.locationSelectorIcon}>{showDestDropdown ? '⌃' : '⌄'}</Text>
                </Pressable>

                {/* Destination Location Dropdown */}
                {showDestDropdown && (
                  <View style={styles.locationDropdownOverlay}>
                    <ScrollView style={styles.locationDropdownScroll} showsVerticalScrollIndicator={false}>
                      {locations.map(location => {
                        const isSelected = selectedDestLocationId === location.id
                        const isDisabled = selectedSourceLocationId === location.id
                        return (
                          <Pressable
                            key={location.id}
                            style={[
                              styles.locationDropdownItem,
                              isSelected && styles.locationDropdownItemSelected,
                              isDisabled && styles.locationDropdownItemDisabled,
                            ]}
                            onPress={() => {
                              if (!isDisabled) {
                                handleDestLocationSelect(location.id)
                                setShowDestDropdown(false)
                              }
                            }}
                            disabled={isDisabled}
                          >
                            <Text style={[
                              styles.locationDropdownItemText,
                              isSelected && styles.locationDropdownItemTextSelected,
                              isDisabled && styles.locationDropdownItemTextDisabled,
                            ]}>
                              {location.name}
                            </Text>
                            {isSelected && <Text style={styles.locationDropdownCheck}>✓</Text>}
                          </Pressable>
                        )
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Cart Content */}
            {lineItems.length === 0 ? (
              <View style={styles.cartEmptyState}>
                <Text style={styles.cartEmptyText}>No items</Text>
                <Text style={styles.cartEmptySubtext}>Select a source location and add products</Text>
              </View>
            ) : (
              <>
                {/* Cart Items List */}
                <ScrollView style={styles.cartItemsList} showsVerticalScrollIndicator={false}>
                  {lineItems.map((item) => {
                    const isEditingThisItem = editingCartItemId === item.id
                    return (
                      <View key={item.id} style={styles.cartItem}>
                        {/* Product Name */}
                        <View style={styles.cartItemInfo}>
                          <Text style={styles.cartItemName} numberOfLines={1}>
                            {item.product.name}
                          </Text>
                        </View>

                        {/* Quantity Controls */}
                        <View style={styles.cartQtyControls}>
                          {/* Minus Button */}
                          <Pressable
                            onPress={() => {
                              if (item.quantity > 1) {
                                handleUpdateQuantity(item.id, item.quantity - 1)
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                              }
                            }}
                            style={styles.cartQtyButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.cartQtyButtonText}>−</Text>
                          </Pressable>

                          {/* Quantity Display/Input */}
                          {isEditingThisItem ? (
                            <TextInput
                              style={styles.cartQtyInput}
                              value={editingCartQty}
                              onChangeText={(val) => setEditingCartQty(val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                              onEndEditing={() => {
                                const newQty = parseFloat(editingCartQty)
                                if (!isNaN(newQty) && newQty > 0) {
                                  handleUpdateQuantity(item.id, newQty)
                                }
                                setEditingCartItemId(null)
                                setEditingCartQty('')
                              }}
                              keyboardType="decimal-pad"
                              autoFocus={true}
                              selectTextOnFocus={true}
                              maxLength={8}
                            />
                          ) : (
                            <Pressable
                              onPress={() => {
                                setEditingCartItemId(item.id)
                                setEditingCartQty(String(item.quantity))
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                              }}
                              style={styles.cartQtyDisplay}
                            >
                              <Text style={styles.cartQtyText}>{item.quantity}</Text>
                            </Pressable>
                          )}

                          {/* Plus Button */}
                          <Pressable
                            onPress={() => {
                              handleUpdateQuantity(item.id, item.quantity + 1)
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            }}
                            style={styles.cartQtyButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.cartQtyButtonText}>+</Text>
                          </Pressable>
                        </View>

                        {/* Remove Button */}
                        <Pressable
                          onPress={() => handleRemoveLineItem(item.id)}
                          style={styles.cartRemoveButton}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.cartRemoveText}>✕</Text>
                        </Pressable>
                      </View>
                    )
                  })}
                </ScrollView>

                {/* Cart Footer */}
                <View style={styles.cartFooter}>
                  {/* Notes */}
                  <View style={styles.cartFooterSection}>
                    <Text style={styles.cartFooterLabel}>NOTES (Optional)</Text>
                    <TextInput
                      style={styles.cartNotesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add notes..."
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                      maxLength={500}
                    />
                  </View>

                  {/* Error */}
                  {error && (
                    <View style={styles.cartErrorCard}>
                      <Text style={styles.cartErrorText}>{error}</Text>
                    </View>
                  )}

                  {/* Submit Button */}
                  <Pressable
                    onPress={handleSubmit}
                    style={[styles.cartCreateButton, (!canSave || saving) && styles.cartCreateButtonDisabled]}
                    disabled={!canSave || saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.cartCreateButtonText}>SHIP TRANSFER</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <Modal
      visible={showModal}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* ===== UNIFIED VIEW ===== */}
        {renderUnifiedView()}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },

  // Unified Container
  unifiedContainer: {
    flex: 1,
  },
  closeButtonAbsolute: {
    position: 'absolute',
    top: 12,
    right: 20,
    padding: 0,
    zIndex: 1000,
  },
  mainTwoColumnLayout: {
    flex: 1,
    flexDirection: 'row',
  },

  // Left Column: Products
  productsColumnFull: {
    flex: 2,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },

  // Right Column: Cart
  cartColumnFull: {
    flex: 1,
  },

  // Column Headers (Source/Destination)
  columnHeader: {
    padding: 20,
  },
  columnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  columnHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Location Selector Wrapper
  locationSelectorWrapper: {
    position: 'relative',
    zIndex: 100,
  },

  // Location Selector Button
  locationSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  locationSelectorButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.3,
    flex: 1,
  },
  locationSelectorIcon: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
    lineHeight: 20,
    marginLeft: 8,
  },

  // Location Dropdown Overlay
  locationDropdownOverlay: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    // Android shadow
    elevation: 12,
  },
  locationDropdownScroll: {
    padding: 8,
  },
  locationDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  locationDropdownItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  locationDropdownItemDisabled: {
    opacity: 0.3,
  },
  locationDropdownItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.3,
    flex: 1,
  },
  locationDropdownItemTextSelected: {
    fontWeight: '600',
  },
  locationDropdownItemTextDisabled: {
    color: 'rgba(235,235,245,0.4)',
  },
  locationDropdownCheck: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Category Filters Inline
  categoryFiltersInline: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  // Cart Styles
  cartItemsList: {
    flex: 1,
    padding: 20,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    marginBottom: 12,
    gap: 12,
  },
  cartItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  cartQtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartQtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartQtyButtonText: {
    fontSize: 18,
    fontWeight: '400',
    color: '#fff',
  },
  cartQtyDisplay: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cartQtyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  cartQtyInput: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  cartRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,59,48,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartRemoveText: {
    fontSize: 18,
    fontWeight: '400',
    color: '#FF3B30',
  },
  cartFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 16,
  },

  // Setup View (Select Location)
  setupContainer: {
    flex: 1,
    padding: 20,
  },
  twoColumnLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  columnHalf: {
    flex: 1,
  },
  locationScrollColumn: {
    flex: 1,
    marginTop: 16,
  },
  setupTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  setupSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.3,
  },
  setupSection: {
    marginBottom: 32,
  },
  locationGrid: {
    gap: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    padding: 16,
    marginBottom: 12,
  },
  locationCardSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  locationCardDisabled: {
    opacity: 0.3,
  },
  locationCardContent: {
    flex: 1,
  },
  locationCardName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  locationCardNameDisabled: {
    color: 'rgba(235,235,245,0.4)',
  },
  locationCardCity: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  locationCheckmark: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 12,
  },

  // Shopping View
  shoppingContainer: {
    flex: 1,
  },
  shoppingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  shoppingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  shoppingSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  cartBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cartBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Category Grid
  categoryGrid: {
    flex: 1,
    paddingHorizontal: 20,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(235,235,245,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCheckboxInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  categoryNameSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  categoryCount: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  categoryChevron: {
    fontSize: 24,
    fontWeight: '300',
    color: 'rgba(235,235,245,0.5)',
    marginLeft: 12,
  },
  viewProductsButtonContainer: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  viewProductsButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewProductsButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },

  // Product View (with Cart Sidebar)
  productCartLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  productsColumn: {
    flex: 2,
  },
  unifiedHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: -0.3,
  },
  headerBreadcrumb: {
    flex: 1,
  },
  breadcrumbText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
    color: 'rgba(235,235,245,0.6)',
  },
  categoryFilters: {
    marginTop: 4,
  },
  categoryFiltersContent: {
    gap: 8,
    paddingRight: 20,
  },
  categoryFilterPill: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryFilterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  categoryFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
  },
  targetQtyInput: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
    textAlign: 'center',
    minWidth: 100,
  },

  // Product Grid
  productGrid: {
    flex: 1,
    paddingHorizontal: 20,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    padding: 8,
    paddingLeft: 8,
    paddingRight: 12,
    marginBottom: 12,
    gap: 12,
  },
  productCardSubmit: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  tapToAddText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#34C759',
    letterSpacing: -0.1,
  },
  quantityBadgeSubmit: {
    backgroundColor: '#34C759',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 70,
  },
  quantityBadgeTextSubmit: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productSKU: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.1,
  },
  productStock: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
  },
  quantityInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    minWidth: 70,
    textAlign: 'center',
  },
  quantityInputWithValue: {
    backgroundColor: '#34C759',
  },
  quantityBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBadgeText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  productCardInCart: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  productCardActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Cart Sidebar (Right side during product selection)
  cartSidebar: {
    flex: 1,
    backgroundColor: 'rgba(28,28,30,0.95)',
    borderRadius: 20,
    padding: 20,
    marginRight: 20,
    marginBottom: 20,
  },
  cartSidebarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  cartEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cartEmptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: -0.3,
  },
  cartEmptySubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.3)',
    letterSpacing: -0.2,
  },
  cartSidebarScroll: {
    flex: 1,
    marginBottom: 16,
  },
  cartSidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    padding: 12,
    paddingLeft: 16,
    marginBottom: 8,
  },
  cartSidebarItemInfo: {
    flex: 1,
  },
  cartSidebarItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  cartSidebarItemSKU: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.1,
  },
  cartSidebarItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartSidebarItemQty: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.8)',
    letterSpacing: -0.2,
  },
  cartRemoveButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,69,58,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartRemoveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff453a',
  },
  cartSidebarFooter: {
    gap: 12,
  },
  cartFooterSection: {
    gap: 8,
  },
  cartFooterLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cartDestinationMini: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 12,
    padding: 12,
  },
  cartDestinationMiniText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  cartDestinationPlaceholderText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.3)',
    letterSpacing: -0.3,
  },
  cartNotesInput: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
    minHeight: 60,
  },
  cartErrorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 10,
  },
  cartErrorText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#f87171',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  cartCreateButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCreateButtonDisabled: {
    opacity: 0.4,
  },
  cartCreateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  draftButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cartSaveDraftButton: {
    flex: 1,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartSaveDraftButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  cartApproveButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartApproveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },

  // Location Selector Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  modalClose: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  modalSearch: {
    margin: 20,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
  },
  modalList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalListItem: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 100,
    padding: 16,
    marginBottom: 12,
  },
  modalListItemText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  modalListItemSubtext: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    marginTop: 4,
  },
})
