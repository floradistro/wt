import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function ScanScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>SCANNER</Text>
        <Text style={styles.subtitle}>ID & Barcode Scanning</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            60fps native camera coming soon
          </Text>
          <Text style={[styles.placeholderText, { marginTop: 12 }]}>
            AAMVA parser ready
          </Text>
        </View>
      </View>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 60,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
    textAlign: 'center',
  },
})
