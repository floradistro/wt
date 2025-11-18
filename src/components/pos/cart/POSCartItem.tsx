import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useState, memo } from 'react'
import type { CartItem } from '@/types/pos'

interface POSCartItemProps {
  item: CartItem
  onAdd: () => void
  onRemove: () => void
  onOpenTierSelector?: () => void
  onApplyDiscount?: (type: 'percentage' | 'amount', value: number) => void
  onRemoveDiscount?: () => void
  isDiscounting?: boolean
  onStartDiscounting?: () => void
  onCancelDiscounting?: () => void
}

function POSCartItem({
  item,
  onAdd,
  onRemove,
  onOpenTierSelector,
  onApplyDiscount,
  onRemoveDiscount,
  isDiscounting,
  onStartDiscounting,
  onCancelDiscounting,
}: POSCartItemProps) {
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage')
  const [discountValue, setDiscountValue] = useState('')

  const handleApplyDiscount = () => {
    const value = parseFloat(discountValue)
    if (value > 0 && onApplyDiscount) {
      onApplyDiscount(discountType, value)
      setDiscountValue('')
    }
  }

  // Calculate display price (use adjusted price if available)
  const displayPrice = item.adjustedPrice !== undefined ? item.adjustedPrice : item.price
  const hasDiscount = item.manualDiscountValue && item.manualDiscountValue > 0

  return (
    <View>
      {/* iOS 26 Cart Item - Beautiful, spacious layout */}
      <View style={styles.cartItem}>
        {/* Left: Product Info (70% width) */}
        <View style={styles.cartItemInfo}>
          {/* Product Name - NEVER truncated */}
          <View style={styles.cartItemNameRow}>
            <Text style={styles.cartItemName} numberOfLines={2}>
              {item.productName || item.name}
            </Text>
            {item.tierLabel && (
              <TouchableOpacity
                onPress={() => {
                  if (onOpenTierSelector) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onOpenTierSelector()
                  }
                }}
                style={styles.tierBadge}
                disabled={!onOpenTierSelector}
                accessibilityRole="button"
                accessibilityLabel={`Change tier from ${item.tierLabel}`}
                accessibilityHint="Opens tier selection options"
                accessibilityState={{ disabled: !onOpenTierSelector }}
              >
                <Text style={styles.tierBadgeText}>{item.tierLabel}</Text>
                {onOpenTierSelector && <Text style={styles.tierBadgeChevron}>›</Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* Price Info Row */}
          <View style={styles.cartItemPriceRow}>
            {hasDiscount && item.originalPrice && (
              <Text style={styles.cartItemOriginalPrice}>${item.originalPrice.toFixed(2)}</Text>
            )}
            <Text style={[styles.cartItemPrice, hasDiscount ? styles.cartItemDiscountedPrice : undefined]}>
              ${displayPrice.toFixed(2)}
            </Text>
            <Text style={styles.cartItemPriceLabel}>each</Text>
          </View>

          {/* Staff Discount Badge */}
          {hasDiscount && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onRemoveDiscount?.()
              }}
              style={styles.discountAppliedBadge}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.manualDiscountType === 'percentage' ? `${item.manualDiscountValue}%` : `$${item.manualDiscountValue?.toFixed(2)}`} staff discount`}
              accessibilityHint="Tap to remove discount"
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

        {/* Right: Quantity Controls OR Tier Info + Total (30% width) */}
        <View style={styles.cartItemRight}>
          {!item.tierLabel ? (
            // Single-price product: Show -/+ controls
            <View style={styles.cartItemControls}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onRemove()
                }}
                style={styles.cartButton}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                accessibilityHint={`Remove one ${item.productName || item.name}`}
              >
                <Text style={styles.cartButtonText}>−</Text>
              </TouchableOpacity>

              <Text
                style={styles.cartItemQuantity}
                accessibilityLabel={`Quantity: ${item.quantity}`}
                accessibilityRole="text"
              >
                {item.quantity}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onAdd()
                }}
                style={styles.cartButton}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                accessibilityHint={`Add one more ${item.productName || item.name}`}
              >
                <Text style={styles.cartButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Tiered product: Show remove button only
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onRemove()
              }}
              style={styles.cartRemoveButton}
              accessibilityRole="button"
              accessibilityLabel="Remove item"
              accessibilityHint={`Remove ${item.productName || item.name} from cart`}
            >
              <Text style={styles.cartRemoveButtonText}>×</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.cartItemTotal}>${(displayPrice * item.quantity).toFixed(2)}</Text>
        </View>
      </View>

      {/* Staff Discount Link - Only show when NOT discounting and NO discount */}
      {!hasDiscount && !isDiscounting && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onStartDiscounting?.()
          }}
          style={styles.addDiscountLink}
          accessibilityRole="button"
          accessibilityLabel="Add staff discount"
          accessibilityHint="Opens discount input form"
        >
          <Text style={styles.addDiscountLinkText}>+ Add Staff Discount</Text>
        </TouchableOpacity>
      )}

      {/* JOBS PRINCIPLE: Discount input - minimal inline form */}
      {isDiscounting && (
        <View style={styles.discountInputContainer}>
          <View style={styles.discountTypeRow}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setDiscountType('percentage')
              }}
              style={[
                styles.discountTypeBtn,
                discountType === 'percentage' && styles.discountTypeBtnActive
              ]}
              accessibilityRole="button"
              accessibilityLabel="Percentage discount"
              accessibilityState={{ selected: discountType === 'percentage' }}
            >
              <Text style={[
                styles.discountTypeBtnText,
                discountType === 'percentage' && styles.discountTypeBtnTextActive
              ]}>%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setDiscountType('amount')
              }}
              style={[
                styles.discountTypeBtn,
                discountType === 'amount' && styles.discountTypeBtnActive
              ]}
              accessibilityRole="button"
              accessibilityLabel="Dollar amount discount"
              accessibilityState={{ selected: discountType === 'amount' }}
            >
              <Text style={[
                styles.discountTypeBtnText,
                discountType === 'amount' && styles.discountTypeBtnTextActive
              ]}>$</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.discountInput}
              placeholder={discountType === 'percentage' ? '10' : '5.00'}
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="numeric"
              value={discountValue}
              onChangeText={setDiscountValue}
              autoFocus
              accessibilityLabel="Discount amount"
              accessibilityHint={discountType === 'percentage' ? 'Enter percentage to discount' : 'Enter dollar amount to discount'}
              accessibilityRole="text"
            />
            <TouchableOpacity
              onPress={handleApplyDiscount}
              disabled={!discountValue || parseFloat(discountValue) <= 0}
              style={[
                styles.discountApplyBtn,
                (!discountValue || parseFloat(discountValue) <= 0) && styles.discountApplyBtnDisabled
              ]}
              accessibilityRole="button"
              accessibilityLabel="Apply discount"
              accessibilityHint="Confirm and apply this discount"
              accessibilityState={{ disabled: !discountValue || parseFloat(discountValue) <= 0 }}
            >
              <Text style={styles.discountApplyBtnText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onCancelDiscounting?.()
                setDiscountValue('')
              }}
              style={styles.discountCancelBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel discount"
              accessibilityHint="Close discount form without applying"
            >
              <Text style={styles.discountCancelBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const POSCartItemMemo = memo(POSCartItem)
export { POSCartItemMemo as POSCartItem }

const styles = StyleSheet.create({
  // iOS 26 Cart Item - Clean, spacious
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    minHeight: 60,
  },
  cartItemInfo: {
    flex: 1,
    gap: 4,
    maxWidth: '70%',
  },
  cartItemRight: {
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'space-between',
  },
  cartItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    flex: 1,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tierBadgeChevron: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    marginTop: -1,
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
  // Staff Discount UI
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
  addDiscountLink: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addDiscountLinkText: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
  },
  // iOS 26 Quantity Controls - Circular buttons
  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  cartButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.3,
    marginTop: -1,
  },
  cartItemQuantity: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    minWidth: 24,
    textAlign: 'center',
  },
  cartRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,60,60,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  cartRemoveButtonText: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(255,60,60,0.95)',
    letterSpacing: -0.3,
    marginTop: -1,
  },
  cartItemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    minWidth: 70,
    textAlign: 'right',
  },
  // iOS 26 Discount Input Form
  discountInputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  discountTypeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  discountTypeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountTypeBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  discountTypeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  discountTypeBtnTextActive: {
    color: 'rgba(255,255,255,0.95)',
  },
  discountInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0,
    borderRadius: 18,
  },
  discountApplyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountApplyBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.4,
  },
  discountApplyBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.4,
  },
  discountCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,60,60,0.15)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountCancelBtnText: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(255,60,60,0.95)',
    marginTop: -2,
  },
})
