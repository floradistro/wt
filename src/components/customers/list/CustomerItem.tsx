/**
 * CustomerItem Component
 * Individual customer row in the customers list
 */

import React from 'react'
import { View, Text, Pressable } from 'react-native'
import type { Customer } from '@/services/customers.service'
import { customersStyles as styles } from '../customers.styles'

interface CustomerItemProps {
  item: Customer
  isLast: boolean
  isSelected: boolean
  onPress: () => void
}

export const CustomerItem = React.memo<CustomerItemProps>(({ item, isLast, isSelected, onPress }) => {
  // Format phone number for display
  const formattedPhone = item.phone
    ? item.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
    : null

  return (
    <Pressable
      style={[
        styles.customerItem,
        isSelected && styles.customerItemActive,
        isLast && styles.customerItemLast,
      ]}
      onPress={onPress}
      accessibilityRole="none"
    >
      {/* Avatar Circle */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.first_name || item.full_name || item.email || 'C').charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Customer Name & Contact */}
      <View style={styles.customerInfo}>
        <Text style={styles.customerName} numberOfLines={1}>
          {item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Anonymous Customer'}
        </Text>
        <Text style={styles.customerContact} numberOfLines={1}>
          {formattedPhone || item.email || 'No contact info'}
        </Text>
      </View>

      {/* Orders Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>ORDERS</Text>
        <Text style={styles.dataValue}>{item.total_orders || 0}</Text>
      </View>

      {/* Spent Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>SPENT</Text>
        <Text style={styles.dataValue}>${(item.total_spent || 0).toFixed(2)}</Text>
      </View>

      {/* Loyalty Points Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>POINTS</Text>
        <Text style={[styles.dataValue, styles.loyaltyPoints]}>
          {item.loyalty_points || 0}
        </Text>
      </View>
    </Pressable>
  )
})

CustomerItem.displayName = 'CustomerItem'
