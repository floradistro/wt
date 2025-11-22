import { useState } from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Dock } from '../components/Dock'
import { POSScreen } from '@/screens/POSScreen'
import { ProductsScreen } from '@/screens/ProductsScreen'
import { OrdersScreen } from '@/screens/OrdersScreen'
import { CustomersScreen } from '@/screens/CustomersScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DockOffsetContext } from './DockOffsetContext'
import { layout } from '@/theme/layout'
import { device } from '@/theme'

const screens = [POSScreen, ProductsScreen, OrdersScreen, CustomersScreen, SettingsScreen]

export function DashboardNavigator() {
  const [activeTab, setActiveTab] = useState(0)
  const [isFullWidth, setIsFullWidth] = useState(false)
  const { width: screenWidth } = useWindowDimensions()

  // Dynamic POS cart width based on current screen size (adapts to orientation)
  const posCartWidth = screenWidth > 600 ? 380 : 320

  // Map which screens have left content that dock should offset
  const screenSidebarWidths = [
    posCartWidth,        // POS - cart on left, center dock on product grid
    layout.sidebarWidth, // Products - has sidebar
    layout.sidebarWidth, // Orders - has sidebar
    layout.sidebarWidth, // Customers - has sidebar
    layout.sidebarWidth, // Settings - has sidebar
  ]

  // Calculate: if full width override is set, use 0, otherwise use screen default
  const leftOffset = (activeTab === 0 && isFullWidth) ? 0 : screenSidebarWidths[activeTab]
  const contentWidth = screenWidth - leftOffset
  const dockCenterX = leftOffset + (contentWidth / 2)

  return (
    <SafeAreaProvider>
      <DockOffsetContext.Provider value={{ setFullWidth: setIsFullWidth }}>
        <View style={styles.container}>
          {screens.map((Screen, index) => {
            const isActive = activeTab === index

            return (
              <View
                key={index}
                style={[
                  styles.screen,
                  { display: isActive ? 'flex' : 'none' }
                ]}
                pointerEvents={isActive ? 'auto' : 'none'}
                removeClippedSubviews={!isActive}
                collapsable={false}
              >
                <ErrorBoundary>
                  <Screen />
                </ErrorBoundary>
              </View>
            )
          })}
          <Dock activeTab={activeTab} onTabChange={setActiveTab} centerX={dockCenterX} />
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
