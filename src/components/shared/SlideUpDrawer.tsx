/**
 * SlideUpDrawer - Reusable slide-up modal
 * Apple Engineering: Same component used throughout the app
 * Used for: Pricing tiers, filters, options, etc.
 */

import { useRef, useEffect, type ReactNode } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

interface SlideUpDrawerProps {
  visible: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SlideUpDrawer({ visible, onClose, title, children }: SlideUpDrawerProps) {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(600)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      // Slide up
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      // Slide down
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 600,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        {/* Tap outside to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        {/* Drawer Sheet */}
        <Animated.View
          style={[
            styles.drawerBorder,
            {
              marginLeft: insets.left,
              marginRight: insets.right,
              marginBottom: 0,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.drawerContent}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

            {/* Pull Handle */}
            <View style={styles.pullHandle} />

            {/* Title */}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>

            {/* Content */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerBorder: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 0,
  },
  drawerContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 40,
    minHeight: '60%',
    maxHeight: '90%',
  },
  pullHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    paddingHorizontal: 20,
    letterSpacing: -0.4,
  },
  scrollView: {
    flexGrow: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
})
