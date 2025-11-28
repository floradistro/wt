/**
 * MediaPickerModal
 * iOS-style edge-to-edge media gallery
 * Shows vendor's Supabase library + device photos
 *
 * Custom modal structure (not using FullScreenModal to avoid ScrollView nesting with FlatList)
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Modal,
  TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as MediaLibrary from 'expo-media-library'
import * as Haptics from 'expo-haptics'
import { useVendorMedia, type VendorMediaFile } from '@/hooks/useVendorMedia'
import { logger } from '@/utils/logger'

interface MediaPickerModalProps {
  visible: boolean
  onClose: () => void
  onSelect: (imageUri: string, isFromDevice: boolean) => void
  title?: string
}

type MediaSource = 'library' | 'device'

interface DevicePhoto {
  id: string
  uri: string
  filename: string | null
  width: number
  height: number
  creationTime: number
}

// Constants
const ITEM_SPACING = 2

export function MediaPickerModal({
  visible,
  onClose,
  onSelect,
  title = 'Choose Photo',
}: MediaPickerModalProps) {
  const { width } = useWindowDimensions()
  const { images: vendorImages, isLoading: vendorLoading } = useVendorMedia()

  const [activeSource, setActiveSource] = useState<MediaSource>('library')
  const [devicePhotos, setDevicePhotos] = useState<DevicePhoto[]>([])
  const [loadingDevice, setLoadingDevice] = useState(false)
  const [hasDevicePermission, setHasDevicePermission] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  // Calculate grid columns based on screen width
  const COLUMNS = width > 600 ? 4 : 3
  const itemSize = (width - ITEM_SPACING * (COLUMNS + 1)) / COLUMNS

  // Load device photos when switching to device tab
  useEffect(() => {
    if (activeSource === 'device' && visible) {
      loadDevicePhotos()
    }
  }, [activeSource, visible])

  const loadDevicePhotos = async () => {
    try {
      setLoadingDevice(true)

      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        logger.warn('[MediaPickerModal] Device photo permission denied')
        setHasDevicePermission(false)
        return
      }

      setHasDevicePermission(true)

      // Get recent photos
      const { assets } = await MediaLibrary.getAssetsAsync({
        first: 100,
        mediaType: 'photo',
        sortBy: ['creationTime'],
      })

      const photos: DevicePhoto[] = assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
      }))

      logger.info('[MediaPickerModal] Loaded device photos:', photos.length)
      setDevicePhotos(photos)
    } catch (error) {
      logger.error('[MediaPickerModal] Failed to load device photos:', error)
    } finally {
      setLoadingDevice(false)
    }
  }

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        logger.warn('[MediaPickerModal] Camera permission denied')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onSelect(result.assets[0].uri, true)
      }
    } catch (error) {
      logger.error('[MediaPickerModal] Failed to take photo:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleSelectVendorImage = (image: VendorMediaFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelect(image.url, false)
  }

  const handleSelectDevicePhoto = (photo: DevicePhoto) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelect(photo.uri, true)
  }

  const renderVendorImage = ({ item }: { item: VendorMediaFile }) => (
    <Pressable
      onPress={() => handleSelectVendorImage(item)}
      style={[styles.gridItem, { width: itemSize, height: itemSize }]}
    >
      <Image source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
    </Pressable>
  )

  const renderDevicePhoto = ({ item }: { item: DevicePhoto }) => (
    <Pressable
      onPress={() => handleSelectDevicePhoto(item)}
      style={[styles.gridItem, { width: itemSize, height: itemSize }]}
    >
      <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
    </Pressable>
  )

  const renderEmptyLibrary = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Images Yet</Text>
      <Text style={styles.emptySubtitle}>
        Upload your first product image using the camera or device library
      </Text>
    </View>
  )

  const renderEmptyDevice = () => {
    if (!hasDevicePermission) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Permission Required</Text>
          <Text style={styles.emptySubtitle}>
            Allow access to your photos to select images
          </Text>
        </View>
      )
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Photos</Text>
        <Text style={styles.emptySubtitle}>No photos found on this device</Text>
      </View>
    )
  }

  const insets = useSafeAreaInsets()

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header - Match FullScreenModal pattern */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder="Search photos..."
              placeholderTextColor="rgba(235,235,245,0.3)"
            />
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
            setActiveSource('library')
          }}
          style={[styles.tab, activeSource === 'library' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeSource === 'library' && styles.tabTextActive]}>
            My Library
          </Text>
          {vendorImages.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{vendorImages.length}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setActiveSource('device')
          }}
          style={[styles.tab, activeSource === 'device' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeSource === 'device' && styles.tabTextActive]}>
            Device Photos
          </Text>
          {devicePhotos.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{devicePhotos.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Camera Button */}
      <Pressable onPress={handleTakePhoto} style={styles.cameraButton}>
        <Text style={styles.cameraText}>Take Photo</Text>
      </Pressable>

      {/* Photos Grid */}
      <View style={styles.gridContainer}>
        {activeSource === 'library' ? (
          vendorLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading library...</Text>
            </View>
          ) : vendorImages.length === 0 ? (
            renderEmptyLibrary()
          ) : (
            <FlatList
              data={vendorImages}
              renderItem={renderVendorImage}
              keyExtractor={(item) => item.id}
              numColumns={COLUMNS}
              contentContainerStyle={styles.gridContent}
              columnWrapperStyle={{ gap: ITEM_SPACING }}
              showsVerticalScrollIndicator={false}
              key={`library-${COLUMNS}`}
            />
          )
        ) : loadingDevice ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading photos...</Text>
          </View>
        ) : devicePhotos.length === 0 ? (
          renderEmptyDevice()
        ) : (
          <FlatList
            data={devicePhotos}
            renderItem={renderDevicePhoto}
            keyExtractor={(item) => item.id}
            numColumns={COLUMNS}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={{ gap: ITEM_SPACING }}
            showsVerticalScrollIndicator={false}
            key={`device-${COLUMNS}`}
          />
        )}
      </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // Container - Match FullScreenModal
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
  searchBar: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 24, // Pill-shaped
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
  },
  doneButton: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24, // Pill-shaped
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

  // Camera Button - Pill-shaped, no blue
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24, // Pill-shaped
    backgroundColor: 'rgba(118, 118, 128, 0.24)', // Gray like modal standard
  },
  cameraText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff', // White text, no blue
    letterSpacing: -0.4,
  },

  // Grid
  gridContainer: {
    flex: 1,
    marginTop: 16,
  },
  gridContent: {
    padding: ITEM_SPACING,
    gap: ITEM_SPACING,
  },
  gridItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
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

  // Empty States
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
    lineHeight: 22,
  },
})
