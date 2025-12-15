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
  TextInput,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect, useState, useMemo, useCallback } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker'
import type { Customer } from '@/types/pos'
import { useCustomerState, customerActions, type PendingOrder, type CustomerMatch } from '@/stores/customer.store'
import { useActiveModal, useHasModalHistory, useModalSuspended, useModalData, checkoutUIActions } from '@/stores/checkout-ui.store'
import { ordersUIActions } from '@/stores/orders-ui.store'
import { mergeCustomers, customersService, createCustomer, type CustomerWithOrders } from '@/services/customers.service'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'

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
  type OrderDisplay = {
    id: string
    order_number: string
    order_type?: PendingOrder['order_type']
    status?: string | null
    fulfillment_status?: string | null
    total_amount?: number
    created_at: string
    pickup_location?: { id?: string; name?: string } | null
    created_by_user?: { first_name?: string; last_name?: string } | null
    shipping_city?: string | null
    shipping_state?: string | null
    shipping_carrier?: string | null
    tracking_number?: string | null
    shipping_method_title?: string | null
  }

  const insets = useSafeAreaInsets()
  const activeModal = useActiveModal()
  const modalData = useModalData()
  const { scannedData, matches } = useCustomerState()
  const { vendor } = useAppAuth()

  // ✅ Modal stack for navigation
  const hasModalHistory = useHasModalHistory()
  const modalSuspended = useModalSuspended()

  // Check if we're opening directly to view a profile (from customer button)
  const directProfileCustomer = modalData?.viewProfile as Customer | undefined

  // Show when:
  // - We have matches (after ID scan found potential duplicates)
  // - We have scanned data (to create new from ID scan)
  // - Direct profile view (from customer pill click)
  // - Just opened the modal (manual add customer)
  // Hide when suspended (e.g., viewing order detail)
  const hasContentToShow = matches.length > 0 || scannedData !== null || directProfileCustomer || activeModal === 'customerMatch'
  const visible = activeModal === 'customerMatch' && !modalSuspended

  // Lazy content rendering - don't render heavy content until first visible
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  useEffect(() => {
    if (visible && !hasBeenVisible) {
      setHasBeenVisible(true)
    }
  }, [visible, hasBeenVisible])

  // ✅ Direct profile view - when opened from customer button in search bar
  useEffect(() => {
    if (visible && directProfileCustomer && !viewingProfile) {
      // Set the profile directly and load orders
      setViewingProfile(directProfileCustomer)

      // Check cache first
      const cached = profileCache.current.get(directProfileCustomer.id)
      if (cached) {
        setProfileOrders(cached)
        return
      }

      // Load orders
      setLoadingOrders(true)
      InteractionManager.runAfterInteractions(() => {
        customersService.getCustomerWithOrders(directProfileCustomer.id)
          .then(data => {
            profileCache.current.set(directProfileCustomer.id, data)
            setProfileOrders(data)
          })
          .catch(err => {
            logger.error('Failed to load customer orders:', err)
          })
          .finally(() => {
            setLoadingOrders(false)
          })
      })
    }
  }, [visible, directProfileCustomer])

  // Merge mode state
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([])
  const [isMerging, setIsMerging] = useState(false)

  // Profile view state
  const [viewingProfile, setViewingProfile] = useState<Customer | null>(null)
  const [profileOrders, setProfileOrders] = useState<CustomerWithOrders | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const lastTapRef = useRef<number>(0)

  // Edit mode state (like POSProductCard)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedFirstName, setEditedFirstName] = useState('')
  const [editedLastName, setEditedLastName] = useState('')
  const [editedEmail, setEditedEmail] = useState('')
  const [editedPhone, setEditedPhone] = useState('')
  const [editedLoyaltyPoints, setEditedLoyaltyPoints] = useState('')
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const saveProgressAnim = useRef(new Animated.Value(0)).current
  const justActivatedEditMode = useRef(false)

  // Create New Customer mode state
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newFirstName, setNewFirstName] = useState('')
  const [newMiddleName, setNewMiddleName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newDateOfBirth, setNewDateOfBirth] = useState('')
  const [newDobDate, setNewDobDate] = useState<Date>(new Date(2000, 0, 1))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newState, setNewState] = useState('')
  const [newPostalCode, setNewPostalCode] = useState('')
  const datePickerSlideAnim = useRef(new Animated.Value(300)).current
  const datePickerFadeAnim = useRef(new Animated.Value(0)).current

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

  const historyOrders = useMemo<OrderDisplay[]>(() => {
    if (!profileOrders?.recent_orders) return []
    return profileOrders.recent_orders.slice(0, 10).map((order) => ({
      ...order,
    }))
  }, [profileOrders?.recent_orders])

  // Auto-show Create New view when:
  // 1. No matches but scannedData exists (from ID scan - pre-fill form)
  // 2. No matches, no scannedData, no profile view (manual add customer button)
  useEffect(() => {
    if (visible && matches.length === 0 && !directProfileCustomer && !isCreatingNew && !viewingProfile) {
      if (scannedData) {
        // Pre-fill form with scanned data
        setNewFirstName(scannedData.firstName || '')
        setNewMiddleName(scannedData.middleName || '')
        setNewLastName(scannedData.lastName || '')
        const dob = scannedData.dateOfBirth || ''
        setNewDateOfBirth(dob)
        if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
          setNewDobDate(new Date(dob))
        }
        setNewAddress(scannedData.streetAddress || '')
        setNewCity(scannedData.city || '')
        setNewState(scannedData.state || '')
        setNewPostalCode(scannedData.zipCode || '')
      }
      setIsCreatingNew(true)
    }
  }, [visible, scannedData, matches.length, directProfileCustomer, isCreatingNew, viewingProfile])

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
      // Reset create new state
      setIsCreatingNew(false)
      resetCreateNewForm()
    })
  }, [hasModalHistory, height, modalSlideAnim, modalOpacity])

  // Reset create new form
  const resetCreateNewForm = useCallback(() => {
    setNewFirstName('')
    setNewMiddleName('')
    setNewLastName('')
    setNewEmail('')
    setNewPhone('')
    setNewDateOfBirth('')
    setNewDobDate(new Date(2000, 0, 1))
    setShowDatePicker(false)
    setNewAddress('')
    setNewCity('')
    setNewState('')
    setNewPostalCode('')
    setCreateError(null)
    setIsCreating(false)
  }, [])

  const handleSelectMatch = useCallback((match: CustomerMatch) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    customerActions.selectCustomer(match.customer)
    customerActions.clearCustomerMatches()
    customerActions.clearScannedData()
    checkoutUIActions.closeModal()
  }, [])

  const handleCreateNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Pre-fill form with scanned data if available
    if (scannedData) {
      setNewFirstName(scannedData.firstName || '')
      setNewMiddleName(scannedData.middleName || '')
      setNewLastName(scannedData.lastName || '')
      const dob = scannedData.dateOfBirth || ''
      setNewDateOfBirth(dob)
      if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        setNewDobDate(new Date(dob))
      }
      setNewAddress(scannedData.streetAddress || '')
      setNewCity(scannedData.city || '')
      setNewState(scannedData.state || '')
      setNewPostalCode(scannedData.zipCode || '')
    }
    setIsCreatingNew(true)
  }, [scannedData])

  const handleBackFromCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsCreatingNew(false)
    resetCreateNewForm()
  }, [resetCreateNewForm])

  // Date picker animations
  const animateDatePickerIn = useCallback(() => {
    datePickerSlideAnim.setValue(300)
    datePickerFadeAnim.setValue(0)
    setShowDatePicker(true)
    Animated.parallel([
      Animated.spring(datePickerSlideAnim, {
        toValue: 0,
        tension: 300,
        friction: 26,
        useNativeDriver: true,
      }),
      Animated.timing(datePickerFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()
  }, [datePickerSlideAnim, datePickerFadeAnim])

  const animateDatePickerOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(datePickerSlideAnim, {
        toValue: 300,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(datePickerFadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => setShowDatePicker(false))
  }, [datePickerSlideAnim, datePickerFadeAnim])

  const handleDateFieldPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateDatePickerIn()
  }, [animateDatePickerIn])

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setNewDobDate(selectedDate)
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      setNewDateOfBirth(`${year}-${month}-${day}`)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [])

  const handleDateConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    animateDatePickerOut()
  }, [animateDatePickerOut])

  const handleCreateCustomer = useCallback(async () => {
    // Validation
    if (!newFirstName.trim() || !newLastName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setCreateError('First name and last name are required')
      return
    }

    const dobTrimmed = newDateOfBirth.trim()
    if (dobTrimmed && !/^\d{4}-\d{2}-\d{2}$/.test(dobTrimmed)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setCreateError('Date of birth must be in format YYYY-MM-DD')
      return
    }

    setIsCreating(true)
    setCreateError(null)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const serviceCustomer = await createCustomer({
        first_name: newFirstName.trim(),
        middle_name: newMiddleName.trim() || undefined,
        last_name: newLastName.trim(),
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        date_of_birth: dobTrimmed || undefined,
        street_address: newAddress.trim() || undefined,
        city: newCity.trim() || undefined,
        state: newState.trim() || undefined,
        postal_code: newPostalCode.trim() || undefined,
        vendor_id: vendor?.id || '',
      })

      const posCustomer: Customer = {
        id: serviceCustomer.id,
        first_name: serviceCustomer.first_name || '',
        last_name: serviceCustomer.last_name || '',
        email: serviceCustomer.email || '',
        phone: serviceCustomer.phone || null,
        display_name: serviceCustomer.full_name || `${serviceCustomer.first_name} ${serviceCustomer.last_name}`,
        date_of_birth: dobTrimmed || null,
        loyalty_points: serviceCustomer.loyalty_points || 0,
        loyalty_tier: 'bronze',
        vendor_customer_number: serviceCustomer.id.slice(0, 8).toUpperCase(),
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      customerActions.selectCustomer(posCustomer)
      customerActions.clearScannedData()
      handleClose()
    } catch (error) {
      logger.error('Create customer error:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setCreateError(error instanceof Error ? error.message : 'Failed to create customer')
    } finally {
      setIsCreating(false)
    }
  }, [newFirstName, newLastName, newMiddleName, newEmail, newPhone, newDateOfBirth, newAddress, newCity, newState, newPostalCode, vendor?.id, handleClose])

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
          logger.error('Failed to load customer orders:', err)
        })
        .finally(() => {
          setLoadingOrders(false)
        })
    })
  }

  const handleBackFromProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // If opened directly to profile (from customer pill), go to customer selector
    // This lets user change the attached customer
    if (directProfileCustomer && matches.length === 0) {
      // Clean up and go to customer selector
      setViewingProfile(null)
      setProfileOrders(null)
      checkoutUIActions.closeModal()
      checkoutUIActions.openModal('customerSelector')
    } else {
      // Normal back to matches list
      setViewingProfile(null)
      setProfileOrders(null)
    }
  }

  // Double-tap backdrop to close modal
  const backdropLastTapRef = useRef<number>(0)
  const handleBackdropDoubleTap = useCallback(() => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    if (now - backdropLastTapRef.current < DOUBLE_TAP_DELAY) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      handleClose()
    }
    backdropLastTapRef.current = now
  }, [handleClose])

  const handleProfileDoubleTap = () => {
    // Skip if we just activated edit mode from long press
    if (justActivatedEditMode.current) {
      justActivatedEditMode.current = false
      return
    }

    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_DELAY

    if (isDoubleTap) {
      // Reset to prevent triple-tap
      lastTapRef.current = 0

      // Double tap detected
      if (isEditMode) {
        // In edit mode, double-tap saves
        handleSaveEdits()
        return
      }

      if (!viewingProfile) return

      if (directProfileCustomer) {
        // Already selected - just close modal
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        handleClose()
      } else {
        // Select customer and close
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        customerActions.selectCustomer(viewingProfile)
        handleClose()
      }
    } else {
      // First tap - just record time
      lastTapRef.current = now
    }
  }

  // ========================================
  // EDIT MODE HANDLERS (like POSProductCard)
  // ========================================
  const handleLongPressIn = () => {
    if (!viewingProfile) return

    // Start progress animation (matches POSProductCard timing)
    Animated.timing(saveProgressAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start()

    longPressTimer.current = setTimeout(() => {
      // Clear timer ref so handleLongPressOut won't interfere
      longPressTimer.current = null
      // Set flag so onPress doesn't immediately trigger save
      justActivatedEditMode.current = true
      // Reset tap time so double-tap detection starts fresh
      lastTapRef.current = 0

      if (isEditMode) {
        // In edit mode, hold saves
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        handleSaveEdits()
      } else {
        // Not in edit mode, hold enters edit mode
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        // Initialize edit fields
        setEditedFirstName(viewingProfile.first_name || '')
        setEditedLastName(viewingProfile.last_name || '')
        setEditedEmail(viewingProfile.email || '')
        setEditedPhone(viewingProfile.phone || '')
        setEditedLoyaltyPoints(String(viewingProfile.loyalty_points || 0))
        setIsEditMode(true)
      }
    }, 600)
  }

  const handleLongPressOut = () => {
    // Only cancel if timer hasn't fired yet
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      // Only reset progress if we're canceling (not if action completed)
      saveProgressAnim.setValue(0)
    }
  }

  const handleCancelEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsEditMode(false)
  }

  const handleSaveEdits = async () => {
    if (!viewingProfile || isSaving) return

    setIsSaving(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Build updates object - use null for empty values (Supabase doesn't like undefined)
      const updates: Record<string, string | number | null> = {
        first_name: editedFirstName.trim(),
        last_name: editedLastName.trim(),
        loyalty_points: parseInt(editedLoyaltyPoints) || 0,
      }

      // Only include email/phone if they have values, otherwise set to null to clear
      const trimmedEmail = editedEmail.trim()
      const trimmedPhone = editedPhone.trim()
      if (trimmedEmail) {
        updates.email = trimmedEmail
      } else if (viewingProfile.email) {
        // Only clear if there was a previous value
        updates.email = null
      }
      if (trimmedPhone) {
        updates.phone = trimmedPhone
      } else if (viewingProfile.phone) {
        // Only clear if there was a previous value
        updates.phone = null
      }

      logger.debug('[POSCustomerMatchModal] Saving edits', {
        customerId: viewingProfile.id,
        updates,
      })

      const updatedCustomer = await customersService.updateCustomer(viewingProfile.id, updates)

      // Update local state
      setViewingProfile(updatedCustomer)

      // Update cache
      if (profileCache.current.has(viewingProfile.id)) {
        const cached = profileCache.current.get(viewingProfile.id)!
        profileCache.current.set(viewingProfile.id, { ...cached, ...updatedCustomer })
      }

      // If this customer is selected in cart, update that too
      if (directProfileCustomer?.id === viewingProfile.id) {
        customerActions.selectCustomer(updatedCustomer)
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setIsEditMode(false)
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Save Failed', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsSaving(false)
      // Reset progress bar animation
      saveProgressAnim.setValue(0)
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

  const handleViewOrder = (orderId: string) => {
    // Suspend customer modal (keeps state for return)
    checkoutUIActions.suspendModal()

    // Open order modal
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    ordersUIActions.selectOrder(orderId)
  }

  const formatOrderMeta = (order: OrderDisplay) => {
    const type = order.order_type || 'walk_in'
    const isShipping = type === 'shipping'
    const isPickup = type === 'pickup'
    const isDelivery = type === 'delivery'

    let orderTypeLabel = 'WALK-IN'
    if (isShipping) orderTypeLabel = 'SHIPPING'
    else if (isPickup) orderTypeLabel = 'PICKUP'
    else if (isDelivery) orderTypeLabel = 'DELIVERY'

    let primaryText = order.pickup_location?.name || 'In-Store'
    let secondaryText = ''

    if (isShipping || isDelivery) {
      if (order.shipping_city && order.shipping_state) {
        primaryText = `${isDelivery ? 'Deliver to' : 'Ship to'} ${order.shipping_city}, ${order.shipping_state}`
      } else {
        primaryText = isDelivery ? 'Delivery Order' : 'Shipping Order'
      }
      secondaryText = order.shipping_carrier && order.tracking_number
        ? `${order.shipping_carrier} · ${order.tracking_number}`
        : order.shipping_method_title || ''
    } else if (isPickup) {
      primaryText = order.pickup_location?.name || 'Store Pickup'
      secondaryText = 'Online Order'
    } else {
      const staffName = order.created_by_user
        ? `by ${order.created_by_user.first_name} ${order.created_by_user.last_name?.charAt(0) || ''}.`
        : ''
      secondaryText = staffName
    }

    const orderDate = new Date(order.created_at)
    const dateStr = orderDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const timeStr = orderDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    const status = order.status || order.fulfillment_status || 'completed'
    const getStatusStyle = () => {
      switch (status) {
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
      if (isShipping) {
        switch (status) {
          case 'ready':
          case 'ready_to_ship': return 'Ready to Ship'
          case 'shipped': return 'Shipped'
          case 'preparing': return 'Packing'
          case 'pending': return 'Pending'
          case 'confirmed': return 'Confirmed'
          default: return status?.replace(/_/g, ' ') || 'Completed'
        }
      }
      switch (status) {
        case 'ready': return isDelivery ? 'Out for Delivery' : 'Ready for Pickup'
        case 'ready_to_ship': return 'Ready'
        case 'shipped': return isDelivery ? 'Delivered' : 'Shipped'
        case 'preparing': return 'Preparing'
        case 'pending': return 'Pending'
        case 'confirmed': return 'Confirmed'
        case 'completed': return 'Completed'
        case 'delivered': return 'Delivered'
        default: return status?.replace(/_/g, ' ') || 'Completed'
      }
    }

    return {
      orderTypeLabel,
      primaryText,
      secondaryText,
      dateStr,
      timeStr,
      statusLabel: getStatusLabel(),
      statusStyle: getStatusStyle(),
    }
  }

  const renderOrderRow = (
    order: OrderDisplay,
    index: number,
    arr: OrderDisplay[]
  ) => {
    const meta = formatOrderMeta(order)
    const totalDisplay = order.total_amount !== undefined && order.total_amount !== null ? order.total_amount.toFixed(2) : '0.00'

    return (
      <TouchableOpacity
        key={order.id}
        style={[
          styles.orderRow,
          index === 0 && styles.orderRowFirst,
          index === arr.length - 1 && styles.orderRowLast,
        ]}
        onPress={() => handleViewOrder(order.id)}
        activeOpacity={0.7}
      >
        <View style={styles.orderRowContent}>
          <View style={styles.orderInfo}>
            <View style={styles.orderPrimaryRow}>
              <View style={styles.orderTypeBadge}>
                <Text style={styles.orderTypeBadgeText}>{meta.orderTypeLabel}</Text>
              </View>
              <Text style={styles.orderLocationName}>{meta.primaryText}</Text>
            </View>
            <Text style={styles.orderStaffName}>
              {meta.secondaryText ? `${meta.secondaryText} · ` : ''}{meta.dateStr} at {meta.timeStr}
            </Text>
          </View>
          <View style={styles.orderRight}>
            <Text style={styles.orderTotal}>
              ${totalDisplay}
            </Text>
            <View style={[styles.orderStatusBadge, meta.statusStyle]}>
              <Text style={styles.orderStatusText}>{meta.statusLabel}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
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
        {/* Double-tap backdrop to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropDoubleTap}>
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

            {/* Pull Handle / Progress Bar area */}
            <View style={styles.modalHeaderRow} {...panResponder.panHandlers}>
              {/* Progress bar replaces pull handle when active */}
              <Animated.View
                style={[
                  styles.pullHandle,
                  isEditMode && styles.pullHandleEditing,
                  viewingProfile && {
                    width: saveProgressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, width - 48], // From pull handle width to full width minus padding
                    }),
                    backgroundColor: saveProgressAnim.interpolate({
                      inputRange: [0, 0.01, 1],
                      outputRange: [
                        isEditMode ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.3)',
                        isEditMode ? 'rgba(16,185,129,0.8)' : 'rgba(59,130,246,0.8)',
                        isEditMode ? 'rgba(16,185,129,0.8)' : 'rgba(59,130,246,0.8)',
                      ],
                    }),
                  },
                ]}
              />
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={styles.modalScrollContent}
              contentContainerStyle={[
                styles.modalScrollContentContainer,
                { paddingBottom: Math.max(insets.bottom + 40, 60) },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* CREATE NEW CUSTOMER VIEW */}
              {isCreatingNew ? (
                <>
                  {/* Breadcrumb Header */}
                  <View style={styles.profileBreadcrumb}>
                    <TouchableOpacity
                      style={styles.breadcrumbBack}
                      onPress={handleBackFromCreate}
                      activeOpacity={0.7}
                      disabled={isCreating}
                    >
                      <Text style={styles.breadcrumbBackText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.doubleTapHint}>
                      {scannedData ? 'From scanned ID' : 'Manual entry'}
                    </Text>
                  </View>

                  {/* Header */}
                  <View style={styles.headerSection}>
                    <Text style={styles.title}>New Customer</Text>
                    <Text style={styles.subtitle}>
                      {scannedData ? 'Review scanned info and add details' : 'Enter customer information'}
                    </Text>
                  </View>

                  {/* Personal Information Section */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
                    <View style={styles.createFormCard}>
                      {/* Name Row */}
                      <View style={styles.createFormRow}>
                        <View style={styles.createFormField}>
                          <Text style={styles.createFormLabel}>FIRST NAME *</Text>
                          <TextInput
                            style={styles.createFormInput}
                            value={newFirstName}
                            onChangeText={setNewFirstName}
                            placeholder="First name"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            autoCapitalize="words"
                            editable={!isCreating}
                          />
                        </View>
                        <View style={styles.createFormField}>
                          <Text style={styles.createFormLabel}>MIDDLE</Text>
                          <TextInput
                            style={styles.createFormInput}
                            value={newMiddleName}
                            onChangeText={setNewMiddleName}
                            placeholder="Middle"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            autoCapitalize="words"
                            editable={!isCreating}
                          />
                        </View>
                      </View>

                      {/* Last Name */}
                      <View style={styles.createFormFieldFull}>
                        <Text style={styles.createFormLabel}>LAST NAME *</Text>
                        <TextInput
                          style={styles.createFormInput}
                          value={newLastName}
                          onChangeText={setNewLastName}
                          placeholder="Last name"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          autoCapitalize="words"
                          editable={!isCreating}
                        />
                      </View>

                      {/* Date of Birth */}
                      <View style={styles.createFormFieldFull}>
                        <Text style={styles.createFormLabel}>
                          DATE OF BIRTH {scannedData?.dateOfBirth && '(FROM ID)'}
                        </Text>
                        <TouchableOpacity
                          onPress={handleDateFieldPress}
                          disabled={isCreating}
                          activeOpacity={0.7}
                          style={[styles.createFormInput, styles.createFormDateInput]}
                        >
                          <Text style={newDateOfBirth ? styles.createFormDateText : styles.createFormDatePlaceholder}>
                            {newDateOfBirth || 'Tap to select date'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Contact & Address Section */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>CONTACT & ADDRESS</Text>
                    <View style={styles.createFormCard}>
                      {/* Phone */}
                      <View style={styles.createFormFieldFull}>
                        <Text style={styles.createFormLabel}>PHONE</Text>
                        <TextInput
                          style={styles.createFormInput}
                          value={newPhone}
                          onChangeText={setNewPhone}
                          placeholder="(704) 555-0100"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="phone-pad"
                          editable={!isCreating}
                        />
                      </View>

                      {/* Email */}
                      <View style={styles.createFormFieldFull}>
                        <Text style={styles.createFormLabel}>EMAIL (OPTIONAL)</Text>
                        <TextInput
                          style={styles.createFormInput}
                          value={newEmail}
                          onChangeText={setNewEmail}
                          placeholder="customer@email.com"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          editable={!isCreating}
                        />
                        <Text style={styles.createFormHelper}>Auto-generated if empty</Text>
                      </View>

                      {/* Address */}
                      <View style={styles.createFormFieldFull}>
                        <Text style={styles.createFormLabel}>
                          ADDRESS {scannedData?.streetAddress && '(FROM ID)'}
                        </Text>
                        <TextInput
                          style={styles.createFormInput}
                          value={newAddress}
                          onChangeText={setNewAddress}
                          placeholder="Street address"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          autoCapitalize="words"
                          editable={!isCreating}
                        />
                      </View>

                      {/* City, State */}
                      <View style={styles.createFormRow}>
                        <View style={[styles.createFormField, { flex: 2 }]}>
                          <Text style={styles.createFormLabel}>
                            CITY {scannedData?.city && '(FROM ID)'}
                          </Text>
                          <TextInput
                            style={styles.createFormInput}
                            value={newCity}
                            onChangeText={setNewCity}
                            placeholder="City"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            autoCapitalize="words"
                            editable={!isCreating}
                          />
                        </View>
                        <View style={styles.createFormField}>
                          <Text style={styles.createFormLabel}>
                            STATE {scannedData?.state && '(FROM ID)'}
                          </Text>
                          <TextInput
                            style={styles.createFormInput}
                            value={newState}
                            onChangeText={(text) => setNewState(text.toUpperCase())}
                            placeholder="ST"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            autoCapitalize="characters"
                            maxLength={2}
                            editable={!isCreating}
                          />
                        </View>
                      </View>

                      {/* Postal Code */}
                      <View style={styles.createFormFieldFull}>
                        <Text style={styles.createFormLabel}>
                          POSTAL CODE {scannedData?.zipCode && '(FROM ID)'}
                        </Text>
                        <TextInput
                          style={styles.createFormInput}
                          value={newPostalCode}
                          onChangeText={setNewPostalCode}
                          placeholder="ZIP code"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          keyboardType="number-pad"
                          editable={!isCreating}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Error Display */}
                  {createError && (
                    <View style={styles.createErrorCard}>
                      <Text style={styles.createErrorTitle}>❌ ERROR</Text>
                      <Text style={styles.createErrorText}>{createError}</Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={[styles.actionBtn, isCreating && styles.actionBtnDisabled]}
                      onPress={handleCreateCustomer}
                      activeOpacity={0.7}
                      disabled={isCreating}
                    >
                      <Text style={styles.actionBtnText}>
                        {isCreating ? 'Creating...' : 'Create Customer'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={handleBackFromCreate}
                      activeOpacity={0.7}
                      disabled={isCreating}
                    >
                      <Text style={styles.actionBtnTextSecondary}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : viewingProfile ? (
                <>
                  {/* Breadcrumb Header */}
                  <View style={styles.profileBreadcrumb}>
                    <TouchableOpacity
                      style={styles.breadcrumbBack}
                      onPress={isEditMode ? handleCancelEdit : handleBackFromProfile}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.breadcrumbBackText}>
                        {isEditMode ? '← Cancel' : '← Back'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.doubleTapHint}>
                      {isEditMode
                        ? 'Hold to save'
                        : (directProfileCustomer ? 'Hold to edit' : 'Hold to edit · Double-tap to select')}
                    </Text>
                  </View>

                  {/* Profile Header - Hold to edit, double tap to select/close/save */}
                  <Pressable
                    onPress={handleProfileDoubleTap}
                    onPressIn={handleLongPressIn}
                    onPressOut={handleLongPressOut}
                    delayLongPress={600}
                  >
                    {/* Profile Header - Same layout, inline editable */}
                    <View style={styles.profileHeader}>
                      <View style={[styles.profileAvatar, isEditMode && styles.profileAvatarEditing]}>
                        <Text style={styles.profileAvatarText}>
                          {(isEditMode ? editedFirstName : viewingProfile.first_name || viewingProfile.display_name || 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.profileInfo}>
                        {isEditMode ? (
                          // EDIT MODE - Inline TextInputs styled like text
                          <>
                            <View style={styles.editNameRow}>
                              <TextInput
                                style={styles.editableNameInput}
                                value={editedFirstName}
                                onChangeText={setEditedFirstName}
                                placeholder="First"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                autoCapitalize="words"
                                selectTextOnFocus
                              />
                              <TextInput
                                style={styles.editableNameInput}
                                value={editedLastName}
                                onChangeText={setEditedLastName}
                                placeholder="Last"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                autoCapitalize="words"
                                selectTextOnFocus
                              />
                            </View>
                            <TextInput
                              style={styles.editableDetailInput}
                              value={editedEmail}
                              onChangeText={setEditedEmail}
                              placeholder="email@example.com"
                              placeholderTextColor="rgba(255,255,255,0.3)"
                              keyboardType="email-address"
                              autoCapitalize="none"
                              selectTextOnFocus
                            />
                            <TextInput
                              style={styles.editableDetailInput}
                              value={editedPhone}
                              onChangeText={setEditedPhone}
                              placeholder="(555) 555-5555"
                              placeholderTextColor="rgba(255,255,255,0.3)"
                              keyboardType="phone-pad"
                              selectTextOnFocus
                            />
                          </>
                        ) : (
                          // VIEW MODE - Display text
                          <>
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
                          </>
                        )}
                      </View>
                    </View>

                    {/* Stats Row - Points editable in edit mode */}
                    <View style={styles.profileStats}>
                      <View style={styles.profileStatItem}>
                        <Text style={styles.profileStatValue}>
                          ${(profileOrders?.total_spent || 0).toFixed(2)}
                        </Text>
                        <Text style={styles.profileStatLabel}>Total Spent</Text>
                      </View>
                      <View style={styles.profileStatDivider} />
                      <View style={styles.profileStatItem}>
                        <Text style={styles.profileStatValue}>
                          {profileOrders?.total_orders || 0}
                        </Text>
                        <Text style={styles.profileStatLabel}>Orders</Text>
                      </View>
                      <View style={styles.profileStatDivider} />
                      <View style={styles.profileStatItem}>
                        {isEditMode ? (
                          <TextInput
                            style={[styles.profileStatValue, styles.profileStatValuePoints, styles.editablePointsInput]}
                            value={editedLoyaltyPoints}
                            onChangeText={setEditedLoyaltyPoints}
                            keyboardType="number-pad"
                            selectTextOnFocus
                          />
                        ) : (
                          <Text style={[styles.profileStatValue, styles.profileStatValuePoints]}>
                            {(viewingProfile.loyalty_points || 0).toLocaleString()}
                          </Text>
                        )}
                        <Text style={styles.profileStatLabel}>Points</Text>
                      </View>
                    </View>

                  </Pressable>

                  {/* Large Save Zone - wraps everything below edit fields in edit mode */}
                  <Pressable
                    style={isEditMode ? styles.saveZoneActive : undefined}
                    onPressIn={isEditMode ? handleLongPressIn : undefined}
                    onPressOut={isEditMode ? handleLongPressOut : undefined}
                    disabled={!isEditMode}
                  >
                    {/* Hold to Save indicator - only visible in edit mode */}
                    {isEditMode && (
                      <View style={styles.holdToSaveZone}>
                        <Text style={styles.holdToSaveText}>
                          {isSaving ? 'Saving...' : 'Hold anywhere below to save'}
                        </Text>
                      </View>
                    )}

                  {/* Customer Details - Always visible */}
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

                  {/* Order History - Always visible */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>ORDER HISTORY</Text>
                    <View style={styles.ordersListContainer}>
                      {loadingOrders ? (
                        <View style={styles.profileLoadingRow}>
                          <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" />
                          <Text style={styles.profileLoadingText}>Loading orders...</Text>
                        </View>
                      ) : historyOrders.length > 0 ? (
                        historyOrders.map((order, index) =>
                          renderOrderRow(order, index, historyOrders)
                        )
                      ) : (
                        <View style={[styles.profileDetailRow, styles.profileDetailRowLast]}>
                          <Text style={styles.profileDetailValue}>No orders yet</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  </Pressable>
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
                              {(match.customer.loyalty_points ?? 0) > 0 && (
                                <Text style={styles.matchPoints}>
                                  {(match.customer.loyalty_points ?? 0).toLocaleString()} pts
                                </Text>
                              )}
                              {orderCount > 0 && (
                                <Text style={styles.matchOrders}>
                                  {orderCount} orders
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
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
                      (match.pendingOrders || []).map((order, index, arr) =>
                        renderOrderRow(order, index, arr)
                      )
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

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="none"
          onRequestClose={animateDatePickerOut}
        >
          <Pressable style={styles.datePickerOverlay} onPress={animateDatePickerOut}>
            <Animated.View style={{ opacity: datePickerFadeAnim }}>
              <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            </Animated.View>
          </Pressable>
          <Animated.View
            style={[
              styles.datePickerContainer,
              { transform: [{ translateY: datePickerSlideAnim }] },
            ]}
          >
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.datePickerPullHandle} />
            <Text style={styles.datePickerTitle}>Date of Birth</Text>
            <DateTimePicker
              value={newDobDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
              style={styles.datePicker}
              textColor="#fff"
            />
            <TouchableOpacity
              style={styles.datePickerConfirmBtn}
              onPress={handleDateConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.datePickerConfirmBtnText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
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
  pullHandleEditing: {
    backgroundColor: 'rgba(16,185,129,0.6)',
    width: 50,
  },

  // Scroll Content
  modalScrollContent: {
    // Let content determine size
  },
  modalScrollContentContainer: {
    paddingHorizontal: 24,
  },

  // Header Section - Modern hero style
  headerSection: {
    marginBottom: 28,
    alignItems: 'center',
    paddingTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Section Container
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.2,
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

  // Action Buttons - Modern glass style
  actionsContainer: {
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  actionBtn: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 0.3,
  },
  actionBtnTextSecondary: {
    fontSize: 16,
    fontWeight: '500',
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

  // Edit Mode Styles
  saveZoneActive: {
    // The entire area below edit fields becomes tappable for save
    flex: 1,
  },
  holdToSaveZone: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.35)',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  holdToSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(16,185,129,1)',
    letterSpacing: -0.2,
  },
  profileAvatarEditing: {
    borderWidth: 2,
    borderColor: 'rgba(16,185,129,0.5)',
  },
  editNameRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  editableNameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    padding: 8,
    paddingLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  editableDetailInput: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    padding: 8,
    paddingLeft: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  editablePointsInput: {
    textAlign: 'center',
    padding: 4,
    paddingHorizontal: 8,
    minWidth: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.5)',
  },
  saveButton: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  // Edit mode action buttons
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  editCancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  editCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  editSaveButton: {
    flex: 1.5,
    paddingVertical: 14,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  editSaveButtonDisabled: {
    opacity: 0.6,
  },
  editSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },

  // Create New Customer Styles
  createFormCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
  },
  createFormRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  createFormField: {
    flex: 1,
  },
  createFormFieldFull: {
    marginBottom: 16,
  },
  createFormLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  createFormInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  createFormDateInput: {
    justifyContent: 'center',
  },
  createFormDateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  createFormDatePlaceholder: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
  },
  createFormHelper: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
    marginLeft: 4,
  },
  createErrorCard: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  createErrorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(239,68,68,0.9)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  createErrorText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(239,68,68,0.9)',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },

  // Date Picker Styles
  datePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  datePickerPullHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  datePicker: {
    height: 200,
  },
  datePickerConfirmBtn: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  datePickerConfirmBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#10b981',
  },
})
