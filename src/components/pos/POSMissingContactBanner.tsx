/**
 * POSMissingContactBanner
 *
 * Shows a non-intrusive banner when a selected customer is missing
 * email or phone. Prompts budtender to collect the info.
 *
 * Usage: Add to POSCart or customer selection area
 */

import { memo, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { useSelectedCustomer } from '@/stores/customer.store'
import { getCustomerContactStatus, formatMissingContactInfo } from '@/utils/customer-contact'

interface POSMissingContactBannerProps {
  onUpdateCustomer?: () => void
}

function POSMissingContactBanner({ onUpdateCustomer }: POSMissingContactBannerProps) {
  const customer = useSelectedCustomer()
  const contactStatus = getCustomerContactStatus(customer)

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onUpdateCustomer?.()
  }, [onUpdateCustomer])

  // Don't show if no customer or customer has complete contact info
  if (!customer || contactStatus.isComplete) {
    return null
  }

  const missing = formatMissingContactInfo(customer)
  const missingText = missing.join(' & ')

  // Different messaging based on what's missing
  let title: string
  let subtitle: string

  if (!contactStatus.hasRealEmail && !contactStatus.hasValidPhone) {
    title = '📧 Collect Contact Info'
    subtitle = 'Customer has no email or phone on file'
  } else if (!contactStatus.hasRealEmail) {
    title = '📧 Missing Email'
    subtitle = 'Add email to send receipts & updates'
  } else {
    title = '📱 Missing Phone'
    subtitle = 'Add phone for SMS updates'
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}. Tap to update customer information.`}
    >
      <LiquidGlassView
        effect="regular"
        colorScheme="dark"
        tintColor="rgba(255, 149, 0, 0.15)"
        style={[
          styles.banner,
          !isLiquidGlassSupported && styles.bannerFallback,
        ]}
      >
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.actionContainer}>
            <Text style={styles.actionText}>Update →</Text>
          </View>
        </View>
      </LiquidGlassView>
    </TouchableOpacity>
  )
}

const POSMissingContactBannerMemo = memo(POSMissingContactBanner)
export { POSMissingContactBannerMemo as POSMissingContactBanner }

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  banner: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  bannerFallback: {
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.subtle,
    letterSpacing: -0.1,
  },
  actionContainer: {
    paddingLeft: spacing.sm,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9500',
    letterSpacing: -0.1,
  },
})
