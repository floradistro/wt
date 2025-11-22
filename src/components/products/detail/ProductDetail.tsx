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

import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'
import { layout } from '@/theme/layout'
import { spacing, radius } from '@/theme/tokens'
import type { Product, PricingTier } from '@/hooks/useProducts'
import { EditableDescriptionSection } from '@/components/products/EditableDescriptionSection'
import { EditablePricingSection } from '@/components/products/EditablePricingSection'
import { EditableCustomFieldsSection } from '@/components/products/EditableCustomFieldsSection'
import { AdjustInventoryModal } from '@/components/products/AdjustInventoryModal'
import { SalesHistoryModal } from '@/components/products/SalesHistoryModal'

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
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()

  // Modal state
  const [showAdjustInventoryModal, setShowAdjustInventoryModal] = useState(false)
  const [showSalesHistoryModal, setShowSalesHistoryModal] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>()
  const [selectedLocationName, setSelectedLocationName] = useState<string | undefined>()

  // Edit state
  const [editedName, setEditedName] = useState(product.name)
  const [editedSKU, setEditedSKU] = useState(product.sku || '')
  const [editedDescription, setEditedDescription] = useState(product.description || '')
  const [editedPrice, setEditedPrice] = useState(product.price?.toString() || product.regular_price?.toString() || '')
  const [editedCostPrice, setEditedCostPrice] = useState(product.cost_price?.toString() || '')
  const [pricingMode, setPricingMode] = useState<'single' | 'tiered'>(product.pricing_data?.mode || 'single')
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(product.pricing_data?.tiers || [])
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(product.pricing_data?.template_id || null)
  const [editedCustomFields, setEditedCustomFields] = useState<Record<string, any>>(product.custom_fields || {})

  const hasMultipleLocations = (product.inventory?.length || 0) > 1

  // Set default location to first inventory location
  useEffect(() => {
    if (product.inventory && product.inventory.length > 0 && !selectedLocationId) {
      setSelectedLocationId(product.inventory[0].location_id)
      setSelectedLocationName(product.inventory[0].location_name)
    }
  }, [product.id])

  // Load pricing templates when entering edit mode
  useEffect(() => {
    if (isEditing && product.primary_category_id) {
      loadPricingTemplates(product.primary_category_id)
    }
  }, [isEditing, product.primary_category_id])

  const loadPricingTemplates = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('pricing_tier_templates')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setAvailableTemplates(data || [])
    } catch (error) {
      logger.error('Failed to load pricing templates:', error)
    }
  }

  const handleSave = async () => {
    if (!user?.email) return

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      const pricingData = {
        mode: pricingMode,
        single_price: pricingMode === 'single' ? parseFloat(editedPrice) || null : null,
        tiers: pricingMode === 'tiered' ? pricingTiers : undefined,
        template_id: selectedTemplateId,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: editedName,
          sku: editedSKU,
          description: editedDescription,
          cost_price: parseFloat(editedCostPrice) || null,
          pricing_data: pricingData,
          custom_fields: editedCustomFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .eq('vendor_id', userData.vendor_id)

      if (updateError) throw updateError

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setIsEditing(false)
      onProductUpdated()
    } catch (error) {
      logger.error('Failed to save product:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: JSON.stringify(error, null, 2)
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditedName(product.name)
    setEditedSKU(product.sku || '')
    setEditedDescription(product.description || '')
    setEditedPrice(product.price?.toString() || product.regular_price?.toString() || '')
    setEditedCostPrice(product.cost_price?.toString() || '')
    setPricingMode(product.pricing_data?.mode || 'single')
    setPricingTiers(product.pricing_data?.tiers || [])
    setSelectedTemplateId(product.pricing_data?.template_id || null)
    setEditedCustomFields(product.custom_fields || {})
    setIsEditing(false)
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
                setIsEditing(true)
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
                    {(isEditing ? editedName : product.name).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                {isEditing ? (
                  <>
                    <TextInput
                      style={styles.headerTitleInput}
                      value={editedName}
                      onChangeText={setEditedName}
                      placeholder="Product name"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                    />
                    <TextInput
                      style={styles.headerSubtitleInput}
                      value={editedSKU}
                      onChangeText={setEditedSKU}
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
        <EditablePricingSection
          price={product.price}
          costPrice={product.cost_price}
          salePrice={product.sale_price}
          onSale={product.on_sale}
          pricingMode={pricingMode}
          pricingTiers={pricingTiers}
          templateId={selectedTemplateId}
          isEditing={isEditing}
          editedPrice={editedPrice}
          editedCostPrice={editedCostPrice}
          onPriceChange={setEditedPrice}
          onCostPriceChange={setEditedCostPrice}
          onPricingModeChange={setPricingMode}
          onTiersChange={setPricingTiers}
          onTemplateChange={setSelectedTemplateId}
          categoryId={product.primary_category_id}
          availableTemplates={availableTemplates}
          loadTemplates={loadPricingTemplates}
        />

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
        <EditableDescriptionSection
          description={product.description}
          editedDescription={editedDescription}
          isEditing={isEditing}
          onChangeText={setEditedDescription}
        />

        {/* Custom Fields */}
        <EditableCustomFieldsSection
          customFields={product.custom_fields}
          editedCustomFields={editedCustomFields}
          isEditing={isEditing}
          onCustomFieldsChange={setEditedCustomFields}
        />

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
          <View style={styles.cardGlass}>
            <SettingsRow
              label="Adjust Inventory"
              onPress={() => setShowAdjustInventoryModal(true)}
            />
            <SettingsRow
              label="View Sales History"
              onPress={() => setShowSalesHistoryModal(true)}
            />
            {hasMultipleLocations && <SettingsRow label="Transfer Stock" />}
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <AdjustInventoryModal
        visible={showAdjustInventoryModal}
        product={product}
        locationId={selectedLocationId}
        locationName={selectedLocationName}
        onClose={() => setShowAdjustInventoryModal(false)}
        onAdjusted={(result) => {
          onProductUpdated()
          setShowAdjustInventoryModal(false)
        }}
        onLocationChange={(locId, locName) => {
          setSelectedLocationId(locId)
          setSelectedLocationName(locName)
        }}
      />
      <SalesHistoryModal
        visible={showSalesHistoryModal}
        product={product}
        onClose={() => setShowSalesHistoryModal(false)}
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
    paddingHorizontal: layout.contentHorizontal,
    paddingVertical: layout.cardPadding,
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
    marginHorizontal: layout.contentHorizontal,
    marginTop: layout.sectionSpacing,
    marginBottom: layout.sectionSpacing,
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
    padding: layout.cardPadding,
    gap: layout.cardPadding,
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
    marginHorizontal: layout.contentHorizontal,
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.cardPadding,
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
    paddingHorizontal: layout.rowPaddingHorizontal,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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
