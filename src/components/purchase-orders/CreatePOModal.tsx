/**
 * CreatePOModal Component
 *
 * STANDARD MODAL PATTERN ✅
 * Full-screen slide-up sheet for creating purchase orders
 *
 * Pattern: Full-screen slide-up sheet with pill-shaped inputs
 * Reference: CategoryModal (GOLD STANDARD)
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
  Alert,
} from 'react-native'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { createPurchaseOrder, saveDraftPurchaseOrder, deletePurchaseOrder } from '@/services/purchase-orders.service'
import { useSuppliersManagementStore } from '@/stores/suppliers-management.store'
import { useProductsStore } from '@/stores/products.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useLocationFilter } from '@/stores/location-filter.store'
import { purchaseOrdersActions } from '@/stores/purchase-orders.store'
import { useProductsScreenStore } from '@/stores/products-list.store'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { Product } from '@/types/pos'

interface CreatePOModalProps {
  visible: boolean
  onClose: () => void
}

interface POLineItem {
  id: string
  product: Product
  quantity: number
  unitPrice: number
  lineTotal: number
}

/**
 * CreatePOModal - Full purchase order creation
 * Full-screen sheet - EXACT match to CategoryModal
 */
export function CreatePOModal({ visible, onClose }: CreatePOModalProps) {
  const insets = useSafeAreaInsets()

  // ========================================
  // HOOKS & STORES - ZERO PROP DRILLING ✅
  // ========================================
  const { user, vendor, locations } = useAppAuth()
  const { selectedLocationIds } = useLocationFilter()
  const selectedPO = useProductsScreenStore((state) => state.selectedPurchaseOrder)
  const vendorId = vendor?.id || ''

  // Real Zustand stores
  const suppliers = useSuppliersManagementStore((state) => state.suppliers)
  const loadSuppliers = useSuppliersManagementStore((state) => state.loadSuppliers)
  const products = useProductsStore((state) => state.products)
  const loadProducts = useProductsStore((state) => state.loadProducts)

  // ========================================
  // LOCAL STATE
  // ========================================
  const [supplierSearch, setSupplierSearch] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [lineItems, setLineItems] = useState<POLineItem[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSupplierList, setShowSupplierList] = useState(false)
  const [showLocationList, setShowLocationList] = useState(false)
  const [showProductList, setShowProductList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [autoSaving, setAutoSaving] = useState(false)

  const quantityInputRef = useRef<TextInput>(null)
  const unitPriceInputRef = useRef<TextInput>(null)
  const productSearchInputRef = useRef<TextInput>(null)

  // Load data when modal opens
  useEffect(() => {
    if (visible && user?.id && vendorId) {
      loadSuppliers(user.id)
      // Load products for the selected location (or first location if available)
      if (selectedLocationId) {
        loadProducts(selectedLocationId)
      } else if (selectedLocationIds.length > 0) {
        loadProducts(selectedLocationIds[0])
      }
    }
  }, [visible, user?.id, vendorId, loadSuppliers, loadProducts, selectedLocationId, selectedLocationIds])

  // Auto-select location if only one is selected in filter
  useEffect(() => {
    if (visible && selectedLocationIds.length === 1 && !selectedLocationId) {
      setSelectedLocationId(selectedLocationIds[0])
    }
  }, [visible, selectedLocationIds, selectedLocationId])

  // Auto-save draft when line items change
  useEffect(() => {
    const saveDraft = async () => {
      if (!visible || lineItems.length === 0 || autoSaving || saving) return

      try {
        setAutoSaving(true)

        const draft = await saveDraftPurchaseOrder(vendorId, {
          id: draftId || undefined,
          po_type: 'inbound',
          supplier_id: selectedSupplierId || null,
          location_id: selectedLocationId || null,
          notes: notes || null,
          items: lineItems.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
        })

        if (!draftId) {
          // New draft - add to store optimistically
          setDraftId(draft.id)
          purchaseOrdersActions.addPurchaseOrder(draft)
          logger.debug('[CreatePOModal] Draft created and added to store', { id: draft.id })
        } else {
          // Update existing draft in store
          purchaseOrdersActions.updatePurchaseOrder(draft.id, draft)
          logger.debug('[CreatePOModal] Draft updated in store', { id: draft.id })
        }
      } catch (err) {
        logger.error('[CreatePOModal] Failed to auto-save draft', { error: err })
      } finally {
        setAutoSaving(false)
      }
    }

    // Debounce auto-save by 1 second
    const timer = setTimeout(saveDraft, 1000)
    return () => clearTimeout(timer)
  }, [lineItems, selectedSupplierId, selectedLocationId, notes, visible, vendorId, draftId, autoSaving, saving])

  // Load draft data if editing, otherwise reset
  useEffect(() => {
    if (visible) {
      // Check if we're editing a draft
      if (selectedPO && selectedPO.status === 'draft') {
        // Load draft data
        setDraftId(selectedPO.id)
        setSelectedSupplierId(selectedPO.supplier_id || '')
        setSelectedLocationId(selectedPO.location_id || '')
        setNotes(selectedPO.notes || '')

        // Load items from draft
        const loadDraftItems = async () => {
          try {
            const { data, error } = await supabase
              .from('purchase_order_items')
              .select(`*, products (id, name, sku, regular_price)`)
              .eq('purchase_order_id', selectedPO.id)

            if (error) throw error

            const draftItems: POLineItem[] = (data || []).map((item: any) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products
              return {
                id: item.id,
                product: {
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  regular_price: product.regular_price,
                } as Product,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                lineTotal: item.quantity * item.unit_price,
              }
            })

            setLineItems(draftItems)
            logger.info('[CreatePOModal] Loaded draft data', { draftId: selectedPO.id, itemCount: draftItems.length })
          } catch (err) {
            logger.error('[CreatePOModal] Failed to load draft items', { error: err })
          }
        }

        loadDraftItems()
      } else {
        // Reset for new PO
        setSupplierSearch('')
        setSelectedSupplierId('')
        // Only reset location if not auto-selected from filter
        if (selectedLocationIds.length !== 1) {
          setSelectedLocationId('')
        } else {
          setSelectedLocationId(selectedLocationIds[0])
        }
        setProductSearch('')
        setSelectedProduct(null)
        setQuantity('')
        setUnitPrice('')
        setLineItems([])
        setNotes('')
        setDraftId(null)
        setAutoSaving(false)
      }

      // Always reset UI state
      setShowSupplierList(false)
      setShowLocationList(false)
      setShowProductList(false)
      setError(null)
    }
  }, [visible, selectedPO, selectedLocationIds])

  // Show all suppliers when list is open
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers
    const query = supplierSearch.toLowerCase()
    return suppliers.filter(s => s.external_name?.toLowerCase().includes(query))
  }, [suppliers, supplierSearch])

  // Filter products by search (exclude already added)
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return []
    const query = productSearch.toLowerCase()
    const addedIds = new Set(lineItems.map(item => item.product.id))
    return products
      .filter(p => !addedIds.has(p.id))
      .filter(p => p.name.toLowerCase().includes(query) || p.sku?.toLowerCase().includes(query))
      .slice(0, 20)
  }, [products, productSearch, lineItems])

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId]
  )

  const selectedLocation = useMemo(
    () => locations.find(l => l.id === selectedLocationId),
    [locations, selectedLocationId]
  )

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [lineItems]
  )

  const handleSupplierSelect = (supplierId: string) => {
    setSelectedSupplierId(supplierId)
    setShowSupplierList(false)
    setSupplierSearch('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleLocationSelect = (locationId: string) => {
    setSelectedLocationId(locationId)
    setShowLocationList(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setUnitPrice((product.regular_price || 0).toString())
    setQuantity('1')
    setProductSearch('')
    setShowProductList(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Minimal delay - same keyboard throughout
    setTimeout(() => {
      quantityInputRef.current?.focus()
    }, 50)
  }

  const handleAddLineItem = () => {
    if (!selectedProduct || !quantity || !unitPrice) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    const qty = parseFloat(quantity)
    const price = parseFloat(unitPrice)
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    setLineItems([
      ...lineItems,
      {
        id: `temp-${Date.now()}`,
        product: selectedProduct,
        quantity: qty,
        unitPrice: price,
        lineTotal: qty * price,
      },
    ])
    setSelectedProduct(null)
    setQuantity('')
    setUnitPrice('')
    setProductSearch('')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Focus back on product search for continuous flow - minimal delay, same keyboard
    setTimeout(() => {
      productSearchInputRef.current?.focus()
    }, 50)
  }

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id))
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const handleSave = async () => {
    logger.info('[CreatePOModal] handleSave called', {
      selectedSupplierId,
      selectedLocationId,
      lineItemsCount: lineItems.length,
      draftId,
    })

    if (!selectedSupplierId || !selectedLocationId || lineItems.length === 0) {
      setError('Please select supplier, location, and add products')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      logger.info('[CreatePOModal] Creating real PO...', { vendorId })

      const createdPO = await createPurchaseOrder(vendorId, {
        po_type: 'inbound',
        supplier_id: selectedSupplierId,
        location_id: selectedLocationId,
        notes: notes.trim() || undefined,
        items: lineItems.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
        tax: 0,
        shipping: 0,
      })

      // Delete draft if it exists (converted to real PO)
      if (draftId) {
        await deletePurchaseOrder(draftId)
        // Remove draft from store
        purchaseOrdersActions.removePurchaseOrder(draftId)
        logger.debug('[CreatePOModal] Draft deleted after PO creation', { draftId })
      }

      // Add created PO to store optimistically
      purchaseOrdersActions.addPurchaseOrder(createdPO)
      logger.info('[CreatePOModal] PO created and added to store', { poId: createdPO.id })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      handleClose()
    } catch (err) {
      logger.error('Failed to create purchase order', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to create purchase order')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const handleDeleteDraft = () => {
    if (!draftId && !selectedPO?.id) return

    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft purchase order? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const idToDelete = draftId || selectedPO?.id
              if (!idToDelete) return

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

              // Delete from database
              await deletePurchaseOrder(idToDelete)

              // Remove from store
              purchaseOrdersActions.removePurchaseOrder(idToDelete)

              logger.info('[CreatePOModal] Draft deleted', { id: idToDelete })

              // Close modal
              handleClose()
            } catch (err) {
              logger.error('[CreatePOModal] Failed to delete draft', { error: err })
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              setError(err instanceof Error ? err.message : 'Failed to delete draft')
            }
          },
        },
      ]
    )
  }

  const canSave = selectedSupplierId && selectedLocationId && lineItems.length > 0 && !saving
  const isDraft = !!(draftId || selectedPO?.id)

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* ===== HEADER ===== */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TextInput
              ref={productSearchInputRef}
              style={styles.searchInput}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Search products..."
              placeholderTextColor="rgba(235,235,245,0.3)"
              autoFocus
              returnKeyType="search"
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => {
                setShowProductList(true)
                setShowSupplierList(false)
                setShowLocationList(false)
              }}
            />
          </View>
          <Pressable onPress={() => handleClose()} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>

        {/* ===== CONTENT ===== */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Add Products Section - PRIMARY */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ADD PRODUCTS</Text>

            {!selectedProduct ? (
              <>
                {showProductList && filteredProducts.length > 0 && (
                  <View style={styles.productResults}>
                    {filteredProducts.map(product => (
                      <Pressable
                        key={product.id}
                        style={styles.productResultItem}
                        onPress={() => handleProductSelect(product)}
                      >
                        <View style={styles.productResultInfo}>
                          <Text style={styles.productResultName}>{product.name}</Text>
                          {product.category && (
                            <Text style={styles.productResultCategory}>{product.category}</Text>
                          )}
                        </View>
                        <Text style={styles.productResultPrice}>
                          ${(product.regular_price || 0).toFixed(2)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.selectedProductCard}>
                <View style={styles.selectedProductHeader}>
                  <View style={styles.selectedProductInfo}>
                    <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                    {selectedProduct.sku && (
                      <Text style={styles.selectedProductSKU}>SKU: {selectedProduct.sku}</Text>
                    )}
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

                <View style={styles.quantityRow}>
                  <View style={styles.quantityField}>
                    <Text style={styles.quantityLabel}>Quantity</Text>
                    <TextInput
                      ref={quantityInputRef}
                      style={styles.quantityInput}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="default"
                      placeholder="0"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      returnKeyType="next"
                      selectTextOnFocus
                      onSubmitEditing={() => unitPriceInputRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                  <View style={styles.quantityField}>
                    <Text style={styles.quantityLabel}>Unit Price</Text>
                    <TextInput
                      ref={unitPriceInputRef}
                      style={styles.quantityInput}
                      value={unitPrice}
                      onChangeText={setUnitPrice}
                      keyboardType="default"
                      placeholder="0.00"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      returnKeyType="done"
                      selectTextOnFocus
                      onSubmitEditing={handleAddLineItem}
                      blurOnSubmit={false}
                    />
                  </View>
                </View>

                <Pressable style={styles.addItemButton} onPress={handleAddLineItem}>
                  <Text style={styles.addItemButtonText}>+ Add to Order</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Supplier Selection - SECONDARY */}
          {lineItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>FROM SUPPLIER</Text>
              {selectedSupplier ? (
                <Pressable
                  style={styles.selectedCard}
                  onPress={() => {
                    setShowSupplierList(true)
                    setShowLocationList(false)
                    setShowProductList(false)
                  }}
                >
                  <Text style={styles.selectedCardTitle}>{selectedSupplier.external_name}</Text>
                  <Text style={styles.selectedCardChevron}>▼</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.placeholderCard}
                  onPress={() => {
                    setShowSupplierList(true)
                    setShowLocationList(false)
                    setShowProductList(false)
                  }}
                >
                  <Text style={styles.placeholderText}>Select supplier...</Text>
                  <Text style={styles.selectedCardChevron}>▼</Text>
                </Pressable>
              )}

              {showSupplierList && (
                <View style={styles.listCard}>
                  <View style={styles.searchInputWrapper}>
                    <TextInput
                      style={styles.searchInputInline}
                      value={supplierSearch}
                      onChangeText={setSupplierSearch}
                      placeholder="Search suppliers..."
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      returnKeyType="search"
                    />
                  </View>
                  {filteredSuppliers.length === 0 ? (
                    <View style={styles.emptyList}>
                      <Text style={styles.emptyListText}>No suppliers found</Text>
                    </View>
                  ) : (
                    <ScrollView style={styles.list} nestedScrollEnabled>
                      {filteredSuppliers.map(supplier => (
                        <Pressable
                          key={supplier.id}
                          style={styles.listItem}
                          onPress={() => handleSupplierSelect(supplier.id)}
                        >
                          <Text style={styles.listItemText}>{supplier.external_name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Location Selection - SECONDARY */}
          {lineItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RECEIVING LOCATION</Text>
              {selectedLocation ? (
                <Pressable
                  style={styles.selectedCard}
                  onPress={() => {
                    setShowLocationList(!showLocationList)
                    setShowSupplierList(false)
                    setShowProductList(false)
                  }}
                >
                  <View style={styles.selectedCardInfo}>
                    <Text style={styles.selectedCardTitle}>{selectedLocation.name}</Text>
                    {selectedLocation.city && (
                      <Text style={styles.selectedCardSubtext}>{selectedLocation.city}</Text>
                    )}
                  </View>
                  <Text style={styles.selectedCardChevron}>{showLocationList ? '▼' : '▶'}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.placeholderCard}
                  onPress={() => {
                    setShowLocationList(!showLocationList)
                    setShowSupplierList(false)
                    setShowProductList(false)
                  }}
                >
                  <Text style={styles.placeholderText}>Select location...</Text>
                  <Text style={styles.selectedCardChevron}>{showLocationList ? '▼' : '▶'}</Text>
                </Pressable>
              )}

              {showLocationList && (
                <View style={styles.listCard}>
                  <ScrollView style={styles.list} nestedScrollEnabled>
                    {locations.map((location) => (
                      <Pressable
                        key={location.id}
                        style={[
                          styles.listItem,
                          selectedLocationId === location.id && styles.listItemSelected,
                        ]}
                        onPress={() => handleLocationSelect(location.id)}
                      >
                        <View style={styles.listItemInfo}>
                          <Text style={styles.listItemText}>{location.name}</Text>
                          {location.city && (
                            <Text style={styles.listItemSubtext}>{location.city}</Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Line Items Summary */}
          {lineItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ORDER ITEMS ({lineItems.length})</Text>
              <View style={styles.lineItemsCard}>
                {lineItems.map((item, index) => (
                  <View key={item.id}>
                    <View style={styles.lineItem}>
                      <View style={styles.lineItemInfo}>
                        <Text style={styles.lineItemName}>{item.product.name}</Text>
                        {item.product.sku && (
                          <Text style={styles.lineItemSKU}>SKU: {item.product.sku}</Text>
                        )}
                        <Text style={styles.lineItemMeta}>
                          {item.quantity} × ${item.unitPrice.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.lineItemRight}>
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

          {/* Notes Field */}
          {lineItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes or special instructions..."
                placeholderTextColor="rgba(235,235,245,0.3)"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ===== ACTION BUTTONS ===== */}
          {lineItems.length > 0 && (
            <>
              <Pressable
                onPress={handleSave}
                style={[styles.createButton, (!canSave || saving) && styles.createButtonDisabled]}
                disabled={!canSave || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>+ CREATE PURCHASE ORDER</Text>
                )}
              </Pressable>

              {/* Delete Draft Button - Only show for drafts */}
              {isDraft && (
                <Pressable
                  onPress={handleDeleteDraft}
                  style={styles.deleteDraftButton}
                >
                  <Text style={styles.deleteDraftButtonText}>Delete Draft</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 24,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
  },
  doneButton: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.08,
    marginBottom: 12,
    marginLeft: 4,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  selectedCardInfo: {
    flex: 1,
  },
  selectedCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  selectedCardSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
    marginTop: 4,
  },
  selectedCardChevron: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    marginLeft: 12,
  },
  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  placeholderText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.3)',
    letterSpacing: -0.3,
  },
  listCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    marginTop: 8,
    maxHeight: 300,
    overflow: 'hidden',
  },
  list: {
    maxHeight: 300,
  },
  listItem: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  listItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  listItemInfo: {
    flex: 1,
  },
  listItemText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.3,
  },
  listItemSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
    marginTop: 4,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: -0.2,
  },
  inputCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  input: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
    minHeight: 24,
  },
  productResults: {
    marginTop: 12,
    gap: 8,
  },
  productResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  productResultInfo: {
    flex: 1,
  },
  productResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  productResultSKU: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.1,
    marginTop: 2,
  },
  productResultCategory: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.35)',
    letterSpacing: 0.3,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  productResultPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: -0.2,
    marginLeft: 12,
  },
  selectedProductCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  selectedProductHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectedProductInfo: {
    flex: 1,
  },
  selectedProductName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  selectedProductSKU: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
    marginTop: 4,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 20,
    fontWeight: '300',
    color: 'rgba(235,235,245,0.5)',
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quantityField: {
    flex: 1,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.08,
    marginBottom: 8,
  },
  quantityInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  addItemButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  lineItemsCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  lineItemInfo: {
    flex: 1,
  },
  lineItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  lineItemSKU: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.1,
    marginTop: 2,
  },
  lineItemMeta: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
    marginTop: 4,
  },
  lineItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  lineItemTotal: {
    fontSize: 17,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: -0.2,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ff453a',
    letterSpacing: -0.1,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  subtotalLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.8)',
    letterSpacing: -0.3,
  },
  subtotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  notesInput: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
    minHeight: 100,
  },
  errorCard: {
    marginTop: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 20,
    padding: 16,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#f87171',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  createButton: {
    marginTop: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  deleteDraftButton: {
    marginTop: 16,
    backgroundColor: 'rgba(255,69,58,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.3)',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDraftButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff453a',
    letterSpacing: 0.5,
  },
  searchInputWrapper: {
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  searchInputInline: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
  },
})
