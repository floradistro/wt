/**
 * Payment Types & Interfaces
 * Shared types for payment modal components
 */

export type PaymentStage =
  | 'initializing'
  | 'sending'
  | 'waiting'
  | 'processing'
  | 'approving'
  | 'success'
  | 'error'

export interface SplitPayment {
  method: 'cash' | 'card'
  amount: number
}

export interface PaymentData {
  paymentMethod: 'cash' | 'card' | 'split'
  cashTendered?: number
  changeGiven?: number
  authorizationCode?: string
  transactionId?: string
  cardType?: string
  cardLast4?: string
  splitPayments?: SplitPayment[]
}

export interface PaymentModalProps {
  visible: boolean
  total: number
  subtotal: number
  taxAmount: number
  taxRate: number
  taxName?: string
  loyaltyDiscountAmount?: number
  loyaltyPointsEarned?: number
  currentLoyaltyPoints?: number
  pointValue?: number
  maxRedeemablePoints?: number
  itemCount: number
  customerName?: string
  onApplyLoyaltyPoints?: (points: number) => void
  onPaymentComplete: (paymentData: PaymentData) => void
  onCancel: () => void
  hasPaymentProcessor?: boolean
  locationId?: string
  registerId?: string
}

export interface BasePaymentViewProps {
  total: number
  subtotal: number
  taxAmount: number
  taxRate: number
  taxName?: string
  itemCount: number
  onComplete: (paymentData: PaymentData) => void
}
