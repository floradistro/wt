/**
 * SectionHeader Component
 * iOS-style section header for order groups (Today, Yesterday, etc.)
 */

import React from 'react'
import { View, Text } from 'react-native'
import { ordersStyles as styles } from '../orders.styles'

interface SectionHeaderProps {
  title: string
  isFirst: boolean
}

const SectionHeader = React.memo<SectionHeaderProps>(({ title, isFirst }) => (
  <View style={[styles.sectionHeader, isFirst && styles.sectionHeaderFirst]}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
))

SectionHeader.displayName = 'SectionHeader'

export { SectionHeader }
