import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import type { CartItem } from '@/types/pos'

interface POSCartItemProps {
  item: CartItem
  onAdd: () => void
  onRemove: () => void
  onApplyDiscount?: (type: 'percentage' | 'amount', value: number) => void
  onRemoveDiscount?: () => void
  isDiscounting?: boolean
  onStartDiscounting?: () => void
  onCancelDiscounting?: () => void
}

export function POSCartItem({
  item,
  onAdd,
  onRemove,
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
      {/* JOBS PRINCIPLE: Clean cart item row */}
      <View style={styles.cartItem}>
        <View style={styles.cartItemInfo}>
          <View style={styles.cartItemNameRow}>
            <Text style={styles.cartItemName} numberOfLines={1}>
              {item.productName || item.name}
            </Text>
            {item.tierLabel && (
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{item.tierLabel}</Text>
              </View>
            )}
          </View>
          <View style={styles.cartItemPriceRow}>
            {hasDiscount && item.originalPrice && (
              <Text style={styles.cartItemOriginalPrice}>${item.originalPrice.toFixed(2)}</Text>
            )}
            <Text style={[styles.cartItemPrice, hasDiscount ? styles.cartItemDiscountedPrice : undefined]}>
              ${displayPrice.toFixed(2)}
            </Text>
            <Text style={styles.cartItemPriceLabel}> each</Text>
          </View>

          {/* JOBS PRINCIPLE: Staff discount - inline, minimal */}
          {hasDiscount ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onRemoveDiscount?.()
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
          ) : !isDiscounting ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onStartDiscounting?.()
              }}
              style={styles.addDiscountLink}
            >
              <Text style={styles.addDiscountLinkText}>+ Staff Discount</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.cartItemControls}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onRemove()
            }}
            style={styles.cartButton}
          >
            <Text style={styles.cartButtonText}>−</Text>
          </TouchableOpacity>

          <Text style={styles.cartItemQuantity}>{item.quantity}</Text>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onAdd()
            }}
            style={styles.cartButton}
          >
            <Text style={styles.cartButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cartItemTotal}>${(displayPrice * item.quantity).toFixed(2)}</Text>
      </View>

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
            />
            <TouchableOpacity
              onPress={handleApplyDiscount}
              disabled={!discountValue || parseFloat(discountValue) <= 0}
              style={[
                styles.discountApplyBtn,
                (!discountValue || parseFloat(discountValue) <= 0) && styles.discountApplyBtnDisabled
              ]}
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
            >
              <Text style={styles.discountCancelBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  cartItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cartItemInfo: {
    flex: 1,
    gap: 6,
  },
  cartItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.2,
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  cartItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cartItemOriginalPrice: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
  },
  cartItemPrice: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
  },
  cartItemDiscountedPrice: {
    color: '#10b981',
    fontWeight: '500',
  },
  cartItemPriceLabel: {
    fontSize: 10,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
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
    fontSize: 10,
    fontWeight: '500',
    color: '#10b981',
    letterSpacing: 0.3,
  },
  discountRemoveIcon: {
    fontSize: 14,
    fontWeight: '300',
    color: '#10b981',
  },
  addDiscountLink: {
    alignSelf: 'flex-start',
  },
  addDiscountLinkText: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.3,
  },
  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cartButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.9)',
  },
  cartItemQuantity: {
    fontSize: 13,
    fontWeight: '400',
    color: '#fff',
    minWidth: 20,
    textAlign: 'center',
  },
  cartItemTotal: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    minWidth: 60,
    textAlign: 'right',
  },
  // Discount Input Form
  discountInputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  discountTypeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  discountTypeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountTypeBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  discountTypeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  discountTypeBtnTextActive: {
    color: 'rgba(255,255,255,0.95)',
  },
  discountInput: {
    flex: 1,
    height: 32,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '400',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  discountApplyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountApplyBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    opacity: 0.4,
  },
  discountApplyBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10b981',
  },
  discountCancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountCancelBtnText: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
  },
})
