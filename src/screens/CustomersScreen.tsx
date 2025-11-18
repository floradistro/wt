/**
 * Customers Screen
 * iPad Settings-style interface with Liquid Glass
 * Steve Jobs: "Design is not just what it looks like. Design is how it works."
 */

import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated, TextInput, Alert, Image } from 'react-native'
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useCustomers, type Customer } from '@/hooks/useCustomers'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { useDockOffset } from '@/navigation/DashboardNavigator'
import { customersService } from '@/services/customers.service'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'

type NavSection = 'all' | 'top-customers' | 'recent'

// Memoized Customer Item to prevent flickering
const CustomerItem = React.memo<{
  item: Customer
  isLast: boolean
  isSelected: boolean
  onPress: () => void
}>(({ item, isLast, isSelected, onPress }) => {
  // Format phone number for display
  const formattedPhone = item.phone
    ? item.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
    : null

  return (
    <Pressable
      style={[
        styles.customerItem,
        isSelected && styles.customerItemActive,
        isLast && styles.customerItemLast,
      ]}
      onPress={onPress}
      accessibilityRole="none"
    >
      {/* Avatar Circle */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.first_name || item.full_name || item.email || 'C').charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Customer Name & Contact */}
      <View style={styles.customerInfo}>
        <Text style={styles.customerName} numberOfLines={1}>
          {item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Anonymous Customer'}
        </Text>
        <Text style={styles.customerContact} numberOfLines={1}>
          {formattedPhone || item.email || 'No contact info'}
        </Text>
      </View>

      {/* Orders Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>ORDERS</Text>
        <Text style={styles.dataValue}>{item.total_orders || 0}</Text>
      </View>

      {/* Spent Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>SPENT</Text>
        <Text style={styles.dataValue}>${(item.total_spent || 0).toFixed(2)}</Text>
      </View>

      {/* Loyalty Points Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>POINTS</Text>
        <Text style={[styles.dataValue, styles.loyaltyPoints]}>
          {item.loyalty_points || 0}
        </Text>
      </View>
    </Pressable>
  )
})

CustomerItem.displayName = 'CustomerItem'

// Section Header Component
const SectionHeader = React.memo<{ title: string }>(({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
))

SectionHeader.displayName = 'SectionHeader'

function CustomersScreenComponent() {
  const dockOffset = useDockOffset()
  const { user } = useAuth()

  // Navigation State
  const [activeNav, setActiveNav] = useState<NavSection>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Selection State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Vendor Logo
  const [vendorLogo, setVendorLogo] = useState<string | null>(null)

  // Animation State
  const slideAnim = useRef(new Animated.Value(0)).current
  const contentWidth = useRef(0)
  const [isDetailVisible, setIsDetailVisible] = useState(false)
  const headerOpacity = useRef(new Animated.Value(0)).current

  // Data Hooks
  const { customers, loading, error, refresh, searchCustomers: performSearch } = useCustomers({
    autoLoad: true,
    searchTerm: searchQuery
  })

  // Load vendor info
  useEffect(() => {
    async function loadVendorInfo() {
      if (!user?.email) return
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('vendor_id, vendors(id, store_name, logo_url)')
          .eq('email', user.email)
          .single()

        if (userError) {
          logger.error('User query error', { error: userError })
          return
        }

        logger.debug('[CustomersScreen] Vendor data loaded:', {
          hasVendor: !!userData?.vendors,
          vendorData: userData?.vendors,
          logoUrl: (userData?.vendors as any)?.logo_url
        })

        if (userData?.vendors) {
          const vendor = userData.vendors as any
          setVendorLogo(vendor.logo_url || null)
          logger.debug('[CustomersScreen] Set vendor logo to:', vendor.logo_url)
        }
      } catch (error) {
        logger.error('Failed to load vendor info', { error })
      }
    }
    loadVendorInfo()
  }, [user])

  // Search Effect
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery)
    } else {
      refresh()
    }
  }, [searchQuery])

  // Animate panel when customer is selected/deselected
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedCustomer ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
    setIsDetailVisible(!!selectedCustomer)
  }, [selectedCustomer, slideAnim])

  // Navigation Items
  const navItems: NavItem[] = useMemo(
    () => [
      {
        id: 'all',
        icon: 'grid',
        label: 'All Customers',
        count: customers.length,
      },
      {
        id: 'top-customers',
        icon: 'list',
        label: 'Top Customers',
      },
      {
        id: 'recent',
        icon: 'doc',
        label: 'Recent',
      },
    ],
    [customers.length]
  )

  // Filter customers based on active nav
  const filteredCustomers = useMemo(() => {
    const filtered = [...customers]

    switch (activeNav) {
      case 'top-customers':
        return filtered
          .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
          .slice(0, 50)
      case 'recent':
        return filtered
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 50)
      default:
        return filtered.sort((a, b) => {
          const nameA = (a.full_name || a.first_name || '').toLowerCase()
          const nameB = (b.full_name || b.first_name || '').toLowerCase()
          return nameA.localeCompare(nameB)
        })
    }
  }, [customers, activeNav])

  // Group by first letter (for All view)
  const groupedCustomers = useMemo(() => {
    if (activeNav !== 'all') return null

    const groups: Record<string, Customer[]> = {}
    filteredCustomers.forEach((customer) => {
      const firstLetter = (
        customer.full_name ||
        customer.first_name ||
        customer.email ||
        '#'
      )
        .charAt(0)
        .toUpperCase()
      const letter = /[A-Z]/.test(firstLetter) ? firstLetter : '#'

      if (!groups[letter]) groups[letter] = []
      groups[letter].push(customer)
    })

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b)
    })
  }, [filteredCustomers, activeNav])

  // Handle customer selection
  const handleSelectCustomer = useCallback((customer: Customer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCustomer(customer)
  }, [])

  // Handle close detail
  const handleCloseDetail = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCustomer(null)
  }, [])

  // Handle delete customer
  const handleDeleteCustomer = useCallback(async () => {
    if (!selectedCustomer) return

    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${selectedCustomer.full_name || 'this customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement delete in service
              logger.info('Delete customer:', selectedCustomer.id)
              setSelectedCustomer(null)
              refresh()
            } catch (err) {
              logger.error('Failed to delete customer:', err)
              Alert.alert('Error', 'Failed to delete customer')
            }
          },
        },
      ]
    )
  }, [selectedCustomer, refresh])

  // Render list content
  const renderListContent = () => {
    if (loading && customers.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text.secondary} />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      )
    }

    if (filteredCustomers.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIconContainer}>
            <Text style={styles.emptyStateIcon}>👤</Text>
          </View>
          <Text style={styles.emptyStateTitle}>No Customers Found</Text>
          <Text style={styles.emptyStateText}>
            {searchQuery
              ? `No results for "${searchQuery}"`
              : 'No customers yet. Add your first customer to get started.'}
          </Text>
          {searchQuery && (
            <Pressable
              style={styles.clearSearchButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearSearchButtonText}>CLEAR SEARCH</Text>
            </Pressable>
          )}
        </View>
      )
    }

    // Render grouped list for "All" view
    if (activeNav === 'all' && groupedCustomers) {
      return (
        <>
          {groupedCustomers.map(([letter, groupCustomers]) => (
            <View key={letter}>
              <SectionHeader title={letter} />
              <View style={styles.cardWrapper}>
                <View style={styles.customersCardGlass}>
                  {groupCustomers.map((customer, idx) => (
                    <CustomerItem
                      key={customer.id}
                      item={customer}
                      isLast={idx === groupCustomers.length - 1}
                      isSelected={selectedCustomer?.id === customer.id}
                      onPress={() => handleSelectCustomer(customer)}
                    />
                  ))}
                </View>
              </View>
            </View>
          ))}
        </>
      )
    }

    // Render flat list for other views
    return (
      <View style={styles.cardWrapper}>
        <View style={styles.customersCardGlass}>
          {filteredCustomers.map((customer, idx) => (
            <CustomerItem
              key={customer.id}
              item={customer}
              isLast={idx === filteredCustomers.length - 1}
              isSelected={selectedCustomer?.id === customer.id}
              onPress={() => handleSelectCustomer(customer)}
            />
          ))}
        </View>
      </View>
    )
  }

  // Interpolate animations
  const listTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(contentWidth.current || 800)],
  })

  const detailTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [contentWidth.current || 800, 0],
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        {/* LEFT SIDEBAR */}
        <NavSidebar
          width={layout.sidebarWidth}
          items={navItems}
          activeItemId={activeNav}
          onItemPress={(id) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setActiveNav(id as NavSection)
            setSelectedCustomer(null)
          }}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search customers..."
        />

        {/* CENTER & RIGHT CONTENT */}
        <View
          style={styles.contentArea}
          onLayout={(e) => {
            contentWidth.current = e.nativeEvent.layout.width
          }}
        >
          {/* CENTER LIST */}
          <Animated.View
            style={[
              styles.customersList,
              {
                transform: [{ translateX: listTranslateX }],
              },
            ]}
          >
            {/* Fixed Header - appears on scroll */}
            <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
              <Text style={styles.fixedHeaderTitle}>
                {activeNav === 'all' && 'All Customers'}
                {activeNav === 'top-customers' && 'Top Customers'}
                {activeNav === 'recent' && 'Recent Customers'}
              </Text>
            </Animated.View>

            {/* Fade Gradient Overlay */}
            <LinearGradient
              colors={[
                'rgba(0,0,0,0.95)',
                'rgba(0,0,0,0.8)',
                'rgba(0,0,0,0)',
              ]}
              style={styles.fadeGradient}
              pointerEvents="none"
            />

            {/* Scrollable Customer List */}
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              indicatorStyle="white"
              scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
              contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
              onScroll={(e) => {
                const offsetY = e.nativeEvent.contentOffset.y
                const threshold = 40
                // Instant transition like iOS
                headerOpacity.setValue(offsetY > threshold ? 1 : 0)
              }}
              scrollEventThrottle={16}
            >
              {/* Large Title with Vendor Logo - scrolls with content */}
              <View style={styles.cardWrapper}>
                <View style={styles.titleSectionContainer}>
                  <View style={styles.titleWithLogo}>
                    {vendorLogo ? (
                      <Image
                        source={{ uri: vendorLogo }}
                        style={styles.vendorLogoInline}
                        resizeMode="contain"
                        fadeDuration={0}
                        onError={(e) => logger.debug('[CustomersScreen] Image load error:', e.nativeEvent.error)}
                        onLoad={() => logger.debug('[CustomersScreen] Image loaded successfully')}
                      />
                    ) : (
                      <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                      </View>
                    )}
                    <Text style={styles.largeTitleHeader}>
                      {activeNav === 'all' && 'All Customers'}
                      {activeNav === 'top-customers' && 'Top Customers'}
                      {activeNav === 'recent' && 'Recent Customers'}
                    </Text>
                  </View>
                </View>
              </View>

              {renderListContent()}
            </ScrollView>
          </Animated.View>

          {/* RIGHT DETAIL PANEL */}
          {isDetailVisible && (
            <Animated.View
              style={[
                styles.detailPanel,
                {
                  transform: [{ translateX: detailTranslateX }],
                },
              ]}
            >
              {selectedCustomer && (
                <CustomerDetail
                  customer={selectedCustomer}
                  onClose={handleCloseDetail}
                  onDelete={handleDeleteCustomer}
                  onUpdate={(updated) => {
                    setSelectedCustomer(updated)
                    refresh()
                  }}
                />
              )}
            </Animated.View>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

// Customer Detail Panel Component
interface CustomerDetailProps {
  customer: Customer
  onClose: () => void
  onDelete: () => void
  onUpdate: (customer: Customer) => void
}

const CustomerDetail = memo<CustomerDetailProps>(({ customer, onClose, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>(customer)
  const [isSaving, setIsSaving] = useState(false)
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const updated = await customersService.updateCustomer(customer.id, editedCustomer)
      onUpdate(updated)
      setIsEditing(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (err) {
      logger.error('Failed to update customer:', err)
      Alert.alert('Error', 'Failed to update customer')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedCustomer(customer)
    setIsEditing(false)
  }

  const handleLoyaltyAdjustment = (adjustment: number) => {
    Alert.alert(
      adjustment > 0 ? 'Add Loyalty Points' : 'Remove Loyalty Points',
      `${adjustment > 0 ? 'Add' : 'Remove'} ${Math.abs(adjustment)} points ${adjustment > 0 ? 'to' : 'from'} ${customer.full_name || 'this customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await customersService.updateCustomerLoyaltyPoints(customer.id, adjustment)
              const updated = { ...customer, loyalty_points: customer.loyalty_points + adjustment }
              onUpdate(updated as Customer)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              setShowLoyaltyModal(false)
              setCustomAmount('')
            } catch (err) {
              logger.error('Failed to update loyalty points:', err)
              Alert.alert('Error', 'Failed to update loyalty points')
            }
          }
        }
      ]
    )
  }

  const handleCustomAmountSubmit = () => {
    const amount = parseInt(customAmount, 10)
    if (isNaN(amount) || amount === 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid number')
      return
    }
    handleLoyaltyAdjustment(amount)
  }

  const formattedPhone = customer.phone
    ? customer.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
    : 'Not provided'

  const memberSince = new Date(customer.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <View style={styles.detailContainer}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <View style={styles.detailHeaderActions}>
          {isEditing ? (
            <>
              <Pressable
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[styles.actionButton, styles.editButton]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.actionButtonText}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.deleteButton]}
                onPress={onDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
        {/* Avatar & Name */}
        <View style={styles.detailAvatarSection}>
          <View style={styles.detailAvatar}>
            <Text style={styles.detailAvatarText}>
              {(customer.first_name || customer.full_name || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          {isEditing ? (
            <View style={styles.nameEditFields}>
              <TextInput
                style={styles.nameInput}
                value={editedCustomer.first_name || ''}
                onChangeText={(text) =>
                  setEditedCustomer({ ...editedCustomer, first_name: text })
                }
                placeholder="First Name"
                placeholderTextColor={colors.text.placeholder}
              />
              <TextInput
                style={styles.nameInput}
                value={editedCustomer.last_name || ''}
                onChangeText={(text) =>
                  setEditedCustomer({ ...editedCustomer, last_name: text })
                }
                placeholder="Last Name"
                placeholderTextColor={colors.text.placeholder}
              />
            </View>
          ) : (
            <Text style={styles.detailCustomerName}>
              {customer.full_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Anonymous Customer'}
            </Text>
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${(customer.total_spent || 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{customer.total_orders || 0}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <Pressable
            style={styles.statCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowLoyaltyModal(true)
            }}
          >
            <Text style={[styles.statValue, styles.loyaltyStatValue]}>
              {customer.loyalty_points || 0}
            </Text>
            <Text style={styles.statLabel}>Loyalty Points</Text>
            <Text style={styles.statHint}>Tap to adjust</Text>
          </Pressable>
        </View>

        {/* Loyalty Points Adjustment Modal */}
        {showLoyaltyModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.loyaltyModal}>
              <Text style={styles.loyaltyModalTitle}>Adjust Loyalty Points</Text>
              <Text style={styles.loyaltyModalSubtitle}>
                Current: {customer.loyalty_points || 0} points
              </Text>

              <View style={styles.loyaltyButtons}>
                {/* Quick Adjust Buttons */}
                <View style={styles.loyaltyButtonRow}>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonNegative]}
                    onPress={() => handleLoyaltyAdjustment(-100)}
                  >
                    <Text style={styles.loyaltyButtonText}>-100</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonNegative]}
                    onPress={() => handleLoyaltyAdjustment(-50)}
                  >
                    <Text style={styles.loyaltyButtonText}>-50</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonNegative]}
                    onPress={() => handleLoyaltyAdjustment(-10)}
                  >
                    <Text style={styles.loyaltyButtonText}>-10</Text>
                  </Pressable>
                </View>

                <View style={styles.loyaltyButtonRow}>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonPositive]}
                    onPress={() => handleLoyaltyAdjustment(10)}
                  >
                    <Text style={styles.loyaltyButtonText}>+10</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonPositive]}
                    onPress={() => handleLoyaltyAdjustment(50)}
                  >
                    <Text style={styles.loyaltyButtonText}>+50</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.loyaltyButton, styles.loyaltyButtonPositive]}
                    onPress={() => handleLoyaltyAdjustment(100)}
                  >
                    <Text style={styles.loyaltyButtonText}>+100</Text>
                  </Pressable>
                </View>
              </View>

              {/* Custom Amount Input */}
              <View style={styles.customAmountSection}>
                <Text style={styles.customAmountLabel}>Or enter custom amount:</Text>
                <View style={styles.customAmountInputRow}>
                  <TextInput
                    style={styles.customAmountInput}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholder="Enter amount (+/-)"
                    placeholderTextColor={colors.text.placeholder}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={handleCustomAmountSubmit}
                  />
                  <Pressable
                    style={styles.customAmountButton}
                    onPress={handleCustomAmountSubmit}
                  >
                    <Text style={styles.customAmountButtonText}>Apply</Text>
                  </Pressable>
                </View>
                <Text style={styles.customAmountHint}>
                  Use + for adding points or - for removing (e.g., +250 or -75)
                </Text>
              </View>

              <Pressable
                style={styles.loyaltyCloseButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowLoyaltyModal(false)
                }}
              >
                <Text style={styles.loyaltyCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>
          <View style={styles.glassCard}>
            {/* Email */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              {isEditing ? (
                <TextInput
                  style={styles.infoInput}
                  value={editedCustomer.email || ''}
                  onChangeText={(text) =>
                    setEditedCustomer({ ...editedCustomer, email: text })
                  }
                  placeholder="email@example.com"
                  placeholderTextColor={colors.text.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.infoValue}>{customer.email || 'Not provided'}</Text>
              )}
            </View>

            <View style={styles.divider} />

            {/* Phone */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              {isEditing ? (
                <TextInput
                  style={styles.infoInput}
                  value={editedCustomer.phone || ''}
                  onChangeText={(text) =>
                    setEditedCustomer({ ...editedCustomer, phone: text })
                  }
                  placeholder="(555) 555-5555"
                  placeholderTextColor={colors.text.placeholder}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.infoValue}>{formattedPhone}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
          <View style={styles.glassCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>{memberSince}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer ID</Text>
              <Text style={styles.infoValue}>{customer.id.slice(0, 8)}...</Text>
            </View>
          </View>
        </View>

        {/* Recent Orders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT ORDERS</Text>
          <View style={styles.glassCard}>
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
})

CustomerDetail.displayName = 'CustomerDetail'

export const CustomersScreen = memo(CustomersScreenComponent)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  customersList: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.containerMargin,
  },
  fixedHeader: {
    position: 'absolute',
    top: layout.cardPadding, // Align with search bar top position
    left: 0,
    right: 0,
    height: layout.minTouchTarget, // Match search bar height
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Above fade gradient
  },
  fixedHeaderTitle: {
    ...typography.fixedHeader,
    color: colors.text.primary,
    fontWeight: '600',
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },
  titleSectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  vendorLogoInline: {
    width: 80,
    height: 80,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeTitleHeader: {
    ...typography.largeTitle,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  cardWrapper: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginVertical: layout.contentVertical,
  },
  customersCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Solid glass effect for smooth scrolling
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    gap: 12,
    minHeight: layout.minTouchTarget,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  customerItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  customerItemLast: {
    borderBottomWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass.thick,
    borderWidth: 1,
    borderColor: colors.border.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.title3,
    color: colors.text.primary,
  },
  customerInfo: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    ...typography.body,
    color: colors.text.primary,
  },
  customerContact: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  dataColumn: {
    minWidth: 80,
    alignItems: 'flex-end',
    gap: 2,
  },
  dataLabel: {
    ...typography.uppercaseLabel,
    color: colors.text.subtle,
  },
  dataValue: {
    ...typography.subhead,
    color: colors.text.primary,
  },
  loyaltyPoints: {
    color: colors.semantic.success,
  },
  sectionHeader: {
    paddingVertical: 4,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    marginTop: 12,
  },
  sectionHeaderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.glass.regular,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyStateIcon: {
    fontSize: 40,
  },
  emptyStateTitle: {
    ...typography.title2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyStateText: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  clearSearchButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  clearSearchButtonText: {
    ...typography.uppercaseLabel,
    color: colors.semantic.info,
  },

  // Detail Panel
  detailPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.primary,
  },
  detailContainer: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.containerMargin,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    ...typography.body,
    color: colors.semantic.info,
  },
  detailHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.regular,
    minWidth: 80,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.glass.regular,
  },
  deleteButton: {
    borderColor: colors.semantic.errorBorder,
  },
  cancelButton: {
    backgroundColor: colors.glass.regular,
  },
  saveButton: {
    backgroundColor: colors.semantic.success,
    borderColor: colors.semantic.success,
  },
  actionButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.semantic.error,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  detailContent: {
    flex: 1,
    paddingHorizontal: layout.containerMargin,
  },
  detailAvatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  detailAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.glass.thick,
    borderWidth: 2,
    borderColor: colors.border.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAvatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
  },
  detailCustomerName: {
    ...typography.title1,
    color: colors.text.primary,
  },
  nameEditFields: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 500,
  },
  nameInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
    borderRadius: radius.xl,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...typography.title2,
    color: colors.text.primary,
  },
  loyaltyStatValue: {
    color: colors.semantic.success,
  },
  statLabel: {
    ...typography.caption1,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...typography.uppercaseLabel,
    color: colors.text.subtle,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  infoValue: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'right',
  },
  infoInput: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
    padding: 0,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border.subtle,
    marginLeft: 16,
  },
  comingSoonText: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  statHint: {
    ...typography.caption1,
    color: colors.text.subtle,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Loyalty Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loyaltyModal: {
    backgroundColor: colors.glass.ultraThick,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border.regular,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
    gap: spacing.lg,
  },
  loyaltyModalTitle: {
    ...typography.title2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  loyaltyModalSubtitle: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  loyaltyButtons: {
    gap: spacing.sm,
  },
  loyaltyButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loyaltyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  loyaltyButtonPositive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: colors.semantic.successBorder,
  },
  loyaltyButtonNegative: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: colors.semantic.errorBorder,
  },
  loyaltyButtonText: {
    ...typography.buttonLarge,
    color: colors.text.primary,
  },
  loyaltyCloseButton: {
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
    marginTop: spacing.sm,
  },
  loyaltyCloseButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  customAmountSection: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
  },
  customAmountLabel: {
    ...typography.subhead,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  customAmountInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  customAmountInput: {
    ...typography.input,
    color: colors.text.primary,
    backgroundColor: colors.glass.regular,
    borderWidth: 1,
    borderColor: colors.border.regular,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    textAlign: 'center',
  },
  customAmountButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAmountButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  customAmountHint: {
    ...typography.caption1,
    color: colors.text.subtle,
    textAlign: 'center',
    fontStyle: 'italic',
  },
})
