/**
 * Create Audit Modal
 * Apple-simple inventory audit creation
 * "Simplicity is the ultimate sophistication" - Leonardo da Vinci (Jobs' favorite)
 */

import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, TextInput, ScrollView, useWindowDimensions, Alert } from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import { useProducts, type Product } from '@/hooks/useProducts'
import { useUserLocations } from '@/hooks/useUserLocations'
import { useCategories } from '@/hooks/useCategories'
import { useInventoryAdjustments } from '@/hooks/useInventoryAdjustments'
import { logger } from '@/utils/logger'

interface CreateAuditModalProps {
  visible: boolean
  onClose: () => void
  onCreated: () => void
}

interface AuditEntry {
  product: Product
  currentQuantity: number
  auditedQuantity: string
  difference: number
}

export function CreateAuditModal({ visible, onClose, onCreated }: CreateAuditModalProps) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const { products } = useProducts()
  const { locations } = useUserLocations()
  const { categories } = useCategories()
  const { createAdjustment } = useInventoryAdjustments()

  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [locationSearchQuery, setLocationSearchQuery] = useState('')
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [showLocationList, setShowLocationList] = useState(false)
  const [showCategoryList, setShowCategoryList] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [auditEntries, setAuditEntries] = useState<Map<string, AuditEntry>>(new Map())
  const [auditReason, setAuditReason] = useState('')

  const modalStyle = useMemo(() => ({
    width: '95%' as const,
    maxWidth: isLandscape ? 1200 : 800,
    maxHeight: isLandscape ? height * 0.88 : height * 0.92,
  }), [isLandscape, height])

  // Filter locations
  const filteredLocations = useMemo(() => {
    if (!locationSearchQuery.trim()) return locations
    const query = locationSearchQuery.toLowerCase()
    return locations.filter(l =>
      l.location.name.toLowerCase().includes(query) ||
      l.location.city?.toLowerCase().includes(query)
    )
  }, [locations, locationSearchQuery])

  const selectedLocation = useMemo(() =>
    locations.find(l => l.location.id === selectedLocationId)?.location,
    [locations, selectedLocationId]
  )

  // Filter products by location and categories
  const filteredProducts = useMemo(() => {
    if (!selectedLocationId) return []

    let filtered = products.filter(p => {
      // Check if product has inventory at selected location
      const hasInventory = p.inventory?.some(inv => inv.location_id === selectedLocationId)
      return hasInventory
    })

    // Filter by categories if selected
    if (selectedCategoryIds.length > 0) {
      filtered = filtered.filter(p =>
        p.primary_category_id && selectedCategoryIds.includes(p.primary_category_id)
      )
    }

    // Filter by search query
    if (productSearchQuery.trim()) {
      const query = productSearchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
      )
    }

    // Sort alphabetically
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [products, selectedLocationId, selectedCategoryIds, productSearchQuery])

  // Get current quantity for a product at selected location
  const getCurrentQuantity = useCallback((product: Product) => {
    const inventory = product.inventory?.find(inv => inv.location_id === selectedLocationId)
    return inventory?.quantity || 0
  }, [selectedLocationId])

  // Handle audited quantity input
  const handleAuditEntry = useCallback((product: Product, value: string) => {
    const currentQuantity = getCurrentQuantity(product)
    const auditedQuantity = parseFloat(value) || 0
    const difference = auditedQuantity - currentQuantity

    const newEntries = new Map(auditEntries)
    if (value.trim() === '' || auditedQuantity === currentQuantity) {
      newEntries.delete(product.id)
    } else {
      newEntries.set(product.id, {
        product,
        currentQuantity,
        auditedQuantity: value,
        difference,
      })
    }
    setAuditEntries(newEntries)
  }, [auditEntries, getCurrentQuantity])

  // Toggle category selection
  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }, [])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!selectedLocationId) {
      Alert.alert('Location Required', 'Please select a location for the audit')
      return
    }

    if (auditEntries.size === 0) {
      Alert.alert('No Changes', 'Please enter audited quantities that differ from current stock')
      return
    }

    if (!auditReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for this audit')
      return
    }

    try {
      setIsSubmitting(true)

      const entries = Array.from(auditEntries.values())
      let successCount = 0
      let errorCount = 0

      // Create adjustments for each entry
      for (const entry of entries) {
        try {
          await createAdjustment({
            product_id: entry.product.id,
            location_id: selectedLocationId,
            adjustment_type: 'count_correction',
            quantity_change: entry.difference,
            reason: `Audit: ${auditReason}`,
            notes: `Audited quantity: ${entry.auditedQuantity}g (was ${entry.currentQuantity}g)`,
          })
          successCount++
        } catch (err) {
          logger.error(`Failed to create adjustment for ${entry.product.name}:`, err)
          errorCount++
        }
      }

      if (successCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert(
          'Audit Complete',
          `Successfully audited ${successCount} product${successCount > 1 ? 's' : ''}${errorCount > 0 ? `\n${errorCount} failed` : ''}`,
          [
            {
              text: 'OK',
              onPress: () => {
                onCreated()
                handleClose()
              }
            }
          ]
        )
      } else {
        throw new Error('All adjustments failed')
      }

    } catch (err) {
      logger.error('Failed to create audit:', err)
      Alert.alert('Error', 'Failed to create audit adjustments')
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedLocationId, auditEntries, auditReason, createAdjustment, onCreated])

  const handleClose = useCallback(() => {
    setSelectedLocationId('')
    setSelectedCategoryIds([])
    setLocationSearchQuery('')
    setProductSearchQuery('')
    setShowLocationList(false)
    setShowCategoryList(false)
    setAuditEntries(new Map())
    setAuditReason('')
    onClose()
  }, [onClose])

  const selectedCategoryNames = useMemo(() =>
    selectedCategoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean),
    [selectedCategoryIds, categories]
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <BlurView intensity={80} style={styles.modalOverlay} tint="dark">
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />

        <View style={[styles.modalContent, modalStyle]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>CREATE AUDIT</Text>
              <Text style={styles.modalSubtitle}>Physical inventory count</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top Section - Location, Category, Search, Reason */}
            <View style={[styles.topSection, isLandscape && styles.topSectionLandscape]}>
              {/* Left Column in Landscape */}
              <View style={[styles.topColumn, isLandscape && styles.topColumnLandscape]}>
                {/* Location Selection */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>LOCATION</Text>
                  <Pressable
                    style={styles.selector}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowLocationList(!showLocationList)
                      setShowCategoryList(false)
                    }}
                  >
                    <Text style={[styles.selectorText, !selectedLocation && styles.selectorPlaceholder]}>
                      {selectedLocation?.name || 'Select location...'}
                    </Text>
                    <Text style={styles.selectorChevron}>{showLocationList ? '▼' : '▶'}</Text>
                  </Pressable>

                  {showLocationList && (
                    <View style={styles.dropdownCard}>
                      <TextInput
                        style={styles.searchInput}
                        value={locationSearchQuery}
                        onChangeText={setLocationSearchQuery}
                        placeholder="Search locations..."
                        placeholderTextColor={colors.text.placeholder}
                        autoFocus
                      />
                      <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                        {filteredLocations.map(({ location }) => (
                          <Pressable
                            key={location.id}
                            style={[
                              styles.dropdownItem,
                              location.id === selectedLocationId && styles.dropdownItemSelected,
                            ]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                              setSelectedLocationId(location.id)
                              setShowLocationList(false)
                              setLocationSearchQuery('')
                              setAuditEntries(new Map()) // Reset entries when location changes
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{location.name}</Text>
                            {location.city && (
                              <Text style={styles.dropdownItemSubtext}>{location.city}</Text>
                            )}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Category Filter */}
                {selectedLocationId && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>
                      FILTER BY CATEGORIES {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
                    </Text>
                    <Pressable
                      style={styles.selector}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setShowCategoryList(!showCategoryList)
                        setShowLocationList(false)
                      }}
                    >
                      <Text style={[styles.selectorText, selectedCategoryIds.length === 0 && styles.selectorPlaceholder]}>
                        {selectedCategoryIds.length > 0
                          ? selectedCategoryNames.join(', ')
                          : 'All categories...'}
                      </Text>
                      <Text style={styles.selectorChevron}>{showCategoryList ? '▼' : '▶'}</Text>
                    </Pressable>

                    {showCategoryList && (
                      <View style={styles.dropdownCard}>
                        <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                          {categories.map(category => {
                            const isSelected = selectedCategoryIds.includes(category.id)
                            return (
                              <Pressable
                                key={category.id}
                                style={[
                                  styles.dropdownItem,
                                  isSelected && styles.dropdownItemSelected,
                                ]}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                  toggleCategory(category.id)
                                }}
                              >
                                <View style={styles.dropdownItemCheckbox}>
                                  {isSelected && <View style={styles.dropdownItemCheckmark} />}
                                </View>
                                <Text style={styles.dropdownItemText}>{category.name}</Text>
                              </Pressable>
                            )
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Right Column in Landscape */}
              <View style={[styles.topColumn, isLandscape && styles.topColumnLandscape]}>
                {/* Product Search */}
                {selectedLocationId && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>SEARCH PRODUCTS</Text>
                    <TextInput
                      style={styles.searchInput}
                      value={productSearchQuery}
                      onChangeText={setProductSearchQuery}
                      placeholder="Search by name or SKU..."
                      placeholderTextColor={colors.text.placeholder}
                    />
                  </View>
                )}

                {/* Audit Reason */}
                {selectedLocationId && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>AUDIT REASON</Text>
                    <TextInput
                      style={styles.textAreaInput}
                      value={auditReason}
                      onChangeText={setAuditReason}
                      placeholder="e.g., Monthly physical count, Cycle count, Spot check"
                      placeholderTextColor={colors.text.placeholder}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Products List */}
            {selectedLocationId && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  PRODUCTS AT {selectedLocation?.name?.toUpperCase()} ({filteredProducts.length})
                </Text>

                {filteredProducts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      {productSearchQuery
                        ? 'No products match your search'
                        : selectedCategoryIds.length > 0
                        ? 'No products in selected categories'
                        : 'No products at this location'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.productsCard}>
                    {filteredProducts.map((product, index) => {
                      const currentQty = getCurrentQuantity(product)
                      const entry = auditEntries.get(product.id)
                      const isModified = entry !== undefined

                      return (
                        <View key={product.id}>
                          <View style={styles.productRow}>
                            {/* Product Info */}
                            <View style={styles.productInfo}>
                              <Text style={styles.productName}>{product.name}</Text>
                              {product.sku && (
                                <Text style={styles.productSKU}>SKU: {product.sku}</Text>
                              )}
                            </View>

                            {/* Current Quantity */}
                            <View style={styles.quantitySection}>
                              <Text style={styles.quantityLabel}>Current</Text>
                              <Text style={styles.currentQuantity}>{currentQty}g</Text>
                            </View>

                            {/* Audit Input */}
                            <View style={styles.quantitySection}>
                              <Text style={styles.quantityLabel}>Audited</Text>
                              <TextInput
                                style={[
                                  styles.auditInput,
                                  isModified && styles.auditInputModified,
                                ]}
                                value={entry?.auditedQuantity || ''}
                                onChangeText={(value) => handleAuditEntry(product, value)}
                                placeholder={currentQty.toString()}
                                placeholderTextColor={colors.text.placeholder}
                                keyboardType="numeric"
                              />
                            </View>

                            {/* Difference */}
                            {isModified && (
                              <View style={styles.differenceSection}>
                                <Text
                                  style={[
                                    styles.differenceText,
                                    entry.difference > 0 && styles.differencePositive,
                                    entry.difference < 0 && styles.differenceNegative,
                                  ]}
                                >
                                  {entry.difference > 0 ? '+' : ''}{entry.difference}g
                                </Text>
                              </View>
                            )}
                          </View>

                          {index < filteredProducts.length - 1 && <View style={styles.divider} />}
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Summary */}
            {auditEntries.size > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Audit Summary</Text>
                <Text style={styles.summaryText}>
                  {auditEntries.size} product{auditEntries.size > 1 ? 's' : ''} with discrepancies
                </Text>
                {Array.from(auditEntries.values()).map(entry => (
                  <View key={entry.product.id} style={styles.summaryItem}>
                    <Text style={styles.summaryItemText}>{entry.product.name}</Text>
                    <Text
                      style={[
                        styles.summaryItemDiff,
                        entry.difference > 0 && styles.differencePositive,
                        entry.difference < 0 && styles.differenceNegative,
                      ]}
                    >
                      {entry.difference > 0 ? '+' : ''}{entry.difference}g
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                styles.submitButton,
                (isSubmitting || auditEntries.size === 0 || !selectedLocationId || !auditReason.trim()) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || auditEntries.size === 0 || !selectedLocationId || !auditReason.trim()}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <Text style={styles.submitButtonText}>
                  Complete Audit ({auditEntries.size})
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </BlurView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: 'rgba(20,20,20,0.98)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  modalTitle: {
    ...typography.title2,
    color: colors.text.primary,
    letterSpacing: 0.4,
    marginBottom: spacing.xxs,
  },
  modalSubtitle: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    ...typography.title3,
    color: colors.text.secondary,
  },
  scrollView: {
    maxHeight: 600,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  topSection: {
    // Default stacked layout
  },
  topSectionLandscape: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  topColumn: {
    flex: 1,
  },
  topColumnLandscape: {
    flex: 1,
    minWidth: 0, // Prevent flex overflow
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.uppercaseLabel,
    color: colors.text.subtle,
    marginBottom: spacing.xs,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  selectorText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  selectorPlaceholder: {
    color: colors.text.placeholder,
  },
  selectorChevron: {
    ...typography.caption1,
    color: colors.text.tertiary,
    marginLeft: spacing.sm,
  },
  searchInput: {
    ...typography.input,
    color: colors.text.primary,
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  textAreaInput: {
    ...typography.input,
    color: colors.text.primary,
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  dropdownCard: {
    backgroundColor: colors.glass.thick,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.regular,
    marginTop: spacing.xs,
    overflow: 'hidden',
    maxHeight: 300,
  },
  dropdownList: {
    maxHeight: 240,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  dropdownItemSelected: {
    backgroundColor: colors.glass.regular,
  },
  dropdownItemCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border.regular,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  dropdownItemCheckmark: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.semantic.success,
  },
  dropdownItemText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  dropdownItemSubtext: {
    ...typography.footnote,
    color: colors.text.tertiary,
    marginTop: spacing.xxxs,
  },
  productsCard: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border.regular,
    padding: spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...typography.subhead,
    color: colors.text.primary,
  },
  productSKU: {
    ...typography.caption1,
    color: colors.text.tertiary,
    marginTop: spacing.xxxs,
  },
  quantitySection: {
    alignItems: 'center',
    minWidth: 80,
  },
  quantityLabel: {
    ...typography.caption1,
    color: colors.text.subtle,
    marginBottom: spacing.xxs,
  },
  currentQuantity: {
    ...typography.subhead,
    color: colors.text.secondary,
  },
  auditInput: {
    ...typography.subhead,
    color: colors.text.primary,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 70,
    textAlign: 'center',
  },
  auditInputModified: {
    borderColor: colors.semantic.successBorder,
    backgroundColor: 'rgba(16,185,129,0.05)',
  },
  differenceSection: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  differenceText: {
    ...typography.subhead,
    fontWeight: '700',
  },
  differencePositive: {
    color: colors.semantic.success,
  },
  differenceNegative: {
    color: colors.semantic.error,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  emptyState: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyStateText: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.glass.thick,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.regular,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.subhead,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  summaryText: {
    ...typography.footnote,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xxs,
  },
  summaryItemText: {
    ...typography.caption1,
    color: colors.text.secondary,
    flex: 1,
  },
  summaryItemDiff: {
    ...typography.caption1,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.xl,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.subtle,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
  },
  cancelButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
  },
  submitButton: {
    backgroundColor: colors.semantic.success,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
})
