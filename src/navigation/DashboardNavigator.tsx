import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Dock } from '@/components/Dock'
import { POSScreen } from '@/screens/POSScreen'
import { ProductsScreen } from '@/screens/ProductsScreen'
import { OrdersScreen } from '@/screens/OrdersScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { layout } from '@/theme/layout'
import { device } from '@/theme'

const screens = [POSScreen, ProductsScreen, OrdersScreen, SettingsScreen]

// POS cart width (matches POSScreen leftColumn)
const POS_CART_WIDTH = device.isTablet ? 380 : 320

// Map which screens have left content that dock should offset
const screenSidebarWidths = [
  POS_CART_WIDTH,       // POS - cart on left, center dock on product grid
  layout.sidebarWidth,  // Products - has sidebar
  layout.sidebarWidth,  // Orders - has sidebar
  layout.sidebarWidth,  // Settings - has sidebar
]

// Context for screens to override their dock offset
const DockOffsetContext = createContext<{
  setDockOffset: (offset: number | null) => void
}>({
  setDockOffset: () => {}
})

export const useDockOffset = () => useContext(DockOffsetContext)

export function DashboardNavigator() {
  const [activeTab, setActiveTab] = useState(0)
  const [customDockOffsets, setCustomDockOffsets] = useState<Record<number, number | null>>({})
  const [mountedScreens, setMountedScreens] = useState<Set<number>>(new Set([0])) // Mount first screen immediately

  // Use custom offset for this tab if set, otherwise use default for screen type
  const customOffset = customDockOffsets[activeTab]
  const sidebarWidth = customOffset !== undefined && customOffset !== null
    ? customOffset
    : screenSidebarWidths[activeTab]

  const setDockOffset = useCallback((offset: number | null) => {
    setCustomDockOffsets(prev => ({
      ...prev,
      [activeTab]: offset
    }))
  }, [activeTab])

  // Mount screen when switching to it (lazy mounting)
  useEffect(() => {
    setMountedScreens(prev => new Set(prev).add(activeTab))
  }, [activeTab])

  return (
    <SafeAreaProvider>
      <DockOffsetContext.Provider value={{ setDockOffset }}>
        <View style={styles.container}>
          {screens.map((Screen, index) => {
            const isActive = activeTab === index
            const isMounted = mountedScreens.has(index)

            if (!isMounted) return null

            return (
              <View
                key={index}
                style={[
                  styles.screen,
                  !isActive && styles.screenHidden
                ]}
                pointerEvents={isActive ? 'auto' : 'none'}
              >
                <ErrorBoundary>
                  <Screen />
                </ErrorBoundary>
              </View>
            )
          })}
          <Dock activeTab={activeTab} onTabChange={setActiveTab} sidebarWidth={sidebarWidth} />
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
  screenHidden: {
    opacity: 0,
    zIndex: -1,
  },
})
