/**
 * ErrorModal Component
 * Apple HIG-compliant error modal replacing native alert()
 * Jobs Principle: Clear, actionable error messaging
 */

import { View, Text, StyleSheet, Modal, Pressable } from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { spacing, radius } from '@/theme/tokens'

export interface ErrorModalProps {
  visible: boolean
  title: string
  message: string
  primaryButtonText?: string
  secondaryButtonText?: string
  onPrimaryPress: () => void
  onSecondaryPress?: () => void
  variant?: 'error' | 'warning' | 'info'
}

export function ErrorModal({
  visible,
  title,
  message,
  primaryButtonText = 'OK',
  secondaryButtonText,
  onPrimaryPress,
  onSecondaryPress,
  variant = 'error',
}: ErrorModalProps) {
  const handlePrimaryPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPrimaryPress()
  }

  const handleSecondaryPress = () => {
    if (onSecondaryPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onSecondaryPress()
    }
  }

  const iconMap = {
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
  }

  const colorMap = {
    error: '#ff453a',
    warning: '#ffd60a',
    info: '#60A5FA',
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handlePrimaryPress} />

        <View style={styles.modalContainer}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.modalGlass, !isLiquidGlassSupported && styles.modalGlassFallback]}
          >
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{iconMap[variant]}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {secondaryButtonText && onSecondaryPress && (
                <Pressable
                  onPress={handleSecondaryPress}
                  style={styles.secondaryButton}
                  accessibilityRole="button"
                  accessibilityLabel={secondaryButtonText}
                >
                  <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
                </Pressable>
              )}

              <Pressable
                onPress={handlePrimaryPress}
                style={[
                  styles.primaryButton,
                  { backgroundColor: colorMap[variant] },
                  !secondaryButtonText && styles.primaryButtonFull,
                ]}
                accessibilityRole="button"
                accessibilityLabel={primaryButtonText}
              >
                <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
              </Pressable>
            </View>
          </LiquidGlassView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
  },
  modalGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalGlassFallback: {
    backgroundColor: 'rgba(28,28,30,0.98)',
  },
  iconContainer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    letterSpacing: -0.4,
  },
  message: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.7)',
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonFull: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.9)',
    letterSpacing: -0.4,
  },
})
