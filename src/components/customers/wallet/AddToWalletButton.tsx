/**
 * AddToWalletButton Component
 * Apple Wallet integration button for iOS
 *
 * Downloads and opens .pkpass file which triggers iOS native "Add to Wallet" flow
 */

import React, { useState, memo } from 'react'
import { View, Text, Pressable, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, typography, spacing } from '@/theme/tokens'
import { walletActions, useWalletIsDownloading } from '@/stores/wallet.store'
import { logger } from '@/utils/logger'

interface AddToWalletButtonProps {
  customerId: string
  vendorId: string
  customerName?: string
  loyaltyPoints?: number
  compact?: boolean
  onPassDownloaded?: () => void // Callback when pass is successfully downloaded
}

export const AddToWalletButton = memo(({
  customerId,
  vendorId,
  customerName,
  loyaltyPoints = 0,
  compact = false,
  onPassDownloaded,
}: AddToWalletButtonProps) => {
  const isDownloading = useWalletIsDownloading()
  const [isSharing, setIsSharing] = useState(false)

  // Only show on iOS
  if (Platform.OS !== 'ios') {
    return null
  }

  const handleAddToWallet = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      logger.debug('[AddToWalletButton] Starting wallet pass download')

      // Download the pass (this also registers it in customer_wallet_passes)
      const fileUri = await walletActions.downloadPass(customerId, vendorId)

      // Notify parent that pass was downloaded (for instant UI update)
      if (fileUri && onPassDownloaded) {
        onPassDownloaded()
      }

      if (!fileUri) {
        Alert.alert(
          'Download Failed',
          'Unable to download your loyalty pass. Please try again.',
          [{ text: 'OK' }]
        )
        return
      }

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        Alert.alert(
          'Sharing Not Available',
          'Unable to open the pass. Please try again.',
          [{ text: 'OK' }]
        )
        return
      }

      // Share/open the .pkpass file - iOS will recognize it and show "Add to Wallet"
      setIsSharing(true)
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.apple.pkpass',
        dialogTitle: 'Add to Apple Wallet',
        UTI: 'com.apple.pkpass',
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      logger.debug('[AddToWalletButton] Pass shared successfully')

    } catch (error) {
      logger.error('[AddToWalletButton] Error adding to wallet:', error)
      Alert.alert(
        'Error',
        'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsSharing(false)
      // Clear the download after sharing
      walletActions.clearDownload()
    }
  }

  const isLoading = isDownloading || isSharing

  if (compact) {
    return (
      <Pressable
        style={[styles.compactButton, isLoading && styles.buttonDisabled]}
        onPress={handleAddToWallet}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.text.primary} />
        ) : (
          <>
            <Ionicons name="wallet-outline" size={18} color={colors.text.primary} />
            <Text style={styles.compactButtonText}>Add to Wallet</Text>
          </>
        )}
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleAddToWallet}
        disabled={isLoading}
      >
        <View style={styles.buttonContent}>
          <View style={styles.iconContainer}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="wallet" size={24} color="#000" />
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.buttonTitle}>
              {isLoading ? 'Preparing...' : 'Add to Apple Wallet'}
            </Text>
            {loyaltyPoints > 0 && (
              <Text style={styles.buttonSubtitle}>
                {loyaltyPoints.toLocaleString()} loyalty points
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.4)" />
        </View>
      </Pressable>
      <Text style={styles.hint}>
        Your loyalty card will be added to Apple Wallet for easy access
      </Text>
    </View>
  )
})

AddToWalletButton.displayName = 'AddToWalletButton'

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  buttonTitle: {
    ...typography.headline,
    color: '#000',
  },
  buttonSubtitle: {
    ...typography.footnote,
    color: 'rgba(0,0,0,0.6)',
  },
  hint: {
    ...typography.caption1,
    color: colors.text.subtle,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  // Compact styles
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  compactButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
})
