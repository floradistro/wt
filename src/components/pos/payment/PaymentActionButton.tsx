/**
 * Unified Payment Action Button
 * Glass-styled button used across all payment views
 */

import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

interface PaymentActionButtonProps {
  onPress: () => void
  isActive: boolean
  activeText: string
  activeIcon?: keyof typeof Ionicons.glyphMap
  inactiveText?: string
  inactiveIcon?: keyof typeof Ionicons.glyphMap
}

export function PaymentActionButton({
  onPress,
  isActive,
  activeText,
  activeIcon = 'checkmark-circle',
  inactiveText = 'Cancel',
  inactiveIcon = 'close',
}: PaymentActionButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  const buttonLabel = isActive ? activeText : inactiveText

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.button, isActive && styles.buttonActive]}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
      accessibilityHint={isActive ? 'Double tap to complete payment' : 'Double tap to cancel'}
      accessibilityState={{ disabled: false }}
    >
      <Ionicons
        name={isActive ? activeIcon : inactiveIcon}
        size={22}
        color={isActive ? '#10b981' : 'rgba(255,255,255,0.6)'}
      />
      <Text style={[styles.buttonText, isActive && styles.buttonTextActive]}>
        {buttonLabel}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  buttonActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.4)',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  buttonTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
})
