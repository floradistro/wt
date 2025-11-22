/**
 * SettingsRow Component
 * iOS Settings-style row with label, value, and chevron
 */

import React from 'react'
import { View, Text, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { ordersStyles as styles } from './orders.styles'

interface SettingsRowProps {
  label: string
  value?: string
  showChevron?: boolean
  onPress?: () => void
}

export function SettingsRow({
  label,
  value,
  showChevron = true,
  onPress,
}: SettingsRowProps) {
  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  return (
    <Pressable style={styles.row} onPress={handlePress} disabled={!onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {showChevron && <Text style={styles.rowChevron}>􀆊</Text>}
      </View>
    </Pressable>
  )
}
