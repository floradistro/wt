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

// USPS tracking number patterns:
// - 20-22 digits starting with 94, 92, 93, 70, 23, 13
// - Format: 9400111899223033005656 (22 digits typical)
const USPS_TRACKING_REGEX = /^(94|93|92|70|23|13)\d{18,20}$/

// UPS tracking: 1Z followed by 16 alphanumeric chars
const UPS_TRACKING_REGEX = /^1Z[A-Z0-9]{16}$/i

// FedEx tracking: 12-15 or 20-22 digits
const FEDEX_TRACKING_REGEX = /^(\d{12,15}|\d{20,22})$/

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
  // SHIPPING LABEL SCANNING (USPS, UPS, FedEx)
  // ========================================
  const handleTrackingNumberScan = async (rawTrackingNumber: string) => {
    try {
      // Clean the tracking number:
      // - Remove spaces, dashes, newlines
      // - Remove GS1 separator character \x1D (ASCII 29) used in Code-128 barcodes
      // - Remove other control characters
      let trackingNumber = rawTrackingNumber
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove all control characters (including \x1D)
        .replace(/[\s\-]/g, '') // Remove spaces and dashes
        .trim()

      // USPS barcodes often include ZIP routing prefix: 420XXXXX or 420XXXXXXXXX (ZIP+4)
      // Format: 420 + 5-digit ZIP + tracking number, or 420 + 9-digit ZIP+4 + tracking number
      // Strip the prefix to get just the tracking number
      if (trackingNumber.startsWith('420') && trackingNumber.length > 25) {
        // Check for 420 + 5-digit ZIP (8 char prefix)
        const afterZip5 = trackingNumber.substring(8)
        // Check for 420 + 9-digit ZIP+4 (12 char prefix)
        const afterZip9 = trackingNumber.substring(12)

        if (/^(94|93|92|70|23|13)\d{18,20}$/.test(afterZip5)) {
          logger.info('[CameraScanner] Stripped 420+ZIP5 prefix:', { original: trackingNumber, stripped: afterZip5 })
          trackingNumber = afterZip5
        } else if (/^(94|93|92|70|23|13)\d{18,20}$/.test(afterZip9)) {
          logger.info('[CameraScanner] Stripped 420+ZIP9 prefix:', { original: trackingNumber, stripped: afterZip9 })
          trackingNumber = afterZip9
        }
      }

      logger.info('[CameraScanner] Tracking number detected:', { raw: rawTrackingNumber, clean: trackingNumber })

      // Try exact match first
      let { data: order, error } = await supabase
        .from('orders')
        .select('id')
        .eq('tracking_number', trackingNumber)
        .single()

      // If exact match fails, try ILIKE for partial/fuzzy match
      if (!order || error) {
        const { data: fuzzyOrder, error: fuzzyError } = await supabase
          .from('orders')
          .select('id')
          .ilike('tracking_number', `%${trackingNumber}%`)
          .single()

        if (fuzzyOrder && !fuzzyError) {
          order = fuzzyOrder
          error = null
          logger.info('[CameraScanner] Order found via fuzzy match')
        }
      }

      if (order && !error) {
        // Found order - load it
        logger.info('[CameraScanner] Order found from tracking number:', order.id)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        const orderLoaded = await scannedOrderActions.loadOrder(order.id)
        if (orderLoaded) {
          checkoutUIActions.closeModal()
          return
        }
      }

      // Also check order_shipments table for multi-location orders
      let { data: shipment, error: shipmentError } = await supabase
        .from('order_shipments')
        .select('order_id')
        .eq('tracking_number', trackingNumber)
        .single()

      // Try fuzzy match on shipments too
      if (!shipment || shipmentError) {
        const { data: fuzzyShipment, error: fuzzyShipmentError } = await supabase
          .from('order_shipments')
          .select('order_id')
          .ilike('tracking_number', `%${trackingNumber}%`)
          .single()

        if (fuzzyShipment && !fuzzyShipmentError) {
          shipment = fuzzyShipment
          shipmentError = null
        }
      }

      if (shipment && !shipmentError) {
        logger.info('[CameraScanner] Order found from shipment tracking:', shipment.order_id)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        const orderLoaded = await scannedOrderActions.loadOrder(shipment.order_id)
        if (orderLoaded) {
          checkoutUIActions.closeModal()
          return
        }
      }

      // Not found - debug: check for any recent orders with tracking numbers
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, order_number, tracking_number')
        .not('tracking_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5)

      logger.warn('[CameraScanner] No order found for tracking:', {
        searchedFor: trackingNumber,
        recentOrdersWithTracking: recentOrders?.map(o => ({
          orderNumber: o.order_number,
          tracking: o.tracking_number,
        })),
      })

      setScanMessage('No order found')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      playRejectionTone()

      setTimeout(() => {
        setScanMessage('')
        lastScannedCode.current = null
        setIsScanning(true)
        setIsProcessing(false)
      }, 1500)

    } catch (error) {
      logger.error('[CameraScanner] Error looking up tracking number:', error)
      resetScanner()
    }
  }

  // Helper to detect if a code is a shipping tracking number
  const isTrackingNumber = (code: string): boolean => {
    // Clean the code (remove spaces, dashes, etc.)
    const cleanCode = code.replace(/[\s\-]/g, '')
    return (
      USPS_TRACKING_REGEX.test(cleanCode) ||
      UPS_TRACKING_REGEX.test(cleanCode) ||
      FEDEX_TRACKING_REGEX.test(cleanCode)
    )
  }

  // Clean tracking number for lookup
  const cleanTrackingNumber = (code: string): string => {
    return code.replace(/[\s\-]/g, '')
  }

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

  // Helper to check if a string contains mostly printable ASCII (not binary garbage)
  const isPrintableString = (str: string): boolean => {
    if (!str || str.length === 0) return false
    // Count printable ASCII characters (space through ~, plus common whitespace)
    const printableCount = str.split('').filter(c => {
      const code = c.charCodeAt(0)
      return (code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9
    }).length
    // At least 80% should be printable
    return printableCount / str.length >= 0.8
  }

  // Helper to score a barcode for shipping label detection
  const scoreBarcodeForTracking = (code: any): number => {
    if (!code?.value) return -1
    const value = code.value
    const type = code.type?.toLowerCase() || ''
    const cleanedValue = value.replace(/[\s\-]/g, '')

    // Reject binary/garbage data
    if (!isPrintableString(value)) return -1

    // UUID (wallet pass) - high priority
    if (UUID_REGEX.test(value)) return 100

    // AAMVA ID card - high priority
    if (value.startsWith('@') && value.includes('ANSI')) return 100

    // Looks like USPS tracking (with or without ZIP prefix)
    if (/^420\d{5}(94|93|92|70|23|13)\d{18,20}$/.test(cleanedValue)) return 90
    if (/^(94|93|92|70|23|13)\d{18,20}$/.test(cleanedValue)) return 90

    // UPS tracking
    if (/^1Z[A-Z0-9]{16}$/i.test(cleanedValue)) return 90

    // Code-128 is preferred for shipping labels
    if (type.includes('128')) return 50

    // PDF-417 without AAMVA is lower priority (often routing data)
    if (type.includes('417')) return 10

    // QR codes
    if (type.includes('qr')) return 30

    return 0
  }

  // System-optimized scanner callback - zero overhead
  const handleCodeScanned = useCallback(
    (codes: any[]) => {
      if (!isScanning || isProcessing || codes.length === 0) return

      // Score all detected barcodes and pick the best one
      const scoredCodes = codes
        .map(c => ({ code: c, score: scoreBarcodeForTracking(c) }))
        .filter(sc => sc.score >= 0)
        .sort((a, b) => b.score - a.score)

      logger.info('[CameraScanner] Detected barcodes:', {
        total: codes.length,
        scored: scoredCodes.map(sc => ({
          type: sc.code.type,
          score: sc.score,
          firstChars: sc.code.value?.substring(0, 30),
        })),
      })

      if (scoredCodes.length === 0) {
        logger.warn('[CameraScanner] No valid barcodes detected (all binary/garbage)')
        return
      }

      const code = scoredCodes[0].code
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

      const barcodeType = code.type?.toLowerCase() || ''
      const cleanedValue = code.value.replace(/[\s\-]/g, '')

      // Check if this looks like a USPS/shipping tracking number (starts with common prefixes)
      const looksLikeTracking = /^(420\d{5})?(94|93|92|70|23|13|1Z)/i.test(cleanedValue)
      // Check if this is definitely an AAMVA ID barcode (starts with @ followed by ANSI)
      const isDefinitelyAAMVA = code.value.startsWith('@') && code.value.includes('ANSI')

      logger.info('[CameraScanner] Processing best barcode:', {
        type: barcodeType,
        valueLength: code.value.length,
        cleanedLength: cleanedValue.length,
        looksLikeTracking,
        isDefinitelyAAMVA,
        value: code.value.substring(0, 50),
      })

      // PRIORITY 1: If it's definitely an AAMVA ID card, parse it
      if (isDefinitelyAAMVA) {
        logger.info('[CameraScanner] Definite AAMVA ID card detected')
        handleBarcodeScan(code.value)
        return
      }

      // PRIORITY 2: Check content patterns (most reliable)
      if (UUID_REGEX.test(code.value)) {
        logger.info('[CameraScanner] QR code detected - UUID (customer or order)')
        handleUUIDScan(code.value)
        return
      }

      // PRIORITY 3: If it looks like a tracking number, treat it as one
      if (looksLikeTracking || isTrackingNumber(code.value)) {
        logger.info('[CameraScanner] Tracking number pattern detected')
        handleTrackingNumberScan(code.value)
        return
      }

      // PRIORITY 4: Route by barcode type (fallback)
      if (barcodeType.includes('128')) {
        logger.info('[CameraScanner] Code-128 detected - treating as shipping label')
        handleTrackingNumberScan(code.value)
      } else if (barcodeType.includes('417')) {
        // PDF-417 without AAMVA header - might be shipping routing barcode
        logger.info('[CameraScanner] PDF-417 without AAMVA - skipping (likely routing data)')
        resetScanner()
      } else {
        // Unknown barcode - try tracking lookup (non-destructive)
        logger.info('[CameraScanner] Unknown barcode type, trying as tracking number:', barcodeType)
        handleTrackingNumberScan(code.value)
      }
    },
    [isScanning, isProcessing]
  )

  const codeScanner = useCodeScanner({
    // Support:
    // - pdf-417: ID cards (driver's license)
    // - qr: Wallet passes (customer loyalty, order pickup)
    // - code-128: Shipping labels (USPS, UPS, FedEx)
    codeTypes: ['pdf-417', 'qr', 'code-128'],
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
