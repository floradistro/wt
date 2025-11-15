import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, FlatList, Pressable, Animated, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Customer } from '@/types/pos'

interface POSCustomerSelectorProps {
  visible: boolean
  vendorId: string
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
  onClose: () => void
}

export function POSCustomerSelector({
  visible,
  vendorId,
  selectedCustomer,
  onSelectCustomer,
  onClose,
}: POSCustomerSelectorProps) {
  const insets = useSafeAreaInsets()
  const [searchQuery, setSearchQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const modalSlideAnim = useRef(new Animated.Value(600)).current
  const modalOpacity = useRef(new Animated.Value(0)).current
  const searchInputRef = useRef<TextInput>(null)

  // Jobs Principle: Load customers on modal open
  useEffect(() => {
    if (visible) {
      loadCustomers()
    }
  }, [visible])

  // Jobs Principle: Debounced search (300ms) for performance
  useEffect(() => {
    if (!visible) return

    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        loadCustomers(searchQuery.trim())
      } else if (searchQuery.trim().length === 0) {
        loadCustomers() // Load all customers
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Jobs Principle: Keyboard handling - adjust modal position
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height)
      }
    )

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0)
      }
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [])

  // Open animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(modalSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()

      // Jobs Principle: Auto-focus search on open
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 300)
    } else {
      modalSlideAnim.setValue(600)
      modalOpacity.setValue(0)
      setKeyboardHeight(0)
    }
  }, [visible])

  const loadCustomers = async (search: string = '') => {
    try {
      setLoading(true)

      // Get auth session for API call
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        console.error('❌ No auth session found')
        setCustomers([])
        setLoading(false)
        return
      }

      // Jobs Principle: Use API endpoint (same as old web app)
      const apiUrl = process.env.EXPO_PUBLIC_API_URL
      const url = new URL(`${apiUrl}/api/pos/customers`)
      url.searchParams.set('vendorId', vendorId)
      if (search) {
        url.searchParams.set('search', search)
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Customer API error:', errorText)
        throw new Error(`Failed to load customers: ${response.status}`)
      }

      const { customers: apiCustomers } = await response.json()

      // Jobs Principle: API already does smart search and sorting
      // Just display all results - FlatList virtualizes for performance
      setCustomers(apiCustomers || [])
    } catch (error) {
      console.error('💥 Error loading customers:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCustomer = (customer: Customer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSelectCustomer(customer)
    handleClose()
  }

  const handleClearCustomer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelectCustomer(null)
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    Animated.parallel([
      Animated.spring(modalSlideAnim, {
        toValue: 600,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSearchQuery('')
      setCustomers([])
      onClose()
    })
  }

  const getDisplayName = (customer: Customer) => {
    return customer.display_name || `${customer.first_name} ${customer.last_name}`.trim() || customer.email
  }

  // Jobs Principle: No floating banner - customer info only in cart
  if (!visible) {
    return null
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
        {/* Jobs Principle: Tap outside to dismiss */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        {/* Modal Sheet - Outer border container */}
        <Animated.View
          style={[
            styles.modalBorder,
            {
              marginLeft: insets.left,
              marginRight: insets.right,
              marginBottom: keyboardHeight,
              transform: [{ translateY: modalSlideAnim }],
            },
          ]}
        >
          {/* Inner content container with clipped corners */}
          <View style={styles.modalContent}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

            {/* Pull Handle */}
            <View style={styles.pullHandle} />

          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            {!loading && customers.length > 0 && (
              <Text style={styles.resultsCount}>
                {customers.length.toLocaleString()} {searchQuery ? 'found' : 'total'}
              </Text>
            )}
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBg}>
              <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
            </View>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search by name, email, or phone..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <Text style={styles.clearSearchText}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Customer List - Jobs Principle: FlatList virtualizes for instant performance */}
          <View style={styles.customerListWrapper}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : customers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No customers found' : 'No customers yet'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery ? 'Try a different search' : 'Add your first customer'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={customers}
                keyExtractor={(item) => item.id}
                renderItem={({ item: customer }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectCustomer(customer)}
                    style={styles.customerCard}
                    activeOpacity={0.7}
                  >
                    <View style={styles.customerCardBg}>
                      <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />
                    </View>
                    <View style={styles.customerCardContent}>
                      <View style={styles.customerInfo}>
                        <Text style={styles.customerName}>
                          {getDisplayName(customer)}
                        </Text>
                        <Text style={styles.customerEmail} numberOfLines={1}>
                          {customer.email}
                        </Text>
                        {customer.phone && (
                          <Text style={styles.customerPhone} numberOfLines={1}>
                            {customer.phone}
                          </Text>
                        )}
                      </View>
                      {customer.loyalty_points > 0 && (
                        <View style={styles.loyaltyBadge}>
                          <Text style={styles.loyaltyPoints}>{customer.loyalty_points}</Text>
                          <Text style={styles.loyaltyLabel}>PTS</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.customerListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                getItemLayout={(data, index) => ({
                  length: 92, // 80 minHeight + 12 gap
                  offset: 92 * index,
                  index,
                })}
              />
            )}
          </View>

          {/* Guest Checkout Button */}
          <TouchableOpacity onPress={handleClose} style={styles.guestButton} activeOpacity={0.8}>
            <View style={styles.guestButtonBg}>
              <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
            </View>
            <Text style={styles.guestButtonText}>CONTINUE AS GUEST</Text>
          </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // Selected Customer Card (Compact)
  selectedCustomerCard: {
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedCustomerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  selectedCustomerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  selectedCustomerInfo: {
    flex: 1,
    gap: 4,
  },
  selectedCustomerName: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.3,
  },
  selectedCustomerEmail: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
  },
  selectedCustomerPoints: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(100,200,255,0.9)',
    letterSpacing: 0.5,
  },
  clearCustomerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,0,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCustomerButtonText: {
    fontSize: 24,
    fontWeight: '200',
    color: 'rgba(255,80,80,0.95)',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBorder: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
    height: '85%', // Jobs Principle: Fixed height enables flex children
    overflow: 'hidden',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 40,
    flex: 1,
  },
  pullHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: -0.4,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },

  // Search
  searchContainer: {
    marginHorizontal: 24,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  searchBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.3,
    zIndex: 1,
  },
  clearSearchButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  clearSearchText: {
    fontSize: 18,
    fontWeight: '200',
    color: 'rgba(255,255,255,0.6)',
  },

  // Customer List
  customerListWrapper: {
    flex: 1, // Jobs Principle: Takes all available space
    minHeight: 200, // Ensure minimum visible height
  },
  customerListContent: {
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
  },
  emptySubtext: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.3)',
  },

  // Customer Card
  customerCard: {
    minHeight: 80,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  customerCardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  customerCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  customerInfo: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.2,
  },
  customerEmail: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
  },
  customerPhone: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
  },

  // Loyalty Badge
  loyaltyBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(100,200,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100,200,255,0.25)',
    alignItems: 'center',
    gap: 2,
  },
  loyaltyPoints: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(100,200,255,0.95)',
  },
  loyaltyLabel: {
    fontSize: 9,
    fontWeight: '400',
    color: 'rgba(100,200,255,0.7)',
    letterSpacing: 1,
  },

  // Guest Button
  guestButton: {
    marginHorizontal: 24,
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  guestButtonBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  guestButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
    zIndex: 1,
  },
})
