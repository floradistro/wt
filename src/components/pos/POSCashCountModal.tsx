/* eslint-disable react-hooks/preserve-manual-memoization */
/**
 * POSCashCountModal - Full Screen Cash Count Modal
 * Matches POSCustomerMatchModal / POSProductCard pattern
 *
 * Supports three modes:
 * - 'open': Opening cash count / Cash in
 * - 'close': Closing cash count / End shift
 * - 'drop': Cash drop from drawer to safe
 *
 * Apple Philosophy: Full screen bottom sheet with glass effect
 */

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Modal,
  Animated,
  Pressable,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react'

const { height } = Dimensions.get('window')

// Helper to format shift duration
function formatShiftDuration(startTime: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - startTime.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours === 0) {
    return `${minutes}m shift`
  }
  return `${hours}h ${minutes}m shift`
}

// Apple-standard spring config
const SPRING_CONFIG = {
  tension: 280,
  friction: 22,
  useNativeDriver: true,
}

type CashCountMode = 'open' | 'close' | 'drop'

// Shift performance data for close mode
interface ShiftPerformance {
  shiftStart: Date | null
  transactionCount: number
  averageTransaction: number
  cardSales: number
  auditsCompleted: number
  // Payment breakdown
  cashPercent: number
  cardPercent: number
}

interface POSCashCountModalProps {
  visible: boolean
  mode: CashCountMode
  // For close mode
  expectedCash?: number
  totalSales?: number
  openingCash?: number
  totalCashSales?: number
  totalCashDrops?: number
  shiftPerformance?: ShiftPerformance
  // For drop mode
  currentDrawerBalance?: number
  safeBalance?: number
  // Callbacks
  onSubmit: (amount: number, notes: string) => void
  onCancel: () => void
  onDropToSafe?: () => void  // For close mode - opens drop modal
}

function POSCashCountModal({
  visible,
  mode,
  expectedCash = 0,
  totalSales = 0,
  openingCash = 0,
  totalCashSales = 0,
  totalCashDrops = 0,
  shiftPerformance,
  currentDrawerBalance = 0,
  safeBalance = 0,
  onSubmit,
  onCancel,
  onDropToSafe,
}: POSCashCountModalProps) {
  const insets = useSafeAreaInsets()
  const [cashAmount, setCashAmount] = useState('')
  const [notes, setNotes] = useState('')

  // Full screen height - take entire screen
  const modalHeight = height

  // Animation refs - start off screen (use full height for proper slide-up)
  const modalSlideAnim = useRef(new Animated.Value(height)).current
  const modalOpacity = useRef(new Animated.Value(0)).current
  const dragOffset = useRef(0)

  // Open/close animations
  useEffect(() => {
    if (visible) {
      // Reset form
      setCashAmount('')
      setNotes('')

      // Ensure we start from off-screen (below the viewport)
      modalSlideAnim.setValue(height)
      modalOpacity.setValue(0)

      // Animate up
      Animated.parallel([
        Animated.spring(modalSlideAnim, {
          toValue: 0,
          ...SPRING_CONFIG,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  // PanResponder for drag-to-dismiss
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
        onPanResponderGrant: () => {
          dragOffset.current = 0
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragOffset.current = gestureState.dy
            modalSlideAnim.setValue(gestureState.dy)
            modalOpacity.setValue(Math.max(0, 1 - gestureState.dy / 300))
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.5) {
            handleClose()
          } else {
            Animated.parallel([
              Animated.spring(modalSlideAnim, {
                toValue: 0,
                tension: 300,
                friction: 26,
                useNativeDriver: true,
              }),
              Animated.timing(modalOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start()
          }
        },
      }),
    [modalSlideAnim, modalOpacity]
  )

  const cashDifference = mode === 'close' && cashAmount
    ? parseFloat(cashAmount) - expectedCash
    : 0

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.parallel([
      Animated.timing(modalSlideAnim, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onCancel()
    })
  }, [modalSlideAnim, modalOpacity, onCancel])

  // Double-tap backdrop to close
  const lastTapRef = useRef<number>(0)
  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      handleClose()
    }
    lastTapRef.current = now
  }, [handleClose])

  const handleSubmit = useCallback(() => {
    const amount = parseFloat(cashAmount || '0')
    if (amount <= 0) return

    // For drop mode, prevent dropping more than drawer balance
    if (mode === 'drop' && amount > currentDrawerBalance) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    Animated.parallel([
      Animated.timing(modalSlideAnim, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onSubmit(amount, notes)
    })
  }, [cashAmount, notes, modalSlideAnim, modalOpacity, onSubmit, mode, currentDrawerBalance])

  const title = mode === 'open'
    ? 'OPENING CASH'
    : mode === 'drop'
    ? 'CASH DROP TO SAFE'
    : 'COUNT CASH DRAWER'

  const subtitle = mode === 'open'
    ? 'Enter the starting cash in drawer'
    : mode === 'drop'
    ? 'Move cash from drawer to safe'
    : 'Count all cash to close your shift'

  // For drop mode, calculate the remaining drawer balance
  const dropAmount = parseFloat(cashAmount || '0')
  const remainingDrawerBalance = currentDrawerBalance - dropAmount

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Animated wrapper with opacity - matches POSCustomerMatchModal */}
      <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
        {/* Double-tap backdrop to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDoubleTap}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        {/* Modal Sheet - Full height, slides up from bottom */}
        <Animated.View
          style={[
            styles.modalBorder,
            {
              height: modalHeight,
              transform: [{ translateY: modalSlideAnim }],
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={[styles.modalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

              {/* Pull Handle */}
              <View style={styles.pullHandleRow} {...panResponder.panHandlers}>
                <View style={styles.pullHandle} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>

              {/* Scrollable Content Area */}
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Close Mode: Modern 2-Column Performance Dashboard */}
                {mode === 'close' && (
                  <View style={styles.closeContainer}>
                    {/* Hero Stats - Total Sales */}
                    <View style={styles.heroSection}>
                      <Text style={styles.heroLabel}>TOTAL SALES</Text>
                      <Text style={styles.heroValue}>${totalSales.toFixed(2)}</Text>
                      {shiftPerformance?.shiftStart && (
                        <Text style={styles.heroSubtext}>
                          {formatShiftDuration(shiftPerformance.shiftStart)}
                        </Text>
                      )}
                    </View>

                    {/* 2-Column Stats Grid */}
                    <View style={styles.statsGrid}>
                      {/* Left Column */}
                      <View style={styles.statsColumn}>
                        <View style={styles.statCard}>
                          <Text style={styles.statValue}>{shiftPerformance?.transactionCount || 0}</Text>
                          <Text style={styles.statLabel}>Transactions</Text>
                        </View>
                        <View style={styles.statCard}>
                          <Text style={styles.statValue}>${(shiftPerformance?.averageTransaction || 0).toFixed(2)}</Text>
                          <Text style={styles.statLabel}>Avg. Order</Text>
                        </View>
                        <View style={styles.statCard}>
                          <Text style={styles.statValue}>{shiftPerformance?.auditsCompleted || 0}</Text>
                          <Text style={styles.statLabel}>Audits</Text>
                        </View>
                      </View>

                      {/* Right Column - Payment Breakdown */}
                      <View style={styles.statsColumn}>
                        <View style={styles.paymentBreakdownCard}>
                          <Text style={styles.paymentBreakdownTitle}>PAYMENT MIX</Text>

                          {/* Visual Bar */}
                          <View style={styles.paymentBar}>
                            <View style={[
                              styles.paymentBarCash,
                              { flex: shiftPerformance?.cashPercent || 0 }
                            ]} />
                            <View style={[
                              styles.paymentBarCard,
                              { flex: shiftPerformance?.cardPercent || 100 }
                            ]} />
                          </View>

                          <View style={styles.paymentLegend}>
                            <View style={styles.paymentLegendItem}>
                              <View style={[styles.paymentDot, styles.paymentDotCash]} />
                              <Text style={styles.paymentLegendText}>Cash {shiftPerformance?.cashPercent || 0}%</Text>
                            </View>
                            <View style={styles.paymentLegendItem}>
                              <View style={[styles.paymentDot, styles.paymentDotCard]} />
                              <Text style={styles.paymentLegendText}>Card {shiftPerformance?.cardPercent || 0}%</Text>
                            </View>
                          </View>

                          <View style={styles.paymentAmounts}>
                            <Text style={styles.paymentAmount}>${totalCashSales.toFixed(2)} cash</Text>
                            <Text style={styles.paymentAmount}>${(shiftPerformance?.cardSales || 0).toFixed(2)} card</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Cash Drawer Summary - Compact */}
                    <View style={styles.drawerSummary}>
                      <View style={styles.drawerRow}>
                        <Text style={styles.drawerLabel}>Opening</Text>
                        <Text style={styles.drawerValue}>${openingCash.toFixed(2)}</Text>
                      </View>
                      <View style={styles.drawerDivider} />
                      <View style={styles.drawerRow}>
                        <Text style={styles.drawerLabel}>+ Cash Sales</Text>
                        <Text style={styles.drawerValue}>${totalCashSales.toFixed(2)}</Text>
                      </View>
                      {totalCashDrops > 0 && (
                        <>
                          <View style={styles.drawerDivider} />
                          <View style={styles.drawerRow}>
                            <Text style={styles.drawerLabel}>− Safe Drops</Text>
                            <Text style={styles.drawerValueMuted}>${totalCashDrops.toFixed(2)}</Text>
                          </View>
                        </>
                      )}
                      <View style={styles.drawerDivider} />
                      <View style={styles.drawerRowFinal}>
                        <Text style={styles.drawerLabelFinal}>Expected</Text>
                        <Text style={styles.drawerValueFinal}>${expectedCash.toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* Drop to Safe - Compact Link */}
                    {onDropToSafe && (
                      <TouchableOpacity
                        style={styles.dropToSafeLink}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          onDropToSafe()
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dropToSafeLinkText}>Drop Cash to Safe →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Open Mode: Instructions */}
                {mode === 'open' && (
                  <View style={styles.cardsContainer}>
                    <View style={styles.openInstructionsCard}>
                      <Text style={styles.instructionsTitle}>CASH DRAWER SETUP</Text>
                      <Text style={styles.instructionItem}>Count all bills and coins in the drawer</Text>
                      <Text style={styles.instructionItem}>Enter the exact amount below</Text>
                    </View>
                  </View>
                )}

                {/* Drop Mode: Show balances */}
                {mode === 'drop' && (
                  <View style={styles.cardsContainer}>
                    <View style={styles.summaryCard}>
                      <Text style={styles.cardTitle}>CURRENT BALANCES</Text>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Drawer Balance</Text>
                        <Text style={styles.summaryValue}>${currentDrawerBalance.toFixed(2)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Safe Balance</Text>
                        <Text style={styles.summaryValue}>${safeBalance.toFixed(2)}</Text>
                      </View>
                      {dropAmount > 0 && (
                        <>
                          <View style={[styles.summaryRow, styles.summaryRowFinal]}>
                            <Text style={styles.summaryLabelFinal}>AFTER DROP</Text>
                            <Text style={styles.summaryValueFinal}> </Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Drawer</Text>
                            <Text style={[
                              styles.summaryValue,
                              remainingDrawerBalance < 0 && styles.summaryValueError
                            ]}>
                              ${remainingDrawerBalance.toFixed(2)}
                            </Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Safe</Text>
                            <Text style={styles.summaryValue}>${(safeBalance + dropAmount).toFixed(2)}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                )}

                {/* Cash Amount Input */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>
                    {mode === 'open' ? 'STARTING CASH' : mode === 'drop' ? 'DROP AMOUNT' : 'CLOSING CASH COUNT'}
                  </Text>
                  <LiquidGlassView
                    effect="regular"
                    colorScheme="dark"
                    tintColor="rgba(255,255,255,0.08)"
                    style={[
                      styles.inputContainer,
                      !isLiquidGlassSupported && styles.inputContainerFallback,
                    ]}
                  >
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.input}
                      value={cashAmount}
                      onChangeText={setCashAmount}
                      placeholder="0.00"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      keyboardType="decimal-pad"
                      autoFocus
                      accessibilityLabel={mode === 'open' ? 'Starting cash amount' : mode === 'drop' ? 'Drop amount' : 'Closing cash count'}
                    />
                  </LiquidGlassView>
                </View>

                {/* Cash Difference Alert (Close mode only) */}
                {mode === 'close' && cashAmount && cashDifference !== 0 && (
                  <View
                    style={[
                      styles.alertCard,
                      cashDifference > 0 ? styles.alertOver : styles.alertShort,
                    ]}
                  >
                    <Text
                      style={[
                        styles.alertTitle,
                        cashDifference > 0 ? styles.alertTitleOver : styles.alertTitleShort,
                      ]}
                    >
                      {cashDifference > 0 ? 'CASH OVER' : 'CASH SHORT'}
                    </Text>
                    <Text style={styles.alertText}>
                      Difference: ${Math.abs(cashDifference).toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Notes */}
                <View style={styles.notesSection}>
                  <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
                  <LiquidGlassView
                    effect="regular"
                    colorScheme="dark"
                    tintColor="rgba(255,255,255,0.05)"
                    style={[
                      styles.notesContainer,
                      !isLiquidGlassSupported && styles.notesContainerFallback,
                    ]}
                  >
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder={mode === 'open' ? 'Any notes about starting cash...' : mode === 'drop' ? 'Reason for cash drop...' : 'Any notes about the closing count...'}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      multiline
                      numberOfLines={2}
                    />
                  </LiquidGlassView>
                </View>
              </ScrollView>

              {/* Action Buttons - Pinned to bottom */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>CANCEL</Text>
                </TouchableOpacity>

                <LiquidGlassView
                  effect="regular"
                  colorScheme="dark"
                  tintColor="rgba(59,130,246,0.4)"
                  interactive
                  style={[
                    styles.submitButton,
                    !isLiquidGlassSupported && styles.submitButtonFallback,
                  ]}
                >
                  <TouchableOpacity
                    onPress={handleSubmit}
                    activeOpacity={0.7}
                    style={styles.submitButtonPressable}
                  >
                    <Text style={styles.submitButtonText}>
                      {mode === 'open' ? 'START SESSION' : mode === 'drop' ? 'DROP TO SAFE' : 'CLOSE SHIFT'}
                    </Text>
                  </TouchableOpacity>
                </LiquidGlassView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const POSCashCountModalMemo = memo(POSCashCountModal)
export { POSCashCountModalMemo as POSCashCountModal }

const styles = StyleSheet.create({
  // Modal Overlay - Full screen with blur (matches POSCustomerMatchModal)
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Modal Border - Outer rounded container with shadow
  modalBorder: {
    marginLeft: 0,
    marginRight: 0,
    marginBottom: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  keyboardView: {
    flex: 1,
  },
  // Modal Content - Inner glass container (no background, uses BlurView)
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  // Pull Handle Row (matches POSCustomerMatchModal)
  pullHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 44,
  },
  pullHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },

  // ========================================
  // CLOSE MODE - Modern Dashboard Styles
  // ========================================
  closeContainer: {
    gap: 16,
  },
  // Hero Section - Big total sales number
  heroSection: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  heroSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  // 2-Column Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statsColumn: {
    flex: 1,
    gap: 8,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.3,
  },
  // Payment Breakdown Card
  paymentBreakdownCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  paymentBreakdownTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  paymentBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  paymentBarCash: {
    backgroundColor: 'rgba(34,197,94,0.8)',
  },
  paymentBarCard: {
    backgroundColor: 'rgba(59,130,246,0.8)',
  },
  paymentLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paymentLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paymentDotCash: {
    backgroundColor: 'rgba(34,197,94,0.8)',
  },
  paymentDotCard: {
    backgroundColor: 'rgba(59,130,246,0.8)',
  },
  paymentLegendText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  paymentAmounts: {
    gap: 4,
  },
  paymentAmount: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  // Drawer Summary - Compact horizontal
  drawerSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  drawerRow: {
    flex: 1,
    alignItems: 'center',
  },
  drawerRowFinal: {
    flex: 1,
    alignItems: 'center',
  },
  drawerDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  drawerLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  drawerLabelFinal: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  drawerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  drawerValueMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  drawerValueFinal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  // Drop to Safe Link
  dropToSafeLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dropToSafeLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },

  // Cards Container
  cardsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  // Summary Card
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  summaryValueError: {
    color: 'rgba(239,68,68,0.9)',
  },
  summaryValueDrop: {
    color: 'rgba(255,255,255,0.6)',
  },
  summaryRowFinal: {
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  summaryLabelFinal: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  summaryValueFinal: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  // Instructions Card
  instructionsCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  openInstructionsCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(96,165,250,0.9)',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  // Drop to Safe Button
  dropToSafeButton: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  dropToSafeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  dropToSafeButtonSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
  },
  instructionItem: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  // Input Section
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    overflow: 'hidden',
  },
  inputContainerFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dollarSign: {
    fontSize: 36,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  // Alert Card
  alertCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  alertOver: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderColor: 'rgba(251,191,36,0.3)',
  },
  alertShort: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  alertTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  alertTitleOver: {
    color: 'rgba(251,191,36,0.9)',
  },
  alertTitleShort: {
    color: 'rgba(239,68,68,0.9)',
  },
  alertText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  // Notes Section
  notesSection: {
    marginBottom: 0,
  },
  notesContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  notesContainerFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  notesInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  // Actions - Pinned to bottom
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  submitButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(59,130,246,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  submitButtonFallback: {
    backgroundColor: 'rgba(59,130,246,0.8)',
  },
  submitButtonPressable: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
})
