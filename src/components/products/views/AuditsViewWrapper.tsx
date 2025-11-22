/**
 * AuditsViewWrapper Component
 * Apple Standard: Clean wrapper for audits functionality
 *
 * Delegates to AuditsView component
 */

import React, { useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { AuditsView } from '@/components/products/AuditsView'
import { layout } from '@/theme/layout'

interface AuditsViewWrapperProps {
  onCreatePress: () => void
  vendorLogo?: string | null
  selectedLocationIds: string[]
}

export function AuditsViewWrapper({
  onCreatePress,
  vendorLogo,
  selectedLocationIds,
}: AuditsViewWrapperProps) {
  const headerOpacity = useRef(new Animated.Value(0)).current

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Audits</Text>
      </Animated.View>

      {/* Fade Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <AuditsView
        onCreatePress={onCreatePress}
        headerOpacity={headerOpacity}
        vendorLogo={vendorLogo}
        selectedLocationIds={selectedLocationIds}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop,
    left: 0,
    right: 0,
    height: layout.searchBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },
})
