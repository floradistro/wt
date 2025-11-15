import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, Animated, Dimensions, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useRef, useEffect, useState } from 'react'

const { width } = Dimensions.get('window')
const isTablet = width > 600

interface OpenCashDrawerModalProps {
  visible: boolean
  onSubmit: (openingCash: number, notes: string) => void
  onCancel: () => void
}

export function OpenCashDrawerModal({ visible, onSubmit, onCancel }: OpenCashDrawerModalProps) {
  const [openingCash, setOpeningCash] = useState('')
  const [notes, setNotes] = useState('')
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current

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
    const amount = parseFloat(openingCash || '0')
    if (amount < 0) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSubmit(amount, notes)
    setOpeningCash('')
    setNotes('')
  }

  const handleQuickAmount = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setOpeningCash(amount.toString())
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setOpeningCash('')
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
            >
              <View style={styles.modalBg}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>COUNT CASH DRAWER</Text>
                <Text style={styles.subtitle}>Count all bills and coins before starting</Text>
              </View>

              {/* Instructions */}
              <View style={styles.instructions}>
                <View style={styles.instructionsBg}>
                  <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
                </View>
                <Text style={styles.instructionsTitle}>BEFORE YOU START</Text>
                <View style={styles.instructionsList}>
                  <Text style={styles.instructionItem}>1. Count all bills and coins in drawer</Text>
                  <Text style={styles.instructionItem}>2. Include change from previous shift</Text>
                  <Text style={styles.instructionItem}>3. Enter total amount below</Text>
                </View>
              </View>

              {/* Amount Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>OPENING CASH COUNT</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={openingCash}
                    onChangeText={setOpeningCash}
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </View>
              </View>

              {/* Quick Amounts */}
              <View style={styles.quickAmounts}>
                {[0, 100, 200, 300].map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={styles.quickButton}
                    onPress={() => handleQuickAmount(amount)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickButtonText}>${amount}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <View style={styles.notesSection}>
                <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any notes about the opening count..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSubmit}
                  activeOpacity={0.7}
                >
                  <Text style={styles.submitButtonText}>START SHIFT</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  )
}

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
    maxWidth: isTablet ? 500 : '100%',
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
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  instructions: {
    marginHorizontal: 24,
    marginBottom: 24,
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
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(96,165,250,0.9)',
    letterSpacing: 2,
    marginBottom: 12,
  },
  instructionsList: {
    gap: 6,
  },
  instructionItem: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  inputSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
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
    fontSize: 32,
    fontWeight: '200',
    color: 'rgba(255,255,255,0.4)',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 1,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
  },
  notesSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.3,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
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
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: 'rgba(59,130,246,0.8)',
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 2,
  },
})
