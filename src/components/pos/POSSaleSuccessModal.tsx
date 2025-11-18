import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'

const { width } = Dimensions.get('window')
const isTablet = width > 600

interface SaleSuccessData {
  orderNumber: string
  transactionNumber?: string
  total: number
  paymentMethod: string
  authorizationCode?: string
  cardType?: string
  cardLast4?: string
  itemCount: number
  processorName?: string
  inventoryDeducted?: boolean
  loyaltyPointsAdded?: number
  loyaltyPointsRedeemed?: number
}

interface POSSaleSuccessModalProps {
  visible: boolean
  saleData: SaleSuccessData | null
  onClose: () => void
}

function POSSaleSuccessModal({ visible, saleData, onClose }: POSSaleSuccessModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const checkmarkAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      // Trigger success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Animate modal entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start()

      // Animate checkmark with delay
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(checkmarkAnim, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      // Reset animations
      fadeAnim.setValue(0)
      scaleAnim.setValue(0.8)
      checkmarkAnim.setValue(0)
    }
  }, [visible])

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  if (!saleData) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClose}
      accessibilityViewIsModal={true}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View
          style={[
            styles.modalContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`Sale complete. Order ${saleData.orderNumber}. Total: ${saleData.total.toFixed(2)} dollars`}
          accessibilityLiveRegion="assertive"
          onAccessibilityEscape={handleClose}
        >
          {/* Glass morphism background */}
          <View style={styles.modalBg}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          </View>

          {/* Success checkmark */}
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkAnim }],
              },
            ]}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          >
            <View style={styles.checkmarkBg}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            </View>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
          </Animated.View>

          {/* Title */}
          <Text style={styles.title} accessibilityRole="header" accessible={false}>SALE COMPLETE</Text>

          {/* Order Number */}
          <View
            style={styles.orderNumberContainer}
            accessible={true}
            accessibilityLabel={`Order number ${saleData.orderNumber}`}
          >
            <View style={styles.orderNumberBg}>
              <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
            </View>
            <Text style={styles.orderNumberLabel} accessible={false}>ORDER #</Text>
            <Text style={styles.orderNumber} accessible={false}>{String(saleData.orderNumber || 'Unknown')}</Text>
          </View>

          {/* Total Amount */}
          <View
            style={styles.totalContainer}
            accessible={true}
            accessibilityRole="summary"
            accessibilityLabel={`Total: ${saleData.total.toFixed(2)} dollars`}
          >
            <Text style={styles.totalLabel} accessible={false}>TOTAL</Text>
            <Text style={styles.totalAmount} accessible={false}>${(saleData.total || 0).toFixed(2)}</Text>
          </View>

          {/* Transaction Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailsBg}>
              <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
            </View>

            {/* Payment Method */}
            <View
              style={styles.detailRow}
              accessible={true}
              accessibilityLabel={`Payment method: ${saleData.paymentMethod === 'cash' ? 'Cash' : 'Card'}${saleData.cardType ? ` ${saleData.cardType}` : ''}${saleData.cardLast4 ? ` ending in ${saleData.cardLast4}` : ''}`}
            >
              <View style={styles.detailIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                <Ionicons
                  name={saleData.paymentMethod === 'cash' ? 'cash-outline' : 'card-outline'}
                  size={18}
                  color="#34C759"
                />
              </View>
              <View style={styles.detailTextContainer} accessible={false}>
                <Text style={styles.detailLabel} accessible={false}>Payment Method</Text>
                <Text style={styles.detailValue} accessible={false}>
                  {String(saleData.paymentMethod === 'cash' ? 'Cash' : 'Card')}
                  {saleData.cardType ? String(` - ${saleData.cardType}`) : ''}
                  {saleData.cardLast4 ? String(` ****${saleData.cardLast4}`) : ''}
                </Text>
              </View>
            </View>

            {/* Authorization Code (for card payments) */}
            {saleData.authorizationCode && (
              <View
                style={styles.detailRow}
                accessible={true}
                accessibilityLabel={`Authorization code: ${saleData.authorizationCode}`}
              >
                <View style={styles.detailIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                  <Ionicons name="shield-checkmark-outline" size={18} color="#34C759" />
                </View>
                <View style={styles.detailTextContainer} accessible={false}>
                  <Text style={styles.detailLabel} accessible={false}>Authorization Code</Text>
                  <Text style={styles.detailValue} accessible={false}>{String(saleData.authorizationCode || 'N/A')}</Text>
                </View>
              </View>
            )}

            {/* Processor Name (for card payments) */}
            {saleData.processorName && (
              <View
                style={styles.detailRow}
                accessible={true}
                accessibilityLabel={`Terminal: ${saleData.processorName}`}
              >
                <View style={styles.detailIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                  <Ionicons name="hardware-chip-outline" size={18} color="#34C759" />
                </View>
                <View style={styles.detailTextContainer} accessible={false}>
                  <Text style={styles.detailLabel} accessible={false}>Terminal</Text>
                  <Text style={styles.detailValue} accessible={false}>{String(saleData.processorName || 'Unknown')}</Text>
                </View>
              </View>
            )}

            {/* Transaction Number */}
            {saleData.transactionNumber && (
              <View
                style={styles.detailRow}
                accessible={true}
                accessibilityLabel={`Transaction number: ${saleData.transactionNumber}`}
              >
                <View style={styles.detailIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                  <Ionicons name="receipt-outline" size={18} color="#34C759" />
                </View>
                <View style={styles.detailTextContainer} accessible={false}>
                  <Text style={styles.detailLabel} accessible={false}>Transaction #</Text>
                  <Text style={styles.detailValue} accessible={false}>{String(saleData.transactionNumber || 'N/A')}</Text>
                </View>
              </View>
            )}

            {/* Items Count */}
            <View
              style={styles.detailRow}
              accessible={true}
              accessibilityLabel={`${saleData.itemCount} ${saleData.itemCount === 1 ? 'item' : 'items'}`}
            >
              <View style={styles.detailIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                <Ionicons name="cube-outline" size={18} color="#34C759" />
              </View>
              <View style={styles.detailTextContainer} accessible={false}>
                <Text style={styles.detailLabel} accessible={false}>Items</Text>
                <Text style={styles.detailValue} accessible={false}>{String(saleData.itemCount || 0)}</Text>
              </View>
            </View>

            {/* Inventory Status */}
            <View
              style={styles.detailRow}
              accessible={true}
              accessibilityLabel={`Inventory: ${saleData.inventoryDeducted ? 'Deducted' : 'Pending'}`}
            >
              <View style={styles.detailIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                <Ionicons
                  name={saleData.inventoryDeducted ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={18}
                  color={saleData.inventoryDeducted ? '#34C759' : '#FF9500'}
                />
              </View>
              <View style={styles.detailTextContainer} accessible={false}>
                <Text style={styles.detailLabel} accessible={false}>Inventory</Text>
                <Text style={styles.detailValue} accessible={false}>
                  {String(saleData.inventoryDeducted ? 'Deducted' : 'Pending')}
                </Text>
              </View>
            </View>

            {/* Loyalty Points Redeemed */}
            {saleData.loyaltyPointsRedeemed && saleData.loyaltyPointsRedeemed > 0 && (
              <View
                style={styles.detailRow}
                accessible={true}
                accessibilityLabel={`Points redeemed: ${saleData.loyaltyPointsRedeemed} points`}
              >
                <View style={styles.detailIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                  <Ionicons name="gift-outline" size={18} color="#FF9500" />
                </View>
                <View style={styles.detailTextContainer} accessible={false}>
                  <Text style={styles.detailLabel} accessible={false}>Points Redeemed</Text>
                  <Text style={styles.detailValue} accessible={false}>{String(saleData.loyaltyPointsRedeemed)} pts</Text>
                </View>
              </View>
            )}

            {/* Loyalty Points Earned */}
            {saleData.loyaltyPointsAdded && saleData.loyaltyPointsAdded > 0 && (
              <View
                style={styles.detailRow}
                accessible={true}
                accessibilityLabel={`Points earned: ${saleData.loyaltyPointsAdded} points`}
              >
                <View style={styles.detailIconContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
                  <Ionicons name="star-outline" size={18} color="#FFD700" />
                </View>
                <View style={styles.detailTextContainer} accessible={false}>
                  <Text style={styles.detailLabel} accessible={false}>Points Earned</Text>
                  <Text style={styles.detailValue} accessible={false}>+{String(saleData.loyaltyPointsAdded)} pts</Text>
                </View>
              </View>
            )}
          </View>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Done"
            accessibilityHint="Double tap to close and return to POS"
          >
            <View style={styles.closeButtonBg}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            </View>
            <Text style={styles.closeButtonText} accessible={false}>DONE</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: isTablet ? 500 : '100%',
    maxWidth: 500,
    borderRadius: 24,
    padding: 28,
    overflow: 'hidden',
  },
  modalBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,25,0.85)',
  },
  checkmarkContainer: {
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 40,
    overflow: 'hidden',
  },
  checkmarkBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  orderNumberContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.3)',
  },
  orderNumberBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(52,199,89,0.1)',
  },
  orderNumberLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 4,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  orderNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  totalContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#34C759',
    letterSpacing: -1,
  },
  detailsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  detailsBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(52,199,89,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  closeButton: {
    paddingVertical: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.3)',
  },
  closeButtonBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(52,199,89,0.2)',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34C759',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})

export default memo(POSSaleSuccessModal)
