/**
 * ComplianceModal - COA Management & Compliance Audit
 *
 * Three modes:
 * 1. Browse - View all products and their COA status
 * 2. Preview - See what audit will do before running
 * 3. Running - Execute with live progress
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
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { Product } from '@/types/products'
import {
  getCOAsForVendor,
  linkCOAToProduct,
  parseCOAAndFillProduct,
  type COA,
  type FieldComparison,
} from '@/services/coa.service'

interface CategoryField {
  field_id: string
  label: string
  type: string
}

interface ComplianceModalProps {
  visible: boolean
  onClose: () => void
  products: Product[]
  onProductsUpdated?: () => void
}

type ViewMode = 'browse' | 'preview' | 'running' | 'complete'
type FilterTab = 'all' | 'linked' | 'unlinked' | 'matched' | 'incomplete'

interface ProductFieldInfo {
  field_id: string
  label: string
  value: string | null
  isEmpty: boolean
}

interface ProductCOAInfo {
  product: Product
  linkedCOAs: COA[]
  matchedCOA: COA | null
  hasLinkedPDF: boolean
  canParse: boolean
  status: 'compliant' | 'missing' | 'matched'
  fields: ProductFieldInfo[]
  emptyFieldCount: number
  filledFieldCount: number
}

interface AuditAction {
  type: 'link' | 'parse'
  product: Product
  coa: COA
}

interface ProductResult {
  success: boolean
  fieldsUpdated: number
  action: string
  fieldComparisons: FieldComparison[]
}

interface AuditProgress {
  current: number
  total: number
  currentProduct?: string
  results: Map<string, ProductResult>
}

const CONCURRENT_LIMIT = 5

export function ComplianceModal({ visible, onClose, products, onProductsUpdated }: ComplianceModalProps) {
  const insets = useSafeAreaInsets()
  const { vendor } = useAppAuth()
  const progressAnim = useRef(new Animated.Value(0)).current

  const [loading, setLoading] = useState(false)
  const [vendorCOAs, setVendorCOAs] = useState<COA[]>([])
  const [productCOAMap, setProductCOAMap] = useState<Map<string, COA[]>>(new Map())
  const [categoryFieldsMap, setCategoryFieldsMap] = useState<Map<string, CategoryField[]>>(new Map())
  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [auditProgress, setAuditProgress] = useState<AuditProgress>({
    current: 0,
    total: 0,
    results: new Map(),
  })
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null)

  // Check if COA is a PDF
  const isPDFCOA = useCallback((coa: COA): boolean => {
    const fileUrlPath = coa.file_url?.split('?')[0] || ''
    return fileUrlPath.toLowerCase().endsWith('.pdf')
  }, [])

  // Load COAs
  useEffect(() => {
    if (visible && vendor?.id) {
      loadCOAs()
    }
  }, [visible, vendor?.id, refreshKey])

  const loadCOAs = async () => {
    if (!vendor?.id) return
    setLoading(true)
    try {
      // Load COAs
      const allCOAs = await getCOAsForVendor(vendor.id)
      setVendorCOAs(allCOAs)

      const coaMap = new Map<string, COA[]>()
      allCOAs.forEach((coa) => {
        if (coa.product_id) {
          const existing = coaMap.get(coa.product_id) || []
          coaMap.set(coa.product_id, [...existing, coa])
        }
      })
      setProductCOAMap(coaMap)

      // Load category field definitions for all unique categories
      const categoryIds = [...new Set(products.map(p => p.primary_category_id).filter(Boolean))]
      if (categoryIds.length > 0) {
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
      logger.error('[ComplianceModal] Failed to load COAs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Smart match
  const getMatchScore = useCallback((productName: string, coa: COA): number => {
    if (!productName) return 0
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
    const fileName = (coa.file_name || '').split('/').pop() || ''
    const baseName = fileName.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '')
    const normalizedProduct = normalize(productName)
    const normalizedCOA = normalize(baseName)
    if (normalizedProduct === normalizedCOA) return 100
    if (normalizedCOA.includes(normalizedProduct) || normalizedProduct.includes(normalizedCOA)) return 85
    return 0
  }, [])

  const findBestMatch = useCallback((productName: string): COA | null => {
    let bestMatch: COA | null = null
    let bestScore = 0
    const unlinkedCOAs = vendorCOAs.filter((coa) => !coa.product_id)
    unlinkedCOAs.forEach((coa) => {
      const score = getMatchScore(productName, coa)
      if (score >= 50 && score > bestScore) {
        bestScore = score
        bestMatch = coa
      }
    })
    return bestMatch
  }, [vendorCOAs, getMatchScore])

  // Build product info list with field values
  const productInfoList: ProductCOAInfo[] = useMemo(() => {
    return products.map((product) => {
      const linkedCOAs = productCOAMap.get(product.id) || []
      const matchedCOA = linkedCOAs.length === 0 ? findBestMatch(product.name) : null
      const hasLinkedPDF = linkedCOAs.some(isPDFCOA)
      const canParse = hasLinkedPDF || (matchedCOA && isPDFCOA(matchedCOA))

      let status: ProductCOAInfo['status'] = 'missing'
      if (linkedCOAs.length > 0) status = 'compliant'
      else if (matchedCOA) status = 'matched'

      // Get field values for this product
      const categoryFields = categoryFieldsMap.get(product.primary_category_id || '') || []
      const customFields = (product.custom_fields as Record<string, any>) || {}

      const fields: ProductFieldInfo[] = categoryFields.map(cf => {
        const value = customFields[cf.field_id]
        const isEmpty = value === undefined || value === null || value === ''
        return {
          field_id: cf.field_id,
          label: cf.label,
          value: isEmpty ? null : String(value),
          isEmpty,
        }
      })

      const emptyFieldCount = fields.filter(f => f.isEmpty).length
      const filledFieldCount = fields.filter(f => !f.isEmpty).length

      return {
        product,
        linkedCOAs,
        matchedCOA,
        hasLinkedPDF,
        canParse: !!canParse,
        status,
        fields,
        emptyFieldCount,
        filledFieldCount,
      }
    })
  }, [products, productCOAMap, findBestMatch, isPDFCOA, categoryFieldsMap])

  // Filtered list
  const filteredList = useMemo(() => {
    switch (filterTab) {
      case 'linked': return productInfoList.filter(p => p.linkedCOAs.length > 0)
      case 'unlinked': return productInfoList.filter(p => p.linkedCOAs.length === 0 && !p.matchedCOA)
      case 'matched': return productInfoList.filter(p => p.matchedCOA !== null)
      case 'incomplete': return productInfoList.filter(p => p.emptyFieldCount > 0)
      default: return productInfoList
    }
  }, [productInfoList, filterTab])

  // Stats
  const stats = useMemo(() => {
    const linked = productInfoList.filter(p => p.linkedCOAs.length > 0).length
    const unlinked = productInfoList.filter(p => p.linkedCOAs.length === 0 && !p.matchedCOA).length
    const matched = productInfoList.filter(p => p.matchedCOA !== null).length
    const parseable = productInfoList.filter(p => p.canParse).length
    const incomplete = productInfoList.filter(p => p.emptyFieldCount > 0).length
    return { total: products.length, linked, unlinked, matched, parseable, incomplete }
  }, [productInfoList, products.length])

  // Audit actions preview
  const auditActions: AuditAction[] = useMemo(() => {
    const actions: AuditAction[] = []
    productInfoList.forEach((info) => {
      if (info.matchedCOA && isPDFCOA(info.matchedCOA)) {
        // Will link and parse
        actions.push({ type: 'link', product: info.product, coa: info.matchedCOA })
        actions.push({ type: 'parse', product: info.product, coa: info.matchedCOA })
      } else if (info.hasLinkedPDF) {
        // Will parse existing
        const pdfCOA = info.linkedCOAs.find(isPDFCOA)!
        actions.push({ type: 'parse', product: info.product, coa: pdfCOA })
      }
    })
    return actions
  }, [productInfoList, isPDFCOA])

  // Individual link
  const handleLink = async (productId: string, coa: COA) => {
    setProcessingIds(prev => new Set(prev).add(productId))
    try {
      await linkCOAToProduct(coa.id, productId)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setRefreshKey(k => k + 1)
      onProductsUpdated?.()
    } catch (error) {
      logger.error('[ComplianceModal] Link failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(productId); return n })
    }
  }

  // Individual parse
  const handleParse = async (productId: string, coa: COA) => {
    if (!vendor?.id) return
    setProcessingIds(prev => new Set(prev).add(productId))
    try {
      const result = await parseCOAAndFillProduct(coa.id, productId, vendor.id)
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
      setRefreshKey(k => k + 1)
      onProductsUpdated?.()
    } catch (error) {
      logger.error('[ComplianceModal] Parse failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(productId); return n })
    }
  }

  // Run audit
  const runAudit = async () => {
    if (!vendor?.id) return
    setViewMode('running')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    const toProcess = productInfoList.filter(p => p.canParse)
    setAuditProgress({ current: 0, total: toProcess.length, results: new Map() })

    // Process in parallel with limit
    let currentIndex = 0
    const processNext = async (): Promise<void> => {
      const index = currentIndex++
      if (index >= toProcess.length) return

      const info = toProcess[index]
      setAuditProgress(prev => ({ ...prev, currentProduct: info.product.name }))

      try {
        let coaToUse: COA
        let action = 'parsed'

        if (info.matchedCOA && isPDFCOA(info.matchedCOA)) {
          await linkCOAToProduct(info.matchedCOA.id, info.product.id)
          coaToUse = info.matchedCOA
          action = 'linked & parsed'
        } else {
          coaToUse = info.linkedCOAs.find(isPDFCOA)!
        }

        const result = await parseCOAAndFillProduct(coaToUse.id, info.product.id, vendor.id)

        logger.info('[ComplianceModal] Parse result for product', {
          product: info.product.name,
          success: result.success,
          fieldsUpdated: result.fieldsUpdated?.length || 0,
          comparisons: result.fieldComparisons?.length || 0,
          parseFields: result.parseResult?.parsed_fields?.length || 0,
          error: result.error,
        })

        setAuditProgress(prev => {
          const newResults = new Map(prev.results)
          newResults.set(info.product.id, {
            success: result.success,
            fieldsUpdated: result.fieldsUpdated?.length || 0,
            action,
            fieldComparisons: result.fieldComparisons || [],
          })
          return { ...prev, current: prev.current + 1, results: newResults }
        })
      } catch (error) {
        setAuditProgress(prev => {
          const newResults = new Map(prev.results)
          newResults.set(info.product.id, { success: false, fieldsUpdated: 0, action: 'failed', fieldComparisons: [] })
          return { ...prev, current: prev.current + 1, results: newResults }
        })
      }

      await processNext()
    }

    const workers = Array(Math.min(CONCURRENT_LIMIT, toProcess.length)).fill(null).map(() => processNext())
    await Promise.all(workers)

    setViewMode('complete')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setRefreshKey(k => k + 1)
    onProductsUpdated?.()
  }

  // Progress animation
  useEffect(() => {
    if (auditProgress.total > 0) {
      Animated.spring(progressAnim, {
        toValue: auditProgress.current / auditProgress.total,
        useNativeDriver: false,
        tension: 40,
        friction: 10,
      }).start()
    }
  }, [auditProgress.current, auditProgress.total])

  const handleClose = () => {
    setViewMode('browse')
    setAuditProgress({ current: 0, total: 0, results: new Map() })
    progressAnim.setValue(0)
    onClose()
  }

  const renderProductRow = ({ item }: { item: ProductCOAInfo }) => {
    const isProcessing = processingIds.has(item.product.id)
    const pdfCOA = item.linkedCOAs.find(isPDFCOA)
    const isExpanded = expandedProductId === item.product.id
    const hasFields = item.fields.length > 0

    return (
      <View style={styles.productCard}>
        <Pressable
          style={styles.productRow}
          onPress={() => hasFields && setExpandedProductId(isExpanded ? null : item.product.id)}
        >
          <View style={[styles.statusDot,
            item.status === 'compliant' && styles.statusCompliant,
            item.status === 'matched' && styles.statusMatched,
            item.status === 'missing' && styles.statusMissing,
          ]} />

          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.product.name}</Text>
            <View style={styles.productMetaRow}>
              <Text style={styles.productMeta}>
                {item.linkedCOAs.length > 0
                  ? `${item.linkedCOAs.length} COA`
                  : item.matchedCOA
                    ? 'Match found'
                    : 'No COA'}
              </Text>
              {hasFields && (
                <View style={styles.fieldCountBadges}>
                  {item.filledFieldCount > 0 && (
                    <View style={styles.badgeFilledSmall}>
                      <Text style={styles.badgeTextSmall}>{item.filledFieldCount}</Text>
                    </View>
                  )}
                  {item.emptyFieldCount > 0 && (
                    <View style={styles.badgeEmptySmall}>
                      <Text style={styles.badgeTextSmall}>{item.emptyFieldCount}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.actions}>
              {item.matchedCOA && (
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleLink(item.product.id, item.matchedCOA!)
                  }}
                >
                  <Ionicons name="link" size={16} color="#888" />
                </Pressable>
              )}
              {(pdfCOA || (item.matchedCOA && isPDFCOA(item.matchedCOA))) && (
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation()
                    const coa = pdfCOA || item.matchedCOA!
                    if (!pdfCOA && item.matchedCOA) {
                      handleLink(item.product.id, item.matchedCOA).then(() => {
                        handleParse(item.product.id, item.matchedCOA!)
                      })
                    } else {
                      handleParse(item.product.id, coa)
                    }
                  }}
                >
                  <Ionicons name="sparkles" size={16} color="#888" />
                </Pressable>
              )}
              {hasFields && (
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#555"
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          )}
        </Pressable>

        {/* Expanded field values */}
        {isExpanded && hasFields && (
          <View style={styles.productFields}>
            {item.fields.map((field, idx) => (
              <View key={field.field_id} style={[
                styles.productFieldRow,
                idx === item.fields.length - 1 && { borderBottomWidth: 0 }
              ]}>
                <Text style={styles.productFieldLabel}>{field.label}</Text>
                <Text style={[
                  styles.productFieldValue,
                  field.isEmpty && styles.productFieldEmpty
                ]}>
                  {field.value || '—'}
                </Text>
              </View>
            ))}
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Compliance</Text>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#888" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : viewMode === 'browse' ? (
          /* BROWSE MODE */
          <>
            {/* Stats Row - Scrollable for more tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.statsScroll}
              contentContainerStyle={styles.statsRow}
            >
              <Pressable
                style={[styles.statTab, filterTab === 'all' && styles.statTabActive]}
                onPress={() => setFilterTab('all')}
              >
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>All</Text>
              </Pressable>
              <Pressable
                style={[styles.statTab, filterTab === 'incomplete' && styles.statTabActive]}
                onPress={() => setFilterTab('incomplete')}
              >
                <Text style={[styles.statValue, stats.incomplete > 0 && styles.statValueWarning]}>
                  {stats.incomplete}
                </Text>
                <Text style={styles.statLabel}>Incomplete</Text>
              </Pressable>
              <Pressable
                style={[styles.statTab, filterTab === 'linked' && styles.statTabActive]}
                onPress={() => setFilterTab('linked')}
              >
                <Text style={styles.statValue}>{stats.linked}</Text>
                <Text style={styles.statLabel}>Linked</Text>
              </Pressable>
              <Pressable
                style={[styles.statTab, filterTab === 'matched' && styles.statTabActive]}
                onPress={() => setFilterTab('matched')}
              >
                <Text style={styles.statValue}>{stats.matched}</Text>
                <Text style={styles.statLabel}>Matched</Text>
              </Pressable>
              <Pressable
                style={[styles.statTab, filterTab === 'unlinked' && styles.statTabActive]}
                onPress={() => setFilterTab('unlinked')}
              >
                <Text style={styles.statValue}>{stats.unlinked}</Text>
                <Text style={styles.statLabel}>No COA</Text>
              </Pressable>
            </ScrollView>

            {/* Product List */}
            <FlatList
              data={filteredList}
              renderItem={renderProductRow}
              keyExtractor={(item) => item.product.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />

            {/* Audit Button */}
            {stats.parseable > 0 && (
              <Pressable
                style={styles.auditBtn}
                onPress={() => setViewMode('preview')}
              >
                <Ionicons name="shield-checkmark" size={20} color="#000" />
                <Text style={styles.auditBtnText}>Run Audit ({stats.parseable})</Text>
              </Pressable>
            )}
          </>
        ) : viewMode === 'preview' ? (
            /* PREVIEW MODE - Show what will happen */
            <>
              <View style={styles.previewHeader}>
                <Pressable onPress={() => setViewMode('browse')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#888" />
                </Pressable>
                <Text style={styles.previewTitle}>Audit Preview</Text>
              </View>

              <View style={styles.previewSummary}>
                <Text style={styles.previewText}>This audit will:</Text>
                <View style={styles.previewItem}>
                  <Ionicons name="link" size={16} color="#888" />
                  <Text style={styles.previewItemText}>
                    Link {productInfoList.filter(p => p.matchedCOA).length} COAs by filename match
                  </Text>
                </View>
                <View style={styles.previewItem}>
                  <Ionicons name="sparkles" size={16} color="#888" />
                  <Text style={styles.previewItemText}>
                    Parse {stats.parseable} PDF COAs and fill product fields
                  </Text>
                </View>
              </View>

              <ScrollView style={styles.previewList}>
                <Text style={styles.previewListTitle}>Products to process:</Text>
                {productInfoList.filter(p => p.canParse).map((info) => (
                  <View key={info.product.id} style={styles.previewRow}>
                    <Text style={styles.previewRowName} numberOfLines={1}>
                      {info.product.name}
                    </Text>
                    <Text style={styles.previewRowAction}>
                      {info.matchedCOA ? 'link + parse' : 'parse'}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.previewActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setViewMode('browse')}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.confirmBtn} onPress={runAudit}>
                  <Text style={styles.confirmBtnText}>Run Audit</Text>
                </Pressable>
              </View>
            </>
          ) : viewMode === 'running' || viewMode === 'complete' ? (
            /* RUNNING / COMPLETE MODE */
            <>
              <View style={styles.runningHeader}>
                <Text style={styles.runningTitle}>
                  {viewMode === 'complete' ? '✓ Audit Complete' : '🤖 Running Audit...'}
                </Text>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressStats}>
                  <Text style={styles.progressNumber}>{auditProgress.current}</Text>
                  <Text style={styles.progressOf}>of</Text>
                  <Text style={styles.progressNumber}>{auditProgress.total}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
                </View>
                {viewMode === 'running' && auditProgress.currentProduct && (
                  <View style={styles.currentItem}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.currentItemText} numberOfLines={1}>
                      {auditProgress.currentProduct}
                    </Text>
                  </View>
                )}
              </View>

              <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsListContent}>
                {Array.from(auditProgress.results.entries()).reverse().map(([id, result], index) => {
                  const product = products.find(p => p.id === id)
                  // Auto-expand first result, or if manually expanded
                  const isExpanded = expandedResultId === id || (expandedResultId === null && index === 0)
                  const hasComparisons = result.fieldComparisons.length > 0

                  // Count by status
                  const filled = result.fieldComparisons.filter(f => f.status === 'filled').length
                  const matched = result.fieldComparisons.filter(f => f.status === 'matched').length
                  const conflicts = result.fieldComparisons.filter(f => f.status === 'conflict').length
                  const skipped = result.fieldComparisons.filter(f => f.status === 'skipped').length

                  return (
                    <View key={id} style={styles.resultCard}>
                      <Pressable
                        style={[styles.resultRow, !result.success && styles.resultRowError]}
                        onPress={() => hasComparisons && setExpandedResultId(isExpanded ? '__none__' : id)}
                      >
                        <Ionicons
                          name={result.success ? 'checkmark-circle' : 'close-circle'}
                          size={18}
                          color={result.success ? '#4ade80' : '#f87171'}
                        />
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName} numberOfLines={1}>
                            {product?.name || id}
                          </Text>
                          <Text style={styles.resultAction}>{result.action}</Text>
                        </View>
                        {hasComparisons ? (
                          <View style={styles.resultBadges}>
                            {filled > 0 && <View style={styles.badgeFilled}><Text style={styles.badgeText}>+{filled}</Text></View>}
                            {matched > 0 && <View style={styles.badgeMatched}><Text style={styles.badgeText}>✓{matched}</Text></View>}
                            {conflicts > 0 && <View style={styles.badgeConflict}><Text style={styles.badgeText}>⚠{conflicts}</Text></View>}
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color="#666"
                            />
                          </View>
                        ) : (
                          <Text style={styles.noFields}>{result.success ? 'No fields' : result.action}</Text>
                        )}
                      </Pressable>

                      {/* Expanded field details - always show the values */}
                      {isExpanded && hasComparisons && (
                        <View style={styles.fieldDetails}>
                          {result.fieldComparisons
                            .filter(f => f.status !== 'skipped') // Hide skipped by default
                            .map((field, idx) => (
                            <View key={idx} style={styles.fieldRow}>
                              <View style={styles.fieldHeader}>
                                <Text style={styles.fieldLabel}>{field.label}</Text>
                                <View style={[
                                  styles.fieldStatus,
                                  field.status === 'filled' && styles.fieldStatusFilled,
                                  field.status === 'matched' && styles.fieldStatusMatched,
                                  field.status === 'conflict' && styles.fieldStatusConflict,
                                ]}>
                                  <Text style={[
                                    styles.fieldStatusText,
                                    field.status === 'filled' && styles.fieldStatusTextFilled,
                                    field.status === 'matched' && styles.fieldStatusTextMatched,
                                    field.status === 'conflict' && styles.fieldStatusTextConflict,
                                  ]}>
                                    {field.status === 'filled' && 'FILLED'}
                                    {field.status === 'matched' && 'MATCH'}
                                    {field.status === 'conflict' && 'CONFLICT'}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.fieldValues}>
                                <View style={styles.fieldValueRow}>
                                  <Text style={styles.fieldValueLabel}>COA:</Text>
                                  <Text style={styles.fieldValueCOA}>{field.coaValue || '—'}</Text>
                                </View>
                                {field.productValue !== null && field.status !== 'filled' && (
                                  <View style={styles.fieldValueRow}>
                                    <Text style={styles.fieldValueLabel}>Product:</Text>
                                    <Text style={[
                                      styles.fieldValue,
                                      field.status === 'conflict' && styles.fieldValueConflict
                                    ]}>{field.productValue}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          ))}
                          {skipped > 0 && (
                            <Text style={styles.skippedNote}>{skipped} field{skipped > 1 ? 's' : ''} skipped (not in category)</Text>
                          )}
                        </View>
                      )}
                    </View>
                  )
                })}
              </ScrollView>

              {viewMode === 'complete' && (
                <Pressable style={styles.doneBtn} onPress={handleClose}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              )}
            </>
          ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  statTab: {
    minWidth: 70,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statTabActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statValueWarning: {
    color: '#fbbf24',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  productCard: {
    marginBottom: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  statusCompliant: { backgroundColor: '#4ade80' },
  statusMatched: { backgroundColor: '#fbbf24' },
  statusMissing: { backgroundColor: '#666' },
  productInfo: { flex: 1 },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  productMeta: {
    fontSize: 12,
    color: '#666',
  },
  fieldCountBadges: {
    flexDirection: 'row',
    marginLeft: 8,
    gap: 4,
  },
  badgeFilledSmall: {
    backgroundColor: 'rgba(74,222,128,0.25)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeEmptySmall: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Product expanded fields
  productFields: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  productFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  productFieldLabel: {
    fontSize: 12,
    color: '#888',
    flex: 1,
  },
  productFieldValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'right',
    flex: 1,
  },
  productFieldEmpty: {
    color: '#555',
    fontWeight: '400',
  },

  // Audit Button
  auditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  auditBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  // Preview
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  previewSummary: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 16,
  },
  previewText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  previewItemText: {
    fontSize: 14,
    color: '#fff',
  },
  previewList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  previewListTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  previewRowName: {
    flex: 1,
    fontSize: 13,
    color: '#ccc',
  },
  previewRowAction: {
    fontSize: 12,
    color: '#666',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  // Running
  runningHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  runningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  progressNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  progressOf: {
    fontSize: 14,
    color: '#666',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  currentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  currentItemText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsListContent: {
    paddingBottom: 16,
  },
  resultCard: {
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  resultRowError: {
    backgroundColor: 'rgba(248,113,113,0.1)',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  resultBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeFilled: {
    backgroundColor: 'rgba(74,222,128,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeMatched: {
    backgroundColor: 'rgba(96,165,250,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeConflict: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  noFields: {
    fontSize: 12,
    color: '#666',
  },
  resultAction: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  // Field details (expanded)
  fieldDetails: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    padding: 12,
  },
  fieldRow: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  fieldStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  fieldStatusFilled: {
    backgroundColor: 'rgba(74,222,128,0.25)',
  },
  fieldStatusMatched: {
    backgroundColor: 'rgba(96,165,250,0.25)',
  },
  fieldStatusConflict: {
    backgroundColor: 'rgba(251,191,36,0.25)',
  },
  fieldStatusSkipped: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  fieldStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
  },
  fieldStatusTextFilled: {
    color: '#4ade80',
  },
  fieldStatusTextMatched: {
    color: '#60a5fa',
  },
  fieldStatusTextConflict: {
    color: '#fbbf24',
  },
  fieldValues: {
    gap: 6,
  },
  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  fieldValueLabel: {
    fontSize: 12,
    color: '#666',
    width: 60,
  },
  fieldValueCOA: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    color: '#888',
  },
  fieldValueConflict: {
    color: '#fbbf24',
  },
  skippedNote: {
    fontSize: 11,
    color: '#555',
    fontStyle: 'italic',
    marginTop: 4,
  },
  doneBtn: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
})
