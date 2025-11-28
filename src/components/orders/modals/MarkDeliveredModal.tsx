/**
 * MarkDeliveredModal Component
 *
 * STANDARD FULLSCREENMODAL PATTERN ✅
 * Used when marking an order as delivered
 * Status: shipped/in_transit → delivered
 *
 * Allows staff to:
 * - Add delivery confirmation notes
 * - Record delivery date/time
 * - Add any delivery issues or notes
 */

import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native'
import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { FullScreenModal, modalStyles } from '@/components/shared'
import { useOrdersStore } from '@/stores/orders.store'
import { logger } from '@/utils/logger'

interface MarkDeliveredModalProps {
  visible: boolean
  onClose: () => void
  orderId: string | null
}

export function MarkDeliveredModal({
  visible,
  onClose,
  orderId,
}: MarkDeliveredModalProps) {
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleMarkDelivered = async () => {
    if (!orderId) return

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Update order status to delivered
      await useOrdersStore.getState().updateOrderStatus(orderId, 'delivered')

      // TODO: Add delivery notes to order
      // TODO: Send customer notification if enabled

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Reset form
      setDeliveryNotes('')
      setNotifyCustomer(true)

      onClose()
    } catch (error) {
      logger.error('Failed to mark order delivered', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to mark order delivered')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      searchValue={deliveryNotes}
      onSearchChange={setDeliveryNotes}
      searchPlaceholder="Delivery notes..."
    >
      {/* Delivery Confirmation */}
      <View style={modalStyles.section}>
        <View
          style={[
            modalStyles.card,
            {
              alignItems: 'center',
              padding: 24,
            },
          ]}
        >
          <Text style={[modalStyles.input, { fontSize: 17, fontWeight: '600', textAlign: 'center' }]}>
            Confirm Delivery
          </Text>
          <Text
            style={[
              modalStyles.input,
              {
                fontSize: 15,
                color: 'rgba(235,235,245,0.6)',
                marginTop: 8,
                textAlign: 'center',
              },
            ]}
          >
            Mark this order as successfully delivered to the customer
          </Text>
        </View>
      </View>

      {/* Delivery Notes */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>DELIVERY NOTES (OPTIONAL)</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={deliveryNotes}
          onChangeText={setDeliveryNotes}
          placeholder="e.g., Left at front door, signed by recipient..."
          placeholderTextColor="rgba(235,235,245,0.3)"
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Notify Customer Toggle */}
      <View style={modalStyles.section}>
        <View
          style={[
            modalStyles.card,
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.input, { fontWeight: '600' }]}>
              Send Delivery Confirmation
            </Text>
            <Text
              style={[
                modalStyles.input,
                { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 4 },
              ]}
            >
              Notify customer that order has been delivered
            </Text>
          </View>
          <Switch
            value={notifyCustomer}
            onValueChange={setNotifyCustomer}
            trackColor={{ false: 'rgba(118,118,128,0.24)', true: '#0a84ff' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Mark Delivered Button */}
      <Pressable
        style={[modalStyles.button, saving && modalStyles.buttonDisabled]}
        onPress={handleMarkDelivered}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={modalStyles.buttonText}>MARK DELIVERED</Text>
        )}
      </Pressable>
    </FullScreenModal>
  )
}
