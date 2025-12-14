import { useState, useEffect } from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Dock } from '../components/Dock'
import { POSScreen } from '@/screens/POSScreen'
import { ProductsScreen } from '@/screens/ProductsScreen'
import { OrdersScreen } from '@/screens/OrdersScreen'
import { CustomersScreen } from '@/screens/CustomersScreen'
import { MarketingScreen } from '@/screens/MarketingScreen'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DockOffsetContext } from './DockOffsetContext'
import { layout } from '@/theme/layout'
import { device } from '@/theme'
import { useOrderNotifications, setNotificationNavigator, clearNotificationNavigator } from '@/hooks/useOrderNotifications'
import { useBadgeCounts } from '@/stores/order-filter.store'
import { navigationActions } from '@/stores/navigation.store'

// Settings moved to Analytics Dashboard
const screens = [POSScreen, ProductsScreen, OrdersScreen, CustomersScreen, MarketingScreen]

export function DashboardNavigator() {
  // Enable location-aware order notifications globally
  useOrderNotifications()

  // Get badge counts for orders needing action
  const badgeCounts = useBadgeCounts()

  const [activeTab, setActiveTab] = useState(0)
  const [isFullWidth, setIsFullWidth] = useState(false)
  const { width: screenWidth } = useWindowDimensions()

  // Register navigation callback for notifications and global navigation
  useEffect(() => {
    setNotificationNavigator(setActiveTab)
    navigationActions.registerNavigator(setActiveTab)
    return () => {
      clearNotificationNavigator()
      navigationActions.unregisterNavigator()
    }
    // setActiveTab is stable (from useState), won't cause re-runs
  }, [setActiveTab])

  // Dynamic POS cart width based on current screen size (adapts to orientation)
  const posCartWidth = screenWidth > 600 ? 380 : 320

  // Map which screens have left content that dock should offset
  const screenSidebarWidths = [
    posCartWidth,        // POS - cart on left, center dock on product grid
    layout.sidebarWidth, // Products - has sidebar
    layout.sidebarWidth, // Orders - has sidebar
    layout.sidebarWidth, // Customers - has sidebar
    layout.sidebarWidth, // Marketing - has sidebar
  ]

  // Calculate: if full width override is set, use 0, otherwise use screen default
  const leftOffset = (activeTab === 0 && isFullWidth) ? 0 : screenSidebarWidths[activeTab]
  const contentWidth = screenWidth - leftOffset
  const dockCenterX = leftOffset + (contentWidth / 2)

  return (
    <SafeAreaProvider>
      <DockOffsetContext.Provider value={{ setFullWidth: setIsFullWidth }}>
        <View style={styles.container}>
          {/* Render ALL screens but hide inactive ones - prevents unmount/remount issues */}
          {screens.map((Screen, index) => (
            <View
              key={`screen-${index}`}
              style={[
                styles.screen,
                { display: activeTab === index ? 'flex' : 'none' }
              ]}
            >
              <ErrorBoundary>
                <Screen />
              </ErrorBoundary>
            </View>
          ))}
          <Dock
            activeTab={activeTab}
            onTabChange={setActiveTab}
            centerX={dockCenterX}
            ordersBadgeCount={badgeCounts.needsAction}
          />
        </View>
      </DockOffsetContext.Provider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  screen: {
    ...StyleSheet.absoluteFillObject,
  },
})
