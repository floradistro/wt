/**
 * Error Boundary Component
 * Apple-quality error handling with design system
 */

import React, { Component, ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { colors, typography, spacing, radius } from '@/theme'
import { logger } from '@/utils/logger'

interface Props {
  children: ReactNode
  fallback?: (error: Error, resetError: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error Boundary caught error:', error, errorInfo)
  }

  resetError = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError)
      }

      // Default error UI with Apple design language
      return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.errorCard}>
            <View style={styles.errorBg}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            </View>

            <View style={styles.errorContent}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorMessage}>
                {this.state.error.message || 'An unexpected error occurred'}
              </Text>

              {__DEV__ && (
                <View style={styles.errorStack}>
                  <Text style={styles.errorStackLabel}>STACK TRACE (DEV ONLY)</Text>
                  <Text style={styles.errorStackText} numberOfLines={10}>
                    {this.state.error.stack}
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={this.resetError} style={styles.resetButton} activeOpacity={0.7}>
                <Text style={styles.resetButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.semantic.errorBorder,
  },
  errorBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.semantic.errorBg,
  },
  errorContent: {
    padding: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    ...typography.title1,
    color: colors.text.primary,
    textAlign: 'center',
  },
  errorMessage: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  errorStack: {
    width: '100%',
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  errorStackLabel: {
    ...typography.uppercaseLabel,
    color: colors.text.disabled,
    marginBottom: spacing.xs,
  },
  errorStackText: {
    ...typography.caption2,
    color: colors.text.subtle,
    fontFamily: 'monospace',
  },
  resetButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.md,
    backgroundColor: colors.glass.thick,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.emphasis,
  },
  resetButtonText: {
    ...typography.subhead,
    color: colors.text.primary,
  },
})
