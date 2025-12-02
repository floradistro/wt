/**
 * COA Detail Modal
 * Full-screen modal showing COA preview and parsed data
 * Matches the web prototype's quick view style
 */

import { useState } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Image, Linking, Alert, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import { radius } from '@/theme/tokens'
import type { COA } from '@/services/coa.service'
import { getCOAStatus, parseCOAAndFillProduct } from '@/services/coa.service'
import { logger } from '@/utils/logger'

interface COADetailModalProps {
  visible: boolean
  coa: COA | null
  productId?: string
  vendorId?: string
  onClose: () => void
  onRemove?: () => void
  onFieldsUpdated?: (fieldsUpdated: string[]) => void
}

export function COADetailModal({
  visible,
  coa,
  productId,
  vendorId,
  onClose,
  onRemove,
  onFieldsUpdated,
}: COADetailModalProps) {
  const insets = useSafeAreaInsets()
  const [isParsing, setIsParsing] = useState(false)
  const [parseResult, setParseResult] = useState<{ success: boolean; fieldsUpdated: string[] } | null>(null)

  if (!coa) return null

  const status = getCOAStatus(coa)
  // Check if file is PDF - handle URLs with query params (e.g., ?t=123 for cache busting)
  const fileUrlPath = coa.file_url?.split('?')[0] || ''
  const isPDF = fileUrlPath.toLowerCase().endsWith('.pdf')
  const canParse = !!(productId && vendorId && isPDF)

  // Debug logging
  console.log('[COADetailModal] Parse check:', {
    productId,
    vendorId,
    fileUrl: coa.file_url?.substring(0, 50),
    isPDF,
    canParse,
  })

  const handleOpenExternal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (coa.file_url) {
      Linking.openURL(coa.file_url).catch((err) => {
        logger.error('[COADetailModal] Failed to open:', err)
        Alert.alert('Error', 'Could not open the file')
      })
    }
  }

  const handleDownload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    handleOpenExternal()
  }

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Remove COA',
      'Remove this COA from the product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onRemove?.()
            onClose()
          },
        },
      ]
    )
  }

  const handleParseWithAI = async () => {
    if (!canParse || isParsing) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsParsing(true)
    setParseResult(null)

    try {
      logger.info('[COADetailModal] Starting AI parse', { coaId: coa.id, productId })
      const result = await parseCOAAndFillProduct(coa.id, productId!, vendorId!)

      setParseResult({
        success: result.success,
        fieldsUpdated: result.fieldsUpdated,
      })

      if (result.success && result.fieldsUpdated.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onFieldsUpdated?.(result.fieldsUpdated)
        Alert.alert(
          'Fields Updated',
          `Successfully extracted and filled ${result.fieldsUpdated.length} field(s):\n\n${result.fieldsUpdated.join(', ')}`,
          [{ text: 'OK' }]
        )
      } else if (result.success && result.fieldsUpdated.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        Alert.alert(
          'No New Fields',
          'COA was parsed but no empty fields were found to fill. Existing values are preserved.',
          [{ text: 'OK' }]
        )
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert(
          'Parse Failed',
          result.error || 'Could not extract data from this COA. Try a clearer PDF.',
          [{ text: 'OK' }]
        )
      }
    } catch (error) {
      logger.error('[COADetailModal] Parse failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to parse COA. Please try again.')
    } finally {
      setIsParsing(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'valid': return '#34c759'
      case 'expiring': return '#ff9500'
      case 'expired': return '#ff3b30'
      default: return '#34c759'
    }
  }

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'valid': return 'Valid'
      case 'expiring': return 'Expiring Soon'
      case 'expired': return 'Expired'
      default: return 'Valid'
    }
  }

  const testResults = coa.test_results || {}

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>Certificate of Analysis</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{coa.file_name}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* PDF Preview Section */}
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleRow}>
                <Ionicons name="document-text" size={16} color="rgba(235,235,245,0.6)" />
                <Text style={styles.previewTitle}>Document Preview</Text>
              </View>
              <Pressable onPress={handleOpenExternal} style={styles.openButton}>
                <Ionicons name="open-outline" size={14} color="rgba(235,235,245,0.6)" />
                <Text style={styles.openButtonText}>Open</Text>
              </Pressable>
            </View>

            <View style={styles.previewContainer}>
              {coa.file_url ? (
                <WebView
                  source={{ uri: coa.file_url }}
                  style={styles.webview}
                  scrollEnabled={false}
                  scalesPageToFit={true}
                />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Text style={styles.previewPlaceholderText}>No Preview</Text>
                </View>
              )}
              {/* Dimmed overlay */}
              <Pressable style={styles.previewOverlay} onPress={handleOpenExternal} />
            </View>
          </View>

          {/* Status Badge */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                {getStatusLabel(status)}
              </Text>
            </View>
            {coa.test_date && (
              <Text style={styles.testDateText}>
                Tested {formatDate(coa.test_date)}
              </Text>
            )}
          </View>

          {/* Test Info Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="flask" size={16} color="rgba(235,235,245,0.6)" />
              <Text style={styles.cardTitle}>Test Information</Text>
            </View>
            <View style={styles.infoGrid}>
              {coa.lab_name && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Lab</Text>
                  <Text style={styles.infoValue}>{coa.lab_name}</Text>
                </View>
              )}
              {coa.batch_number && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Batch</Text>
                  <Text style={[styles.infoValue, styles.monoText]}>{coa.batch_number}</Text>
                </View>
              )}
              {coa.test_date && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Test Date</Text>
                  <Text style={styles.infoValue}>{formatDate(coa.test_date)}</Text>
                </View>
              )}
              {coa.expiry_date && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Expires</Text>
                  <Text style={[styles.infoValue, status === 'expired' && styles.expiredText]}>
                    {formatDate(coa.expiry_date)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Cannabinoid Profile */}
          {(testResults.thc || testResults.cbd) && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="leaf" size={16} color="rgba(235,235,245,0.6)" />
                <Text style={styles.cardTitle}>Cannabinoid Profile</Text>
              </View>

              {/* Main cannabinoids */}
              <View style={styles.cannabinoidMain}>
                {testResults.thc && (
                  <View style={styles.cannabinoidBox}>
                    <Text style={styles.cannabinoidLabel}>THC</Text>
                    <Text style={styles.cannabinoidValue}>{testResults.thc}%</Text>
                  </View>
                )}
                {testResults.cbd && (
                  <View style={styles.cannabinoidBox}>
                    <Text style={styles.cannabinoidLabel}>CBD</Text>
                    <Text style={styles.cannabinoidValue}>{testResults.cbd}%</Text>
                  </View>
                )}
              </View>

              {/* Secondary cannabinoids */}
              {(testResults.thca || testResults.cbda || testResults.cbg || testResults.cbn || testResults.total_cannabinoids) && (
                <View style={styles.cannabinoidSecondary}>
                  {testResults.thca && (
                    <View style={styles.cannabinoidSmall}>
                      <Text style={styles.cannabinoidSmallLabel}>THCa</Text>
                      <Text style={styles.cannabinoidSmallValue}>{testResults.thca}%</Text>
                    </View>
                  )}
                  {testResults.cbda && (
                    <View style={styles.cannabinoidSmall}>
                      <Text style={styles.cannabinoidSmallLabel}>CBDa</Text>
                      <Text style={styles.cannabinoidSmallValue}>{testResults.cbda}%</Text>
                    </View>
                  )}
                  {testResults.cbg && (
                    <View style={styles.cannabinoidSmall}>
                      <Text style={styles.cannabinoidSmallLabel}>CBG</Text>
                      <Text style={styles.cannabinoidSmallValue}>{testResults.cbg}%</Text>
                    </View>
                  )}
                  {testResults.cbn && (
                    <View style={styles.cannabinoidSmall}>
                      <Text style={styles.cannabinoidSmallLabel}>CBN</Text>
                      <Text style={styles.cannabinoidSmallValue}>{testResults.cbn}%</Text>
                    </View>
                  )}
                  {testResults.total_cannabinoids && (
                    <View style={styles.cannabinoidSmall}>
                      <Text style={styles.cannabinoidSmallLabel}>Total</Text>
                      <Text style={styles.cannabinoidSmallValue}>{testResults.total_cannabinoids}%</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Terpene Profile */}
          {testResults.total_terpenes && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="color-palette" size={16} color="rgba(235,235,245,0.6)" />
                <Text style={styles.cardTitle}>Terpene Profile</Text>
              </View>

              <View style={styles.terpeneMain}>
                <Text style={styles.terpeneLabel}>Total Terpenes</Text>
                <Text style={styles.terpeneValue}>{testResults.total_terpenes}%</Text>
              </View>

              {testResults.terpenes && typeof testResults.terpenes === 'object' && (
                <View style={styles.terpeneGrid}>
                  {Object.entries(testResults.terpenes).map(([name, value]) => (
                    <View key={name} style={styles.terpeneItem}>
                      <Text style={styles.terpeneItemLabel}>{name}</Text>
                      <Text style={styles.terpeneItemValue}>{String(value)}%</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Safety Tests */}
          {(testResults.pesticides_passed !== undefined ||
            testResults.heavy_metals_passed !== undefined ||
            testResults.microbials_passed !== undefined) && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="shield-checkmark" size={16} color="rgba(235,235,245,0.6)" />
                <Text style={styles.cardTitle}>Safety Testing</Text>
              </View>

              <View style={styles.safetyGrid}>
                {testResults.pesticides_passed !== undefined && (
                  <View style={styles.safetyItem}>
                    <Ionicons
                      name={testResults.pesticides_passed ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={testResults.pesticides_passed ? "#34c759" : "#ff3b30"}
                    />
                    <Text style={styles.safetyLabel}>Pesticides</Text>
                  </View>
                )}
                {testResults.heavy_metals_passed !== undefined && (
                  <View style={styles.safetyItem}>
                    <Ionicons
                      name={testResults.heavy_metals_passed ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={testResults.heavy_metals_passed ? "#34c759" : "#ff3b30"}
                    />
                    <Text style={styles.safetyLabel}>Heavy Metals</Text>
                  </View>
                )}
                {testResults.microbials_passed !== undefined && (
                  <View style={styles.safetyItem}>
                    <Ionicons
                      name={testResults.microbials_passed ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={testResults.microbials_passed ? "#34c759" : "#ff3b30"}
                    />
                    <Text style={styles.safetyLabel}>Microbials</Text>
                  </View>
                )}
                {testResults.mycotoxins_passed !== undefined && (
                  <View style={styles.safetyItem}>
                    <Ionicons
                      name={testResults.mycotoxins_passed ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={testResults.mycotoxins_passed ? "#34c759" : "#ff3b30"}
                    />
                    <Text style={styles.safetyLabel}>Mycotoxins</Text>
                  </View>
                )}
                {testResults.solvents_passed !== undefined && (
                  <View style={styles.safetyItem}>
                    <Ionicons
                      name={testResults.solvents_passed ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={testResults.solvents_passed ? "#34c759" : "#ff3b30"}
                    />
                    <Text style={styles.safetyLabel}>Solvents</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {/* AI Parse Button */}
          {canParse && (
            <Pressable
              onPress={handleParseWithAI}
              style={[styles.parseButton, isParsing && styles.parseButtonDisabled]}
              disabled={isParsing}
            >
              {isParsing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sparkles" size={18} color="#fff" />
              )}
              <Text style={styles.parseButtonText}>
                {isParsing ? 'Parsing...' : 'Fill Fields with AI'}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={handleDownload} style={styles.downloadButton}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.downloadButtonText}>Download</Text>
          </Pressable>
          {onRemove && (
            <Pressable onPress={handleRemove} style={styles.removeButtonFooter}>
              <Ionicons name="trash-outline" size={18} color="#ff3b30" />
            </Pressable>
          )}
        </View>
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
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },

  // Preview Section
  previewSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openButtonText: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewContainer: {
    aspectRatio: 8.5 / 11,
    backgroundColor: '#fff',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholderText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.4)',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Status Row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testDateText: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.5)',
  },

  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Info Grid
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    width: '47%',
  },
  infoLabel: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  monoText: {
    fontFamily: 'Menlo',
  },
  expiredText: {
    color: '#ff3b30',
  },

  // Cannabinoid Profile
  cannabinoidMain: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cannabinoidBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
  },
  cannabinoidLabel: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  cannabinoidValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  cannabinoidSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cannabinoidSmall: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cannabinoidSmallLabel: {
    fontSize: 10,
    color: 'rgba(235,235,245,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  cannabinoidSmallValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Terpene Profile
  terpeneMain: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  terpeneLabel: {
    fontSize: 11,
    color: 'rgba(235,235,245,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  terpeneValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  terpeneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  terpeneItem: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  terpeneItemLabel: {
    fontSize: 10,
    color: 'rgba(235,235,245,0.4)',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  terpeneItemValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Safety Grid
  safetyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '47%',
  },
  safetyLabel: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.7)',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    paddingVertical: 14,
  },
  downloadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  parseButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5856D6',
    borderRadius: 24,
    paddingVertical: 14,
  },
  parseButtonDisabled: {
    opacity: 0.6,
  },
  parseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  removeButtonFooter: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderRadius: 24,
  },
})
