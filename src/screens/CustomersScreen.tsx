/**
 * Customers Screen
 * iPad Settings-style interface with Liquid Glass
 * Steve Jobs: "Design is not just what it looks like. Design is how it works."
 *
 * ZERO PROP DRILLING ARCHITECTURE:
 * - Reads auth/vendor from AppAuthContext
 * - Reads customer data from customers-list.store
 * - Reads UI state from customers-ui.store
 * - No local state, no callbacks
 */

import { View, Text, Pressable, ScrollView, ActivityIndicator, Animated, Image } from 'react-native'
import React, { useRef, useEffect, useMemo, memo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { useDockOffset } from '@/navigation/DockOffsetContext'
import { logger } from '@/utils/logger'
import { useAppAuth } from '@/contexts/AppAuthContext'
import {
  useCustomersList,
  useCustomersLoading,
  useSearchQuery,
  useActiveNavFilter,
  customersListActions,
} from '@/stores/customers-list.store'
import {
  useSelectedCustomerUI,
  customersUIActions,
} from '@/stores/customers-ui.store'
import type { Customer } from '@/services/customers.service'
import { CustomerItem, CustomerDetail, EditCustomerModal } from '@/components/customers'
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

  // ✅ Read from Context
  const { user, vendor } = useAppAuth()

  // ✅ Read from Zustand Stores
  const customers = useCustomersList()
  const loading = useCustomersLoading()
  const searchQuery = useSearchQuery()
  const activeNav = useActiveNavFilter()
  const selectedCustomer = useSelectedCustomerUI()

  // ✅ ANTI-LOOP: Compute filtered customers with useMemo
  // NEVER use useFilteredCustomers hook - it creates new arrays on every render
  const filteredCustomers = useMemo(() => {
    const filtered = [...customers]
    switch (activeNav) {
      case 'top-customers':
        return filtered.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).slice(0, 50)
      case 'recent':
        return filtered.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 50)
      default:
        return filtered.sort((a, b) => {
          const nameA = (a.full_name || a.first_name || '').toLowerCase()
          const nameB = (b.full_name || b.first_name || '').toLowerCase()
          return nameA.localeCompare(nameB)
        })
    }
  }, [customers, activeNav])

  // ✅ ANTI-LOOP: Compute grouped customers with useMemo
  // NEVER compute in selector - causes infinite loop
  const groupedCustomers = useMemo(() => {
    if (activeNav !== 'all') return null

    const sorted = [...filteredCustomers]

    const groups: Record<string, Customer[]> = {}

    sorted.forEach((customer) => {
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

  // Animation State (still needed for UI)
  const slideAnim = useRef(new Animated.Value(0)).current
  const contentWidth = useRef(0)
  const headerOpacity = useRef(new Animated.Value(0)).current

  // Load customers on mount
  useEffect(() => {
    if (!vendor?.id) return

    logger.info('[CustomersScreen] Loading customers for vendor:', vendor.id)
    customersListActions.loadCustomers(vendor.id)
    customersListActions.setupRealtimeSubscription()

    return () => {
      customersListActions.cleanupRealtimeSubscription()
    }
  }, [vendor?.id])

  // Search Effect with debouncing
  useEffect(() => {
    if (!vendor?.id) return

    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        customersListActions.searchCustomers(vendor.id, searchQuery)
      } else {
        customersListActions.loadCustomers(vendor.id)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, vendor?.id])

  // Animate panel when customer is selected/deselected
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedCustomer ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
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
              onPress={() => customersListActions.setSearchQuery('')}
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
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        customersUIActions.selectCustomer(customer)
                      }}
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
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                customersUIActions.selectCustomer(customer)
              }}
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
            customersListActions.setActiveNav(id as NavSection)
            customersUIActions.clearSelection()
          }}
          searchValue={searchQuery}
          onSearchChange={customersListActions.setSearchQuery}
          searchPlaceholder="Search customers..."
          vendorLogo={vendor?.logo_url || null}
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
                    {vendor?.logo_url ? (
                      <Image
                        source={{ uri: vendor.logo_url }}
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
          {selectedCustomer && (
            <Animated.View
              style={[
                styles.detailPanel,
                {
                  transform: [{ translateX: detailTranslateX }],
                },
              ]}
            >
              {/* ✅ ZERO PROPS - Component reads from stores */}
              <CustomerDetail />
            </Animated.View>
          )}
        </View>
      </View>

      {/* ✅ ZERO PROPS - Modal reads from stores */}
      <EditCustomerModal />
    </SafeAreaView>
  )
}

export const CustomersScreen = memo(CustomersScreenComponent)
