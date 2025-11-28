/**
 * MarkReadyModal Component
 *
 * STANDARD FULLSCREENMODAL PATTERN ✅
 * Used when marking a pickup order ready for customer pickup
 * Status: preparing → ready
 *
 * Allows staff to:
 * - Add final pickup instructions
 * - Send customer notification
 * - Confirm all items are ready
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
import { Ionicons } from '@expo/vector-icons'
import { FullScreenModal, modalStyles } from '@/components/shared'
import { useOrdersStore } from '@/stores/orders.store'
import { logger } from '@/utils/logger'

interface MarkReadyModalProps {
  visible: boolean
  onClose: () => void
  orderId: string | null
}

export function MarkReadyModal({
  visible,
  onClose,
  orderId,
}: MarkReadyModalProps) {
  const [pickupInstructions, setPickupInstructions] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [itemsVerified, setItemsVerified] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleMarkReady = async () => {
    if (!orderId) return

    if (!itemsVerified) {
      Alert.alert('Verification Required', 'Please confirm all items are ready before proceeding')
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Update order status to ready
      await useOrdersStore.getState().updateOrderStatus(orderId, 'ready')

      // TODO: Add pickup instructions to order
      // TODO: Send customer notification if enabled

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Reset form
      setPickupInstructions('')
      setNotifyCustomer(true)
      setItemsVerified(false)

      onClose()
    } catch (error) {
      logger.error('Failed to mark order ready', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to mark order ready')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      searchValue={pickupInstructions}
      onSearchChange={setPickupInstructions}
      searchPlaceholder="Pickup instructions..."
    >
      {/* Items Verified Checklist */}
      <View style={modalStyles.section}>
        <Pressable
          style={[
            modalStyles.card,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setItemsVerified(!itemsVerified)
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: itemsVerified ? '#34c759' : 'rgba(118,118,128,0.24)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {itemsVerified && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.input, { fontWeight: '600' }]}>
              All Items Ready
            </Text>
            <Text
              style={[
                modalStyles.input,
                { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 4 },
              ]}
            >
              Confirm all items have been prepared and packaged
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Pickup Instructions */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>PICKUP INSTRUCTIONS</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={pickupInstructions}
          onChangeText={setPickupInstructions}
          placeholder="e.g., Ask for Sarah at the front counter..."
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
              Send Customer Notification
            </Text>
            <Text
              style={[
                modalStyles.input,
                { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 4 },
              ]}
            >
              SMS/Email that order is ready for pickup
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

      {/* Mark Ready Button */}
      <Pressable
        style={[
          modalStyles.button,
          (!itemsVerified || saving) && modalStyles.buttonDisabled,
        ]}
        onPress={handleMarkReady}
        disabled={!itemsVerified || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={modalStyles.buttonText}>MARK READY FOR PICKUP</Text>
        )}
      </Pressable>
    </FullScreenModal>
  )
}
