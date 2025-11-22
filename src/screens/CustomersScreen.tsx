/**
 * Customers Screen
 * iPad Settings-style interface with Liquid Glass
 * Steve Jobs: "Design is not just what it looks like. Design is how it works."
 */

import { View, Text, Pressable, ScrollView, ActivityIndicator, Animated, Image, Alert } from 'react-native'
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useCustomers, type Customer } from '@/hooks/useCustomers'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { useDockOffset } from '@/navigation/DashboardNavigator'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { CustomerItem, CustomerDetail } from '@/components/customers'
import { customersStyles as styles } from '@/components/customers/customers.styles'

type NavSection = 'all' | 'top-customers' | 'recent'

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
  const { customers, loading, error, refresh, searchCustomers: performSearch, deleteCustomer } = useCustomers({
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
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (userError || !userData) {
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

  // Search Effect with debouncing for better performance
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery)
      } else {
        refresh()
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, performSearch, refresh])

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
      `Are you sure you want to delete ${selectedCustomer.full_name || 'this customer'}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomer(selectedCustomer.id)
              setSelectedCustomer(null)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              logger.info('Customer deleted successfully:', selectedCustomer.id)
            } catch (err) {
              logger.error('Failed to delete customer:', err)
              Alert.alert('Error', 'Failed to delete customer. Please try again.')
            }
          },
        },
      ]
    )
  }, [selectedCustomer, deleteCustomer])

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
          vendorLogo={vendorLogo}
          userName={user?.email || 'User'}
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
              scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
              contentContainerStyle={{ paddingTop: layout.contentStartTop, paddingBottom: layout.dockHeight, paddingRight: 0 }}
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

export const CustomersScreen = memo(CustomersScreenComponent)
