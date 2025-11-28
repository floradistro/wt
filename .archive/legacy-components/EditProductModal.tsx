/**
 * EditProductModal - Edit product details with pricing tiers
 * Apple-quality modal with liquid glass
 */

import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import type { Product, PricingData, PricingTier } from '@/types/products'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

interface EditProductModalProps {
  visible: boolean
  product: Product | null
  onClose: () => void
  onSave: () => void
}

export function EditProductModal({ visible, product, onClose, onSave }: EditProductModalProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [pricingMode, setPricingMode] = useState<'single' | 'tiered'>('single')
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([])

  // Pricing templates from category
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  // Load product data when modal opens
  useEffect(() => {
    if (visible && product) {
      setName(product.name)
      setSku(product.sku || '')
      setDescription(product.description || '')
      setPrice(product.price?.toString() || product.regular_price?.toString() || '')
      setCostPrice(product.cost_price?.toString() || '')

      // Load pricing data
      if (product.pricing_data) {
        setPricingMode(product.pricing_data.mode)
        if (product.pricing_data.tiers) {
          setPricingTiers(product.pricing_data.tiers)
        }
        if (product.pricing_data.template_id) {
          setSelectedTemplateId(product.pricing_data.template_id)
        }
      }

      // Load pricing templates for this category
      loadPricingTemplates(product.primary_category_id)
    }
  }, [visible, product])

  const loadPricingTemplates = async (categoryId: string | null) => {
    if (!categoryId) return

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

  const handleApplyTemplate = (templateId: string) => {
    const template = availableTemplates.find(t => t.id === templateId)
    if (!template || !template.default_tiers) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Apply template tiers
    const tiers: PricingTier[] = template.default_tiers.map((tier: any, index: number) => ({
      id: tier.id || `tier_${index}`,
      label: tier.label,
      quantity: tier.quantity || tier.qty,
      unit: tier.unit || 'g',
      price: tier.default_price || tier.price || 0, // Fixed: use 'default_price' from database
      enabled: true,
      sort_order: tier.sort_order || index + 1,
    }))

    setPricingTiers(tiers)
    setPricingMode('tiered')
    setSelectedTemplateId(templateId)
  }

  const handleSave = async () => {
    if (!product || !user?.email) return

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Get user's vendor_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      // Build pricing_data
      const pricingData: PricingData = {
        mode: pricingMode,
        single_price: pricingMode === 'single' ? parseFloat(price) || null : null,
        tiers: pricingMode === 'tiered' ? pricingTiers : undefined,
        template_id: selectedTemplateId,
        updated_at: new Date().toISOString(),
      }

      // Update product
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name,
          sku,
          description,
          price: parseFloat(price) || null,
          regular_price: parseFloat(price) || null,
          cost_price: parseFloat(costPrice) || null,
          pricing_data: pricingData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .eq('vendor_id', userData.vendor_id)

      if (updateError) throw updateError

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSave()
      onClose()
    } catch (error) {
      logger.error('Failed to save product:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  if (!product) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Product</Text>
          <Pressable
            onPress={handleSave}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2 }}
        >
          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BASIC INFORMATION</Text>
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              style={[styles.cardGlass, !isLiquidGlassSupported && styles.cardGlassFallback]}
            >
              <View style={styles.card}>
                <Text style={styles.label}>Product Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Product name"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                />

                <Text style={styles.label}>SKU</Text>
                <TextInput
                  style={styles.input}
                  value={sku}
                  onChangeText={setSku}
                  placeholder="SKU-001"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Product description"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  multiline
                  numberOfLines={4}
                />
              </View>
            </LiquidGlassView>
          </View>

          {/* Pricing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRICING</Text>

            {/* Pricing Mode Toggle */}
            <View style={styles.pricingModeToggle}>
              <Pressable
                style={[styles.modeButton, pricingMode === 'single' && styles.modeButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setPricingMode('single')
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
                  setPricingMode('tiered')
                }}
              >
                <Text style={[styles.modeButtonText, pricingMode === 'tiered' && styles.modeButtonTextActive]}>
                  Tiered Pricing
                </Text>
              </Pressable>
            </View>

            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              style={[styles.cardGlass, !isLiquidGlassSupported && styles.cardGlassFallback]}
            >
              <View style={styles.card}>
                {pricingMode === 'single' ? (
                  <>
                    <Text style={styles.label}>Price</Text>
                    <TextInput
                      style={styles.input}
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0.00"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      keyboardType="decimal-pad"
                    />

                    <Text style={styles.label}>Cost Price</Text>
                    <TextInput
                      style={styles.input}
                      value={costPrice}
                      onChangeText={setCostPrice}
                      placeholder="0.00"
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      keyboardType="decimal-pad"
                    />

                    {parseFloat(price) > 0 && parseFloat(costPrice) > 0 && (
                      <View style={styles.marginRow}>
                        <Text style={styles.marginLabel}>Margin:</Text>
                        <Text style={styles.marginValue}>
                          {(((parseFloat(price) - parseFloat(costPrice)) / parseFloat(price)) * 100).toFixed(1)}%
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {availableTemplates.length > 0 && (
                      <>
                        <Text style={styles.label}>Select Pricing Template</Text>
                        {availableTemplates.map((template) => (
                          <Pressable
                            key={template.id}
                            style={[
                              styles.templateRow,
                              selectedTemplateId === template.id && styles.templateRowActive,
                            ]}
                            onPress={() => handleApplyTemplate(template.id)}
                          >
                            <View style={styles.templateInfo}>
                              <Text style={styles.templateName}>{template.name}</Text>
                              {template.description && (
                                <Text style={styles.templateDescription}>{template.description}</Text>
                              )}
                            </View>
                            {selectedTemplateId === template.id && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </Pressable>
                        ))}
                      </>
                    )}

                    {pricingTiers.length > 0 && (
                      <>
                        <View style={styles.divider} />
                        <Text style={styles.label}>Price Tiers ({pricingTiers.length})</Text>
                        {pricingTiers
                          .filter(t => t.enabled)
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((tier) => (
                            <View key={tier.id} style={styles.tierRow}>
                              <Text style={styles.tierLabel}>{tier.label}</Text>
                              <Text style={styles.tierPrice}>${tier.price.toFixed(2)}</Text>
                            </View>
                          ))}
                      </>
                    )}
                  </>
                )}
              </View>
            </LiquidGlassView>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    fontSize: 17,
    color: '#60A5FA',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#60A5FA',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
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
    borderRadius: 13,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardGlassFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  card: {
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  pricingModeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(96,165,250,0.2)',
    borderColor: '#60A5FA',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  modeButtonTextActive: {
    color: '#60A5FA',
  },
  marginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  marginLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
  },
  marginValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#34c759',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 8,
  },
  templateRowActive: {
    backgroundColor: 'rgba(96,165,250,0.15)',
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  templateInfo: {
    flex: 1,
    gap: 2,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  templateDescription: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.5)',
  },
  checkmark: {
    fontSize: 18,
    color: '#60A5FA',
    fontWeight: '700',
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tierLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.9)',
  },
  tierPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#34c759',
  },
})
