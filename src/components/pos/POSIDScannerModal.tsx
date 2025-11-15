import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, ActivityIndicator, Dimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useState, useRef, useEffect } from 'react'
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera'
import { parseAAMVABarcode, isLegalAge, calculateAge, type AAMVAData } from '@/lib/id-scanner/aamva-parser'
import { playSuccessBeep, playRejectionTone } from '@/lib/id-scanner/audio'
import { supabase } from '@/lib/supabase/client'
import type { Customer } from '@/types/pos'

const { width, height } = Dimensions.get('window')

interface POSIDScannerModalProps {
  visible: boolean
  vendorId: string
  onCustomerFound: (customer: Customer) => void
  onNoMatchFoundWithData: (data: AAMVAData) => void
  onClose: () => void
}

export function POSIDScannerModal({
  visible,
  vendorId,
  onCustomerFound,
  onNoMatchFoundWithData,
  onClose,
}: POSIDScannerModalProps) {
  const insets = useSafeAreaInsets()
  const [hasPermission, setHasPermission] = useState(false)
  const [isScanning, setIsScanning] = useState(true)
  const [message, setMessage] = useState('Position barcode in frame')
  const [isProcessing, setIsProcessing] = useState(false)
  const [scannedData, setScannedData] = useState<AAMVAData | null>(null)
  const [ageBlocker, setAgeBlocker] = useState<{ show: boolean; age: number } | null>(null)
  const [matchConfirmation, setMatchConfirmation] = useState<{
    customer: Customer
    scannedData: AAMVAData
  } | null>(null)

  // Prevent duplicate scans
  const lastScannedCode = useRef<string | null>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Animations - Jobs Principle: Smooth, fast, delightful
  const lockOnAnim = useRef(new Animated.Value(0)).current
  const successFlashAnim = useRef(new Animated.Value(0)).current
  const rejectFlashAnim = useRef(new Animated.Value(0)).current

  // Get back camera
  const device = useCameraDevice('back')

  // Request permission on mount
  useEffect(() => {
    if (visible) {
      requestCameraPermission()
      // Reset state when modal opens
      setIsScanning(true)
      setMessage('Position barcode in frame')
      setIsProcessing(false)
      setScannedData(null)
      setAgeBlocker(null)
      setMatchConfirmation(null)
      lastScannedCode.current = null
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
      lockOnAnim.setValue(0)
      successFlashAnim.setValue(0)
      rejectFlashAnim.setValue(0)
    }
  }, [visible])

  const requestCameraPermission = async () => {
    const permission = await Camera.requestCameraPermission()
    setHasPermission(permission === 'granted')

    if (permission === 'denied') {
      setMessage('Camera blocked - Open Settings to allow')
    }
  }

  // Jobs Principle: Code scanner at 60fps
  const codeScanner = useCodeScanner({
    codeTypes: ['pdf-417'],
    onCodeScanned: (codes) => {
      if (!isScanning || isProcessing || codes.length === 0) return

      const code = codes[0]
      if (!code.value) return

      // DEBOUNCE: Ignore if same code was just scanned
      if (lastScannedCode.current === code.value) return
      lastScannedCode.current = code.value

      // STOP scanning immediately to prevent spam
      setIsScanning(false)
      setIsProcessing(true)

      // Jobs Principle: Immediate visual lock-on feedback + haptic + beep
      setMessage('Locked!')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      playSuccessBeep() // Play beep immediately

      Animated.spring(lockOnAnim, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }).start()

      // Process INSTANTLY (no delay)
      handleBarcodeScan(code.value!)
    },
  })

  const handleBarcodeScan = async (barcodeData: string) => {
    try {
      setIsProcessing(true)
      setIsScanning(false)

      // Parse AAMVA barcode
      const parsedData = parseAAMVABarcode(barcodeData)

      setScannedData(parsedData)

      // Jobs Principle: Age verification is FIRST (critical compliance)
      if (parsedData.dateOfBirth) {
        const age = calculateAge(parsedData.dateOfBirth)
        const legal = isLegalAge(parsedData.dateOfBirth)


        if (!legal && age !== undefined) {
          // UNDER 21 - HARD STOP (cannot bypass)
          setMessage('UNDER 21 - CANNOT PROCEED')

          // Jobs Principle: Unmistakable rejection (RED + haptic + sound)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          playRejectionTone() // Audio rejection tone (descending beep)

          Animated.timing(rejectFlashAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setAgeBlocker({ show: true, age })
            setIsProcessing(false)
          })

          return // STOP - do not proceed
        }
      }

      // Age verified (21+) - show success
      const age = calculateAge(parsedData.dateOfBirth || '')
      setMessage(`AGE: ${age}  Verified`)

      // Jobs Principle: Success feedback (GREEN + haptic)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      Animated.timing(successFlashAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        successFlashAnim.setValue(0)
      })

      // Proceed to customer lookup
      await lookupCustomer(parsedData)
    } catch (error) {
      console.error('❌ Scan error:', error)
      setMessage('Scan failed - Try again')
      setIsScanning(true)
      setIsProcessing(false)
      lockOnAnim.setValue(0)
    }
  }

  const lookupCustomer = async (scannedData: AAMVAData) => {
    try {
      setMessage('Looking up customer...')

      // Use API to search for existing customer
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        onNoMatchFoundWithData(scannedData)
        setIsProcessing(false)
        return
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL
      const url = new URL(`${apiUrl}/api/pos/customers`)
      url.searchParams.set('vendorId', vendorId)
      url.searchParams.set('search', `${scannedData.firstName} ${scannedData.lastName}`)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const { customers } = await response.json()

        // Check if exact match by name
        const exactMatch = customers?.find((c: any) =>
          c.first_name?.toUpperCase() === scannedData.firstName?.toUpperCase() &&
          c.last_name?.toUpperCase() === scannedData.lastName?.toUpperCase()
        )

        if (exactMatch) {
          setMessage(`Welcome back, ${exactMatch.first_name}!`)
          onCustomerFound(exactMatch)
          setIsProcessing(false)
          return
        }
      }

      // No match found - pass data back to parent for manual creation
      setMessage('New customer!')
      onNoMatchFoundWithData(scannedData)
      setIsProcessing(false)

    } catch (error) {
      console.error('❌ Customer lookup error:', error)
      onNoMatchFoundWithData(scannedData)
      setIsProcessing(false)
    }
  }

  const handleConfirmMatch = () => {
    if (matchConfirmation) {
      onCustomerFound(matchConfirmation.customer)
      setMatchConfirmation(null)
    }
  }

  const handleRejectMatch = () => {
    if (matchConfirmation) {
      onNoMatchFoundWithData(matchConfirmation.scannedData)
      setMatchConfirmation(null)
    }
  }

  const handleCloseAgeBlocker = () => {
    setAgeBlocker(null)
    rejectFlashAnim.setValue(0)
    onClose()
  }

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      {/* Jobs Principle: Full-screen camera (black background, clean UI) */}
      <View style={styles.container}>
        {device && hasPermission ? (
          <>
            {/* Camera Preview */}
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isScanning && !isProcessing}
              codeScanner={codeScanner}
            />

            {/* Success Flash (Green) */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: '#00ff00',
                  opacity: successFlashAnim,
                },
              ]}
              pointerEvents="none"
            />

            {/* Reject Flash (Red) */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: '#ff0000',
                  opacity: rejectFlashAnim,
                },
              ]}
              pointerEvents="none"
            />

            {/* Targeting Reticle - Jobs Principle: Visual lock-on */}
            <View style={styles.reticleContainer}>
              <Animated.View
                style={[
                  styles.reticle,
                  {
                    borderColor: lockOnAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['rgba(255,255,255,0.5)', '#00ff00'],
                    }),
                    transform: [{
                      scale: lockOnAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.95],
                      }),
                    }],
                  },
                ]}
              />
            </View>

            {/* Status Message */}
            <View style={[styles.messageContainer, { bottom: 100 }]}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={styles.message}>{message}</Text>
              {isProcessing && (
                <ActivityIndicator size="small" color="#fff" style={{ marginTop: 8 }} />
              )}
            </View>

            {/* Close Button */}
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { top: 60 + insets.top, left: 24 + insets.left }]}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Permission denied or no camera
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>{message}</Text>
            {!hasPermission && (
              <TouchableOpacity onPress={requestCameraPermission} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>GRANT PERMISSION</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Age Blocker - Jobs Principle: Unmistakable STOP (Under 21) */}
      {ageBlocker?.show && (
        <View style={styles.ageBlockerContainer}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.ageBlockerContent}>
            <View style={styles.stopIcon}>
              <Text style={styles.stopIconText}>🛑</Text>
            </View>
            <Text style={styles.ageBlockerTitle}>UNDER 21</Text>
            <Text style={styles.ageBlockerAge}>AGE: {ageBlocker.age}</Text>
            <Text style={styles.ageBlockerMessage}>CANNOT PROCEED</Text>
            <TouchableOpacity onPress={handleCloseAgeBlocker} style={styles.ageBlockerButton}>
              <Text style={styles.ageBlockerButtonText}>DISMISS</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Match Confirmation - Jobs Principle: Side-by-side comparison */}
      {matchConfirmation && (
        <View style={styles.matchContainer}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.matchContent}>
            <Text style={styles.matchTitle}>Customer Match Found</Text>
            <Text style={styles.matchSubtitle}>Is this the same person?</Text>

            <View style={styles.matchCards}>
              {/* Scanned ID Data */}
              <View style={styles.matchCardScanned}>
                <Text style={styles.matchCardLabel}>SCANNED ID</Text>
                <Text style={styles.matchCardName}>
                  {matchConfirmation.scannedData.firstName} {matchConfirmation.scannedData.lastName}
                </Text>
                {matchConfirmation.scannedData.dateOfBirth && (
                  <Text style={styles.matchCardDetail}>DOB: {matchConfirmation.scannedData.dateOfBirth}</Text>
                )}
              </View>

              {/* Existing Customer */}
              <View style={styles.matchCardExisting}>
                <Text style={styles.matchCardLabel}>EXISTING</Text>
                <Text style={styles.matchCardName}>
                  {matchConfirmation.customer.first_name} {matchConfirmation.customer.last_name}
                </Text>
                {matchConfirmation.customer.date_of_birth && (
                  <Text style={styles.matchCardDetail}>DOB: {matchConfirmation.customer.date_of_birth}</Text>
                )}
                {matchConfirmation.customer.email && (
                  <Text style={styles.matchCardDetail}>{matchConfirmation.customer.email}</Text>
                )}
              </View>
            </View>

            <View style={styles.matchButtons}>
              <TouchableOpacity onPress={handleRejectMatch} style={styles.matchButtonReject}>
                <Text style={styles.matchButtonRejectText}>NO, CREATE NEW</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmMatch} style={styles.matchButtonConfirm}>
                <Text style={styles.matchButtonConfirmText}>YES, SAME PERSON</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  reticleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: width * 0.7,
    height: height * 0.25,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)', // Much more visible
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', // Slight white tint
  },
  messageContainer: {
    position: 'absolute',
    // bottom position set dynamically with insets
    left: 24,
    right: 24,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    // top and left positions set dynamically with insets
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 1,
  },

  // Age Blocker (Under 21) - Jobs Principle: Unmistakable STOP
  ageBlockerContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageBlockerContent: {
    alignItems: 'center',
    padding: 40,
  },
  stopIcon: {
    marginBottom: 24,
  },
  stopIconText: {
    fontSize: 120,
  },
  ageBlockerTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ff0000',
    letterSpacing: 4,
    marginBottom: 16,
  },
  ageBlockerAge: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  ageBlockerMessage: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
    marginBottom: 40,
  },
  ageBlockerButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  ageBlockerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 2,
  },

  // Match Confirmation - Jobs Principle: Side-by-side comparison
  matchContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  matchContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  matchTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  matchSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
  },
  matchCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  matchCardScanned: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  matchCardExisting: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  matchCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 8,
  },
  matchCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  matchCardDetail: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
  },
  matchButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  matchButtonReject: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
  },
  matchButtonRejectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  matchButtonConfirm: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    alignItems: 'center',
  },
  matchButtonConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
})
