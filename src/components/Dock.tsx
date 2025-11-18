/**
 * Dock Component - Apple Liquid Glass Effect
 * Using @callstack/liquid-glass for real iOS 26+ liquid glass
 * With working touch handling and smooth position animations
 */

import { View, Pressable, StyleSheet } from 'react-native'
import { memo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, shadows } from '@/theme'

interface DockProps {
  activeTab: number
  onTabChange: (index: number) => void
  centerX: number // X position for the center of the dock
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

function CustomersIcon({ color }: { color: string }) {
  return (
    <View style={styles.userIcon}>
      <View style={[styles.userIconCircle, { borderColor: color }]}>
        <View style={[styles.userIconHead, { backgroundColor: color }]} />
      </View>
      <View style={[styles.userIconBody, { borderColor: color }]} />
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
  { Icon: CustomersIcon, name: 'Customers' },
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

function Dock({ activeTab, onTabChange, centerX }: DockProps) {
  const insets = useSafeAreaInsets()

  // Dynamic dock width calculation based on actual number of icons
  const numIcons = tabs.length
  const iconWidth = 56
  const dockWidth = (numIcons * iconWidth) + ((numIcons - 1) * spacing.xs) + (2 * spacing.md)

  return (
    <View style={[
      styles.container,
      {
        bottom: insets.bottom + spacing.xs,
        left: centerX - (dockWidth / 2), // Position so dock is centered at centerX
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
    </View>
  )
}

const DockMemo = memo(Dock)
export { DockMemo as Dock }

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
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
  userIcon: {
    width: 28,
    height: 28,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 5,
  },
  userIconBody: {
    width: 16,
    height: 12,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    position: 'absolute',
    bottom: 2,
  },
})
