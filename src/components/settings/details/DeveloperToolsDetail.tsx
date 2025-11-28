/**
 * DeveloperToolsDetail - Developer tools and testing utilities
 * Jobs Principle: Power tools hidden from production, obvious in dev
 */

import { View, Text, StyleSheet, ScrollView, Animated, Pressable, Alert, ActivityIndicator, Switch } from 'react-native'
import { useState } from 'react'
// Removed LiquidGlassView - using plain View with borderless style
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { TitleSection } from '@/components/shared'
import { runAllSentryTests, quickSentryTest } from '@/utils/test-sentry'
import { createSamplePickupOrders, createSampleECommerceOrders } from '@/utils/create-sample-orders'
import { DetailRow } from './DetailRow'
import { detailCommonStyles } from './detailCommon.styles'
import { usePOSSession } from '@/contexts/POSSessionContext'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useOrdersActions } from '@/stores/orders.store'
import { useCurrentEnvironment, settingsUIActions } from '@/stores/settings-ui.store'
import Constants from 'expo-constants'

interface DeveloperToolsDetailProps {
  headerOpacity: Animated.Value
  vendorLogo?: string | null
}

export function DeveloperToolsDetail({ headerOpacity, vendorLogo }: DeveloperToolsDetailProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [isCreatingOrders, setIsCreatingOrders] = useState(false)
  const { clearSession, session } = usePOSSession()
  const { vendor, locations } = useAppAuth()
  const { refreshOrders } = useOrdersActions()
  const currentEnvironment = useCurrentEnvironment()

  // Get actual environment from Constants
  const actualEnvUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
  const isProdEnv = actualEnvUrl?.includes('uaednwpxursknmwdeejn')
  const isDevEnv = actualEnvUrl?.includes('zwcwrwctomlnvyswovhb')

  const handleEnvironmentToggle = () => {
    const targetEnv = currentEnvironment === 'dev' ? 'prod' : 'dev'
    const targetName = targetEnv === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT'

    Alert.alert(
      `Switch to ${targetName}?`,
      `⚠️ THIS REQUIRES APP RESTART\n\nYou need to:\n\n1. Stop Metro bundler (Ctrl+C)\n2. Update .env file to ${targetName}\n3. Run: npx expo start -c\n\nCurrent: ${isProdEnv ? 'PROD' : isDevEnv ? 'DEV' : 'Unknown'}\nTarget: ${targetName}\n\n${targetEnv === 'prod' ? '⚠️ PROD has REAL customer data!' : '✅ DEV is safe to test!'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Switch to ${targetName}`,
          style: targetEnv === 'prod' ? 'destructive' : 'default',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
            settingsUIActions.toggleEnvironment()
            Alert.alert(
              'Instructions',
              `To complete the switch to ${targetName}:\n\n` +
              '1. Stop Metro: Press Ctrl+C in terminal\n\n' +
              `2. Edit .env file:\n${targetEnv === 'prod'
                ? 'EXPO_PUBLIC_SUPABASE_URL=https://uaednwpxursknmwdeejn.supabase.co'
                : 'EXPO_PUBLIC_SUPABASE_URL=https://zwcwrwctomlnvyswovhb.supabase.co'}\n\n` +
              '3. Clear cache: npx expo start -c\n\n' +
              '4. App will restart with new environment',
              [{ text: 'Got It' }]
            )
          },
        },
      ]
    )
  }

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

  const handleClearPOSSession = () => {
    Alert.alert(
      'Clear POS Session?',
      'This will clear your current POS session and return you to the setup screen.\n\nUse this if you\'re stuck in a broken state.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Session',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            clearSession()
            Alert.alert(
              'Session Cleared',
              'POS session has been reset. You can now start a new session.',
              [{ text: 'OK' }]
            )
          },
        },
      ]
    )
  }

  const handleCreatePickupOrders = async () => {
    if (!vendor?.id) {
      Alert.alert('Error', 'Vendor ID not found')
      return
    }

    if (!session?.locationId) {
      Alert.alert(
        'No Active POS Session',
        'You need to start a POS session first!\n\nGo to POS → Select Location → Select Register to start a session.\n\nThis ensures orders are created for your current location so you can test notifications.',
        [{ text: 'OK' }]
      )
      return
    }

    Alert.alert(
      'Create Sample Pickup Orders?',
      `Location: ${session.locationName}\n\nThis will create 4 sample pickup orders:\n\n• 3 Pending orders\n• 1 Completed order\n\nYou'll receive notifications for these orders!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Orders',
          onPress: async () => {
            setIsCreatingOrders(true)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

            try {
              console.log('[DeveloperTools] Creating pickup orders with:', {
                vendorId: vendor.id,
                locationId: session.locationId,
                locationName: session.locationName
              })

              const result = await createSamplePickupOrders({
                vendorId: vendor.id,
                locationId: session.locationId,
              })

              console.log('[DeveloperTools] Created pickup orders:', result)

              // Refresh orders to show the new ones
              console.log('[DeveloperTools] Refreshing orders list...')
              await refreshOrders()

              Alert.alert(
                'Success',
                `Created ${result.count} sample pickup orders!\n\nVendor: ${vendor.store_name}\n\nGo to Orders > Store Pickup to see them.`,
                [{ text: 'OK' }]
              )
            } catch (err) {
              console.error('[DeveloperTools] Failed to create pickup orders:', err)
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to create orders',
                [{ text: 'OK' }]
              )
            } finally {
              setIsCreatingOrders(false)
            }
          },
        },
      ]
    )
  }

  const handleCreateECommerceOrders = async () => {
    if (!vendor?.id) {
      Alert.alert('Error', 'Vendor ID not found')
      return
    }

    if (!session?.locationId) {
      Alert.alert(
        'No Active POS Session',
        'You need to start a POS session first!\n\nGo to POS → Select Location → Select Register to start a session.\n\nThis ensures orders are created for your current location so you can test notifications.',
        [{ text: 'OK' }]
      )
      return
    }

    Alert.alert(
      'Create Sample E-Commerce Orders?',
      `Location: ${session.locationName}\n\nThis will create 6 sample shipping orders:\n\n• 4 Pending orders\n• 2 Completed/Shipped orders\n\nYou'll receive notifications for these orders!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Orders',
          onPress: async () => {
            setIsCreatingOrders(true)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

            try {
              console.log('[DeveloperTools] Creating e-commerce orders with:', {
                vendorId: vendor.id,
                locationId: session.locationId,
                locationName: session.locationName
              })

              const result = await createSampleECommerceOrders({
                vendorId: vendor.id,
                locationId: session.locationId,
              })

              console.log('[DeveloperTools] Created e-commerce orders:', result)

              // Refresh orders to show the new ones
              console.log('[DeveloperTools] Refreshing orders list...')
              await refreshOrders()

              Alert.alert(
                'Success',
                `Created ${result.count} sample e-commerce orders!\n\nVendor: ${vendor.store_name}\n\nGo to Orders > E-Commerce to see them.`,
                [{ text: 'OK' }]
              )
            } catch (err) {
              console.error('[DeveloperTools] Failed to create e-commerce orders:', err)
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to create orders',
                [{ text: 'OK' }]
              )
            } finally {
              setIsCreatingOrders(false)
            }
          },
        },
      ]
    )
  }

  return (
    <View style={styles.detailContainer}>
      <ScrollView
        style={styles.detailScroll}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight, paddingRight: 0 }}
      >
        <TitleSection
          title="Developer Tools"
          logo={vendorLogo}
          subtitle="Testing & debugging utilities"
        />

        {/* Environment Toggle */}
        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Environment</Text>
              <Text style={styles.cardDescription}>
                Switch between DEV and PROD databases
              </Text>
              <View style={styles.cardDivider} />

              <View style={styles.envToggleContainer}>
                <View style={styles.envInfo}>
                  <Text style={styles.envLabel}>Current Environment</Text>
                  <View style={styles.envBadgeContainer}>
                    <View style={[
                      styles.envBadge,
                      isProdEnv ? styles.envBadgeProd : styles.envBadgeDev
                    ]}>
                      <Text style={[
                        styles.envBadgeText,
                        isProdEnv ? styles.envBadgeTextProd : styles.envBadgeTextDev
                      ]}>
                        {isProdEnv ? '🔴 PRODUCTION' : isDevEnv ? '🟢 DEVELOPMENT' : '⚠️ Unknown'}
                      </Text>
                    </View>
                    <Text style={styles.envUrl}>
                      {isProdEnv
                        ? 'uaednwpxursknmwdeejn'
                        : isDevEnv
                        ? 'zwcwrwctomlnvyswovhb'
                        : 'Not configured'}
                    </Text>
                  </View>
                </View>

                <View style={styles.envSwitchContainer}>
                  <Text style={styles.envSwitchLabel}>
                    {currentEnvironment === 'dev' ? 'DEV' : 'PROD'}
                  </Text>
                  <Switch
                    value={currentEnvironment === 'prod'}
                    onValueChange={handleEnvironmentToggle}
                    trackColor={{ false: 'rgba(52,199,89,0.3)', true: 'rgba(255,59,48,0.3)' }}
                    thumbColor={currentEnvironment === 'prod' ? '#ff3b30' : '#34c759'}
                    ios_backgroundColor="rgba(255,255,255,0.1)"
                  />
                </View>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  {isProdEnv
                    ? '⚠️ You are connected to PRODUCTION with REAL customer data. Be careful!'
                    : '✅ You are connected to DEVELOPMENT. Safe to test and experiment!'}
                </Text>
              </View>

              <View style={[styles.infoBox, { marginTop: spacing.sm }]}>
                <Text style={styles.infoBoxText}>
                  💡 Toggle requires app restart: Stop Metro, update .env, then run npx expo start -c
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
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
          </View>
        </View>

        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>POS Session</Text>
              <Text style={styles.cardDescription}>
                Clear stuck POS session state
              </Text>
              <View style={styles.cardDivider} />

              <Pressable
                onPress={handleClearPOSSession}
                style={[styles.testButton, styles.testButtonLast]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Clear POS session"
                accessibilityHint="Double tap to reset POS session and return to setup"
              >
                <Text style={[styles.testButtonText, { color: '#ff3b30' }]} accessible={false}>Clear POS Session</Text>
                <Text style={styles.testButtonSubtext} accessible={false}>Reset session state (use if stuck)</Text>
              </Pressable>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  Use this if you're stuck in a partial session state after app restart. This will clear location, register, and session data.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>Sample Orders</Text>
              <Text style={styles.cardDescription}>
                Create test orders for workflow testing
              </Text>
              <View style={styles.cardDivider} />

              <Pressable
                onPress={handleCreatePickupOrders}
                disabled={isCreatingOrders}
                style={styles.testButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Create sample pickup orders"
                accessibilityHint="Double tap to create 4 sample pickup orders"
                accessibilityState={{ disabled: isCreatingOrders }}
              >
                {isCreatingOrders ? (
                  <ActivityIndicator color="rgba(52,199,89,0.8)" accessibilityElementsHidden={true} importantForAccessibility="no" />
                ) : (
                  <>
                    <Text style={[styles.testButtonText, { color: 'rgba(52,199,89,1)' }]} accessible={false}>Create Pickup Orders</Text>
                    <Text style={[styles.testButtonSubtext, { color: 'rgba(52,199,89,0.7)' }]} accessible={false}>4 orders • 3 Pending + 1 Completed</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={handleCreateECommerceOrders}
                disabled={isCreatingOrders}
                style={[styles.testButton, styles.testButtonLast]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Create sample e-commerce orders"
                accessibilityHint="Double tap to create 6 sample shipping orders"
                accessibilityState={{ disabled: isCreatingOrders }}
              >
                {isCreatingOrders ? (
                  <ActivityIndicator color="rgba(52,199,89,0.8)" accessibilityElementsHidden={true} importantForAccessibility="no" />
                ) : (
                  <>
                    <Text style={[styles.testButtonText, { color: 'rgba(52,199,89,1)' }]} accessible={false}>Create E-Commerce Orders</Text>
                    <Text style={[styles.testButtonSubtext, { color: 'rgba(52,199,89,0.7)' }]} accessible={false}>6 orders • 4 Pending + 2 Completed</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  Creates real orders in your database with sample customer data. Use these to test the pickup and e-commerce workflows in the Orders tab.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardWrapper}>
          <View style={styles.detailCard}>
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
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  ...detailCommonStyles,
  detailCard: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
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
  cardDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: 'rgba(235,235,245,0.1)',
    marginVertical: spacing.md,
  },
  testButton: {
    backgroundColor: 'rgba(0,122,255,0.15)', // Match product list - borderless
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  testButtonLast: {
    marginBottom: 0,
  },
  testButtonText: {
    ...typography.subhead,
    color: 'rgba(10,132,255,1)',
    marginBottom: 4,
  },
  testButtonSubtext: {
    ...typography.caption1,
    color: 'rgba(10,132,255,0.7)',
  },
  infoBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.sm,
  },
  infoBoxText: {
    ...typography.caption1,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  infoBoxLink: {
    ...typography.caption1,
    color: 'rgba(10,132,255,1)',
  },
  envToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  envInfo: {
    flex: 1,
  },
  envLabel: {
    ...typography.caption1,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  envBadgeContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  envBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  envBadgeDev: {
    backgroundColor: 'rgba(52,199,89,0.15)', // Match product list - borderless
  },
  envBadgeProd: {
    backgroundColor: 'rgba(255,59,48,0.15)', // Match product list - borderless
  },
  envBadgeText: {
    ...typography.caption1,
    fontWeight: '600',
  },
  envBadgeTextDev: {
    color: 'rgba(52,199,89,1)',
  },
  envBadgeTextProd: {
    color: 'rgba(255,59,48,1)',
  },
  envUrl: {
    ...typography.caption2,
    color: colors.text.tertiary,
    fontFamily: 'Menlo',
  },
  envSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  envSwitchLabel: {
    ...typography.caption1,
    color: colors.text.secondary,
    fontWeight: '600',
  },
})
