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

interface POSCheckoutModalsProps {
  // Vendor & Session
  vendor: Vendor
  sessionInfo: SessionInfo

  // Modal visibility state
  isModalOpen: (id: any) => boolean
  closeModal: () => void

  // Customer selection
  scannedDataForNewCustomer: AAMVAData | null
  customerMatches: CustomerMatch[]
  selectedCustomer: Customer | null
  onCustomerSelected: (customer: Customer) => void
  onNoMatchFoundWithData: (data: AAMVAData) => void
  onOpenAddCustomer: () => void
  onOpenCustomerMatch: () => void
  onOpenCustomerSelector: () => void
  onClearScannedData: () => void
  onClearCustomerMatches: () => void
  onSetCustomerMatches: (matches: CustomerMatch[]) => void

  // Payment
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
  vendor,
  sessionInfo,
  isModalOpen,
  closeModal,
  scannedDataForNewCustomer,
  customerMatches,
  selectedCustomer,
  onCustomerSelected,
  onNoMatchFoundWithData,
  onOpenAddCustomer,
  onOpenCustomerMatch,
  onOpenCustomerSelector,
  onClearScannedData,
  onClearCustomerMatches,
  onSetCustomerMatches,
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

      {/* Unified Customer Selector */}
      <POSUnifiedCustomerSelector
        visible={isModalOpen('customerSelector')}
        vendorId={vendor.id}
        onCustomerSelected={(customer) => {
          onCustomerSelected(customer)
          closeModal()
        }}
        onNoMatchFoundWithData={onNoMatchFoundWithData}
        onAddCustomer={() => {
          closeModal()
          onOpenAddCustomer()
        }}
        onClose={closeModal}
      />

      {/* Customer Match Modal */}
      <POSCustomerMatchModal
        visible={isModalOpen('customerMatch')}
        scannedData={scannedDataForNewCustomer}
        matches={customerMatches}
        onSelectCustomer={(customer) => {
          onCustomerSelected(customer)
          onClearCustomerMatches()
          onClearScannedData()
          closeModal()
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }}
        onCreateNew={() => {
          onClearCustomerMatches()
          closeModal()
          onOpenAddCustomer()
        }}
        onSearchManually={() => {
          onClearCustomerMatches()
          onClearScannedData()
          closeModal()
          onOpenCustomerSelector()
        }}
        onClose={() => {
          onClearCustomerMatches()
          onClearScannedData()
          closeModal()
        }}
      />

      {/* Add Customer Modal */}
      <POSAddCustomerModal
        visible={isModalOpen('addCustomer')}
        vendorId={vendor.id}
        prefilledData={scannedDataForNewCustomer}
        onCustomerCreated={(customer) => {
          onCustomerSelected(customer)
          onClearScannedData()
          closeModal()
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }}
        onClose={() => {
          onClearScannedData()
          closeModal()
        }}
      />

      {/* Payment Modal - Always rendered */}
      <POSPaymentModal
        visible={isModalOpen('payment')}
        total={total}
        subtotal={subtotal}
        taxAmount={taxAmount}
        taxRate={taxRate}
        taxName={sessionInfo?.taxName}
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
        locationId={sessionInfo?.locationId}
        registerId={sessionInfo?.registerId}
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
