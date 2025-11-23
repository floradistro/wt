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
  | 'saving'      // NEW: Saving sale to database
  | 'complete'    // NEW: Sale completed successfully
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

// NEW: Sale completion data (shown after save completes)
export interface SaleCompletionData {
  orderNumber: string
  transactionNumber?: string
  total: number
  paymentMethod: string
  authorizationCode?: string
  cardType?: string
  cardLast4?: string
  itemCount: number
  processorName?: string
  changeGiven?: number
  loyaltyPointsAdded?: number
  loyaltyPointsRedeemed?: number
}

/**
 * PaymentModalProps - Apple Engineering Standard ✅
 * ZERO DATA PROPS - Only callbacks and UI state
 * Modal reads all data from stores
 */
export interface PaymentModalProps {
  visible: boolean  // ✅ UI state
  onPaymentComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>  // ✅ Callback
  onCancel: () => void  // ✅ Callback

  // All data props REMOVED - read from stores:
  // - total, subtotal, taxAmount, taxRate, taxName → tax.store + cart.store
  // - loyaltyDiscountAmount, loyaltyPointsEarned, etc → loyalty.store
  // - itemCount → cart.store
  // - customerName → customer.store
  // - hasPaymentProcessor → payment-processor.store
  // - locationId, registerId → posSession.store
}

/**
 * ❌ DELETED: BasePaymentViewProps
 *
 * Payment views now read ALL data from stores:
 * - total, subtotal → cart.store (useCartTotals)
 * - taxAmount, taxRate, taxName → tax.store (taxActions.calculateTax)
 * - itemCount → cart.store (useCartTotals)
 * - locationId → posSession.store (usePOSSession)
 * - currentProcessor, processorStatus → payment-processor.store (usePaymentProcessor)
 *
 * Only coordination callback remains:
 * - onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>
 *
 * This is TRUE ZERO PROP DRILLING ✅
 */
