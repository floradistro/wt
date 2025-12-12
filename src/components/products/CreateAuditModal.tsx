/**
 * CreateAuditModal Component
 *
 * STANDARD MODAL PATTERN ✅
 * Full-screen slide-up sheet for quick inventory audits
 *
 * Pattern: Full-screen slide-up sheet with pill-shaped inputs
 * Reference: CategoryModal (GOLD STANDARD)
 *
 * Flow: Select location → Select categories (optional) → Count products
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
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCategories } from '@/hooks/useCategories'
import { useInventoryAdjustments } from '@/hooks/useInventoryAdjustments'
import { createBulkInventoryAdjustments } from '@/services/inventory-adjustments.service'
import { logger } from '@/utils/logger'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useProductsStore } from '@/stores/products.store'

interface CreateAuditModalProps {
  visible: boolean
  onClose: () => void
  onCreated?: () => void
}

interface AuditEntry {
  productId: string
  productName: string
  currentQuantity: number
  countedQuantity: string
}

/**
 * CreateAuditModal - Quick inventory audit
 * Full-screen sheet - EXACT match to CategoryModal
 */
export function CreateAuditModal({ visible, onClose, onCreated }: CreateAuditModalProps) {
  const insets = useSafeAreaInsets()

  // ========================================
  // HOOKS & STORES - ZERO PROP DRILLING
  // ========================================
  const products = useProductsStore((state) => state.products)
  const loadProducts = useProductsStore((state) => state.loadProducts)
  const { locations } = useAppAuth()
  const { categories } = useCategories()
  const { vendorId } = useInventoryAdjustments()

  // ========================================
  // LOCAL STATE
  // ========================================
  const [productSearch, setProductSearch] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [auditEntries, setAuditEntries] = useState<Map<string, AuditEntry>>(new Map())
  const [auditReason, setAuditReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [showLocationList, setShowLocationList] = useState(false)
  const [showCategoryList, setShowCategoryList] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [locationsWithDrafts, setLocationsWithDrafts] = useState<Set<string>>(new Set())

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRestoringRef = useRef(false)

  // Draft storage key
  const getDraftKey = useCallback((locationId: string) => {
    return `audit-draft-${vendorId}-${locationId}`
  }, [vendorId])

  // Save draft to AsyncStorage
  const saveDraft = useCallback(async () => {
    if (!selectedLocationId || auditEntries.size === 0) return

    try {
      const draft = {
        locationId: selectedLocationId,
        categoryIds: selectedCategoryIds,
        reason: auditReason,
        entries: Array.from(auditEntries.values()),
        timestamp: Date.now(),
      }

      await AsyncStorage.setItem(getDraftKey(selectedLocationId), JSON.stringify(draft))

      setLocationsWithDrafts(prev => {
        const updated = new Set(prev)
        updated.add(selectedLocationId)
        return updated
      })

      logger.info('Audit draft auto-saved', {
        locationId: selectedLocationId,
        entryCount: auditEntries.size
      })
    } catch (err) {
      logger.error('Failed to save audit draft:', err)
    }
  }, [selectedLocationId, selectedCategoryIds, auditReason, auditEntries, getDraftKey])

  // Load draft from AsyncStorage
  const loadDraft = useCallback(async (locationId: string) => {
    try {
      const draftJson = await AsyncStorage.getItem(getDraftKey(locationId))
      if (!draftJson) return null

      const draft = JSON.parse(draftJson)

      // Check if draft is recent (within 7 days)
      const age = Date.now() - draft.timestamp
      if (age > 7 * 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(getDraftKey(locationId))
        return null
      }

      return draft
    } catch (err) {
      logger.error('Failed to load audit draft:', err)
      return null
    }
  }, [getDraftKey])

  // Clear draft from AsyncStorage
  const clearDraft = useCallback(async (locationId?: string) => {
    try {
      const locId = locationId || selectedLocationId
      const key = getDraftKey(locId)
      await AsyncStorage.removeItem(key)

      setLocationsWithDrafts(prev => {
        const updated = new Set(prev)
        updated.delete(locId)
        return updated
      })

      logger.info('Audit draft cleared', { locationId: locId })
    } catch (err) {
      logger.error('Failed to clear audit draft:', err)
    }
  }, [selectedLocationId, getDraftKey])

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setProductSearch('')
      setSelectedLocationId('')
      setSelectedCategoryIds([])
      setAuditEntries(new Map())
      setAuditReason('')
      setShowLocationList(false)
      setShowCategoryList(false)
      setDraftRestored(false)
      isRestoringRef.current = false
    }
  }, [visible])

  // Load products for selected location
  useEffect(() => {
    if (selectedLocationId && visible) {
      logger.info('Loading products for audit modal', { locationId: selectedLocationId })
      loadProducts(selectedLocationId)
    }
  }, [selectedLocationId, visible, loadProducts])

  // Scan for available drafts when modal opens
  useEffect(() => {
    if (!visible || !vendorId || locations.length === 0) return

    const scanForDrafts = async () => {
      try {
        const draftsFound = new Set<string>()
        for (const location of locations) {
          const draft = await loadDraft(location.id)
          if (draft) {
            draftsFound.add(location.id)
          }
        }
        setLocationsWithDrafts(draftsFound)
      } catch (err) {
        logger.error('Failed to scan for drafts:', err)
      }
    }

    scanForDrafts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vendorId])

  // Auto-restore draft when location is selected
  useEffect(() => {
    if (!selectedLocationId || isRestoringRef.current || !visible) return

    const restoreDraft = async () => {
      isRestoringRef.current = true
      try {
        const draft = await loadDraft(selectedLocationId)
        if (!draft || !draft.entries || draft.entries.length === 0) {
          isRestoringRef.current = false
          return
        }

        // Restore category filters
        if (draft.categoryIds?.length > 0) {
          setSelectedCategoryIds(draft.categoryIds)
        }

        // Restore audit reason
        if (draft.reason) {
          setAuditReason(draft.reason)
        }

        // Restore audit entries
        const restoredEntries = new Map<string, AuditEntry>()
        for (const entry of draft.entries) {
          restoredEntries.set(entry.productId, entry)
        }

        setAuditEntries(restoredEntries)
        setDraftRestored(true)

        logger.info('Audit draft restored', {
          locationId: selectedLocationId,
          entryCount: restoredEntries.size,
        })

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Hide restored indicator after 3 seconds
        setTimeout(() => setDraftRestored(false), 3000)
      } catch (err) {
        logger.error('Failed to restore draft:', err)
      } finally {
        isRestoringRef.current = false
      }
    }

    restoreDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, visible])

  // Debounced auto-save when audit data changes
  useEffect(() => {
    if (isRestoringRef.current || !visible) return

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Save after 500ms of no changes
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft()
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [selectedLocationId, selectedCategoryIds, auditReason, auditEntries, visible, saveDraft])

  // Selected location data
  const selectedLocation = useMemo(
    () => locations.find(l => l.id === selectedLocationId),
    [locations, selectedLocationId]
  )

  // Selected category names for display
  const selectedCategoryNames = useMemo(() => {
    if (selectedCategoryIds.length === 0) return 'All categories'
    return selectedCategoryIds
      .map(id => categories.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ')
  }, [selectedCategoryIds, categories])

  // Get current quantity for a product at selected location
  const getCurrentQuantity = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId)
    // Use inventory_quantity which is set when loading for specific location
    return product?.inventory_quantity ?? 0
  }, [products])

  // Get unit label for a product (grams vs units)
  const getUnitLabel = useCallback((product: any) => {
    // Check if product tracks by weight or units
    const trackingType = product.tracking_type || product.custom_fields?.tracking_type

    if (trackingType === 'weight' || !trackingType) {
      return 'g' // Default to grams for cannabis products
    }
    return 'units'
  }, [])

  // Filter products by location and categories
  const filteredProducts = useMemo(() => {
    if (!selectedLocationId) return []

    logger.info('Filtering products', {
      totalProducts: products.length,
      selectedLocationId,
      selectedCategoryIds,
      productSearch,
      sampleProduct: products[0] ? {
        name: products[0].name,
        inventory: products[0].inventory,
        inventory_quantity: products[0].inventory_quantity,
      } : null,
    })

    let filtered = products.filter(p => {
      // Has inventory at selected location with quantity > 0
      const locationInventory = p.inventory?.find(inv => inv.location_id === selectedLocationId)
      const hasInventoryAtLocation = locationInventory && locationInventory.quantity > 0

      // Also check inventory_quantity (set when loading for specific location)
      const hasQuantity = (p.inventory_quantity ?? 0) > 0

      // Must have stock at this location
      if (!hasInventoryAtLocation && !hasQuantity) return false

      // Filter by categories if any selected
      if (selectedCategoryIds.length > 0) {
        if (!p.primary_category_id) return false
        if (!selectedCategoryIds.includes(p.primary_category_id)) return false
      }

      // Filter by search query
      if (productSearch.trim()) {
        const query = productSearch.toLowerCase()
        const matchesName = p.name.toLowerCase().includes(query)
        const matchesSku = p.sku?.toLowerCase().includes(query)
        if (!matchesName && !matchesSku) return false
      }

      return true
    })

    logger.info('Filtered products result', {
      filteredCount: filtered.length,
      sampleFiltered: filtered[0] ? {
        name: filtered[0].name,
        inventory: filtered[0].inventory,
      } : null,
    })

    // Sort alphabetically
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [products, selectedLocationId, selectedCategoryIds, productSearch])

  // Handle quantity input for a product
  const handleQuantityChange = useCallback((productId: string, productName: string, value: string) => {
    const currentQuantity = getCurrentQuantity(productId)
    const newEntries = new Map(auditEntries)

    // Remove entry if empty
    if (value.trim() === '') {
      newEntries.delete(productId)
    } else {
      newEntries.set(productId, {
        productId,
        productName,
        currentQuantity,
        countedQuantity: value,
      })
    }

    setAuditEntries(newEntries)
  }, [auditEntries, getCurrentQuantity])

  // Toggle category selection
  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const handleSave = async () => {
    if (!selectedLocationId) {
      Alert.alert('Location Required', 'Please select a location for the audit')
      return
    }

    if (auditEntries.size === 0) {
      Alert.alert('No Counts Entered', 'Please enter counted quantities for at least one product')
      return
    }

    if (!auditReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for this audit')
      return
    }

    if (!vendorId) {
      Alert.alert('Error', 'Vendor information not found')
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const entries = Array.from(auditEntries.values())

      // Create adjustments for each counted item
      const adjustments = entries.map(entry => {
        const countedQty = parseFloat(entry.countedQuantity) || 0
        const difference = countedQty - entry.currentQuantity
        const product = products.find(p => p.id === entry.productId)
        const unitLabel = product ? getUnitLabel(product) : 'g'

        return {
          product_id: entry.productId,
          location_id: selectedLocationId,
          adjustment_type: 'count_correction' as const,
          quantity_change: difference,
          reason: `Audit: ${auditReason}`,
          notes: `Counted: ${countedQty}${unitLabel} (was ${entry.currentQuantity}${unitLabel})`,
        }
      })

      // Use bulk atomic function
      const { data, error } = await createBulkInventoryAdjustments(vendorId, adjustments)

      if (error) throw error

      const successCount = data?.succeeded || 0
      const errorCount = data?.failed || 0

      if (successCount > 0) {
        // Clear the draft on successful completion
        await clearDraft(selectedLocationId)

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onCreated?.()
        handleClose()

        if (errorCount > 0) {
          Alert.alert('Partially Complete', `${successCount} products counted successfully\n${errorCount} failed`)
        }
      } else {
        throw new Error('All adjustments failed')
      }

    } catch (err) {
      logger.error('Failed to complete audit:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save audit'
      Alert.alert('Error', errorMessage)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const canSave = selectedLocationId && auditEntries.size > 0 && auditReason.trim() !== ''

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
              style={styles.searchInput}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Search products..."
              placeholderTextColor="rgba(235,235,245,0.3)"
              autoFocus={selectedLocationId !== ''}
              returnKeyType="search"
            />
          </View>
          <Pressable onPress={handleClose} style={styles.doneButton}>
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
          {/* Location Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LOCATION</Text>
            {selectedLocation ? (
              <Pressable
                style={styles.selectedCard}
                onPress={() => {
                  setShowLocationList(!showLocationList)
                  setShowCategoryList(false)
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
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
                  logger.info('Location selector clicked', { locationsCount: locations.length })
                  setShowLocationList(!showLocationList)
                  setShowCategoryList(false)
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }}
              >
                <Text style={styles.placeholderText}>Select location...</Text>
                <Text style={styles.selectedCardChevron}>{showLocationList ? '▼' : '▶'}</Text>
              </Pressable>
            )}

            {showLocationList && (
              <View style={styles.listCard}>
                {locations.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No locations found</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.list} nestedScrollEnabled>
                    {locations.map((location) => (
                    <Pressable
                      key={location.id}
                      style={styles.listItem}
                      onPress={() => {
                        setSelectedLocationId(location.id)
                        setShowLocationList(false)
                        setAuditEntries(new Map()) // Reset entries when location changes
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      }}
                    >
                      <View style={styles.locationItemContent}>
                        <View style={styles.listItemInfo}>
                          <Text style={styles.listItemText}>{location.name}</Text>
                          {location.city && (
                            <Text style={styles.listItemSubtext}>{location.city}</Text>
                          )}
                        </View>
                        {locationsWithDrafts.has(location.id) && (
                          <View style={styles.draftBadge}>
                            <Text style={styles.draftBadgeText}>Draft</Text>
                          </View>
                        )}
                      </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Category Filter */}
          {selectedLocationId && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                CATEGORIES {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
              </Text>
              <Pressable
                style={styles.selectedCard}
                onPress={() => {
                  setShowCategoryList(!showCategoryList)
                  setShowLocationList(false)
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }}
              >
                <Text style={styles.selectedCardTitle}>{selectedCategoryNames}</Text>
                <Text style={styles.selectedCardChevron}>{showCategoryList ? '▼' : '▶'}</Text>
              </Pressable>

              {showCategoryList && (
                <View style={styles.listCard}>
                  <ScrollView style={styles.list} nestedScrollEnabled>
                    {/* Clear All option */}
                    {selectedCategoryIds.length > 0 && (
                      <Pressable
                        style={[styles.listItem, styles.clearAllItem]}
                        onPress={() => {
                          setSelectedCategoryIds([])
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        }}
                      >
                        <Text style={styles.clearAllText}>Clear All (Show All Products)</Text>
                      </Pressable>
                    )}
                    {categories.map(category => {
                      const isSelected = selectedCategoryIds.includes(category.id)
                      return (
                        <Pressable
                          key={category.id}
                          style={[
                            styles.listItem,
                            isSelected && styles.listItemSelected,
                          ]}
                          onPress={() => toggleCategory(category.id)}
                        >
                          <View style={styles.checkboxContainer}>
                            <View style={styles.checkbox}>
                              {isSelected && <View style={styles.checkmark} />}
                            </View>
                            <Text style={styles.listItemText}>{category.name}</Text>
                          </View>
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Draft Restored Indicator */}
          {draftRestored && (
            <View style={styles.draftIndicator}>
              <Text style={styles.draftIndicatorText}>✓ Draft restored</Text>
            </View>
          )}

          {/* Audit Reason */}
          {selectedLocationId && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>AUDIT REASON</Text>
              <View style={styles.descriptionCard}>
                <TextInput
                  style={styles.descriptionInput}
                  value={auditReason}
                  onChangeText={setAuditReason}
                  placeholder="e.g., Monthly count, Cycle count, Spot check..."
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}

          {/* Products List with Count Inputs */}
          {selectedLocationId && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                PRODUCTS ({filteredProducts.length})
              </Text>

              {filteredProducts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {productSearch
                      ? 'No products match your search'
                      : selectedCategoryIds.length > 0
                      ? 'No products in selected categories'
                      : 'No products at this location'}
                  </Text>
                </View>
              ) : (
                <View style={styles.productsCard}>
                  {filteredProducts.map((product) => {
                    const currentQty = getCurrentQuantity(product.id)
                    const entry = auditEntries.get(product.id)
                    const countedQty = entry?.countedQuantity || ''
                    const unitLabel = getUnitLabel(product)

                    return (
                      <View key={product.id} style={styles.productRow}>
                        <View style={styles.productInfo}>
                          <Text style={styles.productName}>{product.name}</Text>
                          {product.sku && (
                            <Text style={styles.productSku}>SKU: {product.sku}</Text>
                          )}
                          <Text style={styles.productCurrent}>
                            Current: {currentQty}{unitLabel}
                          </Text>
                        </View>
                        <View style={styles.quantityInput}>
                          <TextInput
                            style={styles.quantityInputField}
                            value={countedQty}
                            onChangeText={(value) => handleQuantityChange(product.id, product.name, value)}
                            placeholder={currentQty.toString()}
                            placeholderTextColor="rgba(235,235,245,0.3)"
                            keyboardType="numeric"
                            returnKeyType="next"
                          />
                          <Text style={styles.quantityInputLabel}>{unitLabel}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          {/* Summary */}
          {auditEntries.size > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {auditEntries.size} product{auditEntries.size > 1 ? 's' : ''} counted
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ===== STICKY ACTION BUTTON ===== */}
        {selectedLocationId && (
          <View style={[styles.stickyButtonContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              onPress={handleSave}
              style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
              disabled={!canSave || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  + COMPLETE AUDIT ({auditEntries.size})
                </Text>
              )}
            </Pressable>
          </View>
        )}
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
    paddingBottom: 100,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(16,185,129,1)',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  productsCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 16,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  productSku: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
    marginTop: 2,
  },
  productCurrent: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(16,185,129,0.8)',
    letterSpacing: -0.1,
    marginTop: 4,
  },
  quantityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityInputField: {
    width: 80,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'right',
  },
  quantityInputLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
  },
  summaryCard: {
    marginTop: 20,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(16,185,129,1)',
    letterSpacing: -0.2,
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  locationItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  draftBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginLeft: 12,
  },
  draftBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(16,185,129,1)',
    letterSpacing: 0.3,
  },
  draftIndicator: {
    marginTop: 20,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
  },
  draftIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(16,185,129,1)',
    letterSpacing: -0.1,
  },
  descriptionCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  descriptionInput: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.2,
    minHeight: 60,
  },
  clearAllItem: {
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,59,48,0.3)',
  },
  clearAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,59,48,1)',
    letterSpacing: -0.2,
  },
})
