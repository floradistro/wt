/**
 * POSUnifiedCustomerSelector Component (REFACTORED)
 * Jobs Principle: Orchestrate customer selection via ID scan or search
 *
 * REFACTORED: Extracted camera, search, and animation logic to improve maintainability
 * Now handles:
 * - UI orchestration
 * - User interaction coordination
 *
 * Extracted to:
 * - useCameraScanner hook (camera + ID scanning logic)
 * - useCustomerSearch hook (search logic)
 * - useCustomerSelectorAnimations hook (animation state)
 */

import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { Camera, useCameraDevice } from 'react-native-vision-camera'
import { calculateAge, type AAMVAData } from '@/lib/id-scanner/aamva-parser'
import type { Customer } from '@/types/pos'

// Hooks (REFACTORED)
import { useCameraScanner } from '@/hooks/pos/useCameraScanner'
import { useCustomerSearch } from '@/hooks/pos/useCustomerSearch'
import { useCustomerSelectorAnimations } from '@/hooks/pos/useCustomerSelectorAnimations'
import { useRecentCustomers, type RecentCustomer } from '@/hooks/pos/useRecentCustomers'
import { formatRelativeTime } from '@/utils/time'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useActiveModal, useHasModalHistory, checkoutUIActions } from '@/stores/checkout-ui.store'
import { customerActions } from '@/stores/customer.store'
import { logger } from '@/utils/logger'

/**
 * POSUnifiedCustomerSelector - TRUE ZERO PROPS ✅✅✅
 * NO PROPS - Reads state and calls actions from store
 *
 * Reads from stores:
 * - visible: checkout-ui.store (activeModal === 'customerSelector')
 * - vendorId: AppAuthContext (vendor.id)
 *
 * Calls store actions:
 * - onCustomerSelected → checkoutUIActions.handleCustomerSelected
 * - onNoMatchFoundWithData → checkoutUIActions.handleNoMatchFoundWithData
 * - onAddCustomer → checkoutUIActions.handleAddCustomer
 * - onClose → checkoutUIActions.closeModal / popModal
 */
function POSUnifiedCustomerSelector() {
  // ========================================
  // STORES - TRUE ZERO PROPS (read from environment)
  // ========================================
  const activeModal = useActiveModal()
  const visible = activeModal === 'customerSelector'
  const hasModalHistory = useHasModalHistory()
  const insets = useSafeAreaInsets()
  const device = useCameraDevice('back')
  const cameraRef = useRef<Camera>(null)
  const searchInputRef = useRef<TextInput>(null)

  // ========================================
  // STORES - Apple Engineering Standard (READ FROM ENVIRONMENT)
  // ========================================
  const { vendor } = useAppAuth()
  const vendorId = vendor?.id || ''

  // ========================================
  // HOOKS - Camera Scanner (REFACTORED)
  // ========================================
  const {
    hasPermission,
    isScanning,
    isProcessing,
    cameraActive,
    scanMessage,
    parsedData,
    cameraKey,
    focusPoint,
    codeScanner,
    resetAll,
    handleCameraPress,
  } = useCameraScanner() // ✅ ZERO PROPS - calls customer.store action directly

  // ========================================
  // HOOKS - Customer Search (ZERO PROPS ✅)
  // ========================================
  const {
    searchQuery,
    customers,
    searching,
    setSearchQuery,
    clearSearch,
  } = useCustomerSearch() // ✅ ZERO PROPS - reads vendorId from customer.store

  // ========================================
  // HOOKS - Recent Customers (ZERO PROPS ✅)
  // ========================================
  const {
    recentCustomers,
    addRecentCustomer,
    clearRecentCustomers,
  } = useRecentCustomers() // ✅ ZERO PROPS - reads vendorId from customer.store

  // Smart mode: typing mode vs scanning mode
  const isTypingMode = searchQuery.length > 0

  // ========================================
  // FOCUS STATE - Immediate full screen on input tap
  // ========================================
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  // ========================================
  // HOOKS - Animations (REFACTORED)
  // ========================================
  const {
    sheetTranslateY,
    previewOpacity,
    checkmarkScale,
    loadingRotation,
    focusRingScale,
    focusRingOpacity,
    animateFocusRing,
  } = useCustomerSelectorAnimations(
    isTypingMode || isSearchFocused, // Full screen if typing OR focused
    customers.length,
    parsedData,
    null
  )


  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    if (visible) {
      // FULL RESET - everything back to initial state
      resetAll()
      clearSearch()
      setIsSearchFocused(false)
    } else {
      // Clean shutdown
      resetAll()
      setIsSearchFocused(false)
    }
  }, [visible])

  // Process scanned ID data automatically
  useEffect(() => {
    if (!parsedData || !visible) return

    logger.info('[POSUnifiedCustomerSelector] Processing scanned ID data:', {
      name: `${parsedData.firstName} ${parsedData.lastName}`,
      dob: parsedData.dateOfBirth,
    })

    // Find ALL matching customers to prevent duplicates
    const processScannedData = async () => {
      try {
        // Use findAllMatchingCustomers to get ALL potential matches
        // This prevents duplicate creation by showing staff all matches
        const matches = await customerActions.findAllMatchingCustomers(parsedData)

        if (matches.length > 0) {
          logger.info('[POSUnifiedCustomerSelector] Found matching customers:', {
            count: matches.length,
            customers: matches.map(m => ({
              id: m.customer.id,
              name: `${m.customer.first_name} ${m.customer.last_name}`,
              confidence: m.confidence,
              score: m.confidenceScore,
            })),
          })

          // Fetch pending orders for all matched customers
          const matchesWithOrders = await Promise.all(
            matches.map(async (match) => {
              const pendingOrders = await customerActions.fetchPendingOrders(match.customer.id)
              return { ...match, pendingOrders }
            })
          )

          // ALWAYS show match modal when there are matches
          // This prevents accidental duplicate creation and lets staff choose
          // Even for single exact match - staff should confirm
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          customerActions.setCustomerMatches(matchesWithOrders)
          checkoutUIActions.closeModal()
          checkoutUIActions.openModal('customerMatch')
        } else {
          // No match found - go to add customer with pre-filled data
          logger.info('[POSUnifiedCustomerSelector] No matching customer found, opening add customer modal')
          checkoutUIActions.closeModal()
          checkoutUIActions.openModal('addCustomer')
        }
      } catch (error) {
        logger.error('[POSUnifiedCustomerSelector] Error processing scanned data:', error)
      }
    }

    processScannedData()
  }, [parsedData, visible, addRecentCustomer])

  // ========================================
  // HANDLERS - Memoized to prevent re-renders
  // ========================================
  const handleCameraTap = useCallback((event: any) => {
    handleCameraPress(event, cameraRef)
    animateFocusRing()
  }, [handleCameraPress, animateFocusRing])

  const handleSearchFocus = useCallback(() => {
    // IMMEDIATELY go full screen when input is tapped
    setIsSearchFocused(true)
  }, [])

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false)
  }, [])

  // Handle customer selection (with recent tracking)
  const handleCustomerSelect = useCallback((customer: Customer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    addRecentCustomer(customer)
    // TRUE ZERO PROPS: Call store actions
    customerActions.selectCustomer(customer)
    checkoutUIActions.closeModal()
  }, [addRecentCustomer])

  // Memoize customer item rendering
  const renderCustomerItem = useCallback(({ item, index, total, isRecent }: { item: Customer | RecentCustomer; index: number; total: number; isRecent?: boolean }) => {
    const customerName =
      item.display_name || `${item.first_name} ${item.last_name}`.trim() || item.email

    const timestamp = isRecent && 'viewedAt' in item ? formatRelativeTime(item.viewedAt) : null

    const accessibilityLabel =
      item.loyalty_points > 0
        ? `${customerName}, ${item.loyalty_points.toLocaleString()} loyalty points`
        : customerName

    return (
      <TouchableOpacity
        onPress={() => handleCustomerSelect(item)}
        style={[
          styles.customerItem,
          index === 0 && styles.customerItemFirst,
          index === total - 1 && styles.customerItemLast,
        ]}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Double tap to select this customer"
      >
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{customerName}</Text>
          {timestamp && (
            <Text style={styles.customerTimestamp}>{timestamp}</Text>
          )}
        </View>
        {item.loyalty_points > 0 && (
          <Text
            style={styles.customerPoints}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          >
            {item.loyalty_points.toLocaleString()} pts
          </Text>
        )}
      </TouchableOpacity>
    )
  }, [handleCustomerSelect])

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={() => checkoutUIActions.closeModal()}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Full-screen Camera */}
        {device && hasPermission && cameraActive && (
          <TouchableWithoutFeedback onPress={handleCameraTap}>
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
                    },
                  ]}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        )}

        {/* Manual Add Customer Button */}
        {!isTypingMode && isScanning && !isProcessing && !scanMessage && !parsedData && (
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
                  // TRUE ZERO PROPS: Open add customer modal
                  checkoutUIActions.closeModal()
                  checkoutUIActions.openModal('addCustomer')
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

        {/* Unified Customer Card - Showing scan results */}
        {parsedData && (
          <Animated.View
            style={[styles.unifiedCard, { opacity: previewOpacity }]}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={`Searching for customer: ${parsedData.firstName} ${parsedData.lastName}${parsedData.dateOfBirth ? `, age ${calculateAge(parsedData.dateOfBirth)}` : ''}`}
            accessibilityLiveRegion="polite"
          >
            <BlurView intensity={80} tint="systemThickMaterialDark" style={StyleSheet.absoluteFill} accessible={false} />
            <View style={styles.cardContent} accessible={false}>
              {/* Circle with loading spinner */}
              <View style={styles.checkmark}>
                <View style={styles.checkmarkOutline} />
                <Animated.View
                  style={[
                    styles.loadingSpinner,
                    {
                      transform: [{
                        rotate: loadingRotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      }],
                    },
                  ]}
                />
              </View>

              {/* Name */}
              <Text style={styles.cardName}>
                {`${parsedData.firstName} ${parsedData.lastName}`}
              </Text>

              {/* Subtitle */}
              <Text style={styles.cardSubtitle}>
                {parsedData.dateOfBirth ? `Age ${calculateAge(parsedData.dateOfBirth)}` : ' '}
              </Text>

              {/* Status */}
              <Text style={styles.cardStatus}>Searching...</Text>
            </View>
          </Animated.View>
        )}

        {/* Customer List Sheet - Slides up smoothly with native driver (60fps) */}
        <Animated.View
          style={[
            styles.listContainer,
            {
              // Transform uses native driver for buttery smooth 60fps
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <BlurView
            intensity={95}
            tint="systemThickMaterialDark"
            style={StyleSheet.absoluteFill}
          />

          {/* Header with Search and Done */}
          <View style={[styles.listHeader, { paddingTop: insets.top + 8 }]} accessible={false}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search name, email, or phone"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              autoFocus={false}
              keyboardType="default"
              blurOnSubmit={false}
              enablesReturnKeyAutomatically
              accessible={true}
              accessibilityLabel="Search customers"
              accessibilityHint="Type to search customers by name, email, or phone"
            />
            <TouchableOpacity
              onPress={() => checkoutUIActions.closeModal()}
              style={styles.doneButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Done"
              accessibilityHint="Double tap to close customer selector"
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Customer List */}
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
                  renderItem={({ item, index }) => renderCustomerItem({ item, index, total: customers.length })}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  contentContainerStyle={{
                    paddingBottom: Math.max(insets.bottom, 16),
                  }}
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
            ) : isSearchFocused && recentCustomers.length > 0 ? (
              <View style={styles.customerListSection}>
                <View style={styles.recentHeader}>
                  <Text style={styles.recentLabel}>RECENT</Text>
                  <TouchableOpacity onPress={clearRecentCustomers} style={styles.clearButton}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={recentCustomers}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => renderCustomerItem({ item, index, total: recentCustomers.length, isRecent: true })}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  contentContainerStyle={{
                    paddingBottom: Math.max(insets.bottom, 16),
                  }}
                />
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

// ========================================
// STYLES
// ========================================
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

  // List Container - Always full screen, positioned with translateY
  listContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  // List Header
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

  // Customer List Section
  customerListSection: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Recent Header
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,60,60,0.95)',
    letterSpacing: -0.2,
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

  // Manual Add Customer Button
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

  // Unified Card - Scan result preview
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
    minHeight: 200,
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
  cardName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    textAlign: 'center',
    minHeight: 24,
  },
  cardSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.2,
    textAlign: 'center',
    minHeight: 20,
  },
  cardStatus: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
    minHeight: 14,
  },

  // Customer List Items
  customerItem: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  customerInfo: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
  },
  customerTimestamp: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: -0.2,
  },
  customerPoints: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(100,200,255,0.95)',
    letterSpacing: -0.2,
    marginLeft: 12,
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
