/**
 * ShipOrderModal Component
 *
 * STANDARD FULLSCREENMODAL PATTERN ✅
 * Apple-style: One action to ship order with tracking
 *
 * Supports multi-location orders:
 * - For single-location: Ships entire order
 * - For multi-location: Ships from selected location only
 *
 * Allows staff to:
 * - Select carrier
 * - Add tracking number (REQUIRED)
 * - Auto-notify customer with tracking info via email
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
import { useState, useEffect, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { FullScreenModal, modalStyles } from '@/components/shared'
import { useOrdersStore, useOrders } from '@/stores/orders.store'
import { useOrdersUIActions } from '@/stores/orders-ui.store'
import { supabase } from '@/lib/supabase/client'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useLocationFilter } from '@/stores/location-filter.store'
import { ordersService, type OrderLocation } from '@/services/orders.service'
import { logger } from '@/utils/logger'

// Carrier tracking URL templates
const CARRIER_URLS: Record<string, string> = {
  'USPS': 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
  'UPS': 'https://www.ups.com/track?tracknum=',
  'FedEx': 'https://www.fedex.com/fedextrack/?trknbr=',
  'DHL': 'https://www.dhl.com/en/express/tracking.html?AWB=',
  'Other': '',
}

interface ShipOrderModalProps {
  visible: boolean
  onClose: () => void
  orderId: string | null
  /** Optional: Pre-select a specific location to ship from */
  locationId?: string | null
}

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL', 'Other']

// Location with shipping status
interface LocationShipStatus {
  locationId: string
  locationName: string
  itemCount: number
  isShipped: boolean
  trackingNumber?: string
}

export function ShipOrderModal({
  visible,
  onClose,
  orderId,
  locationId: preselectedLocationId,
}: ShipOrderModalProps) {
  const { vendor, user } = useAppAuth()
  const { selectedLocationIds } = useLocationFilter()
  const { markShipmentComplete } = useOrdersUIActions()
  const orders = useOrders()
  const order = orders.find(o => o.id === orderId)

  const [carrier, setCarrier] = useState('USPS')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [showCarrierPicker, setShowCarrierPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  // Multi-location state
  const [orderLocations, setOrderLocations] = useState<LocationShipStatus[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  // Load order locations when modal opens
  useEffect(() => {
    if (!visible || !orderId) {
      setOrderLocations([])
      setSelectedLocationId(null)
      return
    }

    const loadLocations = async () => {
      try {
        setLoadingLocations(true)
        const shipments = await ordersService.getOrderShipments(orderId)

        const locations: LocationShipStatus[] = shipments.map((loc) => ({
          locationId: loc.location_id,
          locationName: loc.location_name || 'Unknown',
          itemCount: loc.item_count,
          isShipped: !!loc.shipped_at,
          trackingNumber: loc.tracking_number,
        }))

        setOrderLocations(locations)

        // Auto-select location
        if (preselectedLocationId) {
          setSelectedLocationId(preselectedLocationId)
        } else if (locations.length === 1) {
          // Single location - auto select
          setSelectedLocationId(locations[0].locationId)
        } else {
          // Multi-location - try to select user's location if they have one
          const myLocation = locations.find(
            (l) => !l.isShipped && selectedLocationIds.includes(l.locationId)
          )
          if (myLocation) {
            setSelectedLocationId(myLocation.locationId)
          } else {
            // Select first unshipped location
            const firstUnshipped = locations.find((l) => !l.isShipped)
            setSelectedLocationId(firstUnshipped?.locationId || null)
          }
        }
      } catch (error) {
        logger.error('Failed to load order locations:', error)
        // Fall back to single-location mode
        setOrderLocations([])
      } finally {
        setLoadingLocations(false)
      }
    }

    loadLocations()
  }, [visible, orderId, preselectedLocationId, selectedLocationIds])

  // Check if this is a multi-location order
  const isMultiLocation = orderLocations.length > 1
  const unshippedLocations = orderLocations.filter((l) => !l.isShipped)
  const selectedLocation = orderLocations.find((l) => l.locationId === selectedLocationId)

  const handleShip = async () => {
    if (!orderId) return

    if (!trackingNumber.trim()) {
      Alert.alert('Tracking Required', 'Please enter a tracking number before shipping')
      return
    }

    // For multi-location orders, require a location to be selected
    if (isMultiLocation && !selectedLocationId) {
      Alert.alert('Select Location', 'Please select which location is shipping')
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Build tracking URL
      const trackingUrl = CARRIER_URLS[carrier]
        ? `${CARRIER_URLS[carrier]}${trackingNumber.trim()}`
        : undefined

      let allLocationsShipped = false

      if (isMultiLocation && selectedLocationId) {
        // Multi-location order: Ship from specific location
        const result = await ordersService.shipFromLocation(
          orderId,
          selectedLocationId,
          trackingNumber.trim(),
          carrier,
          trackingUrl,
          shippingCost ? parseFloat(shippingCost) : undefined,
          user?.id
        )

        allLocationsShipped = result.allLocationsShipped

        if (!allLocationsShipped) {
          // More locations need to ship - show info
          const remaining = result.remainingLocationsToShip.length
          Alert.alert(
            'Shipment Created',
            `Tracking added for ${selectedLocation?.locationName}.\n\n${remaining} location(s) still need to ship.`
          )
        }
      } else {
        // Single location or legacy: Update order directly
        // NOTE: We intentionally don't set shipped_by_user_id here because the
        // foreign key constraint requires the user to exist in the users table,
        // but auth users may not have a corresponding users table entry.
        const updateData: Record<string, any> = {
          status: 'shipped',
          tracking_number: trackingNumber.trim(),
          shipping_carrier: carrier,
          tracking_url: trackingUrl,
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (shippingCost) {
          updateData.shipping_cost = parseFloat(shippingCost)
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId)

        if (updateError) {
          throw updateError
        }

        allLocationsShipped = true
      }

      // Send "Order Shipped" email notification if enabled and all locations shipped
      console.log('[ShipOrderModal] Email check:', {
        notifyCustomer,
        ecommerceUrl: vendor?.ecommerce_url,
        allLocationsShipped,
        willSendEmail: notifyCustomer && vendor?.ecommerce_url && allLocationsShipped,
      })

      if (notifyCustomer && vendor?.ecommerce_url && allLocationsShipped) {
        try {
          const ecommerceUrl = vendor.ecommerce_url.replace(/\/$/, '') // Remove trailing slash
          logger.info('Sending shipped email', { ecommerceUrl, orderId, carrier, trackingNumber: trackingNumber.trim() })

          const response = await fetch(`${ecommerceUrl}/api/orders/${orderId}/send-status-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'shipped',
              trackingNumber: trackingNumber.trim(),
              trackingUrl,
              carrier, // Include carrier for email template
              updateStatus: false, // Already updated above
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            logger.warn('Failed to send shipped email, but order was updated', {
              status: response.status,
              error: errorText,
              url: `${ecommerceUrl}/api/orders/${orderId}/send-status-update`,
            })
          } else {
            const result = await response.json()
            logger.info('Shipped email sent successfully', { resendId: result.resendId })
          }
        } catch (emailError) {
          // Don't fail the ship action if email fails
          logger.warn('Email notification failed', { error: emailError })
        }
      } else if (notifyCustomer && !vendor?.ecommerce_url) {
        logger.warn('Cannot send shipped email: vendor.ecommerce_url not configured')
      }

      // Refresh orders in store
      console.log('[ShipOrderModal] Refreshing orders...')
      await useOrdersStore.getState().refreshOrders()
      console.log('[ShipOrderModal] Orders refreshed, signaling detail views...')

      // Signal detail views to reload their local shipment data
      markShipmentComplete()
      console.log('[ShipOrderModal] Done!')

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Reset form
      setCarrier('USPS')
      setTrackingNumber('')
      setShippingCost('')
      setNotifyCustomer(true)

      onClose()
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString?.() || JSON.stringify(error)
      console.error('[ShipOrderModal] Ship failed:', error)
      logger.error('Failed to ship order', { error, message: errorMessage })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', `Failed to mark order as shipped: ${errorMessage}`)
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
      {/* Multi-location indicator */}
      {isMultiLocation && (
        <View style={modalStyles.section}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(191,90,242,0.15)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            marginBottom: 8,
          }}>
            <Ionicons name="cube-outline" size={18} color="#bf5af2" />
            <Text style={{ color: '#bf5af2', fontSize: 14, fontWeight: '600' }}>
              Multi-Location Order • {unshippedLocations.length} shipment{unshippedLocations.length !== 1 ? 's' : ''} remaining
            </Text>
          </View>
        </View>
      )}

      {/* Location Selection (for multi-location orders) */}
      {isMultiLocation && (
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionLabel}>SHIPPING FROM</Text>
          <Pressable
            style={[modalStyles.card]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowLocationPicker(!showLocationPicker)
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="storefront-outline" size={18} color="rgba(235,235,245,0.6)" />
              <Text style={[modalStyles.input, { fontWeight: '600' }]}>
                {selectedLocation?.locationName || 'Select Location'}
              </Text>
              {selectedLocation && (
                <Text style={{ color: 'rgba(235,235,245,0.5)', fontSize: 13 }}>
                  ({selectedLocation.itemCount} item{selectedLocation.itemCount !== 1 ? 's' : ''})
                </Text>
              )}
            </View>
          </Pressable>

          {/* Location Picker */}
          {showLocationPicker && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {orderLocations.map((loc) => (
                <Pressable
                  key={loc.locationId}
                  style={[
                    modalStyles.card,
                    {
                      backgroundColor: loc.isShipped
                        ? 'rgba(52,199,89,0.1)'
                        : selectedLocationId === loc.locationId
                          ? 'rgba(10,132,255,0.2)'
                          : 'rgba(118, 118, 128, 0.24)',
                      opacity: loc.isShipped ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => {
                    if (!loc.isShipped) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setSelectedLocationId(loc.locationId)
                      setShowLocationPicker(false)
                    }
                  }}
                  disabled={loc.isShipped}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons
                        name={loc.isShipped ? 'checkmark-circle' : 'storefront-outline'}
                        size={18}
                        color={loc.isShipped ? '#34c759' : selectedLocationId === loc.locationId ? '#0a84ff' : 'rgba(235,235,245,0.6)'}
                      />
                      <Text
                        style={[
                          modalStyles.input,
                          { color: loc.isShipped ? '#34c759' : selectedLocationId === loc.locationId ? '#0a84ff' : '#fff' },
                        ]}
                      >
                        {loc.locationName}
                      </Text>
                    </View>
                    <Text style={{ color: 'rgba(235,235,245,0.5)', fontSize: 13 }}>
                      {loc.isShipped ? `Shipped • ${loc.trackingNumber}` : `${loc.itemCount} item${loc.itemCount !== 1 ? 's' : ''}`}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

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
          <Text style={modalStyles.buttonText}>Ship</Text>
        )}
      </Pressable>
    </FullScreenModal>
  )
}
