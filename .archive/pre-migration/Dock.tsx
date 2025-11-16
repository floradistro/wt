import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { memo } from 'react'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

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
  const _insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { bottom: 8 }]}>
      {/* JOBS: Fixed bottom position for consistent dock placement */}
      <View style={styles.dockWrapper}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={25} tint="dark" style={styles.blur} />
        ) : (
          <View style={styles.androidBg} />
        )}

        <View style={styles.iconsContainer}>
          {tabs.map((tab, index) => {
            const isActive = activeTab === index
            const isCenter = index === 2
            const color = isActive ? '#fff' : 'rgba(255,255,255,0.6)'

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
      </View>
    </View>
  )
}

const DockMemo = memo(Dock)
export { DockMemo as Dock }

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // bottom position set dynamically with insets
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  dockWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  androidBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6, // JOBS: Reduced to match tighter spacing
    paddingVertical: 6, // JOBS: Reduced to match tighter spacing
    gap: 4,
  },
  iconButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  centerIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
  },
  activeIcon: {
    backgroundColor: 'rgba(255,255,255,0.18)',
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
    gap: 4,
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
