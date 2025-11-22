/**
 * AdjustInventoryModal Component
 * Manual inventory adjustments with reason tracking
 * Apple Engineering: Clean, purposeful, validated
 */

import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import { useProductAdjustments } from '@/hooks/useInventoryAdjustments'
import type { AdjustmentType } from '@/services/inventory-adjustments.service'
import type { Product } from '@/hooks/useProducts'

interface AdjustInventoryModalProps {
  visible: boolean
  product: Product | null
  locationId?: string
  locationName?: string
  onClose: () => void
  onAdjusted: (result?: { quantity_after: number; product_total_stock: number }) => void
  onLocationChange?: (locationId: string, locationName: string) => void
}

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

export function AdjustInventoryModal({
  visible,
  product,
  locationId: initialLocationId,
  locationName: initialLocationName,
  onClose,
  onAdjusted,
  onLocationChange,
}: AdjustInventoryModalProps) {
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId)
  const [selectedLocationName, setSelectedLocationName] = useState(initialLocationName)

  const { createAdjustment } = useProductAdjustments(product?.id, selectedLocationId)
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('count_correction')
  const [quantityChange, setQuantityChange] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [showCustomReason, setShowCustomReason] = useState(false)

  // Sync local state with props
  useEffect(() => {
    setSelectedLocationId(initialLocationId)
    setSelectedLocationName(initialLocationName)
  }, [initialLocationId, initialLocationName])

  // Get current inventory for this location
  const currentInventory = product?.inventory?.find(inv => inv.location_id === selectedLocationId)
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
    }
  }, [visible])

  // Reset reason when adjustment type changes
  useEffect(() => {
    setReason('')
    setShowCustomReason(false)
  }, [adjustmentType])

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
    if (!product || !selectedLocationId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    if (!quantityChange || parseFloat(quantityChange) === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    if (!reason.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const result = await createAdjustment({
        product_id: product.id,
        location_id: selectedLocationId,
        adjustment_type: adjustmentType,
        quantity_change: quantityChangeNum,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Pass result back for optimistic UI update
      onAdjusted(result ? {
        quantity_after: result.quantity_after,
        product_total_stock: result.product_total_stock
      } : undefined)

      onClose()
    } catch (error) {
      logger.error('Failed to create adjustment', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleLocationChange = (invLocationId: string, invLocationName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedLocationId(invLocationId)
    setSelectedLocationName(invLocationName)
    setShowLocationPicker(false)
    if (onLocationChange) {
      onLocationChange(invLocationId, invLocationName)
    }
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const selectedType = ADJUSTMENT_TYPES.find(t => t.value === adjustmentType)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.container}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.background, !isLiquidGlassSupported && styles.backgroundFallback]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleCancel} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Adjust Inventory</Text>
            <Pressable onPress={handleSave} style={styles.headerButton} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#60A5FA" />
              ) : (
                <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Product Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRODUCT</Text>
              <View style={styles.card}>
                <Text style={styles.productName}>{product?.name || 'Unknown'}</Text>
                <Text style={styles.productSKU}>{product?.sku || 'No SKU'}</Text>
              </View>
            </View>

            {/* Location Picker */}
            {product?.inventory && product.inventory.length > 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>LOCATION</Text>
                <Pressable
                  style={styles.picker}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setShowLocationPicker(!showLocationPicker)
                  }}
                >
                  <View>
                    <Text style={styles.pickerLabel}>{selectedLocationName || 'Select Location'}</Text>
                    <Text style={styles.pickerDescription}>Current: {currentQuantity}g in stock</Text>
                  </View>
                  <Text style={styles.chevron}>{showLocationPicker ? 'v' : '>'}</Text>
                </Pressable>

                {showLocationPicker && (
                  <View style={styles.pickerOptions}>
                    {product.inventory.map((inv, index) => (
                      <Pressable
                        key={inv.location_id}
                        style={[
                          styles.pickerOption,
                          selectedLocationId === inv.location_id && styles.pickerOptionSelected,
                          index === product.inventory!.length - 1 && styles.pickerOptionLast,
                        ]}
                        onPress={() => handleLocationChange(inv.location_id, inv.location_name)}
                      >
                        <View>
                          <Text style={styles.pickerOptionLabel}>{inv.location_name}</Text>
                          <Text style={styles.pickerOptionDescription}>{inv.quantity || 0}g in stock</Text>
                        </View>
                        {selectedLocationId === inv.location_id && <Text style={styles.checkmark}>✓</Text>}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Current & New Stock */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>STOCK LEVELS</Text>
              <View style={styles.card}>
                <View style={styles.stockRow}>
                  <Text style={styles.stockLabel}>Current Stock</Text>
                  <Text style={styles.stockValue}>{currentQuantity}g</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stockRow}>
                  <Text style={styles.stockLabel}>Adjustment</Text>
                  <Text style={[
                    styles.stockValue,
                    quantityChangeNum > 0 && styles.stockPositive,
                    quantityChangeNum < 0 && styles.stockNegative,
                  ]}>
                    {quantityChangeNum > 0 ? '+' : ''}{quantityChangeNum}g
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stockRow}>
                  <Text style={styles.stockLabelBold}>New Stock</Text>
                  <Text style={[
                    styles.stockValueBold,
                    newQuantity < 0 && styles.stockError,
                  ]}>
                    {newQuantity}g
                  </Text>
                </View>
              </View>
            </View>

            {/* Adjustment Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TYPE</Text>
              <Pressable
                style={styles.picker}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowTypePicker(!showTypePicker)
                }}
              >
                <View>
                  <Text style={styles.pickerLabel}>{selectedType?.label}</Text>
                  <Text style={styles.pickerDescription}>{selectedType?.description}</Text>
                </View>
                <Text style={styles.chevron}>{showTypePicker ? 'v' : '>'}</Text>
              </Pressable>

              {showTypePicker && (
                <View style={styles.pickerOptions}>
                  {ADJUSTMENT_TYPES.map((type, index) => (
                    <Pressable
                      key={type.value}
                      style={[
                        styles.pickerOption,
                        adjustmentType === type.value && styles.pickerOptionSelected,
                        index === ADJUSTMENT_TYPES.length - 1 && styles.pickerOptionLast,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setAdjustmentType(type.value)
                        setShowTypePicker(false)
                      }}
                    >
                      <View>
                        <Text style={styles.pickerOptionLabel}>{type.label}</Text>
                        <Text style={styles.pickerOptionDescription}>{type.description}</Text>
                      </View>
                      {adjustmentType === type.value && <Text style={styles.checkmark}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Quantity Change */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>QUANTITY CHANGE</Text>
              <View style={styles.numberPadDisplay}>
                <Text style={styles.numberPadValue}>{quantityChange || '0'}g</Text>
              </View>

              {/* Number Pad */}
              <View style={styles.numberPad}>
                <View style={styles.numberPadRow}>
                  {['7', '8', '9'].map(num => (
                    <Pressable key={num} style={styles.numberPadButton} onPress={() => handleNumberPress(num)}>
                      <Text style={styles.numberPadButtonText}>{num}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.numberPadRow}>
                  {['4', '5', '6'].map(num => (
                    <Pressable key={num} style={styles.numberPadButton} onPress={() => handleNumberPress(num)}>
                      <Text style={styles.numberPadButtonText}>{num}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.numberPadRow}>
                  {['1', '2', '3'].map(num => (
                    <Pressable key={num} style={styles.numberPadButton} onPress={() => handleNumberPress(num)}>
                      <Text style={styles.numberPadButtonText}>{num}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.numberPadRow}>
                  <Pressable style={styles.numberPadButton} onPress={handleToggleSign}>
                    <Text style={styles.numberPadButtonText}>+/-</Text>
                  </Pressable>
                  <Pressable style={styles.numberPadButton} onPress={() => handleNumberPress('0')}>
                    <Text style={styles.numberPadButtonText}>0</Text>
                  </Pressable>
                  <Pressable style={styles.numberPadButton} onPress={handleBackspace}>
                    <Text style={styles.numberPadButtonText}>←</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Reason (Required) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>REASON * REQUIRED</Text>
              {!showCustomReason ? (
                <>
                  <View style={styles.quickReasons}>
                    {selectedType?.quickReasons.map((quickReason) => (
                      <Pressable
                        key={quickReason}
                        style={[
                          styles.quickReasonButton,
                          reason === quickReason && styles.quickReasonButtonSelected
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setReason(quickReason)
                        }}
                      >
                        <Text style={[
                          styles.quickReasonText,
                          reason === quickReason && styles.quickReasonTextSelected
                        ]}>
                          {quickReason}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    style={styles.customReasonButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowCustomReason(true)
                      setReason('')
                    }}
                  >
                    <Text style={styles.customReasonButtonText}>+ Custom Reason</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Enter custom reason..."
                    placeholderTextColor={colors.text.placeholder}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    numberOfLines={3}
                    returnKeyType="next"
                    autoFocus
                  />
                  <Pressable
                    style={styles.backToQuickButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowCustomReason(false)
                      setReason('')
                    }}
                  >
                    <Text style={styles.backToQuickButtonText}>← Back to Quick Reasons</Text>
                  </Pressable>
                </>
              )}
            </View>

            {/* Notes (Optional) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Additional details..."
                placeholderTextColor={colors.text.placeholder}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />
            </View>

            {/* Warning for negative stock */}
            {newQuantity < 0 && (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>
                  Warning: This adjustment will result in negative inventory
                </Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </LiquidGlassView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  background: {
    flex: 1,
  },
  backgroundFallback: {
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    minWidth: 70,
    paddingVertical: spacing.xs,
  },
  headerButtonText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  headerButtonTextPrimary: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  headerTitle: {
    ...typography.headline,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.uppercaseLabel,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
  },
  productName: {
    ...typography.title3,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  productSKU: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  productLocation: {
    ...typography.footnote,
    color: colors.text.quaternary,
    marginTop: spacing.xxs,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  stockLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  stockLabelBold: {
    ...typography.headline,
    color: colors.text.primary,
  },
  stockValue: {
    ...typography.body,
    color: colors.text.secondary,
  },
  stockValueBold: {
    ...typography.title3,
    color: colors.text.primary,
  },
  stockPositive: {
    color: colors.semantic.success,
  },
  stockNegative: {
    color: colors.semantic.error,
  },
  stockError: {
    color: colors.semantic.error,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border.subtle,
  },
  picker: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerLabel: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  pickerDescription: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  chevron: {
    ...typography.caption1,
    color: colors.text.quaternary,
  },
  pickerOptions: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    marginTop: spacing.xs,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  pickerOptionLast: {
    borderBottomWidth: 0,
  },
  pickerOptionSelected: {
    backgroundColor: colors.interactive.active,
  },
  pickerOptionLabel: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  pickerOptionDescription: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  checkmark: {
    ...typography.title2,
    color: '#60A5FA',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.input,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  inputSuffix: {
    ...typography.body,
    color: colors.text.quaternary,
    marginLeft: spacing.xs,
  },
  inputHint: {
    ...typography.footnote,
    color: colors.text.quaternary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  textArea: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    ...typography.input,
    color: colors.text.primary,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  warningCard: {
    backgroundColor: colors.semantic.warningBg,
    borderRadius: radius.xxl,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.semantic.warningBorder,
  },
  warningText: {
    ...typography.footnote,
    color: colors.semantic.warning,
    textAlign: 'center',
  },
  numberPadDisplay: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  numberPadValue: {
    ...typography.largeTitle,
    color: colors.text.primary,
    fontWeight: '600',
  },
  numberPad: {
    gap: spacing.xs,
  },
  numberPadRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  numberPadButton: {
    flex: 1,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  numberPadButtonText: {
    ...typography.title2,
    color: colors.text.primary,
    fontWeight: '500',
  },
  quickReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickReasonButton: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
  },
  quickReasonButtonSelected: {
    backgroundColor: '#60A5FA',
    borderColor: '#60A5FA',
  },
  quickReasonText: {
    ...typography.footnote,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  quickReasonTextSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  customReasonButton: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  customReasonButtonText: {
    ...typography.body,
    color: '#60A5FA',
    fontWeight: '500',
  },
  backToQuickButton: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  backToQuickButtonText: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
})
