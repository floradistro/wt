/**
 * ImagePreviewModal
 * Full-screen image preview matching our standard modal style
 * No blue - pill-shaped buttons - clean and minimal
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { getLargeImage } from '@/utils/image-transforms'

interface ImagePreviewModalProps {
  visible: boolean
  imageUrl: string | null
  onClose: () => void
  onChangePhoto: () => void
  onTakePhoto: () => void
  onRemovePhoto?: () => void
  loading?: boolean
  productName?: string
}

export function ImagePreviewModal({
  visible,
  imageUrl,
  onClose,
  onChangePhoto,
  onTakePhoto,
  onRemovePhoto,
  loading = false,
  productName,
}: ImagePreviewModalProps) {
  const handleChangePhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChangePhoto()
  }

  const handleTakePhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onTakePhoto()
  }

  const handleRemovePhoto = () => {
    if (onRemovePhoto) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onRemovePhoto()
    }
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
            {productName && (
              <Text style={styles.productName} numberOfLines={1}>
                {productName}
              </Text>
            )}
            <View style={styles.headerSpacer} />
          </View>

          {/* Image Container */}
          <View style={styles.imageContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Uploading...</Text>
              </View>
            ) : imageUrl ? (
              <Image
                source={{ uri: getLargeImage(imageUrl) || imageUrl }}
                style={styles.image}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderContainer}>
                <View style={styles.placeholderCircle}>
                  <Text style={styles.placeholderIcon}>+</Text>
                </View>
                <Text style={styles.placeholderText}>No Photo</Text>
                <Text style={styles.placeholderSubtext}>
                  Add a photo to showcase this product
                </Text>
              </View>
            )}
          </View>

          {/* Actions - Pill-shaped buttons matching modal standard */}
          <View style={styles.actions}>
            <Pressable onPress={handleChangePhoto} style={styles.button}>
              <Text style={styles.buttonText}>Choose from Library</Text>
            </Pressable>
            <Pressable onPress={handleTakePhoto} style={styles.button}>
              <Text style={styles.buttonText}>Take Photo</Text>
            </Pressable>
            {imageUrl && onRemovePhoto && (
              <Pressable onPress={handleRemovePhoto} style={styles.destructiveButton}>
                <Text style={styles.destructiveButtonText}>Remove Photo</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e', // Match modal standard - not black
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  productName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 16,
    letterSpacing: -0.4,
  },
  headerSpacer: {
    width: 80,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.6)',
  },
  placeholderContainer: {
    alignItems: 'center',
    gap: 16,
  },
  placeholderCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(118, 118, 128, 0.24)', // Match modal standard
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 60,
    fontWeight: '200',
    color: 'rgba(235,235,245,0.6)',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
  },
  placeholderSubtext: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  // Pill-shaped buttons matching modal standard
  button: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)', // No blue - gray like modal standard
    borderRadius: 24, // Pill-shaped
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  destructiveButton: {
    backgroundColor: 'rgba(118, 118, 128, 0.24)', // Gray background
    borderRadius: 24, // Pill-shaped
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ff3b30', // Red text for destructive action
    letterSpacing: -0.4,
  },
})
