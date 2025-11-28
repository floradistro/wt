/**
 * ReceiveTransferModal Component
 *
 * Uses FullScreenModal (our STANDARD reusable modal component)
 * Receives inventory transfer items
 */

import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useState, useEffect, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'
import { useTransfersStore } from '@/stores/inventory-transfers.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import * as transferService from '@/services/inventory-transfers.service'
import { logger } from '@/utils/logger'
import { FullScreenModal, modalStyles } from '@/components/shared/modals/FullScreenModal'
import type { InventoryTransferItem } from '@/types/pos'

interface TransferItem extends InventoryTransferItem {
  product_name: string
}

/**
 * ReceiveTransferModal - Uses FullScreenModal ✅
 */
export function ReceiveTransferModal() {
  // ========================================
  // STORES - ZERO PROP DRILLING ✅
  // ========================================
  const { user } = useAppAuth()
  const showModal = useProductsScreenStore((state) => state.showReceiveTransfer)
  const selectedTransfer = useProductsScreenStore((state) => state.selectedTransfer)

  // ========================================
  // LOCAL STATE
  // ========================================
  const [items, setItems] = useState<TransferItem[]>([])
  const [receiving, setReceiving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({})
  const [searchValue, setSearchValue] = useState('')
  const inputRefs = useRef<Record<string, TextInput | null>>({})

  // Load transfer items when modal opens
  useEffect(() => {
    if (showModal && selectedTransfer) {
      loadTransferItems()
    } else {
      // Reset when closing
      setItems([])
      setReceiveQuantities({})
      setError(null)
      setSearchValue('')
    }
  }, [showModal, selectedTransfer?.id])

  const loadTransferItems = async () => {
    if (!selectedTransfer) return

    try {
      setLoading(true)
      // Fetch full transfer details with items and products
      const transfer = await transferService.fetchTransferById(selectedTransfer.id)

      if (!transfer || !transfer.items) {
        throw new Error('Transfer items not found')
      }

      const itemsWithNames: TransferItem[] = transfer.items.map((item) => ({
        ...item,
        product_name: item.product?.name || 'Unknown Product',
      }))

      setItems(itemsWithNames)

      // Initialize receive quantities with full amounts (all items good by default)
      const initialQuantities: Record<string, string> = {}
      itemsWithNames.forEach((item) => {
        initialQuantities[item.id] = item.quantity.toString()
      })
      setReceiveQuantities(initialQuantities)
    } catch (err) {
      logger.error('Failed to load transfer items', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  const handleReceiveAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const allQuantities: Record<string, string> = {}
    items.forEach((item) => {
      allQuantities[item.id] = item.quantity.toString()
    })
    setReceiveQuantities(allQuantities)
  }

  const handleReceive = async () => {
    if (!selectedTransfer) return

    try {
      setReceiving(true)
      setError(null)

      // Build items array for API
      const itemsToReceive = Object.entries(receiveQuantities)
        .map(([itemId, qty]) => {
          const parsedQty = parseInt(qty, 10)
          if (isNaN(parsedQty) || parsedQty <= 0) return null
          return {
            item_id: itemId,
            received_quantity: parsedQty,
            condition: 'good' as const, // Default to good condition
          }
        })
        .filter(Boolean) as { item_id: string; received_quantity: number; condition: 'good' }[]

      if (itemsToReceive.length === 0) {
        setError('Enter quantities to receive')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return
      }

      // Call complete transfer API
      await useTransfersStore.getState().completeTransfer(
        selectedTransfer.id,
        { items: itemsToReceive },
        user?.id
      )

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      logger.info('[ReceiveTransferModal] Items received successfully', {
        transferId: selectedTransfer.id,
        itemCount: itemsToReceive.length,
      })

      productsScreenActions.closeAllModals()
    } catch (err) {
      logger.error('Failed to receive transfer items', { error: err })
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
      searchPlaceholder={`Receive ${selectedTransfer?.transfer_number || 'Transfer'}`}
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
          {/* Transfer Route Info */}
          <View style={modalStyles.section}>
            <View style={styles.routeCard}>
              <View style={styles.routeRow}>
                <Text style={styles.routeLabel}>FROM</Text>
                <Text style={styles.routeValue}>
                  {selectedTransfer?.source_location?.name || 'Unknown'}
                </Text>
              </View>
              <View style={styles.routeArrow}>
                <Text style={styles.routeArrowText}>→</Text>
              </View>
              <View style={styles.routeRow}>
                <Text style={styles.routeLabel}>TO</Text>
                <Text style={styles.routeValue}>
                  {selectedTransfer?.destination_location?.name || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>

          {/* Receive All Button */}
          <View style={modalStyles.section}>
            <Pressable
              onPress={handleReceiveAll}
              style={[modalStyles.card, { padding: 16, alignItems: 'center' }]}
            >
              <Text style={styles.receiveAllText}>Receive All Items</Text>
            </Pressable>
          </View>

          {/* Items Section */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionLabel}>ITEMS ({filteredItems.length})</Text>

            <View style={styles.itemsCard}>
              {filteredItems.map((item, index) => {
                return (
                  <View key={item.id}>
                    <View style={styles.itemRow}>
                      {/* Left: Product Info */}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        <Text style={styles.itemMeta}>
                          Quantity: {item.quantity}
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
  routeCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  routeRow: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  routeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  routeArrow: {
    paddingHorizontal: 8,
  },
  routeArrowText: {
    fontSize: 24,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
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
