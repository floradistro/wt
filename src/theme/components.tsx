/**
 * WhaleTools Design System - Reusable UI Components
 * Apple-inspired components built on design tokens
 */

import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, ActivityIndicator, Pressable, Modal as RNModal, Animated, TextInput as RNTextInput } from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { ReactNode, useRef, useEffect, forwardRef } from 'react'
import { colors, typography, spacing, radius, blur, layout, borderWidth } from './tokens'

/**
 * ========================================
 * BUTTON COMPONENT
 * ========================================
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'error'
type ButtonSize = 'small' | 'medium' | 'large'

interface ButtonProps {
  children: ReactNode
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  style?: ViewStyle
}

export function Button({
  children,
  onPress,
  variant = 'secondary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const handlePress = () => {
    if (disabled || loading) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  const getBackgroundColor = () => {
    if (disabled) return colors.interactive.disabled
    switch (variant) {
      case 'primary':
        return colors.glass.ultraThick
      case 'secondary':
        return colors.glass.regular
      case 'ghost':
        return 'transparent'
      case 'success':
        return colors.semantic.successBg
      case 'error':
        return colors.semantic.errorBg
      default:
        return colors.glass.regular
    }
  }

  const getTextColor = () => {
    if (disabled) return colors.text.disabled
    switch (variant) {
      case 'primary':
        return colors.text.primary
      case 'secondary':
        return colors.text.secondary
      case 'ghost':
        return colors.text.tertiary
      case 'success':
        return colors.semantic.success
      case 'error':
        return colors.semantic.error
      default:
        return colors.text.secondary
    }
  }

  const getHeight = () => {
    switch (size) {
      case 'small':
        return 36
      case 'medium':
        return layout.height.button
      case 'large':
        return layout.height.buttonLarge
      default:
        return layout.height.button
    }
  }

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return typography.tinyLabel.fontSize
      case 'medium':
        return typography.subhead.fontSize
      case 'large':
        return typography.body.fontSize
      default:
        return typography.subhead.fontSize
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        {
          height: getHeight(),
          borderRadius: getHeight() / 2, // Pill shape
          backgroundColor: getBackgroundColor(),
          borderWidth: variant === 'ghost' ? borderWidth.thin : borderWidth.none,
          borderColor: variant === 'ghost' ? colors.border.emphasis : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text
          style={{
            fontSize: getFontSize(),
            fontWeight: variant === 'primary' ? '600' : '500',
            color: getTextColor(),
            letterSpacing: typography.subhead.letterSpacing,
          }}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  )
}

/**
 * ========================================
 * CARD COMPONENT
 * ========================================
 */

interface CardProps {
  children: ReactNode
  style?: ViewStyle
  blur?: boolean
  blurIntensity?: keyof typeof blur
}

export function Card({ children, style, blur: useBlur = true, blurIntensity: _blurIntensity = 'thick' }: CardProps) {
  return (
    <View
      style={[
        {
          borderRadius: radius.xxl,
          overflow: 'hidden',
          borderWidth: borderWidth.regular,
          borderColor: colors.border.regular,
          backgroundColor: useBlur ? 'transparent' : colors.glass.regular,
        },
        style,
      ]}
    >
      {useBlur && (
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[StyleSheet.absoluteFill, !isLiquidGlassSupported && { backgroundColor: colors.glass.thin }]}
        />
      )}
      <View style={{ position: 'relative' }}>{children}</View>
    </View>
  )
}

/**
 * ========================================
 * MODAL COMPONENT (Bottom Sheet)
 * ========================================
 */

interface ModalProps {
  visible: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  showHandle?: boolean
}

export function Modal({ visible, onClose, children, title, showHandle = true }: ModalProps) {
  const insets = useSafeAreaInsets()
  const modalSlideAnim = useRef(new Animated.Value(600)).current
  const modalOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(modalSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      modalSlideAnim.setValue(600)
      modalOpacity.setValue(0)
    }
  }, [visible])

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: modalOpacity }]}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[StyleSheet.absoluteFill, !isLiquidGlassSupported && { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          />
        </Pressable>

        {/* Modal Content */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: insets.left,
            right: insets.right,
            maxHeight: '90%',
            borderTopLeftRadius: radius.xxl + 8,
            borderTopRightRadius: radius.xxl + 8,
            borderWidth: borderWidth.regular,
            borderBottomWidth: 0,
            borderColor: colors.border.regular,
            overflow: 'hidden',
            transform: [{ translateY: modalSlideAnim }],
          }}
        >
          <View
            style={{
              borderTopLeftRadius: radius.xxl + 6,
              borderTopRightRadius: radius.xxl + 6,
              overflow: 'hidden',
              paddingBottom: spacing.huge,
            }}
          >
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              style={[StyleSheet.absoluteFill, !isLiquidGlassSupported && { backgroundColor: colors.glass.thin }]}
            />

            {/* Handle */}
            {showHandle && (
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: colors.text.placeholder,
                  borderRadius: radius.xs,
                  alignSelf: 'center',
                  marginTop: spacing.sm,
                  marginBottom: spacing.lg,
                }}
              />
            )}

            {/* Title */}
            {title && (
              <Text
                style={{
                  ...typography.title2,
                  color: colors.text.primary,
                  paddingHorizontal: spacing.xl,
                  marginBottom: spacing.xl,
                }}
              >
                {title}
              </Text>
            )}

            {/* Content */}
            {children}
          </View>
        </Animated.View>
      </Animated.View>
    </RNModal>
  )
}

/**
 * ========================================
 * TEXT INPUT COMPONENT
 * ========================================
 */

interface TextInputProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  label?: string
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address'
  secureTextEntry?: boolean
  large?: boolean
  style?: ViewStyle
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  ({ value, onChangeText, placeholder, label, keyboardType = 'default', secureTextEntry = false, large = false, style }, ref) => {
    return (
      <View style={style}>
        {label && (
          <Text
            style={{
              ...typography.uppercaseLabel,
              color: colors.text.disabled,
              marginBottom: spacing.xs,
            }}
          >
            {label}
          </Text>
        )}
        <RNTextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          style={{
            height: large ? layout.height.inputLarge : layout.height.input,
            ...typography.input,
            color: colors.text.primary,
            backgroundColor: colors.glass.regular,
            borderWidth: borderWidth.thin,
            borderColor: colors.border.emphasis,
            borderRadius: radius.xl,
            paddingHorizontal: spacing.lg,
          }}
        />
      </View>
    )
  }
)

TextInput.displayName = 'TextInput'

/**
 * ========================================
 * DIVIDER COMPONENT
 * ========================================
 */

interface DividerProps {
  style?: ViewStyle
  vertical?: boolean
}

export function Divider({ style, vertical = false }: DividerProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.border.hairline,
          [vertical ? 'width' : 'height']: borderWidth.hairline,
        },
        style,
      ]}
    />
  )
}

/**
 * ========================================
 * LIST ITEM COMPONENT (iOS 26 Style)
 * ========================================
 */

interface ListItemProps {
  children: ReactNode
  onPress?: () => void
  selected?: boolean
  showCheckmark?: boolean
  first?: boolean
  last?: boolean
}

export function ListItem({ children, onPress, selected = false, showCheckmark = false, first = false, last = false }: ListItemProps) {
  const handlePress = () => {
    if (!onPress) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!onPress}
      activeOpacity={0.7}
      style={{
        height: layout.height.listItem,
        paddingHorizontal: spacing.lg,
        backgroundColor: selected ? colors.glass.ultraThick : colors.glass.regular,
        borderBottomWidth: last ? 0 : borderWidth.hairline,
        borderBottomColor: colors.border.subtle,
        borderTopLeftRadius: first ? radius.lg : 0,
        borderTopRightRadius: first ? radius.lg : 0,
        borderBottomLeftRadius: last ? radius.lg : 0,
        borderBottomRightRadius: last ? radius.lg : 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {children}
      {showCheckmark && selected && (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.round,
            backgroundColor: colors.text.secondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.background.primary, fontSize: 12, fontWeight: '600' }}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

/**
 * ========================================
 * PILL COMPONENT (Customer/Tag Pills)
 * ========================================
 */

interface PillProps {
  children: ReactNode
  onPress?: () => void
  onRemove?: () => void
  variant?: 'default' | 'success' | 'error' | 'info'
  style?: ViewStyle
}

export function Pill({ children, onPress, onRemove, variant = 'default', style }: PillProps) {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'success':
        return colors.semantic.successBg
      case 'error':
        return colors.semantic.errorBg
      case 'info':
        return colors.semantic.infoBg
      default:
        return colors.glass.regular
    }
  }

  const getBorderColor = () => {
    switch (variant) {
      case 'success':
        return colors.semantic.successBorder
      case 'error':
        return colors.semantic.errorBorder
      case 'info':
        return colors.semantic.infoBorder
      default:
        return colors.border.emphasis
    }
  }

  const handlePress = () => {
    if (!onPress) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  const handleRemove = (e: any) => {
    if (!onRemove) return
    e.stopPropagation()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onRemove()
  }

  const Component = onPress ? TouchableOpacity : View

  return (
    <Component
      onPress={onPress ? handlePress : undefined}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        {
          height: layout.height.input,
          borderRadius: radius.pill,
          backgroundColor: getBackgroundColor(),
          borderWidth: variant === 'default' ? borderWidth.thin : 0,
          borderColor: getBorderColor(),
          paddingHorizontal: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <View style={{ flex: onRemove ? 1 : undefined }}>{children}</View>
      {onRemove && (
        <TouchableOpacity
          onPress={handleRemove}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.round,
            backgroundColor: colors.glass.thin,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '300', color: colors.text.tertiary }}>×</Text>
        </TouchableOpacity>
      )}
    </Component>
  )
}

/**
 * ========================================
 * SECTION HEADER COMPONENT
 * ========================================
 */

interface SectionHeaderProps {
  title: string
  action?: {
    label: string
    onPress: () => void
  }
  style?: ViewStyle
}

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        style,
      ]}
    >
      <Text
        style={{
          ...typography.uppercaseLabel,
          color: colors.text.disabled,
        }}
      >
        {title}
      </Text>
      {action && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            action.onPress()
          }}
        >
          <Text
            style={{
              ...typography.tinyLabel,
              color: colors.semantic.info,
            }}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

/**
 * ========================================
 * EMPTY STATE COMPONENT
 * ========================================
 */

interface EmptyStateProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    onPress: () => void
  }
  style?: ViewStyle
}

export function EmptyState({ title, subtitle, action, style }: EmptyStateProps) {
  return (
    <View
      style={[
        {
          paddingVertical: spacing.massive,
          alignItems: 'center',
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <Text
        style={{
          ...typography.footnote,
          color: colors.text.subtle,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            ...typography.caption1,
            color: colors.text.ghost,
          }}
        >
          {subtitle}
        </Text>
      )}
      {action && (
        <Button onPress={action.onPress} variant="ghost" size="small" style={{ marginTop: spacing.sm }}>
          {action.label}
        </Button>
      )}
    </View>
  )
}
