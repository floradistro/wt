/**
 * ConfirmECommerceOrderModal Component
 *
 * STANDARD FULLSCREENMODAL PATTERN ✅
 * Used when confirming an e-commerce shipping order
 * Status: pending → confirmed
 *
 * Allows staff to:
 * - Add processing notes
 * - Set estimated ship date
 * - Verify inventory availability
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
import { Ionicons } from '@expo/vector-icons'
import { FullScreenModal, modalStyles } from '@/components/shared'
import { useOrdersStore } from '@/stores/orders.store'
import { logger } from '@/utils/logger'

interface ConfirmECommerceOrderModalProps {
  visible: boolean
  onClose: () => void
  orderId: string | null
}

export function ConfirmECommerceOrderModal({
  visible,
  onClose,
  orderId,
}: ConfirmECommerceOrderModalProps) {
  const [processingNotes, setProcessingNotes] = useState('')
  const [estimatedShipDays, setEstimatedShipDays] = useState('2')
  const [inventoryVerified, setInventoryVerified] = useState(false)
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!orderId) return

    if (!inventoryVerified) {
      Alert.alert('Verification Required', 'Please verify inventory before confirming order')
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Update order status to confirmed
      await useOrdersStore.getState().updateOrderStatus(orderId, 'confirmed')

      // TODO: Add processing notes to order
      // TODO: Set estimated ship date
      // TODO: Send customer notification if enabled

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Reset form
      setProcessingNotes('')
      setEstimatedShipDays('2')
      setInventoryVerified(false)
      setNotifyCustomer(true)

      onClose()
    } catch (error) {
      logger.error('Failed to confirm e-commerce order', { error })
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
      searchValue={processingNotes}
      onSearchChange={setProcessingNotes}
      searchPlaceholder="Processing notes..."
    >
      {/* Inventory Verification Checklist */}
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
            setInventoryVerified(!inventoryVerified)
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: inventoryVerified ? '#34c759' : 'rgba(118,118,128,0.24)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {inventoryVerified && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.input, { fontWeight: '600' }]}>
              Inventory Verified
            </Text>
            <Text
              style={[
                modalStyles.input,
                { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 4 },
              ]}
            >
              Confirm all items are in stock and available
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Estimated Ship Days */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>ESTIMATED SHIP TIME (DAYS)</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input]}
          value={estimatedShipDays}
          onChangeText={setEstimatedShipDays}
          placeholder="2"
          placeholderTextColor="rgba(235,235,245,0.3)"
          keyboardType="number-pad"
        />
      </View>

      {/* Processing Notes */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>PROCESSING NOTES</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={processingNotes}
          onChangeText={setProcessingNotes}
          placeholder="Add any special instructions or processing notes..."
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
              Send confirmation and estimated ship date
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
        style={[
          modalStyles.button,
          (!inventoryVerified || saving) && modalStyles.buttonDisabled,
        ]}
        onPress={handleConfirm}
        disabled={!inventoryVerified || saving}
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
