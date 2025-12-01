/**
 * COAPickerModal
 * iOS-style edge-to-edge COA document picker
 * Shows vendor's existing COAs + option to upload new PDF/image
 *
 * Matches MediaPickerModal style - full screen with tabs
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
  TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'
import {
  getCOAsForVendor,
  getCOAsForProduct,
  uploadCOAFile,
  createCOA,
  linkCOAToProduct,
  pickCOADocument,
  getCOAStatus,
  deleteCOA,
  permanentlyDeleteCOA,
  unlinkCOAFromProduct,
  type COA,
} from '@/services/coa.service'

interface COAPickerModalProps {
  visible: boolean
  onClose: () => void
  productId: string
  productName?: string
  onCOAAttached: () => void
}

type COASource = 'attached' | 'library'

export function COAPickerModal({
  visible,
  onClose,
  productId,
  productName,
  onCOAAttached,
}: COAPickerModalProps) {
  const insets = useSafeAreaInsets()
  const { vendor } = useAppAuth()

  const [activeSource, setActiveSource] = useState<COASource>('attached')
  const [attachedCOAs, setAttachedCOAs] = useState<COA[]>([])
  const [libraryCOAs, setLibraryCOAs] = useState<COA[]>([])
  const [loadingAttached, setLoadingAttached] = useState(false)
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Smart match: calculate similarity score between product name and COA
  const getMatchScore = (coa: COA): number => {
    if (!productName) return 0

    // Normalize string for comparison
    const normalize = (str: string) =>
      str.toLowerCase()
        .replace(/[^a-z0-9]/g, '')  // Remove all non-alphanumeric

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

    return 0  // No match - be strict
  }

  // Filter COAs based on search query
  const filterCOAs = (coas: COA[], query: string): COA[] => {
    if (!query.trim()) return coas
    const lowerQuery = query.toLowerCase().trim()
    return coas.filter((coa) => {
      const fileName = coa.file_name?.toLowerCase() || ''
      const labName = coa.lab_name?.toLowerCase() || ''
      const thc = coa.test_results?.thc?.toString() || ''
      const cbd = coa.test_results?.cbd?.toString() || ''
      return (
        fileName.includes(lowerQuery) ||
        labName.includes(lowerQuery) ||
        thc.includes(lowerQuery) ||
        cbd.includes(lowerQuery)
      )
    })
  }

  // Sort COAs with smart matches first
  const sortByMatch = (coas: COA[]): COA[] => {
    return [...coas].sort((a, b) => getMatchScore(b) - getMatchScore(a))
  }

  const filteredAttachedCOAs = useMemo(
    () => filterCOAs(attachedCOAs, searchQuery),
    [attachedCOAs, searchQuery]
  )

  const filteredLibraryCOAs = useMemo(
    () => sortByMatch(filterCOAs(libraryCOAs, searchQuery)),
    [libraryCOAs, searchQuery, productName]
  )

  // Load COAs when modal opens
  useEffect(() => {
    if (visible && vendor?.id) {
      setSearchQuery('') // Reset search when modal opens
      loadAttachedCOAs()
      loadLibraryCOAs()
    }
  }, [visible, vendor?.id, productId])

  const loadAttachedCOAs = async () => {
    try {
      setLoadingAttached(true)
      const coas = await getCOAsForProduct(productId)
      setAttachedCOAs(coas)
    } catch (error) {
      logger.error('[COAPickerModal] Failed to load attached COAs:', error)
    } finally {
      setLoadingAttached(false)
    }
  }

  const loadLibraryCOAs = async () => {
    if (!vendor?.id) return
    try {
      setLoadingLibrary(true)
      const coas = await getCOAsForVendor(vendor.id)
      // Filter out already attached COAs
      const unattached = coas.filter((coa) => coa.product_id !== productId)
      setLibraryCOAs(unattached)
    } catch (error) {
      logger.error('[COAPickerModal] Failed to load library COAs:', error)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const handleUploadNew = async () => {
    if (!vendor?.id) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setUploading(true)

      // Pick document
      const doc = await pickCOADocument()
      if (!doc) {
        setUploading(false)
        return
      }

      // Upload file
      const uploadResult = await uploadCOAFile({
        vendorId: vendor.id,
        productId,
        uri: doc.uri,
        fileName: doc.name,
        fileType: doc.mimeType,
      })

      // Create record linked to product
      await createCOA({
        vendorId: vendor.id,
        productId,
        fileName: doc.name,
        fileUrl: uploadResult.url,
        fileSize: uploadResult.size,
        fileType: doc.mimeType,
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onCOAAttached()
      onClose()
    } catch (error) {
      logger.error('[COAPickerModal] Upload failed:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Upload Failed', 'Could not upload the document. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleSelectFromLibrary = async (coa: COA) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      await linkCOAToProduct(coa.id, productId)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onCOAAttached()
      onClose()
    } catch (error) {
      logger.error('[COAPickerModal] Failed to link COA:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleViewCOA = (coa: COA) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (coa.file_url) {
      Linking.openURL(coa.file_url).catch((err) => {
        logger.error('[COAPickerModal] Failed to open COA:', err)
      })
    }
  }

  const handleDeleteCOA = (coa: COA, isAttached: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const message = isAttached
      ? `Delete "${coa.file_name}"?\n\nThis will permanently remove it from this product and your library.`
      : `Delete "${coa.file_name}" from your library?\n\nThis will permanently delete the file and cannot be undone.`

    Alert.alert('Delete COA', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Extract file path from URL for storage deletion
            // URL format: https://xxx.supabase.co/storage/v1/object/public/vendor-coas/[path]
            const urlParts = coa.file_url?.split('/vendor-coas/') || []
            const filePath = urlParts[1] || coa.file_name || ''

            // Permanently delete from storage AND database
            await permanentlyDeleteCOA(coa.id, filePath)

            // Remove from BOTH local states immediately for instant feedback
            setAttachedCOAs((prev) => prev.filter((c) => c.id !== coa.id))
            setLibraryCOAs((prev) => prev.filter((c) => c.id !== coa.id))
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            onCOAAttached() // Refresh parent
          } catch (error) {
            logger.error('[COAPickerModal] Delete failed:', error)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            Alert.alert('Error', 'Failed to delete COA. Please try again.')
          }
        },
      },
    ])
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
              setAttachedCOAs((prev) => prev.filter((c) => c.id !== coa.id))
              // Add back to library list
              setLibraryCOAs((prev) => [{ ...coa, product_id: null }, ...prev])
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              onCOAAttached() // Refresh parent
            } catch (error) {
              logger.error('[COAPickerModal] Remove failed:', error)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            }
          },
        },
      ]
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return '#34c759'
      case 'expiring': return '#ff9500'
      case 'expired': return '#ff3b30'
      default: return '#34c759'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'valid': return 'Valid'
      case 'expiring': return 'Expiring'
      case 'expired': return 'Expired'
      default: return 'Valid'
    }
  }

  const renderCOAItem = ({ item, isLibrary }: { item: COA; isLibrary?: boolean }) => {
    const status = getCOAStatus(item)
    const isAttached = !isLibrary
    const matchScore = getMatchScore(item)
    const isMatch = matchScore >= 50

    return (
      <View style={[styles.coaItem, isMatch && styles.coaItemMatch]}>
        <Pressable
          style={styles.coaContent}
          onPress={() => isLibrary ? handleSelectFromLibrary(item) : handleViewCOA(item)}
        >
          <View style={[styles.coaIcon, isMatch && styles.coaIconMatch]}>
            <Ionicons name="document-text" size={24} color={isMatch ? '#34c759' : '#ff3b30'} />
          </View>
          <View style={styles.coaInfo}>
            <View style={styles.coaNameRow}>
              <Text style={styles.coaName} numberOfLines={1}>{item.file_name}</Text>
              {isMatch && (
                <View style={styles.matchBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#34c759" />
                  <Text style={styles.matchBadgeText}>Match</Text>
                </View>
              )}
            </View>
            <View style={styles.coaMeta}>
              {item.lab_name && <Text style={styles.coaMetaText}>{item.lab_name}</Text>}
              {item.test_date && (
                <>
                  {item.lab_name && <Text style={styles.coaMetaDot}>•</Text>}
                  <Text style={styles.coaMetaText}>{formatDate(item.test_date)}</Text>
                </>
              )}
            </View>
            {item.test_results?.thc && (
              <View style={styles.cannabinoids}>
                <Text style={styles.cannabinoidText}>THC: {item.test_results.thc}%</Text>
                {item.test_results?.cbd && (
                  <Text style={styles.cannabinoidText}>CBD: {item.test_results.cbd}%</Text>
                )}
              </View>
            )}
          </View>
          <View style={styles.coaStatus}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
            {isLibrary ? (
              <Ionicons name="add-circle" size={24} color="#34c759" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="rgba(235,235,245,0.3)" />
            )}
          </View>
        </Pressable>
        {/* Action buttons */}
        <View style={styles.coaActions}>
          {isAttached && (
            <Pressable
              style={styles.actionButton}
              onPress={() => handleRemoveCOA(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="link-outline" size={18} color="rgba(235,235,245,0.5)" />
            </Pressable>
          )}
          <Pressable
            style={styles.actionButton}
            onPress={() => handleDeleteCOA(item, isAttached)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color="#ff453a" />
          </Pressable>
        </View>
      </View>
    )
  }

  const renderAttachedList = () => {
    if (loadingAttached) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading COAs...</Text>
        </View>
      )
    }

    if (attachedCOAs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={60} color="rgba(235,235,245,0.2)" />
          <Text style={styles.emptyTitle}>No COAs Attached</Text>
          <Text style={styles.emptySubtitle}>
            Upload a new COA or attach one from your library
          </Text>
        </View>
      )
    }

    if (searchQuery && filteredAttachedCOAs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={60} color="rgba(235,235,245,0.2)" />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptySubtitle}>
            No attached COAs match "{searchQuery}"
          </Text>
        </View>
      )
    }

    return (
      <FlatList
        data={filteredAttachedCOAs}
        renderItem={({ item }) => renderCOAItem({ item, isLibrary: false })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    )
  }

  const renderLibraryList = () => {
    if (loadingLibrary) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading library...</Text>
        </View>
      )
    }

    if (libraryCOAs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={60} color="rgba(235,235,245,0.2)" />
          <Text style={styles.emptyTitle}>Library Empty</Text>
          <Text style={styles.emptySubtitle}>
            Upload your first COA to build your library
          </Text>
        </View>
      )
    }

    if (searchQuery && filteredLibraryCOAs.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={60} color="rgba(235,235,245,0.2)" />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptySubtitle}>
            No library COAs match "{searchQuery}"
          </Text>
        </View>
      )
    }

    return (
      <FlatList
        data={filteredLibraryCOAs}
        renderItem={({ item }) => renderCOAItem({ item, isLibrary: true })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    )
  }

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
            {productName && (
              <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
            )}
            <Text style={styles.headerTitle}>Lab Results (COA)</Text>
          </View>
          <Pressable onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>

        {/* Source Tabs */}
        <View style={styles.tabsContainer}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setActiveSource('attached')
            }}
            style={[styles.tab, activeSource === 'attached' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeSource === 'attached' && styles.tabTextActive]}>
              Attached
            </Text>
            {attachedCOAs.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{attachedCOAs.length}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setActiveSource('library')
            }}
            style={[styles.tab, activeSource === 'library' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeSource === 'library' && styles.tabTextActive]}>
              My Library
            </Text>
            {libraryCOAs.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{libraryCOAs.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="rgba(235,235,245,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, lab, THC, CBD..."
              placeholderTextColor="rgba(235,235,245,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color="rgba(235,235,245,0.4)" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Upload Button */}
        <Pressable
          onPress={handleUploadNew}
          style={styles.uploadButton}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.uploadText}>Upload COA</Text>
            </>
          )}
        </Pressable>

        {/* COA List */}
        <View style={styles.listContainer}>
          {activeSource === 'attached' ? renderAttachedList() : renderLibraryList()}
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
  },
  headerLeft: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
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

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // Search Bar
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchBar: {
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
    paddingVertical: 0,
  },

  // Upload Button
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },

  // List
  listContainer: {
    flex: 1,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  coaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    gap: 12,
  },
  coaItemMatch: {
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.3)',
  },
  coaIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,59,48,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coaIconMatch: {
    backgroundColor: 'rgba(52,199,89,0.2)',
  },
  coaInfo: {
    flex: 1,
    gap: 2,
  },
  coaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coaName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34c759',
  },
  coaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coaMetaText: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.5)',
  },
  coaMetaDot: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.3)',
  },
  cannabinoids: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cannabinoidText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.7)',
  },
  coaContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
})
