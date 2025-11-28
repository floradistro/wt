/**
 * ReceivePOModal Component
 *
 * Uses FullScreenModal (our STANDARD reusable modal component)
 * Receives purchase order items
 */

import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useState, useEffect, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { receiveItems } from '@/services/purchase-orders.service'
import { purchaseOrdersActions } from '@/stores/purchase-orders.store'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'
import { logger } from '@/utils/logger'
import { FullScreenModal, modalStyles } from '@/components/shared/modals/FullScreenModal'

interface POItem {
  id: string
  product_id: string
  product_name: string
  product_sku?: string
  quantity: number
  received_quantity: number
  unit_price: number
}

/**
 * ReceivePOModal - Uses FullScreenModal ✅
 */
export function ReceivePOModal() {
  // ========================================
  // STORES - ZERO PROP DRILLING ✅
  // ========================================
  const showModal = useProductsScreenStore((state) => state.showReceivePO)
  const selectedPO = useProductsScreenStore((state) => state.selectedPurchaseOrder)

  // ========================================
  // LOCAL STATE
  // ========================================
  const [items, setItems] = useState<POItem[]>([])
  const [receiving, setReceiving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({})
  const [searchValue, setSearchValue] = useState('')
  const inputRefs = useRef<Record<string, TextInput | null>>({})

  // Load PO items when modal opens
  useEffect(() => {
    if (showModal && selectedPO) {
      loadPOItems()
    } else {
      // Reset when closing
      setItems([])
      setReceiveQuantities({})
      setError(null)
      setSearchValue('')
    }
  }, [showModal, selectedPO?.id])

  const loadPOItems = async () => {
    if (!selectedPO) return

    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          products (
            name,
            sku
          )
        `)
        .eq('purchase_order_id', selectedPO.id)
        .order('created_at')

      if (fetchError) throw fetchError

      const itemsWithProducts = (data || []).map((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: product?.name || '',
          product_sku: product?.sku || '',
          quantity: item.quantity,
          received_quantity: item.received_quantity || 0,
          unit_price: item.unit_price,
        }
      })

      setItems(itemsWithProducts)

      // Initialize receive quantities with remaining amounts
      const initialQuantities: Record<string, string> = {}
      itemsWithProducts.forEach((item) => {
        const remaining = item.quantity - item.received_quantity
        initialQuantities[item.id] = remaining > 0 ? remaining.toString() : '0'
      })
      setReceiveQuantities(initialQuantities)
    } catch (err) {
      logger.error('Failed to load PO items', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  const handleReceiveAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const allQuantities: Record<string, string> = {}
    items.forEach((item) => {
      const remaining = item.quantity - item.received_quantity
      allQuantities[item.id] = remaining > 0 ? remaining.toString() : '0'
    })
    setReceiveQuantities(allQuantities)
  }

  const handleReceive = async () => {
    if (!selectedPO) return

    try {
      setReceiving(true)
      setError(null)

      // Validate location
      if (!selectedPO.location_id) {
        setError('Purchase order has no location assigned')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return
      }

      // Build items array for API
      const itemsToReceive = Object.entries(receiveQuantities)
        .map(([itemId, qty]) => {
          const parsedQty = parseInt(qty, 10)
          if (isNaN(parsedQty) || parsedQty <= 0) return null
          return {
            item_id: itemId,
            quantity: parsedQty,
            condition: 'good' as const, // Default to good condition
          }
        })
        .filter(Boolean) as { item_id: string; quantity: number; condition: 'good' }[]

      if (itemsToReceive.length === 0) {
        setError('Enter quantities to receive')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return
      }

      // Call receive API with location ID
      await receiveItems(selectedPO.id, itemsToReceive, selectedPO.location_id)

      // Reload PO list via store
      await purchaseOrdersActions.loadPurchaseOrders({})

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      logger.info('[ReceivePOModal] Items received successfully', {
        poId: selectedPO.id,
        locationId: selectedPO.location_id,
        itemCount: itemsToReceive.length,
      })

      productsScreenActions.closeAllModals()
    } catch (err) {
      logger.error('Failed to receive items', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to receive items')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setReceiving(false)
    }
  }

  const handleClose = () => {
    productsScreenActions.closeAllModals()
  }

  const totalToReceive = Object.values(receiveQuantities).reduce((sum, qty) => {
    const parsed = parseInt(qty, 10)
    return sum + (isNaN(parsed) ? 0 : parsed)
  }, 0)

  const filteredItems = items.filter((item) =>
    item.product_name.toLowerCase().includes(searchValue.toLowerCase())
  )

  return (
    <FullScreenModal
      visible={showModal}
      onClose={handleClose}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder={`Receive ${selectedPO?.po_number || 'PO'}`}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="rgba(235,235,245,0.6)" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Receive All Button */}
          <View style={modalStyles.section}>
            <Pressable
              onPress={handleReceiveAll}
              style={[modalStyles.card, { padding: 16, alignItems: 'center' }]}
            >
              <Text style={styles.receiveAllText}>Receive All Remaining</Text>
            </Pressable>
          </View>

          {/* Items Section */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionLabel}>ITEMS ({filteredItems.length})</Text>

            <View style={styles.itemsCard}>
              {filteredItems.map((item, index) => {
                const remaining = item.quantity - item.received_quantity

                return (
                  <View key={item.id}>
                    <View style={styles.itemRow}>
                      {/* Left: Product Info */}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        {item.product_sku && <Text style={styles.itemSKU}>SKU: {item.product_sku}</Text>}
                        <Text style={styles.itemMeta}>
                          Ordered: {item.quantity} • Received: {item.received_quantity} • Remaining: {remaining}
                        </Text>
                      </View>

                      {/* Right: Quantity Input */}
                      <View style={styles.itemRight}>
                        <TextInput
                          ref={(ref) => {
                            inputRefs.current[item.id] = ref
                          }}
                          style={styles.quantityInput}
                          value={receiveQuantities[item.id] || ''}
                          onChangeText={(text) => {
                            setReceiveQuantities((prev) => ({
                              ...prev,
                              [item.id]: text,
                            }))
                          }}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor="rgba(235,235,245,0.3)"
                          returnKeyType={index === filteredItems.length - 1 ? 'done' : 'next'}
                          selectTextOnFocus
                          onSubmitEditing={() => {
                            if (index < filteredItems.length - 1) {
                              const nextItem = filteredItems[index + 1]
                              inputRefs.current[nextItem.id]?.focus()
                            }
                          }}
                          blurOnSubmit={index === filteredItems.length - 1}
                        />
                      </View>
                    </View>
                    {index < filteredItems.length - 1 && <View style={styles.divider} />}
                  </View>
                )
              })}

              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total to Receive</Text>
                <Text style={styles.totalValue}>{totalToReceive}</Text>
              </View>
            </View>
          </View>

          {/* Receive Button */}
          <Pressable
            onPress={handleReceive}
            style={[modalStyles.button, !totalToReceive && modalStyles.buttonDisabled]}
            disabled={!totalToReceive || receiving}
          >
            {receiving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={modalStyles.buttonText}>RECEIVE ITEMS</Text>
            )}
          </Pressable>
        </>
      )}
    </FullScreenModal>
  )
}

// ========================================
// CUSTOM STYLES (extend modalStyles)
// ========================================
const styles = StyleSheet.create({
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 16,
    margin: 16,
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderRadius: 20,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#ff453a',
    textAlign: 'center',
  },
  receiveAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  itemsCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  itemSKU: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.08,
  },
  itemMeta: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.08,
    marginTop: 2,
  },
  itemRight: {
    width: 80,
  },
  quantityInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(235,235,245,0.2)',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0a84ff',
    letterSpacing: -0.3,
  },
})
