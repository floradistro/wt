import {  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, Animated, Dimensions, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import {  BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { memo,  useRef, useEffect, useState } from 'react'

const { width } = Dimensions.get('window')
const isTablet = width > 600

interface CloseCashDrawerModalProps {
  visible: boolean
  sessionNumber: string
  totalSales: number
  totalCash: number
  openingCash: number
  onSubmit: (closingCash: number, notes: string) => void
  onCancel: () => void
}

function CloseCashDrawerModal({
  visible,
  sessionNumber: _sessionNumber,
  totalSales,
  totalCash,
  openingCash,
  onSubmit,
  onCancel,
}: CloseCashDrawerModalProps) {
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current

  const expectedCash = openingCash + totalCash
  const cashDifference = closingCash ? parseFloat(closingCash) - expectedCash : 0

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  const handleSubmit = () => {
    const amount = parseFloat(closingCash || '0')
    if (amount < 0) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSubmit(amount, notes)
    setClosingCash('')
    setNotes('')
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setClosingCash('')
    setNotes('')
    onCancel()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleCancel}
      accessibilityViewIsModal={true}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.modalContent,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel="Count cash drawer and close shift dialog"
              onAccessibilityEscape={handleCancel}
            >
              <View style={styles.modalBg}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              </View>

              {/* Header */}
              <View style={styles.header} accessible={false}>
                <Text style={styles.title} accessibilityRole="header">COUNT CASH DRAWER</Text>
                <Text style={styles.subtitle}>Count all cash to close your shift</Text>
              </View>

              {/* JOBS PRINCIPLE: Two-column layout for landscape */}
              <View style={styles.twoColumnContainer} accessible={false}>
                {/* Session Summary */}
                <View
                  style={styles.summary}
                  accessible={true}
                  accessibilityRole="summary"
                  accessibilityLabel={`Shift summary. Total sales: ${totalSales.toFixed(2)} dollars. Opening cash: ${openingCash.toFixed(2)} dollars. Cash sales: ${totalCash.toFixed(2)} dollars. Expected cash: ${expectedCash.toFixed(2)} dollars`}
                >
                  <View style={styles.summaryBg}>
                    <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
                  </View>
                  <Text style={styles.summaryTitle} accessible={false}>SHIFT SUMMARY</Text>
                  <View style={styles.summaryRow} accessible={false}>
                    <Text style={styles.summaryLabel} accessible={false}>Total Sales</Text>
                    <Text style={styles.summaryValue} accessible={false}>${totalSales.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow} accessible={false}>
                    <Text style={styles.summaryLabel} accessible={false}>Opening Cash</Text>
                    <Text style={styles.summaryValue} accessible={false}>${openingCash.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow} accessible={false}>
                    <Text style={styles.summaryLabel} accessible={false}>Cash Sales</Text>
                    <Text style={styles.summaryValue} accessible={false}>${totalCash.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryRowFinal]} accessible={false}>
                    <Text style={styles.summaryLabelFinal} accessible={false}>EXPECTED CASH</Text>
                    <Text style={styles.summaryValueFinal} accessible={false}>${expectedCash.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Instructions */}
                <View
                  style={styles.instructions}
                  accessible={true}
                  accessibilityLabel="Before you close: 1. Count all bills and coins in drawer. 2. Compare to expected cash above. 3. Note any differences"
                >
                  <View style={styles.instructionsBg}>
                    <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
                  </View>
                  <Text style={styles.instructionsTitle} accessible={false}>BEFORE YOU CLOSE</Text>
                  <View style={styles.instructionsList} accessible={false}>
                    <Text style={styles.instructionItem} accessible={false}>1. Count all bills and coins in drawer</Text>
                    <Text style={styles.instructionItem} accessible={false}>2. Compare to expected cash above</Text>
                    <Text style={styles.instructionItem} accessible={false}>3. Note any differences</Text>
                  </View>
                </View>
              </View>

              {/* Amount Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel} accessible={false}>CLOSING CASH COUNT</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.dollarSign} accessibilityElementsHidden={true} importantForAccessibility="no">$</Text>
                  <TextInput
                    style={styles.input}
                    value={closingCash}
                    onChangeText={setClosingCash}
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="decimal-pad"
                    autoFocus
                    accessible={true}
                    accessibilityLabel="Closing cash count"
                    accessibilityHint={`Enter the total dollar amount counted in the drawer. Expected: ${expectedCash.toFixed(2)} dollars`}
                  />
                </View>
              </View>

              {/* Cash Difference Alert */}
              {closingCash && cashDifference !== 0 && (
                <View
                  style={[
                    styles.alert,
                    cashDifference > 0 ? styles.alertOver : styles.alertShort
                  ]}
                  accessible={true}
                  accessibilityRole="alert"
                  accessibilityLabel={`${cashDifference > 0 ? 'Cash over' : 'Cash short'}. Difference: ${Math.abs(cashDifference).toFixed(2)} dollars`}
                  accessibilityLiveRegion="polite"
                >
                  <View style={[
                    styles.alertBg,
                    cashDifference > 0 ? styles.alertBgOver : styles.alertBgShort
                  ]}>
                    <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
                  </View>
                  <Text style={[
                    styles.alertTitle,
                    cashDifference > 0 ? styles.alertTitleOver : styles.alertTitleShort
                  ]} accessible={false}>
                    {cashDifference > 0 ? '⚠️ CASH OVER' : '❌ CASH SHORT'}
                  </Text>
                  <Text style={styles.alertText} accessible={false}>
                    Difference: ${Math.abs(cashDifference).toFixed(2)}
                  </Text>
                </View>
              )}

              {/* Notes */}
              <View style={styles.notesSection}>
                <Text style={styles.inputLabel} accessible={false}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any notes about the closing count or shift..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  numberOfLines={2}
                  accessible={true}
                  accessibilityLabel="Notes, optional"
                  accessibilityHint="Enter any notes about the closing cash count or shift"
                />
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  accessibilityHint="Double tap to cancel and return without closing shift"
                >
                  <Text style={styles.cancelButtonText} accessible={false}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSubmit}
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Close shift"
                  accessibilityHint="Double tap to record closing cash and end your shift"
                >
                  <Text style={styles.submitButtonText} accessible={false}>CLOSE SHIFT</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  )
}

const CloseCashDrawerModalMemo = memo(CloseCashDrawerModal)
export { CloseCashDrawerModalMemo as CloseCashDrawerModal }

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: isTablet ? 40 : 20,
  },
  modalContent: {
    maxWidth: isTablet ? 600 : '100%', // Optimized for iPad Pro
    alignSelf: 'center',
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
  },
  // JOBS PRINCIPLE: Two-column layout for landscape
  twoColumnContainer: {
    flexDirection: isTablet ? 'row' : 'column',
    gap: isTablet ? 16 : 0,
    marginHorizontal: 24,
    marginBottom: 16, // JOBS: Reduced to match spacing
  },
  summary: {
    flex: isTablet ? 1 : undefined,
    marginHorizontal: isTablet ? 0 : 0,
    marginBottom: isTablet ? 0 : 16, // JOBS: Reduced to match spacing
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  summaryBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.1,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.9)',
  },
  summaryRowFinal: {
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  summaryLabelFinal: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryValueFinal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  instructions: {
    flex: isTablet ? 1 : undefined,
    marginHorizontal: isTablet ? 0 : 0,
    marginBottom: isTablet ? 0 : 16, // JOBS: Reduced to match spacing
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  instructionsBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  instructionsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(96,165,250,0.9)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  instructionsList: {
    gap: 6,
  },
  instructionItem: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.1,
  },
  inputSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dollarSign: {
    fontSize: 36,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: -1,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  alert: {
    marginHorizontal: 24,
    marginBottom: 16, // JOBS: Reduced to match spacing
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  alertOver: {
    borderColor: 'rgba(251,191,36,0.3)',
  },
  alertShort: {
    borderColor: 'rgba(239,68,68,0.3)',
  },
  alertBg: {
    ...StyleSheet.absoluteFillObject,
  },
  alertBgOver: {
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  alertBgShort: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  alertTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  alertTitleOver: {
    color: 'rgba(251,191,36,0.9)',
  },
  alertTitleShort: {
    color: 'rgba(239,68,68,0.9)',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.1,
  },
  notesSection: {
    paddingHorizontal: 24,
    marginBottom: 16, // JOBS: Reduced to match spacing
  },
  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.2,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16, // JOBS: Reduced to match top padding weight
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.2,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: 'rgba(59,130,246,0.8)',
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
})
