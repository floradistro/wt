/**
 * DeveloperToolsDetail - Developer tools and testing utilities
 * Jobs Principle: Power tools hidden from production, obvious in dev
 */

import { View, Text, StyleSheet, ScrollView, Image, Animated, Pressable, Alert, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { runAllSentryTests, quickSentryTest } from '@/utils/test-sentry'
import { DetailRow } from './DetailRow'

interface DeveloperToolsDetailProps {
  headerOpacity: Animated.Value
  vendorLogo?: string | null
}

export function DeveloperToolsDetail({ headerOpacity, vendorLogo }: DeveloperToolsDetailProps) {
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

const styles = StyleSheet.create({
  detailContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: layout.contentStartTop,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: layout.contentHorizontal,
    zIndex: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(235,235,245,0.1)',
  },
  fixedHeaderTitle: {
    ...typography.title2,
    color: colors.text.primary,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: layout.contentStartTop + 20,
    zIndex: 5,
  },
  detailScroll: {
    flex: 1,
  },
  cardWrapper: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: spacing.md,
  },
  titleSectionContainer: {
    marginBottom: spacing.md,
  },
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
  detailCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardInner: {
    padding: spacing.lg,
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
    backgroundColor: 'rgba(0,122,255,0.15)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.3)',
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
})
