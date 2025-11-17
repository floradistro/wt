import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Dock } from '@/components/Dock'
import { POSScreen } from '@/screens/POSScreen'
import { ProductsScreen } from '@/screens/ProductsScreen'
import { ScanScreen } from '@/screens/ScanScreen'
import { OrdersScreen } from '@/screens/OrdersScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const screens = [POSScreen, ProductsScreen, ScanScreen, OrdersScreen, SettingsScreen]

export function DashboardNavigator() {
  const [activeTab, setActiveTab] = useState(0)

  const ActiveScreen = screens[activeTab]

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <ErrorBoundary>
          <ActiveScreen />
        </ErrorBoundary>
        <Dock activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
})
