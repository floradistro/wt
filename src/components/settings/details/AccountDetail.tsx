/**
 * AccountDetail - User account information display
 * Jobs Principle: Simple, focused account overview
 */

import { View, Text, StyleSheet, ScrollView, Image, Animated } from 'react-native'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import { DetailRow } from './DetailRow'
import { detailCommonStyles } from './detailCommon.styles'

interface User {
  email?: string
  user_metadata?: {
    full_name?: string
    phone?: string
  }
}

interface AccountDetailProps {
  user: User
  headerOpacity: Animated.Value
  vendorLogo?: string | null
}

export function AccountDetail({ user, headerOpacity, vendorLogo }: AccountDetailProps) {
  // Get user initials from email or metadata
  const userEmail = user?.email || 'user@example.com'
  const userName = user?.user_metadata?.full_name || userEmail.split('@')[0]
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <View style={styles.detailContainer}>
      {/* Fixed Header - appears on scroll */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>{userName}</Text>
      </Animated.View>

      {/* Fade Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: layout.contentStartTop, paddingBottom: layout.dockHeight, paddingRight: 0 }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
        }}
        scrollEventThrottle={16}
      >
        {/* Title Section with Vendor Logo */}
        <View style={styles.cardWrapper}>
          <View style={styles.titleSectionContainer}>
            <View style={styles.titleWithLogo}>
              {vendorLogo ? (
                <Image
                  source={{ uri: vendorLogo }}
                  style={styles.vendorLogoInline}
                  resizeMode="contain"
                  fadeDuration={0}
                  onError={(e) => logger.debug('[AccountDetail] Image load error:', e.nativeEvent.error)}
                  onLoad={() => logger.debug('[AccountDetail] Image loaded successfully')}
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.detailTitleLarge}>{userName}</Text>
                <Text style={styles.detailEmail}>{userEmail}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cards */}
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <View style={styles.cardDivider} />

              <DetailRow label="Name" value={userName} />
              <DetailRow label="Email" value={userEmail} />
              {user?.user_metadata?.phone && (
                <DetailRow label="Phone" value={user.user_metadata.phone} />
              )}
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  ...detailCommonStyles,
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  vendorLogoInline: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  detailTitleLarge: {
    ...typography.largeTitle,
    color: colors.text.primary,
  },
  detailEmail: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
  detailCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardInner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardTitle: {
    ...typography.headline,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: 'rgba(235,235,245,0.1)',
    marginVertical: spacing.md,
  },
})
