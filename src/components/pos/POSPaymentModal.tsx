import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, Pressable, Animated, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useState, useRef, useEffect } from 'react'
import { PaymentProcessorStatus } from './PaymentProcessorStatus'

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
  onPaymentComplete: (paymentData: PaymentData) => void
  onCancel: () => void
  hasPaymentProcessor?: boolean
  locationId?: string
  registerId?: string
}

export function POSPaymentModal({
  visible,
  total,
  onPaymentComplete,
  onCancel,
  hasPaymentProcessor = false,
  locationId,
  registerId,
}: POSPaymentModalProps) {
  const insets = useSafeAreaInsets()
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash')
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

    // Get auth session
    const { supabase } = await import('@/lib/supabase/client')
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('Authentication required')
    }

    const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

    setPaymentError('Waiting for terminal...')

    const response = await fetch(`${BASE_URL}/api/pos/payment/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        locationId,
        registerId,
        amount: total,
        paymentMethod: 'card',
      }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Card payment failed')
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

            <Text style={styles.modalTitle}>Payment</Text>
            <Text style={styles.modalTotal}>${total.toFixed(2)}</Text>

            {/* JOBS PRINCIPLE: Mission-critical payment processor status - always visible */}
            <View style={styles.statusContainer}>
              <PaymentProcessorStatus />
            </View>

            {/* Payment Error Display */}
            {paymentError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{paymentError}</Text>
              </View>
            )}

            {/* Payment Method Tabs */}
            <View style={styles.paymentTabs}>
              <TouchableOpacity
                onPress={() => {
                  setPaymentMethod('cash')
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }}
                style={[styles.paymentTab, paymentMethod === 'cash' && styles.paymentTabActive]}
              >
                <Text style={[styles.paymentTabText, paymentMethod === 'cash' && styles.paymentTabTextActive]}>
                  CASH
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
                  CARD
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
                  SPLIT
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.paymentContent} showsVerticalScrollIndicator={false}>
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
                  <Text style={styles.cardMessage}>
                    {hasPaymentProcessor
                      ? 'Payment terminal integration will be activated here'
                      : 'Manual card entry'}
                  </Text>
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: -0.4,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  modalTotal: {
    fontSize: 48,
    fontWeight: '200',
    color: '#fff',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  statusContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
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
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 24,
  },
  paymentTab: {
    flex: 1,
    height: 44,
    borderRadius: 22, // JOBS: Perfect pill (height/2)
    backgroundColor: 'rgba(255,255,255,0.08)', // iOS: Liquid glass
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTabActive: {
    backgroundColor: 'rgba(10,132,255,0.2)', // iOS: Blue glass when active
    borderColor: 'rgba(10,132,255,0.4)',
  },
  paymentTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  paymentTabTextActive: {
    color: '#fff',
  },
  paymentContent: {
    flex: 1,
    paddingHorizontal: 24,
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
    backgroundColor: 'rgba(100,200,100,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100,200,100,0.3)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  changeLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(100,200,100,0.8)',
    letterSpacing: 1.5,
  },
  changeAmount: {
    fontSize: 36,
    fontWeight: '200',
    color: 'rgba(100,200,100,0.95)',
  },
  cardPayment: {
    padding: 40,
    alignItems: 'center',
  },
  cardMessage: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
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
    borderRadius: 28, // JOBS: Perfect pill (height/2)
    backgroundColor: 'rgba(52,199,89,0.15)', // iOS: System green glass
    borderWidth: 0.5,
    borderColor: 'rgba(52,199,89,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.4,
  },
  completeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(100,200,100,0.95)',
    letterSpacing: 2,
  },
})
