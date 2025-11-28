/**
 * ShipOrderModal Component
 *
 * STANDARD FULLSCREENMODAL PATTERN ✅
 * Used when shipping an order and adding tracking information
 * Status: packed → shipped
 *
 * Allows staff to:
 * - Select carrier
 * - Add tracking number (REQUIRED)
 * - Add shipping cost
 * - Auto-notify customer with tracking info
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

interface ShipOrderModalProps {
  visible: boolean
  onClose: () => void
  orderId: string | null
}

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL', 'Other']

export function ShipOrderModal({
  visible,
  onClose,
  orderId,
}: ShipOrderModalProps) {
  const [carrier, setCarrier] = useState('USPS')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [showCarrierPicker, setShowCarrierPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleShip = async () => {
    if (!orderId) return

    if (!trackingNumber.trim()) {
      Alert.alert('Tracking Required', 'Please enter a tracking number before shipping')
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Update order status to shipped
      await useOrdersStore.getState().updateOrderStatus(orderId, 'shipped')

      // TODO: Update order with tracking info, carrier, shipping cost
      // TODO: Send customer notification if enabled

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Reset form
      setCarrier('USPS')
      setTrackingNumber('')
      setShippingCost('')
      setNotifyCustomer(true)

      onClose()
    } catch (error) {
      logger.error('Failed to ship order', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to mark order as shipped')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      searchValue={trackingNumber}
      onSearchChange={setTrackingNumber}
      searchPlaceholder="Tracking number *"
    >
      {/* Carrier Selection */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>CARRIER</Text>
        <Pressable
          style={[modalStyles.card]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowCarrierPicker(!showCarrierPicker)
          }}
        >
          <Text style={[modalStyles.input, { fontWeight: '600' }]}>{carrier}</Text>
        </Pressable>

        {/* Carrier Picker */}
        {showCarrierPicker && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {CARRIERS.map((c) => (
              <Pressable
                key={c}
                style={[
                  modalStyles.card,
                  {
                    backgroundColor:
                      carrier === c
                        ? 'rgba(10,132,255,0.2)'
                        : 'rgba(118, 118, 128, 0.24)',
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setCarrier(c)
                  setShowCarrierPicker(false)
                }}
              >
                <Text
                  style={[
                    modalStyles.input,
                    { color: carrier === c ? '#0a84ff' : '#fff' },
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Tracking Number */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>TRACKING NUMBER *</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input]}
          value={trackingNumber}
          onChangeText={setTrackingNumber}
          placeholder="Enter tracking number..."
          placeholderTextColor="rgba(235,235,245,0.3)"
          autoCapitalize="characters"
        />
      </View>

      {/* Shipping Cost */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>SHIPPING COST (OPTIONAL)</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input]}
          value={shippingCost}
          onChangeText={setShippingCost}
          placeholder="12.50"
          placeholderTextColor="rgba(235,235,245,0.3)"
          keyboardType="decimal-pad"
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
              Send Tracking to Customer
            </Text>
            <Text
              style={[
                modalStyles.input,
                { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 4 },
              ]}
            >
              SMS/Email with carrier and tracking number
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

      {/* Ship Button */}
      <Pressable
        style={[
          modalStyles.button,
          (!trackingNumber.trim() || saving) && modalStyles.buttonDisabled,
        ]}
        onPress={handleShip}
        disabled={!trackingNumber.trim() || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={modalStyles.buttonText}>MARK SHIPPED</Text>
        )}
      </Pressable>
    </FullScreenModal>
  )
}
