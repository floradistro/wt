/**
 * AdjustInventoryModal Component
 * Manual inventory adjustments with reason tracking
 *
 * REUSES FullScreenModal (our STANDARD reusable modal component)
 *
 * State Management:
 * - Reads product data from product-edit.store
 * - Reads modal visibility and location from product-ui.store
 * - Stores adjustment result in product-ui.store to trigger parent reload
 */

import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { logger } from '@/utils/logger'
import { supabase } from '@/lib/supabase/client'
import { useInventoryAdjustments } from '@/hooks/useInventoryAdjustments'
import type { AdjustmentType } from '@/services/inventory-adjustments.service'
import { useOriginalProduct } from '@/stores/product-edit.store'
import { useActiveModal, useSelectedLocation, productUIActions } from '@/stores/product-ui.store'
import { FullScreenModal, modalStyles } from '@/components/shared/modals/FullScreenModal'
import type { InventoryItem } from '@/types/pos'

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string; description: string; quickReasons: string[] }[] = [
  {
    value: 'count_correction',
    label: 'Count Correction',
    description: 'Physical count differs from system',
    quickReasons: ['Physical count mismatch', 'Inventory audit correction', 'System error fix']
  },
  {
    value: 'damage',
    label: 'Damage',
    description: 'Product damaged or unusable',
    quickReasons: ['Water damage', 'Physical damage', 'Handling damage', 'Packaging damage']
  },
  {
    value: 'shrinkage',
    label: 'Shrinkage',
    description: 'Missing inventory (unknown cause)',
    quickReasons: ['Unknown loss', 'Inventory discrepancy', 'Unaccounted variance']
  },
  {
    value: 'theft',
    label: 'Theft',
    description: 'Product stolen',
    quickReasons: ['Internal theft', 'External theft', 'Shoplifting incident']
  },
  {
    value: 'expired',
    label: 'Expired',
    description: 'Product past expiration date',
    quickReasons: ['Past expiration date', 'Quality degradation', 'Unsellable condition']
  },
  {
    value: 'received',
    label: 'Received',
    description: 'Stock received from supplier',
    quickReasons: ['New shipment received', 'Supplier delivery', 'Restock from vendor']
  },
  {
    value: 'return',
    label: 'Return',
    description: 'Product returned to inventory',
    quickReasons: ['Customer return', 'Restocked from sales floor', 'Transfer return']
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other reason (specify in notes)',
    quickReasons: ['See notes', 'Custom adjustment']
  },
]

export function AdjustInventoryModal() {
  // Read from stores
  const visible = useActiveModal() === 'adjust-inventory'
  const product = useOriginalProduct()
  const { selectedLocationId: storeLocationId, selectedLocationName: storeLocationName } = useSelectedLocation()

  const [selectedLocationId, setSelectedLocationId] = useState(storeLocationId)
  const [selectedLocationName, setSelectedLocationName] = useState(storeLocationName)
  const [searchValue, setSearchValue] = useState('')

  // BULLETPROOF: Fetch ALL inventory for this product (not filtered by location)
  const [fullInventory, setFullInventory] = useState<InventoryItem[]>([])
  const [loadingInventory, setLoadingInventory] = useState(false)

  // Fetch full inventory when modal opens
  useEffect(() => {
    async function fetchFullInventory() {
      if (!visible || !product?.id) return

      try {
        setLoadingInventory(true)
        const { data, error } = await supabase
          .from('inventory_with_holds')
          .select(`
            id,
            product_id,
            location_id,
            total_quantity,
            held_quantity,
            available_quantity,
            locations (name)
          `)
          .eq('product_id', product.id)

        if (error) {
          logger.error('[AdjustInventoryModal] Failed to fetch inventory:', error)
          return
        }

        if (data) {
          const inventory: InventoryItem[] = data.map((inv: any) => ({
            id: inv.id,
            location_id: inv.location_id,
            location_name: inv.locations?.name || 'Unknown',
            quantity: inv.total_quantity || 0,
            available_quantity: inv.available_quantity || 0,
            reserved_quantity: inv.held_quantity || 0,
          }))
          setFullInventory(inventory)

          // If no location selected yet, select first one
          if (!selectedLocationId && inventory.length > 0) {
            setSelectedLocationId(inventory[0].location_id)
            setSelectedLocationName(inventory[0].location_name)
          }

          logger.debug('[AdjustInventoryModal] Loaded full inventory:', {
            productId: product.id,
            locations: inventory.length,
          })
        }
      } catch (err) {
        logger.error('[AdjustInventoryModal] Error:', err)
      } finally {
        setLoadingInventory(false)
      }
    }

    fetchFullInventory()
  }, [visible, product?.id])

  const { createAdjustment } = useInventoryAdjustments(product?.id, selectedLocationId)
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('count_correction')
  const [quantityChange, setQuantityChange] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showCustomReason, setShowCustomReason] = useState(false)

  // Sync local state with store
  useEffect(() => {
    setSelectedLocationId(storeLocationId)
    setSelectedLocationName(storeLocationName)
  }, [storeLocationId, storeLocationName])

  // Get current inventory for this location (use fullInventory for accurate data)
  const currentInventory = fullInventory.find(inv => inv.location_id === selectedLocationId)
  const currentQuantity = currentInventory?.quantity || 0

  // Calculate new quantity
  const quantityChangeNum = parseFloat(quantityChange) || 0
  const newQuantity = currentQuantity + quantityChangeNum

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setAdjustmentType('count_correction')
      setQuantityChange('')
      setReason('')
      setNotes('')
      setShowCustomReason(false)
      setShowLocationPicker(false)
      setSearchValue('')
    }
  }, [visible])

  // Reset reason when adjustment type changes
  useEffect(() => {
    setReason('')
    setShowCustomReason(false)
  }, [adjustmentType])

  const handleClose = () => {
    productUIActions.closeModal()
  }

  // Number pad handlers
  const handleNumberPress = (num: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setQuantityChange(prev => prev + num)
  }

  const handleToggleSign = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setQuantityChange(prev => {
      if (!prev) return '-'
      if (prev.startsWith('-')) return prev.slice(1)
      return '-' + prev
    })
  }

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setQuantityChange('')
  }

  const handleBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setQuantityChange(prev => prev.slice(0, -1))
  }

  const handleSave = async () => {
    if (!product || !selectedLocationId || !quantityChange || !reason) {
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data, error, metadata } = await createAdjustment({
        product_id: product.id,
        location_id: selectedLocationId,
        adjustment_type: adjustmentType,
        quantity_change: quantityChangeNum,
        reason,
        notes: notes || undefined,
      })

      if (error) {
        throw error
      }

      logger.info('[AdjustInventoryModal] Adjustment created successfully', {
        adjustmentId: data?.id,
        quantityBefore: metadata?.quantity_before,
        quantityAfter: metadata?.quantity_after,
        productTotalStock: metadata?.product_total_stock,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Set success result to trigger parent reload
      logger.info('[AdjustInventoryModal] Setting adjustment result to trigger reload', {
        quantity_after: metadata?.quantity_after,
        product_total_stock: metadata?.product_total_stock,
      })
      productUIActions.setAdjustmentResult({
        quantity_after: metadata?.quantity_after || 0,
        product_total_stock: metadata?.product_total_stock || 0,
      })

      logger.info('[AdjustInventoryModal] Closing modal')
      handleClose()
    } catch (error) {
      logger.error('[AdjustInventoryModal] Failed to create adjustment:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const selectedType = ADJUSTMENT_TYPES.find(t => t.value === adjustmentType)
  const canSave = quantityChange && reason && !saving

  if (!product) return null

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      searchPlaceholder={`Adjust ${product.name}`}
    >
      {/* Location Selector - Uses fullInventory for accurate ALL locations */}
      {loadingInventory ? (
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionLabel}>LOCATION</Text>
          <View style={modalStyles.card}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
          </View>
        </View>
      ) : fullInventory.length > 1 && (
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionLabel}>LOCATION</Text>
          <Pressable
            style={[modalStyles.card, styles.locationCard]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowLocationPicker(!showLocationPicker)
            }}
          >
            <Text style={styles.locationText}>{selectedLocationName}</Text>
            <Text style={styles.chevron}>{showLocationPicker ? '▲' : '▼'}</Text>
          </Pressable>

          {showLocationPicker && (
            <View style={styles.pickerContainer}>
              {fullInventory.map(inv => (
                <Pressable
                  key={inv.location_id}
                  style={[
                    styles.pickerItem,
                    inv.location_id === selectedLocationId && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedLocationId(inv.location_id)
                    setSelectedLocationName(inv.location_name)
                    setShowLocationPicker(false)
                  }}
                >
                  <Text style={styles.pickerItemText}>{inv.location_name}</Text>
                  <Text style={styles.pickerItemQty}>{inv.quantity}g in stock</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Current Inventory */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>CURRENT INVENTORY</Text>
        <View style={modalStyles.card}>
          <Text style={styles.currentQtyLabel}>On hand</Text>
          <Text style={styles.currentQty}>{currentQuantity}g</Text>
        </View>
      </View>

      {/* Adjustment Type Picker */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>ADJUSTMENT TYPE</Text>
        <Pressable
          style={[modalStyles.card, styles.typeCard]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowTypePicker(!showTypePicker)
          }}
        >
          <View>
            <Text style={styles.typeLabel}>{selectedType?.label}</Text>
            <Text style={styles.typeDescription}>{selectedType?.description}</Text>
          </View>
          <Text style={styles.chevron}>{showTypePicker ? '▲' : '▼'}</Text>
        </Pressable>

        {showTypePicker && (
          <View style={styles.pickerContainer}>
            {ADJUSTMENT_TYPES.map(type => (
              <Pressable
                key={type.value}
                style={[
                  styles.pickerItem,
                  type.value === adjustmentType && styles.pickerItemSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setAdjustmentType(type.value)
                  setShowTypePicker(false)
                }}
              >
                <Text style={styles.pickerItemText}>{type.label}</Text>
                <Text style={styles.pickerItemDescription}>{type.description}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Quantity Change */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>QUANTITY CHANGE</Text>
        <View style={[modalStyles.card, styles.quantityCard]}>
          <Text style={styles.quantityDisplay}>
            {quantityChange || '0'}g
          </Text>
          {quantityChange && (
            <Text style={styles.newQuantityPreview}>
              New total: {newQuantity}g
            </Text>
          )}
        </View>

        {/* Number Pad */}
        <View style={styles.numberPad}>
          <View style={styles.numberRow}>
            {['7', '8', '9'].map(num => (
              <Pressable key={num} style={styles.numberButton} onPress={() => handleNumberPress(num)}>
                <Text style={styles.numberText}>{num}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.numberRow}>
            {['4', '5', '6'].map(num => (
              <Pressable key={num} style={styles.numberButton} onPress={() => handleNumberPress(num)}>
                <Text style={styles.numberText}>{num}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.numberRow}>
            {['1', '2', '3'].map(num => (
              <Pressable key={num} style={styles.numberButton} onPress={() => handleNumberPress(num)}>
                <Text style={styles.numberText}>{num}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.numberRow}>
            <Pressable style={styles.numberButton} onPress={handleToggleSign}>
              <Text style={styles.numberText}>+/−</Text>
            </Pressable>
            <Pressable style={styles.numberButton} onPress={() => handleNumberPress('0')}>
              <Text style={styles.numberText}>0</Text>
            </Pressable>
            <Pressable style={styles.numberButton} onPress={handleBackspace}>
              <Text style={styles.numberText}>⌫</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Reason Picker */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>REASON</Text>
        <View style={styles.reasonButtons}>
          {selectedType?.quickReasons.map(quickReason => (
            <Pressable
              key={quickReason}
              style={[
                styles.reasonButton,
                reason === quickReason && styles.reasonButtonSelected,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setReason(quickReason)
                setShowCustomReason(false)
              }}
            >
              <Text
                style={[
                  styles.reasonButtonText,
                  reason === quickReason && styles.reasonButtonTextSelected,
                ]}
              >
                {quickReason}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[
              styles.reasonButton,
              showCustomReason && styles.reasonButtonSelected,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowCustomReason(true)
              setReason('')
            }}
          >
            <Text
              style={[
                styles.reasonButtonText,
                showCustomReason && styles.reasonButtonTextSelected,
              ]}
            >
              Custom reason...
            </Text>
          </Pressable>
        </View>

        {showCustomReason && (
          <TextInput
            style={styles.customReasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter custom reason"
            placeholderTextColor="rgba(235,235,245,0.3)"
            autoFocus
          />
        )}
      </View>

      {/* Notes (Optional) */}
      <View style={modalStyles.section}>
        <Text style={modalStyles.sectionLabel}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={[modalStyles.card, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add additional notes..."
          placeholderTextColor="rgba(235,235,245,0.3)"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Save Button */}
      <Pressable
        style={[
          modalStyles.button,
          !canSave && modalStyles.buttonDisabled,
        ]}
        onPress={handleSave}
        disabled={!canSave}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={modalStyles.buttonText}>SAVE ADJUSTMENT</Text>
        )}
      </Pressable>
    </FullScreenModal>
  )
}

const styles = StyleSheet.create({
  // Location picker
  locationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  chevron: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.6)',
  },

  // Pickers
  pickerContainer: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
  },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pickerItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pickerItemText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  pickerItemDescription: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.6)',
  },
  pickerItemQty: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.6)',
  },

  // Current inventory
  currentQtyLabel: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    marginBottom: 8,
  },
  currentQty: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
  },

  // Type picker
  typeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.6)',
  },

  // Quantity
  quantityCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  quantityDisplay: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  newQuantityPreview: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    marginTop: 8,
  },

  // Number pad
  numberPad: {
    marginTop: 16,
    gap: 12,
  },
  numberRow: {
    flexDirection: 'row',
    gap: 12,
  },
  numberButton: {
    flex: 1,
    height: 56,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },

  // Reason
  reasonButtons: {
    gap: 8,
  },
  reasonButton: {
    padding: 16,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonButtonSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  reasonButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
  },
  reasonButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  customReasonInput: {
    marginTop: 12,
    padding: 16,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 12,
    fontSize: 15,
    color: '#fff',
    minHeight: 50,
  },

  // Notes
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
})
