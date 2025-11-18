import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback, TextInput, FlatList, ActivityIndicator, Dimensions, Platform, Keyboard, Animated } from 'react-native'
import { BlurView } from 'expo-blur'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera'
import { parseAAMVABarcode, isLegalAge, calculateAge, type AAMVAData } from '@/lib/id-scanner/aamva-parser'
import { playSuccessBeep, playRejectionTone } from '@/lib/id-scanner/audio'
import { supabase } from '@/lib/supabase/client'
import type { Customer } from '@/types/pos'
import { logger } from '@/utils/logger'

const { height } = Dimensions.get('window')

interface POSUnifiedCustomerSelectorProps {
  visible: boolean
  vendorId: string
  onCustomerSelected: (customer: Customer) => void
  onNoMatchFoundWithData: (data: AAMVAData) => void
  onAddCustomer?: () => void
  onClose: () => void
}

function POSUnifiedCustomerSelector({
  visible,
  vendorId,
  onCustomerSelected,
  onNoMatchFoundWithData,
  onAddCustomer,
  onClose,
}: POSUnifiedCustomerSelectorProps) {
  const insets = useSafeAreaInsets()
  const [hasPermission, setHasPermission] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  const [isScanning, setIsScanning] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [cameraActive, setCameraActive] = useState(true) // Controls camera mount/unmount
  const [scanMessage, setScanMessage] = useState('')
  const [parsedData, setParsedData] = useState<AAMVAData | null>(null)
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null)
  const [cameraKey, setCameraKey] = useState(0) // Force camera remount for fresh scans
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)
  const searchInputRef = useRef<TextInput>(null)
  const cameraRef = useRef<Camera>(null)
  const lastScannedCode = useRef<string | null>(null)

  // Animated values
  const sheetBottomAnim = useRef(new Animated.Value(0)).current
  const sheetHeightAnim = useRef(new Animated.Value(200)).current
  const previewOpacity = useRef(new Animated.Value(0)).current
  const checkmarkScale = useRef(new Animated.Value(0)).current
  const loadingRotation = useRef(new Animated.Value(0)).current
  const focusRingScale = useRef(new Animated.Value(0)).current
  const focusRingOpacity = useRef(new Animated.Value(0)).current
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const device = useCameraDevice('back')

  // Smart mode: typing mode vs scanning mode
  const isTypingMode = searchQuery.length > 0

  useEffect(() => {
    if (visible) {
      requestCameraPermission()
      // FULL RESET - everything back to initial state
      setSearchQuery('')
      setCustomers([])
      setSearching(false)
      setIsScanning(true)
      setIsProcessing(false)
      setCameraActive(true)
      setScanMessage('')
      setParsedData(null)
      setMatchedCustomer(null)
      setKeyboardHeight(0)
      lastScannedCode.current = null
      previewOpacity.setValue(0)
      checkmarkScale.setValue(0)
      sheetHeightAnim.setValue(200)
      sheetBottomAnim.setValue(0)
    } else {
      // Clean shutdown - unmount camera
      setIsScanning(false)
      setIsProcessing(false)
      setCameraActive(false)
      lastScannedCode.current = null
    }
  }, [visible])

  // Keyboard listeners
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height)
        Animated.spring(sheetBottomAnim, {
          toValue: e.endCoordinates.height - insets.bottom,
          useNativeDriver: false,
          damping: 20,
          stiffness: 200,
        }).start()
      }
    )

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0)
        Animated.spring(sheetBottomAnim, {
          toValue: 0,
          useNativeDriver: false,
          damping: 20,
          stiffness: 200,
        }).start()
      }
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [insets.bottom])

  // Loading spinner animation when searching
  useEffect(() => {
    if (parsedData && !matchedCustomer) {
      // Start continuous rotation for loading
      loadingRotation.setValue(0)
      Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: (t) => t, // Linear
        })
      ).start()
    } else {
      loadingRotation.setValue(0)
    }
  }, [parsedData, matchedCustomer])

  // Animate checkmark when customer found
  useEffect(() => {
    if (matchedCustomer) {
      Animated.spring(checkmarkScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 400,
      }).start()
    } else {
      checkmarkScale.setValue(0)
    }
  }, [matchedCustomer])

  // Smart sheet height animation based on typing mode
  useEffect(() => {
    const hasResults = customers.length > 0

    let targetHeight: number
    if (keyboardHeight > 0) {
      // Keyboard is up - expand to fill available space
      targetHeight = height - keyboardHeight + insets.bottom
    } else if (isTypingMode || hasResults) {
      // Typing or has results - go full screen
      targetHeight = height
    } else {
      // Default compact mode
      targetHeight = 200
    }

    Animated.spring(sheetHeightAnim, {
      toValue: targetHeight,
      useNativeDriver: false,
      damping: 25,
      stiffness: 180,
    }).start()
  }, [isTypingMode, customers.length, keyboardHeight, height, insets.bottom])

  const requestCameraPermission = async () => {
    const permission = await Camera.requestCameraPermission()
    setHasPermission(permission === 'granted')
  }

  // System-optimized scanner callback - zero overhead
  const handleCodeScanned = useCallback((codes: any[]) => {
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

    // Process instantly
    handleBarcodeScan(code.value!)
  }, [isScanning, isProcessing])

  const codeScanner = useCodeScanner({
    codeTypes: ['pdf-417'],
    onCodeScanned: handleCodeScanned,
  })

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

      // Show ONE unified card - starts with "Searching..."
      setParsedData(data)
      Animated.spring(previewOpacity, {
        toValue: 1,
        useNativeDriver: true,
        damping: 20,
        stiffness: 300,
      }).start()

      // Lookup customer and update SAME card
      lookupCustomer(data)
    } catch (error) {
      logger.error('Scan error:', error)
      resetScanner()
    }
  }

  const lookupCustomer = async (scannedData: AAMVAData) => {
    try {
      // Quick exact match lookup using Supabase - filter by vendor
      if (scannedData.firstName && scannedData.lastName) {
        const { data: customers } = await supabase
          .from('customers')
          .select('*')
          .eq('vendor_id', vendorId)
          .ilike('first_name', scannedData.firstName)
          .ilike('last_name', scannedData.lastName)
          .limit(100000) // Search ALL customers for exact match

        const exactMatch = customers?.find((c: any) =>
          c.first_name?.toUpperCase() === scannedData.firstName?.toUpperCase() &&
          c.last_name?.toUpperCase() === scannedData.lastName?.toUpperCase()
        )

        if (exactMatch) {
          // Update SAME card to show match (smooth in-place update)
          setMatchedCustomer(exactMatch)

          // Auto-select after brief confirmation display
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            onCustomerSelected(exactMatch)
          }, 500)
          return
        }
      }

      // No match - trigger intelligent matching flow
      onNoMatchFoundWithData(scannedData)
    } catch (error) {
      logger.error('Lookup error:', error)
      onNoMatchFoundWithData(scannedData)
    }
  }

  // Tap to focus handler
  const handleCameraPress = useCallback((event: any) => {
    if (!cameraActive || isProcessing || parsedData) return

    const { locationX, locationY } = event.nativeEvent

    // Set focus point for camera
    setFocusPoint({ x: locationX, y: locationY })

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Animate focus ring
    focusRingScale.setValue(1.5)
    focusRingOpacity.setValue(1)

    Animated.parallel([
      Animated.spring(focusRingScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(focusRingOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFocusPoint(null)
    })

    // Focus camera at point
    if (cameraRef.current) {
      cameraRef.current.focus({ x: locationX, y: locationY })
    }
  }, [cameraActive, isProcessing, parsedData])

  // Helper to reset scanner to ready state - fully unmounts and remounts camera
  const resetScanner = () => {
    // Step 1: Unmount camera
    setCameraActive(false)

    // Step 2: Reset all state
    lastScannedCode.current = null
    setParsedData(null)
    setMatchedCustomer(null)
    setIsProcessing(false)

    // Step 3: Remount camera after brief delay for clean reset
    setTimeout(() => {
      setCameraKey(prev => prev + 1)
      setCameraActive(true)
      setIsScanning(true)
    }, 50)
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      setCustomers([])
      return
    }

    setSearching(true)
    try {
      // Smart search - Search ALL customers from this vendor across ALL fields, NO LIMITS
      // Searches: first_name, last_name, email, phone, display_name, middle_name
      const searchTerm = query.trim()

      // Normalize phone numbers - remove formatting characters for phone search
      const normalizedPhone = searchTerm.replace(/[\s\-\(\)\.]/g, '')
      const isPhoneSearch = /^\d+$/.test(normalizedPhone) && normalizedPhone.length >= 3

      let searchConditions = `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,middle_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`

      // Add phone search with normalized number for better matching
      if (isPhoneSearch) {
        searchConditions += `,phone.ilike.%${normalizedPhone}%`
      } else {
        searchConditions += `,phone.ilike.%${searchTerm}%`
      }

      const { data: results } = await supabase
        .from('customers')
        .select('*')
        .eq('vendor_id', vendorId)
        .or(searchConditions)
        .order('created_at', { ascending: false })
        .limit(100000) // Very high limit to ensure we get ALL customers (Supabase default is only 1000)

      setCustomers(results || [])
    } catch (error) {
      logger.error('Search error:', error)
    } finally {
      setSearching(false)
    }
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
      <View style={styles.container}>
        {/* Full-screen Camera - Fully unmounts/remounts between scans */}
        {device && hasPermission && cameraActive && (
          <TouchableWithoutFeedback onPress={handleCameraPress}>
            <View style={StyleSheet.absoluteFill}>
              <Camera
                ref={cameraRef}
                key={cameraKey}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={!isTypingMode && isScanning && !isProcessing}
                codeScanner={codeScanner}
              />

              {/* Focus ring indicator */}
              {focusPoint && (
                <Animated.View
                  style={[
                    styles.focusRing,
                    {
                      left: focusPoint.x - 40,
                      top: focusPoint.y - 40,
                      opacity: focusRingOpacity,
                      transform: [{ scale: focusRingScale }],
                    }
                  ]}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        )}

        {/* Manual Add Customer Button - Only show when camera is active */}
        {!isTypingMode && isScanning && !isProcessing && !scanMessage && !parsedData && !matchedCustomer && onAddCustomer && (
          <View style={styles.scanLabelContainer}>
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              interactive
              style={[
                styles.manualAddButton,
                !isLiquidGlassSupported && styles.manualAddButtonFallback,
              ]}
              accessible={false}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onAddCustomer()
                }}
                style={styles.manualAddButtonInner}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Add customer manually"
                accessibilityHint="Double tap to create a new customer without scanning ID"
              >
                <Text style={styles.manualAddText}>+ ADD CUSTOMER</Text>
              </TouchableOpacity>
            </LiquidGlassView>
          </View>
        )}

        {/* Age Warning Message */}
        {scanMessage && (
          <View style={styles.scanMessageContainer}>
            <View
              style={styles.scanMessage}
              accessible={true}
              accessibilityRole="alert"
              accessibilityLabel={scanMessage}
            >
              <Text style={styles.scanMessageText}>{scanMessage}</Text>
            </View>
          </View>
        )}

        {/* Unified Customer Card - Seamless content transition */}
        {parsedData && (
          <Animated.View
            style={[
              styles.unifiedCard,
              { opacity: previewOpacity }
            ]}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={
              matchedCustomer
                ? `Customer found: ${matchedCustomer.display_name || `${matchedCustomer.first_name} ${matchedCustomer.last_name}`.trim() || matchedCustomer.email}${matchedCustomer.loyalty_points > 0 ? `. ${matchedCustomer.loyalty_points} loyalty points` : ''}`
                : `Searching for customer: ${parsedData.firstName} ${parsedData.lastName}${parsedData.dateOfBirth ? `, age ${calculateAge(parsedData.dateOfBirth)}` : ''}`
            }
            accessibilityLiveRegion="polite"
          >
            <BlurView intensity={80} tint="systemThickMaterialDark" style={StyleSheet.absoluteFill} accessible={false} />
            <View style={styles.cardContent} accessible={false}>
              {/* Circle - Shows loading spinner, then checkmark */}
              <View style={styles.checkmark}>
                {/* Outline - always visible */}
                <View style={styles.checkmarkOutline} />

                {/* Loading spinner - visible when searching */}
                {!matchedCustomer && (
                  <Animated.View
                    style={[
                      styles.loadingSpinner,
                      {
                        transform: [{
                          rotate: loadingRotation.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg']
                          })
                        }]
                      }
                    ]}
                  />
                )}

                {/* Checkmark fill - springs in when matched */}
                <Animated.View
                  style={[
                    styles.checkmarkFill,
                    {
                      opacity: matchedCustomer ? 1 : 0,
                      transform: [{ scale: checkmarkScale }],
                    }
                  ]}
                >
                  <Text style={styles.checkmarkText}>✓</Text>
                </Animated.View>
              </View>

              {/* Name - Always same size */}
              <Text style={styles.cardName}>
                {matchedCustomer
                  ? (matchedCustomer.display_name ||
                     `${matchedCustomer.first_name} ${matchedCustomer.last_name}`.trim() ||
                     matchedCustomer.email)
                  : `${parsedData.firstName} ${parsedData.lastName}`}
              </Text>

              {/* Subtitle - Always takes space, content transitions */}
              <Text style={styles.cardSubtitle}>
                {matchedCustomer
                  ? (matchedCustomer.loyalty_points > 0
                      ? `${matchedCustomer.loyalty_points.toLocaleString()} points`
                      : ' ')
                  : (parsedData.dateOfBirth
                      ? `Age ${calculateAge(parsedData.dateOfBirth)}`
                      : ' ')}
              </Text>

              {/* Status - Always same position */}
              <Text style={styles.cardStatus}>
                {matchedCustomer ? 'Customer Found' : 'Searching...'}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Unified Customer List - True Edge to Edge */}
        <Animated.View
          style={[
            styles.listContainer,
            {
              bottom: sheetBottomAnim,
              height: sheetHeightAnim,
            }
          ]}
        >
          <BlurView intensity={95} tint="systemThickMaterialDark" style={StyleSheet.absoluteFill} />

          {/* Unified Header with Search and Done */}
          <View style={[styles.listHeader, { paddingTop: insets.top + 8 }]} accessible={false}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search name, email, or phone"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              autoFocus={false}
              keyboardType="default"
              accessible={true}
              accessibilityLabel="Search customers"
              accessibilityHint="Type to search customers by name, email, or phone"
            />
            <TouchableOpacity
              onPress={onClose}
              style={styles.doneButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Done"
              accessibilityHint="Double tap to close customer selector"
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Customer List - Grouped section with rounded container */}
          <View style={styles.listContent}>
            {searching ? (
              <View
                style={styles.centered}
                accessible={true}
                accessibilityRole="progressbar"
                accessibilityLabel="Searching customers"
              >
                <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
              </View>
            ) : customers.length > 0 ? (
              <View style={styles.customerListSection}>
                <FlatList
                  data={customers}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => {
                    const customerName = item.display_name || `${item.first_name} ${item.last_name}`.trim() || item.email
                    const accessibilityLabel = item.loyalty_points > 0
                      ? `${customerName}, ${item.loyalty_points.toLocaleString()} loyalty points`
                      : customerName

                    return (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          onCustomerSelected(item)
                        }}
                        style={[
                          styles.customerItem,
                          index === 0 && styles.customerItemFirst,
                          index === customers.length - 1 && styles.customerItemLast,
                        ]}
                        activeOpacity={0.7}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={accessibilityLabel}
                        accessibilityHint="Double tap to select this customer"
                      >
                        <Text style={styles.customerName}>
                          {customerName}
                        </Text>
                        {item.loyalty_points > 0 && (
                          <Text style={styles.customerPoints} accessibilityElementsHidden={true} importantForAccessibility="no">
                            {item.loyalty_points.toLocaleString()} pts
                          </Text>
                        )}
                      </TouchableOpacity>
                    )
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  contentContainerStyle={{
                    paddingBottom: Math.max(insets.bottom + keyboardHeight, 16),
                  }}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                />
              </View>
            ) : searchQuery.trim() ? (
              <View
                style={styles.centered}
                accessible={true}
                accessibilityRole="alert"
                accessibilityLabel="No customers found"
              >
                <Text style={styles.emptyText}>No customers found</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const POSUnifiedCustomerSelectorMemo = memo(POSUnifiedCustomerSelector)
export { POSUnifiedCustomerSelectorMemo as POSUnifiedCustomerSelector }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Focus ring - iOS style tap-to-focus indicator
  focusRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'transparent',
  },

  // Unified List Container - True Edge to Edge with Rounded Top
  listContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  // Unified Header with Search and Done
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 20,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  doneButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },

  // List Content
  listContent: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Customer List Section - Rounded container that clips scrolling content
  customerListSection: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Scan Label
  scanLabelContainer: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },

  // Manual Add Customer Button (on scanner screen)
  manualAddButton: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  manualAddButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  manualAddButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  manualAddText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Scan Message
  scanMessageContainer: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  scanMessage: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 100,
    backgroundColor: 'rgba(255,60,60,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,60,60,0.4)',
  },
  scanMessageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff5555',
    letterSpacing: -0.3,
  },

  // Unified Card - Fixed size, seamless content transitions
  unifiedCard: {
    position: 'absolute',
    top: '36%',
    alignSelf: 'center',
    width: 280,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 20,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 15,
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
    gap: 6,
    minHeight: 200, // Fixed height for consistent card size
  },
  checkmark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  checkmarkOutline: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  loadingSpinner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderRightColor: 'rgba(255,255,255,0.3)',
    borderBottomColor: 'rgba(255,255,255,0.3)',
    borderLeftColor: 'rgba(255,255,255,0.3)',
  },
  checkmarkFill: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
  },
  cardName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    textAlign: 'center',
    minHeight: 24, // Prevent layout shift
  },
  cardSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.2,
    textAlign: 'center',
    minHeight: 20, // Prevent layout shift
  },
  cardStatus: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
    minHeight: 14, // Prevent layout shift
  },

  // Customer List Items - iOS 26 Grouped List Style
  customerItem: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  customerItemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  customerItemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  customerName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
  },
  customerPoints: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(100,200,255,0.95)',
    letterSpacing: -0.2,
  },

  // States
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: -0.2,
  },
})
