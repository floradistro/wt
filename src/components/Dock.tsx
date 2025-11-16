/**
 * Dock Component - Refactored with Design System
 * Apple-quality dock with Liquid Glass effect
 */

import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { memo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { colors, radius, spacing, shadows, borderWidth, LiquidGlass } from '@/theme'

interface DockProps {
  activeTab: number
  onTabChange: (index: number) => void
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

function ScanIcon({ color }: { color: string }) {
  return (
    <View style={styles.cameraIcon}>
      <View style={[styles.lens, { borderColor: color }]} />
      <View style={[styles.flash, { backgroundColor: color }]} />
    </View>
  )
}

function OrdersIcon({ color }: { color: string }) {
  return (
    <View style={styles.receiptIcon}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <View style={[styles.line, { backgroundColor: color }]} />
      <View style={[styles.line, { backgroundColor: color }]} />
    </View>
  )
}

function MoreIcon({ color }: { color: string }) {
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
  { Icon: ScanIcon, name: 'Scan' },
  { Icon: OrdersIcon, name: 'Orders' },
  { Icon: MoreIcon, name: 'More' },
]

function Dock({ activeTab, onTabChange }: DockProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { bottom: insets.bottom + spacing.xs }]}>
      {/* JOBS: Real liquid glass effect - depth, fluidity, elegance */}
      <LiquidGlass
        intensity="ultraThick"
        animate={false}
        style={styles.dockWrapper}
      >
        <View style={styles.iconsContainer}>
          {tabs.map((tab, index) => {
            const isActive = activeTab === index
            const isCenter = index === 2 // Scan is center
            const color = isActive ? colors.text.primary : colors.text.quaternary

            return (
              <TouchableOpacity
                key={tab.name}
                style={[
                  styles.iconButton,
                  isCenter && styles.centerIcon,
                  isActive && styles.activeIcon,
                ]}
                onPress={() => {
                  Haptics.impactAsync(
                    isCenter
                      ? Haptics.ImpactFeedbackStyle.Medium
                      : Haptics.ImpactFeedbackStyle.Light
                  )
                  onTabChange(index)
                }}
                activeOpacity={0.7}
              >
                <tab.Icon color={color} />
              </TouchableOpacity>
            )
          })}
        </View>
      </LiquidGlass>
    </View>
  )
}

const DockMemo = memo(Dock)
export { DockMemo as Dock }

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  dockWrapper: {
    borderRadius: radius.pill, // Pill shaped - Jobs: Like iOS dock
    borderWidth: borderWidth.regular,
    borderColor: colors.border.regular,
    ...shadows.lg, // Proper elevation
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxs + 2, // 6px
    paddingVertical: spacing.xxs + 2,
    gap: spacing.xxs,
  },
  iconButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round, // Round icons - Jobs: Perfect circles
  },
  centerIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.round, // Round center icon
  },
  activeIcon: {
    backgroundColor: colors.glass.thick, // Match active state in selectors
  },

  // Icon styles
  icon: {
    width: 28,
    height: 28,
    borderRadius: radius.xs + 2,
  },
  gridIcon: {
    width: 28,
    height: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxs,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  cameraIcon: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lens: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
  },
  flash: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 0,
    right: 2,
  },
  receiptIcon: {
    gap: spacing.xxs,
  },
  line: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
  },
  dotsIcon: {
    flexDirection: 'row',
    gap: 5,
  },
})
