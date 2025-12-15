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
  | 'saving'      // Saving sale to database
  | 'complete'    // Sale completed successfully
  | 'error'

export interface SplitPayment {
  method: 'cash' | 'card'
  cardNumber?: 1 | 2        // For multi-card: which card (1 or 2)
  amount: number
  status?: 'pending' | 'processing' | 'success' | 'failed' | 'refunded'
  authorizationCode?: string
  transactionId?: string
  cardType?: string
  cardLast4?: string
  errorMessage?: string
}

export type PaymentMethod = 'cash' | 'card' | 'split' | 'multi-card'

export interface PaymentData {
  paymentMethod: PaymentMethod
  cashTendered?: number
  changeGiven?: number
  authorizationCode?: string
  transactionId?: string
  cardType?: string
  cardLast4?: string
  splitPayments?: SplitPayment[]
  // For partial payment recovery (retry Card 2 on failed split)
  orderId?: string           // Resume payment for existing order
  amountRemaining?: number   // How much still owed
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
 * PaymentModalProps - Payment modal props
 */
export interface PaymentModalProps {
  visible: boolean
  total: number
  subtotal: number
  taxAmount: number
  taxRate: number
  taxName?: string
  itemCount: number
  onPaymentComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>
  onCancel: () => void
  locationId?: string
  registerId?: string
}

/**
 * ❌ DELETED: BasePaymentViewProps
 *
 * Payment views now read ALL data from stores:
 * - total, subtotal → cart.store (useCartTotals)
 * - taxAmount, taxRate, taxName → tax.store (taxActions.calculateTax)
 * - itemCount → cart.store (useCartTotals)
 * - locationId → POSSessionContext (usePOSSession)
 * - currentProcessor, processorStatus → payment-processor.store (usePaymentProcessor)
 *
 * Only coordination callback remains:
 * - onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>
 *
 * This is TRUE ZERO PROP DRILLING ✅
 */
