/**
 * POSModal - Unified Modal Component
 * The ONE way to do modals in WhaleTools POS
 *
 * Apple Philosophy: One perfect way to do things
 * - Consistent design across all popouts
 * - Beautiful liquid glass effects
 * - Landscape/tablet support built-in
 * - Smooth animations
 * - Keyboard handling
 *
 * Usage:
 * <POSModal
 *   visible={visible}
 *   title="NEW CUSTOMER"
 *   subtitle="Enter customer information"
 *   onClose={handleClose}
 * >
 *   {children}
 * </POSModal>
 */

import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Pressable,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect, useCallback, ReactNode } from 'react'
import { colors, spacing, radius } from '@/theme/tokens'

const { width } = Dimensions.get('window')
const isTablet = width > 600

// Apple-standard spring config for buttery smooth animations
const SPRING_CONFIG = {
  tension: 300,
  friction: 30,
  useNativeDriver: true,
}

const FADE_IN_CONFIG = {
  duration: 180,
  useNativeDriver: true,
}

const FADE_OUT_CONFIG = {
  duration: 120,
  useNativeDriver: true,
}

interface POSModalProps {
  visible: boolean
  title: string
  subtitle?: string
  maxWidth?: number
  onClose: () => void
  children: ReactNode
  showCloseButton?: boolean
}

function POSModal({
  visible,
  title,
  subtitle,
  maxWidth = isTablet ? 700 : undefined,
  onClose,
  children,
  showCloseButton = false,
}: POSModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.92)).current
  const isAnimatingRef = useRef(false)
  const lastTapRef = useRef<number>(0)

  useEffect(() => {
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true

    if (visible) {
      // Reset to start position immediately
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.92)

      // Apple-style spring animation - fast attack, smooth settle
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          ...FADE_IN_CONFIG,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          ...SPRING_CONFIG,
        }),
      ]).start(() => {
        isAnimatingRef.current = false
      })
    } else {
      // Quick fade out - no spring on exit (Apple pattern)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          ...FADE_OUT_CONFIG,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimatingRef.current = false
      })
    }
  }, [visible, fadeAnim, scaleAnim])

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }, [onClose])

  // Double-tap anywhere to close modal
  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onClose()
    }
    lastTapRef.current = now
  }, [onClose])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
      accessibilityViewIsModal={true}
    >
      <Animated.View
        style={[styles.overlayContainer, { opacity: fadeAnim }]}
        accessible={true}
        accessibilityRole="none"
        accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}`}
        onAccessibilityEscape={handleClose}
      >
        {/* Blurred background overlay - double tap to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDoubleTap}>
          <BlurView
            intensity={25}
            tint="dark"
            style={StyleSheet.absoluteFill}
            accessible={false}
          />
          {/* Dark tint over blur for better contrast */}
          <View style={styles.overlayTint} />
        </Pressable>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          accessible={false}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            accessible={false}
          >
            <Animated.View
              style={[
                {
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* @ts-expect-error - ViewStyle type issue with conditional maxWidth */}
              <View style={[styles.modalContentWrapper, maxWidth && { maxWidth }]}>
                {/* Solid background layer for readability */}
                <View style={styles.modalSolidBackground} />
                <LiquidGlassView
                  effect="regular"
                  colorScheme="dark"
                  tintColor="rgba(8,8,8,0.98)"
                  style={[
                    styles.modalContent,
                    !isLiquidGlassSupported && styles.modalContentFallback,
                  ]}
                  accessible={false}
                >
                  {/* Header */}
                  <View style={styles.header} accessible={false}>
                    <View style={styles.headerContent}>
                      <Text style={styles.title} accessibilityRole="header">{title}</Text>
                      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                    </View>
                    {showCloseButton && (
                      <TouchableOpacity
                        onPress={handleClose}
                        style={styles.closeButton}
                        activeOpacity={0.7}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Close modal"
                        accessibilityHint="Double tap to close this dialog"
                      >
                        <Text style={styles.closeButtonText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Content */}
                  {children}
                </LiquidGlassView>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  )
}

const POSModalMemo = memo(POSModal)
export { POSModalMemo as POSModal }

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: isTablet ? spacing.huge : spacing.xl,
  },
  modalContentWrapper: {
    alignSelf: 'center',
    width: '100%',
    position: 'relative',
  },
  modalSolidBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.97)',
    borderRadius: radius.xxl,
  },
  modalContent: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  modalContentFallback: {
    backgroundColor: 'rgba(12,12,12,0.99)',
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.1,
    color: colors.text.subtle,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: -0.4,
  },
})
