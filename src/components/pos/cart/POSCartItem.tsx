import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, PanResponder, LayoutAnimation, Platform, UIManager } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useState, memo, useCallback, useRef, useEffect } from 'react'
import type { CartItem } from '@/types/pos'

// ✅ ZERO PROP DRILLING - Read from stores
import { cartActions, useDiscountingItemId } from '@/stores/cart.store'
import { checkoutUIActions } from '@/stores/checkout-ui.store'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const DELETE_WIDTH = 80
const SWIPE_THRESHOLD = 25 // How far to swipe before it triggers (lower = easier)

interface POSCartItemProps {
  item: CartItem  // ✅ ONLY visual data - no callbacks, no state
}

function POSCartItem({ item }: POSCartItemProps) {
  // ✅ ZERO PROP DRILLING: Read discounting state from store
  const discountingItemId = useDiscountingItemId()
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage')
  const [discountValue, setDiscountValue] = useState('')

  // Swipe state
  const [isOpen, setIsOpen] = useState(false)
  const translateX = useRef(new Animated.Value(0)).current

  // ✅ ZERO PROP DRILLING: Derived state from store
  const isDiscounting = discountingItemId === item.id

  const handleApplyDiscount = () => {
    const value = parseFloat(discountValue)
    if (value > 0) {
      cartActions.applyManualDiscount(item.id, discountType, value)
      setDiscountValue('')
    }
  }

  // Calculate display price (use adjusted price if available)
  const displayPrice = item.adjustedPrice !== undefined ? item.adjustedPrice : item.price
  const hasDiscount = item.manualDiscountValue && item.manualDiscountValue > 0

  const handleItemPress = () => {
    if (isOpen) {
      // Close if open
      closeSwipe()
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    checkoutUIActions.setTierSelectorProductId(item.productId)
  }

  const handleLongPress = useCallback(() => {
    if (isOpen) return
    if (!hasDiscount) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      cartActions.setDiscountingItemId(item.id)
    }
  }, [hasDiscount, item.id, isOpen])

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    // Animate out
    Animated.timing(translateX, {
      toValue: -300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      cartActions.removeItem(item.id)
    })
  }, [item.id, translateX])

  const openSwipe = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -DELETE_WIDTH,
      friction: 10,
      tension: 100,
      useNativeDriver: true,
    }).start()
    setIsOpen(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [translateX])

  const closeSwipe = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      friction: 10,
      tension: 100,
      useNativeDriver: true,
    }).start()
    setIsOpen(false)
  }, [translateX])

  // Pan responder - captures horizontal swipes and blocks vertical scroll
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Capture ANY horizontal movement early - blocks scroll immediately
        const isHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy)
        return isHorizontal && Math.abs(gesture.dx) > 5
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        // CAPTURE immediately if horizontal - this BLOCKS ScrollView
        const isHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy)
        return isHorizontal && Math.abs(gesture.dx) > 5
      },
      onPanResponderTerminationRequest: () => false, // Don't let ScrollView steal the gesture
      onPanResponderMove: (_, gesture) => {
        // Only allow swiping left (negative dx)
        if (gesture.dx < 0) {
          // Clamp to DELETE_WIDTH
          const newX = Math.max(-DELETE_WIDTH, gesture.dx)
          translateX.setValue(newX)
        } else if (isOpen) {
          // If already open, allow swiping right to close
          const newX = Math.min(0, -DELETE_WIDTH + gesture.dx)
          translateX.setValue(newX)
        }
      },
      onPanResponderRelease: (_, gesture) => {
        // Decide whether to open or close based on velocity and position
        // Lower velocity threshold (0.3) = easier to trigger with slower swipes
        if (gesture.vx < -0.3 || gesture.dx < -SWIPE_THRESHOLD) {
          // Swipe left or past threshold - open
          openSwipe()
        } else if (gesture.vx > 0.3 || gesture.dx > SWIPE_THRESHOLD) {
          // Swipe right or past threshold - close
          closeSwipe()
        } else if (isOpen) {
          // Already open and didn't swipe enough - stay open
          openSwipe()
        } else {
          // Not open and didn't swipe enough - close
          closeSwipe()
        }
      },
      onPanResponderTerminate: () => {
        // If gesture is interrupted, snap to nearest state
        if (isOpen) {
          openSwipe()
        } else {
          closeSwipe()
        }
      },
    })
  ).current

  return (
    <View style={styles.container}>
      {/* Swipe row wrapper - contains both delete zone and swipeable row */}
      <View style={styles.swipeWrapper}>
        {/* Delete button - sits behind the row */}
        <View style={styles.deleteContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.productName || item.name} from cart`}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Swipeable row */}
        <Animated.View
          style={[styles.rowContainer, { transform: [{ translateX }] }]}
          {...panResponder.panHandlers}
        >
        <TouchableOpacity
          style={styles.cartItemContainer}
          onPress={handleItemPress}
          onLongPress={handleLongPress}
          delayLongPress={400}
          activeOpacity={0.7}
          disabled={isDiscounting}
          accessibilityRole="button"
          accessibilityLabel={`${item.productName || item.name}, ${item.tierLabel || `quantity ${item.quantity}`}, ${displayPrice.toFixed(2)} dollars each, total ${(displayPrice * item.quantity).toFixed(2)} dollars${hasDiscount ? ', discounted' : ''}`}
          accessibilityHint="Tap to change quantity. Long press to add discount. Swipe left to delete."
        >
          {/* Left: Product Info */}
          <View style={styles.cartItemInfo}>
            <Text style={styles.cartItemName} numberOfLines={2}>
              {item.productName || item.name}
            </Text>

            <View style={styles.cartItemPriceRow}>
              {hasDiscount && item.originalPrice && (
                <Text style={styles.cartItemOriginalPrice}>${item.originalPrice.toFixed(2)}</Text>
              )}
              <Text style={[styles.cartItemPrice, hasDiscount ? styles.cartItemDiscountedPrice : undefined]}>
                ${displayPrice.toFixed(2)}
              </Text>
              <Text style={styles.cartItemPriceLabel}>each</Text>
            </View>

            {hasDiscount && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  cartActions.removeManualDiscount(item.id)
                }}
                style={styles.discountAppliedBadge}
              >
                <Text style={styles.discountAppliedText}>
                  {item.manualDiscountType === 'percentage'
                    ? `${item.manualDiscountValue}% Off`
                    : `$${item.manualDiscountValue?.toFixed(2)} Off`}
                </Text>
                <Text style={styles.discountRemoveIcon}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Right: Tier/Quantity + Total */}
          <View style={styles.cartItemRight}>
            <Text style={styles.cartItemQuantity}>
              {item.tierLabel || `×${item.quantity}`}
            </Text>
            <Text style={styles.cartItemTotal}>${(displayPrice * item.quantity).toFixed(2)}</Text>
          </View>
        </TouchableOpacity>

        {/* Discount input - expands inside product row */}
        {isDiscounting && (
          <View style={styles.discountSection}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setDiscountType(discountType === 'percentage' ? 'amount' : 'percentage')
              }}
              style={styles.discountTypeToggle}
              activeOpacity={0.7}
            >
              <Text style={styles.discountTypeText}>
                {discountType === 'percentage' ? '%' : '$'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.discountInput}
              placeholder={discountType === 'percentage' ? '10' : '5.00'}
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              value={discountValue}
              onChangeText={setDiscountValue}
              autoFocus
              accessibilityLabel={`Discount ${discountType === 'percentage' ? 'percentage' : 'amount'}`}
              accessibilityHint={`Enter ${discountType === 'percentage' ? 'percentage off' : 'dollar amount off'}`}
            />
            {/* Single button: Cancel when empty, Apply when has value */}
            {(!discountValue || parseFloat(discountValue) <= 0) ? (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                  cartActions.setDiscountingItemId(null)
                  setDiscountValue('')
                }}
                style={styles.discountCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.discountCancelText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                  handleApplyDiscount()
                }}
                style={styles.discountApplyBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.discountApplyText}>Apply</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        </Animated.View>
      </View>
    </View>
  )
}

const POSCartItemMemo = memo(POSCartItem)
export { POSCartItemMemo as POSCartItem }

const styles = StyleSheet.create({
  container: {
    marginBottom: 6, // Spacing between items
  },
  // Wrapper for swipe area - clips the delete button
  swipeWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  // Delete button container - only on right, hidden until swiped
  deleteContainer: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 8,
    width: DELETE_WIDTH - 16, // Account for padding
    backgroundColor: '#ef4444',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Row that slides to reveal delete - needs solid background to cover delete zone
  rowContainer: {
    backgroundColor: '#000', // Solid black to fully cover delete button
    borderRadius: 16, // Rounded corners
  },
  cartItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 60,
  },
  cartItemInfo: {
    flex: 1,
    gap: 4,
    maxWidth: '70%',
  },
  cartItemRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  cartItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartItemOriginalPrice: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
  },
  cartItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: -0.1,
  },
  cartItemDiscountedPrice: {
    color: '#10b981',
    fontWeight: '600',
  },
  cartItemPriceLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  discountAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    alignSelf: 'flex-start',
  },
  discountAppliedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  discountRemoveIcon: {
    fontSize: 14,
    fontWeight: '300',
    color: '#10b981',
  },
  cartItemQuantity: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  cartItemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    minWidth: 70,
    textAlign: 'right',
  },
  // Discount section - expands inside product row with animation
  discountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  discountTypeToggle: {
    width: 44,
    height: 44,
    borderRadius: 22, // Pill
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountTypeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  discountInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22, // Pill
    paddingHorizontal: 14,
    textAlign: 'center',
  },
  discountCancelBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22, // Pill
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
  },
  discountCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  discountApplyBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22, // Pill
    backgroundColor: '#10b981',
    justifyContent: 'center',
  },
  discountApplyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
})
