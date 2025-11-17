import { View, Text, StyleSheet, Alert, TouchableOpacity, Linking, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect, useRef } from 'react'
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera'
import * as Haptics from 'expo-haptics'
import { parseAAMVABarcode, calculateAge, isLegalAge, type AAMVAData } from '@/lib/id-scanner/aamva-parser'
import { playSuccessBeep, playRejectionTone } from '@/lib/id-scanner/audio'
import { colors, typography, spacing, radius, Button } from '@/theme'
import { logger } from '@/utils/logger'

export function ScanScreen() {
  const [hasPermission, setHasPermission] = useState(false)
  const [isScanning, setIsScanning] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('Position barcode in frame')
  const [scannedData, setScannedData] = useState<AAMVAData | null>(null)
  const [ageBlocker, setAgeBlocker] = useState<{ show: boolean; age: number } | null>(null)

  const device = useCameraDevice('back')

  // DEBOUNCING - Prevent duplicate scans (backup scanner logic)
  const lastScannedCode = useRef<string | null>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Animations - Jobs Principle: Smooth, fast, delightful
  const lockOnAnim = useRef(new Animated.Value(0)).current
  const successFlashAnim = useRef(new Animated.Value(0)).current
  const rejectFlashAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    checkPermissions()

    // Reset state on mount
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [])

  const checkPermissions = async () => {
    const cameraPermission = await Camera.getCameraPermissionStatus()

    if (cameraPermission === 'granted') {
      setHasPermission(true)
    } else if (cameraPermission === 'not-determined') {
      const newPermission = await Camera.requestCameraPermission()
      setHasPermission(newPermission === 'granted')
    } else {
      setHasPermission(false)
      setMessage('Camera blocked - Open Settings to allow')
    }
  }

  // Jobs Principle: Code scanner at 60fps (backup scanner logic)
  const codeScanner = useCodeScanner({
    codeTypes: ['pdf-417', 'qr', 'ean-13', 'code-128'],
    onCodeScanned: (codes) => {
      if (!isScanning || isProcessing || codes.length === 0) return

      const code = codes[0]
      if (!code.value) return

      // DEBOUNCE: Ignore if same code was just scanned (backup scanner logic)
      if (lastScannedCode.current === code.value) return
      lastScannedCode.current = code.value

      // STOP scanning immediately to prevent spam (backup scanner logic)
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

      // Process INSTANTLY (no delay) - backup scanner logic
      handleBarcodeScan(code.value!)
    },
  })

  const handleBarcodeScan = async (data: string) => {
    try {
      setIsProcessing(true)
      setIsScanning(false)

      // Try to parse as AAMVA (driver's license)
      if (data.includes('ANSI')) {
        logger.debug('📋 Parsing AAMVA barcode...')
        const parsed = parseAAMVABarcode(data)
        logger.debug('✅ Parsed data:', parsed)

        setScannedData(parsed)

        // Jobs Principle: Age verification is FIRST (critical compliance) - backup scanner logic
        if (parsed.dateOfBirth) {
          const age = calculateAge(parsed.dateOfBirth)
          const legal = isLegalAge(parsed.dateOfBirth)

          logger.debug('🎂 Age check - Age:', age, 'Legal:', legal)

          if (!legal && age !== undefined) {
            // UNDER 21 - HARD STOP (cannot bypass) - backup scanner logic
            setMessage('UNDER 21 - CANNOT PROCEED')

            // Jobs Principle: Unmistakable rejection (RED + haptic + sound)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            playRejectionTone() // Audio rejection tone

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
        const age = calculateAge(parsed.dateOfBirth || '')
        setMessage(`AGE: ${age} ✓ Verified`)

        // Jobs Principle: Success feedback (GREEN + haptic)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        Animated.timing(successFlashAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          successFlashAnim.setValue(0)
        })

        Alert.alert(
          'ID Scanned',
          `Name: ${parsed.firstName} ${parsed.lastName}\nDOB: ${parsed.dateOfBirth}\nAge: ${age}\nState: ${parsed.state}`,
          [
            {
              text: 'Scan Again',
              onPress: () => resetScanner()
            },
            {
              text: 'Done',
              onPress: () => resetScanner()
            }
          ]
        )
      } else {
        // Regular barcode/QR code
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        await playSuccessBeep()

        Alert.alert(
          'Barcode Scanned',
          data,
          [
            {
              text: 'OK',
              onPress: () => resetScanner()
            }
          ]
        )
      }
    } catch (error) {
      logger.error('❌ Scan error:', error)
      setMessage('Scan failed - Try again')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      resetScanner()
    }
  }

  const resetScanner = () => {
    setScannedData(null)
    setIsScanning(true)
    setIsProcessing(false)
    setMessage('Position barcode in frame')
    lastScannedCode.current = null
    lockOnAnim.setValue(0)
  }

  const handleCloseAgeBlocker = () => {
    setAgeBlocker(null)
    rejectFlashAnim.setValue(0)
    resetScanner()
  }

  const openSettings = () => {
    Linking.openSettings()
  }

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <Text style={styles.title}>CAMERA ACCESS</Text>
          <Text style={styles.subtitle}>Required for ID & Barcode Scanning</Text>

          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>
              This app needs camera access to scan IDs and product barcodes.
            </Text>

            <Button
              variant="primary"
              size="large"
              onPress={openSettings}
              style={{ marginTop: spacing.xl }}
            >
              Open Settings
            </Button>

            <Button
              variant="ghost"
              size="medium"
              onPress={checkPermissions}
              style={{ marginTop: spacing.md }}
            >
              Check Again
            </Button>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.content}>
          <Text style={styles.title}>NO CAMERA</Text>
          <Text style={styles.subtitle}>Camera device not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isScanning && !isProcessing}
        codeScanner={codeScanner}
      />

      {/* Success Flash (Green) - backup scanner visual feedback */}
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

      {/* Reject Flash (Red) - backup scanner visual feedback */}
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

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>SCAN ID OR BARCODE</Text>
          <Text style={styles.subtitle}>{message}</Text>
        </View>

        {/* Scanning frame with lock-on animation */}
        <View style={styles.scanFrame}>
          <Animated.View
            style={[
              styles.scanFrameBorder,
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
          >
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </Animated.View>
        </View>

        {/* Info */}
        <View style={styles.footer}>
          <Text style={styles.infoText}>
            Supports PDF417 (IDs), QR, and standard barcodes
          </Text>
        </View>
      </SafeAreaView>

      {/* Age Blocker Modal - Jobs Principle: Unmistakable STOP (Under 21) */}
      {ageBlocker?.show && (
        <View style={styles.ageBlockerContainer}>
          <View style={styles.ageBlockerContent}>
            <View style={styles.stopIcon}>
              <Text style={styles.stopIconText}>🛑</Text>
            </View>
            <Text style={styles.ageBlockerTitle}>UNDER 21</Text>
            <Text style={styles.ageBlockerAge}>AGE: {ageBlocker.age}</Text>
            <Text style={styles.ageBlockerMessage}>CANNOT PROCEED</Text>

            <Button
              variant="ghost"
              size="large"
              onPress={handleCloseAgeBlocker}
              style={{ marginTop: spacing.xxxl }}
            >
              DISMISS
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.title.large,
    fontWeight: '200',
    letterSpacing: 2,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.uppercase,
    color: colors.text.subtle,
    letterSpacing: 3,
    textAlign: 'center',
  },
  permissionBox: {
    marginTop: spacing.massive,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  permissionText: {
    ...typography.body.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  scanFrame: {
    alignSelf: 'center',
    width: 300,
    height: 200,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrameBorder: {
    width: '100%',
    height: '100%',
    borderWidth: 4,
    borderRadius: radius.md,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.text.primary,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radius.md,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radius.md,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radius.md,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radius.md,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  infoText: {
    ...typography.caption.regular,
    color: colors.text.ghost,
    textAlign: 'center',
  },
  // Age Blocker Modal - Jobs Principle: Unmistakable STOP
  ageBlockerContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageBlockerContent: {
    alignItems: 'center',
    padding: spacing.massive,
  },
  stopIcon: {
    marginBottom: spacing.xl,
  },
  stopIconText: {
    fontSize: 120,
  },
  ageBlockerTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ff0000',
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  ageBlockerAge: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  ageBlockerMessage: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 2,
  },
})
