/**
 * ProductDetail Component
 * Apple Standard: Focused detail view for product editing and viewing
 *
 * Handles:
 * - Product information display and editing
 * - Pricing management (single/tiered)
 * - Inventory display with multi-location support
 * - Actions (adjust inventory, sales history)
 */

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useAuth } from '@/stores/auth.store'
import { layout } from '@/theme/layout'
import { spacing, radius } from '@/theme/tokens'
import type { Product } from '@/types/products'
import { EditableDescriptionSection } from '@/components/products/EditableDescriptionSection'
import { EditablePricingSection } from '@/components/products/EditablePricingSection'
import { EditableCustomFieldsSection } from '@/components/products/EditableCustomFieldsSection'
import { AdjustInventoryModal } from '@/components/products/AdjustInventoryModal'
import { SalesHistoryModal } from '@/components/products/SalesHistoryModal'
import {
  useProductEditState,
  useIsEditing,
  useIsSaving,
  useEditedName,
  useEditedSKU,
  useOriginalProduct,
  productEditActions,
} from '@/stores/product-edit.store'
import { useProductUIState, useLastAdjustmentResult, productUIActions } from '@/stores/product-ui.store'

interface ProductDetailProps {
  product: Product
  onBack: () => void
  onProductUpdated: () => void
}

interface SettingsRowProps {
  label: string
  value?: string
  showChevron?: boolean
  onPress?: () => void
}

function SettingsRow({ label, value, showChevron = true, onPress }: SettingsRowProps) {
  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  return (
    <Pressable style={styles.row} onPress={handlePress} disabled={!onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {showChevron && <Text style={styles.rowChevron}>􀆊</Text>}
      </View>
    </Pressable>
  )
}

export function ProductDetail({ product, onBack, onProductUpdated }: ProductDetailProps) {
  // Auth from context
  const { user } = useAuth()

  // Edit state from product-edit.store
  const isEditing = useIsEditing()
  const saving = useIsSaving()
  const storeEditedName = useEditedName()
  const storeEditedSKU = useEditedSKU()
  const originalProduct = useOriginalProduct()

  // Modal state from product-ui.store
  const { activeModal, selectedLocationId, selectedLocationName } = useProductUIState()
  const lastAdjustmentResult = useLastAdjustmentResult()

  const hasMultipleLocations = (product.inventory?.length || 0) > 1

  // Use store values when editing, fallback to product when store not initialized
  const editedName = storeEditedName || product.name
  const editedSKU = storeEditedSKU || product.sku || ''

  // Initialize edit state synchronously on mount and product change
  const isInitialized = useRef(false)

  useEffect(() => {
    // Always initialize on mount or product change
    productEditActions.startEditing(product)
    isInitialized.current = true

    return () => {
      productEditActions.stopEditing()
      isInitialized.current = false
    }
  }, [product.id])

  // Set default location to first inventory location
  useEffect(() => {
    if (product.inventory && product.inventory.length > 0 && !selectedLocationId) {
      productUIActions.setLocation(product.inventory[0].location_id, product.inventory[0].location_name || '')
    }
  }, [product.id, selectedLocationId])

  // Watch for adjustment results and trigger parent reload
  useEffect(() => {
    if (lastAdjustmentResult) {
      onProductUpdated()
      // Clear the result after handling it
      productUIActions.setAdjustmentResult(null)
    }
  }, [lastAdjustmentResult, onProductUpdated])

  const handleSave = async () => {
    if (!user?.id) return

    const vendorId = (user as any).vendor_id || user.id

    await productEditActions.saveProduct(user.id, vendorId, () => {
      onProductUpdated()
    })
  }

  const handleCancel = () => {
    productEditActions.cancelEdit()
  }

  // Don't render until product is provided
  if (!product) {
    return null
  }

  return (
    <>
      <ScrollView
        style={styles.detail}
        contentContainerStyle={{ paddingBottom: layout.dockHeight, paddingRight: 0 }}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
      >
        {/* Header with Edit/Save toggle */}
        <View style={styles.detailHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Products</Text>
          </Pressable>

          {isEditing ? (
            <View style={styles.editActions}>
              <Pressable onPress={handleCancel} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.saveButton} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#60A5FA" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                productEditActions.updateField('isEditing', true)
              }}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          )}
        </View>

        {/* Header Card */}
        <View style={styles.headerCardContainer}>
          <View style={styles.headerCardGlass}>
            <View style={styles.headerCard}>
              {product.featured_image ? (
                <Image source={{ uri: product.featured_image }} style={styles.headerIcon} />
              ) : (
                <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                  <Text style={styles.headerIconText}>
                    {(isEditing && editedName ? editedName : product.name).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                {isEditing ? (
                  <>
                    <TextInput
                      style={styles.headerTitleInput}
                      value={editedName}
                      onChangeText={(text) => productEditActions.updateField('editedName', text)}
                      placeholder="Product name"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                    />
                    <TextInput
                      style={styles.headerSubtitleInput}
                      value={editedSKU}
                      onChangeText={(text) => productEditActions.updateField('editedSKU', text)}
                      placeholder="SKU"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.headerTitle}>{product.name}</Text>
                    <View style={styles.headerMeta}>
                      <Text style={styles.headerSubtitle}>{product.sku || 'No SKU'}</Text>
                      {product.status && (
                        <>
                          <Text style={styles.headerDot}>•</Text>
                          <Text
                            style={[
                              styles.headerSubtitle,
                              product.status === 'published' && styles.statusTextPublished
                            ]}
                          >
                            {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                          </Text>
                        </>
                      )}
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Pricing Section */}
        <EditablePricingSection />

        {/* Inventory Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INVENTORY</Text>
          <View style={styles.cardGlass}>
            <View style={styles.inventoryHeader}>
              <Text style={styles.rowLabel}>Total Stock</Text>
              <Text
                style={[
                  styles.inventoryTotal,
                  (product.total_stock ?? 0) === 0 && styles.stockOut,
                  (product.total_stock ?? 0) > 0 && (product.total_stock ?? 0) < 10 && styles.stockLow,
                  (product.total_stock ?? 0) >= 10 && styles.stockOk,
                ]}
              >
                {product.total_stock ?? 0}g
              </Text>
            </View>

            {/* Multi-location breakdown */}
            {hasMultipleLocations && product.inventory && (
              <View style={styles.inventoryLocationBreakdown}>
                <View style={styles.inventoryLocationDivider} />
                {product.inventory.map((inv) => (
                  <View key={inv.location_id} style={styles.inventoryLocationRow}>
                    <View style={styles.inventoryLocationInfo}>
                      <Text style={styles.inventoryLocationName}>{inv.location_name}</Text>
                      <View style={styles.locationBar}>
                        <View
                          style={[
                            styles.locationBarFill,
                            { width: `${((inv.quantity || 0) / (product.total_stock || 1)) * 100}%` }
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.locationStock}>{inv.quantity || 0}g</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        <EditableDescriptionSection />

        {/* Custom Fields */}
        <EditableCustomFieldsSection />

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
          <View style={styles.cardGlass}>
            <SettingsRow label="Adjust Inventory" onPress={() => productUIActions.openModal('adjust-inventory')} />
            <SettingsRow label="View Sales History" onPress={() => productUIActions.openModal('sales-history')} />
            {hasMultipleLocations && <SettingsRow label="Transfer Stock" />}
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <AdjustInventoryModal />
      <SalesHistoryModal />
    </>
  )
}

// ========================================
// STYLES
// ========================================
const styles = StyleSheet.create({
  detail: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.containerMargin,
    paddingVertical: layout.containerMargin,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  editButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  saveButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  headerCardContainer: {
    marginHorizontal: layout.containerMargin,
    marginTop: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.containerMargin,
    gap: layout.containerMargin,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 28,
    color: 'rgba(235,235,245,0.6)',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerTitleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  headerSubtitleInput: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.9)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerDot: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.3)',
  },
  statusTextPublished: {
    color: '#34c759',
  },
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  rowChevron: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.3)',
  },
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: layout.containerMargin,
  },
  inventoryTotal: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  inventoryLocationBreakdown: {
    paddingTop: 8,
  },
  inventoryLocationDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  inventoryLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: layout.containerMargin,
    gap: 16,
  },
  inventoryLocationInfo: {
    flex: 1,
    gap: 6,
  },
  inventoryLocationName: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.9)',
    letterSpacing: -0.1,
  },
  locationBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  locationBarFill: {
    height: '100%',
    backgroundColor: '#34c759',
    borderRadius: 2,
  },
  locationStock: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.2,
  },
  stockOut: {
    color: '#ff3b30',
  },
  stockLow: {
    color: '#ff9500',
  },
  stockOk: {
    color: '#34c759',
  },
})
