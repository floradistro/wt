/**
 * EditOrderModal Component
 *
 * Allows staff to edit/fix orders that were created incorrectly.
 *
 * Editable fields:
 * - Customer info (name, email, phone)
 * - Shipping address (for shipping orders)
 * - Order items (quantities, remove items)
 * - Discounts/adjustments
 * - Staff notes
 * - Payment status
 */

import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { FullScreenModal, modalStyles } from '@/components/shared'
import { useOrders, useOrdersActions } from '@/stores/orders.store'
import { useOrderItems, useOrderDetailActions } from '@/stores/order-detail.store'
import { supabase } from '@/lib/supabase/client'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'
import { colors, spacing, radius } from '@/theme/tokens'
import type { Order, OrderItem } from '@/services/orders.service'

interface EditOrderModalProps {
  visible: boolean
  onClose: () => void
  orderId: string | null
}

type EditTab = 'customer' | 'items' | 'fulfillment' | 'shipping' | 'payment'

export function EditOrderModal({ visible, onClose, orderId }: EditOrderModalProps) {
  const { user, locations } = useAppAuth()
  const orders = useOrders()
  const orderItems = useOrderItems()
  const { refreshOrders } = useOrdersActions()
  const { loadOrderDetails } = useOrderDetailActions()

  const order = orders.find(o => o.id === orderId)

  // Active tab
  const [activeTab, setActiveTab] = useState<EditTab>('customer')

  // Form state - Customer
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // Form state - Shipping Address
  const [shippingName, setShippingName] = useState('')
  const [shippingAddress1, setShippingAddress1] = useState('')
  const [shippingAddress2, setShippingAddress2] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingZip, setShippingZip] = useState('')
  const [shippingPhone, setShippingPhone] = useState('')

  // Form state - Items (map of item_id -> new quantity)
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({})
  const [itemsToRemove, setItemsToRemove] = useState<Set<string>>(new Set())

  // Form state - Fulfillment locations (map of item_id -> new location_id)
  const [itemLocations, setItemLocations] = useState<Record<string, string>>({})
  const [consolidateToLocation, setConsolidateToLocation] = useState<string | null>(null)

  // Form state - Payment/Pricing
  const [discountAmount, setDiscountAmount] = useState('')
  const [staffNotes, setStaffNotes] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed' | 'refunded'>('pending')

  // UI state
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form when modal opens
  useEffect(() => {
    if (!visible || !order) {
      return
    }

    // Load order details if not already loaded
    if (orderId) {
      loadOrderDetails(orderId)
    }

    // Customer info
    setCustomerName(order.customer_name || '')
    setCustomerEmail(order.customer_email || '')
    setCustomerPhone(order.customer_phone || '')

    // Shipping address
    setShippingName((order as any).shipping_name || '')
    setShippingAddress1(order.shipping_address_line1 || '')
    setShippingAddress2(order.shipping_address_line2 || '')
    setShippingCity(order.shipping_city || '')
    setShippingState(order.shipping_state || '')
    setShippingZip(order.shipping_zip || '')
    setShippingPhone((order as any).shipping_phone || '')

    // Payment
    setDiscountAmount(order.discount_amount?.toString() || '0')
    setStaffNotes(order.staff_notes || '')
    setPaymentStatus(order.payment_status as any || 'pending')

    // Reset item edits
    setItemQuantities({})
    setItemsToRemove(new Set())
    setItemLocations({})
    setConsolidateToLocation(null)
    setHasChanges(false)
    setActiveTab('customer')

  }, [visible, orderId, order])

  // Initialize item quantities when items load
  useEffect(() => {
    if (orderItems.length > 0 && Object.keys(itemQuantities).length === 0) {
      const quantities: Record<string, number> = {}
      orderItems.forEach(item => {
        quantities[item.id] = item.quantity
      })
      setItemQuantities(quantities)
    }
  }, [orderItems])

  // Track changes
  const checkForChanges = useCallback(() => {
    if (!order) return false

    const customerChanged =
      customerName !== (order.customer_name || '') ||
      customerEmail !== (order.customer_email || '') ||
      customerPhone !== (order.customer_phone || '')

    const shippingChanged =
      shippingAddress1 !== (order.shipping_address_line1 || '') ||
      shippingAddress2 !== (order.shipping_address_line2 || '') ||
      shippingCity !== (order.shipping_city || '') ||
      shippingState !== (order.shipping_state || '') ||
      shippingZip !== (order.shipping_zip || '')

    const paymentChanged =
      discountAmount !== (order.discount_amount?.toString() || '0') ||
      staffNotes !== (order.staff_notes || '') ||
      paymentStatus !== (order.payment_status || 'pending')

    const itemsChanged =
      itemsToRemove.size > 0 ||
      orderItems.some(item => itemQuantities[item.id] !== item.quantity)

    const locationsChanged =
      consolidateToLocation !== null ||
      orderItems.some(item => itemLocations[item.id] && itemLocations[item.id] !== item.location_id)

    return customerChanged || shippingChanged || paymentChanged || itemsChanged || locationsChanged
  }, [order, customerName, customerEmail, customerPhone, shippingAddress1, shippingAddress2,
      shippingCity, shippingState, shippingZip, discountAmount, staffNotes, paymentStatus,
      itemQuantities, itemsToRemove, orderItems, itemLocations, consolidateToLocation])

  useEffect(() => {
    setHasChanges(checkForChanges())
  }, [checkForChanges])

  // Handle item quantity change
  const handleQuantityChange = (itemId: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setItemQuantities(prev => {
      const current = prev[itemId] || 1
      const newQty = Math.max(0, current + delta)
      if (newQty === 0) {
        // Mark for removal instead of setting to 0
        setItemsToRemove(prev => new Set([...prev, itemId]))
        return { ...prev, [itemId]: 0 }
      }
      // If previously marked for removal, unmark it
      setItemsToRemove(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
      return { ...prev, [itemId]: newQty }
    })
  }

  // Handle removing item
  const handleRemoveItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setItemsToRemove(prev => new Set([...prev, itemId]))
    setItemQuantities(prev => ({ ...prev, [itemId]: 0 }))
  }

  // Restore removed item
  const handleRestoreItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const originalItem = orderItems.find(i => i.id === itemId)
    setItemsToRemove(prev => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: originalItem?.quantity || 1
    }))
  }

  // Calculate new totals
  const calculateNewTotals = useCallback(() => {
    let newSubtotal = 0

    orderItems.forEach(item => {
      if (itemsToRemove.has(item.id)) return
      const qty = itemQuantities[item.id] ?? item.quantity
      newSubtotal += item.unit_price * qty
    })

    const discount = parseFloat(discountAmount) || 0
    // Keep original tax rate
    const taxRate = order?.subtotal && order.subtotal > 0
      ? (order.tax_amount || 0) / order.subtotal
      : 0
    const newTax = newSubtotal * taxRate
    const newTotal = newSubtotal - discount + newTax

    return {
      subtotal: newSubtotal,
      tax: newTax,
      discount,
      total: newTotal,
    }
  }, [orderItems, itemQuantities, itemsToRemove, discountAmount, order])

  // Save changes
  const handleSave = async () => {
    if (!order || !orderId) return

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      logger.info('[EditOrder] Step 1: Starting save')

      const newTotals = calculateNewTotals()
      logger.info('[EditOrder] Step 2: Calculated totals', newTotals)

      // Build update object for order - ONLY columns that exist on the orders table
      // NOTE: customer_name, customer_email, customer_phone are ALL in the customers table, not orders
      const orderUpdate: Record<string, any> = {
        staff_notes: staffNotes.trim() || null,
        discount_amount: newTotals.discount,
        subtotal: newTotals.subtotal,
        tax_amount: newTotals.tax,
        total_amount: newTotals.total,
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      }

      // Customer info is in the customers table - update there if changed
      const customerId = (order as any).customer_id
      const customerChanged =
        customerName.trim() !== (order.customer_name || '') ||
        customerEmail.trim() !== (order.customer_email || '') ||
        customerPhone.trim() !== (order.customer_phone || '')

      if (customerChanged && customerId) {
        logger.info('[EditOrder] Step 2b: Updating customer info in customers table')
        // Parse customer name into first/last
        const nameParts = customerName.trim().split(' ')
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        const { error: customerError } = await supabase
          .from('customers')
          .update({
            first_name: firstName || null,
            last_name: lastName || null,
            email: customerEmail.trim() || null,
            phone: customerPhone.trim() || null,
          })
          .eq('id', customerId)

        if (customerError) {
          logger.warn('[EditOrder] Failed to update customer info:', customerError)
        } else {
          logger.info('[EditOrder] Customer info updated successfully')
        }
      }

      // Add shipping fields if shipping order (these DO exist on orders table)
      if (order.order_type === 'shipping') {
        orderUpdate.shipping_name = shippingName.trim() || null
        orderUpdate.shipping_address_line1 = shippingAddress1.trim() || null
        orderUpdate.shipping_address_line2 = shippingAddress2.trim() || null
        orderUpdate.shipping_city = shippingCity.trim() || null
        orderUpdate.shipping_state = shippingState.trim() || null
        orderUpdate.shipping_zip = shippingZip.trim() || null
        orderUpdate.shipping_phone = shippingPhone.trim() || null
      }

      // Update order
      logger.info('[EditOrder] Step 3: Updating order with:', JSON.stringify(orderUpdate))
      const { error: orderError } = await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', orderId)

      if (orderError) {
        logger.error('[EditOrder] Order update failed:', JSON.stringify(orderError))
        throw new Error(`Order update failed: ${orderError.message || JSON.stringify(orderError)}`)
      }
      logger.info('[EditOrder] Step 4: Order updated successfully')

      // Update item quantities (only if items were modified)
      const hasItemChanges = itemsToRemove.size > 0 || orderItems.some(i => itemQuantities[i.id] !== i.quantity)
      if (hasItemChanges) {
        logger.info('[EditOrder] Step 5: Updating items')
        for (const item of orderItems) {
          const newQty = itemQuantities[item.id]

          if (itemsToRemove.has(item.id)) {
            const { error: deleteError } = await supabase
              .from('order_items')
              .delete()
              .eq('id', item.id)

            if (deleteError) {
              logger.warn('[EditOrder] Failed to delete item:', deleteError)
            }
          } else if (newQty !== item.quantity) {
            const newLineTotal = newQty * item.unit_price
            const orderTaxRate = order.subtotal > 0 ? (order.tax_amount || 0) / order.subtotal : 0
            const newItemTax = newLineTotal * orderTaxRate

            const { error: itemError } = await supabase
              .from('order_items')
              .update({
                quantity: newQty,
                line_total: newLineTotal + newItemTax,
              })
              .eq('id', item.id)

            if (itemError) {
              logger.warn('[EditOrder] Failed to update item quantity:', itemError)
            }
          }
        }
        logger.info('[EditOrder] Step 5: Items updated')
      } else {
        logger.info('[EditOrder] Step 5: No item changes')
      }

      // Update item fulfillment locations
      const hasLocationChanges = Object.keys(itemLocations).length > 0
      if (hasLocationChanges) {
        logger.info('[EditOrder] Step 5b: Updating item locations')
        for (const item of orderItems) {
          const newLocationId = itemLocations[item.id]
          if (newLocationId && newLocationId !== item.location_id) {
            const { error: locError } = await supabase
              .from('order_items')
              .update({ location_id: newLocationId })
              .eq('id', item.id)

            if (locError) {
              logger.warn('[EditOrder] Failed to update item location:', locError)
            }
          }
        }

        // Recalculate order_locations table
        // First, get all unique locations from updated items
        const locationCounts: Record<string, { count: number; qty: number }> = {}
        for (const item of orderItems) {
          if (itemsToRemove.has(item.id)) continue
          const locId = itemLocations[item.id] || item.location_id
          if (locId) {
            if (!locationCounts[locId]) {
              locationCounts[locId] = { count: 0, qty: 0 }
            }
            locationCounts[locId].count += 1
            locationCounts[locId].qty += (itemQuantities[item.id] ?? item.quantity)
          }
        }

        // Delete old order_locations entries
        await supabase
          .from('order_locations')
          .delete()
          .eq('order_id', orderId)

        // Create new order_locations entries
        for (const [locId, data] of Object.entries(locationCounts)) {
          await supabase
            .from('order_locations')
            .insert({
              order_id: orderId,
              location_id: locId,
              item_count: data.count,
              total_quantity: data.qty,
              fulfillment_status: 'unfulfilled',
            })
        }
        logger.info('[EditOrder] Step 5b: Item locations updated')
      }

      // Skip state_log update for now - column may not exist
      logger.info('[EditOrder] Step 6: Skipping state_log (may not exist)')

      logger.info('[EditOrder] Step 7: Success! Refreshing data')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Refresh data
      await refreshOrders()
      if (orderId) {
        loadOrderDetails(orderId)
      }

      logger.info('[EditOrder] Step 8: Done, closing modal')
      onClose()

    } catch (error: any) {
      const errorMessage = error?.message || JSON.stringify(error) || 'Unknown error'
      logger.error('Failed to save order changes:', errorMessage)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', `Failed to save changes: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  // Handle close with unsaved changes
  const handleClose = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose }
        ]
      )
    } else {
      onClose()
    }
  }

  const newTotals = calculateNewTotals()
  const isShippingOrder = order?.order_type === 'shipping'

  // Tab button component
  const TabButton = ({ tab, label, icon }: { tab: EditTab; label: string; icon: string }) => (
    <Pressable
      style={[
        styles.tabButton,
        activeTab === tab && styles.tabButtonActive
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        setActiveTab(tab)
      }}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={activeTab === tab ? '#fff' : 'rgba(255,255,255,0.5)'}
      />
      <Text style={[
        styles.tabButtonText,
        activeTab === tab && styles.tabButtonTextActive
      ]}>
        {label}
      </Text>
    </Pressable>
  )

  if (!order) {
    return null
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      searchValue=""
      onSearchChange={() => {}}
      searchPlaceholder={`Edit Order #${order.order_number}`}
    >
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TabButton tab="customer" label="Customer" icon="person-outline" />
        <TabButton tab="items" label="Items" icon="cart-outline" />
        <TabButton tab="fulfillment" label="Location" icon="business-outline" />
        {isShippingOrder && (
          <TabButton tab="shipping" label="Address" icon="location-outline" />
        )}
        <TabButton tab="payment" label="Payment" icon="card-outline" />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Tab */}
        {activeTab === 'customer' && (
          <View style={styles.tabContent}>
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>CUSTOMER NAME</Text>
              <TextInput
                style={[modalStyles.card, modalStyles.input]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Customer name..."
                placeholderTextColor="rgba(235,235,245,0.3)"
                autoCapitalize="words"
              />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>EMAIL</Text>
              <TextInput
                style={[modalStyles.card, modalStyles.input]}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                placeholder="customer@email.com"
                placeholderTextColor="rgba(235,235,245,0.3)"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>PHONE</Text>
              <TextInput
                style={[modalStyles.card, modalStyles.input]}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="(555) 555-5555"
                placeholderTextColor="rgba(235,235,245,0.3)"
                keyboardType="phone-pad"
              />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>STAFF NOTES</Text>
              <TextInput
                style={[modalStyles.card, modalStyles.input, { minHeight: 100, textAlignVertical: 'top' }]}
                value={staffNotes}
                onChangeText={setStaffNotes}
                placeholder="Internal notes about this order..."
                placeholderTextColor="rgba(235,235,245,0.3)"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        )}

        {/* Items Tab */}
        {activeTab === 'items' && (
          <View style={styles.tabContent}>
            <Text style={styles.itemsHelp}>
              Adjust quantities or remove items. Changes will recalculate totals.
            </Text>

            {orderItems.length === 0 ? (
              <View style={styles.emptyItems}>
                <ActivityIndicator color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyItemsText}>Loading items...</Text>
              </View>
            ) : (
              orderItems.map((item) => {
                const isRemoved = itemsToRemove.has(item.id)
                const currentQty = itemQuantities[item.id] ?? item.quantity
                const lineTotal = item.unit_price * currentQty

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.itemRow,
                      isRemoved && styles.itemRowRemoved
                    ]}
                  >
                    <View style={styles.itemInfo}>
                      <Text
                        style={[
                          styles.itemName,
                          isRemoved && styles.itemNameRemoved
                        ]}
                        numberOfLines={2}
                      >
                        {item.product_name}
                      </Text>
                      <Text style={styles.itemPrice}>
                        ${item.unit_price.toFixed(2)} each
                        {!isRemoved && currentQty !== item.quantity && (
                          <Text style={styles.itemOriginalQty}>
                            {' '}(was {item.quantity})
                          </Text>
                        )}
                      </Text>
                    </View>

                    {isRemoved ? (
                      <Pressable
                        style={styles.restoreButton}
                        onPress={() => handleRestoreItem(item.id)}
                      >
                        <Ionicons name="arrow-undo" size={18} color="#0a84ff" />
                        <Text style={styles.restoreButtonText}>Restore</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.itemActions}>
                        <View style={styles.quantityControls}>
                          <Pressable
                            style={styles.qtyButton}
                            onPress={() => handleQuantityChange(item.id, -1)}
                          >
                            <Ionicons name="remove" size={20} color="#fff" />
                          </Pressable>
                          <Text style={styles.qtyText}>{currentQty}</Text>
                          <Pressable
                            style={styles.qtyButton}
                            onPress={() => handleQuantityChange(item.id, 1)}
                          >
                            <Ionicons name="add" size={20} color="#fff" />
                          </Pressable>
                        </View>

                        <Text style={styles.itemTotal}>
                          ${lineTotal.toFixed(2)}
                        </Text>

                        <Pressable
                          style={styles.removeButton}
                          onPress={() => handleRemoveItem(item.id)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                )
              })
            )}

            {/* Totals Summary */}
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>${newTotals.subtotal.toFixed(2)}</Text>
              </View>
              {newTotals.discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#34c759' }]}>Discount</Text>
                  <Text style={[styles.totalValue, { color: '#34c759' }]}>
                    -${newTotals.discount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>${newTotals.tax.toFixed(2)}</Text>
              </View>
              <View style={[styles.totalRow, styles.totalRowFinal]}>
                <Text style={styles.totalLabelFinal}>New Total</Text>
                <Text style={styles.totalValueFinal}>${newTotals.total.toFixed(2)}</Text>
              </View>
              {order.total_amount !== newTotals.total && (
                <Text style={styles.totalChange}>
                  {newTotals.total > order.total_amount ? '+' : ''}
                  ${(newTotals.total - order.total_amount).toFixed(2)} from original
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Fulfillment Location Tab */}
        {activeTab === 'fulfillment' && (
          <View style={styles.tabContent}>
            <Text style={styles.itemsHelp}>
              Change which location fulfills items. For shipping orders, consolidating to one location reduces shipping costs.
            </Text>

            {/* Consolidate All Button */}
            {orderItems.length > 0 && locations.length > 0 && (
              <View style={modalStyles.section}>
                <Text style={modalStyles.sectionLabel}>CONSOLIDATE ALL ITEMS TO ONE LOCATION</Text>
                <View style={styles.locationButtons}>
                  {locations.map((loc) => {
                    const isSelected = consolidateToLocation === loc.id
                    return (
                      <Pressable
                        key={loc.id}
                        style={[
                          styles.locationButton,
                          isSelected && styles.locationButtonSelected
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                          if (isSelected) {
                            setConsolidateToLocation(null)
                            setItemLocations({})
                          } else {
                            setConsolidateToLocation(loc.id)
                            // Set all items to this location
                            const newLocations: Record<string, string> = {}
                            orderItems.forEach(item => {
                              newLocations[item.id] = loc.id
                            })
                            setItemLocations(newLocations)
                          }
                        }}
                      >
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'business-outline'}
                          size={20}
                          color={isSelected ? '#34c759' : 'rgba(255,255,255,0.6)'}
                        />
                        <Text style={[
                          styles.locationButtonText,
                          isSelected && styles.locationButtonTextSelected
                        ]}>
                          {loc.name}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Per-Item Location Override */}
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>ITEM FULFILLMENT LOCATIONS</Text>
              {orderItems.length === 0 ? (
                <View style={styles.emptyItems}>
                  <ActivityIndicator color="rgba(255,255,255,0.5)" />
                  <Text style={styles.emptyItemsText}>Loading items...</Text>
                </View>
              ) : (
                orderItems.map((item) => {
                  const currentLocationId = itemLocations[item.id] || item.location_id
                  const currentLocation = locations.find(l => l.id === currentLocationId)
                  const originalLocation = locations.find(l => l.id === item.location_id)
                  const hasChanged = itemLocations[item.id] && itemLocations[item.id] !== item.location_id

                  return (
                    <View key={item.id} style={styles.itemLocationRow}>
                      <View style={styles.itemLocationInfo}>
                        <Text style={styles.itemLocationName} numberOfLines={1}>
                          {item.product_name}
                        </Text>
                        <Text style={styles.itemLocationCurrent}>
                          {currentLocation?.name || 'Unassigned'}
                          {hasChanged && originalLocation && (
                            <Text style={styles.itemLocationOriginal}>
                              {' '}(was {originalLocation.name})
                            </Text>
                          )}
                        </Text>
                      </View>
                      <View style={styles.itemLocationPicker}>
                        {locations.map((loc) => {
                          const isSelected = currentLocationId === loc.id
                          return (
                            <Pressable
                              key={loc.id}
                              style={[
                                styles.locationChip,
                                isSelected && styles.locationChipSelected
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                setConsolidateToLocation(null) // Clear consolidate mode
                                setItemLocations(prev => ({
                                  ...prev,
                                  [item.id]: loc.id
                                }))
                              }}
                            >
                              <Text style={[
                                styles.locationChipText,
                                isSelected && styles.locationChipTextSelected
                              ]}>
                                {loc.name.substring(0, 8)}
                              </Text>
                            </Pressable>
                          )
                        })}
                      </View>
                    </View>
                  )
                })
              )}
            </View>
          </View>
        )}

        {/* Shipping Address Tab */}
        {activeTab === 'shipping' && isShippingOrder && (
          <View style={styles.tabContent}>
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>RECIPIENT NAME</Text>
              <TextInput
                style={[modalStyles.card, modalStyles.input]}
                value={shippingName}
                onChangeText={setShippingName}
                placeholder="Recipient name..."
                placeholderTextColor="rgba(235,235,245,0.3)"
                autoCapitalize="words"
              />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>ADDRESS LINE 1</Text>
              <TextInput
                style={[modalStyles.card, modalStyles.input]}
                value={shippingAddress1}
                onChangeText={setShippingAddress1}
                placeholder="Street address..."
                placeholderTextColor="rgba(235,235,245,0.3)"
              />
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>ADDRESS LINE 2</Text>
              <TextInput
                style={[modalStyles.card, modalStyles.input]}
                value={shippingAddress2}
                onChangeText={setShippingAddress2}
                placeholder="Apt, suite, unit, etc. (optional)"
                placeholderTextColor="rgba(235,235,245,0.3)"
              />
            </View>

            <View style={styles.addressRow}>
              <View style={[modalStyles.section, { flex: 2 }]}>
                <Text style={modalStyles.sectionLabel}>CITY</Text>
                <TextInput
                  style={[modalStyles.card, modalStyles.input]}
                  value={shippingCity}
                  onChangeText={setShippingCity}
                  placeholder="City"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                />
              </View>
              <View style={[modalStyles.section, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={modalStyles.sectionLabel}>STATE</Text>
                <TextInput
                  style={[modalStyles.card, modalStyles.input]}
                  value={shippingState}
                  onChangeText={setShippingState}
                  placeholder="ST"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.addressRow}>
              <View style={[modalStyles.section, { flex: 1 }]}>
                <Text style={modalStyles.sectionLabel}>ZIP CODE</Text>
                <TextInput
                  style={[modalStyles.card, modalStyles.input]}
                  value={shippingZip}
                  onChangeText={setShippingZip}
                  placeholder="12345"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
              <View style={[modalStyles.section, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={modalStyles.sectionLabel}>PHONE</Text>
                <TextInput
                  style={[modalStyles.card, modalStyles.input]}
                  value={shippingPhone}
                  onChangeText={setShippingPhone}
                  placeholder="(555) 555-5555"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          <View style={styles.tabContent}>
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>PAYMENT STATUS</Text>
              <View style={styles.paymentStatusOptions}>
                {(['pending', 'paid', 'failed', 'refunded'] as const).map((status) => (
                  <Pressable
                    key={status}
                    style={[
                      styles.paymentStatusOption,
                      paymentStatus === status && styles.paymentStatusOptionActive,
                      paymentStatus === status && status === 'paid' && { backgroundColor: 'rgba(52,199,89,0.3)', borderColor: '#34c759' },
                      paymentStatus === status && status === 'failed' && { backgroundColor: 'rgba(255,59,48,0.3)', borderColor: '#ff3b30' },
                      paymentStatus === status && status === 'refunded' && { backgroundColor: 'rgba(255,149,0,0.3)', borderColor: '#ff9500' },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setPaymentStatus(status)
                    }}
                  >
                    <Text style={[
                      styles.paymentStatusText,
                      paymentStatus === status && styles.paymentStatusTextActive,
                      paymentStatus === status && status === 'paid' && { color: '#34c759' },
                      paymentStatus === status && status === 'failed' && { color: '#ff3b30' },
                      paymentStatus === status && status === 'refunded' && { color: '#ff9500' },
                    ]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionLabel}>DISCOUNT AMOUNT</Text>
              <View style={styles.discountInput}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={[modalStyles.card, modalStyles.input, { flex: 1, paddingLeft: 30 }]}
                  value={discountAmount}
                  onChangeText={setDiscountAmount}
                  placeholder="0.00"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.paymentInfo}>
              <Text style={styles.paymentInfoLabel}>Original Total</Text>
              <Text style={styles.paymentInfoValue}>${order.total_amount.toFixed(2)}</Text>
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentInfoLabel}>New Total</Text>
              <Text style={[styles.paymentInfoValue, { color: '#fff', fontWeight: '700' }]}>
                ${newTotals.total.toFixed(2)}
              </Text>
            </View>
            {order.total_amount !== newTotals.total && (
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentInfoLabel}>Difference</Text>
                <Text style={[
                  styles.paymentInfoValue,
                  { color: newTotals.total > order.total_amount ? '#ff3b30' : '#34c759' }
                ]}>
                  {newTotals.total > order.total_amount ? '+' : ''}
                  ${(newTotals.total - order.total_amount).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Pressable
          style={[
            modalStyles.button,
            (!hasChanges || saving) && modalStyles.buttonDisabled
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={modalStyles.buttonText}>
              {hasChanges ? 'SAVE CHANGES' : 'NO CHANGES'}
            </Text>
          )}
        </Pressable>
      </View>
    </FullScreenModal>
  )
}

import { StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(10,132,255,0.3)',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  tabContent: {
    padding: spacing.md,
  },
  itemsHelp: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyItems: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyItemsText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  itemRowRemoved: {
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  itemNameRemoved: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.5)',
  },
  itemPrice: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  itemOriginalQty: {
    color: '#ff9500',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.round,
    padding: 4,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    minWidth: 32,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    minWidth: 60,
    textAlign: 'right',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,59,48,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.round,
    backgroundColor: 'rgba(10,132,255,0.2)',
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a84ff',
  },
  totalsCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  totalValue: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  totalLabelFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  totalValueFinal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  totalChange: {
    fontSize: 12,
    color: '#ff9500',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
  },
  paymentStatusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paymentStatusOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  paymentStatusOptionActive: {
    backgroundColor: 'rgba(10,132,255,0.2)',
    borderColor: '#0a84ff',
  },
  paymentStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  paymentStatusTextActive: {
    color: '#0a84ff',
  },
  discountInput: {
    position: 'relative',
  },
  currencySymbol: {
    position: 'absolute',
    left: 16,
    top: 16,
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    zIndex: 1,
  },
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  paymentInfoLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  paymentInfoValue: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  // Location editing styles
  locationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  locationButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationButtonSelected: {
    backgroundColor: 'rgba(52,199,89,0.15)',
    borderColor: '#34c759',
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  locationButtonTextSelected: {
    color: '#34c759',
  },
  itemLocationRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemLocationInfo: {
    marginBottom: spacing.sm,
  },
  itemLocationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  itemLocationCurrent: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  itemLocationOriginal: {
    color: '#ff9500',
  },
  itemLocationPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  locationChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.round,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  locationChipSelected: {
    backgroundColor: 'rgba(10,132,255,0.3)',
  },
  locationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  locationChipTextSelected: {
    color: '#0a84ff',
  },
})
