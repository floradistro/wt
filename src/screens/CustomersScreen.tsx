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

import { View, Text, Pressable, ActivityIndicator, Animated, FlatList } from 'react-native'
import React, { useRef, useEffect, useMemo, memo, useCallback, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { TitleSection } from '@/components/shared'
import type { FilterPill } from '@/components/shared'
import { useDockOffset } from '@/navigation/DockOffsetContext'
import { logger } from '@/utils/logger'
import { useAppAuth } from '@/contexts/AppAuthContext'
import {
  useCustomersList,
  useCustomersLoading,
  useSearchQuery,
  customersListActions,
} from '@/stores/customers-list.store'
import {
  useSelectedCustomerUI,
  customersUIActions,
} from '@/stores/customers-ui.store'
import type { Customer } from '@/services/customers.service'
import { CustomerItem, CustomerDetail, EditCustomerModal } from '@/components/customers'
import { customersStyles as styles } from '@/components/customers/customers.styles'

type CustomerFilter = 'all' | 'top-customers' | 'recent'

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
  const selectedCustomer = useSelectedCustomerUI()

  // Local filter state (replaces activeNav from store)
  const [activeFilter, setActiveFilter] = useState<CustomerFilter>('all')

  // ⚡ PERFORMANCE: Compute filtered/grouped in component (NOT from store - data mismatch!)
  const filteredCustomers = useMemo(() => {
    const startTime = performance.now()
    const filtered = [...customers]
    let result
    switch (activeFilter) {
      case 'top-customers':
        result = filtered.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).slice(0, 50)
        break
      case 'recent':
        result = filtered.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 50)
        break
      default:
        result = filtered.sort((a, b) => {
          const nameA = (a.full_name || a.first_name || '').toLowerCase()
          const nameB = (b.full_name || b.first_name || '').toLowerCase()
          return nameA.localeCompare(nameB)
        })
    }
    logger.info(`[CustomersScreen] filteredCustomers computed in ${(performance.now() - startTime).toFixed(2)}ms`)
    return result
  }, [customers, activeFilter])

  const groupedCustomers = useMemo(() => {
    if (activeFilter !== 'all') return null

    const startTime = performance.now()
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

    const result = Object.entries(groups).sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b)
    })

    logger.info(`[CustomersScreen] groupedCustomers computed in ${(performance.now() - startTime).toFixed(2)}ms`)
    return result
  }, [filteredCustomers, activeFilter])

  // Define filter pills
  const filterPills: FilterPill[] = useMemo(() => [
    { id: 'all', label: 'All' },
    { id: 'top-customers', label: 'Top Customers' },
    { id: 'recent', label: 'Recent' },
  ], [])

  // Handle filter selection
  const handleFilterSelect = (filterId: string) => {
    setActiveFilter(filterId as CustomerFilter)
    customersUIActions.clearSelection()
  }

  // Animation State (still needed for UI)
  const slideAnim = useRef(new Animated.Value(0)).current
  const contentWidth = useRef(0)

  // Load customers on mount
  useEffect(() => {
    if (!vendor?.id) return

    const startTime = performance.now()
    logger.info('[CustomersScreen] Loading customers for vendor:', vendor.id)
    customersListActions.loadCustomers(vendor.id).then(() => {
      logger.info(`[CustomersScreen] Customers loaded in ${(performance.now() - startTime).toFixed(2)}ms`)
    })
    customersListActions.setupRealtimeSubscription()

    return () => {
      customersListActions.cleanupRealtimeSubscription()
    }
  }, [vendor?.id])

  // Search Effect with debouncing (skip initial load - handled above)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (!vendor?.id) return

    // Skip the search effect on initial mount (customers already loading above)
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

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

  // Navigation Items (simplified - filters now in pills)
  const navItems: NavItem[] = useMemo(
    () => [
      {
        id: 'customers',
        icon: 'grid',
        label: 'Customers',
        count: customers.length,
      },
    ],
    [customers.length]
  )

  // ⚡ PERFORMANCE: Flatten sections for FlatList (matches OrdersScreen pattern)
  const flatListData = useMemo(() => {
    const items: Array<{ type: 'section'; letter: string; customers: Customer[]; isFirst: boolean }> = []

    if (activeFilter === 'all' && groupedCustomers) {
      groupedCustomers.forEach(([letter, customers], index) => {
        items.push({
          type: 'section',
          letter,
          customers,
          isFirst: index === 0
        })
      })
    } else {
      // For non-alphabetical views, create single section
      items.push({
        type: 'section',
        letter: '',
        customers: filteredCustomers,
        isFirst: true
      })
    }

    return items
  }, [activeFilter, groupedCustomers, filteredCustomers])

  // Memoize customer selection handler
  const handleCustomerPress = useCallback((customer: Customer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    customersUIActions.selectCustomer(customer)
  }, [])

  const renderItem = useCallback(({ item }: { item: typeof flatListData[0] }) => {
    const { letter, customers } = item
    return (
      <>
        {letter && <SectionHeader title={letter} />}
        <View style={styles.cardWrapper}>
          <View style={styles.customersCardGlass}>
            {customers.map((customer, index) => (
              <CustomerItem
                key={customer.id}
                item={customer}
                isLast={index === customers.length - 1}
                isSelected={selectedCustomer?.id === customer.id}
                onPress={() => handleCustomerPress(customer)}
              />
            ))}
          </View>
        </View>
      </>
    )
  }, [selectedCustomer, handleCustomerPress])

  const keyExtractor = useCallback((item: typeof flatListData[0], index: number) => {
    return `section-${item.letter || 'all'}-${index}`
  }, [])

  const ListHeaderComponent = useCallback(() => (
    <TitleSection
      title="Customers"
      logo={vendor?.logo_url}
      subtitle={`${filteredCustomers.length} ${activeFilter === 'all' ? 'customers' : activeFilter === 'top-customers' ? 'top customers' : 'recent'}`}
      filterPills={filterPills}
      activeFilterId={activeFilter}
      onFilterSelect={handleFilterSelect}
    />
  ), [vendor?.logo_url, filteredCustomers.length, activeFilter, filterPills, handleFilterSelect])

  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyState}>
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
  ), [searchQuery, customersListActions])

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
          activeItemId="customers"
          onItemPress={(id) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          }}
          searchValue={searchQuery}
          onSearchChange={customersListActions.setSearchQuery}
          searchPlaceholder="Search customers..."
          vendorLogo={vendor?.logo_url || null}
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
            {/* ⚡ PERFORMANCE: FlatList with proper item-level virtualization */}
            {loading && customers.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.text.secondary} />
                <Text style={styles.loadingText}>Loading customers...</Text>
              </View>
            ) : (
              <FlatList
                data={flatListData}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListHeaderComponent={ListHeaderComponent}
                ListEmptyComponent={ListEmptyComponent}
                showsVerticalScrollIndicator={true}
                indicatorStyle="white"
                scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
                contentContainerStyle={{ paddingTop: 0, paddingBottom: layout.dockHeight, paddingRight: 0 }}
                // ⚡ PERFORMANCE: Aggressive settings for 1000+ customers
                maxToRenderPerBatch={2}
                updateCellsBatchingPeriod={100}
                initialNumToRender={2}
                windowSize={3}
                removeClippedSubviews={true}
              />
            )}
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
