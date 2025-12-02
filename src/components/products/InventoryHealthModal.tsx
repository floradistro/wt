/**
 * InventoryHealthModal - Monochrome inventory data quality dashboard
 *
 * Features:
 * - Health score per product (filled fields / total fields)
 * - Search and category filtering
 * - COA auto-matching and linking
 * - AI-powered COA parsing to fill fields
 * - Batch operations with selection
 * - Clean monochrome design
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Modal,
  Animated,
  TextInput,
  ScrollView,
  Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { getIconImage } from '@/utils/image-transforms'
import type { Product } from '@/types/products'
import {
  getCOAsForVendor,
  linkCOAToProduct,
  parseCOAAndFillProduct,
  type COA,
  type FieldComparison,
} from '@/services/coa.service'

// ============================================================================
// Types
// ============================================================================

interface InventoryHealthModalProps {
  visible: boolean
  onClose: () => void
  products: Product[]
  onProductsUpdated?: () => void
}

interface CategoryField {
  field_id: string
  label: string
  type: string
}

interface ProductFieldInfo {
  field_id: string
  label: string
  value: string | null
  isEmpty: boolean
  section: 'core' | 'custom'
}

interface ProductHealth {
  product: Product
  healthScore: number
  filledCount: number
  totalCount: number
  fields: ProductFieldInfo[]
  linkedCOA: COA | null
  matchedCOA: COA | null
  canAutofill: boolean
  categoryName: string | null
}

type FilterMode = 'all' | 'incomplete' | 'complete' | 'actionable'

interface AuditResult {
  productId: string
  success: boolean
  fieldsFilled: number
  comparisons: FieldComparison[]
}

interface CategoryInfo {
  id: string
  name: string
  count: number
}

const CONCURRENT_LIMIT = 5

// ============================================================================
// Component
// ============================================================================

export function InventoryHealthModal({
  visible,
  onClose,
  products,
  onProductsUpdated,
}: InventoryHealthModalProps) {
  const insets = useSafeAreaInsets()
  const { vendor } = useAppAuth()
  const progressAnim = useRef(new Animated.Value(0)).current

  // State
  const [loading, setLoading] = useState(false)
  const [vendorCOAs, setVendorCOAs] = useState<COA[]>([])
  const [categoryFieldsMap, setCategoryFieldsMap] = useState<Map<string, CategoryField[]>>(new Map())
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map())
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [isRunningBatch, setIsRunningBatch] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [batchResults, setBatchResults] = useState<AuditResult[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  // ============================================================================
  // Data Loading
  // ============================================================================

  useEffect(() => {
    if (visible && vendor?.id) {
      loadData()
    }
  }, [visible, vendor?.id, refreshKey])

  const loadData = async () => {
    if (!vendor?.id) return
    setLoading(true)
    try {
      // Load COAs
      const allCOAs = await getCOAsForVendor(vendor.id)
      setVendorCOAs(allCOAs)

      // Load categories
      const categoryIds = [...new Set(products.map(p => p.primary_category_id).filter(Boolean))]
      if (categoryIds.length > 0) {
        // Get category names
        const { data: categories } = await supabase
          .from('categories')
          .select('id, name')
          .in('id', categoryIds)

        const namesMap = new Map<string, string>()
        categories?.forEach((c: any) => namesMap.set(c.id, c.name))
        setCategoryNames(namesMap)

        // Get field definitions
        const { data: fieldDefs } = await supabase
          .from('vendor_product_fields')
          .select('category_id, field_id, field_definition')
          .eq('vendor_id', vendor.id)
          .in('category_id', categoryIds)
          .order('sort_order', { ascending: true })

        const fieldsMap = new Map<string, CategoryField[]>()
        fieldDefs?.forEach((f: any) => {
          const catId = f.category_id
          if (!fieldsMap.has(catId)) fieldsMap.set(catId, [])
          fieldsMap.get(catId)!.push({
            field_id: f.field_id,
            label: f.field_definition?.label || f.field_id,
            type: f.field_definition?.type || 'text',
          })
        })
        setCategoryFieldsMap(fieldsMap)
      }
    } catch (error) {
      logger.error('[InventoryHealth] Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // COA Matching
  // ============================================================================

  const isPDFCOA = useCallback((coa: COA): boolean => {
    const url = coa.file_url?.split('?')[0] || ''
    return url.toLowerCase().endsWith('.pdf')
  }, [])

  const findMatchingCOA = useCallback((productName: string): COA | null => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
    const normalizedProduct = normalize(productName)

    const unlinked = vendorCOAs.filter(c => !c.product_id)
    for (const coa of unlinked) {
      const fileName = (coa.file_name || '').split('/').pop() || ''
      const baseName = fileName.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '')
      const normalizedCOA = normalize(baseName)

      if (normalizedProduct === normalizedCOA) return coa
      if (normalizedCOA.includes(normalizedProduct) || normalizedProduct.includes(normalizedCOA)) {
        return coa
      }
    }
    return null
  }, [vendorCOAs])

  // ============================================================================
  // Product Health Calculation
  // ============================================================================

  const getCoreFields = useCallback((product: Product, catName: string | null): ProductFieldInfo[] => {
    const checkField = (id: string, label: string, value: any): ProductFieldInfo => {
      const isEmpty = value === undefined || value === null || value === ''
      return {
        field_id: id,
        label,
        value: isEmpty ? null : String(value),
        isEmpty,
        section: 'core',
      }
    }

    return [
      checkField('name', 'Name', product.name),
      checkField('description', 'Description', product.description),
      checkField('short_description', 'Tagline', product.short_description),
      checkField('sku', 'SKU', product.sku),
      checkField('featured_image', 'Image', product.featured_image || product.image_url),
      checkField('primary_category_id', 'Category', catName), // Show name, not ID
      checkField('regular_price', 'Price', product.regular_price || product.price),
    ]
  }, [])

  const productHealthList: ProductHealth[] = useMemo(() => {
    const coaByProduct = new Map<string, COA>()
    vendorCOAs.forEach(coa => {
      if (coa.product_id && !coaByProduct.has(coa.product_id)) {
        coaByProduct.set(coa.product_id, coa)
      }
    })

    return products.map(product => {
      const categoryName = categoryNames.get(product.primary_category_id || '') || null
      const coreFields = getCoreFields(product, categoryName)
      const categoryFields = categoryFieldsMap.get(product.primary_category_id || '') || []
      const customFieldsData = (product.custom_fields as Record<string, any>) || {}

      const customFields: ProductFieldInfo[] = categoryFields.map(cf => {
        const value = customFieldsData[cf.field_id]
        const isEmpty = value === undefined || value === null || value === ''
        return {
          field_id: cf.field_id,
          label: cf.label,
          value: isEmpty ? null : String(value),
          isEmpty,
          section: 'custom' as const,
        }
      })

      const allFields = [...coreFields, ...customFields]
      const filledCount = allFields.filter(f => !f.isEmpty).length
      const totalCount = allFields.length
      const healthScore = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 100

      const linkedCOA = coaByProduct.get(product.id) || null
      const matchedCOA = linkedCOA ? null : findMatchingCOA(product.name)
      const hasPDF = (linkedCOA && isPDFCOA(linkedCOA)) || (matchedCOA && isPDFCOA(matchedCOA))
      const canAutofill = !!hasPDF

      return {
        product,
        healthScore,
        filledCount,
        totalCount,
        fields: allFields,
        linkedCOA,
        matchedCOA,
        canAutofill,
        categoryName,
      }
    }).sort((a, b) => a.healthScore - b.healthScore)
  }, [products, categoryFieldsMap, categoryNames, vendorCOAs, findMatchingCOA, isPDFCOA, getCoreFields])

  // ============================================================================
  // Categories for filter
  // ============================================================================

  const availableCategories: CategoryInfo[] = useMemo(() => {
    const counts = new Map<string, number>()
    products.forEach(p => {
      if (p.primary_category_id) {
        counts.set(p.primary_category_id, (counts.get(p.primary_category_id) || 0) + 1)
      }
    })

    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        name: categoryNames.get(id) || 'Unknown',
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, categoryNames])

  // ============================================================================
  // Filtering & Stats
  // ============================================================================

  const filteredList = useMemo(() => {
    let list = productHealthList

    // Category filter
    if (selectedCategoryId) {
      list = list.filter(p => p.product.primary_category_id === selectedCategoryId)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(p =>
        p.product.name.toLowerCase().includes(q) ||
        p.product.sku?.toLowerCase().includes(q)
      )
    }

    // Status filter
    switch (filterMode) {
      case 'incomplete':
        return list.filter(p => p.healthScore < 100)
      case 'complete':
        return list.filter(p => p.healthScore === 100)
      case 'actionable':
        return list.filter(p => p.canAutofill && p.healthScore < 100)
      default:
        return list
    }
  }, [productHealthList, filterMode, searchQuery, selectedCategoryId])

  const globalStats = useMemo(() => {
    const total = productHealthList.length
    const complete = productHealthList.filter(p => p.healthScore === 100).length
    const incomplete = total - complete
    const actionable = productHealthList.filter(p => p.canAutofill && p.healthScore < 100).length
    const avgHealth = total > 0
      ? Math.round(productHealthList.reduce((sum, p) => sum + p.healthScore, 0) / total)
      : 100

    return { total, complete, incomplete, actionable, avgHealth }
  }, [productHealthList])

  // ============================================================================
  // Actions
  // ============================================================================

  const handleLinkCOA = async (productId: string, coa: COA) => {
    setProcessingIds(prev => new Set(prev).add(productId))
    try {
      await linkCOAToProduct(coa.id, productId)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setRefreshKey(k => k + 1)
      onProductsUpdated?.()
    } catch (error) {
      logger.error('[InventoryHealth] Link failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const handleAutofill = async (item: ProductHealth) => {
    if (!vendor?.id) return
    const productId = item.product.id
    setProcessingIds(prev => new Set(prev).add(productId))

    try {
      let coa = item.linkedCOA

      if (!coa && item.matchedCOA) {
        await linkCOAToProduct(item.matchedCOA.id, productId)
        coa = item.matchedCOA
      }

      if (!coa) return

      const result = await parseCOAAndFillProduct(coa.id, productId, vendor.id)
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
      setRefreshKey(k => k + 1)
      onProductsUpdated?.()
    } catch (error) {
      logger.error('[InventoryHealth] Autofill failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const handleBatchAutofill = async () => {
    if (!vendor?.id) return

    const toProcess = filteredList.filter(p =>
      selectedIds.has(p.product.id) && p.canAutofill
    )

    if (toProcess.length === 0) return

    setIsRunningBatch(true)
    setBatchProgress({ current: 0, total: toProcess.length })
    setBatchResults([])
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    let currentIndex = 0

    const processNext = async (): Promise<void> => {
      const index = currentIndex++
      if (index >= toProcess.length) return

      const item = toProcess[index]
      const productId = item.product.id

      try {
        let coa = item.linkedCOA

        if (!coa && item.matchedCOA) {
          await linkCOAToProduct(item.matchedCOA.id, productId)
          coa = item.matchedCOA
        }

        if (coa) {
          const result = await parseCOAAndFillProduct(coa.id, productId, vendor.id)
          setBatchResults(prev => [...prev, {
            productId,
            success: result.success,
            fieldsFilled: result.fieldsUpdated?.length || 0,
            comparisons: result.fieldComparisons || [],
          }])
        }
      } catch (error) {
        setBatchResults(prev => [...prev, {
          productId,
          success: false,
          fieldsFilled: 0,
          comparisons: [],
        }])
      }

      setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }))
      await processNext()
    }

    const workers = Array(Math.min(CONCURRENT_LIMIT, toProcess.length))
      .fill(null)
      .map(() => processNext())

    await Promise.all(workers)

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setIsRunningBatch(false)
    setSelectedIds(new Set())
    setRefreshKey(k => k + 1)
    onProductsUpdated?.()
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAllActionable = () => {
    const actionableIds = filteredList
      .filter(p => p.canAutofill)
      .map(p => p.product.id)
    setSelectedIds(new Set(actionableIds))
    Haptics.selectionAsync()
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  useEffect(() => {
    if (batchProgress.total > 0) {
      Animated.spring(progressAnim, {
        toValue: batchProgress.current / batchProgress.total,
        useNativeDriver: false,
        tension: 40,
        friction: 10,
      }).start()
    } else {
      progressAnim.setValue(0)
    }
  }, [batchProgress.current, batchProgress.total])

  const handleClose = () => {
    setExpandedId(null)
    setSelectedIds(new Set())
    setIsRunningBatch(false)
    setBatchProgress({ current: 0, total: 0 })
    setBatchResults([])
    setSearchQuery('')
    setSelectedCategoryId(null)
    onClose()
  }

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderProductRow = ({ item }: { item: ProductHealth }) => {
    const isExpanded = expandedId === item.product.id
    const isSelected = selectedIds.has(item.product.id)
    const isProcessing = processingIds.has(item.product.id)
    const productImage = item.product.featured_image || item.product.image_url

    return (
      <View style={styles.productCard}>
        <Pressable
          style={[styles.productRow, isSelected && styles.productRowSelected]}
          onPress={() => setExpandedId(isExpanded ? null : item.product.id)}
          onLongPress={() => toggleSelection(item.product.id)}
        >
          {selectedIds.size > 0 && (
            <Pressable
              style={styles.checkbox}
              onPress={() => toggleSelection(item.product.id)}
            >
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={20}
                color={isSelected ? '#fff' : '#444'}
              />
            </Pressable>
          )}

          {/* Product Image - Large like product list */}
          {productImage ? (
            <Image
              source={{ uri: getIconImage(productImage) || productImage }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <Text style={styles.productImagePlaceholderText}>
                {item.product.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.product.name}
            </Text>
            <Text style={styles.productMeta}>
              {item.categoryName || 'Uncategorized'}
            </Text>
          </View>

          {/* Health Score Badge */}
          <View style={styles.healthBadge}>
            <Text style={styles.healthScore}>{item.healthScore}%</Text>
          </View>

          {/* Actions */}
          {isProcessing ? (
            <ActivityIndicator size="small" color="#666" />
          ) : (
            <View style={styles.actions}>
              {item.canAutofill && (
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleAutofill(item)
                  }}
                >
                  <Ionicons name="sparkles" size={16} color="#888" />
                </Pressable>
              )}
              {!item.linkedCOA && item.matchedCOA && (
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleLinkCOA(item.product.id, item.matchedCOA!)
                  }}
                >
                  <Ionicons name="link" size={16} color="#888" />
                </Pressable>
              )}
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#444"
              />
            </View>
          )}
        </Pressable>

        {/* Expanded Fields */}
        {isExpanded && (
          <View style={styles.fieldsContainer}>
            {item.fields.length === 0 ? (
              <Text style={styles.noFieldsText}>No fields configured</Text>
            ) : (
              <>
                <Text style={styles.sectionHeader}>Product Info</Text>
                {item.fields
                  .filter(f => f.section === 'core')
                  .map((field, idx, arr) => (
                    <View
                      key={field.field_id}
                      style={[styles.fieldRow, idx === arr.length - 1 && styles.fieldRowLast]}
                    >
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <Text style={[styles.fieldValue, field.isEmpty && styles.fieldValueEmpty]}>
                        {field.field_id === 'featured_image' && field.value
                          ? 'Set'
                          : field.value || '—'}
                      </Text>
                    </View>
                  ))}

                {item.fields.some(f => f.section === 'custom') && (
                  <>
                    <Text style={[styles.sectionHeader, styles.sectionHeaderMargin]}>
                      Category Fields
                    </Text>
                    {item.fields
                      .filter(f => f.section === 'custom')
                      .map((field, idx, arr) => (
                        <View
                          key={field.field_id}
                          style={[styles.fieldRow, idx === arr.length - 1 && styles.fieldRowLast]}
                        >
                          <Text style={styles.fieldLabel}>{field.label}</Text>
                          <Text style={[styles.fieldValue, field.isEmpty && styles.fieldValueEmpty]}>
                            {field.value || '—'}
                          </Text>
                        </View>
                      ))}
                  </>
                )}
              </>
            )}

            {(item.linkedCOA || item.matchedCOA) && (
              <View style={styles.coaInfo}>
                <Ionicons name="document-text" size={14} color="#555" />
                <Text style={styles.coaInfoText}>
                  {item.linkedCOA
                    ? `Linked: ${item.linkedCOA.file_name?.split('/').pop()}`
                    : `Match: ${item.matchedCOA?.file_name?.split('/').pop()}`}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    )
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  if (!visible) return null

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Inventory Health</Text>
            <Text style={styles.subtitle}>
              {globalStats.avgHealth}% avg · {globalStats.complete}/{globalStats.total} complete
            </Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#666" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#666" />
          </View>
        ) : isRunningBatch ? (
          <View style={styles.batchProgress}>
            <Text style={styles.batchTitle}>Processing</Text>
            <View style={styles.progressStats}>
              <Text style={styles.progressNumber}>{batchProgress.current}</Text>
              <Text style={styles.progressOf}>/</Text>
              <Text style={styles.progressNumber}>{batchProgress.total}</Text>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>
            <View style={styles.batchResults}>
              {batchResults.slice(-5).reverse().map((r) => {
                const product = products.find(p => p.id === r.productId)
                return (
                  <View key={r.productId} style={styles.batchResultRow}>
                    <Ionicons
                      name={r.success ? 'checkmark' : 'close'}
                      size={14}
                      color={r.success ? '#888' : '#555'}
                    />
                    <Text style={styles.batchResultText} numberOfLines={1}>
                      {product?.name} {r.success && r.fieldsFilled > 0 ? `+${r.fieldsFilled}` : ''}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        ) : (
          <>
            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="#555" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                placeholderTextColor="#444"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#555" />
                </Pressable>
              )}
            </View>

            {/* Category Pills */}
            {availableCategories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryScrollContent}
              >
                <Pressable
                  style={[styles.categoryPill, !selectedCategoryId && styles.categoryPillActive]}
                  onPress={() => setSelectedCategoryId(null)}
                >
                  <Text style={[styles.categoryPillText, !selectedCategoryId && styles.categoryPillTextActive]}>
                    All
                  </Text>
                </Pressable>
                {availableCategories.map(cat => (
                  <Pressable
                    key={cat.id}
                    style={[styles.categoryPill, selectedCategoryId === cat.id && styles.categoryPillActive]}
                    onPress={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                  >
                    <Text style={[styles.categoryPillText, selectedCategoryId === cat.id && styles.categoryPillTextActive]}>
                      {cat.name}
                    </Text>
                    <Text style={[styles.categoryPillCount, selectedCategoryId === cat.id && styles.categoryPillCountActive]}>
                      {cat.count}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Status Filter Tabs */}
            <View style={styles.filterRow}>
              {(['all', 'incomplete', 'actionable', 'complete'] as FilterMode[]).map(mode => {
                const count = mode === 'all' ? globalStats.total
                  : mode === 'incomplete' ? globalStats.incomplete
                  : mode === 'actionable' ? globalStats.actionable
                  : globalStats.complete
                return (
                  <Pressable
                    key={mode}
                    style={[styles.filterTab, filterMode === mode && styles.filterTabActive]}
                    onPress={() => setFilterMode(mode)}
                  >
                    <Text style={[styles.filterTabText, filterMode === mode && styles.filterTabTextActive]}>
                      {mode === 'all' ? 'All' : mode === 'incomplete' ? 'Incomplete' : mode === 'actionable' ? 'Fixable' : 'Complete'}
                    </Text>
                    <Text style={[styles.filterTabCount, filterMode === mode && styles.filterTabCountActive]}>
                      {count}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Selection Bar */}
            {selectedIds.size > 0 ? (
              <View style={styles.selectionBar}>
                <Text style={styles.selectionText}>{selectedIds.size} selected</Text>
                <View style={styles.selectionActions}>
                  <Pressable style={styles.selectionBtn} onPress={clearSelection}>
                    <Text style={styles.selectionBtnText}>Clear</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.selectionBtn, styles.selectionBtnPrimary]}
                    onPress={handleBatchAutofill}
                  >
                    <Ionicons name="sparkles" size={14} color="#000" />
                    <Text style={styles.selectionBtnTextPrimary}>Autofill</Text>
                  </Pressable>
                </View>
              </View>
            ) : globalStats.actionable > 0 ? (
              <Pressable style={styles.selectAllBtn} onPress={selectAllActionable}>
                <Ionicons name="checkbox-outline" size={16} color="#666" />
                <Text style={styles.selectAllText}>Select fixable ({globalStats.actionable})</Text>
              </Pressable>
            ) : null}

            {/* Product List */}
            <FlatList
              data={filteredList}
              renderItem={renderProductRow}
              keyExtractor={item => item.product.id}
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                filteredList.length === 0 && styles.listContentEmpty
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="cube-outline" size={40} color="#333" />
                  <Text style={styles.emptyStateTitle}>No products</Text>
                  <Text style={styles.emptyStateText}>
                    {searchQuery ? 'Try a different search' : 'Adjust your filters'}
                  </Text>
                </View>
              }
            />
          </>
        )}
      </View>
    </Modal>
  )
}

// ============================================================================
// Styles - Monochrome
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
  },

  // Categories
  categoryScroll: {
    maxHeight: 36,
    marginBottom: 12,
  },
  categoryScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  categoryPillText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: '#fff',
  },
  categoryPillCount: {
    fontSize: 11,
    color: '#555',
    fontWeight: '600',
  },
  categoryPillCountActive: {
    color: '#888',
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 12,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterTabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  filterTabCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#444',
  },
  filterTabCountActive: {
    color: '#888',
  },

  // Selection
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
  },
  selectionText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  selectionBtnPrimary: {
    backgroundColor: '#fff',
  },
  selectionBtnText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  selectionBtnTextPrimary: {
    color: '#000',
    fontWeight: '600',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 6,
  },
  selectAllText: {
    fontSize: 12,
    color: '#666',
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 12,
    color: '#444',
    marginTop: 4,
  },
  productCard: {
    marginBottom: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 16,
    gap: 12,
    minHeight: 72,
  },
  productRowSelected: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  checkbox: {
    marginRight: -4,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  healthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  healthScore: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  productMeta: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Fields
  fieldsContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    padding: 10,
  },
  noFieldsText: {
    fontSize: 12,
    color: '#444',
    fontStyle: 'italic',
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionHeaderMargin: {
    marginTop: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  fieldValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    flex: 1,
    textAlign: 'right',
  },
  fieldValueEmpty: {
    color: '#444',
  },
  coaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  coaInfoText: {
    fontSize: 10,
    color: '#555',
    flex: 1,
  },

  // Batch Progress
  batchProgress: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  batchTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 12,
  },
  progressNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  progressOf: {
    fontSize: 16,
    color: '#555',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  batchResults: {
    gap: 6,
  },
  batchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
  },
  batchResultText: {
    flex: 1,
    fontSize: 12,
    color: '#888',
  },
})

export default InventoryHealthModal
