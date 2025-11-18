/**
 * Dock Component - Apple Liquid Glass Effect
 * Using @callstack/liquid-glass for real iOS 26+ liquid glass
 * With working touch handling and smooth position animations
 */

import { View, Pressable, StyleSheet, Animated } from 'react-native'
import { memo, useRef, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, radius, spacing, shadows } from '@/theme'

interface DockProps {
  activeTab: number
  onTabChange: (index: number) => void
  sidebarWidth?: number // Width of sidebar (if present) to offset dock centering
}

// Exact iOS dock icons
function POSIcon({ color }: { color: string }) {
  return <View style={[styles.icon, { backgroundColor: color }]} />
}

function ProductsIcon({ color }: { color: string }) {
  return (
    <View style={styles.gridIcon}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  )
}

function OrdersIcon({ color }: { color: string }) {
  return (
    <View style={styles.listIcon}>
      <View style={[styles.listLine, { backgroundColor: color }]} />
      <View style={[styles.listLine, { backgroundColor: color }]} />
      <View style={[styles.listLine, { backgroundColor: color }]} />
    </View>
  )
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <View style={styles.dotsIcon}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  )
}

const tabs = [
  { Icon: POSIcon, name: 'POS' },
  { Icon: ProductsIcon, name: 'Products' },
  { Icon: OrdersIcon, name: 'Orders' },
  { Icon: SettingsIcon, name: 'Settings' },
]

type IconComponent = (props: { color: string }) => React.JSX.Element

function DockButton({
  icon: Icon,
  name,
  isActive,
  isCenter,
  onPress
}: {
  icon: IconComponent
  name: string
  isActive: boolean
  isCenter: boolean
  onPress: () => void
}) {
  const color = isActive ? colors.text.primary : colors.text.quaternary

  return (
    <LiquidGlassView
      effect="regular"
      colorScheme="dark"
      interactive
      style={[
        styles.iconButton,
        isCenter && styles.centerIcon,
        isActive && styles.activeIcon,
        !isLiquidGlassSupported && (isActive ? styles.activeIconFallback : styles.iconButtonFallback)
      ]}
    >
      <Pressable
        onPress={onPress}
        style={styles.iconButtonInner}
        accessibilityRole="tab"
        accessibilityLabel={name}
        accessibilityState={{ selected: isActive }}
        accessibilityHint={`Navigate to ${name} screen`}
      >
        <Icon color={color} />
      </Pressable>
    </LiquidGlassView>
  )
}

function Dock({ activeTab, onTabChange, sidebarWidth = 0 }: DockProps) {
  const insets = useSafeAreaInsets()
  // Ensure sidebarWidth is always a valid number
  const validSidebarWidth = typeof sidebarWidth === 'number' && !isNaN(sidebarWidth) ? sidebarWidth : 0
  const leftPosition = useRef(new Animated.Value(validSidebarWidth)).current

  // Animate dock position when sidebarWidth changes
  useEffect(() => {
    const targetValue = typeof sidebarWidth === 'number' && !isNaN(sidebarWidth) ? sidebarWidth : 0
    Animated.spring(leftPosition, {
      toValue: targetValue,
      useNativeDriver: false, // Can't use native driver for layout properties
      tension: 80, // iOS-like spring tension
      friction: 12, // iOS-like spring friction
    }).start()
  }, [sidebarWidth, leftPosition])

  return (
    <Animated.View style={[
      styles.container,
      {
        bottom: insets.bottom + spacing.xs,
        left: leftPosition,
      }
    ]}>
      <LiquidGlassContainerView spacing={12} style={styles.glassContainer}>
        <LiquidGlassView
          style={[
            styles.dockWrapper,
            !isLiquidGlassSupported && styles.fallback,
          ]}
          effect="clear"
          colorScheme="dark"
        >
          {tabs.map((tab, index) => {
            const isActive = activeTab === index
            const isCenter = false // No center icon with 4 items

            return (
              <DockButton
                key={tab.name}
                icon={tab.Icon}
                name={tab.name}
                isActive={isActive}
                isCenter={isCenter}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onTabChange(index)
                }}
              />
            )
          })}
        </LiquidGlassView>
      </LiquidGlassContainerView>
    </Animated.View>
  )
}

const DockMemo = memo(Dock)
export { DockMemo as Dock }

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  glassContainer: {
    alignItems: 'center',
  },
  dockWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderRadius: 100,
    borderCurve: 'continuous',
    ...shadows.lg,
  },
  fallback: {
    backgroundColor: 'rgba(40,40,40,0.8)',
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 999,
    overflow: 'hidden',
  },
  iconButtonInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  centerIcon: {
    width: 60,
    height: 60,
  },
  activeIcon: {
    // Liquid glass provides the visual effect
  },
  activeIconFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Icon styles
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  gridIcon: {
    width: 28,
    height: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  dotsIcon: {
    flexDirection: 'row',
    gap: 5,
  },
  listIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    gap: 4,
  },
  listLine: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
  },
})
