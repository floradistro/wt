/**
 * PackOrderModal Component
 *
 * STANDARD FULLSCREENMODAL PATTERN ✅
 * Used when marking an order as packed and ready to ship
 * Status: packing → packed
 *
 * Allows staff to:
 * - Verify all items are packed
 * - Add packing notes (fragile, special handling)
 * - Record box/package information
 * - Record weight (optional)
 */

import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { FullScreenModal, modalStyles } from '@/components/shared'
import { useOrdersStore } from '@/stores/orders.store'
import { logger } from '@/utils/logger'

interface PackOrderModalProps {
  visible: boolean
  onClose: () => void
  orderId: string | null
}

export function PackOrderModal({
  visible,
  onClose,
  orderId,
}: PackOrderModalProps) {
  const [packingNotes, setPackingNotes] = useState('')
  const [boxInfo, setBoxInfo] = useState('')
  const [weight, setWeight] = useState('')
  const [itemsVerified, setItemsVerified] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleMarkPacked = async () => {
    if (!orderId) return

    if (!itemsVerified) {
      Alert.alert('Verification Required', 'Please confirm all items are packed before proceeding')
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Update order status to packed
      await useOrdersStore.getState().updateOrderStatus(orderId, 'packed')

      // TODO: Add packing notes, box info, weight to order

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Reset form
      setPackingNotes('')
      setBoxInfo('')
      setWeight('')
      setItemsVerified(false)

      onClose()
    } catch (error) {
      logger.error('Failed to mark order packed', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to mark order packed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      searchValue={packingNotes}
      onSearchChange={setPackingNotes}
      searchPlaceholder="Packing notes..."
    >
      {/* Items Packed Verification */}
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
              All Items Packed
            </Text>
            <Text
              style={[
                modalStyles.input,
                { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 4 },
              ]}
            >
              Confirm all items have been securely packaged
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Box/Package Information */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>BOX/PACKAGE INFO</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input]}
          value={boxInfo}
          onChangeText={setBoxInfo}
          placeholder="e.g., Medium box, 12x12x8..."
          placeholderTextColor="rgba(235,235,245,0.3)"
        />
      </View>

      {/* Weight (Optional) */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>WEIGHT (LBS) - OPTIONAL</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input]}
          value={weight}
          onChangeText={setWeight}
          placeholder="5.2"
          placeholderTextColor="rgba(235,235,245,0.3)"
          keyboardType="decimal-pad"
        />
      </View>

      {/* Packing Notes */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>PACKING NOTES</Text>
        <TextInput
          style={[modalStyles.card, modalStyles.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={packingNotes}
          onChangeText={setPackingNotes}
          placeholder="e.g., Fragile items, special handling instructions..."
          placeholderTextColor="rgba(235,235,245,0.3)"
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Mark Packed Button */}
      <Pressable
        style={[
          modalStyles.button,
          (!itemsVerified || saving) && modalStyles.buttonDisabled,
        ]}
        onPress={handleMarkPacked}
        disabled={!itemsVerified || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={modalStyles.buttonText}>MARK PACKED</Text>
        )}
      </Pressable>
    </FullScreenModal>
  )
}
