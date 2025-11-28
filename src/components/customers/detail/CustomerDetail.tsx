/**
 * CustomerDetail Component
 * Detail panel for viewing and editing customer information
 *
 * ZERO PROP DRILLING ARCHITECTURE:
 * - Reads customer from customers-ui.store
 * - Reads UI state from customers-ui.store
 * - Calls store actions directly (no callbacks)
 */

import React, { useState, useEffect, memo } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import type { Customer, CustomerWithOrders } from '@/services/customers.service'
import { customersService } from '@/services/customers.service'
import { logger } from '@/utils/logger'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { customersStyles as styles } from '../customers.styles'
import {
  useSelectedCustomerUI,
  useIsEditMode,
  useActiveModal,
  customersUIActions,
} from '@/stores/customers-ui.store'
import {
  customersListActions,
} from '@/stores/customers-list.store'

// ✅ ZERO PROPS!
export const CustomerDetail = memo(() => {
  // ✅ Read from stores
  const customer = useSelectedCustomerUI()
  const isEditing = useIsEditMode()
  const showLoyaltyModal = useActiveModal() === 'loyalty'

  // Local edit state (temporary form data)
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>(customer || {})
  const [isSaving, setIsSaving] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [customerWithOrders, setCustomerWithOrders] = useState<CustomerWithOrders | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)

  // ✅ Sync editedCustomer when customer changes from store
  useEffect(() => {
    if (customer) {
      setEditedCustomer(customer)
    }
  }, [customer])

  // ✅ Load customer with orders when selected
  useEffect(() => {
    if (!customer?.id) return

    const loadOrders = async () => {
      try {
        setLoadingOrders(true)
        const data = await customersService.getCustomerWithOrders(customer.id)
        setCustomerWithOrders(data)
      } catch (err) {
        logger.error('Failed to load customer orders:', err)
      } finally {
        setLoadingOrders(false)
      }
    }

    loadOrders()
  }, [customer?.id])

  // Guard: No customer selected
  if (!customer) {
    return null
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      // ✅ Use store action
      const updated = await customersListActions.updateCustomer(customer.id, editedCustomer)
      // ✅ Update UI state
      customersUIActions.setEditMode(false)
      customersUIActions.selectCustomer(updated) // Update with fresh data
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (err) {
      logger.error('Failed to update customer:', err)
      Alert.alert('Error', 'Failed to update customer')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedCustomer(customer)
    customersUIActions.setEditMode(false)
  }

  const handleLoyaltyAdjustment = (adjustment: number) => {
    Alert.alert(
      adjustment > 0 ? 'Add Loyalty Points' : 'Remove Loyalty Points',
      `${adjustment > 0 ? 'Add' : 'Remove'} ${Math.abs(adjustment)} points ${adjustment > 0 ? 'to' : 'from'} ${customer.full_name || 'this customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              // ✅ Use store action
              await customersListActions.updateLoyaltyPoints(customer.id, adjustment)
              // ✅ Update selected customer with new points
              const updated = { ...customer, loyalty_points: customer.loyalty_points + adjustment }
              customersUIActions.selectCustomer(updated as Customer)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              customersUIActions.closeLoyaltyModal()
              setCustomAmount('')
            } catch (err) {
              logger.error('Failed to update loyalty points:', err)
              Alert.alert('Error', 'Failed to update loyalty points')
            }
          }
        }
      ]
    )
  }

  const handleCustomAmountSubmit = () => {
    const amount = parseInt(customAmount, 10)
    if (isNaN(amount) || amount === 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid number')
      return
    }
    handleLoyaltyAdjustment(amount)
  }

  const formattedPhone = customer.phone
    ? customer.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
    : 'Not provided'

  const memberSince = new Date(customer.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <View style={styles.detailContainer}>
      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: layout.dockHeight }}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
      >
        {/* Title Card - Matches OrderDetail Pattern */}
        <View style={styles.headerCardContainer}>
          <View style={styles.headerCardGlass}>
            <View style={styles.headerCard}>
              {/* Back Button */}
              <Pressable
                style={styles.backButton}
                onPress={() => customersUIActions.clearSelection()}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
              </Pressable>

              {/* Customer Avatar */}
              <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                <Text style={styles.headerIconText}>
                  {(customer.first_name || customer.full_name || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Customer Info + KPIs */}
              <View style={styles.headerInfo}>
                <Text style={styles.headerTitle}>
                  {customer.full_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Anonymous Customer'}
                </Text>
                <View style={styles.headerKPIs}>
                  <View style={styles.kpiItem}>
                    <Text style={styles.kpiValue}>${(customer.total_spent || 0).toFixed(2)}</Text>
                    <Text style={styles.kpiLabel}>Spent</Text>
                  </View>
                  <Text style={styles.kpiDivider}>•</Text>
                  <View style={styles.kpiItem}>
                    <Text style={styles.kpiValue}>{customer.total_orders || 0}</Text>
                    <Text style={styles.kpiLabel}>Orders</Text>
                  </View>
                  <Text style={styles.kpiDivider}>•</Text>
                  <Pressable
                    style={styles.kpiItem}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      customersUIActions.openLoyaltyModal()
                    }}
                  >
                    <Text style={[styles.kpiValue, styles.kpiValueLoyalty]}>
                      {customer.loyalty_points || 0}
                    </Text>
                    <Text style={styles.kpiLabel}>Points</Text>
                  </Pressable>
                </View>
              </View>

              {/* Right Actions */}
              <View style={styles.headerActions}>
                {isEditing ? (
                  <>
                    <Pressable
                      style={styles.iconButton}
                      onPress={handleCancel}
                      disabled={isSaving}
                    >
                      <Ionicons name="close" size={20} color={colors.text.primary} />
                    </Pressable>
                    <Pressable
                      style={[styles.statusButton, styles.saveButton]}
                      onPress={handleSave}
                      disabled={isSaving}
                    >
                      <Text style={styles.statusButtonText}>
                        {isSaving ? 'Saving...' : 'Save'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => customersUIActions.setEditMode(true)}
                    >
                      <Ionicons name="create-outline" size={20} color={colors.text.primary} />
                    </Pressable>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => {
                        Alert.alert(
                          'Delete Customer',
                          `Are you sure you want to delete ${customer.full_name || 'this customer'}? This action cannot be undone.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await customersListActions.deleteCustomer(customer.id)
                                  customersUIActions.clearSelection()
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                                  logger.info('Customer deleted successfully:', customer.id)
                                } catch (err) {
                                  logger.error('Failed to delete customer:', err)
                                  Alert.alert('Error', 'Failed to delete customer. Please try again.')
                                }
                              },
                            },
                          ]
                        )
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.semantic.error} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Edit Name Section - Only in edit mode */}
        {isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EDIT NAME</Text>
            <View style={styles.cardGlass}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>First Name</Text>
                <TextInput
                  style={styles.infoInput}
                  value={editedCustomer.first_name || ''}
                  onChangeText={(text) =>
                    setEditedCustomer({ ...editedCustomer, first_name: text })
                  }
                  placeholder="First Name"
                  placeholderTextColor={colors.text.placeholder}
                />
              </View>
              <View style={[styles.infoRow, styles.lastRow]}>
                <Text style={styles.infoLabel}>Last Name</Text>
                <TextInput
                  style={styles.infoInput}
                  value={editedCustomer.last_name || ''}
                  onChangeText={(text) =>
                    setEditedCustomer({ ...editedCustomer, last_name: text })
                  }
                  placeholder="Last Name"
                  placeholderTextColor={colors.text.placeholder}
                />
              </View>
            </View>
          </View>
        )}

        {/* Loyalty Points Adjustment Modal */}
        {showLoyaltyModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.loyaltyModal}>
              <Text style={styles.loyaltyModalTitle}>Adjust Loyalty Points</Text>
              <Text style={styles.loyaltyModalSubtitle}>
                Current: {customer.loyalty_points || 0} points
              </Text>

              <View style={styles.loyaltyButtons}>
                {/* Quick Adjust Buttons */}
                <View style={styles.loyaltyButtonRow}>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonNegative]}
                    onPress={() => handleLoyaltyAdjustment(-100)}
                  >
                    <Text style={styles.loyaltyButtonText}>-100</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonNegative]}
                    onPress={() => handleLoyaltyAdjustment(-50)}
                  >
                    <Text style={styles.loyaltyButtonText}>-50</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonNegative]}
                    onPress={() => handleLoyaltyAdjustment(-10)}
                  >
                    <Text style={styles.loyaltyButtonText}>-10</Text>
                  </Pressable>
                </View>

                <View style={styles.loyaltyButtonRow}>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonPositive]}
                    onPress={() => handleLoyaltyAdjustment(10)}
                  >
                    <Text style={styles.loyaltyButtonText}>+10</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonPositive]}
                    onPress={() => handleLoyaltyAdjustment(50)}
                  >
                    <Text style={styles.loyaltyButtonText}>+50</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonPositive]}
                    onPress={() => handleLoyaltyAdjustment(100)}
                  >
                    <Text style={styles.loyaltyButtonText}>+100</Text>
                  </Pressable>
                </View>
              </View>

              {/* Custom Amount Input */}
              <View style={styles.customAmountSection}>
                <Text style={styles.customAmountLabel}>Or enter custom amount:</Text>
                <View style={styles.customAmountInputRow}>
                  <TextInput
                    style={styles.customAmountInput}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholder="Enter amount (+/-)"
                    placeholderTextColor={colors.text.placeholder}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={handleCustomAmountSubmit}
                  />
                  <Pressable
                    style={styles.customAmountButton}
                    onPress={handleCustomAmountSubmit}
                  >
                    <Text style={styles.customAmountButtonText}>Apply</Text>
                  </Pressable>
                </View>
                <Text style={styles.customAmountHint}>
                  Use + for adding points or - for removing (e.g., +250 or -75)
                </Text>
              </View>

              <Pressable
                style={styles.loyaltyCloseButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  customersUIActions.closeLoyaltyModal()
                }}
              >
                <Text style={styles.loyaltyCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.cardGlass}>
            {/* Email */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              {isEditing ? (
                <TextInput
                  style={styles.infoInput}
                  value={editedCustomer.email || ''}
                  onChangeText={(text) =>
                    setEditedCustomer({ ...editedCustomer, email: text })
                  }
                  placeholder="email@example.com"
                  placeholderTextColor={colors.text.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.infoValue}>{customer.email || 'Not provided'}</Text>
              )}
            </View>

            {/* Phone */}
            <View style={[styles.infoRow, styles.lastRow]}>
              <Text style={styles.infoLabel}>Phone</Text>
              {isEditing ? (
                <TextInput
                  style={styles.infoInput}
                  value={editedCustomer.phone || ''}
                  onChangeText={(text) =>
                    setEditedCustomer({ ...editedCustomer, phone: text })
                  }
                  placeholder="(555) 555-5555"
                  placeholderTextColor={colors.text.placeholder}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.infoValue}>{formattedPhone}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.cardGlass}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>{memberSince}</Text>
            </View>

            <View style={[styles.infoRow, styles.lastRow]}>
              <Text style={styles.infoLabel}>Customer ID</Text>
              <Text style={styles.infoValue}>{customer.id.slice(0, 8)}...</Text>
            </View>
          </View>
        </View>

        {/* Recent Orders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <View style={styles.cardGlass}>
            {loadingOrders ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={colors.text.secondary} />
              </View>
            ) : customerWithOrders?.recent_orders && customerWithOrders.recent_orders.length > 0 ? (
              <>
                {customerWithOrders.recent_orders.map((order, index) => (
                  <Pressable
                    key={order.id}
                    style={[
                      styles.infoRow,
                      index === customerWithOrders.recent_orders!.length - 1 && styles.lastRow
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      // TODO: Navigate to order detail
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>
                        {order.pickup_location?.name || 'Unknown Location'}
                      </Text>
                      <Text style={[styles.infoValue, { fontSize: 13, marginTop: 2 }]}>
                        {order.order_number}
                      </Text>
                      {order.created_by_user && (
                        <Text style={[styles.infoValue, { fontSize: 12, marginTop: 2 }]}>
                          by {order.created_by_user.first_name} {order.created_by_user.last_name}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.infoLabel}>
                        ${order.total_amount.toFixed(2)}
                      </Text>
                      <Text style={[styles.infoValue, { fontSize: 13, marginTop: 2 }]}>
                        {new Date(order.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            ) : (
              <View style={[styles.infoRow, styles.lastRow]}>
                <Text style={styles.infoValue}>No orders yet</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
})

CustomerDetail.displayName = 'CustomerDetail'
