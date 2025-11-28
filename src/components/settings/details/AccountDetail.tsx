/**
 * AccountDetail - User account information display
 * Jobs Principle: Simple, focused account overview
 */

import { View, Text, StyleSheet, ScrollView, Animated, Pressable, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
// Removed LiquidGlassView - using plain View with borderless style
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { TitleSection } from '@/components/shared'
import { DetailRow } from './DetailRow'
import { detailCommonStyles } from './detailCommon.styles'
import { AuthorizeNetModal } from '../modals/AuthorizeNetModal'
import { usePaymentProcessorsSettingsStore } from '@/stores/payment-processors-settings.store'
import { useAppAuth } from '@/contexts/AppAuthContext'

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
  const { vendorId } = useAppAuth()
  const { processors, isLoading, loadProcessors } = usePaymentProcessorsSettingsStore()

  const [showAuthNetModal, setShowAuthNetModal] = useState(false)

  // Get user initials from email or metadata
  const userEmail = user?.email || 'user@example.com'
  const userName = user?.user_metadata?.full_name || userEmail.split('@')[0]
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Load payment processors
  useEffect(() => {
    if (vendorId) {
      loadProcessors(vendorId)
    }
  }, [vendorId])

  // Find e-commerce processor
  const ecommerceProcessor = processors.find(p => p.is_ecommerce_processor === true)

  const handleConfigureGateway = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowAuthNetModal(true)
  }

  const handleCloseModal = () => {
    setShowAuthNetModal(false)
  }

  const handleSaveGateway = () => {
    if (vendorId) {
      loadProcessors(vendorId)
    }
  }

  return (
    <>
    <View style={styles.detailContainer}>
      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight, paddingRight: 0 }}
      >
        {/* Title Section - Compact */}
        <TitleSection
          title={userName}
          logo={vendorLogo}
          subtitle={userEmail}
        />

        {/* Cards */}
        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <View style={styles.cardDivider} />

              <DetailRow label="Name" value={userName} />
              <DetailRow label="Email" value={userEmail} />
              {user?.user_metadata?.phone && (
                <DetailRow label="Phone" value={user.user_metadata.phone} />
              )}
            </View>
          </View>
        </View>

        {/* E-Commerce Payment Gateway Section */}
        <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>E-COMMERCE PAYMENT GATEWAY</Text>

        {isLoading ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.text.tertiary} />
            <Text style={{ ...typography.footnote, color: colors.text.tertiary, marginTop: spacing.sm }}>
              Loading gateway...
            </Text>
          </View>
        ) : ecommerceProcessor ? (
          <View style={styles.cardWrapper}>
            <View style={styles.detailCard}>
              <View style={styles.cardInner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                      <Text style={{ ...typography.headline, color: colors.text.primary, fontWeight: '600' }}>
                        {ecommerceProcessor.processor_name || 'Authorize.Net Gateway'}
                      </Text>
                      {ecommerceProcessor.is_active && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#10b98120', borderRadius: radius.xs }}>
                          <Text style={{ ...typography.caption2, color: '#10b981', fontWeight: '600' }}>
                            ACTIVE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ ...typography.footnote, color: colors.text.tertiary }}>
                      Authorize.Net • {ecommerceProcessor.environment === 'production' ? 'Production' : 'Sandbox'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <DetailRow
                  label="API Login ID"
                  value={ecommerceProcessor.authorizenet_api_login_id
                    ? `${ecommerceProcessor.authorizenet_api_login_id.substring(0, 4)}****${ecommerceProcessor.authorizenet_api_login_id.slice(-4)}`
                    : 'Not configured'}
                />
                <DetailRow
                  label="Transaction Key"
                  value={ecommerceProcessor.authorizenet_transaction_key ? '••••••••••••' : 'Not configured'}
                />
                {ecommerceProcessor.authorizenet_signature_key && (
                  <DetailRow
                    label="Signature Key"
                    value="Configured ✓"
                  />
                )}

                <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.xs }}>
                  <Pressable
                    onPress={handleConfigureGateway}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: radius.md,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ ...typography.body, color: colors.text.secondary }}>
                      Edit Configuration
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.cardWrapper}>
            <View style={styles.detailCard}>
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(96,165,250,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.xs,
                }}>
                  <Text style={{ fontSize: 24 }}>🌐</Text>
                </View>
                <Text style={{ ...typography.headline, color: colors.text.primary, fontWeight: '600' }}>
                  No Gateway Configured
                </Text>
                <Text style={{ ...typography.footnote, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.md }}>
                  Configure Authorize.Net to accept online payments from your Next.js website
                </Text>
                <Pressable
                  onPress={handleConfigureGateway}
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.lg,
                    backgroundColor: '#60A5FA20',
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: '#60A5FA',
                  }}
                >
                  <Text style={{ ...typography.body, color: '#60A5FA', fontWeight: '600' }}>
                    Configure Gateway
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>

    {/* Authorize.Net Modal */}
    <AuthorizeNetModal
      visible={showAuthNetModal}
      vendorId={vendorId || ''}
      existingProcessor={ecommerceProcessor}
      onClose={handleCloseModal}
      onSave={handleSaveGateway}
    />
    </>
  )
}

const styles = StyleSheet.create({
  ...detailCommonStyles,
  // Override detailCard to match AccountDetail specific styling
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
  cardSectionTitle: {
    ...typography.caption1,
    color: colors.text.tertiary,
    fontWeight: '600',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
})
