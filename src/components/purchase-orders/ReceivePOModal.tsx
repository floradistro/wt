/**
 * Receive Purchase Order Modal
 * Built with inline selectors following Settings pattern
 */

import React, { useState, useMemo, useEffect } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, TextInput, ScrollView, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { PurchaseOrder } from '@/services/purchase-orders.service'

interface ReceivePOModalProps {
  visible: boolean
  purchaseOrder: PurchaseOrder
  onClose: () => void
  onReceived: () => void
}

interface POItem {
  id: string
  product_id: string
  product_name: string
  product_sku?: string
  quantity: number
  received_quantity: number
  unit_price: number
}

interface ReceiveItem {
  itemId: string
  receiveQuantity: number
}

export function ReceivePOModal({
  visible,
  purchaseOrder,
  onClose,
  onReceived,
}: ReceivePOModalProps) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [items, setItems] = useState<POItem[]>([])
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modalStyle = useMemo(() => ({
    width: isLandscape ? '75%' : '90%',
    maxWidth: isLandscape ? 800 : 700,
    maxHeight: height * 0.92,
  }), [isLandscape, height])

  const scrollContentStyle = useMemo(() => ({
    maxHeight: isLandscape ? height * 0.65 : height * 0.7,
  }), [isLandscape, height])

  useEffect(() => {
    if (visible) {
      loadItems()
    }
  }, [visible, purchaseOrder.id])

  const loadItems = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          products (
            name,
            sku
          )
        `)
        .eq('purchase_order_id', purchaseOrder.id)
        .order('created_at')

      if (fetchError) throw fetchError

      const itemsWithProducts = (data || []).map((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: product?.name || 'Unknown Product',
          product_sku: product?.sku || '',
          quantity: item.quantity,
          received_quantity: item.received_quantity || 0,
          unit_price: item.unit_price,
        }
      })

      setItems(itemsWithProducts)

      // Initialize receive quantities to remaining quantity for each item
      const initialQuantities: Record<string, string> = {}
      itemsWithProducts.forEach((item: POItem) => {
        const remaining = item.quantity - item.received_quantity
        initialQuantities[item.id] = remaining > 0 ? remaining.toString() : '0'
      })
      setReceiveQuantities(initialQuantities)
    } catch (err) {
      logger.error('Failed to load PO items', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuantityChange = (itemId: string, value: string) => {
    setReceiveQuantities(prev => ({
      ...prev,
      [itemId]: value,
    }))
    setError(null)
  }

  const handleReceiveAll = () => {
    const allQuantities: Record<string, string> = {}
    items.forEach(item => {
      const remaining = item.quantity - item.received_quantity
      allQuantities[item.id] = remaining > 0 ? remaining.toString() : '0'
    })
    setReceiveQuantities(allQuantities)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleClearAll = () => {
    const clearedQuantities: Record<string, string> = {}
    items.forEach(item => {
      clearedQuantities[item.id] = '0'
    })
    setReceiveQuantities(clearedQuantities)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleSubmit = async () => {
    try {
      setError(null)

      // Validate and collect receive items
      const receiveItems: ReceiveItem[] = []
      for (const item of items) {
        const qtyStr = receiveQuantities[item.id] || '0'
        const qty = parseFloat(qtyStr)

        if (isNaN(qty) || qty < 0) {
          setError(`Invalid quantity for ${item.product_name}`)
          return
        }

        if (qty > 0) {
          const remaining = item.quantity - item.received_quantity
          if (qty > remaining) {
            setError(`Cannot receive more than ${remaining} for ${item.product_name}`)
            return
          }
          receiveItems.push({
            itemId: item.id,
            receiveQuantity: qty,
          })
        }
      }

      if (receiveItems.length === 0) {
        setError('Please enter quantities to receive')
        return
      }

      setIsSubmitting(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Update received quantities for each item
      for (const receiveItem of receiveItems) {
        const item = items.find(i => i.id === receiveItem.itemId)
        if (!item) continue

        const newReceivedQty = item.received_quantity + receiveItem.receiveQuantity

        const { error: updateError } = await supabase
          .from('purchase_order_items')
          .update({
            received_quantity: newReceivedQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        if (updateError) throw updateError

        // Update inventory stock for the product at the location
        if (purchaseOrder.location_id) {
          // Check if inventory record exists
          const { data: existingInventory } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('product_id', item.product_id)
            .eq('location_id', purchaseOrder.location_id)
            .single()

          if (existingInventory) {
            // Update existing inventory
            const { error: invError } = await supabase
              .from('inventory')
              .update({
                quantity: existingInventory.quantity + receiveItem.receiveQuantity,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingInventory.id)

            if (invError) throw invError
          } else {
            // Create new inventory record
            const { error: invError } = await supabase
              .from('inventory')
              .insert({
                product_id: item.product_id,
                location_id: purchaseOrder.location_id,
                quantity: receiveItem.receiveQuantity,
                vendor_id: purchaseOrder.vendor_id,
              })

            if (invError) throw invError
          }
        }
      }

      // Calculate total received vs total ordered
      const allItemsFullyReceived = items.every((item) => {
        const receiveQty = parseFloat(receiveQuantities[item.id] || '0')
        return item.received_quantity + receiveQty >= item.quantity
      })

      // Update PO status
      const newStatus = allItemsFullyReceived ? 'received' : 'partially_received'
      const { error: statusError } = await supabase
        .from('purchase_orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseOrder.id)

      if (statusError) throw statusError

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onReceived()
      onClose()
    } catch (err) {
      logger.error('Failed to receive items', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to receive items')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalToReceive = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = parseFloat(receiveQuantities[item.id] || '0')
      return sum + (isNaN(qty) ? 0 : qty)
    }, 0)
  }, [items, receiveQuantities])

  const canSubmit = totalToReceive > 0 && !isSubmitting && !isLoading

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
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" pointerEvents="none" />
        <Pressable style={[styles.modalContainer, modalStyle]} onPress={(e) => e.stopPropagation()}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.modalContent, !isLiquidGlassSupported && styles.modalContentFallback]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Receive Items</Text>
                <Text style={styles.modalSubtitle}>{purchaseOrder.po_number}</Text>
              </View>
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
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.text.secondary} />
                  <Text style={styles.loadingText}>Loading items...</Text>
                </View>
              ) : (
                <>
                  {/* Quick Actions */}
                  <View style={styles.quickActions}>
                    <Pressable
                      style={styles.quickActionButton}
                      onPress={handleReceiveAll}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.quickActionText}>Receive All</Text>
                    </Pressable>
                    <Pressable
                      style={styles.quickActionButton}
                      onPress={handleClearAll}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.quickActionText}>Clear All</Text>
                    </Pressable>
                  </View>

                  {/* Items */}
                  <View style={styles.itemsSection}>
                    <Text style={styles.fieldLabel}>ITEMS TO RECEIVE</Text>
                    <View style={styles.itemsCard}>
                      {items.map((item, index) => {
                        const remaining = item.quantity - item.received_quantity
                        const isFullyReceived = remaining <= 0

                        return (
                          <View
                            key={item.id}
                            style={[
                              styles.itemRow,
                              index === items.length - 1 && styles.itemRowLast,
                              isFullyReceived && styles.itemRowDisabled,
                            ]}
                          >
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemName}>{item.product_name}</Text>
                              {item.product_sku && (
                                <Text style={styles.itemSku}>SKU: {item.product_sku}</Text>
                              )}
                              <View style={styles.itemMeta}>
                                <Text style={styles.itemMetaText}>
                                  Ordered: {item.quantity}
                                </Text>
                                <Text style={styles.itemMetaDot}>•</Text>
                                <Text style={styles.itemMetaText}>
                                  Received: {item.received_quantity}
                                </Text>
                                <Text style={styles.itemMetaDot}>•</Text>
                                <Text style={[styles.itemMetaText, remaining > 0 && styles.itemMetaHighlight]}>
                                  Remaining: {remaining}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.quantityInput}>
                              <Text style={styles.inputLabel}>Receive</Text>
                              <TextInput
                                style={[
                                  styles.input,
                                  isFullyReceived && styles.inputDisabled,
                                ]}
                                value={receiveQuantities[item.id] || '0'}
                                onChangeText={(value) => handleQuantityChange(item.id, value)}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor="rgba(235,235,245,0.3)"
                                editable={!isFullyReceived && !isSubmitting}
                                selectTextOnFocus
                              />
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  </View>

                  {/* Summary */}
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Items to Receive</Text>
                      <Text style={styles.summaryValue}>{totalToReceive}</Text>
                    </View>
                  </View>

                  {error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}
                </>
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
                style={[styles.button, styles.buttonPrimary, !canSubmit && styles.buttonDisabled]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Receive {totalToReceive} Items</Text>
                )}
              </Pressable>
            </View>
          </LiquidGlassView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    marginTop: 2,
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.1,
  },
  itemsSection: {
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
  itemsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemRowDisabled: {
    opacity: 0.5,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  itemSku: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: 0.2,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemMetaText: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },
  itemMetaDot: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.2)',
  },
  itemMetaHighlight: {
    color: '#0a84ff',
    fontWeight: '600',
  },
  quantityInput: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  input: {
    width: 80,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.sm,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: -0.3,
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
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34c759',
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
  buttonDisabled: {
    opacity: 0.5,
  },
})
