/**
 * CustomerDetail Component
 * Detail panel for viewing and editing customer information
 */

import React, { useState, memo } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { Customer } from '@/hooks/useCustomers'
import { customersService } from '@/services/customers.service'
import { logger } from '@/utils/logger'
import { colors } from '@/theme/tokens'
import { customersStyles as styles } from '../customers.styles'

export interface CustomerDetailProps {
  customer: Customer
  onClose: () => void
  onDelete: () => void
  onUpdate: (customer: Customer) => void
}

export const CustomerDetail = memo<CustomerDetailProps>(({ customer, onClose, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>(customer)
  const [isSaving, setIsSaving] = useState(false)
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const updated = await customersService.updateCustomer(customer.id, editedCustomer)
      onUpdate(updated)
      setIsEditing(false)
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
    setIsEditing(false)
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
              await customersService.updateCustomerLoyaltyPoints(customer.id, adjustment)
              const updated = { ...customer, loyalty_points: customer.loyalty_points + adjustment }
              onUpdate(updated as Customer)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              setShowLoyaltyModal(false)
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
      {/* Header */}
      <View style={styles.detailHeader}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <View style={styles.detailHeaderActions}>
          {isEditing ? (
            <>
              <Pressable
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[styles.actionButton, styles.editButton]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.actionButtonText}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.deleteButton]}
                onPress={onDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
        {/* Avatar & Name */}
        <View style={styles.detailAvatarSection}>
          <View style={styles.detailAvatar}>
            <Text style={styles.detailAvatarText}>
              {(customer.first_name || customer.full_name || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          {isEditing ? (
            <View style={styles.nameEditFields}>
              <TextInput
                style={styles.nameInput}
                value={editedCustomer.first_name || ''}
                onChangeText={(text) =>
                  setEditedCustomer({ ...editedCustomer, first_name: text })
                }
                placeholder="First Name"
                placeholderTextColor={colors.text.placeholder}
              />
              <TextInput
                style={styles.nameInput}
                value={editedCustomer.last_name || ''}
                onChangeText={(text) =>
                  setEditedCustomer({ ...editedCustomer, last_name: text })
                }
                placeholder="Last Name"
                placeholderTextColor={colors.text.placeholder}
              />
            </View>
          ) : (
            <Text style={styles.detailCustomerName}>
              {customer.full_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Anonymous Customer'}
            </Text>
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${(customer.total_spent || 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{customer.total_orders || 0}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <Pressable
            style={styles.statCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowLoyaltyModal(true)
            }}
          >
            <Text style={[styles.statValue, styles.loyaltyStatValue]}>
              {customer.loyalty_points || 0}
            </Text>
            <Text style={styles.statLabel}>Loyalty Points</Text>
            <Text style={styles.statHint}>Tap to adjust</Text>
          </Pressable>
        </View>

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
                  setShowLoyaltyModal(false)
                }}
              >
                <Text style={styles.loyaltyCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
          <View style={styles.glassCard}>
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

            <View style={styles.divider} />

            {/* Phone */}
            <View style={styles.infoRow}>
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
          <Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
          <View style={styles.glassCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>{memberSince}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer ID</Text>
              <Text style={styles.infoValue}>{customer.id.slice(0, 8)}...</Text>
            </View>
          </View>
        </View>

        {/* Recent Orders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT ORDERS</Text>
          <View style={styles.glassCard}>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
})

CustomerDetail.displayName = 'CustomerDetail'
