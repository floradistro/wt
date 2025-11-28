/**
 * ConfirmPickupOrderModal Component
 *
 * STANDARD FULLSCREENMODAL PATTERN ✅
 * Used when confirming a store pickup order
 * Status: pending → confirmed
 *
 * Allows staff to:
 * - Add preparation notes
 * - Set estimated ready time
 * - Toggle customer notification
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

interface ConfirmPickupOrderModalProps {
  visible: boolean
  onClose: () => void
  orderId: string | null
}

export function ConfirmPickupOrderModal({
  visible,
  onClose,
  orderId,
}: ConfirmPickupOrderModalProps) {
  const [prepNotes, setPrepNotes] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState('15')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!orderId) return

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Update order status to confirmed
      await useOrdersStore.getState().updateOrderStatus(orderId, 'confirmed')

      // TODO: Add prep notes to order
      // TODO: Set estimated ready time
      // TODO: Send customer notification if enabled

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Reset form
      setPrepNotes('')
      setEstimatedMinutes('15')
      setNotifyCustomer(true)

      onClose()
    } catch (error) {
      logger.error('Failed to confirm pickup order', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to confirm order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      searchValue={prepNotes}
      onSearchChange={setPrepNotes}
      searchPlaceholder="Preparation notes..."
    >
      {/* Estimated Ready Time */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>ESTIMATED READY TIME (MINUTES)</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input]}
          value={estimatedMinutes}
          onChangeText={setEstimatedMinutes}
          placeholder="15"
          placeholderTextColor="rgba(235,235,245,0.3)"
          keyboardType="number-pad"
        />
      </View>

      {/* Prep Notes */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>PREPARATION NOTES</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={prepNotes}
          onChangeText={setPrepNotes}
          placeholder="Add any special instructions or notes for preparation..."
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
              Notify Customer
            </Text>
            <Text
              style={[
                modalStyles.input,
                { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 4 },
              ]}
            >
              Send confirmation and estimated ready time
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

      {/* Confirm Button */}
      <Pressable
        style={[modalStyles.button, saving && modalStyles.buttonDisabled]}
        onPress={handleConfirm}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={modalStyles.buttonText}>CONFIRM ORDER</Text>
        )}
      </Pressable>
    </FullScreenModal>
  )
}
