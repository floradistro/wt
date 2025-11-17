/**
 * Sentry Test Screen
 *
 * Temporary screen for testing Sentry integration
 * Add this to your navigation to test Sentry manually
 */

import React from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native'
import {
  testSentryErrorCapture,
  testSentryBreadcrumbs,
  testSentryContext,
  testSentryPerformance,
  testPaymentError,
  testProcessorHealthError,
  testCheckoutError,
  runAllSentryTests,
  quickSentryTest,
} from '@/utils/test-sentry'
import { layout } from '@/theme/layout'

export function SentryTestScreen() {
  const handleTestComplete = (testName: string) => {
    Alert.alert(
      'Test Sent ✅',
      `${testName} has been sent to Sentry.\n\nCheck your dashboard at:\nhttps://sentry.io/`,
      [{ text: 'OK' }]
    )
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Sentry Integration Tests</Text>
        <Text style={styles.subtitle}>
          Tap buttons to send test events to Sentry
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Test</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            quickSentryTest()
            handleTestComplete('Quick Test')
          }}
        >
          <Text style={styles.buttonText}>⚡️ Quick Test</Text>
          <Text style={styles.buttonSubtext}>Send one test message</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Tests</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            testSentryErrorCapture()
            handleTestComplete('Error Capture')
          }}
        >
          <Text style={styles.buttonText}>1️⃣ Error Capture</Text>
          <Text style={styles.buttonSubtext}>Simple error reporting</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            testSentryBreadcrumbs()
            handleTestComplete('Breadcrumbs')
          }}
        >
          <Text style={styles.buttonText}>2️⃣ Breadcrumbs</Text>
          <Text style={styles.buttonSubtext}>Event trail before error</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            testSentryContext()
            handleTestComplete('Context Data')
          }}
        >
          <Text style={styles.buttonText}>3️⃣ Context Data</Text>
          <Text style={styles.buttonSubtext}>Rich metadata</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            await testSentryPerformance()
            handleTestComplete('Performance')
          }}
        >
          <Text style={styles.buttonText}>4️⃣ Performance</Text>
          <Text style={styles.buttonSubtext}>Transaction tracking</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Flow Tests</Text>

        <TouchableOpacity
          style={[styles.button, styles.paymentButton]}
          onPress={() => {
            testPaymentError()
            handleTestComplete('Payment Error')
          }}
        >
          <Text style={styles.buttonText}>💳 Payment Error</Text>
          <Text style={styles.buttonSubtext}>Simulate payment timeout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.paymentButton]}
          onPress={() => {
            testProcessorHealthError()
            handleTestComplete('Health Check Error')
          }}
        >
          <Text style={styles.buttonText}>🔌 Processor Health Error</Text>
          <Text style={styles.buttonSubtext}>Simulate terminal offline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.paymentButton]}
          onPress={() => {
            testCheckoutError()
            handleTestComplete('Checkout Error')
          }}
        >
          <Text style={styles.buttonText}>🛒 Checkout Error</Text>
          <Text style={styles.buttonSubtext}>Simulate transaction save failure</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Full Test Suite</Text>
        <TouchableOpacity
          style={[styles.button, styles.fullTestButton]}
          onPress={async () => {
            Alert.alert(
              'Run All Tests?',
              'This will send 7 test events to Sentry over ~7 seconds.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Run Tests',
                  onPress: async () => {
                    await runAllSentryTests()
                    Alert.alert(
                      'All Tests Complete! ✅',
                      'Check your Sentry dashboard to see:\n\n' +
                      '• 7 new errors in Issues\n' +
                      '• 4 performance transactions\n' +
                      '• Breadcrumbs & context\n' +
                      '• Tags for filtering\n\n' +
                      'Dashboard: https://sentry.io/',
                      [{ text: 'OK' }]
                    )
                  },
                },
              ]
            )
          }}
        >
          <Text style={styles.buttonText}>🚀 Run All Tests</Text>
          <Text style={styles.buttonSubtext}>Complete integration test (~7s)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          After running tests, check your Sentry dashboard:
        </Text>
        <Text style={styles.dashboardLink}>https://sentry.io/</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  button: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  fullTestButton: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  buttonSubtext: {
    fontSize: 13,
    color: '#666',
  },
  footer: {
    marginTop: 30,
    marginBottom: 40,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dashboardLink: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
})
