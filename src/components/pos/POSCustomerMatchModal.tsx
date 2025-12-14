/**
 * POSCustomerMatchModal - Customer Match + Orders Modal
 *
 * Follows POSOrderCard/POSProductCard pattern:
 * - Full-screen modal with blur overlay
 * - Bottom sheet slides up
 * - Pull handle for drag-to-dismiss
 * - iOS 26 glass effect
 * - Grouped list style for matches
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  ScrollView,
  Pressable,
  PanResponder,
  Alert,
  ActivityIndicator,
  InteractionManager,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect, useState, useMemo, useCallback } from 'react'
import type { Customer } from '@/types/pos'
import { useCustomerState, customerActions, type PendingOrder, type CustomerMatch } from '@/stores/customer.store'
import { useActiveModal, useHasModalHistory, useModalSuspended, checkoutUIActions } from '@/stores/checkout-ui.store'
import { scannedOrderActions } from '@/stores/scanned-order.store'
import { ordersUIActions } from '@/stores/orders-ui.store'
import { mergeCustomers, customersService, type CustomerWithOrders } from '@/services/customers.service'
import { useAppAuth } from '@/contexts/AppAuthContext'

const { width, height } = Dimensions.get('window')

// Apple-standard spring config for 60fps animations
const SPRING_OPEN = {
  tension: 280,
  friction: 22,
  useNativeDriver: true,
}

const SPRING_DRAG = {
  tension: 300,
  friction: 26,
  useNativeDriver: true,
}

function POSCustomerMatchModal() {
  const insets = useSafeAreaInsets()
  const activeModal = useActiveModal()
  const { scannedData, matches } = useCustomerState()
  const { vendor } = useAppAuth()

  // ✅ Modal stack for navigation
  const hasModalHistory = useHasModalHistory()
  const modalSuspended = useModalSuspended()

  // Only show if we have matches OR scanned data - prevent random popups
  // Hide when suspended (e.g., viewing order detail)
  const hasContentToShow = matches.length > 0 || scannedData !== null
  const visible = activeModal === 'customerMatch' && hasContentToShow && !modalSuspended

  // Lazy content rendering - don't render heavy content until first visible
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  useEffect(() => {
    if (visible && !hasBeenVisible) {
      setHasBeenVisible(true)
    }
  }, [visible, hasBeenVisible])

  // Merge mode state
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([])
  const [isMerging, setIsMerging] = useState(false)

  // Profile view state
  const [viewingProfile, setViewingProfile] = useState<Customer | null>(null)
  const [profileOrders, setProfileOrders] = useState<CustomerWithOrders | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const lastTapRef = useRef<number>(0)

  // ✅ Profile cache for instant re-visits (Apple pattern)
  const profileCache = useRef<Map<string, CustomerWithOrders>>(new Map())

  // Animation refs
  const modalSlideAnim = useRef(new Animated.Value(height)).current
  const modalOpacity = useRef(new Animated.Value(0)).current
  const dragOffset = useRef(0)

  const bestMatch = matches[0]
  const hasMatches = matches.length > 0
  const hasMultipleMatches = matches.length > 1

  // Get total pending orders across ALL matches
  const totalPendingOrders = matches.reduce((sum, m) => {
    const orders = m.pendingOrders || []
    return sum + orders.length
  }, 0)

  // PanResponder for drag-to-dismiss - optimized for 60fps
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
        onPanResponderGrant: () => {
          dragOffset.current = 0
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragOffset.current = gestureState.dy
            // Direct setValue for instant feedback
            modalSlideAnim.setValue(gestureState.dy)
            modalOpacity.setValue(Math.max(0, 1 - gestureState.dy / 300))
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const DISMISS_THRESHOLD = 100
          const VELOCITY_THRESHOLD = 0.5

          if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > VELOCITY_THRESHOLD) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            handleClose()
          } else {
            // Snap back with optimized spring
            Animated.parallel([
              Animated.spring(modalSlideAnim, {
                toValue: 0,
                ...SPRING_DRAG,
              }),
              Animated.timing(modalOpacity, {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start()
          }
        },
      }),
    [modalSlideAnim, modalOpacity]
  )

  // Open animation - Apple-standard spring
  useEffect(() => {
    if (visible) {
      // Reset to start position
      modalSlideAnim.setValue(height)
      modalOpacity.setValue(0)

      Animated.parallel([
        Animated.spring(modalSlideAnim, {
          toValue: 0,
          ...SPRING_OPEN,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, height, modalSlideAnim, modalOpacity])

  // ✅ Pre-load customer profiles in background when matches appear (Apple pattern)
  // This makes "View Profile" instant instead of showing a spinner
  useEffect(() => {
    if (visible && matches.length > 0) {
      // Defer pre-loading until after modal animation completes
      InteractionManager.runAfterInteractions(() => {
        matches.forEach(match => {
          if (!profileCache.current.has(match.customer.id)) {
            customersService.getCustomerWithOrders(match.customer.id)
              .then(data => {
                profileCache.current.set(match.customer.id, data)
              })
              .catch(() => {
                // Silent fail for pre-load - will retry on actual view
              })
          }
        })
      })
    }
  }, [visible, matches])

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Fast exit animation
    Animated.parallel([
      Animated.timing(modalSlideAnim, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      customerActions.clearCustomerMatches()
      customerActions.clearScannedData()
      // Use popModal to return to previous modal, or closeModal if no history
      if (hasModalHistory) {
        checkoutUIActions.popModal()
      } else {
        checkoutUIActions.closeModal()
      }
      // Reset merge state
      setMergeMode(false)
      setSelectedForMerge([])
      // Reset profile state
      setViewingProfile(null)
      setProfileOrders(null)
    })
  }, [hasModalHistory, height, modalSlideAnim, modalOpacity])

  const handleSelectMatch = useCallback((match: CustomerMatch) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    customerActions.selectCustomer(match.customer)
    customerActions.clearCustomerMatches()
    customerActions.clearScannedData()
    checkoutUIActions.closeModal()
  }, [])

  const handleCreateNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    customerActions.clearCustomerMatches()
    // Push to keep history, so closing addCustomer returns here
    checkoutUIActions.pushModal('addCustomer')
  }, [])

  const handleSearchManually = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    customerActions.clearCustomerMatches()
    customerActions.clearScannedData()
    // Push to keep history
    checkoutUIActions.pushModal('customerSelector')
  }, [])

  const handleViewFullProfile = (customer: Customer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setViewingProfile(customer)

    // ✅ Check cache first for instant display
    const cached = profileCache.current.get(customer.id)
    if (cached) {
      setProfileOrders(cached)
      return
    }

    // ✅ Defer data loading until after animation completes (Apple pattern)
    setLoadingOrders(true)
    InteractionManager.runAfterInteractions(() => {
      customersService.getCustomerWithOrders(customer.id)
        .then(data => {
          profileCache.current.set(customer.id, data)
          setProfileOrders(data)
        })
        .catch(err => {
          console.error('Failed to load customer orders:', err)
        })
        .finally(() => {
          setLoadingOrders(false)
        })
    })
  }

  const handleBackFromProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setViewingProfile(null)
    setProfileOrders(null)
  }

  const handleProfileDoubleTap = () => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected - select customer
      if (!viewingProfile) return
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      customerActions.selectCustomer(viewingProfile)
      handleClose()
    } else {
      // First tap - just record time
      lastTapRef.current = now
    }
  }

  // Merge functionality
  const handleToggleMergeMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setMergeMode(!mergeMode)
    setSelectedForMerge([])
  }

  const handleToggleMergeSelection = (customerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedForMerge(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId)
      }
      // Only allow selecting 2 customers for merge
      if (prev.length >= 2) {
        return [prev[1], customerId]
      }
      return [...prev, customerId]
    })
  }

  const handleMergeCustomers = async () => {
    if (selectedForMerge.length !== 2 || !vendor?.id) return

    // Find the selected customers
    const [targetId, sourceId] = selectedForMerge
    const targetMatch = matches.find(m => m.customer.id === targetId)
    const sourceMatch = matches.find(m => m.customer.id === sourceId)

    if (!targetMatch || !sourceMatch) return

    const targetName = targetMatch.customer.display_name ||
      `${targetMatch.customer.first_name} ${targetMatch.customer.last_name}`.trim()
    const sourceName = sourceMatch.customer.display_name ||
      `${sourceMatch.customer.first_name} ${sourceMatch.customer.last_name}`.trim()

    // Calculate merged values for preview
    const target = targetMatch.customer
    const source = sourceMatch.customer
    const mergedPoints = (target.loyalty_points || 0) + (source.loyalty_points || 0)
    const mergedEmail = target.email || source.email
    const mergedPhone = target.phone || source.phone

    // Count orders being transferred
    const targetOrders = targetMatch.pendingOrders?.length || 0
    const sourceOrders = sourceMatch.pendingOrders?.length || 0
    const totalOrders = targetOrders + sourceOrders

    // Build merge summary
    const summaryLines = [
      `Loyalty Points: ${mergedPoints.toLocaleString()}`,
      mergedEmail ? `Email: ${mergedEmail}` : null,
      mergedPhone ? `Phone: ${mergedPhone}` : null,
      totalOrders > 0 ? `Pending Orders: ${totalOrders}` : null,
    ].filter(Boolean).join('\n')

    Alert.alert(
      'Merge Customers',
      `Merge "${sourceName}" into "${targetName}"?\n\n` +
      `${summaryLines}\n\n` +
      `This will:\n` +
      `• Combine loyalty points\n` +
      `• Transfer all order history\n` +
      `• Merge contact details\n` +
      `• Delete the duplicate profile`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          style: 'destructive',
          onPress: async () => {
            setIsMerging(true)
            try {
              const mergedCustomer = await mergeCustomers(targetId, sourceId, vendor.id)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              // Cast to pos Customer type (service returns compatible data from DB)
              customerActions.selectCustomer(mergedCustomer as unknown as Customer)
              handleClose()
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              Alert.alert('Merge Failed', error instanceof Error ? error.message : 'Unknown error')
            } finally {
              setIsMerging(false)
            }
          },
        },
      ]
    )
  }

  const handleViewOrder = (order: PendingOrder, customer: Customer) => {
    // Suspend customer modal (keeps state for return)
    checkoutUIActions.suspendModal()

    // Open order modal
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    ordersUIActions.selectOrder(order.id)
  }

  // Title based on match count
  const getTitle = () => {
    if (!hasMatches) return 'New Customer'
    if (hasMultipleMatches) return `${matches.length} Matches Found`
    if (totalPendingOrders > 0) return 'Customer & Orders'
    return 'Confirm Customer'
  }

  const getSubtitle = () => {
    if (!hasMatches) return 'No existing profile found'
    if (hasMultipleMatches) return 'Select the correct profile'
    if (totalPendingOrders > 0) {
      return `${totalPendingOrders} pending order${totalPendingOrders > 1 ? 's' : ''}`
    }
    return 'Is this the right person?'
  }

  // Early return if not visible or not yet initialized
  if (!visible || !hasBeenVisible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
        {/* Tap outside to dismiss - reduced blur for performance */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        {/* Modal Sheet */}
        <Animated.View
          style={[
            styles.modalBorder,
            {
              maxHeight: height - insets.top - 20,
              transform: [{ translateY: modalSlideAnim }],
            },
          ]}
        >
          <View style={styles.modalContent}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

            {/* Pull Handle */}
            <View style={styles.modalHeaderRow} {...panResponder.panHandlers}>
              <View style={styles.pullHandle} />
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={styles.modalScrollContent}
              contentContainerStyle={[
                styles.modalScrollContentContainer,
                { paddingBottom: Math.max(insets.bottom + 20, 40) },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* PROFILE VIEW */}
              {viewingProfile ? (
                <>
                  {/* Breadcrumb Header */}
                  <View style={styles.profileBreadcrumb}>
                    <TouchableOpacity
                      style={styles.breadcrumbBack}
                      onPress={handleBackFromProfile}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.breadcrumbBackText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.doubleTapHint}>Double-tap to select</Text>
                  </View>

                  {/* Profile Header - Double tap to select */}
                  <Pressable onPress={handleProfileDoubleTap}>
                    <View style={styles.profileHeader}>
                      <View style={styles.profileAvatar}>
                        <Text style={styles.profileAvatarText}>
                          {(viewingProfile.first_name || viewingProfile.display_name || 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>
                          {viewingProfile.display_name ||
                            `${viewingProfile.first_name || ''} ${viewingProfile.last_name || ''}`.trim() ||
                            'Customer'}
                        </Text>
                        {viewingProfile.email && (
                          <Text style={styles.profileDetail}>{viewingProfile.email}</Text>
                        )}
                        {viewingProfile.phone && (
                          <Text style={styles.profileDetail}>{viewingProfile.phone}</Text>
                        )}
                      </View>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.profileStats}>
                      <View style={styles.profileStatItem}>
                        <Text style={styles.profileStatValue}>
                          ${(viewingProfile.total_spent || 0).toFixed(2)}
                        </Text>
                        <Text style={styles.profileStatLabel}>Total Spent</Text>
                      </View>
                      <View style={styles.profileStatDivider} />
                      <View style={styles.profileStatItem}>
                        <Text style={styles.profileStatValue}>
                          {viewingProfile.total_orders || 0}
                        </Text>
                        <Text style={styles.profileStatLabel}>Orders</Text>
                      </View>
                      <View style={styles.profileStatDivider} />
                      <View style={styles.profileStatItem}>
                        <Text style={[styles.profileStatValue, styles.profileStatValuePoints]}>
                          {(viewingProfile.loyalty_points || 0).toLocaleString()}
                        </Text>
                        <Text style={styles.profileStatLabel}>Points</Text>
                      </View>
                    </View>
                  </Pressable>

                  {/* Customer Details */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>CUSTOMER DETAILS</Text>
                    <View style={styles.profileDetailsCard}>
                      {viewingProfile.date_of_birth && (
                        <View style={styles.profileDetailRow}>
                          <Text style={styles.profileDetailLabel}>Date of Birth</Text>
                          <Text style={styles.profileDetailValue}>
                            {new Date(viewingProfile.date_of_birth).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      )}
                      <View style={styles.profileDetailRow}>
                        <Text style={styles.profileDetailLabel}>Loyalty Tier</Text>
                        <Text style={styles.profileDetailValue}>
                          {viewingProfile.loyalty_tier || 'Bronze'}
                        </Text>
                      </View>
                      <View style={[styles.profileDetailRow, styles.profileDetailRowLast]}>
                        <Text style={styles.profileDetailLabel}>Customer ID</Text>
                        <Text style={styles.profileDetailValue}>
                          {viewingProfile.id.slice(0, 8)}...
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Order History */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>ORDER HISTORY</Text>
                    <View style={styles.profileDetailsCard}>
                      {loadingOrders ? (
                        <View style={styles.profileLoadingRow}>
                          <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" />
                          <Text style={styles.profileLoadingText}>Loading orders...</Text>
                        </View>
                      ) : profileOrders?.recent_orders && profileOrders.recent_orders.length > 0 ? (
                        profileOrders.recent_orders.slice(0, 10).map((order, index) => {
                          const locationName = order.pickup_location?.name || 'Unknown'
                          const staffName = order.created_by_user
                            ? `${order.created_by_user.first_name} ${order.created_by_user.last_name?.charAt(0) || ''}.`
                            : null

                          return (
                            <View
                              key={order.id}
                              style={[
                                styles.profileOrderRow,
                                index === Math.min(profileOrders.recent_orders!.length - 1, 9) &&
                                  styles.profileDetailRowLast,
                              ]}
                            >
                              <View style={styles.profileOrderInfo}>
                                <Text style={styles.profileOrderLocation}>{locationName}</Text>
                                <Text style={styles.profileOrderMeta}>
                                  {staffName ? `by ${staffName} · ` : ''}
                                  {new Date(order.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </Text>
                                <Text style={styles.profileOrderNumberSmall}>#{order.order_number}</Text>
                              </View>
                              <Text style={styles.profileOrderAmount}>
                                ${order.total_amount.toFixed(2)}
                              </Text>
                            </View>
                          )
                        })
                      ) : (
                        <View style={[styles.profileDetailRow, styles.profileDetailRowLast]}>
                          <Text style={styles.profileDetailValue}>No orders yet</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {/* MATCHES VIEW (existing content) */}
                  {/* Header */}
                  <View style={styles.headerSection}>
                    <Text style={styles.title}>{getTitle()}</Text>
                    <Text style={styles.subtitle}>{getSubtitle()}</Text>
                  </View>

              {/* Matches List - iOS 26 Grouped Style */}
              {hasMatches && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {mergeMode ? 'SELECT 2 TO MERGE' : hasMultipleMatches ? 'POTENTIAL MATCHES' : 'MATCHED CUSTOMER'}
                    </Text>
                    {hasMultipleMatches && (
                      <TouchableOpacity onPress={handleToggleMergeMode} style={styles.mergeModeBtn}>
                        <Text style={[styles.mergeModeBtnText, mergeMode && styles.mergeModeBtnTextActive]}>
                          {mergeMode ? 'Cancel' : 'Merge'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.matchesListContainer}>
                    {matches.slice(0, 10).map((match, index) => {
                      const customerName = match.customer.display_name ||
                        `${match.customer.first_name} ${match.customer.last_name}`.trim()
                      const orderCount = match.pendingOrders?.length || 0
                      const isSelectedForMerge = selectedForMerge.includes(match.customer.id)
                      const mergeOrder = selectedForMerge.indexOf(match.customer.id) + 1

                      return (
                        <View
                          key={match.customer.id}
                          style={[
                            styles.matchRow,
                            index === 0 && styles.matchRowFirst,
                            index === matches.length - 1 && styles.matchRowLast,
                            isSelectedForMerge && styles.matchRowSelected,
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.matchRowContent}
                            onPress={() => mergeMode
                              ? handleToggleMergeSelection(match.customer.id)
                              : handleSelectMatch(match)
                            }
                            activeOpacity={0.7}
                          >
                            {/* Merge checkbox/number */}
                            {mergeMode && (
                              <View style={[styles.mergeCheckbox, isSelectedForMerge && styles.mergeCheckboxSelected]}>
                                <Text style={styles.mergeCheckboxText}>
                                  {isSelectedForMerge ? (mergeOrder === 1 ? 'KEEP' : '→') : ''}
                                </Text>
                              </View>
                            )}

                            {/* Left: Customer Info */}
                            <View style={styles.matchInfo}>
                              <Text style={styles.matchName} numberOfLines={1}>
                                {customerName}
                              </Text>
                              <View style={styles.matchDetails}>
                                {match.customer.email && (
                                  <Text style={styles.matchDetail} numberOfLines={1}>
                                    {match.customer.email}
                                  </Text>
                                )}
                                {match.customer.phone && (
                                  <Text style={styles.matchDetail}>
                                    {match.customer.phone}
                                  </Text>
                                )}
                              </View>
                              <Text style={styles.matchReason}>{match.reason}</Text>
                            </View>

                            {/* Right: Score + Points */}
                            <View style={styles.matchRight}>
                              <View style={[
                                styles.confidenceBadge,
                                match.confidence === 'exact' && styles.confidenceBadgeExact,
                              ]}>
                                <Text style={styles.confidenceText}>
                                  {match.confidenceScore}%
                                </Text>
                              </View>
                              {match.customer.loyalty_points > 0 && (
                                <Text style={styles.matchPoints}>
                                  {match.customer.loyalty_points.toLocaleString()} pts
                                </Text>
                              )}
                              {orderCount > 0 && (
                                <Text style={styles.matchOrders}>
                                  {orderCount} orders
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          {/* View Profile Button - Separate touchable */}
                          {!mergeMode && (
                            <Pressable
                              style={styles.viewProfileBtn}
                              onPress={() => handleViewFullProfile(match.customer)}
                            >
                              <Text style={styles.viewProfileBtnText}>View Full Profile →</Text>
                            </Pressable>
                          )}
                        </View>
                      )
                    })}
                  </View>

                  {/* Merge Button */}
                  {mergeMode && selectedForMerge.length === 2 && (
                    <TouchableOpacity
                      style={styles.mergeBtn}
                      onPress={handleMergeCustomers}
                      disabled={isMerging}
                      activeOpacity={0.7}
                    >
                      {isMerging ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.mergeBtnText}>Merge These Customers</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Pending Orders Section */}
              {totalPendingOrders > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>PENDING ORDERS</Text>
                  <View style={styles.ordersListContainer}>
                    {matches.flatMap((match) =>
                      (match.pendingOrders || []).map((order, index, arr) => {
                        const isShipping = order.order_type === 'shipping'
                        const isPickup = order.order_type === 'pickup'

                        // Format date/time
                        const orderDate = new Date(order.created_at)
                        const dateStr = orderDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                        const timeStr = orderDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })

                        // For shipping: show destination city/state
                        // For pickup: show pickup location
                        // For walk-in: show location where order was created
                        let primaryText = ''
                        let secondaryText = ''
                        let orderTypeLabel = ''

                        if (isShipping) {
                          // Shipping order - show destination
                          primaryText = order.shipping_city && order.shipping_state
                            ? `Ship to ${order.shipping_city}, ${order.shipping_state}`
                            : 'Shipping Order'
                          secondaryText = order.shipping_carrier && order.tracking_number
                            ? `${order.shipping_carrier} · ${order.tracking_number}`
                            : order.shipping_method_title || ''
                          orderTypeLabel = 'SHIPPING'
                        } else if (isPickup) {
                          // Pickup order - show pickup location (NOT shipping address)
                          primaryText = order.pickup_location?.name || 'Store Pickup'
                          secondaryText = 'Online Order'
                          orderTypeLabel = 'PICKUP'
                        } else {
                          // Walk-in POS order
                          primaryText = order.pickup_location?.name || 'In-Store'
                          const staffName = order.created_by_user
                            ? `by ${order.created_by_user.first_name} ${order.created_by_user.last_name?.charAt(0) || ''}.`
                            : ''
                          secondaryText = staffName
                          orderTypeLabel = 'WALK-IN'
                        }

                        // Status display with colors
                        const getStatusStyle = () => {
                          switch (order.status) {
                            case 'ready':
                            case 'ready_to_ship':
                              return styles.orderStatusReady
                            case 'shipped':
                              return styles.orderStatusShipped
                            case 'preparing':
                              return styles.orderStatusPreparing
                            default:
                              return null
                          }
                        }

                        const getStatusLabel = () => {
                          // For shipping orders, 'ready' means ready to ship
                          if (isShipping) {
                            switch (order.status) {
                              case 'ready':
                              case 'ready_to_ship': return 'Ready to Ship'
                              case 'shipped': return 'Shipped'
                              case 'preparing': return 'Packing'
                              case 'pending': return 'Pending'
                              case 'confirmed': return 'Confirmed'
                              default: return order.status.replace(/_/g, ' ')
                            }
                          }
                          // For pickup/walk-in orders
                          switch (order.status) {
                            case 'ready': return 'Ready for Pickup'
                            case 'ready_to_ship': return 'Ready'
                            case 'shipped': return 'Shipped'
                            case 'preparing': return 'Preparing'
                            case 'pending': return 'Pending'
                            case 'confirmed': return 'Confirmed'
                            default: return order.status.replace(/_/g, ' ')
                          }
                        }

                        return (
                          <TouchableOpacity
                            key={order.id}
                            style={[
                              styles.orderRow,
                              index === 0 && styles.orderRowFirst,
                              index === arr.length - 1 && styles.orderRowLast,
                            ]}
                            onPress={() => handleViewOrder(order, match.customer)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.orderRowContent}>
                              <View style={styles.orderInfo}>
                                <View style={styles.orderPrimaryRow}>
                                  <View style={styles.orderTypeBadge}>
                                    <Text style={styles.orderTypeBadgeText}>{orderTypeLabel}</Text>
                                  </View>
                                  <Text style={styles.orderLocationName}>{primaryText}</Text>
                                </View>
                                <Text style={styles.orderStaffName}>
                                  {secondaryText ? `${secondaryText} · ` : ''}{dateStr} at {timeStr}
                                </Text>
                                <Text style={styles.orderNumberSecondary}>#{order.order_number}</Text>
                              </View>
                              <View style={styles.orderRight}>
                                <Text style={styles.orderTotal}>
                                  ${order.total_amount?.toFixed(2)}
                                </Text>
                                <View style={[styles.orderStatusBadge, getStatusStyle()]}>
                                  <Text style={styles.orderStatusText}>{getStatusLabel()}</Text>
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                        )
                      })
                    )}
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleCreateNew}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionBtnText}>+ Create New Customer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={handleSearchManually}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionBtnTextSecondary}>Search Manually</Text>
                </TouchableOpacity>
              </View>
                </>
              )}
            </ScrollView>

          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const POSCustomerMatchModalMemo = memo(POSCustomerMatchModal)
export { POSCustomerMatchModalMemo as POSCustomerMatchModal }

const styles = StyleSheet.create({
  // Modal Overlay - Full screen with blur
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  // Modal Border - Outer rounded container
  modalBorder: {
    marginLeft: 0,
    marginRight: 0,
    marginBottom: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },

  // Modal Content - Inner glass container
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },

  // Pull Handle Row
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 44,
  },
  pullHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },

  // Scroll Content
  modalScrollContent: {
    // Let content determine size
  },
  modalScrollContentContainer: {
    paddingHorizontal: 24,
  },

  // Header Section
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.2,
  },

  // Section Container
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 4,
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
  },
  mergeModeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  mergeModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(100,200,255,0.9)',
  },
  mergeModeBtnTextActive: {
    color: 'rgba(255,100,100,0.9)',
  },

  // Matches List - iOS 26 Grouped Style
  matchesListContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  matchRow: {
    minHeight: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  matchRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  matchRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  matchRowSelected: {
    backgroundColor: 'rgba(100,200,255,0.15)',
  },
  mergeCheckbox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeCheckboxSelected: {
    backgroundColor: 'rgba(16,185,129,0.3)',
  },
  mergeCheckboxText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  mergeBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(16,185,129,0.3)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  mergeBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  matchRowContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchInfo: {
    flex: 1,
    marginRight: 12,
  },
  matchName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  matchDetails: {
    marginBottom: 4,
  },
  matchDetail: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.1,
  },
  matchReason: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: -0.1,
  },
  matchRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  confidenceBadgeExact: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  matchPoints: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(100,200,255,0.9)',
  },
  matchOrders: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  viewProfileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.33,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(100,200,255,0.08)',
  },
  viewProfileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(100,200,255,0.9)',
    textAlign: 'center',
  },

  // Orders List - iOS 26 Grouped Style
  ordersListContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  orderRow: {
    minHeight: 72,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  orderRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  orderRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  orderRowContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderInfo: {
    flex: 1,
  },
  orderPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  orderTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  orderTypeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  orderLocationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
    flex: 1,
  },
  orderStaffName: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  orderNumberSecondary: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  orderNumber: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  orderCustomer: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  orderType: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderTotal: {
    fontSize: 17,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  orderStatusReady: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  orderStatusShipped: {
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  orderStatusPreparing: {
    backgroundColor: 'rgba(251,191,36,0.2)',
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },

  // Action Buttons
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  actionBtnTextSecondary: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },

  // Profile View Styles
  profileBreadcrumb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  breadcrumbBack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbBackText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(100,200,255,0.9)',
  },
  doubleTapHint: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
  },
  profileHeaderSelectBtn: {
    backgroundColor: 'rgba(16,185,129,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileHeaderSelectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(100,200,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: 'rgba(100,200,255,0.9)',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileDetail: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  profileStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  profileStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  profileStatValuePoints: {
    color: 'rgba(100,200,255,0.9)',
  },
  profileStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  profileStatDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
  },
  profileDetailsCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  profileDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  profileDetailRowLast: {
    borderBottomWidth: 0,
  },
  profileDetailLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
  },
  profileDetailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  profileLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  profileLoadingText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  profileOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  profileOrderInfo: {
    flex: 1,
  },
  profileOrderLocation: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  profileOrderMeta: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  profileOrderNumberSmall: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
  },
  profileOrderNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  profileOrderDate: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  profileOrderAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  profileSelectBtn: {
    backgroundColor: 'rgba(16,185,129,0.3)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  profileSelectBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
})
