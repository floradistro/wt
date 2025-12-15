import { View, StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { POSScreen } from '@/screens/POSScreen'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useOrderNotifications } from '@/hooks/useOrderNotifications'

// All views consolidated into POS
// Orders, Products, Marketing, Customers - all handled inside POS

export function DashboardNavigator() {
  // Enable location-aware order notifications globally
  useOrderNotifications()

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <ErrorBoundary>
          <POSScreen />
        </ErrorBoundary>
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
