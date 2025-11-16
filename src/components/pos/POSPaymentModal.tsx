import {  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, Pressable, Animated, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import {  BlurView } from 'expo-blur'
import {  useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { memo,  useState, useRef, useEffect } from 'react'
import { usePaymentProcessor } from '@/stores/payment-processor.store'

interface SplitPayment {
  method: 'cash' | 'card'
  amount: number
}

export interface PaymentData {
  paymentMethod: 'cash' | 'card' | 'split'
  cashTendered?: number
  changeGiven?: number
  authorizationCode?: string
  transactionId?: string
  cardType?: string
  cardLast4?: string
  splitPayments?: SplitPayment[]
  processingError?: string
}

interface POSPaymentModalProps {
  visible: boolean
  total: number
  subtotal: number
  taxAmount: number
  taxRate: number
  taxName?: string
  loyaltyDiscountAmount?: number
  loyaltyPointsEarned?: number
  currentLoyaltyPoints?: number
  pointValue?: number
  maxRedeemablePoints?: number
  itemCount: number
  customerName?: string
  onApplyLoyaltyPoints?: (points: number) => void
  onPaymentComplete: (paymentData: PaymentData) => void
  onCancel: () => void
  hasPaymentProcessor?: boolean
  locationId?: string
  registerId?: string
}

function POSPaymentModal({
  visible,
  total,
  subtotal,
  taxAmount,
  taxRate,
  taxName,
  loyaltyDiscountAmount = 0,
  loyaltyPointsEarned = 0,
  currentLoyaltyPoints = 0,
  pointValue = 0.01,
  maxRedeemablePoints = 0,
  itemCount,
  customerName,
  onApplyLoyaltyPoints,
  onPaymentComplete,
  onCancel,
  hasPaymentProcessor = false,
  locationId,
  registerId,
}: POSPaymentModalProps) {
  const insets = useSafeAreaInsets()
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash')

  // Payment processor status
  const processorStatus = usePaymentProcessor((state) => state.status)
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const onlineCount = usePaymentProcessor((state) => state.onlineCount)
  const totalCount = usePaymentProcessor((state) => state.totalCount)

  const [cashTendered, setCashTendered] = useState('')
  const [processing, setProcessing] = useState(false)
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([])
  const [splitMethod, setSplitMethod] = useState<'cash' | 'card'>('cash')
  const [splitAmount, setSplitAmount] = useState('')
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const modalSlideAnim = useRef(new Animated.Value(600)).current
  const modalOpacity = useRef(new Animated.Value(0)).current

  // Open animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(modalSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      modalSlideAnim.setValue(600)
      modalOpacity.setValue(0)
      // Reset state when modal closes
      setPaymentMethod('cash')
      setCashTendered('')
      setSplitPayments([])
      setSplitMethod('cash')
      setSplitAmount('')
      setProcessing(false)
      setPaymentError(null)
    }
  }, [visible])

  const changeAmount = cashTendered ? parseFloat(cashTendered) - total : 0
  const totalPaid = splitPayments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.round((total - totalPaid) * 100) / 100

  const canComplete =
    paymentMethod === 'cash'
      ? changeAmount >= 0
      : paymentMethod === 'split'
        ? remaining <= 0.01
        : true

  const handleClose = () => {
    if (processing) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCancel()
  }

  const handleAddSplitPayment = () => {
    const amount = parseFloat(splitAmount)
    if (amount > 0 && amount <= remaining + 0.01) {
      const finalAmount = Math.min(amount, remaining)
      const roundedAmount = Math.round(finalAmount * 100) / 100
      setSplitPayments([...splitPayments, { method: splitMethod, amount: roundedAmount }])
      setSplitAmount('')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  const handleRemoveSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index))
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const processCardPayment = async () => {
    if (!locationId) {
      throw new Error('Location ID required for card payments')
    }

    // Validate minimum amount for card payments
    // Dejavoo requires amount > 0, practically should be at least $0.50
    if (total < 0.50) {
      throw new Error(`Card payments require a minimum of $0.50. Current total: $${total.toFixed(2)}. Please use cash for small amounts.`)
    }

    // Get auth session
    const { supabase } = await import('@/lib/supabase/client')
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Authentication required')
    }

    const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

    setPaymentError('Waiting for terminal...')

    // Round amount to 2 decimal places to avoid floating point issues
    const roundedAmount = Math.round(total * 100) / 100

    const requestBody = {
      locationId,
      registerId,
      amount: roundedAmount,
      paymentMethod: 'credit',
      referenceId: `POS-${Date.now()}`,
    }

    const response = await fetch(`${BASE_URL}/api/pos/payment/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      const errorMsg = result.error || result.details || 'Card payment failed'
      throw new Error(errorMsg)
    }

    return {
      authorizationCode: result.authorizationCode,
      transactionId: result.transactionId,
      cardType: result.cardType,
      cardLast4: result.cardLast4,
    }
  }

  const handleComplete = async () => {
    if (!canComplete || processing) return

    setProcessing(true)
    setPaymentError(null)

    try {
      if (paymentMethod === 'cash') {
        const tendered = parseFloat(cashTendered)
        const change = tendered - total

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        onPaymentComplete({
          paymentMethod: 'cash',
          cashTendered: tendered,
          changeGiven: change,
        })
      } else if (paymentMethod === 'split') {
        // TODO: Handle split payments with card processor
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        onPaymentComplete({
          paymentMethod: 'split',
          splitPayments,
        })
      } else if (paymentMethod === 'card') {
        // JOBS PRINCIPLE: Real payment processor integration
        try {
          const cardResult = await processCardPayment()

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

          onPaymentComplete({
            paymentMethod: 'card',
            authorizationCode: cardResult.authorizationCode,
            transactionId: cardResult.transactionId,
            cardType: cardResult.cardType,
            cardLast4: cardResult.cardLast4,
          })
        } catch (error) {
          console.error('Card payment error:', error)
          setPaymentError(error instanceof Error ? error.message : 'Payment failed')
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          setProcessing(false)
          return
        }
      }
    } catch (error) {
      console.error('Payment error:', error)
      setPaymentError(error instanceof Error ? error.message : 'Payment failed')
      setProcessing(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  // Quick cash buttons
  const quickAmounts = [
    Math.ceil(total),
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 20) * 20,
  ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)

  return (
    <Modal visible={visible} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          </Pressable>

          {/* Modal Sheet - Outer border container */}
          <Animated.View
            style={[
              styles.modalBorder,
              {
                marginLeft: insets.left,
                marginRight: insets.right,
                marginBottom: 0,
                transform: [{ translateY: modalSlideAnim }],
              },
            ]}
          >
            {/* Inner content container with clipped corners */}
            <View style={styles.modalContent}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

              <View style={styles.pullHandle} />

            {/* JOBS: Transaction Summary - Everything at a glance */}
            <View style={styles.summarySection}>
              {/* Customer (if present) */}
              {customerName && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer</Text>
                  <Text style={styles.summaryValue}>{customerName}</Text>
                </View>
              )}

              {/* Items */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Text>
              </View>

              {/* Subtotal */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
              </View>

              {/* Loyalty Discount (if any) */}
              {loyaltyDiscountAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Loyalty Discount</Text>
                  <Text style={styles.summaryValueDiscount}>-${loyaltyDiscountAmount.toFixed(2)}</Text>
                </View>
              )}

              {/* Tax */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {taxName || 'Tax'} ({(taxRate * 100).toFixed(2)}%)
                </Text>
                <Text style={styles.summaryValue}>${taxAmount.toFixed(2)}</Text>
              </View>

              {/* Total - HUGE */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
            </View>

            {/* Loyalty Points Section - Show if customer present and points will be earned */}
            {customerName && loyaltyPointsEarned >= 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.loyaltySection}>
                  <View style={styles.loyaltyRow}>
                    <View style={styles.loyaltyInfo}>
                      <Text style={styles.loyaltyLabel}>Points Earned</Text>
                      <Text style={styles.loyaltyEarned}>+{loyaltyPointsEarned.toLocaleString()}</Text>
                    </View>
                    <View style={styles.loyaltyInfo}>
                      <Text style={styles.loyaltyLabel}>New Balance</Text>
                      <Text style={styles.loyaltyBalance}>
                        {(currentLoyaltyPoints + loyaltyPointsEarned).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Redemption UI - Only show if customer has points and not already fully redeemed */}
                  {currentLoyaltyPoints > 0 && maxRedeemablePoints > 0 && onApplyLoyaltyPoints && (
                    <View style={styles.redemptionContainer}>
                      {loyaltyDiscountAmount > 0 ? (
                        /* Show applied discount indicator */
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            onApplyLoyaltyPoints(0) // Clear redemption
                          }}
                          style={styles.redeemedIndicator}
                        >
                          <Text style={styles.redeemedText}>
                            ✓ Redeemed ${loyaltyDiscountAmount.toFixed(2)}
                          </Text>
                          <Text style={styles.redeemedRemove}>×</Text>
                        </TouchableOpacity>
                      ) : (
                        /* Show "Redeem Points" button */
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            onApplyLoyaltyPoints(maxRedeemablePoints)
                          }}
                          style={styles.redeemPointsLink}
                        >
                          <Text style={styles.redeemPointsLinkText}>
                            Redeem Points ({maxRedeemablePoints.toLocaleString()} pts = -$
                            {(maxRedeemablePoints * pointValue).toFixed(2)})
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Payment Error Display */}
            {paymentError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{paymentError}</Text>
              </View>
            )}

            {/* Payment Method Selector - Subtle, below the important info */}
            <View style={styles.paymentMethodSection}>
              <Text style={styles.paymentMethodLabel}>PAYMENT METHOD</Text>
              <View style={styles.paymentTabs}>
                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('cash')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={[styles.paymentTab, paymentMethod === 'cash' && styles.paymentTabActive]}
                >
                  <Text style={[styles.paymentTabText, paymentMethod === 'cash' && styles.paymentTabTextActive]}>
                    Cash
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('card')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={[styles.paymentTab, paymentMethod === 'card' && styles.paymentTabActive]}
                >
                  <Text style={[styles.paymentTabText, paymentMethod === 'card' && styles.paymentTabTextActive]}>
                    Card
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('split')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  style={[styles.paymentTab, paymentMethod === 'split' && styles.paymentTabActive]}
                >
                  <Text style={[styles.paymentTabText, paymentMethod === 'split' && styles.paymentTabTextActive]}>
                    Split
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.paymentContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.paymentContentInner}>
              {/* CASH PAYMENT */}
              {paymentMethod === 'cash' && (
                <View style={styles.cashPayment}>
                  <Text style={styles.inputLabel}>CASH TENDERED</Text>
                  <TextInput
                    style={styles.cashInput}
                    value={cashTendered}
                    onChangeText={setCashTendered}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />

                  <View style={styles.quickButtons}>
                    {quickAmounts.map((amount) => (
                      <TouchableOpacity
                        key={amount}
                        onPress={() => {
                          setCashTendered(amount.toString())
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        }}
                        style={styles.quickButton}
                      >
                        <Text style={styles.quickButtonText}>${amount}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {changeAmount > 0 && (
                    <View style={styles.changeDisplay}>
                      <Text style={styles.changeLabel}>CHANGE</Text>
                      <Text style={styles.changeAmount}>${changeAmount.toFixed(2)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* CARD PAYMENT */}
              {paymentMethod === 'card' && (
                <View style={styles.cardPayment}>
                  {hasPaymentProcessor && currentProcessor ? (
                    <View style={styles.processorInfo}>
                      {/* Processor Status Indicator */}
                      <View style={styles.processorHeader}>
                        <View style={styles.processorStatusRow}>
                          <View
                            style={[
                              styles.processorStatusDot,
                              processorStatus === 'connected' && styles.processorStatusDotConnected,
                              processorStatus === 'disconnected' && styles.processorStatusDotDisconnected,
                              processorStatus === 'error' && styles.processorStatusDotError,
                              processorStatus === 'checking' && styles.processorStatusDotChecking,
                            ]}
                          />
                          <Text style={styles.processorStatusText}>
                            {processorStatus === 'connected' && 'Connected'}
                            {processorStatus === 'disconnected' && 'Offline'}
                            {processorStatus === 'error' && 'Error'}
                            {processorStatus === 'checking' && 'Checking...'}
                          </Text>
                        </View>
                        {totalCount > 1 && (
                          <Text style={styles.processorCount}>
                            {onlineCount}/{totalCount} terminals
                          </Text>
                        )}
                      </View>

                      {/* Processor Details */}
                      <View style={styles.processorDetails}>
                        <Text style={styles.processorName}>
                          {currentProcessor.processor_name || 'Payment Terminal'}
                        </Text>
                        <Text style={styles.processorType}>
                          {currentProcessor.processor_type?.toUpperCase() || 'TERMINAL'}
                        </Text>
                      </View>

                      {/* Ready/Error Message */}
                      {processorStatus === 'connected' && !processing && (
                        <View style={styles.processorReadyBanner}>
                          <Text style={styles.processorReadyText}>
                            ✓ Ready to process ${total.toFixed(2)}
                          </Text>
                          <Text style={styles.processorReadySubtext}>
                            Tap Complete to send to terminal
                          </Text>
                        </View>
                      )}

                      {processorStatus === 'disconnected' && (
                        <View style={styles.processorErrorBanner}>
                          <Text style={styles.processorErrorText}>⚠ Terminal Offline</Text>
                          <Text style={styles.processorErrorSubtext}>
                            Check terminal is powered on and connected
                          </Text>
                        </View>
                      )}

                      {processorStatus === 'error' && currentProcessor.error && (
                        <View style={styles.processorErrorBanner}>
                          <Text style={styles.processorErrorText}>⚠ Terminal Error</Text>
                          <Text style={styles.processorErrorSubtext}>{currentProcessor.error}</Text>
                        </View>
                      )}

                      {processing && (
                        <View style={styles.processorProcessingBanner}>
                          <ActivityIndicator color="#10b981" size="small" />
                          <Text style={styles.processorProcessingText}>Processing on terminal...</Text>
                          <Text style={styles.processorProcessingSubtext}>
                            Please follow prompts on payment terminal
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.cardMessage}>
                      {hasPaymentProcessor
                        ? 'Loading payment terminal...'
                        : 'Manual card entry - No terminal configured'}
                    </Text>
                  )}
                </View>
              )}

              {/* SPLIT PAYMENT */}
              {paymentMethod === 'split' && (
                <View style={styles.splitPayment}>
                  <View style={styles.splitHeader}>
                    <Text style={styles.splitLabel}>REMAINING</Text>
                    <Text style={styles.splitRemaining}>${remaining.toFixed(2)}</Text>
                  </View>

                  <View style={styles.splitInputRow}>
                    <View style={styles.splitMethodButtons}>
                      <TouchableOpacity
                        onPress={() => setSplitMethod('cash')}
                        style={[styles.splitMethodButton, splitMethod === 'cash' && styles.splitMethodButtonActive]}
                      >
                        <Text style={[styles.splitMethodButtonText, splitMethod === 'cash' && styles.splitMethodButtonTextActive]}>
                          Cash
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setSplitMethod('card')}
                        style={[styles.splitMethodButton, splitMethod === 'card' && styles.splitMethodButtonActive]}
                      >
                        <Text style={[styles.splitMethodButtonText, splitMethod === 'card' && styles.splitMethodButtonTextActive]}>
                          Card
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.splitAmountInput}
                      value={splitAmount}
                      onChangeText={setSplitAmount}
                      keyboardType="decimal-pad"
                      placeholder="Amount"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                    <TouchableOpacity onPress={handleAddSplitPayment} style={styles.splitAddButton}>
                      <Text style={styles.splitAddButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {splitPayments.map((payment, index) => (
                    <View key={index} style={styles.splitPaymentItem}>
                      <Text style={styles.splitPaymentMethod}>{payment.method.toUpperCase()}</Text>
                      <Text style={styles.splitPaymentAmount}>${payment.amount.toFixed(2)}</Text>
                      <TouchableOpacity onPress={() => handleRemoveSplitPayment(index)} style={styles.splitRemoveButton}>
                        <Text style={styles.splitRemoveButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={handleClose} style={styles.cancelButton} disabled={processing}>
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleComplete}
                style={[styles.completeButton, (!canComplete || processing) && styles.completeButtonDisabled]}
                disabled={!canComplete || processing}
              >
                {processing ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.completeButtonText}>COMPLETE</Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const POSPaymentModalMemo = memo(POSPaymentModal)
export { POSPaymentModalMemo as POSPaymentModal }

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBorder: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 40,
  },
  pullHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  // JOBS: Transaction Summary - Clean, readable hierarchy
  summarySection: {
    paddingHorizontal: 24,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.2,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.3,
  },
  summaryValueDiscount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#10b981',
    letterSpacing: -0.3,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: -0.3,
  },
  totalValue: {
    fontSize: 34,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: -0.5,
  },
  divider: {
    height: 0.33,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 24,
    marginVertical: 24,
  },
  paymentMethodSection: {
    paddingHorizontal: 24,
    gap: 12,
  },
  paymentMethodLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.2,
  },
  // Loyalty Points Section
  loyaltySection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(16,185,129,0.05)',
  },
  loyaltyRow: {
    flexDirection: 'row',
    gap: 24,
  },
  loyaltyInfo: {
    flex: 1,
    gap: 6,
  },
  loyaltyLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(16,185,129,0.7)',
    letterSpacing: 0.3,
  },
  loyaltyEarned: {
    fontSize: 24,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.5,
  },
  loyaltyBalance: {
    fontSize: 24,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.5,
  },
  redemptionContainer: {
    marginTop: 16,
  },
  redeemPointsLink: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 12,
    alignItems: 'center',
  },
  redeemPointsLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
  },
  redeemedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  redeemedText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#10b981',
    letterSpacing: -0.2,
  },
  redeemedRemove: {
    fontSize: 18,
    fontWeight: '300',
    color: '#10b981',
  },
  errorContainer: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(239,68,68,0.95)',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  paymentTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentTab: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTabActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  paymentTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.2,
  },
  paymentTabTextActive: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
  },
  paymentContent: {
    flex: 1,
  },
  paymentContentInner: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  cashPayment: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  cashInput: {
    height: 60,
    fontSize: 32,
    fontWeight: '200',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)', // iOS: Liquid glass
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, // JOBS: More rounded
    paddingHorizontal: 20,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.08)', // iOS: Liquid glass
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24, // JOBS: Perfect pill
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  changeDisplay: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 0,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  changeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(16,185,129,0.7)',
    letterSpacing: 0.5,
  },
  changeAmount: {
    fontSize: 36,
    fontWeight: '300',
    color: '#10b981',
    letterSpacing: -0.5,
  },
  cardPayment: {
    padding: 24,
    alignItems: 'center',
  },
  cardMessage: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  // Processor Info Styles
  processorInfo: {
    width: '100%',
    gap: 16,
  },
  processorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  processorStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processorStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  processorStatusDotConnected: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  processorStatusDotDisconnected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  processorStatusDotError: {
    backgroundColor: '#ef4444',
  },
  processorStatusDotChecking: {
    backgroundColor: '#f59e0b',
  },
  processorStatusText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: -0.2,
  },
  processorCount: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
  },
  processorDetails: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  processorName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  processorType: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  processorReadyBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
  },
  processorReadyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  processorReadySubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(16, 185, 129, 0.8)',
    letterSpacing: -0.1,
  },
  processorErrorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  processorErrorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  processorErrorSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(239, 68, 68, 0.8)',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  processorProcessingBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    gap: 12,
  },
  processorProcessingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
  },
  processorProcessingSubtext: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(16, 185, 129, 0.8)',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  splitPayment: {
    gap: 16,
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  splitLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  },
  splitRemaining: {
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
  },
  splitInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  splitMethodButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  splitMethodButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  splitMethodButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  splitMethodButtonText: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
  },
  splitMethodButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  splitAmountInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontWeight: '300',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  splitAddButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitAddButtonText: {
    fontSize: 24,
    fontWeight: '200',
    color: '#fff',
  },
  splitPaymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    gap: 12,
  },
  splitPaymentMethod: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  splitPaymentAmount: {
    flex: 1,
    fontSize: 18,
    fontWeight: '300',
    color: '#fff',
    textAlign: 'right',
  },
  splitRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,0,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitRemoveButtonText: {
    fontSize: 18,
    fontWeight: '200',
    color: 'rgba(255,80,80,0.95)',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 56,
    borderRadius: 28, // JOBS: Perfect pill (height/2)
    backgroundColor: 'rgba(255,255,255,0.08)', // iOS: Subtle glass
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,80,80,0.95)',
    letterSpacing: 2,
  },
  completeButton: {
    flex: 2,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.3,
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
  },
})
