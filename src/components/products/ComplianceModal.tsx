/**
 * ComplianceModal
 * Bulk COA management - match products to COAs quickly
 *
 * Features:
 * - Shows all products with COA status
 * - Smart matches COAs to products by filename
 * - Filter by: All, Missing COA, Has COA, Expired
 * - One-tap linking of suggested COAs
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'
import { colors, spacing, radius } from '@/theme/tokens'
import type { Product } from '@/types/products'
import {
  getCOAsForVendor,
  getCOAsForProduct,
  linkCOAToProduct,
  getCOAStatus,
  type COA,
} from '@/services/coa.service'

interface ComplianceModalProps {
  visible: boolean
  onClose: () => void
  products: Product[]
}

type ComplianceFilter = 'all' | 'missing' | 'has-coa' | 'expired' | 'expiring'

interface ProductWithCOA {
  product: Product
  coas: COA[]
  suggestedCOA: COA | null
  matchScore: number
  status: 'compliant' | 'missing' | 'expired' | 'expiring'
}

export function ComplianceModal({ visible, onClose, products }: ComplianceModalProps) {
  const insets = useSafeAreaInsets()
  const { vendor } = useAppAuth()

  const [activeFilter, setActiveFilter] = useState<ComplianceFilter>('missing')
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState<string | null>(null) // productId being linked
  const [searchQuery, setSearchQuery] = useState('')
  const [vendorCOAs, setVendorCOAs] = useState<COA[]>([])
  const [productCOAMap, setProductCOAMap] = useState<Map<string, COA[]>>(new Map())
  const [refreshKey, setRefreshKey] = useState(0)

  // Load all vendor COAs and product COAs when modal opens
  useEffect(() => {
    if (visible && vendor?.id) {
      loadAllCOAs()
    }
  }, [visible, vendor?.id, refreshKey])

  const loadAllCOAs = async () => {
    if (!vendor?.id) return
    setLoading(true)

    try {
      // Load all vendor COAs (library)
      const allCOAs = await getCOAsForVendor(vendor.id)
      setVendorCOAs(allCOAs)

      // Build map of product -> COAs
      const coaMap = new Map<string, COA[]>()
      allCOAs.forEach((coa) => {
        if (coa.product_id) {
          const existing = coaMap.get(coa.product_id) || []
          coaMap.set(coa.product_id, [...existing, coa])
        }
      })
      setProductCOAMap(coaMap)

      logger.info('[ComplianceModal] Loaded COAs', {
        totalCOAs: allCOAs.length,
        productsWithCOAs: coaMap.size,
      })
    } catch (error) {
      logger.error('[ComplianceModal] Failed to load COAs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Smart match: calculate similarity score between product name and COA
  const getMatchScore = useCallback((productName: string, coa: COA): number => {
    if (!productName) return 0

    // Normalize string for comparison
    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Extract just the filename (after last /) and remove extension
    const fullPath = coa.file_name || ''
    const fileName = fullPath.split('/').pop() || fullPath
    const baseName = fileName.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '')

    const normalizedProduct = normalize(productName)
    const normalizedCOA = normalize(baseName)

    // Exact match (ignoring case/special chars)
    if (normalizedProduct === normalizedCOA) return 100

    // Check if COA name starts with or contains the exact product name
    if (normalizedCOA.startsWith(normalizedProduct) || normalizedCOA.includes(normalizedProduct)) {
      return 90
    }

    // Check if product name starts with or contains the COA name
    if (normalizedProduct.startsWith(normalizedCOA) || normalizedProduct.includes(normalizedCOA)) {
      return 85
    }

    return 0
  }, [])

  // Find best matching unlinked COA for a product
  const findBestMatch = useCallback((productName: string): { coa: COA | null; score: number } => {
    let bestMatch: COA | null = null
    let bestScore = 0

    // Only consider unlinked COAs
    const unlinkedCOAs = vendorCOAs.filter((coa) => !coa.product_id)

    unlinkedCOAs.forEach((coa) => {
      const score = getMatchScore(productName, coa)
      if (score > bestScore) {
        bestScore = score
        bestMatch = coa
      }
    })

    return { coa: bestMatch, score: bestScore }
  }, [vendorCOAs, getMatchScore])

  // Build products with COA info
  const productsWithCOAs: ProductWithCOA[] = useMemo(() => {
    return products.map((product) => {
      const coas = productCOAMap.get(product.id) || []
      const { coa: suggestedCOA, score: matchScore } = findBestMatch(product.name)

      // Determine status
      let status: ProductWithCOA['status'] = 'missing'
      if (coas.length > 0) {
        const coaStatuses = coas.map(getCOAStatus)
        if (coaStatuses.some((s) => s === 'expired')) {
          status = 'expired'
        } else if (coaStatuses.some((s) => s === 'expiring')) {
          status = 'expiring'
        } else {
          status = 'compliant'
        }
      }

      return {
        product,
        coas,
        suggestedCOA: matchScore >= 50 ? suggestedCOA : null,
        matchScore,
        status,
      }
    })
  }, [products, productCOAMap, findBestMatch])

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = productsWithCOAs

    // Apply status filter
    switch (activeFilter) {
      case 'missing':
        filtered = filtered.filter((p) => p.status === 'missing')
        break
      case 'has-coa':
        filtered = filtered.filter((p) => p.status === 'compliant' || p.status === 'expiring')
        break
      case 'expired':
        filtered = filtered.filter((p) => p.status === 'expired')
        break
      case 'expiring':
        filtered = filtered.filter((p) => p.status === 'expiring')
        break
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((p) =>
        p.product.name.toLowerCase().includes(query) ||
        p.suggestedCOA?.file_name?.toLowerCase().includes(query)
      )
    }

    // Sort: products with suggested matches first
    return filtered.sort((a, b) => b.matchScore - a.matchScore)
  }, [productsWithCOAs, activeFilter, searchQuery])

  // Stats
  const stats = useMemo(() => {
    const missing = productsWithCOAs.filter((p) => p.status === 'missing').length
    const compliant = productsWithCOAs.filter((p) => p.status === 'compliant').length
    const expired = productsWithCOAs.filter((p) => p.status === 'expired').length
    const expiring = productsWithCOAs.filter((p) => p.status === 'expiring').length
    const withSuggestions = productsWithCOAs.filter((p) => p.suggestedCOA && p.status === 'missing').length

    return { missing, compliant, expired, expiring, withSuggestions, total: products.length }
  }, [productsWithCOAs, products.length])

  // Handle linking a COA to a product
  const handleLinkCOA = async (productId: string, coa: COA) => {
    try {
      setLinking(productId)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      await linkCOAToProduct(coa.id, productId)

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Refresh data
      setRefreshKey((k) => k + 1)
    } catch (error) {
      logger.error('[ComplianceModal] Failed to link COA:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to link COA. Please try again.')
    } finally {
      setLinking(null)
    }
  }

  // Bulk link all suggested matches
  const handleBulkLink = async () => {
    const toLink = filteredProducts.filter((p) => p.suggestedCOA && p.status === 'missing')

    if (toLink.length === 0) {
      Alert.alert('No Matches', 'No suggested matches found for products missing COAs.')
      return
    }

    Alert.alert(
      'Link All Matches',
      `Link ${toLink.length} suggested COAs to their matching products?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Link All',
          onPress: async () => {
            setLoading(true)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

            let linked = 0
            for (const item of toLink) {
              if (item.suggestedCOA) {
                try {
                  await linkCOAToProduct(item.suggestedCOA.id, item.product.id)
                  linked++
                } catch (error) {
                  logger.error('[ComplianceModal] Failed to link:', error)
                }
              }
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            Alert.alert('Done', `Successfully linked ${linked} COAs to products.`)
            setRefreshKey((k) => k + 1)
            setLoading(false)
          },
        },
      ]
    )
  }

  const getStatusColor = (status: ProductWithCOA['status']) => {
    switch (status) {
      case 'compliant': return '#34c759'
      case 'expiring': return '#ff9500'
      case 'expired': return '#ff3b30'
      case 'missing': return 'rgba(235,235,245,0.3)'
    }
  }

  const getStatusIcon = (status: ProductWithCOA['status']) => {
    switch (status) {
      case 'compliant': return 'checkmark-circle'
      case 'expiring': return 'warning'
      case 'expired': return 'close-circle'
      case 'missing': return 'document-outline'
    }
  }

  const renderProductItem = ({ item }: { item: ProductWithCOA }) => {
    const isLinking = linking === item.product.id
    const hasSuggestion = item.suggestedCOA && item.status === 'missing'

    return (
      <View style={[styles.productItem, hasSuggestion && styles.productItemWithMatch]}>
        {/* Product Info */}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Ionicons
              name={getStatusIcon(item.status)}
              size={20}
              color={getStatusColor(item.status)}
            />
            <Text style={styles.productName} numberOfLines={1}>
              {item.product.name}
            </Text>
          </View>

          {item.coas.length > 0 && (
            <Text style={styles.coaCount}>
              {item.coas.length} COA{item.coas.length > 1 ? 's' : ''} attached
            </Text>
          )}

          {/* Suggested Match */}
          {hasSuggestion && (
            <View style={styles.suggestionContainer}>
              <View style={styles.suggestionInfo}>
                <View style={styles.matchBadge}>
                  <Ionicons name="sparkles" size={12} color="#34c759" />
                  <Text style={styles.matchBadgeText}>
                    {item.matchScore >= 90 ? 'Exact' : 'Close'} Match
                  </Text>
                </View>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {item.suggestedCOA!.file_name?.split('/').pop()}
                </Text>
              </View>
              <Pressable
                style={[styles.linkButton, isLinking && styles.linkButtonDisabled]}
                onPress={() => handleLinkCOA(item.product.id, item.suggestedCOA!)}
                disabled={isLinking}
              >
                {isLinking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="link" size={16} color="#fff" />
                    <Text style={styles.linkButtonText}>Link</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* No COA, no suggestion */}
          {item.status === 'missing' && !hasSuggestion && (
            <Text style={styles.noMatch}>No matching COA found</Text>
          )}
        </View>
      </View>
    )
  }

  const filterPills = [
    { id: 'missing', label: `Missing (${stats.missing})`, color: 'rgba(235,235,245,0.3)' },
    { id: 'has-coa', label: `Has COA (${stats.compliant + stats.expiring})`, color: '#34c759' },
    { id: 'expired', label: `Expired (${stats.expired})`, color: '#ff3b30' },
    { id: 'all', label: `All (${stats.total})`, color: '#fff' },
  ]

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Compliance Check</Text>
            <Text style={styles.headerSubtitle}>
              {stats.withSuggestions} products have matching COAs ready to link
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={18} color="#34c759" />
            <Text style={styles.statValue}>{stats.compliant}</Text>
            <Text style={styles.statLabel}>Compliant</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="document-outline" size={18} color="rgba(235,235,245,0.5)" />
            <Text style={styles.statValue}>{stats.missing}</Text>
            <Text style={styles.statLabel}>Missing</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="warning" size={18} color="#ff9500" />
            <Text style={styles.statValue}>{stats.expiring}</Text>
            <Text style={styles.statLabel}>Expiring</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={18} color="#ff3b30" />
            <Text style={styles.statValue}>{stats.expired}</Text>
            <Text style={styles.statLabel}>Expired</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterContainer}>
          {filterPills.map((pill) => (
            <Pressable
              key={pill.id}
              style={[
                styles.filterPill,
                activeFilter === pill.id && styles.filterPillActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setActiveFilter(pill.id as ComplianceFilter)
              }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === pill.id && styles.filterPillTextActive,
                ]}
              >
                {pill.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="rgba(235,235,245,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="rgba(235,235,245,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(235,235,245,0.4)" />
              </Pressable>
            )}
          </View>

          {/* Bulk Link Button */}
          {stats.withSuggestions > 0 && activeFilter === 'missing' && (
            <Pressable style={styles.bulkLinkButton} onPress={handleBulkLink}>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.bulkLinkText}>Link All ({stats.withSuggestions})</Text>
            </Pressable>
          )}
        </View>

        {/* Product List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading compliance data...</Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={activeFilter === 'missing' ? 'checkmark-circle' : 'document-outline'}
              size={60}
              color="rgba(235,235,245,0.2)"
            />
            <Text style={styles.emptyTitle}>
              {activeFilter === 'missing' ? 'All Products Compliant!' : 'No Products Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'missing'
                ? 'All products have COAs attached'
                : 'Try a different filter'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.product.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Filters
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  bulkLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#34c759',
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  bulkLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  productItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  productItemWithMatch: {
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.2)',
  },
  productInfo: {
    gap: 8,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  coaCount: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.5)',
    marginLeft: 30,
  },
  suggestionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(52,199,89,0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  suggestionInfo: {
    flex: 1,
    gap: 4,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34c759',
  },
  suggestionName: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.7)',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#34c759',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  linkButtonDisabled: {
    opacity: 0.6,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  noMatch: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.4)',
    marginLeft: 30,
    fontStyle: 'italic',
  },

  // Loading/Empty
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
  },
})
