/**
 * Settings Screen - iPad Split-View Style
 * Jobs Principle: "Simple is hiding complexity, not removing it"
 *
 * Left sidebar: Categories (container, not full height)
 * Right panel: Selected category details
 * Just like iOS Settings on iPad
 */

import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Animated, TextInput, Image } from 'react-native'
import { memo, useState, useMemo, useRef, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useAuth, useAuthActions } from '@/stores/auth.store'
import { useUserLocations, type UserLocationAccess } from '@/hooks/useUserLocations'
import { useUsers, type UserWithLocations } from '@/hooks/useUsers'
import { useSuppliers, type Supplier } from '@/hooks/useSuppliers'
import { useLoyalty, type LoyaltyProgram } from '@/hooks/useLoyalty'
import { usePaymentProcessors, type PaymentProcessor } from '@/hooks/usePaymentProcessors'
import { runAllSentryTests, quickSentryTest } from '@/utils/test-sentry'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { UserManagementModals } from '@/components/settings/UserManagementModals'
import { SupplierManagementModals } from '@/components/settings/SupplierManagementModals'
import { PaymentProcessorModal } from '@/components/settings/PaymentProcessorModal'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// Monochrome Icons for Settings Categories

function UserIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.userIconCircle, { borderColor: color }]}>
        <View style={[styles.userIconHead, { backgroundColor: color }]} />
      </View>
      <View style={[styles.userIconBody, { borderColor: color }]} />
    </View>
  )
}

function LocationIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.locationIconPin, { borderColor: color }]}>
        <View style={[styles.locationIconDot, { backgroundColor: color }]} />
      </View>
    </View>
  )
}

function DevToolsIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      <View style={[styles.devToolsIcon, { borderColor: color }]}>
        <View style={[styles.devToolsChevron1, { borderColor: color }]} />
        <View style={[styles.devToolsChevron2, { borderColor: color }]} />
        <View style={[styles.devToolsUnderscore, { backgroundColor: color }]} />
      </View>
    </View>
  )
}

function TeamIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      {/* Two small user icons side by side */}
      <View style={styles.teamIconContainer}>
        <View style={[styles.teamIconUser, { borderColor: color }]}>
          <View style={[styles.teamIconHead, { backgroundColor: color }]} />
          <View style={[styles.teamIconBody, { borderColor: color }]} />
        </View>
        <View style={[styles.teamIconUser, { borderColor: color, marginLeft: -2 }]}>
          <View style={[styles.teamIconHead, { backgroundColor: color }]} />
          <View style={[styles.teamIconBody, { borderColor: color }]} />
        </View>
      </View>
    </View>
  )
}

function SuppliersIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      {/* Building/warehouse icon */}
      <View style={[styles.suppliersIconBuilding, { borderColor: color }]}>
        <View style={[styles.suppliersIconDoor, { borderColor: color }]} />
      </View>
    </View>
  )
}

function LoyaltyIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      {/* Star icon - simple five-pointed star */}
      <View style={[styles.loyaltyIconStar, { borderColor: color }]}>
        <View style={[styles.loyaltyIconSparkle, { backgroundColor: color }]} />
      </View>
    </View>
  )
}

function PaymentIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconContainer}>
      {/* Credit card icon */}
      <View style={[styles.paymentIconCard, { borderColor: color }]}>
        <View style={[styles.paymentIconStripe, { backgroundColor: color }]} />
      </View>
    </View>
  )
}


interface SettingsCategory {
  id: string
  title: string
  icon: React.ComponentType<{ color: string }>
  badge?: number
    // @ts-expect-error - React types issue
  renderDetail: () => JSX.Element
}

// Category detail views
function AccountDetail({ user, headerOpacity, vendorLogo }: { user: any; headerOpacity: Animated.Value; vendorLogo?: string | null }) {
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
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                  onError={(e) => logger.debug('[SettingsScreen] Image load error:', e.nativeEvent.error)}
                  onLoad={() => logger.debug('[SettingsScreen] Image loaded successfully')}
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

function DeveloperToolsDetail({ headerOpacity, vendorLogo }: { headerOpacity: Animated.Value; vendorLogo?: string | null }) {
  const [isRunning, setIsRunning] = useState(false)

  const handleQuickTest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    quickSentryTest()
    Alert.alert(
      'Test Sent',
      'Quick test message sent to Sentry.\n\nCheck your dashboard at:\nhttps://sentry.io/',
      [{ text: 'OK' }]
    )
  }

  const handleFullTest = async () => {
    Alert.alert(
      'Run All Sentry Tests?',
      'This will send 7 test events to Sentry over ~7 seconds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Tests',
          onPress: async () => {
            setIsRunning(true)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            await runAllSentryTests()
            setIsRunning(false)
            Alert.alert(
              'All Tests Complete',
              'Check your Sentry dashboard to see:\n\n' +
              '• 7 new errors in Issues\n' +
              '• 4 performance transactions\n' +
              '• Breadcrumbs & context\n' +
              '• Tags for filtering\n\n' +
              'Dashboard: https://sentry.io/',
              [{ text: 'OK' }]
            )
          },
        },
      ]
    )
  }

  return (
    <View style={styles.detailContainer}>
      {/* Fixed Header - appears on scroll */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Developer Tools</Text>
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
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <Text style={styles.detailTitleLarge}>Developer Tools</Text>
            </View>
          </View>
        </View>
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Sentry Integration</Text>
              <Text style={styles.cardDescription}>
                Test error tracking and performance monitoring
              </Text>
              <View style={styles.cardDivider} />

              <Pressable
                onPress={handleQuickTest}
                disabled={isRunning}
                style={styles.testButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Quick test, send one test message to Sentry"
                accessibilityHint="Double tap to send a test message"
                accessibilityState={{ disabled: isRunning }}
              >
                <Text style={styles.testButtonText} accessible={false}>Quick Test</Text>
                <Text style={styles.testButtonSubtext} accessible={false}>Send one test message</Text>
              </Pressable>

              <Pressable
                onPress={handleFullTest}
                disabled={isRunning}
                style={[styles.testButton, styles.testButtonLast]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={isRunning ? "Running tests" : "Run all tests, complete integration test, approximately 7 seconds"}
                accessibilityHint="Double tap to run all Sentry tests"
                accessibilityState={{ disabled: isRunning, busy: isRunning }}
              >
                {isRunning ? (
                  <ActivityIndicator color="rgba(235,235,245,0.6)" accessibilityElementsHidden={true} importantForAccessibility="no" />
                ) : (
                  <>
                    <Text style={styles.testButtonText} accessible={false}>Run All Tests</Text>
                    <Text style={styles.testButtonSubtext} accessible={false}>Complete integration test (~7s)</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  After running tests, check your Sentry dashboard at:
                </Text>
                <Text style={styles.infoBoxLink}>https://sentry.io/</Text>
              </View>
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>

        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>What Gets Tested</Text>
              <View style={styles.cardDivider} />

              <DetailRow label="Error Capture" value="Basic error reporting" />
              <DetailRow label="Breadcrumbs" value="Event trail before errors" />
              <DetailRow label="Context Data" value="Rich metadata" />
              <DetailRow label="Performance" value="Transaction tracking" />
              <DetailRow label="Payment Errors" value="Payment timeout simulation" />
              <DetailRow label="Health Checks" value="Terminal offline simulation" />
              <DetailRow label="Checkout Errors" value="Transaction save failures" />
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
      </ScrollView>
    </View>
  )
}

function LocationConfigurationDetail({
  location,
  processors,
  processorsLoading,
  processorsError,
  headerOpacity,
  onBack,
  onCreateProcessor,
  onUpdateProcessor,
  onDeleteProcessor,
  onTestConnection,
  onSetAsDefault,
  onToggleStatus,
  onReload,
}: {
  location: UserLocationAccess
  processors: PaymentProcessor[]
  processorsLoading: boolean
  processorsError: string | null
  headerOpacity: Animated.Value
  onBack: () => void
  onCreateProcessor: any
  onUpdateProcessor: any
  onDeleteProcessor: any
  onTestConnection: any
  onSetAsDefault: any
  onToggleStatus: any
  onReload: () => void
}) {
  const [showAddProcessorModal, setShowAddProcessorModal] = useState(false)
  const [editingProcessor, setEditingProcessor] = useState<PaymentProcessor | null>(null)
  const [testingProcessorId, setTestingProcessorId] = useState<string | null>(null)

  const handleAddProcessor = () => {
    setEditingProcessor(null)
    setShowAddProcessorModal(true)
  }

  const handleEditProcessor = (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingProcessor(processor)
    setShowAddProcessorModal(true)
  }

  const handleTestConnection = async (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTestingProcessorId(processor.id)

    const result = await onTestConnection(processor.id)
    setTestingProcessorId(null)

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert(
        'Test Successful ✓',
        result.message || '$1.00 test transaction approved.\n\nTerminal is online and ready to accept payments.',
        [{ text: 'OK', style: 'default' }]
      )
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert(
        'Test Failed ✗',
        result.error || 'Connection test failed. Please check your terminal and configuration.',
        [{ text: 'OK', style: 'cancel' }]
      )
    }
  }

  const handleSetAsDefault = async (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const result = await onSetAsDefault(processor.id)
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to set as default')
    }
  }

  const handleToggleStatus = async (processor: PaymentProcessor) => {
    const newStatus = !processor.is_active
    const statusText = newStatus ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} Processor`,
      `Are you sure you want to ${statusText} ${processor.processor_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onToggleStatus(processor.id, newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update processor status')
            }
          },
        },
      ]
    )
  }

  const handleDeleteProcessor = (processor: PaymentProcessor) => {
    Alert.alert(
      'Delete Processor',
      `Are you sure you want to permanently delete ${processor.processor_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            const result = await onDeleteProcessor(processor.id)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete processor')
            }
          },
        },
      ]
    )
  }

  const getProcessorTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      dejavoo: 'Dejavoo',
      stripe: 'Stripe',
      square: 'Square',
      authorizenet: 'Authorize.Net',
      clover: 'Clover',
    }
    return types[type] || type
  }

  const getTestStatusColor = (status?: string | null) => {
    if (status === 'success') return '#10b981'
    if (status === 'failed') return '#ef4444'
    return colors.text.quaternary
  }

  const formatAddress = () => {
    const parts = [
      location.location.address_line1,
      location.location.city,
      location.location.state,
      location.location.postal_code,
    ].filter(Boolean)
    return parts.join(', ') || 'No address'
  }

  const activeProcessors = processors.filter(p => p.is_active)
  const inactiveProcessors = processors.filter(p => !p.is_active)

  return (
    <View style={styles.detailContainer}>
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Pressable onPress={onBack} style={styles.fixedHeaderButton}>
          <Text style={styles.fixedHeaderButtonText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.fixedHeaderTitle}>{location.location.name}</Text>
        <View style={{ width: 70 }} />
      </Animated.View>

      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
        }}
        scrollEventThrottle={16}
      >
        <View style={[styles.cardWrapper, styles.titleRow]}>
          <Pressable
            onPress={onBack}
            style={[styles.addButton, { backgroundColor: colors.glass.regular }]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back to locations"
          >
            <Text style={[styles.addButtonText, { color: colors.text.secondary }]}>‹ Locations</Text>
          </Pressable>
          <Text style={styles.detailTitle}>{location.location.name}</Text>
        </View>

        {/* Location Info */}
        <Text style={[styles.cardSectionTitle, { marginTop: spacing.lg }]}>STORE INFORMATION</Text>
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            interactive
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={{ padding: spacing.md, gap: spacing.sm }}>
              <Text style={styles.formLabel}>ADDRESS</Text>
              <Text style={styles.locationConfigValue}>{formatAddress()}</Text>
              {location.location.phone && (
                <>
                  <Text style={[styles.formLabel, { marginTop: spacing.md }]}>PHONE</Text>
                  <Text style={styles.locationConfigValue}>{location.location.phone}</Text>
                </>
              )}
              {location.location.tax_rate !== undefined && location.location.tax_rate !== null && (
                <>
                  <Text style={[styles.formLabel, { marginTop: spacing.md }]}>TAX RATE</Text>
                  <Text style={styles.locationConfigValue}>
                    {(location.location.tax_rate * 100).toFixed(2)}% {location.location.tax_name || 'Sales Tax'}
                  </Text>
                </>
              )}
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>

        {/* Payment Processors Section */}
        <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>PAYMENT PROCESSORS</Text>

        {processorsLoading ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.text.tertiary} />
            <Text style={{ ...typography.footnote, color: colors.text.tertiary, marginTop: spacing.sm }}>
              Loading processors...
            </Text>
          </View>
        ) : processorsError ? (
          <View style={styles.cardWrapper}>
            <LiquidGlassView
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                <Text style={[styles.emptyStateText, { fontSize: 15, color: '#ef4444' }]}>Error loading processors</Text>
                <Text style={{ ...typography.footnote, color: colors.text.tertiary, textAlign: 'center' }}>
                  {processorsError}
                </Text>
                <Pressable
                  onPress={onReload}
                  style={[styles.addButton, { marginTop: spacing.sm }]}
                >
                  <Text style={styles.addButtonText}>Retry</Text>
                </Pressable>
              </View>
            </LiquidGlassView>
          </View>
        ) : activeProcessors.length === 0 ? (
          <View style={styles.cardWrapper}>
            <LiquidGlassView
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                <PaymentIcon color={colors.text.quaternary} />
                <Text style={[styles.emptyStateText, { fontSize: 15 }]}>No processors configured</Text>
                <Pressable
                  onPress={handleAddProcessor}
                  style={[styles.addButton, { marginTop: spacing.sm }]}
                >
                  <Text style={styles.addButtonText}>Add Processor</Text>
                </Pressable>
              </View>
            </LiquidGlassView>
          </View>
        ) : (
          <>
            <View style={[styles.cardWrapper, styles.titleRow]}>
              <Text style={{ ...typography.body, color: colors.text.secondary }}>
                {activeProcessors.length} active
              </Text>
              <Pressable onPress={handleAddProcessor} style={styles.addButton}>
                <Text style={styles.addButtonText}>Add Processor</Text>
              </Pressable>
            </View>

            {activeProcessors.map((processor) => {
              const isTesting = testingProcessorId === processor.id
              const lastTestDate = processor.last_tested_at ? new Date(processor.last_tested_at) : null
              const testStatus = processor.last_test_status

              return (
                <LiquidGlassContainerView key={processor.id} spacing={12} style={styles.cardWrapper}>
                  <LiquidGlassView
                    interactive
                    style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
                  >
                    <View style={{ padding: spacing.md }}>
                      {/* Header with name and badges */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                        <View style={{ flex: 1, gap: spacing.xs }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                            <Text style={styles.supplierCardName}>{processor.processor_name}</Text>
                            {processor.is_default && (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#60A5FA20', borderRadius: radius.xs }}>
                                <Text style={{ ...typography.caption2, color: '#60A5FA', fontWeight: '600' }}>DEFAULT</Text>
                              </View>
                            )}
                            {testStatus && (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: testStatus === 'success' ? '#10b98120' : '#ef444420', borderRadius: radius.xs }}>
                                <Text style={{ ...typography.caption2, color: testStatus === 'success' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                                  {testStatus === 'success' ? '● ONLINE' : '● OFFLINE'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ ...typography.footnote, color: colors.text.tertiary }}>
                            {getProcessorTypeLabel(processor.processor_type)} • {processor.environment === 'production' ? 'Production' : 'Sandbox'}
                          </Text>
                        </View>
                      </View>

                      {/* Test status details */}
                      {lastTestDate && (
                        <View style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.sm,
                          backgroundColor: colors.glass.thin,
                          borderRadius: radius.md,
                          marginBottom: spacing.md,
                          borderLeftWidth: 3,
                          borderLeftColor: getTestStatusColor(testStatus)
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ ...typography.caption2, color: colors.text.tertiary, textTransform: 'uppercase', marginBottom: 2 }}>
                                Last Test
                              </Text>
                              <Text style={{ ...typography.footnote, color: colors.text.secondary }}>
                                {lastTestDate.toLocaleDateString()} at {lastTestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text style={{ ...typography.headline, color: getTestStatusColor(testStatus), fontWeight: '600' }}>
                              {testStatus === 'success' ? '✓' : '✗'}
                            </Text>
                          </View>
                          {processor.last_test_error && testStatus === 'failed' && (
                            <Text style={{ ...typography.footnote, color: '#ef4444', marginTop: spacing.xs }}>
                              {processor.last_test_error}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* Action buttons */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                        <Pressable
                          onPress={() => handleTestConnection(processor)}
                          disabled={isTesting}
                          style={[
                            styles.userActionButton,
                            {
                              backgroundColor: isTesting ? colors.glass.thin : '#60A5FA20',
                              borderWidth: 1,
                              borderColor: isTesting ? colors.border.subtle : '#60A5FA40',
                            }
                          ]}
                        >
                          <Text style={[styles.userActionButtonText, { color: isTesting ? colors.text.tertiary : '#60A5FA', fontWeight: '600' }]}>
                            {isTesting ? 'Testing...' : 'Send Test $1.00'}
                          </Text>
                        </Pressable>
                        {!processor.is_default && (
                          <Pressable
                            onPress={() => handleSetAsDefault(processor)}
                            style={styles.userActionButton}
                          >
                            <Text style={styles.userActionButtonText}>Set Default</Text>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => handleEditProcessor(processor)}
                          style={styles.userActionButton}
                        >
                          <Text style={styles.userActionButtonText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleToggleStatus(processor)}
                          style={styles.userActionButton}
                        >
                          <Text style={styles.userActionButtonText}>Deactivate</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteProcessor(processor)}
                          style={[styles.userActionButton, styles.userActionButtonDanger]}
                        >
                          <Text style={styles.userActionButtonDangerText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </LiquidGlassView>
                </LiquidGlassContainerView>
              )
            })}

            {inactiveProcessors.length > 0 && (
              <>
                <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>INACTIVE</Text>
                {inactiveProcessors.map((processor) => (
                  <LiquidGlassContainerView key={processor.id} spacing={12} style={styles.cardWrapper}>
                    <LiquidGlassView
                      interactive
                      style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback, { opacity: 0.5 }]}
                    >
                      <View style={styles.supplierCard}>
                        <View style={styles.supplierCardHeader}>
                          <View style={styles.supplierCardInfo}>
                            <Text style={styles.supplierCardName}>{processor.processor_name}</Text>
                            <Text style={styles.supplierCardEmail}>
                              {getProcessorTypeLabel(processor.processor_type)} • {processor.environment}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.supplierCardActions}>
                          <Pressable
                            onPress={() => handleToggleStatus(processor)}
                            style={styles.userActionButton}
                          >
                            <Text style={styles.userActionButtonText}>Activate</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteProcessor(processor)}
                            style={[styles.userActionButton, styles.userActionButtonDanger]}
                          >
                            <Text style={styles.userActionButtonDangerText}>Delete</Text>
                          </Pressable>
                        </View>
                      </View>
                    </LiquidGlassView>
                  </LiquidGlassContainerView>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <PaymentProcessorModal
        visible={showAddProcessorModal}
        processor={editingProcessor}
        locationId={location.location.id}
        onClose={() => {
          setShowAddProcessorModal(false)
          setEditingProcessor(null)
        }}
        onCreate={onCreateProcessor}
        onUpdate={onUpdateProcessor}
      />
    </View>
  )
}

function LocationsDetail({
  userLocations,
  headerOpacity,
  paymentProcessors,
  processorsLoading,
  processorsError,
  createProcessor,
  updateProcessor,
  deleteProcessor,
  testConnection,
  setAsDefault,
  toggleProcessorStatus,
  reloadProcessors,
  vendorLogo,
}: {
  userLocations: UserLocationAccess[]
  headerOpacity: Animated.Value
  paymentProcessors: PaymentProcessor[]
  processorsLoading: boolean
  processorsError: string | null
  createProcessor: any
  updateProcessor: any
  deleteProcessor: any
  testConnection: any
  setAsDefault: any
  toggleProcessorStatus: any
  reloadProcessors: () => void
  vendorLogo?: string | null
}) {
  const [selectedLocation, setSelectedLocation] = useState<UserLocationAccess | null>(null)

  // If location selected, show detailed view
  if (selectedLocation) {
    const locationProcessors = paymentProcessors.filter(p => p.location_id === selectedLocation.location.id)

    return (
      <LocationConfigurationDetail
        location={selectedLocation}
        processors={locationProcessors}
        processorsLoading={processorsLoading}
        processorsError={processorsError}
        headerOpacity={headerOpacity}
        onBack={() => setSelectedLocation(null)}
        onCreateProcessor={createProcessor}
        onUpdateProcessor={updateProcessor}
        onDeleteProcessor={deleteProcessor}
        onTestConnection={testConnection}
        onSetAsDefault={setAsDefault}
        onToggleStatus={toggleProcessorStatus}
        onReload={reloadProcessors}
      />
    )
  }

  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      owner: 'Owner • Full Access',
      manager: 'Manager • Full Access',
      staff: 'Staff • POS Access',
    }
    return roleMap[role] || 'Access'
  }

  const formatAddress = (location: UserLocationAccess['location']) => {
    const parts = [
      location.address_line1,
      location.city,
      location.state,
    ].filter(Boolean)
    return parts.join(', ') || 'No address'
  }

  if (userLocations.length === 0) {
    return (
      <View style={styles.detailContainer}>
        <Text style={styles.detailTitle} accessibilityRole="header">Locations & Access</Text>
        <View
          style={styles.emptyState}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel="No locations assigned. Contact your administrator to get access."
        >
          <Text style={styles.emptyStateText} accessible={false}>No locations assigned</Text>
          <Text style={styles.emptyStateSubtext} accessible={false}>Contact your administrator to get access</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.detailContainer}>
      {/* Fixed Header - appears on scroll */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Locations & Access</Text>
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
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <Text style={styles.detailTitleLarge}>Locations & Access</Text>
            </View>
          </View>
        </View>
        {userLocations.map((userLocation) => {
          const locationAddress = formatAddress(userLocation.location)
          const roleDisplay = getRoleDisplay(userLocation.role)
          const accessibilityLabel = `${userLocation.location.name}. ${locationAddress}. ${roleDisplay}`

          return (
            <LiquidGlassContainerView key={userLocation.location.id} spacing={12} style={styles.cardWrapper}>
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                interactive
                style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedLocation(userLocation)
                  }}
                  style={styles.locationCard}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  accessibilityHint="Double tap to view location details"
                >
                  <View style={styles.locationIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                    <LocationIcon color={colors.text.primary} />
                  </View>
                  <View style={styles.locationInfo} accessible={false}>
                    <Text style={styles.locationName} accessible={false}>{userLocation.location.name}</Text>
                    <Text style={styles.locationAddress} accessible={false}>{locationAddress}</Text>
                    <Text style={styles.locationRole} accessible={false}>{roleDisplay}</Text>
                  </View>
                  <Text style={styles.chevron} accessibilityElementsHidden={true} importantForAccessibility="no">›</Text>
                </Pressable>
              </LiquidGlassView>
            </LiquidGlassContainerView>
          )
        })}
      </ScrollView>
    </View>
  )
}


// Helper component for detail rows
function DetailRow({
  label,
  value,
  subtitle,
  showChevron
}: {
  label: string
  value?: string
  subtitle?: string
  showChevron?: boolean
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowLeft}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        {subtitle && <Text style={styles.detailRowSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.detailRowRight}>
        {value && <Text style={styles.detailRowValue}>{value}</Text>}
        {showChevron && <Text style={styles.chevronSmall}>›</Text>}
      </View>
    </View>
  )
}

function UserManagementDetail({
  users,
  isLoading,
  headerOpacity,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onSetPassword,
  onAssignLocations,
  onToggleStatus,
  onReload,
  locations,
  vendorLogo,
}: {
  users: UserWithLocations[]
  isLoading: boolean
  headerOpacity: Animated.Value
  onCreateUser: any
  onUpdateUser: any
  onDeleteUser: any
  onSetPassword: any
  onAssignLocations: any
  onToggleStatus: any
  onReload: () => void
  locations: UserLocationAccess[]
  vendorLogo?: string | null
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithLocations | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showLocationsModal, setShowLocationsModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithLocations | null>(null)

  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      vendor_owner: 'Owner',
      vendor_admin: 'Admin',
      location_manager: 'Location Manager',
      pos_staff: 'POS Staff',
      inventory_staff: 'Inventory',
      readonly: 'Read Only',
    }
    return roleMap[role] || role
  }

  const getRoleBadgeColor = (role: string): string => {
    const roleColors: Record<string, string> = {
      vendor_owner: '#FF3B30',    // Red for Owner
      vendor_admin: '#FF3B30',    // Red for Admin
      location_manager: '#FF9500', // Orange for Location Manager
      pos_staff: '#34C759',       // Green for POS Staff
      inventory_staff: '#007AFF',  // Blue for Inventory
      readonly: colors.text.quaternary, // Gray for Read Only
    }
    return roleColors[role] || colors.text.quaternary
  }

  const handleAddUser = () => {
    setEditingUser(null)
    setShowAddModal(true)
  }

  const handleEditUser = (user: UserWithLocations) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingUser(user)
    setShowAddModal(true)
  }

  const handleSetPassword = (user: UserWithLocations) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedUser(user)
    setShowPasswordModal(true)
  }

  const handleAssignLocations = (user: UserWithLocations) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedUser(user)
    setShowLocationsModal(true)
  }

  const handleToggleStatus = async (user: UserWithLocations) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    const statusText = newStatus === 'active' ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} User`,
      `Are you sure you want to ${statusText} ${user.first_name} ${user.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onToggleStatus(user.id, newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update user status')
            }
          },
        },
      ]
    )
  }

  const handleDeleteUser = (user: UserWithLocations) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.first_name} ${user.last_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            const result = await onDeleteUser(user.id)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete user')
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={styles.detailContainer}>
        <View style={[styles.emptyState, { paddingTop: 100 }]}>
          <ActivityIndicator color={colors.text.tertiary} />
          <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading team...</Text>
        </View>
      </View>
    )
  }

  if (users.length === 0) {
    return (
      <View style={styles.detailContainer}>
        {/* Fixed Header */}
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Team</Text>
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
          scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
        >
          <View style={styles.cardWrapper}>
            <Text style={styles.detailTitle}>Team</Text>
          </View>

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <TeamIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No team members yet</Text>
            <Text style={styles.emptyStateSubtext}>Add users to manage your team</Text>
            <Pressable
              onPress={handleAddUser}
              style={styles.addButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add first team member"
            >
              <Text style={styles.addButtonText}>Add User</Text>
            </Pressable>
          </View>
        </ScrollView>

        <UserManagementModals
          showAddModal={showAddModal}
          showPasswordModal={showPasswordModal}
          showLocationsModal={showLocationsModal}
          editingUser={editingUser}
          selectedUser={selectedUser}
          locations={locations}
          onCloseAddModal={() => {
            setShowAddModal(false)
            setEditingUser(null)
          }}
          onClosePasswordModal={() => {
            setShowPasswordModal(false)
            setSelectedUser(null)
          }}
          onCloseLocationsModal={() => {
            setShowLocationsModal(false)
            setSelectedUser(null)
          }}
          onCreateUser={onCreateUser}
          onUpdateUser={onUpdateUser}
          onSetPassword={onSetPassword}
          onAssignLocations={onAssignLocations}
          onReload={onReload}
        />
      </View>
    )
  }

  return (
    <View style={styles.detailContainer}>
      {/* Fixed Header */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Team</Text>
        <Pressable
          onPress={handleAddUser}
          style={styles.fixedHeaderButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new team member"
        >
          <Text style={styles.fixedHeaderButtonText}>+</Text>
        </Pressable>
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
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailTitleLarge}>Team</Text>
                <Pressable
                  onPress={handleAddUser}
                  style={styles.addButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Add new team member"
                >
                  <Text style={styles.addButtonText}>Add User</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* User Cards */}
        {users.map((user) => {
          const roleBadgeColor = getRoleBadgeColor(user.role)

          return (
            <LiquidGlassContainerView key={user.id} spacing={12} style={styles.cardWrapper}>
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                interactive
                style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
              >
                <View style={styles.userCard}>
                  {/* User Info */}
                  <View style={styles.userCardHeader}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {user.first_name[0]}{user.last_name[0]}
                      </Text>
                    </View>
                    <View style={styles.userCardInfo}>
                      <View style={styles.userCardTitleRow}>
                        <Text style={styles.userCardName}>
                          {user.first_name} {user.last_name}
                        </Text>
                        {user.status !== 'active' && (
                          <View style={styles.inactiveBadge}>
                            <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.userCardEmail}>{user.email}</Text>
                      {user.phone && (
                        <Text style={styles.userCardPhone}>{user.phone}</Text>
                      )}
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + '20', borderColor: roleBadgeColor + '40' }]}>
                      <Text style={[styles.roleBadgeText, { color: roleBadgeColor }]}>
                        {getRoleDisplay(user.role)}
                      </Text>
                    </View>
                  </View>

                  {/* Location Count */}
                  {user.location_count > 0 && (
                    <View style={styles.userCardMeta}>
                      <Text style={styles.userCardMetaText}>
                        {user.location_count} {user.location_count === 1 ? 'location' : 'locations'}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.userCardActions}>
                    <Pressable
                      onPress={() => handleEditUser(user)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleSetPassword(user)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Set password for ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonText}>Password</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleAssignLocations(user)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Assign locations to ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonText}>Locations</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleToggleStatus(user)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={user.status === 'active' ? `Deactivate ${user.first_name} ${user.last_name}` : `Activate ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonText}>
                        {user.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteUser(user)}
                      style={[styles.userActionButton, styles.userActionButtonDanger]}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${user.first_name} ${user.last_name}`}
                    >
                      <Text style={styles.userActionButtonDangerText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </LiquidGlassView>
            </LiquidGlassContainerView>
          )
        })}
      </ScrollView>

      <UserManagementModals
        showAddModal={showAddModal}
        showPasswordModal={showPasswordModal}
        showLocationsModal={showLocationsModal}
        editingUser={editingUser}
        selectedUser={selectedUser}
        locations={locations}
        onCloseAddModal={() => {
          setShowAddModal(false)
          setEditingUser(null)
        }}
        onClosePasswordModal={() => {
          setShowPasswordModal(false)
          setSelectedUser(null)
        }}
        onCloseLocationsModal={() => {
          setShowLocationsModal(false)
          setSelectedUser(null)
        }}
        onCreateUser={onCreateUser}
        onUpdateUser={onUpdateUser}
        onSetPassword={onSetPassword}
        onAssignLocations={onAssignLocations}
        onReload={onReload}
      />
    </View>
  )
}

function SupplierManagementDetail({
  suppliers,
  isLoading,
  headerOpacity,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onToggleStatus,
  onReload,
  vendorLogo,
}: {
  suppliers: Supplier[]
  isLoading: boolean
  headerOpacity: Animated.Value
  onCreateSupplier: any
  onUpdateSupplier: any
  onDeleteSupplier: any
  onToggleStatus: any
  onReload: () => void
  vendorLogo?: string | null
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const handleAddSupplier = () => {
    setEditingSupplier(null)
    setShowAddModal(true)
  }

  const handleEditSupplier = (supplier: Supplier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingSupplier(supplier)
    setShowAddModal(true)
  }

  const handleToggleStatus = async (supplier: Supplier) => {
    const newStatus = !supplier.is_active
    const statusText = newStatus ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} Supplier`,
      `Are you sure you want to ${statusText} ${supplier.external_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onToggleStatus(supplier.id, newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update supplier status')
            }
          },
        },
      ]
    )
  }

  const handleDeleteSupplier = (supplier: Supplier) => {
    Alert.alert(
      'Delete Supplier',
      `Are you sure you want to permanently delete ${supplier.external_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            const result = await onDeleteSupplier(supplier.id)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete supplier')
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={styles.detailContainer}>
        <View style={[styles.emptyState, { paddingTop: 100 }]}>
          <ActivityIndicator color={colors.text.tertiary} />
          <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading suppliers...</Text>
        </View>
      </View>
    )
  }

  if (suppliers.length === 0) {
    return (
      <View style={styles.detailContainer}>
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Suppliers</Text>
        </Animated.View>

        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
        >
          <View style={styles.cardWrapper}>
            <Text style={styles.detailTitle}>Suppliers</Text>
          </View>

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <SuppliersIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No suppliers yet</Text>
            <Text style={styles.emptyStateSubtext}>Add suppliers for purchasing inventory</Text>
            <Pressable
              onPress={handleAddSupplier}
              style={styles.addButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add first supplier"
            >
              <Text style={styles.addButtonText}>Add Supplier</Text>
            </Pressable>
          </View>
        </ScrollView>

        <SupplierManagementModals
          showAddModal={showAddModal}
          editingSupplier={editingSupplier}
          onCloseAddModal={() => {
            setShowAddModal(false)
            setEditingSupplier(null)
          }}
          onCreateSupplier={onCreateSupplier}
          onUpdateSupplier={onUpdateSupplier}
          onReload={onReload}
        />
      </View>
    )
  }

  const activeSuppliers = suppliers.filter(s => s.is_active)
  const inactiveSuppliers = suppliers.filter(s => !s.is_active)

  return (
    <View style={styles.detailContainer}>
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Suppliers</Text>
        <Pressable
          onPress={handleAddSupplier}
          style={styles.fixedHeaderButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new supplier"
        >
          <Text style={styles.fixedHeaderButtonText}>+</Text>
        </Pressable>
      </Animated.View>

      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailTitleLarge}>Suppliers</Text>
                <Pressable
                  onPress={handleAddSupplier}
                  style={styles.addButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Add new supplier"
                >
                  <Text style={styles.addButtonText}>Add Supplier</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Active Suppliers */}
        {activeSuppliers.map((supplier) => (
          <LiquidGlassContainerView key={supplier.id} spacing={12} style={styles.cardWrapper}>
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={styles.supplierCard}>
                <View style={styles.supplierCardHeader}>
                  <View style={styles.supplierCardInfo}>
                    <Text style={styles.supplierCardName}>{supplier.external_name}</Text>
                    {supplier.contact_name && (
                      <Text style={styles.supplierCardContact}>{supplier.contact_name}</Text>
                    )}
                    {supplier.contact_email && (
                      <Text style={styles.supplierCardEmail}>{supplier.contact_email}</Text>
                    )}
                    {supplier.contact_phone && (
                      <Text style={styles.supplierCardPhone}>{supplier.contact_phone}</Text>
                    )}
                    {supplier.address && (
                      <Text style={styles.supplierCardAddress}>{supplier.address}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.supplierCardActions}>
                  <Pressable
                    onPress={() => handleEditSupplier(supplier)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${supplier.external_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleToggleStatus(supplier)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Deactivate ${supplier.external_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Deactivate</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteSupplier(supplier)}
                    style={[styles.userActionButton, styles.userActionButtonDanger]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${supplier.external_name}`}
                  >
                    <Text style={styles.userActionButtonDangerText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </LiquidGlassView>
          </LiquidGlassContainerView>
        ))}

        {/* Inactive Suppliers */}
        {inactiveSuppliers.length > 0 && (
          <>
            <View style={styles.cardWrapper}>
              <Text style={styles.sectionLabel}>INACTIVE</Text>
            </View>
            {inactiveSuppliers.map((supplier) => (
              <LiquidGlassContainerView key={supplier.id} spacing={12} style={styles.cardWrapper}>
                <LiquidGlassView
                  effect="regular"
                  colorScheme="dark"
                  interactive
                  style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback, { opacity: 0.5 }]}
                >
                  <View style={styles.supplierCard}>
                    <View style={styles.supplierCardHeader}>
                      <View style={styles.supplierCardInfo}>
                        <Text style={styles.supplierCardName}>{supplier.external_name}</Text>
                      </View>
                    </View>

                    <View style={styles.supplierCardActions}>
                      <Pressable
                        onPress={() => handleToggleStatus(supplier)}
                        style={styles.userActionButton}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Activate ${supplier.external_name}`}
                      >
                        <Text style={styles.userActionButtonText}>Activate</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteSupplier(supplier)}
                        style={[styles.userActionButton, styles.userActionButtonDanger]}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${supplier.external_name}`}
                      >
                        <Text style={styles.userActionButtonDangerText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </LiquidGlassView>
              </LiquidGlassContainerView>
            ))}
          </>
        )}
      </ScrollView>

      <SupplierManagementModals
        showAddModal={showAddModal}
        editingSupplier={editingSupplier}
        onCloseAddModal={() => {
          setShowAddModal(false)
          setEditingSupplier(null)
        }}
        onCreateSupplier={onCreateSupplier}
        onUpdateSupplier={onUpdateSupplier}
        onReload={onReload}
      />
    </View>
  )
}

function LoyaltyManagementDetail({
  program,
  isLoading,
  headerOpacity,
  onCreateProgram,
  onUpdateProgram,
  onToggleStatus,
  vendorLogo,
}: {
  program: LoyaltyProgram | null
  isLoading: boolean
  headerOpacity: Animated.Value
  onCreateProgram: any
  onUpdateProgram: any
  onToggleStatus: any
  vendorLogo?: string | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: 'Loyalty Rewards',
    points_per_dollar: '1.00',
    point_value: '0.01',
    min_redemption_points: '100',
    points_expiry_days: '365',
  })

  // Initialize form when program loads
  useEffect(() => {
    if (program) {
      setFormData({
        name: program.name || 'Loyalty Rewards',
        points_per_dollar: program.points_per_dollar.toString(),
        point_value: program.point_value.toString(),
        min_redemption_points: program.min_redemption_points.toString(),
        points_expiry_days: program.points_expiry_days?.toString() || '',
      })
    }
  }, [program])

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const data = {
      name: formData.name || 'Loyalty Rewards',
      points_per_dollar: parseFloat(formData.points_per_dollar) || 1.0,
      point_value: parseFloat(formData.point_value) || 0.01,
      min_redemption_points: parseInt(formData.min_redemption_points) || 100,
      points_expiry_days: formData.points_expiry_days ? parseInt(formData.points_expiry_days) : null,
    }

    let result
    if (program) {
      result = await onUpdateProgram(data)
    } else {
      result = await onCreateProgram(data)
    }

    if (result.success) {
      setIsEditing(false)
    } else {
      Alert.alert('Error', result.error || 'Failed to save loyalty program')
    }
  }

  const handleToggleStatus = async () => {
    if (!program) return

    const newStatus = !program.is_active
    const statusText = newStatus ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} Loyalty Program`,
      `Are you sure you want to ${statusText} the loyalty program?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onToggleStatus(newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update loyalty program status')
            }
          },
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={styles.detailContainer}>
        <View style={[styles.emptyState, { paddingTop: 100 }]}>
          <ActivityIndicator color={colors.text.tertiary} />
          <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading loyalty program...</Text>
        </View>
      </View>
    )
  }

  // Empty state - no program configured yet
  if (!program && !isEditing) {
    return (
      <View style={styles.detailContainer}>
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Loyalty & Rewards</Text>
        </Animated.View>

        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                  />
                ) : (
                  <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                  </View>
                )}
                <Text style={styles.detailTitleLarge}>Loyalty & Rewards</Text>
              </View>
            </View>
          </View>

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <LoyaltyIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No loyalty program configured</Text>
            <Text style={styles.emptyStateSubtext}>Set up a loyalty program to reward your customers</Text>
            <Pressable
              onPress={() => setIsEditing(true)}
              style={styles.addButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Configure loyalty program"
            >
              <Text style={styles.addButtonText}>Configure Program</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    )
  }

  // Show form when editing or creating
  if (isEditing || !program) {
    return (
      <View style={styles.detailContainer}>
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Loyalty & Rewards</Text>
        </Animated.View>

        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                  />
                ) : (
                  <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                  </View>
                )}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.detailTitleLarge}>Configure Loyalty Program</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Pressable
                      onPress={() => {
                        // Reset form data to program values when canceling
                        if (program) {
                          setFormData({
                            name: program.name || 'Loyalty Rewards',
                            points_per_dollar: program.points_per_dollar.toString(),
                            point_value: program.point_value.toString(),
                            min_redemption_points: program.min_redemption_points.toString(),
                            points_expiry_days: program.points_expiry_days?.toString() || '',
                          })
                        }
                        setIsEditing(false)
                      }}
                style={[styles.addButton, { backgroundColor: colors.glass.regular }]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.addButtonText, { color: colors.text.secondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={styles.addButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Save"
              >
                <Text style={styles.addButtonText}>Save</Text>
              </Pressable>
            </View>
                </View>
              </View>
            </View>
          </View>

          {/* Configuration Form */}
          <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
            <LiquidGlassView
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={{ padding: spacing.md, gap: spacing.md }}>
                {/* Points per Dollar */}
                <View>
                  <Text style={styles.formLabel}>Points per Dollar Spent</Text>
                  <Text style={styles.formHint}>How many points customers earn per dollar</Text>
                  <View style={styles.formInputWrapper}>
                    <TextInput
                      style={styles.formInput}
                      value={formData.points_per_dollar}
                      onChangeText={(text) => setFormData({ ...formData, points_per_dollar: text })}
                      keyboardType="decimal-pad"
                      placeholder="1.00"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>
                </View>

                {/* Point Value */}
                <View>
                  <Text style={styles.formLabel}>Point Value (USD)</Text>
                  <Text style={styles.formHint}>Dollar value of each point when redeemed</Text>
                  <View style={styles.formInputWrapper}>
                    <TextInput
                      style={styles.formInput}
                      value={formData.point_value}
                      onChangeText={(text) => setFormData({ ...formData, point_value: text })}
                      keyboardType="decimal-pad"
                      placeholder="0.01"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>
                </View>

                {/* Min Redemption */}
                <View>
                  <Text style={styles.formLabel}>Minimum Points to Redeem</Text>
                  <Text style={styles.formHint}>Minimum points required for redemption</Text>
                  <View style={styles.formInputWrapper}>
                    <TextInput
                      style={styles.formInput}
                      value={formData.min_redemption_points}
                      onChangeText={(text) => setFormData({ ...formData, min_redemption_points: text })}
                      keyboardType="number-pad"
                      placeholder="100"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>
                </View>

                {/* Expiry */}
                <View>
                  <Text style={styles.formLabel}>Points Expiry (Days)</Text>
                  <Text style={styles.formHint}>Days until points expire (leave empty for never)</Text>
                  <View style={styles.formInputWrapper}>
                    <TextInput
                      style={styles.formInput}
                      value={formData.points_expiry_days}
                      onChangeText={(text) => setFormData({ ...formData, points_expiry_days: text })}
                      keyboardType="number-pad"
                      placeholder="365 or leave empty"
                      placeholderTextColor={colors.text.quaternary}
                    />
                  </View>
                </View>
              </View>
            </LiquidGlassView>
          </LiquidGlassContainerView>
        </ScrollView>
      </View>
    )
  }

  // Display mode - show current configuration
  return (
    <View style={styles.detailContainer}>
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Loyalty & Rewards</Text>
        <Pressable
          onPress={() => setIsEditing(true)}
          style={styles.fixedHeaderButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Edit loyalty program"
        >
          <Text style={styles.fixedHeaderButtonText}>Edit</Text>
        </Pressable>
      </Animated.View>

      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailTitleLarge}>Loyalty & Rewards</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable
                    onPress={handleToggleStatus}
                    style={[styles.addButton, !program.is_active && { backgroundColor: colors.glass.regular }]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={program.is_active ? 'Deactivate program' : 'Activate program'}
                  >
                    <Text style={[styles.addButtonText, !program.is_active && { color: colors.text.secondary }]}>
                      {program.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setIsEditing(true)}
                    style={styles.addButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Edit program"
                  >
                    <Text style={styles.addButtonText}>Edit</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Program Configuration Card */}
        <LiquidGlassContainerView spacing={12} style={styles.cardWrapper}>
          <LiquidGlassView
            interactive
            style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
          >
            <View style={{ padding: spacing.md, gap: spacing.lg }}>
              {/* Status Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: program.is_active ? '#10b981' : colors.text.quaternary,
                  }}
                />
                <Text style={[styles.formHint, { marginBottom: 0 }]}>
                  {program.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>

              {/* Configuration Details */}
              <View style={{ gap: spacing.md }}>
                <View>
                  <Text style={styles.formLabel}>Points per Dollar</Text>
                  <Text style={styles.configValue}>{program.points_per_dollar}× points</Text>
                </View>

                <View>
                  <Text style={styles.formLabel}>Point Value</Text>
                  <Text style={styles.configValue}>${program.point_value.toFixed(4)} per point</Text>
                </View>

                <View>
                  <Text style={styles.formLabel}>Minimum Redemption</Text>
                  <Text style={styles.configValue}>{program.min_redemption_points} points</Text>
                </View>

                <View>
                  <Text style={styles.formLabel}>Points Expiry</Text>
                  <Text style={styles.configValue}>
                    {program.points_expiry_days ? `${program.points_expiry_days} days` : 'Never expires'}
                  </Text>
                </View>
              </View>

              {/* Example Calculation */}
              <View style={{ marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.border.subtle }}>
                <Text style={[styles.formHint, { marginBottom: spacing.xs }]}>Example:</Text>
                <Text style={styles.formHint}>
                  $100 purchase = {Math.floor(100 * program.points_per_dollar)} points = ${(100 * program.points_per_dollar * program.point_value).toFixed(2)} value
                </Text>
              </View>
            </View>
          </LiquidGlassView>
        </LiquidGlassContainerView>
      </ScrollView>
    </View>
  )
}

function PaymentProcessorsManagementDetail({
  processors,
  isLoading,
  headerOpacity,
  onCreateProcessor,
  onUpdateProcessor,
  onDeleteProcessor,
  onTestConnection,
  onSetAsDefault,
  onToggleStatus,
  onReload,
  vendorLogo,
}: {
  processors: PaymentProcessor[]
  isLoading: boolean
  headerOpacity: Animated.Value
  onCreateProcessor: any
  onUpdateProcessor: any
  onDeleteProcessor: any
  onTestConnection: any
  onSetAsDefault: any
  onToggleStatus: any
  onReload: () => void
  vendorLogo?: string | null
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProcessor, setEditingProcessor] = useState<PaymentProcessor | null>(null)

  const handleAddProcessor = () => {
    setEditingProcessor(null)
    setShowAddModal(true)
  }

  const handleEditProcessor = (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingProcessor(processor)
    setShowAddModal(true)
  }

  const handleTestConnection = async (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const result = await onTestConnection(processor.id)
    if (result.success) {
      Alert.alert('Success', 'Connection test successful')
    } else {
      Alert.alert('Test Failed', result.error || 'Connection test failed')
    }
  }

  const handleSetAsDefault = async (processor: PaymentProcessor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const result = await onSetAsDefault(processor.id)
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to set as default')
    }
  }

  const handleToggleStatus = async (processor: PaymentProcessor) => {
    const newStatus = !processor.is_active
    const statusText = newStatus ? 'activate' : 'deactivate'

    Alert.alert(
      `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} Processor`,
      `Are you sure you want to ${statusText} ${processor.processor_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusText.charAt(0).toUpperCase() + statusText.slice(1),
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            const result = await onToggleStatus(processor.id, newStatus)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to update processor status')
            }
          },
        },
      ]
    )
  }

  const handleDeleteProcessor = (processor: PaymentProcessor) => {
    Alert.alert(
      'Delete Processor',
      `Are you sure you want to permanently delete ${processor.processor_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            const result = await onDeleteProcessor(processor.id)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete processor')
            }
          },
        },
      ]
    )
  }

  const getProcessorTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      dejavoo: 'Dejavoo',
      stripe: 'Stripe',
      square: 'Square',
      authorizenet: 'Authorize.Net',
      clover: 'Clover',
    }
    return types[type] || type
  }

  const getTestStatusColor = (status?: string | null) => {
    if (status === 'success') return '#10b981'
    if (status === 'failed') return '#ef4444'
    return colors.text.quaternary
  }

  if (isLoading) {
    return (
      <View style={styles.detailContainer}>
        <View style={[styles.emptyState, { paddingTop: 100 }]}>
          <ActivityIndicator color={colors.text.tertiary} />
          <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading processors...</Text>
        </View>
      </View>
    )
  }

  if (processors.length === 0) {
    return (
      <View style={styles.detailContainer}>
        <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
          <Text style={styles.fixedHeaderTitle}>Payment Processors</Text>
        </Animated.View>

        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <ScrollView
          style={styles.detailScroll}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
          contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
        >
          <View style={styles.cardWrapper}>
            <Text style={styles.detailTitle}>Payment Processors</Text>
          </View>

          <View style={[styles.emptyState, { paddingTop: spacing.xxxl }]}>
            <View style={styles.emptyStateIcon}>
              <PaymentIcon color={colors.text.quaternary} />
            </View>
            <Text style={styles.emptyStateText}>No processors configured</Text>
            <Text style={styles.emptyStateSubtext}>Add a payment processor to accept payments</Text>
            <Pressable
              onPress={handleAddProcessor}
              style={styles.addButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add first processor"
            >
              <Text style={styles.addButtonText}>Add Processor</Text>
            </Pressable>
          </View>
        </ScrollView>

        <PaymentProcessorModal
          visible={showAddModal}
          processor={editingProcessor}
          onClose={() => {
            setShowAddModal(false)
            setEditingProcessor(null)
          }}
          onCreate={onCreateProcessor}
          onUpdate={onUpdateProcessor}
        />
      </View>
    )
  }

  const activeProcessors = processors.filter(p => p.is_active)
  const inactiveProcessors = processors.filter(p => !p.is_active)

  return (
    <View style={styles.detailContainer}>
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Payment Processors</Text>
        <Pressable
          onPress={handleAddProcessor}
          style={styles.fixedHeaderButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new processor"
        >
          <Text style={styles.fixedHeaderButtonText}>+</Text>
        </Pressable>
      </Animated.View>

      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
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
                />
              ) : (
                <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                </View>
              )}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.detailTitleLarge}>Payment Processors</Text>
                <Pressable
                  onPress={handleAddProcessor}
                  style={styles.addButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Add new processor"
                >
                  <Text style={styles.addButtonText}>Add Processor</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Active Processors */}
        {activeProcessors.map((processor) => (
          <LiquidGlassContainerView key={processor.id} spacing={12} style={styles.cardWrapper}>
            <LiquidGlassView
              interactive
              style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback]}
            >
              <View style={styles.supplierCard}>
                <View style={styles.supplierCardHeader}>
                  <View style={styles.supplierCardInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={styles.supplierCardName}>{processor.processor_name}</Text>
                      {processor.is_default && (
                        <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 2, backgroundColor: colors.glass.thin, borderRadius: radius.xs }}>
                          <Text style={{ ...typography.caption2, color: colors.text.tertiary }}>DEFAULT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.supplierCardEmail}>
                      {getProcessorTypeLabel(processor.processor_type)} • {processor.environment}
                    </Text>
                    {processor.last_tested_at && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getTestStatusColor(processor.last_test_status) }} />
                        <Text style={styles.supplierCardEmail}>
                          Last tested {new Date(processor.last_tested_at).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.supplierCardActions}>
                  <Pressable
                    onPress={() => handleTestConnection(processor)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Test ${processor.processor_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Test</Text>
                  </Pressable>
                  {!processor.is_default && (
                    <Pressable
                      onPress={() => handleSetAsDefault(processor)}
                      style={styles.userActionButton}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${processor.processor_name} as default`}
                    >
                      <Text style={styles.userActionButtonText}>Set Default</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => handleEditProcessor(processor)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${processor.processor_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleToggleStatus(processor)}
                    style={styles.userActionButton}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Deactivate ${processor.processor_name}`}
                  >
                    <Text style={styles.userActionButtonText}>Deactivate</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteProcessor(processor)}
                    style={[styles.userActionButton, styles.userActionButtonDanger]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${processor.processor_name}`}
                  >
                    <Text style={styles.userActionButtonDangerText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </LiquidGlassView>
          </LiquidGlassContainerView>
        ))}

        {/* Inactive Processors */}
        {inactiveProcessors.length > 0 && (
          <>
            <Text style={[styles.cardSectionTitle, { marginTop: spacing.xl }]}>INACTIVE</Text>
            {inactiveProcessors.map((processor) => (
              <LiquidGlassContainerView key={processor.id} spacing={12} style={styles.cardWrapper}>
                <LiquidGlassView
                  interactive
                  style={[styles.detailCard, !isLiquidGlassSupported && styles.cardFallback, { opacity: 0.5 }]}
                >
                  <View style={styles.supplierCard}>
                    <View style={styles.supplierCardHeader}>
                      <View style={styles.supplierCardInfo}>
                        <Text style={styles.supplierCardName}>{processor.processor_name}</Text>
                        <Text style={styles.supplierCardEmail}>
                          {getProcessorTypeLabel(processor.processor_type)} • {processor.environment}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.supplierCardActions}>
                      <Pressable
                        onPress={() => handleToggleStatus(processor)}
                        style={styles.userActionButton}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Activate ${processor.processor_name}`}
                      >
                        <Text style={styles.userActionButtonText}>Activate</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteProcessor(processor)}
                        style={[styles.userActionButton, styles.userActionButtonDanger]}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${processor.processor_name}`}
                      >
                        <Text style={styles.userActionButtonDangerText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </LiquidGlassView>
              </LiquidGlassContainerView>
            ))}
          </>
        )}
      </ScrollView>

      <PaymentProcessorModal
        visible={showAddModal}
        processor={editingProcessor}
        onClose={() => {
          setShowAddModal(false)
          setEditingProcessor(null)
        }}
        onCreate={onCreateProcessor}
        onUpdate={onUpdateProcessor}
      />
    </View>
  )
}

function SettingsScreen() {
  const { user } = useAuth()
  const { logout } = useAuthActions()
  const { locations: userLocations, isLoading: locationsLoading } = useUserLocations()
  const { users, isLoading: usersLoading, createUser, updateUser, deleteUser, setUserPassword, assignLocations, toggleUserStatus, reload: reloadUsers } = useUsers()
  const { suppliers, isLoading: suppliersLoading, createSupplier, updateSupplier, deleteSupplier, toggleSupplierStatus, reload: reloadSuppliers } = useSuppliers()
  const { program: loyaltyProgram, isLoading: loyaltyLoading, createProgram: createLoyaltyProgram, updateProgram: updateLoyaltyProgram, toggleProgramStatus: toggleLoyaltyStatus } = useLoyalty()
  const { processors: paymentProcessors, isLoading: processorsLoading, error: processorsError, createProcessor, updateProcessor, deleteProcessor, testConnection, setAsDefault, toggleStatus: toggleProcessorStatus, reload: reloadProcessors } = usePaymentProcessors()

  const [vendorLogo, setVendorLogo] = useState<string | null>(null)

  // iOS-style collapsing headers - instant transitions
  const accountHeaderOpacity = useRef(new Animated.Value(0)).current
  const locationsHeaderOpacity = useRef(new Animated.Value(0)).current
  const teamHeaderOpacity = useRef(new Animated.Value(0)).current
  const suppliersHeaderOpacity = useRef(new Animated.Value(0)).current
  const loyaltyHeaderOpacity = useRef(new Animated.Value(0)).current
  const processorsHeaderOpacity = useRef(new Animated.Value(0)).current
  const devToolsHeaderOpacity = useRef(new Animated.Value(0)).current

  // Load vendor info
  useEffect(() => {
    async function loadVendorInfo() {
      if (!user?.email) return
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('vendor_id, vendors(id, store_name, logo_url)')
          .eq('email', user.email)
          .single()

        if (userError) {
          logger.error('User query error', { error: userError })
          return
        }

        logger.debug('[SettingsScreen] Vendor data loaded:', {
          hasVendor: !!userData?.vendors,
          vendorData: userData?.vendors,
          logoUrl: (userData?.vendors as any)?.logo_url
        })

        if (userData?.vendors) {
          const vendor = userData.vendors as any
          setVendorLogo(vendor.logo_url || null)
          logger.debug('[SettingsScreen] Set vendor logo to:', vendor.logo_url)
        }
      } catch (error) {
        logger.error('Failed to load vendor info', { error })
      }
    }
    loadVendorInfo()
  }, [user])

  // Get user name for account category
  const userName = useMemo(() => {
    if (!user) return 'Account'
    return user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account'
  }, [user])

  // Categories configuration - only show what we have real data for
  const categories: SettingsCategory[] = useMemo(() => [
    { id: 'account', title: userName, icon: UserIcon, renderDetail: () => <AccountDetail user={user} headerOpacity={accountHeaderOpacity} vendorLogo={vendorLogo} /> },
    {
      id: 'locations',
      title: 'Locations & Access',
      icon: LocationIcon,
      badge: userLocations.length > 0 ? userLocations.length : undefined,
      renderDetail: () => <LocationsDetail userLocations={userLocations} headerOpacity={locationsHeaderOpacity} paymentProcessors={paymentProcessors} processorsLoading={processorsLoading} processorsError={processorsError} createProcessor={createProcessor} updateProcessor={updateProcessor} deleteProcessor={deleteProcessor} testConnection={testConnection} setAsDefault={setAsDefault} toggleProcessorStatus={toggleProcessorStatus} reloadProcessors={reloadProcessors} vendorLogo={vendorLogo} />
    },
    {
      id: 'team',
      title: 'Team',
      icon: TeamIcon,
      badge: users.length > 0 ? users.length : undefined,
      renderDetail: () => <UserManagementDetail users={users} isLoading={usersLoading} headerOpacity={teamHeaderOpacity} onCreateUser={createUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} onSetPassword={setUserPassword} onAssignLocations={assignLocations} onToggleStatus={toggleUserStatus} onReload={reloadUsers} locations={userLocations} vendorLogo={vendorLogo} />
    },
    {
      id: 'suppliers',
      title: 'Suppliers',
      icon: SuppliersIcon,
      badge: suppliers.length > 0 ? suppliers.length : undefined,
      renderDetail: () => <SupplierManagementDetail suppliers={suppliers} isLoading={suppliersLoading} headerOpacity={suppliersHeaderOpacity} onCreateSupplier={createSupplier} onUpdateSupplier={updateSupplier} onDeleteSupplier={deleteSupplier} onToggleStatus={toggleSupplierStatus} onReload={reloadSuppliers} vendorLogo={vendorLogo} />
    },
    {
      id: 'loyalty',
      title: 'Loyalty & Rewards',
      icon: LoyaltyIcon,
      renderDetail: () => <LoyaltyManagementDetail program={loyaltyProgram} isLoading={loyaltyLoading} headerOpacity={loyaltyHeaderOpacity} onCreateProgram={createLoyaltyProgram} onUpdateProgram={updateLoyaltyProgram} onToggleStatus={toggleLoyaltyStatus} vendorLogo={vendorLogo} />
    },
    {
      id: 'devtools',
      title: 'Developer Tools',
      icon: DevToolsIcon,
      renderDetail: () => <DeveloperToolsDetail headerOpacity={devToolsHeaderOpacity} vendorLogo={vendorLogo} />
    },
  ], [user, userName, userLocations, users, usersLoading, suppliers, suppliersLoading, loyaltyProgram, loyaltyLoading, paymentProcessors, processorsLoading, accountHeaderOpacity, locationsHeaderOpacity, teamHeaderOpacity, suppliersHeaderOpacity, loyaltyHeaderOpacity, devToolsHeaderOpacity, createUser, updateUser, deleteUser, setUserPassword, assignLocations, toggleUserStatus, reloadUsers, createSupplier, updateSupplier, deleteSupplier, toggleSupplierStatus, reloadSuppliers, createLoyaltyProgram, updateLoyaltyProgram, toggleLoyaltyStatus, createProcessor, updateProcessor, deleteProcessor, testConnection, setAsDefault, toggleProcessorStatus, reloadProcessors])

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('account')
  const [searchQuery, setSearchQuery] = useState('')

  // Convert categories to NavItems for NavSidebar
  const navItems: NavItem[] = useMemo(() =>
    categories.map(cat => ({
      id: cat.id,
      icon: cat.icon,
      label: cat.title,
      count: cat.badge,
    })),
    [categories]
  )

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId) || categories[0],
    [categories, selectedCategoryId]
  )

  const handleSignOut = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    await logout()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        {/* LEFT NAV SIDEBAR */}
        <NavSidebar
          width={375}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          items={navItems}
          activeItemId={selectedCategoryId}
          onItemPress={setSelectedCategoryId}
          footer={
            <View style={styles.footerWrapper}>
              <Pressable
                onPress={handleSignOut}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                accessibilityHint="Double tap to sign out of your account"
                style={styles.signOutButton}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
          }
        />

        {/* Right Detail Panel */}
        <View style={styles.detailPanel}>
          {selectedCategory.renderDetail()}
        </View>
      </View>
    </SafeAreaView>
  )
}

const SettingsScreenMemo = memo(SettingsScreen)
export { SettingsScreenMemo as SettingsScreen }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  // Footer
  footerWrapper: {
    paddingHorizontal: layout.cardPadding,
  },
  signOutButton: {
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#ff3b30',
    letterSpacing: -0.4,
    textAlign: 'center',
  },

  // Icon Styles
  iconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User Icon
  userIconCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconHead: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  userIconBody: {
    width: 12,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    marginTop: -2,
  },

  // Location Icon
  locationIconPin: {
    width: 12,
    height: 16,
    borderWidth: 1.5,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 0,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyStateText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.4,
    marginBottom: spacing.xxs,
  },
  emptyStateSubtext: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Right Detail Panel
  detailPanel: {
    flex: 1,
    backgroundColor: colors.background.primary,
    // No padding - children handle their own padding for scroll indicator positioning
  },
  detailContainer: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    paddingTop: 16,
    paddingBottom: 8,
  },
  detailScroll: {
    flex: 1,
  },

  // iOS Collapsing Headers - matches ProductsScreen exactly
  fixedHeader: {
    position: 'absolute',
    top: layout.cardPadding,
    left: 0,
    right: 0,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },

  // Detail Header (for Account)
  detailHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: spacing.lg,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.glass.ultraThick,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: spacing.sm,
  },
  avatarLargeText: {
    fontSize: 38,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 1,
  },
  titleSectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  vendorLogoInline: {
    width: 80,
    height: 80,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  detailTitleLarge: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  detailName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: 0.4,
    marginBottom: spacing.xxs,
  },
  detailEmail: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
    marginBottom: spacing.xxs,
  },
  detailRole: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },

  // Detail Cards
  cardWrapper: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginVertical: layout.contentVertical,
  },
  detailCard: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardInner: {
    padding: spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.quaternary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: spacing.xs,
  },

  // Detail Rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailRowLeft: {
    flex: 1,
    gap: 2,
  },
  detailRowLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  detailRowSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  detailRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailRowValue: {
    fontSize: 17,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.4,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.quaternary,
    marginTop: -2,
  },
  chevronSmall: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.quaternary,
    marginTop: -1,
  },

  // Location Cards
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  locationIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  locationName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  locationRole: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },

  // DevTools Icon
  devToolsIcon: {
    width: 16,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devToolsChevron1: {
    width: 5,
    height: 5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '-45deg' }],
    position: 'absolute',
    left: 2,
    top: 4,
  },
  devToolsChevron2: {
    width: 5,
    height: 5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '-45deg' }],
    position: 'absolute',
    left: 6,
    top: 4,
  },
  devToolsUnderscore: {
    width: 10,
    height: 1.5,
    position: 'absolute',
    bottom: 2,
    left: 3,
  },

  // Test Buttons
  cardDescription: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
    marginBottom: spacing.sm,
  },
  testButton: {
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.md,
    marginTop: spacing.sm,
    minHeight: 60,
    justifyContent: 'center',
  },
  testButtonLast: {
    marginBottom: 0,
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.9)',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  testButtonSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.1,
  },
  infoBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glass.ultraThin,
  },
  infoBoxText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  infoBoxLink: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
    letterSpacing: -0.1,
  },

  // Team Icon
  teamIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamIconUser: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamIconHead: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginTop: 1,
  },
  teamIconBody: {
    width: 8,
    height: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    marginTop: -1,
  },

  // User Management
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  emptyStateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.glass.ultraThin,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  fixedHeaderButton: {
    position: 'absolute',
    right: layout.cardPadding,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedHeaderButtonText: {
    fontSize: 20,
    fontWeight: '300',
    color: colors.text.primary,
    marginTop: -2,
  },

  // User Cards
  userCard: {
    padding: spacing.md,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
  userCardInfo: {
    flex: 1,
    gap: 2,
  },
  userCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userCardName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  userCardEmail: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  userCardPhone: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },
  roleBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inactiveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: '#ff3b3020',
    borderWidth: 1,
    borderColor: '#ff3b3040',
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ff3b30',
    letterSpacing: 0.8,
  },
  userCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userCardMetaText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },
  userCardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  userActionButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userActionButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  userActionButtonDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  userActionButtonDangerText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ff3b30',
    letterSpacing: -0.1,
  },

  // Suppliers Icon
  suppliersIconBuilding: {
    width: 14,
    height: 12,
    borderWidth: 1.5,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    position: 'relative',
  },
  suppliersIconDoor: {
    width: 4,
    height: 6,
    borderWidth: 1.5,
    position: 'absolute',
    bottom: 0,
    left: 4,
  },

  // Loyalty Icon
  loyaltyIconStar: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 8,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loyaltyIconSparkle: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Payment Icon
  paymentIconCard: {
    width: 16,
    height: 12,
    borderWidth: 1.5,
    borderRadius: 2,
    position: 'relative',
  },
  paymentIconStripe: {
    width: 12,
    height: 2,
    position: 'absolute',
    top: 3,
    left: 1,
  },

  // Form Styles
  formLabel: {
    ...typography.caption1,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.xxs,
  },
  formHint: {
    ...typography.footnote,
    color: colors.text.quaternary,
    marginBottom: spacing.xs,
  },
  formInputWrapper: {
    backgroundColor: colors.glass.thin,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
  },
  formInput: {
    ...typography.body,
    color: colors.text.primary,
  },
  configValue: {
    ...typography.title3,
    color: colors.text.primary,
    fontWeight: '600',
  },
  locationConfigValue: {
    ...typography.body,
    color: colors.text.primary,
  },

  // Supplier Cards
  supplierCard: {
    padding: spacing.md,
  },
  supplierCardHeader: {
    marginBottom: spacing.sm,
  },
  supplierCardInfo: {
    flex: 1,
    gap: 4,
  },
  supplierCardName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  supplierCardContact: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  supplierCardEmail: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  supplierCardPhone: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  supplierCardAddress: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  supplierCardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.quaternary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
})
