import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function ProductsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Text style={styles.title}>PRODUCTS</Text>
          <Text style={styles.subtitle}>Catalog Management</Text>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Product catalog coming soon
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  placeholder: {
    paddingHorizontal: 24,
    paddingVertical: 100,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  },
})
