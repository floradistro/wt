/**
 * Create Product Modal
 * Built with inline selectors
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, TextInput, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useCategories } from '@/hooks/useCategories'
import { usePricingTemplates } from '@/hooks/usePricingTemplates'

interface CreateProductModalProps {
  visible: boolean
  vendorId: string
  categoryId?: string
  onClose: () => void
  onCreated: (productId: string) => void
}

export function CreateProductModal({
  visible,
  vendorId,
  categoryId,
  onClose,
  onCreated,
}: CreateProductModalProps) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  const [name, setName] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || '')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [showCategoryList, setShowCategoryList] = useState(false)
  const [showTemplateList, setShowTemplateList] = useState(false)
  const [categorySearchQuery, setCategorySearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameInputRef = useRef<TextInput>(null)

  const modalStyle = useMemo(() => ({
    width: isLandscape ? '60%' : '90%',
    maxWidth: isLandscape ? 700 : 600,
    maxHeight: isLandscape ? height * 0.85 : height * 0.85,
  }), [isLandscape, height])

  const scrollContentStyle = useMemo(() => ({
    maxHeight: isLandscape ? height * 0.6 : height * 0.65,
  }), [isLandscape, height])

  const { categories } = useCategories()
  const { templates, isLoading: templatesLoading } = usePricingTemplates({ categoryId: selectedCategoryId })

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  )

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  )

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories
    const query = categorySearchQuery.toLowerCase()
    return categories.filter(c =>
      c.name.toLowerCase().includes(query)
    )
  }, [categories, categorySearchQuery])

  useEffect(() => {
    if (visible && selectedCategoryId) {
      setSelectedTemplateId('')
    }
  }, [selectedCategoryId, visible])

  useEffect(() => {
    if (visible) {
      setName('')
      setSelectedCategoryId(categoryId || '')
      setSelectedTemplateId('')
      setCategorySearchQuery('')
      setShowCategoryList(false)
      setShowTemplateList(false)
      setError(null)
    }
  }, [visible, categoryId])

  const handleCategorySelect = (catId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCategoryId(catId)
    setShowCategoryList(false)
    setCategorySearchQuery('')
    setError(null)
  }

  const handleTemplateSelect = (templateId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedTemplateId(templateId)
    setShowTemplateList(false)
    setError(null)
  }

  async function handleSubmit() {
    try {
      setError(null)
      if (!name.trim() || !selectedCategoryId || !selectedTemplateId) {
        setError('Please fill all fields')
        return
      }
      setIsSubmitting(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      const template = templates.find(t => t.id === selectedTemplateId)
      if (!template) throw new Error('Template not found')

      const pricingData = {
        mode: 'tiered' as const,
        tiers: template.default_tiers.map(tier => ({
          id: tier.id,
          label: tier.label,
          quantity: tier.qty,
          unit: tier.unit,
          price: tier.price || 0,
          enabled: true,
          sort_order: tier.sort_order,
        })),
        template_id: template.id,
        template_name: template.name,
        updated_at: new Date().toISOString(),
      }

      const { data, error: insertError } = await supabase
        .from('products')
        .insert({
          vendor_id: vendorId,
          name: name.trim(),
          slug,
          type: 'simple',
          status: 'published',
          primary_category_id: selectedCategoryId,
          pricing_data: pricingData,
          stock_status: 'instock',
          featured: false,
        })
        .select()
        .single()

      if (insertError) throw insertError
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onCreated(data.id)
      onClose()
    } catch (err) {
      logger.error('Failed to create product', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to create product')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = name.trim().length > 0 && selectedCategoryId.length > 0 && selectedTemplateId.length > 0 && !isSubmitting

  if (!visible) return null

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <BlurView intensity={40} style={styles.modalOverlay} tint="dark">
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalContainer, modalStyle]}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.modalContent, !isLiquidGlassSupported && styles.modalContentFallback]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Product</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              style={[styles.modalScroll, scrollContentStyle]}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Product Name */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>PRODUCT NAME *</Text>
                <TextInput
                  ref={nameInputRef}
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter product name"
                  placeholderTextColor={colors.text.quaternary}
                  autoFocus
                />
              </View>

              {/* Category Selector */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>CATEGORY *</Text>
                <Pressable
                  style={styles.selectorButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setShowCategoryList(!showCategoryList)
                    setShowTemplateList(false)
                  }}
                >
                  <View style={styles.selectorContent}>
                    <Text style={styles.selectorLabel}>Category</Text>
                    <Text style={selectedCategory ? styles.selectorValue : styles.selectorPlaceholder}>
                      {selectedCategory ? selectedCategory.name : 'Select category...'}
                    </Text>
                  </View>
                  <Text style={[styles.selectorArrow, showCategoryList && styles.selectorArrowExpanded]}>›</Text>
                </Pressable>

                {showCategoryList && (
                  <View style={styles.selectorList}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search categories..."
                      placeholderTextColor="rgba(235,235,245,0.3)"
                      value={categorySearchQuery}
                      onChangeText={setCategorySearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <ScrollView style={styles.selectorScroll} showsVerticalScrollIndicator={false}>
                      {filteredCategories.map((category, index) => (
                        <Pressable
                          key={category.id}
                          style={[
                            styles.selectorItem,
                            index === filteredCategories.length - 1 && styles.selectorItemLast,
                            selectedCategoryId === category.id && styles.selectorItemSelected,
                          ]}
                          onPress={() => handleCategorySelect(category.id)}
                        >
                          <Text style={styles.selectorItemText}>{category.name}</Text>
                          {selectedCategoryId === category.id && <Text style={styles.checkmark}>✓</Text>}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Pricing Template Selector */}
              {selectedCategoryId && (
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>PRICING TIER *</Text>
                  <Pressable
                    style={styles.selectorButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setShowTemplateList(!showTemplateList)
                      setShowCategoryList(false)
                    }}
                  >
                    <View style={styles.selectorContent}>
                      <Text style={styles.selectorLabel}>Pricing Tier Template</Text>
                      {selectedTemplate ? (
                        <View>
                          <Text style={styles.selectorValue}>{selectedTemplate.name}</Text>
                          {selectedTemplate.description && (
                            <Text style={styles.selectorSubtext}>{selectedTemplate.description}</Text>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.selectorPlaceholder}>Select pricing tier...</Text>
                      )}
                    </View>
                    <Text style={[styles.selectorArrow, showTemplateList && styles.selectorArrowExpanded]}>›</Text>
                  </Pressable>

                  {showTemplateList && (
                    <View style={styles.selectorList}>
                      {templatesLoading ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color={colors.text.secondary} />
                          <Text style={styles.loadingText}>Loading templates...</Text>
                        </View>
                      ) : templates.length === 0 ? (
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>No pricing templates found for this category</Text>
                          <Text style={styles.emptySubtext}>Create a template in settings first</Text>
                        </View>
                      ) : (
                        <ScrollView style={styles.selectorScroll} showsVerticalScrollIndicator={false}>
                          {templates.map((template, index) => (
                            <Pressable
                              key={template.id}
                              style={[
                                styles.selectorItem,
                                index === templates.length - 1 && styles.selectorItemLast,
                                selectedTemplateId === template.id && styles.selectorItemSelected,
                              ]}
                              onPress={() => handleTemplateSelect(template.id)}
                            >
                              <View style={styles.selectorItemContent}>
                                <Text style={styles.selectorItemText}>{template.name}</Text>
                                {template.description && (
                                  <Text style={styles.selectorItemSubtext}>{template.description}</Text>
                                )}
                              </View>
                              {selectedTemplateId === template.id && <Text style={styles.checkmark}>✓</Text>}
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </View>
              )}

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={onClose}
                disabled={isSubmitting}
                style={[styles.button, styles.buttonSecondary]}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={[styles.button, styles.buttonPrimary]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Create Product</Text>
                )}
              </Pressable>
            </View>
          </LiquidGlassView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {},
  modalContent: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalContentFallback: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.text.primary,
    marginTop: -4,
  },
  modalScroll: {},
  modalScrollContent: {
    padding: spacing.lg,
  },
  formField: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  searchInput: {
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: spacing.xs,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorContent: {
    flex: 1,
    gap: 4,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  selectorValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  selectorPlaceholder: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.2,
  },
  selectorSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  selectorArrow: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.quaternary,
    marginLeft: 12,
    transform: [{ rotate: '0deg' }],
  },
  selectorArrowExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  selectorList: {
    marginTop: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.sm,
  },
  selectorScroll: {
    maxHeight: 200,
  },
  selectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: 44,
  },
  selectorItemLast: {
    borderBottomWidth: 0,
  },
  selectorItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
  },
  selectorItemContent: {
    flex: 1,
    gap: 2,
  },
  selectorItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  selectorItemSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginLeft: 12,
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#f87171',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
})
