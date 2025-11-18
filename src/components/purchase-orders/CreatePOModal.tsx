/**
 * Create Purchase Order Modal
 * Built from scratch with inline selectors
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, TextInput, ScrollView, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { createPurchaseOrder } from '@/services/purchase-orders.service'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useProducts, type Product } from '@/hooks/useProducts'
import { useUserLocations } from '@/hooks/useUserLocations'
import { useLocationFilter } from '@/stores/location-filter.store'
import { logger } from '@/utils/logger'

interface CreatePOModalProps {
  visible: boolean
  vendorId: string
  onClose: () => void
  onCreated: () => void
}

interface POLineItem {
  id: string
  product: Product
  quantity: number
  unitPrice: number
  lineTotal: number
}

export function CreatePOModal({ visible, vendorId, onClose, onCreated }: CreatePOModalProps) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const { suppliers } = useSuppliers()
  const { products } = useProducts()
  const { locations } = useUserLocations()
  const { selectedLocationIds } = useLocationFilter()

  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('')
  const [locationSearchQuery, setLocationSearchQuery] = useState('')
  const [showSupplierList, setShowSupplierList] = useState(false)
  const [showLocationList, setShowLocationList] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Product selection
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [lineItems, setLineItems] = useState<POLineItem[]>([])

  const searchInputRef = useRef<TextInput>(null)
  const quantityInputRef = useRef<TextInput>(null)
  const unitPriceInputRef = useRef<TextInput>(null)

  const modalStyle = useMemo(() => ({
    width: isLandscape ? '85%' : '95%',
    maxWidth: isLandscape ? 900 : 700,
    maxHeight: height * 0.92,
  }), [isLandscape, height])

  const scrollContentStyle = useMemo(() => ({
    maxHeight: isLandscape ? height * 0.7 : height * 0.75,
  }), [isLandscape, height])

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return suppliers
    const query = supplierSearchQuery.toLowerCase()
    return suppliers.filter(s =>
      s.external_name?.toLowerCase().includes(query)
    )
  }, [suppliers, supplierSearchQuery])

  const filteredLocations = useMemo(() => {
    if (!locationSearchQuery.trim()) return locations
    const query = locationSearchQuery.toLowerCase()
    return locations.filter(l =>
      l.location.name.toLowerCase().includes(query) ||
      l.location.address_line1?.toLowerCase().includes(query) ||
      l.location.city?.toLowerCase().includes(query)
    )
  }, [locations, locationSearchQuery])

  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return []
    const query = productSearchQuery.toLowerCase()
    const addedProductIds = new Set(lineItems.map(item => item.product.id))
    return products
      .filter(p => !addedProductIds.has(p.id))
      .filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
      )
      .slice(0, 10)
  }, [productSearchQuery, products, lineItems])

  const selectedSupplier = useMemo(() =>
    suppliers.find(s => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId]
  )

  const selectedLocation = useMemo(() =>
    locations.find(l => l.location.id === selectedLocationId),
    [locations, selectedLocationId]
  )

  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)

  useEffect(() => {
    if (visible && selectedLocationIds.length === 1 && !selectedLocationId) {
      setSelectedLocationId(selectedLocationIds[0])
    }
  }, [visible, selectedLocationIds, selectedLocationId])

  useEffect(() => {
    if (visible) {
      setSelectedSupplierId('')
      if (selectedLocationIds.length !== 1) setSelectedLocationId('')
      setSupplierSearchQuery('')
      setLocationSearchQuery('')
      setShowSupplierList(false)
      setShowLocationList(false)
      setProductSearchQuery('')
      setSelectedProduct(null)
      setQuantity('')
      setUnitPrice('')
      setLineItems([])
      setError(null)
    }
  }, [visible, selectedLocationIds])

  const handleSupplierSelect = (supplierId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedSupplierId(supplierId)
    setShowSupplierList(false)
    setSupplierSearchQuery('')
    setError(null)
  }

  const handleLocationSelect = (locationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedLocationId(locationId)
    setShowLocationList(false)
    setLocationSearchQuery('')
    setError(null)
  }

  const handleProductSelect = (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedProduct(product)
    setUnitPrice((product.regular_price || 0).toString())
    setQuantity('1')
    setProductSearchQuery('')
    setTimeout(() => quantityInputRef.current?.focus(), 100)
  }

  const handleAddLineItem = () => {
    if (!selectedProduct || !quantity || !unitPrice) {
      setError('Please enter quantity and unit price')
      return
    }
    const qty = parseFloat(quantity)
    const price = parseFloat(unitPrice)
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      setError('Invalid quantity or price')
      return
    }
    setLineItems([...lineItems, {
      id: `temp-${Date.now()}`,
      product: selectedProduct,
      quantity: qty,
      unitPrice: price,
      lineTotal: qty * price,
    }])
    setSelectedProduct(null)
    setQuantity('')
    setUnitPrice('')
    setProductSearchQuery('')
    setError(null)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const handleRemoveLineItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLineItems(lineItems.filter(item => item.id !== id))
  }

  const handleSubmit = async () => {
    try {
      setError(null)
      if (!selectedSupplierId || !selectedLocationId || lineItems.length === 0) {
        setError('Please select supplier, location, and add products')
        return
      }
      setIsSubmitting(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      await createPurchaseOrder(vendorId, {
        po_type: 'inbound',
        supplier_id: selectedSupplierId,
        location_id: selectedLocationId,
        items: lineItems.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
        tax: 0,
        shipping: 0,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onClose()
      onCreated()
    } catch (err) {
      logger.error('Failed to create purchase order', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to create purchase order')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = selectedSupplierId && selectedLocationId && lineItems.length > 0 && !isSubmitting

  if (!visible) return null

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <BlurView intensity={40} style={styles.modalOverlay} tint="dark">
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalContainer, modalStyle]}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.modalContent, !isLiquidGlassSupported && styles.modalContentFallback]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Purchase Order</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              style={[styles.modalScroll, scrollContentStyle]}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Supplier Selector */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>FROM SUPPLIER *</Text>
                <Pressable
                  style={styles.selectorButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setShowSupplierList(!showSupplierList)
                    setShowLocationList(false)
                  }}
                >
                  <View style={styles.selectorContent}>
                    <Text style={styles.selectorLabel}>Supplier</Text>
                    <Text style={selectedSupplier ? styles.selectorValue : styles.selectorPlaceholder}>
                      {selectedSupplier ? selectedSupplier.external_name : 'Select supplier...'}
                    </Text>
                  </View>
                  <Text style={[styles.selectorArrow, showSupplierList && styles.selectorArrowExpanded]}>›</Text>
                </Pressable>

                {showSupplierList && (
                  <View style={styles.selectorList}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search suppliers..."
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      value={supplierSearchQuery}
                      onChangeText={setSupplierSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <ScrollView style={styles.selectorScroll} showsVerticalScrollIndicator={false}>
                      {filteredSuppliers.map((supplier, index) => (
                        <Pressable
                          key={supplier.id}
                          style={[
                            styles.selectorItem,
                            index === filteredSuppliers.length - 1 && styles.selectorItemLast,
                            selectedSupplierId === supplier.id && styles.selectorItemSelected,
                          ]}
                          onPress={() => handleSupplierSelect(supplier.id)}
                        >
                          <Text style={styles.selectorItemText}>{supplier.external_name}</Text>
                          {selectedSupplierId === supplier.id && <Text style={styles.checkmark}>✓</Text>}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Location Selector */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>RECEIVING AT *</Text>
                <Pressable
                  style={styles.selectorButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setShowLocationList(!showLocationList)
                    setShowSupplierList(false)
                  }}
                >
                  <View style={styles.selectorContent}>
                    <Text style={styles.selectorLabel}>Location</Text>
                    {selectedLocation ? (
                      <View>
                        <Text style={styles.selectorValue}>{selectedLocation.location.name}</Text>
                        {selectedLocation.location.address_line1 && (
                          <Text style={styles.selectorSubtext}>{selectedLocation.location.address_line1}</Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.selectorPlaceholder}>Select location...</Text>
                    )}
                  </View>
                  <Text style={[styles.selectorArrow, showLocationList && styles.selectorArrowExpanded]}>›</Text>
                </Pressable>

                {showLocationList && (
                  <View style={styles.selectorList}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search locations..."
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      value={locationSearchQuery}
                      onChangeText={setLocationSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <ScrollView style={styles.selectorScroll} showsVerticalScrollIndicator={false}>
                      {filteredLocations.map((userLoc, index) => (
                        <Pressable
                          key={userLoc.location.id}
                          style={[
                            styles.selectorItem,
                            index === filteredLocations.length - 1 && styles.selectorItemLast,
                            selectedLocationId === userLoc.location.id && styles.selectorItemSelected,
                          ]}
                          onPress={() => handleLocationSelect(userLoc.location.id)}
                        >
                          <View style={styles.selectorItemContent}>
                            <Text style={styles.selectorItemText}>{userLoc.location.name}</Text>
                            {userLoc.location.address_line1 && (
                              <Text style={styles.selectorItemSubtext}>
                                {[userLoc.location.address_line1, userLoc.location.city, userLoc.location.state].filter(Boolean).join(', ')}
                              </Text>
                            )}
                          </View>
                          {selectedLocationId === userLoc.location.id && <Text style={styles.checkmark}>✓</Text>}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Add Products */}
              {selectedSupplierId && selectedLocationId && (
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>ADD PRODUCTS</Text>
                  <View style={styles.productCard}>
                    {!selectedProduct ? (
                      <View>
                        <Text style={styles.inputLabel}>Search Product</Text>
                        <TextInput
                          ref={searchInputRef}
                          style={styles.input}
                          placeholder="Search by name or SKU..."
                          placeholderTextColor="rgba(235,235,245,0.3)"
                          value={productSearchQuery}
                          onChangeText={setProductSearchQuery}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        {filteredProducts.length > 0 && (
                          <View style={styles.productResults}>
                            {filteredProducts.map((product) => (
                              <Pressable
                                key={product.id}
                                style={styles.productRow}
                                onPress={() => handleProductSelect(product)}
                              >
                                <View style={styles.productInfo}>
                                  <Text style={styles.productName}>{product.name}</Text>
                                  {product.sku && <Text style={styles.productSKU}>SKU: {product.sku}</Text>}
                                </View>
                                <Text style={styles.productPrice}>${(product.regular_price || 0).toFixed(2)}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : (
                      <View>
                        <View style={styles.selectedProductHeader}>
                          <View style={styles.selectedProductInfo}>
                            <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                            {selectedProduct.sku && <Text style={styles.selectedProductSKU}>SKU: {selectedProduct.sku}</Text>}
                          </View>
                          <Pressable
                            onPress={() => {
                              setSelectedProduct(null)
                              setQuantity('')
                              setUnitPrice('')
                            }}
                            style={styles.clearButton}
                          >
                            <Text style={styles.clearButtonText}>✕</Text>
                          </Pressable>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inlineRow}>
                          <View style={styles.inlineField}>
                            <Text style={styles.inputLabel}>Quantity</Text>
                            <TextInput
                              ref={quantityInputRef}
                              style={styles.input}
                              value={quantity}
                              onChangeText={setQuantity}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor="rgba(235,235,245,0.3)"
                            />
                          </View>
                          <View style={styles.inlineField}>
                            <Text style={styles.inputLabel}>Unit Price</Text>
                            <TextInput
                              ref={unitPriceInputRef}
                              style={styles.input}
                              value={unitPrice}
                              onChangeText={setUnitPrice}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor="rgba(235,235,245,0.3)"
                            />
                          </View>
                          <Pressable style={styles.addButton} onPress={handleAddLineItem}>
                            <Text style={styles.addButtonText}>Add</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Line Items */}
              {lineItems.length > 0 && (
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>ORDER ITEMS ({lineItems.length})</Text>
                  <View style={styles.lineItemsCard}>
                    {lineItems.map((item, index) => (
                      <View key={item.id}>
                        <View style={styles.lineItemRow}>
                          <View style={styles.lineItemInfo}>
                            <Text style={styles.lineItemName}>{item.product.name}</Text>
                            {item.product.sku && <Text style={styles.lineItemSKU}>SKU: {item.product.sku}</Text>}
                            <Text style={styles.lineItemMeta}>
                              {item.quantity} × ${item.unitPrice.toFixed(2)}
                            </Text>
                          </View>
                          <View style={styles.lineItemActions}>
                            <Text style={styles.lineItemTotal}>${item.lineTotal.toFixed(2)}</Text>
                            <Pressable onPress={() => handleRemoveLineItem(item.id)}>
                              <Text style={styles.removeButtonText}>Remove</Text>
                            </Pressable>
                          </View>
                        </View>
                        {index < lineItems.length - 1 && <View style={styles.divider} />}
                      </View>
                    ))}
                    <View style={styles.divider} />
                    <View style={styles.subtotalRow}>
                      <Text style={styles.subtotalLabel}>Subtotal</Text>
                      <Text style={styles.subtotalValue}>${subtotal.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={onClose}
                disabled={isSubmitting}
                style={[styles.button, styles.buttonSecondary]}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={[styles.button, styles.buttonPrimary]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Create Order</Text>
                )}
              </Pressable>
            </View>
          </LiquidGlassView>
        </View>
      </BlurView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {},
  modalContent: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalContentFallback: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.text.primary,
    marginTop: -4,
  },
  modalScroll: {},
  modalScrollContent: {
    padding: spacing.lg,
  },
  formField: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.7)',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  input: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.sm,
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  searchInput: {
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: spacing.xs,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorContent: {
    flex: 1,
    gap: 4,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  selectorValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  selectorPlaceholder: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.2,
  },
  selectorSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  selectorArrow: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.quaternary,
    marginLeft: 12,
    transform: [{ rotate: '0deg' }],
  },
  selectorArrowExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  selectorList: {
    marginTop: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.sm,
  },
  selectorScroll: {
    maxHeight: 200,
  },
  selectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: 44,
  },
  selectorItemLast: {
    borderBottomWidth: 0,
  },
  selectorItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
  },
  selectorItemContent: {
    flex: 1,
    gap: 2,
  },
  selectorItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  selectorItemSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginLeft: 12,
  },
  productCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.lg,
  },
  productResults: {
    marginTop: 12,
    gap: 8,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.05)',
    minHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  productSKU: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.5)',
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: -0.2,
  },
  selectedProductHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 10,
    borderCurve: 'continuous',
    marginBottom: 4,
  },
  selectedProductInfo: {
    flex: 1,
    gap: 4,
  },
  selectedProductName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  selectedProductSKU: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 18,
    color: 'rgba(235,235,245,0.5)',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  inlineField: {
    flex: 1,
    gap: 6,
  },
  addButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.2,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
  },
  lineItemsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.lg,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  lineItemInfo: {
    flex: 1,
    gap: 2,
  },
  lineItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  lineItemSKU: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.5)',
  },
  lineItemMeta: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.6)',
    marginTop: 2,
  },
  lineItemActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  lineItemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34c759',
  },
  removeButtonText: {
    fontSize: 12,
    color: '#ff453a',
    fontWeight: '500',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  subtotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.7)',
  },
  subtotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#f87171',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
})
