/**
 * POSCheckoutModals Component
 * Jobs Principle: Manage all modal interactions for checkout
 *
 * Extracted from POSCheckout to improve maintainability
 * Handles:
 * - Customer selector modal
 * - Customer match modal
 * - Add customer modal
 * - Payment modal
 * - Close cash drawer modal
 * - Error modal
 */

import * as Haptics from 'expo-haptics'
import { logger } from '@/utils/logger'
import type { Customer, Vendor, SessionInfo, LoyaltyProgram } from '@/types/pos'
import type { PaymentData, SaleCompletionData } from '@/components/pos/payment'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import type { CustomerMatch } from '@/hooks/pos/useCustomerSelection'

// POS Components
import { POSUnifiedCustomerSelector } from '../POSUnifiedCustomerSelector'
import { POSAddCustomerModal } from '../POSAddCustomerModal'
import { POSCustomerMatchModal } from '../POSCustomerMatchModal'
import POSPaymentModal from '../POSPaymentModal'
import { CloseCashDrawerModal } from '../CloseCashDrawerModal'
import { ErrorModal } from '@/components/ErrorModal'

// Context - Zero prop drilling!
import { useAppAuth } from '@/contexts/AppAuthContext'
import { usePOSSession } from '@/contexts/POSSessionContext'
import { useActiveModal, checkoutUIActions } from '@/stores/checkout-ui.store'
import { useSelectedCustomer, useScannedDataForNewCustomer, useCustomerMatches } from '@/stores/customer.store'

interface POSCheckoutModalsProps {
  // Payment  - only coordination props needed
  onNoMatchFoundWithData: (data: AAMVAData) => void  // For customer matching logic
  total: number
  subtotal: number
  taxAmount: number
  taxRate: number
  loyaltyDiscountAmount: number
  loyaltyPointsEarned: number
  itemCount: number
  loyaltyProgram: LoyaltyProgram | null
  getMaxRedeemablePoints: (subtotal: number) => number
  onPaymentComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>
  onApplyLoyaltyPoints: (points: number) => void

  // Session end
  sessionData: {
    sessionNumber: string
    totalSales: number
    totalCash: number
    openingCash: number
  } | null
  onCloseDrawerSubmit: (closingCash: number, notes: string) => void
  onCloseDrawerCancel: () => void

  // Error modal
  errorModal: {
    visible: boolean
    title: string
    message: string
  }
  onCloseErrorModal: () => void
}

export function POSCheckoutModals({
  onNoMatchFoundWithData,
  total,
  subtotal,
  taxAmount,
  taxRate,
  loyaltyDiscountAmount,
  loyaltyPointsEarned,
  itemCount,
  loyaltyProgram,
  getMaxRedeemablePoints,
  onPaymentComplete,
  onApplyLoyaltyPoints,
  sessionData,
  onCloseDrawerSubmit,
  onCloseDrawerCancel,
  errorModal,
  onCloseErrorModal,
}: POSCheckoutModalsProps) {
  // ========================================
  // CONTEXT - Zero prop drilling!
  // ========================================
  const { vendor } = useAppAuth()
  const { session, apiConfig } = usePOSSession()

  // ========================================
  // STORES - Customer state (TRUE ZERO PROPS)
  // ========================================
  const activeModal = useActiveModal()
  const selectedCustomer = useSelectedCustomer()
  const scannedDataForNewCustomer = useScannedDataForNewCustomer()
  const customerMatches = useCustomerMatches()
  const isModalOpen = (id: string) => activeModal === id
  const closeModal = checkoutUIActions.closeModal

  // Guard: Ensure session data exists
  if (!vendor || !session) {
    return null
  }

  return (
    <>
      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        onPrimaryPress={onCloseErrorModal}
        variant="error"
      />

      {/* Unified Customer Selector - ZERO PROPS (reads from stores) */}
      <POSUnifiedCustomerSelector />

      {/* Customer Match Modal - ZERO PROPS (reads from stores) */}
      <POSCustomerMatchModal />

      {/* Add Customer Modal - ZERO PROPS (reads from stores) */}
      <POSAddCustomerModal />

      {/* Payment Modal - Always rendered */}
      <POSPaymentModal
        visible={isModalOpen('payment')}
        total={total}
        subtotal={subtotal}
        taxAmount={taxAmount}
        taxRate={taxRate}
        taxName={apiConfig?.taxName}
        loyaltyDiscountAmount={loyaltyDiscountAmount}
        loyaltyPointsEarned={loyaltyPointsEarned}
        currentLoyaltyPoints={selectedCustomer?.loyalty_points || 0}
        pointValue={loyaltyProgram?.point_value || 0.01}
        maxRedeemablePoints={getMaxRedeemablePoints(subtotal)}
        itemCount={itemCount}
        customerName={
          selectedCustomer
            ? selectedCustomer.display_name ||
              `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim() ||
              selectedCustomer.email
            : undefined
        }
        onApplyLoyaltyPoints={onApplyLoyaltyPoints}
        onPaymentComplete={onPaymentComplete}
        onCancel={closeModal}
        hasPaymentProcessor={true}
        locationId={session?.locationId}
        registerId={session?.registerId}
      />

      {/* Close Cash Drawer Modal - Always rendered, visibility controlled by isModalOpen */}
      <CloseCashDrawerModal
        visible={isModalOpen('cashDrawerClose') && !!sessionData}
        sessionNumber={sessionData?.sessionNumber || ''}
        totalSales={sessionData?.totalSales || 0}
        totalCash={sessionData?.totalCash || 0}
        openingCash={sessionData?.openingCash || 0}
        onSubmit={onCloseDrawerSubmit}
        onCancel={onCloseDrawerCancel}
      />
    </>
  )
}
