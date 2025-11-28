/**
 * TransferDetailModal Component
 *
 * Uses FullScreenModal (our STANDARD reusable modal component)
 * Shows completed transfer details with all items
 */

import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'
import * as transferService from '@/services/inventory-transfers.service'
import { logger } from '@/utils/logger'
import { FullScreenModal, modalStyles } from '@/components/shared/modals/FullScreenModal'
import type { InventoryTransferItem } from '@/types/pos'

interface TransferItem extends InventoryTransferItem {
  product_name: string
}

/**
 * TransferDetailModal - Uses FullScreenModal ✅
 * Shows read-only details of a completed transfer
 */
export function TransferDetailModal() {
  // ========================================
  // STORES - ZERO PROP DRILLING ✅
  // ========================================
  const showModal = useProductsScreenStore((state) => state.showTransferDetail)
  const selectedTransfer = useProductsScreenStore((state) => state.selectedTransfer)

  // ========================================
  // LOCAL STATE
  // ========================================
  const [items, setItems] = useState<TransferItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [fullTransfer, setFullTransfer] = useState<typeof selectedTransfer>(null)

  // Load transfer items when modal opens
  useEffect(() => {
    if (showModal && selectedTransfer) {
      loadTransferItems()
    } else {
      // Reset when closing
      setItems([])
      setError(null)
      setSearchValue('')
      setFullTransfer(null)
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
      setFullTransfer(transfer) // Store the full transfer with user data

      // Debug: Log the transfer data
      console.log('[TransferDetailModal] Full transfer data:', {
        id: transfer.id,
        created_by_user_id: transfer.created_by_user_id,
        received_by_user_id: transfer.received_by_user_id,
        created_by_user: transfer.created_by_user,
        received_by_user: transfer.received_by_user,
      })
    } catch (err) {
      logger.error('Failed to load transfer items', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    productsScreenActions.closeAllModals()
  }

  const filteredItems = items.filter((item) =>
    item.product_name.toLowerCase().includes(searchValue.toLowerCase())
  )

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalReceived = items.reduce((sum, item) => sum + (item.received_quantity || 0), 0)

  // Format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <FullScreenModal
      visible={showModal}
      onClose={handleClose}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder={`${fullTransfer?.transfer_number || selectedTransfer?.transfer_number || 'Transfer'} Details`}
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
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Transfer Status */}
          <View style={modalStyles.section}>
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: transferService.getTransferStatusColor(
                      fullTransfer?.status || 'draft'
                    ),
                  },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {transferService.getTransferStatusLabel(fullTransfer?.status || 'draft')}
                </Text>
              </View>
              <Text style={styles.transferNumber}>{fullTransfer?.transfer_number}</Text>
            </View>
          </View>

          {/* Transfer Route */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionLabel}>ROUTE</Text>
            <View style={styles.routeCard}>
              <View style={styles.routeRow}>
                <Text style={styles.routeLabel}>FROM</Text>
                <Text style={styles.routeValue}>
                  {fullTransfer?.source_location?.name || 'Unknown'}
                </Text>
              </View>
              <View style={styles.routeArrow}>
                <Text style={styles.routeArrowText}>→</Text>
              </View>
              <View style={styles.routeRow}>
                <Text style={styles.routeLabel}>TO</Text>
                <Text style={styles.routeValue}>
                  {fullTransfer?.destination_location?.name || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>

          {/* Transfer Timeline */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionLabel}>TIMELINE</Text>
            <View style={styles.timelineCard}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeftColumn}>
                  <Text style={styles.timelineLabel}>Created</Text>
                  {fullTransfer?.created_by_user && (
                    <Text style={styles.employeeName}>
                      {fullTransfer.created_by_user.first_name}{' '}
                      {fullTransfer.created_by_user.last_name}
                    </Text>
                  )}
                </View>
                <Text style={styles.timelineValue}>
                  {formatDate(fullTransfer?.created_at)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeftColumn}>
                  <Text style={styles.timelineLabel}>Shipped</Text>
                </View>
                <Text style={styles.timelineValue}>
                  {formatDate(fullTransfer?.shipped_at)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.timelineRow}>
                <View style={styles.timelineLeftColumn}>
                  <Text style={styles.timelineLabel}>Received</Text>
                  {fullTransfer?.received_by_user && (
                    <Text style={styles.employeeName}>
                      {fullTransfer.received_by_user.first_name}{' '}
                      {fullTransfer.received_by_user.last_name}
                    </Text>
                  )}
                </View>
                <Text style={styles.timelineValue}>
                  {formatDate(fullTransfer?.received_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* Items Section */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionLabel}>ITEMS ({filteredItems.length})</Text>

            <View style={styles.itemsCard}>
              {filteredItems.map((item, index) => {
                const conditionColor =
                  item.condition === 'good'
                    ? '#34C759'
                    : item.condition === 'damaged'
                    ? '#FF9500'
                    : '#FF453A'

                return (
                  <View key={item.id}>
                    <View style={styles.itemRow}>
                      {/* Left: Product Info */}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        <View style={styles.itemMetaRow}>
                          <Text style={styles.itemMeta}>Shipped: {item.quantity}</Text>
                          <Text style={styles.itemMeta}>•</Text>
                          <Text style={styles.itemMeta}>
                            Received: {item.received_quantity || 0}
                          </Text>
                          {item.condition && (
                            <>
                              <Text style={styles.itemMeta}>•</Text>
                              <Text style={[styles.itemCondition, { color: conditionColor }]}>
                                {item.condition.toUpperCase()}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                    {index < filteredItems.length - 1 && <View style={styles.divider} />}
                  </View>
                )
              })}

              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Shipped</Text>
                <Text style={styles.totalValue}>{totalQuantity}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Received</Text>
                <Text style={styles.totalValue}>{totalReceived}</Text>
              </View>
            </View>
          </View>

          {/* Notes Section */}
          {fullTransfer?.notes && (
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>NOTES</Text>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{fullTransfer.notes}</Text>
              </View>
            </View>
          )}
        </ScrollView>
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
  statusCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transferNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
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
  timelineCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  timelineLeftColumn: {
    flex: 1,
    gap: 2,
  },
  timelineLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  employeeName: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.08,
  },
  timelineValue: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.08,
    textAlign: 'right',
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
  itemMetaRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  itemMeta: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: -0.08,
  },
  itemCondition: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.08,
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
  notesCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  notesText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.8)',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
})
