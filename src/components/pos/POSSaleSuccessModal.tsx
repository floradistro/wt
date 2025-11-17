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
          >
            <View style={styles.checkmarkBg}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            </View>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>SALE COMPLETE</Text>

          {/* Order Number */}
          <View style={styles.orderNumberContainer}>
            <View style={styles.orderNumberBg}>
              <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
            </View>
            <Text style={styles.orderNumberLabel}>ORDER #</Text>
            <Text style={styles.orderNumber}>{String(saleData.orderNumber || 'Unknown')}</Text>
          </View>

          {/* Total Amount */}
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>${(saleData.total || 0).toFixed(2)}</Text>
          </View>

          {/* Transaction Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailsBg}>
              <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
            </View>

            {/* Payment Method */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons
                  name={saleData.paymentMethod === 'cash' ? 'cash-outline' : 'card-outline'}
                  size={18}
                  color="#34C759"
                />
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <Text style={styles.detailValue}>
                  {String(saleData.paymentMethod === 'cash' ? 'Cash' : 'Card')}
                  {saleData.cardType ? String(` - ${saleData.cardType}`) : ''}
                  {saleData.cardLast4 ? String(` ****${saleData.cardLast4}`) : ''}
                </Text>
              </View>
            </View>

            {/* Authorization Code (for card payments) */}
            {saleData.authorizationCode && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#34C759" />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Authorization Code</Text>
                  <Text style={styles.detailValue}>{String(saleData.authorizationCode || 'N/A')}</Text>
                </View>
              </View>
            )}

            {/* Processor Name (for card payments) */}
            {saleData.processorName && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="hardware-chip-outline" size={18} color="#34C759" />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Terminal</Text>
                  <Text style={styles.detailValue}>{String(saleData.processorName || 'Unknown')}</Text>
                </View>
              </View>
            )}

            {/* Transaction Number */}
            {saleData.transactionNumber && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="receipt-outline" size={18} color="#34C759" />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Transaction #</Text>
                  <Text style={styles.detailValue}>{String(saleData.transactionNumber || 'N/A')}</Text>
                </View>
              </View>
            )}

            {/* Items Count */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="cube-outline" size={18} color="#34C759" />
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Items</Text>
                <Text style={styles.detailValue}>{String(saleData.itemCount || 0)}</Text>
              </View>
            </View>

            {/* Inventory Status */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons
                  name={saleData.inventoryDeducted ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={18}
                  color={saleData.inventoryDeducted ? '#34C759' : '#FF9500'}
                />
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Inventory</Text>
                <Text style={styles.detailValue}>
                  {String(saleData.inventoryDeducted ? 'Deducted' : 'Pending')}
                </Text>
              </View>
            </View>

            {/* Loyalty Points Redeemed */}
            {saleData.loyaltyPointsRedeemed && saleData.loyaltyPointsRedeemed > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="gift-outline" size={18} color="#FF9500" />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Points Redeemed</Text>
                  <Text style={styles.detailValue}>{String(saleData.loyaltyPointsRedeemed)} pts</Text>
                </View>
              </View>
            )}

            {/* Loyalty Points Earned */}
            {saleData.loyaltyPointsAdded && saleData.loyaltyPointsAdded > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="star-outline" size={18} color="#FFD700" />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Points Earned</Text>
                  <Text style={styles.detailValue}>+{String(saleData.loyaltyPointsAdded)} pts</Text>
                </View>
              </View>
            )}
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.8}>
            <View style={styles.closeButtonBg}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            </View>
            <Text style={styles.closeButtonText}>DONE</Text>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1.2,
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
    letterSpacing: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  totalContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    letterSpacing: 1,
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
    letterSpacing: 0.2,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#34C759',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
})

export default memo(POSSaleSuccessModal)
