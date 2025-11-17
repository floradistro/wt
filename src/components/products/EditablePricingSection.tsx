/**
 * Editable Pricing Section
 * Handles both single and tiered pricing with template selection
 * Allows product-specific pricing overrides
 */

import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native'
import { useState, useEffect } from 'react'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import type { PricingTier } from '@/hooks/useProducts'
import { spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'

interface EditablePricingSectionProps {
  // Product data
  price: number | null
  costPrice: number | null
  salePrice: number | null
  onSale: boolean
  pricingMode: 'single' | 'tiered'
  pricingTiers: PricingTier[]
  templateId: string | null

  // Edit state
  isEditing: boolean
  editedPrice: string
  editedCostPrice: string
  onPriceChange: (price: string) => void
  onCostPriceChange: (price: string) => void
  onPricingModeChange: (mode: 'single' | 'tiered') => void
  onTiersChange: (tiers: PricingTier[]) => void
  onTemplateChange: (templateId: string) => void

  // Templates
  categoryId: string | null
  availableTemplates: any[]
  loadTemplates: (categoryId: string) => Promise<void>
}

export function EditablePricingSection({
  price,
  costPrice,
  salePrice,
  onSale,
  pricingMode,
  pricingTiers,
  templateId,
  isEditing,
  editedPrice,
  editedCostPrice,
  onPriceChange,
  onCostPriceChange,
  onPricingModeChange,
  onTiersChange,
  onTemplateChange,
  categoryId,
  availableTemplates,
  loadTemplates,
}: EditablePricingSectionProps) {
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  useEffect(() => {
    if (isEditing && categoryId && availableTemplates.length === 0) {
      setLoadingTemplates(true)
      loadTemplates(categoryId).finally(() => setLoadingTemplates(false))
    }
  }, [isEditing, categoryId])

  const displayPrice = price || 0
  const displayCostPrice = costPrice || 0
  const margin = displayCostPrice > 0 && displayPrice > 0
    ? (((displayPrice - displayCostPrice) / displayPrice) * 100).toFixed(1)
    : null

  const handleAddCustomTier = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const newTier: PricingTier = {
      id: `custom_${Date.now()}`,
      label: '',
      quantity: 1,
      unit: 'g',
      price: 0,
      enabled: true,
      sort_order: pricingTiers.length + 1,
    }
    onTiersChange([...pricingTiers, newTier])
  }

  const handleRemoveTier = (tierId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onTiersChange(pricingTiers.filter(t => t.id !== tierId))
  }

  const handleUpdateTier = (tierId: string, updates: Partial<PricingTier>) => {
    onTiersChange(
      pricingTiers.map(t => t.id === tierId ? { ...t, ...updates } : t)
    )
  }

  const handleApplyTemplate = (selectedTemplateId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const template = availableTemplates.find(t => t.id === selectedTemplateId)
    if (!template || !template.default_tiers) return

    const tiers = template.default_tiers.map((tier: any, index: number) => ({
      id: tier.id || `tier_${index}`,
      label: tier.label,
      quantity: tier.quantity || tier.qty,
      unit: tier.unit || 'g',
      price: tier.price || 0,
      enabled: true,
      sort_order: tier.sort_order || index + 1,
    }))

    onTiersChange(tiers)
    onPricingModeChange('tiered')
    onTemplateChange(selectedTemplateId)
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PRICING</Text>
      <LiquidGlassContainerView spacing={12}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.cardGlass, !isLiquidGlassSupported && styles.cardGlassFallback]}
        >
        {isEditing ? (
          <>
            {/* Pricing Mode Toggle */}
            <View style={styles.modeToggleRow}>
              <Pressable
                style={[styles.modeButton, pricingMode === 'single' && styles.modeButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onPricingModeChange('single')
                }}
              >
                <Text style={[styles.modeButtonText, pricingMode === 'single' && styles.modeButtonTextActive]}>
                  Single Price
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, pricingMode === 'tiered' && styles.modeButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onPricingModeChange('tiered')
                }}
              >
                <Text style={[styles.modeButtonText, pricingMode === 'tiered' && styles.modeButtonTextActive]}>
                  Tiered
                </Text>
              </Pressable>
            </View>

            {pricingMode === 'single' ? (
              <>
                <View style={styles.priceInputRow}>
                  <Text style={styles.inputLabel}>Price</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={editedPrice}
                      onChangeText={onPriceChange}
                      placeholder="0.00"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={styles.priceInputRow}>
                  <Text style={styles.inputLabel}>Cost</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={editedCostPrice}
                      onChangeText={onCostPriceChange}
                      placeholder="0.00"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Template Selector */}
                {loadingTemplates ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="rgba(235,235,245,0.6)" />
                  </View>
                ) : availableTemplates.length > 0 ? (
                  <View style={styles.templateRow}>
                    <Text style={styles.templateRowLabel}>Template</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateList}>
                      {availableTemplates.map(template => (
                        <Pressable
                          key={template.id}
                          style={[
                            styles.templateChip,
                            templateId === template.id && styles.templateChipActive
                          ]}
                          onPress={() => handleApplyTemplate(template.id)}
                        >
                          <Text style={[
                            styles.templateChipText,
                            templateId === template.id && styles.templateChipTextActive
                          ]}>
                            {template.name}
                          </Text>
                          {templateId === template.id && (
                            <Text style={styles.templateCheckmark}>✓</Text>
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Tier Editor */}
                {pricingTiers.map((tier, index) => (
                  <View key={tier.id} style={styles.tierEditRow}>
                    <View style={styles.tierEditHeader}>
                      <Text style={styles.tierEditTitle}>Tier {index + 1}</Text>
                      {pricingTiers.length > 1 && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                            handleRemoveTier(tier.id)
                          }}
                          style={styles.removeTierButton}
                        >
                          <Text style={styles.removeTierText}>✕</Text>
                        </Pressable>
                      )}
                    </View>
                    <TextInput
                      style={styles.tierLabelInput}
                      value={tier.label}
                      onChangeText={(text) => handleUpdateTier(tier.id, { label: text })}
                      placeholder="Label (e.g., 1 gram)"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                    />
                    <View style={styles.tierNumberRow}>
                      <TextInput
                        style={styles.tierSmallInput}
                        value={tier.quantity.toString()}
                        onChangeText={(text) => handleUpdateTier(tier.id, { quantity: parseFloat(text) || 0 })}
                        placeholder="Qty"
                        placeholderTextColor="rgba(235,235,245,0.3)"
                        keyboardType="decimal-pad"
                      />
                      <TextInput
                        style={styles.tierSmallInput}
                        value={tier.unit}
                        onChangeText={(text) => handleUpdateTier(tier.id, { unit: text })}
                        placeholder="Unit"
                        placeholderTextColor="rgba(235,235,245,0.3)"
                      />
                      <View style={styles.tierPriceWrapper}>
                        <Text style={styles.dollarSign}>$</Text>
                        <TextInput
                          style={styles.tierPriceInput}
                          value={tier.price.toString()}
                          onChangeText={(text) => handleUpdateTier(tier.id, { price: parseFloat(text) || 0 })}
                          placeholder="0.00"
                          placeholderTextColor="rgba(235,235,245,0.3)"
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  </View>
                ))}

                {/* Add Tier Button */}
                <Pressable style={styles.addTierRow} onPress={handleAddCustomTier}>
                  <Text style={styles.addTierText}>+ Add Custom Tier</Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            {/* View Mode */}
            {pricingMode === 'tiered' && pricingTiers.length > 0 ? (
              <>
                <View style={styles.pricingModeHeader}>
                  <Text style={styles.rowLabel}>Tiered Pricing</Text>
                  <Text style={styles.tierCount}>{pricingTiers.filter(t => t.enabled).length} tiers</Text>
                </View>
                <View style={styles.tiersContainer}>
                  {pricingTiers
                    .filter(tier => tier.enabled)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((tier) => (
                      <View key={tier.id} style={styles.tierRow}>
                        <View style={styles.tierInfo}>
                          <Text style={styles.tierWeight}>{tier.label}</Text>
                          <Text style={styles.tierQty}>{tier.quantity} {tier.unit} minimum</Text>
                        </View>
                        <Text style={styles.tierPrice}>${tier.price.toFixed(2)}</Text>
                      </View>
                    ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Price</Text>
                  <Text style={styles.rowValue}>${displayPrice.toFixed(2)}</Text>
                </View>
                {displayCostPrice > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Cost</Text>
                    <Text style={styles.rowValue}>${displayCostPrice.toFixed(2)}</Text>
                  </View>
                )}
                {margin && (
                  <View style={[styles.row, !onSale && styles.rowLast]}>
                    <Text style={styles.rowLabel}>Margin</Text>
                    <Text style={styles.rowValue}>{margin}%</Text>
                  </View>
                )}
                {onSale && salePrice && (
                  <View style={[styles.row, styles.rowLast]}>
                    <Text style={styles.rowLabel}>Sale Price</Text>
                    <Text style={styles.rowValue}>${salePrice.toFixed(2)}</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
        </LiquidGlassView>
      </LiquidGlassContainerView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: spacing.sm, // Consistent 12px spacing everywhere
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardGlassFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Mode Toggle
  modeToggleRow: {
    flexDirection: 'row',
    paddingHorizontal: layout.rowPaddingHorizontal,
    paddingVertical: 10,
    gap: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 7,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
  },
  modeButtonTextActive: {
    color: '#fff',
  },

  // Single Price Inputs
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  inputLabel: {
    fontSize: 17,
    color: '#fff',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dollarSign: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.6)',
    marginRight: 4,
  },
  priceInput: {
    fontSize: 17,
    color: '#fff',
    textAlign: 'right',
    minWidth: 80,
  },

  // Template Row
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  templateRow: {
    paddingVertical: 12,
    paddingHorizontal: layout.rowPaddingHorizontal,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  templateRowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  templateList: {
    flexDirection: 'row',
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  templateChipActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  templateChipText: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.7)',
    fontWeight: '500',
  },
  templateChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  templateCheckmark: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },

  // Tier Edit Row
  tierEditRow: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tierEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tierEditTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(235,235,245,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  removeTierButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,69,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTierText: {
    fontSize: 15,
    color: '#ff453a',
    fontWeight: '600',
  },
  tierLabelInput: {
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  tierNumberRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tierSmallInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    textAlign: 'center',
  },
  tierPriceWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tierPriceInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    textAlign: 'right',
  },

  // Add Tier Button
  addTierRow: {
    paddingVertical: 14,
    paddingHorizontal: layout.rowPaddingHorizontal,
    alignItems: 'center',
  },
  addTierText: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '500',
  },
  pricingModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontSize: 17,
    color: '#fff',
  },
  tierCount: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  tiersContainer: {
    paddingHorizontal: layout.rowPaddingHorizontal,
    paddingBottom: 6,
    gap: 8,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  tierInfo: {
    flex: 1,
  },
  tierWeight: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  tierQty: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    marginTop: 2,
  },
  tierPrice: {
    fontSize: 17,
    fontWeight: '600',
    color: '#60A5FA',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
})
