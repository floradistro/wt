/**
 * useCameraScanner Hook - ZERO PROPS ✅
 * Jobs Principle: Manage camera lifecycle and ID scanning
 *
 * ZERO PROP DRILLING:
 * - No onScanComplete callback - calls customer.store action directly
 * - Handles camera permissions, lifecycle, scanning, age verification
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, useCodeScanner } from 'react-native-vision-camera'
import * as Haptics from 'expo-haptics'
import { parseAAMVABarcode, isLegalAge, calculateAge, type AAMVAData } from '@/lib/id-scanner/aamva-parser'
import { playSuccessBeep, playRejectionTone } from '@/lib/id-scanner/audio'
import { logger } from '@/utils/logger'
import { customerActions } from '@/stores/customer.store'
import { supabase } from '@/lib/supabase/client'
import { checkoutUIActions } from '@/stores/checkout-ui.store'
import { scannedOrderActions } from '@/stores/scanned-order.store'

// UUID regex to detect wallet pass QR codes (customer ID or order ID)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function useCameraScanner() {
  // ========================================
  // STATE
  // ========================================
  const [hasPermission, setHasPermission] = useState(false)
  const [isScanning, setIsScanning] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [cameraActive, setCameraActive] = useState(true)
  const [scanMessage, setScanMessage] = useState('')
  const [parsedData, setParsedData] = useState<AAMVAData | null>(null)
  const [cameraKey, setCameraKey] = useState(0)
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)

  const lastScannedCode = useRef<string | null>(null)

  // ========================================
  // CAMERA PERMISSIONS
  // ========================================
  const requestCameraPermission = async () => {
    const permission = await Camera.requestCameraPermission()
    setHasPermission(permission === 'granted')
  }

  useEffect(() => {
    requestCameraPermission()
  }, [])

  // ========================================
  // WALLET PASS / ORDER QR CODE SCANNING
  // ========================================
  const handleUUIDScan = async (uuid: string) => {
    try {
      logger.info('[CameraScanner] UUID QR detected:', uuid)

      // First, try to find as customer (loyalty pass)
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', uuid)
        .single()

      if (customer && !customerError) {
        // Found customer - select them
        logger.info('[CameraScanner] Customer found from wallet pass:', customer.first_name, customer.last_name)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        customerActions.selectCustomer(customer)
        checkoutUIActions.closeModal()
        return
      }

      // Not a customer - try as order (pickup order pass)
      logger.info('[CameraScanner] Not a customer, trying as order...')
      const orderFound = await scannedOrderActions.loadOrder(uuid)

      if (orderFound) {
        // Found order - close modal and show order card
        logger.info('[CameraScanner] Order found from QR code')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        checkoutUIActions.closeModal()
        return
      }

      // Neither customer nor order found
      logger.error('[CameraScanner] UUID not found as customer or order')
      setScanMessage('Not found')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      playRejectionTone()

      setTimeout(() => {
        setScanMessage('')
        lastScannedCode.current = null
        setIsScanning(true)
        setIsProcessing(false)
      }, 1500)

    } catch (error) {
      logger.error('[CameraScanner] Error looking up UUID:', error)
      resetScanner()
    }
  }

  // ========================================
  // BARCODE SCANNING (ID Cards)
  // ========================================
  const handleBarcodeScan = async (barcodeData: string) => {
    try {
      const data = parseAAMVABarcode(barcodeData)

      // Age verification FIRST
      if (data.dateOfBirth) {
        const age = calculateAge(data.dateOfBirth)
        const legal = isLegalAge(data.dateOfBirth)

        if (!legal && age !== undefined) {
          setScanMessage(`UNDER 21 - Age ${age}`)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          playRejectionTone()

          // Reset scanner after brief display
          setTimeout(() => {
            setScanMessage('')
            lastScannedCode.current = null
            setIsScanning(true)
            setIsProcessing(false)
          }, 1500)
          return
        }
      }

      // Show parsed data and save to customer store (ZERO PROP DRILLING ✅)
      setParsedData(data)
      customerActions.setScannedData(data)
    } catch (error) {
      logger.error('Scan error:', error)
      resetScanner()
    }
  }

  // System-optimized scanner callback - zero overhead
  const handleCodeScanned = useCallback(
    (codes: any[]) => {
      if (!isScanning || isProcessing || codes.length === 0) return

      const code = codes[0]
      if (!code.value) return

      // DEBOUNCE: Ignore if same code was just scanned
      if (lastScannedCode.current === code.value) return
      lastScannedCode.current = code.value

      // STOP scanning immediately to prevent spam
      setIsScanning(false)
      setIsProcessing(true)

      // Immediate haptic + beep
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      playSuccessBeep()

      // Check if it's a UUID (wallet pass QR code - customer or order)
      if (UUID_REGEX.test(code.value)) {
        logger.info('[CameraScanner] QR code detected - UUID (customer or order)')
        handleUUIDScan(code.value)
      } else {
        // Otherwise treat as ID barcode (PDF-417)
        handleBarcodeScan(code.value!)
      }
    },
    [isScanning, isProcessing]
  )

  const codeScanner = useCodeScanner({
    codeTypes: ['pdf-417', 'qr'], // Support both ID barcodes and wallet pass QR codes
    onCodeScanned: handleCodeScanned,
  })

  // ========================================
  // CAMERA FOCUS
  // ========================================
  const handleCameraPress = useCallback((event: any, cameraRef: React.RefObject<Camera | null>) => {
    if (!cameraActive || isProcessing || parsedData) return

    const { locationX, locationY } = event.nativeEvent

    // Set focus point for visual feedback
    setFocusPoint({ x: locationX, y: locationY })

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Focus camera at point
    if (cameraRef.current) {
      cameraRef.current.focus({ x: locationX, y: locationY })
    }

    // Clear focus point after animation
    setTimeout(() => {
      setFocusPoint(null)
    }, 800)
  }, [cameraActive, isProcessing, parsedData])

  // ========================================
  // CAMERA LIFECYCLE
  // ========================================
  const resetScanner = () => {
    // Step 1: Unmount camera
    setCameraActive(false)

    // Step 2: Reset all state
    lastScannedCode.current = null
    setParsedData(null)
    setIsProcessing(false)

    // Step 3: Remount camera after brief delay for clean reset
    setTimeout(() => {
      setCameraKey((prev) => prev + 1)
      setCameraActive(true)
      setIsScanning(true)
    }, 50)
  }

  const resetAll = () => {
    setCameraActive(true)
    setIsScanning(true)
    setIsProcessing(false)
    setScanMessage('')
    setParsedData(null)
    lastScannedCode.current = null
    setFocusPoint(null)
  }

  return {
    // State
    hasPermission,
    isScanning,
    isProcessing,
    cameraActive,
    scanMessage,
    parsedData,
    cameraKey,
    focusPoint,
    codeScanner,

    // Actions
    resetScanner,
    resetAll,
    handleCameraPress,
    setScanMessage,
    setParsedData,
  }
}
