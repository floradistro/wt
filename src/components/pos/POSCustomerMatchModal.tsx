/**
 * POSCustomerMatchModal - Intelligent Customer Matching
 * The Apple Way: Make it feel magical
 *
 * Matching Levels:
 * 1. EXACT (100%) - Auto-select with brief confirmation
 * 2. HIGH (90%+) - Quick yes/no confirmation
 * 3. MEDIUM (70-89%) - Show options with details
 * 4. LOW (<70%) - Create new with manual search option
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { memo, useState, useEffect, useRef } from 'react'
import { colors, typography, spacing, radius, blur } from '@/theme/tokens'
import type { Customer } from '@/types/pos'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import { POSModal } from './POSModal'

const { width } = Dimensions.get('window')
const isTablet = width > 600

export type MatchConfidence = 'exact' | 'high' | 'medium' | 'low'

export interface CustomerMatch {
  customer: Customer
  confidence: MatchConfidence
  confidenceScore: number // 0-100
  matchedFields: string[] // ['name', 'dob', 'license']
  reason: string // Human-readable explanation
}

interface POSCustomerMatchModalProps {
  visible: boolean
  scannedData: AAMVAData | null
  matches: CustomerMatch[]
  onSelectCustomer: (customer: Customer) => void
  onCreateNew: () => void
  onSearchManually: () => void
  onClose: () => void
}

function POSCustomerMatchModal({
  visible,
  scannedData,
  matches,
  onSelectCustomer,
  onCreateNew,
  onSearchManually,
  onClose,
}: POSCustomerMatchModalProps) {
  const [autoSelectTimer, setAutoSelectTimer] = useState<NodeJS.Timeout | null>(null)
  const progressAnim = useRef(new Animated.Value(0)).current

  const bestMatch = matches[0]
  const hasMatches = matches.length > 0

  // EXACT MATCH: Auto-select after 1.5s with animation
  useEffect(() => {
    if (visible && bestMatch?.confidence === 'exact') {
      // Start progress bar animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }).start()

      const timer = setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onSelectCustomer(bestMatch.customer)
      }, 1500)

      setAutoSelectTimer(timer)

      return () => {
        if (timer) clearTimeout(timer)
        progressAnim.setValue(0)
      }
    }
  }, [visible, bestMatch])

  const handleSelectMatch = (match: CustomerMatch) => {
    if (autoSelectTimer) clearTimeout(autoSelectTimer)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSelectCustomer(match.customer)
  }

  const handleCreateNew = () => {
    if (autoSelectTimer) clearTimeout(autoSelectTimer)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCreateNew()
  }

  const handleSearchManually = () => {
    if (autoSelectTimer) clearTimeout(autoSelectTimer)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSearchManually()
  }

  const handleClose = () => {
    if (autoSelectTimer) clearTimeout(autoSelectTimer)
    onClose()
  }

  // Get title based on confidence
  const getTitle = () => {
    if (!hasMatches) return 'NEW CUSTOMER'
    if (bestMatch.confidence === 'exact') return 'CUSTOMER FOUND'
    if (bestMatch.confidence === 'high') return 'CONFIRM CUSTOMER'
    return 'POSSIBLE MATCHES'
  }

  const getSubtitle = () => {
    if (!hasMatches) return 'No existing profile found'
    if (bestMatch.confidence === 'exact') return 'Exact match - auto-selecting...'
    if (bestMatch.confidence === 'high') return 'Is this the right person?'
    return 'Select the correct customer or create new'
  }

  return (
    <POSModal
      visible={visible}
      title={getTitle()}
      subtitle={getSubtitle()}
      onClose={handleClose}
    >
      {/* EXACT MATCH: Auto-selecting with progress */}
      {bestMatch?.confidence === 'exact' && (
        <View style={styles.exactMatchContainer}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[
              styles.exactMatchCard,
              !isLiquidGlassSupported && styles.exactMatchCardFallback,
            ]}
          >
            <View style={styles.exactMatchHeader}>
              <View style={styles.checkmarkCircle}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
              <Text style={styles.exactMatchTitle}>EXACT MATCH</Text>
            </View>

            <Text style={styles.customerName}>
              {bestMatch.customer.display_name ||
                `${bestMatch.customer.first_name} ${bestMatch.customer.last_name}`}
            </Text>

            {bestMatch.customer.loyalty_points > 0 && (
              <Text style={styles.loyaltyPoints}>
                {bestMatch.customer.loyalty_points.toLocaleString()} points
              </Text>
            )}

            <Text style={styles.matchReason}>{bestMatch.reason}</Text>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>

            {/* Cancel auto-select */}
            <TouchableOpacity
              onPress={handleClose}
              style={styles.cancelAutoSelect}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelAutoSelectText}>TAP TO CANCEL</Text>
            </TouchableOpacity>
          </LiquidGlassView>
        </View>
      )}

      {/* HIGH/MEDIUM CONFIDENCE: Show matches */}
      {bestMatch && bestMatch.confidence !== 'exact' && (
        <View style={styles.matchesContainer}>
          {matches.slice(0, 3).map((match, index) => (
            <LiquidGlassView
              key={match.customer.id}
              effect="regular"
              colorScheme="dark"
              interactive
              style={[
                styles.matchCard,
                !isLiquidGlassSupported && styles.matchCardFallback,
              ]}
            >
              <TouchableOpacity
                onPress={() => handleSelectMatch(match)}
                style={styles.matchCardInner}
                activeOpacity={0.7}
              >
                <View style={styles.matchCardHeader}>
                  <Text style={styles.matchCardName}>
                    {match.customer.display_name ||
                      `${match.customer.first_name} ${match.customer.last_name}`}
                  </Text>
                  <View style={[
                    styles.confidenceBadge,
                    match.confidence === 'high' && styles.confidenceBadgeHigh,
                    match.confidence === 'medium' && styles.confidenceBadgeMedium,
                  ]}>
                    <Text style={styles.confidenceBadgeText}>
                      {match.confidenceScore}% MATCH
                    </Text>
                  </View>
                </View>

                {/* Customer Details */}
                <View style={styles.matchCardDetails}>
                  {match.customer.email && (
                    <Text style={styles.matchCardDetail}>{match.customer.email}</Text>
                  )}
                  {match.customer.phone && (
                    <Text style={styles.matchCardDetail}>{match.customer.phone}</Text>
                  )}
                  {match.customer.loyalty_points > 0 && (
                    <Text style={styles.matchCardDetail}>
                      {match.customer.loyalty_points.toLocaleString()} loyalty points
                    </Text>
                  )}
                </View>

                <Text style={styles.matchReason}>{match.reason}</Text>
              </TouchableOpacity>
            </LiquidGlassView>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {/* Create New Customer */}
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          interactive
          style={[
            styles.actionButton,
            !isLiquidGlassSupported && styles.actionButtonFallback,
          ]}
        >
          <TouchableOpacity
            style={styles.actionButtonInner}
            onPress={handleCreateNew}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>+ CREATE NEW</Text>
          </TouchableOpacity>
        </LiquidGlassView>

        {/* Search Manually */}
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          interactive
          style={[
            styles.actionButton,
            !isLiquidGlassSupported && styles.actionButtonFallback,
          ]}
        >
          <TouchableOpacity
            style={styles.actionButtonInner}
            onPress={handleSearchManually}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>🔍 SEARCH</Text>
          </TouchableOpacity>
        </LiquidGlassView>
      </View>
    </POSModal>
  )
}

const POSCustomerMatchModalMemo = memo(POSCustomerMatchModal)
export { POSCustomerMatchModalMemo as POSCustomerMatchModal }

const styles = StyleSheet.create({
  // Exact Match
  exactMatchContainer: {
    paddingHorizontal: spacing.xxxl,
    marginBottom: spacing.xl,
  },
  exactMatchCard: {
    borderRadius: radius.lg,
    borderCurve: 'continuous' as any,
    padding: spacing.xxxl,
    overflow: 'hidden',
    alignItems: 'center',
  },
  exactMatchCardFallback: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  exactMatchHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkmarkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  checkmarkText: {
    fontSize: 32,
    color: '#10b981',
  },
  exactMatchTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 2,
  },
  customerName: {
    fontSize: 24,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  loyaltyPoints: {
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(16,185,129,0.9)',
    letterSpacing: 0.3,
    marginBottom: spacing.md,
  },
  matchReason: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  cancelAutoSelect: {
    paddingVertical: spacing.sm,
  },
  cancelAutoSelectText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
  },

  // Matches List
  matchesContainer: {
    paddingHorizontal: spacing.xxxl,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  matchCard: {
    borderRadius: radius.lg,
    borderCurve: 'continuous' as any,
    overflow: 'hidden',
  },
  matchCardFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  matchCardInner: {
    padding: spacing.lg,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  matchCardName: {
    fontSize: 16,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: -0.3,
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  confidenceBadgeHigh: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  confidenceBadgeMedium: {
    backgroundColor: 'rgba(251,191,36,0.2)',
  },
  confidenceBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 1,
  },
  matchCardDetails: {
    gap: spacing.xxs,
    marginBottom: spacing.sm,
  },
  matchCardDetail: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.lg,
    borderCurve: 'continuous' as any,
    overflow: 'hidden',
  },
  actionButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionButtonInner: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 2,
  },
})
