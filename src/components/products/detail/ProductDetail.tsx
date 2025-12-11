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

import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, ActivityIndicator, Alert } from 'react-native'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '@/stores/auth.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { layout } from '@/theme/layout'
import { spacing, radius, colors } from '@/theme/tokens'
import { logger } from '@/utils/logger'
import { supabase } from '@/lib/supabase/client'
import type { Product, InventoryItem } from '@/types/pos'
import { EditableDescriptionSection } from '@/components/products/EditableDescriptionSection'
import { EditablePricingSection } from '@/components/products/EditablePricingSection'
import { EditableCustomFieldsSection } from '@/components/products/EditableCustomFieldsSection'
import { EditableVariantConfigSection } from '@/components/products/EditableVariantConfigSection'
import { COASection } from '@/components/products/COASection'
import { AdjustInventoryModal } from '@/components/products/AdjustInventoryModal'
import { SalesHistoryModal } from '@/components/products/SalesHistoryModal'
import { MediaPickerModal, ImagePreviewModal, Breadcrumb } from '@/components/shared'
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
import { uploadProductImage, updateProductImage } from '@/services/media.service'
import { deleteProduct } from '@/services/products.service'
import { getThumbnailImage } from '@/utils/image-transforms'

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
  const { vendor } = useAppAuth()

  // Edit state from product-edit.store
  const isEditing = useIsEditing()
  const saving = useIsSaving()
  const storeEditedName = useEditedName()
  const storeEditedSKU = useEditedSKU()
  const originalProduct = useOriginalProduct()

  // Debug logging
  useEffect(() => {
    logger.info('[ProductDetail] State update:', {
      isEditing,
      saving,
      hasOriginalProduct: !!originalProduct,
      productId: product.id,
    })
  }, [isEditing, saving, originalProduct, product.id])

  // Modal state from product-ui.store
  const { activeModal, selectedLocationId, selectedLocationName } = useProductUIState()
  const lastAdjustmentResult = useLastAdjustmentResult()

  // FULL inventory state - fetch ALL locations for this product
  // (parent might only pass filtered inventory based on location selection)
  const [fullInventory, setFullInventory] = useState<InventoryItem[]>(product.inventory || [])
  const [fullTotalStock, setFullTotalStock] = useState<number>(product.total_stock || 0)

  // Fetch ALL inventory for this product on mount and after adjustments
  useEffect(() => {
    async function fetchFullInventory() {
      try {
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
          logger.error('[ProductDetail] Failed to fetch full inventory:', error)
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

          // Calculate true total stock across all locations
          const total = inventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0)
          setFullTotalStock(total)

          logger.debug('[ProductDetail] Loaded full inventory:', {
            productId: product.id,
            productName: product.name,
            locations: inventory.length,
            totalStock: total,
          })
        }
      } catch (err) {
        logger.error('[ProductDetail] Error fetching inventory:', err)
      }
    }

    fetchFullInventory()
  }, [product.id, lastAdjustmentResult])

  const hasMultipleLocations = fullInventory.length > 1

  // Use store values when editing, fallback to product when store not initialized
  const editedName = storeEditedName || product.name
  const editedSKU = storeEditedSKU || product.sku || ''

  // Initialize edit state synchronously on mount and product change
  const isInitialized = useRef(false)

  useEffect(() => {
    // Initialize product data without entering edit mode
    // This runs when product ID changes OR when product data is updated (after save)
    productEditActions.initializeProduct(product)
    isInitialized.current = true

    // Sync current image URL when product changes
    logger.info('[ProductDetail] Product changed, syncing image:', {
      productId: product.id,
      productName: product.name,
      featured_image: product.featured_image,
      image_url: product.image_url,
    })
    setCurrentImageUrl(product.featured_image || null)

    return () => {
      productEditActions.stopEditing()
      isInitialized.current = false
    }
  }, [product])

  // Set default location to first inventory location
  useEffect(() => {
    if (product.inventory && product.inventory.length > 0 && !selectedLocationId) {
      productUIActions.setLocation(product.inventory[0].location_id, product.inventory[0].location_name || '')
    }
  }, [product.id, selectedLocationId])

  // Watch for adjustment results and trigger parent reload
  useEffect(() => {
    if (lastAdjustmentResult) {
      logger.info('[ProductDetail] Adjustment result detected, triggering reload', {
        lastAdjustmentResult,
        productId: product.id,
      })
      onProductUpdated()
      // Clear the result after handling it
      productUIActions.setAdjustmentResult(null)
    }
  }, [lastAdjustmentResult, onProductUpdated, product.id])

  const handleSave = async () => {
    if (!user?.id) {
      logger.error('[ProductDetail] Cannot save - no user ID')
      return
    }

    if (!vendor?.id) {
      logger.error('[ProductDetail] Cannot save - no vendor ID')
      return
    }

    logger.info('[ProductDetail] handleSave called', {
      userId: user.id,
      vendorId: vendor.id,
      productId: product.id,
      productVendorId: product.vendor?.id,
    })

    await productEditActions.saveProduct(user.id, vendor.id, () => {
      logger.info('[ProductDetail] Save success callback - reloading products')
      onProductUpdated()
    })
  }

  const handleCancel = () => {
    productEditActions.cancelEdit()
  }

  // Image state
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(product.featured_image || null)

  const handleOpenImagePreview = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowImagePreview(true)
  }

  const handleChangePhoto = () => {
    setShowImagePreview(false)
    setTimeout(() => {
      setShowMediaPicker(true)
    }, 300)
  }

  const handleTakePhoto = async () => {
    if (!vendor?.id) return

    try {
      setShowImagePreview(false)

      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        logger.warn('[ProductDetail] Camera permission denied')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        await handleSelectImage(result.assets[0].uri, true)
      }
    } catch (error) {
      logger.error('[ProductDetail] Failed to take photo:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleRemovePhoto = async () => {
    if (!vendor?.id) return

    try {
      setShowImagePreview(false)
      setUploadingImage(true)

      logger.info('[ProductDetail] Removing product image')
      await updateProductImage(product.id, vendor.id, '')

      onProductUpdated()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      logger.error('[ProductDetail] Failed to remove image:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSelectImage = async (imageUri: string, isFromDevice: boolean) => {
    if (!vendor?.id) {
      logger.error('[ProductDetail] Cannot upload - no vendor ID')
      return
    }

    try {
      setUploadingImage(true)
      setShowMediaPicker(false)

      let imageUrl = imageUri

      // If from device, upload to Supabase first
      if (isFromDevice) {
        logger.info('[ProductDetail] Uploading device image to Supabase')
        const result = await uploadProductImage({
          vendorId: vendor.id,
          productId: product.id,
          uri: imageUri,
        })
        imageUrl = result.url
      }

      // Update product with image URL
      logger.info('[ProductDetail] Updating product with image URL:', imageUrl)
      await updateProductImage(product.id, vendor.id, imageUrl)

      // Update local state immediately for instant UI feedback
      setCurrentImageUrl(imageUrl)

      // Also trigger parent reload to refresh the products list
      onProductUpdated()

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      logger.error('[ProductDetail] Failed to set product image:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteProduct = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    Alert.alert(
      'Permanently Delete Product',
      `Are you sure you want to delete "${product.name}"?\n\nThis will permanently remove:\n• The product\n• All inventory records\n• Purchase order history\n• Sales order history\n• Transfer history\n\nThis action CANNOT be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          }
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            if (!vendor?.id) {
              logger.error('[ProductDetail] Cannot delete - no vendor ID')
              return
            }

            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
              logger.info('[ProductDetail] CASCADE deleting product:', product.id)

              await deleteProduct(product.id, vendor.id)

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              logger.info('[ProductDetail] Product and all related records deleted successfully')

              // Go back first
              onBack()

              // Then trigger reload
              setTimeout(() => {
                onProductUpdated()
              }, 100)
            } catch (error) {
              logger.error('[ProductDetail] Failed to delete product:', error)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

              Alert.alert(
                'Delete Failed',
                error instanceof Error ? error.message : 'Failed to delete product. Please try again.',
                [{ text: 'OK' }]
              )
            }
          }
        }
      ]
    )
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
          <Breadcrumb
            items={[
              { label: 'Products', onPress: onBack },
              { label: editedName || 'Product' },
            ]}
          />

          {isEditing ? (
            <View style={styles.editActions}>
              <Pressable onPress={handleCancel} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  logger.info('[ProductDetail] Save button pressed')
                  handleSave()
                }}
                style={styles.saveButton}
                disabled={saving}
              >
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
                logger.info('[ProductDetail] Edit button pressed - entering edit mode')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                productEditActions.startEditing(product)
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
              <Pressable onPress={handleOpenImagePreview} disabled={uploadingImage}>
                {uploadingImage ? (
                  <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : currentImageUrl ? (
                  <Image source={{ uri: getThumbnailImage(currentImageUrl) || currentImageUrl }} style={styles.headerIcon} />
                ) : (
                  <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                    <Text style={styles.headerIconText}>
                      {(isEditing && editedName ? editedName : product.name).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </Pressable>
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
        <EditablePricingSection product={product} />

        {/* Inventory Section - Uses fullInventory/fullTotalStock for accurate cross-location totals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INVENTORY</Text>
          <View style={styles.cardGlass}>
            <View style={styles.inventoryHeader}>
              <Text style={styles.rowLabel}>Total Stock</Text>
              <Text
                style={[
                  styles.inventoryTotal,
                  fullTotalStock === 0 && styles.stockOut,
                  fullTotalStock > 0 && fullTotalStock < 10 && styles.stockLow,
                  fullTotalStock >= 10 && styles.stockOk,
                ]}
              >
                {fullTotalStock}g
              </Text>
            </View>

            {/* Multi-location breakdown - always show if there's inventory at multiple locations */}
            {hasMultipleLocations && (
              <View style={styles.inventoryLocationBreakdown}>
                <View style={styles.inventoryLocationDivider} />
                {fullInventory.map((inv) => (
                  <View key={inv.location_id} style={styles.inventoryLocationRow}>
                    <View style={styles.inventoryLocationInfo}>
                      <Text style={styles.inventoryLocationName}>{inv.location_name}</Text>
                      <View style={styles.locationBar}>
                        <View
                          style={[
                            styles.locationBarFill,
                            { width: `${((inv.quantity || 0) / (fullTotalStock || 1)) * 100}%` }
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
        <EditableDescriptionSection product={product} />

        {/* Lab Results / COA */}
        <COASection product={product} onProductUpdated={onProductUpdated} />

        {/* Custom Fields */}
        <EditableCustomFieldsSection product={product} />

        {/* Variant Configuration */}
        <EditableVariantConfigSection product={product} />

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
          <View style={styles.cardGlass}>
            <SettingsRow label="Adjust Inventory" onPress={() => productUIActions.openModal('adjust-inventory')} />
            <SettingsRow label="View Sales History" onPress={() => productUIActions.openModal('sales-history')} />
            {hasMultipleLocations && <SettingsRow label="Transfer Stock" />}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <View style={styles.cardGlass}>
            <Pressable
              style={[styles.row, styles.rowLast]}
              onPress={handleDeleteProduct}
              disabled={isEditing}
            >
              <Text style={[styles.rowLabel, styles.destructiveText]}>Delete Product</Text>
              <Text style={styles.rowChevron}>􀆊</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <AdjustInventoryModal />
      <SalesHistoryModal />
      <ImagePreviewModal
        visible={showImagePreview}
        imageUrl={currentImageUrl}
        onClose={() => setShowImagePreview(false)}
        onChangePhoto={handleChangePhoto}
        onTakePhoto={handleTakePhoto}
        onRemovePhoto={handleRemovePhoto}
        loading={uploadingImage}
        productName={product.name}
      />
      <MediaPickerModal
        visible={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleSelectImage}
      />
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
  editButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  saveButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.glass.thick,
    borderWidth: 1,
    borderColor: colors.border.emphasis,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
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
    width: 100,
    height: 100,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 44,
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
  rowLast: {
    borderBottomWidth: 0,
  },
  destructiveText: {
    color: '#ff3b30',
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

  // Photo Section
  photoContainer: {
    position: 'relative',
    aspectRatio: 1,
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoOverlayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  addPhotoContainer: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  addPhotoIcon: {
    fontSize: 60,
  },
  addPhotoText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  addPhotoSubtext: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  photoLoading: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  photoLoadingText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
})
