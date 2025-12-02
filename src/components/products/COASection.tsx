/**
 * COA Section
 * Displays and manages Certificate of Analysis documents for a product
 *
 * Features:
 * - List of attached COAs with status indicators
 * - Full-screen picker modal for uploading/attaching COAs
 * - Tap to open COA, tap X to remove/unattach
 * - AI-powered field extraction from COA PDFs
 */

import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import { radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import type { Product } from '@/types/products'
import { COAPickerModal } from '@/components/shared'
import { COADetailModal } from '@/components/products/COADetailModal'
import {
  getCOAsForProduct,
  unlinkCOAFromProduct,
  getCOAStatus,
  type COA,
} from '@/services/coa.service'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'

interface COASectionProps {
  product: Product
  onProductUpdated?: () => void
}

export function COASection({ product, onProductUpdated }: COASectionProps) {
  const { vendor } = useAppAuth()
  const [productCOAs, setProductCOAs] = useState<COA[]>([])
  const [loading, setLoading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [selectedCOA, setSelectedCOA] = useState<COA | null>(null)

  // Load COAs when product changes
  useEffect(() => {
    if (product?.id) {
      loadCOAs()
    }
  }, [product?.id])

  const loadCOAs = async () => {
    try {
      setLoading(true)
      const coas = await getCOAsForProduct(product.id)
      setProductCOAs(coas)
    } catch (error) {
      logger.error('[COASection] Failed to load COAs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowPicker(true)
  }

  const handleClosePicker = () => {
    setShowPicker(false)
  }

  const handleCOAAttached = () => {
    loadCOAs()
  }

  const handleViewCOA = (coa: COA) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCOA(coa)
  }

  const handleCloseDetail = () => {
    setSelectedCOA(null)
  }

  const handleRemoveFromDetail = async () => {
    if (!selectedCOA) return
    try {
      await unlinkCOAFromProduct(selectedCOA.id)
      setProductCOAs((prev) => prev.filter((c) => c.id !== selectedCOA.id))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      logger.error('[COASection] Remove failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleRemoveCOA = (coa: COA) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    Alert.alert(
      'Remove COA',
      `Remove "${coa.file_name}" from this product?\n\nThe COA will still be available in your library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await unlinkCOAFromProduct(coa.id)
              setProductCOAs((prev) => prev.filter((c) => c.id !== coa.id))
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            } catch (error) {
              logger.error('[COASection] Remove failed:', error)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            }
          },
        },
      ]
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return '#34c759'
      case 'expiring':
        return '#ff9500'
      case 'expired':
        return '#ff3b30'
      default:
        return '#34c759'
    }
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LAB RESULTS (COA)</Text>
        <View style={styles.cardGlass}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <>
              {/* Attached COAs */}
              {productCOAs.map((coa) => {
                const status = getCOAStatus(coa)
                const testDate = formatDate(coa.test_date)

                return (
                  <View key={coa.id} style={styles.row}>
                    <Pressable style={styles.coaContent} onPress={() => handleViewCOA(coa)}>
                      <View style={styles.coaThumbnail}>
                        {coa.file_url ? (
                          <>
                            <WebView
                              source={{ uri: coa.file_url }}
                              style={styles.thumbnailWebview}
                              scrollEnabled={false}
                              scalesPageToFit={true}
                              pointerEvents="none"
                            />
                            <View style={styles.thumbnailOverlay} />
                          </>
                        ) : (
                          <View style={styles.thumbnailPlaceholder} />
                        )}
                      </View>
                      <View style={styles.coaInfo}>
                        <Text style={styles.coaName} numberOfLines={1}>{coa.file_name}</Text>
                        <Text style={styles.coaMeta}>
                          {coa.lab_name || 'Lab Analysis'}{testDate ? ` • ${testDate}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                    </Pressable>
                    <Pressable style={styles.removeButton} onPress={() => handleRemoveCOA(coa)}>
                      <Ionicons name="close-circle" size={22} color="rgba(235,235,245,0.4)" />
                    </Pressable>
                  </View>
                )
              })}

              {/* Add COA Row */}
              <Pressable style={[styles.row, styles.rowLast]} onPress={handleOpenPicker}>
                <Text style={styles.rowLabel}>Attach COA</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(235,235,245,0.3)" />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Full-screen COA Picker Modal */}
      <COAPickerModal
        visible={showPicker}
        onClose={handleClosePicker}
        productId={product.id}
        productName={product.name}
        onCOAAttached={handleCOAAttached}
      />

      {/* COA Detail Modal */}
      <COADetailModal
        visible={!!selectedCOA}
        coa={selectedCOA}
        productId={product.id}
        vendorId={vendor?.id}
        onClose={handleCloseDetail}
        onRemove={handleRemoveFromDetail}
        onFieldsUpdated={(fieldsUpdated) => {
          logger.info('[COASection] Fields updated from COA parse:', fieldsUpdated)
          onProductUpdated?.()
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.sectionSpacing,
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
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
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  coaContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coaThumbnail: {
    width: 56,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailWebview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  coaInfo: {
    flex: 1,
  },
  coaName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  coaMeta: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.5)',
    marginTop: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
})
