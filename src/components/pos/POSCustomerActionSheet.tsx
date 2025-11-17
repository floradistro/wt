import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Pressable } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect } from 'react'

interface POSCustomerActionSheetProps {
  visible: boolean
  onScanID: () => void
  onSelectFromList: () => void
  onWalkIn: () => void
  onClose: () => void
}

function POSCustomerActionSheet({
  visible,
  onScanID,
  onSelectFromList,
  onWalkIn,
  onClose,
}: POSCustomerActionSheetProps) {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(400)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 60,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      slideAnim.setValue(400)
      opacityAnim.setValue(0)
    }
  }, [visible])

  const handleAction = (action: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    action()
  }

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close customer selection"
          accessibilityHint="Double tap to dismiss this menu"
        >
          <BlurView intensity={60} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 24) + 16,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          accessible={false}
        >
          {/* Pull Handle */}
          <View style={styles.pullHandle} accessibilityElementsHidden={true} importantForAccessibility="no" />

          {/* Title */}
          <Text style={styles.title} accessibilityRole="header">Select Customer</Text>

          {/* iOS 26 Liquid Glass Action Pills */}
          <View style={styles.actionsContainer} accessible={false}>
            {/* Scan ID - Primary Action */}
            <TouchableOpacity
              onPress={() => handleAction(onScanID)}
              style={styles.actionPillPrimary}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Scan ID badge"
              accessibilityHint="Double tap to open camera for ID scanning. Fast and automatic customer verification."
            >
              <BlurView intensity={80} tint="systemThickMaterialDark" style={StyleSheet.absoluteFill} accessible={false} />
              <View style={styles.pillGradientPrimary} accessibilityElementsHidden={true} importantForAccessibility="no" />
              <Text style={styles.actionIconPrimary} accessibilityElementsHidden={true} importantForAccessibility="no">🪪</Text>
              <View style={styles.actionContent} accessible={false}>
                <Text style={styles.actionTitlePrimary}>Scan ID</Text>
                <Text style={styles.actionSubtitle}>Fast & automatic</Text>
              </View>
              <Text style={styles.actionChevron} accessibilityElementsHidden={true} importantForAccessibility="no">›</Text>
            </TouchableOpacity>

            {/* Select from List - Secondary Action */}
            <TouchableOpacity
              onPress={() => handleAction(onSelectFromList)}
              style={styles.actionPill}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Select from customer list"
              accessibilityHint="Double tap to search and select from existing customers"
            >
              <BlurView intensity={70} tint="systemMaterialDark" style={StyleSheet.absoluteFill} accessible={false} />
              <View style={styles.pillGradient} accessibilityElementsHidden={true} importantForAccessibility="no" />
              <Text style={styles.actionIcon} accessibilityElementsHidden={true} importantForAccessibility="no">👤</Text>
              <View style={styles.actionContent} accessible={false}>
                <Text style={styles.actionTitle}>Select from List</Text>
                <Text style={styles.actionSubtitle}>Search customers</Text>
              </View>
              <Text style={styles.actionChevron} accessibilityElementsHidden={true} importantForAccessibility="no">›</Text>
            </TouchableOpacity>

            {/* Walk-in - Tertiary Action */}
            <TouchableOpacity
              onPress={() => handleAction(onWalkIn)}
              style={styles.actionPill}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Walk-in customer"
              accessibilityHint="Double tap to continue without customer information"
            >
              <BlurView intensity={70} tint="systemMaterialDark" style={StyleSheet.absoluteFill} accessible={false} />
              <View style={styles.pillGradient} accessibilityElementsHidden={true} importantForAccessibility="no" />
              <Text style={styles.actionIcon} accessibilityElementsHidden={true} importantForAccessibility="no">🚶</Text>
              <View style={styles.actionContent} accessible={false}>
                <Text style={styles.actionTitle}>Walk-in Customer</Text>
                <Text style={styles.actionSubtitle}>No customer info</Text>
              </View>
              <Text style={styles.actionChevron} accessibilityElementsHidden={true} importantForAccessibility="no">›</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.cancelButton}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityHint="Double tap to close customer selection menu"
          >
            <BlurView intensity={50} tint="systemMaterialDark" style={StyleSheet.absoluteFill} accessible={false} />
            <View style={styles.cancelGradient} accessibilityElementsHidden={true} importantForAccessibility="no" />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const POSCustomerActionSheetMemo = memo(POSCustomerActionSheet)
export { POSCustomerActionSheetMemo as POSCustomerActionSheet }

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 16,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  pullHandle: {
    width: 48,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.5,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  // Primary Action Pill (Scan ID)
  actionPillPrimary: {
    height: 88,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  pillGradientPrimary: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(100,150,255,0.15)', // Blue tint for primary
    borderWidth: 1.5,
    borderColor: 'rgba(100,150,255,0.3)',
    borderRadius: 24,
  },
  actionIconPrimary: {
    fontSize: 32,
  },
  actionTitlePrimary: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.98)',
    letterSpacing: -0.3,
  },
  // Secondary/Tertiary Action Pills
  actionPill: {
    height: 76,
    borderRadius: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  pillGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
  },
  actionIcon: {
    fontSize: 28,
  },
  actionContent: {
    flex: 1,
    gap: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
  },
  actionChevron: {
    fontSize: 24,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
  },
  // Cancel Button
  cancelButton: {
    height: 56,
    borderRadius: 100, // Full pill
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  cancelGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: -0.2,
  },
})
