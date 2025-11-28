/**
 * AddProductModal Component
 *
 * STANDARD MODAL PATTERN ✅
 * Full-screen slide-up sheet for adding products (single or bulk)
 *
 * Pattern: Full-screen slide-up sheet with pill-shaped inputs
 * Reference: CategoryModal (GOLD STANDARD)
 *
 * Steve Jobs Simple:
 * - Product name (or bulk list)
 * - Category
 * - Pricing tier (from category)
 * - That's it.
 *
 * Uses atomic create_product_atomic and create_products_bulk functions
 */

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useCategories } from '@/hooks/useCategories'
import { usePricingTemplates } from '@/hooks/usePricingTemplates'
import { createProduct, createProductsBulk } from '@/services/products.service'
import type { CreateProductParams } from '@/services/products.service'
import { logger } from '@/utils/logger'
import { useAppAuth } from '@/contexts/AppAuthContext'

type CreateMode = 'single' | 'bulk'

interface AddProductModalProps {
  visible: boolean
  onClose: () => void
  onCreated?: (productId?: string) => void
  preselectedCategoryId?: string
}

/**
 * AddProductModal - Quick product creation (single or bulk)
 * Full-screen sheet - EXACT match to CategoryModal
 */
export function AddProductModal({
  visible,
  onClose,
  onCreated,
  preselectedCategoryId,
}: AddProductModalProps) {
  const insets = useSafeAreaInsets()

  // ========================================
  // HOOKS & STORES - ZERO PROP DRILLING
  // ========================================
  const { vendor } = useAppAuth()
  const vendorId = vendor?.id || ''
  const { categories } = useCategories()

  // ========================================
  // LOCAL STATE
  // ========================================
  const [mode, setMode] = useState<CreateMode>('single')
  const [productName, setProductName] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState(preselectedCategoryId || '')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCategoryList, setShowCategoryList] = useState(false)
  const [showTemplateList, setShowTemplateList] = useState(false)

  const productNameInputRef = useRef<TextInput>(null)
  const bulkInputRef = useRef<TextInput>(null)

  // Load pricing templates for selected category
  const { templates, isLoading: templatesLoading } = usePricingTemplates({
    categoryId: selectedCategoryId,
  })

  // Parse bulk input into product names
  const parsedProducts = useMemo(() => {
    if (mode !== 'bulk' || !bulkInput.trim()) return []
    return bulkInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }, [mode, bulkInput])

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setMode('single')
      setProductName('')
      setBulkInput('')
      setSelectedCategoryId(preselectedCategoryId || '')
      setSelectedTemplateId('')
      setCategorySearch('')
      setShowCategoryList(false)
      setShowTemplateList(false)
    }
  }, [visible, preselectedCategoryId])

  // Auto-select first template when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [templates, selectedTemplateId])

  // Selected category data
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  )

  // Selected template data
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  )

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories
    const query = categorySearch.toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(query))
  }, [categories, categorySearch])

  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setSelectedTemplateId('') // Reset template when category changes
    setShowCategoryList(false)
    setCategorySearch('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  // Handle template selection
  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId)
    setShowTemplateList(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const handleSave = async () => {
    // Validation
    if (mode === 'single' && !productName.trim()) {
      Alert.alert('Product Name Required', 'Please enter a product name')
      return
    }

    if (mode === 'bulk' && parsedProducts.length === 0) {
      Alert.alert('No Products', 'Please enter at least one product name (one per line)')
      return
    }

    if (!selectedCategoryId) {
      Alert.alert('Category Required', 'Please select a category')
      return
    }

    if (!selectedTemplateId) {
      Alert.alert('Pricing Template Required', 'Please select a pricing template')
      return
    }

    if (!vendorId) {
      Alert.alert('Error', 'Vendor information not found')
      return
    }

    try {
      setSaving(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      // Get pricing data from selected template
      const pricingData = selectedTemplate?.default_tiers || null

      if (mode === 'single') {
        // SINGLE PRODUCT CREATION
        const params: CreateProductParams = {
          vendor_id: vendorId,
          name: productName.trim(),
          category_id: selectedCategoryId,
          pricing_data: pricingData,
          type: 'simple',
          status: 'published',
          stock_status: 'instock',
          featured: false,
        }

        logger.info('[AddProductModal] Creating single product', {
          name: params.name,
          categoryId: params.category_id,
          templateId: selectedTemplateId,
        })

        const result = await createProduct(params)

        logger.info('[AddProductModal] Product created successfully', {
          productId: result.product_id,
          productName: result.product_name,
        })

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onCreated?.(result.product_id)
        handleClose()
      } else {
        // BULK PRODUCT CREATION
        const products = parsedProducts.map((name) => ({
          name: name.trim(),
        }))

        logger.info('[AddProductModal] Creating bulk products', {
          count: products.length,
          categoryId: selectedCategoryId,
          templateId: selectedTemplateId,
        })

        const result = await createProductsBulk({
          vendor_id: vendorId,
          products,
          category_id: selectedCategoryId,
          pricing_data: pricingData,
        })

        logger.info('[AddProductModal] Bulk products created successfully', {
          created: result.products_created,
          skipped: result.products_skipped,
        })

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Show summary
        Alert.alert(
          'Products Created',
          `${result.products_created} products created successfully${
            result.products_skipped > 0 ? `\n${result.products_skipped} skipped (duplicates)` : ''
          }`
        )

        onCreated?.()
        handleClose()
      }
    } catch (err) {
      logger.error('[AddProductModal] Failed to create product(s)', { error: err })
      const errorMessage = err instanceof Error ? err.message : 'Failed to create product(s)'
      Alert.alert('Error', errorMessage)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const canSave =
    (mode === 'single' ? productName.trim() : parsedProducts.length > 0) &&
    selectedCategoryId &&
    selectedTemplateId &&
    !saving

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* ===== HEADER ===== */}
        <View style={styles.searchContainer}>
          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeButton, mode === 'single' && styles.modeButtonActive]}
              onPress={() => {
                setMode('single')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }}
            >
              <Text style={[styles.modeButtonText, mode === 'single' && styles.modeButtonTextActive]}>
                Single
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, mode === 'bulk' && styles.modeButtonActive]}
              onPress={() => {
                setMode('bulk')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }}
            >
              <Text style={[styles.modeButtonText, mode === 'bulk' && styles.modeButtonTextActive]}>
                Bulk
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={handleClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>

        {/* ===== CONTENT ===== */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Product Name(s) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {mode === 'single' ? 'PRODUCT NAME' : 'PRODUCT NAMES (ONE PER LINE)'}
            </Text>
            {mode === 'single' ? (
              <View style={styles.inputCard}>
                <TextInput
                  ref={productNameInputRef}
                  style={styles.input}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="e.g., Blue Dream 1/8oz"
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  returnKeyType="next"
                  autoFocus
                />
              </View>
            ) : (
              <View style={styles.descriptionCard}>
                <TextInput
                  ref={bulkInputRef}
                  style={styles.bulkInput}
                  value={bulkInput}
                  onChangeText={setBulkInput}
                  placeholder={`Blue Dream 1/8oz\nBlue Dream 1/4oz\nGummy Bears 10mg\nChocolate Bar 100mg`}
                  placeholderTextColor="rgba(235,235,245,0.3)"
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  autoFocus
                />
                {parsedProducts.length > 0 && (
                  <View style={styles.bulkCounter}>
                    <Text style={styles.bulkCounterText}>{parsedProducts.length} products</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            {selectedCategory ? (
              <Pressable
                style={styles.selectedCard}
                onPress={() => {
                  setShowCategoryList(!showCategoryList)
                  setShowTemplateList(false)
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }}
              >
                <Text style={styles.selectedCardTitle}>{selectedCategory.name}</Text>
                <Text style={styles.selectedCardChevron}>{showCategoryList ? '▼' : '▶'}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.placeholderCard}
                onPress={() => {
                  setShowCategoryList(!showCategoryList)
                  setShowTemplateList(false)
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }}
              >
                <Text style={styles.placeholderText}>Select category...</Text>
                <Text style={styles.selectedCardChevron}>{showCategoryList ? '▼' : '▶'}</Text>
              </Pressable>
            )}

            {showCategoryList && (
              <View style={styles.listCard}>
                <View style={styles.searchInputWrapper}>
                  <TextInput
                    style={styles.searchInputInline}
                    value={categorySearch}
                    onChangeText={setCategorySearch}
                    placeholder="Search categories..."
                    placeholderTextColor="rgba(235,235,245,0.3)"
                    returnKeyType="search"
                  />
                </View>
                {filteredCategories.length === 0 ? (
                  <View style={styles.emptyList}>
                    <Text style={styles.emptyListText}>No categories found</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.list} nestedScrollEnabled>
                    {filteredCategories.map((category) => (
                      <Pressable
                        key={category.id}
                        style={[
                          styles.listItem,
                          selectedCategoryId === category.id && styles.listItemSelected,
                        ]}
                        onPress={() => handleCategorySelect(category.id)}
                      >
                        <Text style={styles.listItemText}>{category.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Pricing Template Selection */}
          {selectedCategoryId && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PRICING TEMPLATE</Text>
              {templatesLoading ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator color="rgba(235,235,245,0.6)" />
                  <Text style={styles.loadingText}>Loading templates...</Text>
                </View>
              ) : selectedTemplate ? (
                <Pressable
                  style={styles.selectedCard}
                  onPress={() => {
                    setShowTemplateList(!showTemplateList)
                    setShowCategoryList(false)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                >
                  <Text style={styles.selectedCardTitle}>{selectedTemplate.name}</Text>
                  <Text style={styles.selectedCardChevron}>{showTemplateList ? '▼' : '▶'}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.placeholderCard}
                  onPress={() => {
                    setShowTemplateList(!showTemplateList)
                    setShowCategoryList(false)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                >
                  <Text style={styles.placeholderText}>Select template...</Text>
                  <Text style={styles.selectedCardChevron}>{showTemplateList ? '▼' : '▶'}</Text>
                </Pressable>
              )}

              {showTemplateList && templates.length > 0 && (
                <View style={styles.listCard}>
                  <ScrollView style={styles.list} nestedScrollEnabled>
                    {templates.map((template) => (
                      <Pressable
                        key={template.id}
                        style={[
                          styles.listItem,
                          selectedTemplateId === template.id && styles.listItemSelected,
                        ]}
                        onPress={() => handleTemplateSelect(template.id)}
                      >
                        <Text style={styles.listItemText}>{template.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* ===== ACTION BUTTON ===== */}
          <Pressable
            onPress={handleSave}
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            disabled={!canSave}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {mode === 'single'
                  ? '+ CREATE PRODUCT'
                  : `+ CREATE ${parsedProducts.length} PRODUCTS`}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  modeToggle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 24,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.3,
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  doneButton: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.08,
    marginBottom: 12,
    marginLeft: 4,
  },
  inputCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  input: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
    minHeight: 24,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  selectedCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  selectedCardChevron: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    marginLeft: 12,
  },
  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
  },
  placeholderText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.3)',
    letterSpacing: -0.3,
  },
  listCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    marginTop: 8,
    maxHeight: 300,
    overflow: 'hidden',
  },
  list: {
    maxHeight: 300,
  },
  listItem: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  listItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  listItemText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.3,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: -0.2,
  },
  loadingCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  descriptionCard: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 20,
    padding: 16,
    position: 'relative',
  },
  bulkInput: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.2,
    minHeight: 200,
    maxHeight: 400,
  },
  bulkCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  bulkCounterText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(16,185,129,1)',
    letterSpacing: -0.1,
  },
  saveButton: {
    marginTop: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  searchInputWrapper: {
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  searchInputInline: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
  },
})
