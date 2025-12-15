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
import type { Customer, Vendor, SessionInfo } from '@/types/pos'
import type { PaymentData, SaleCompletionData } from '@/components/pos/payment'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import type { CustomerMatch } from '@/hooks/pos/useCustomerSelection'

// POS Components
import { POSUnifiedCustomerSelector } from '../POSUnifiedCustomerSelector'
import { POSCustomerMatchModal } from '../POSCustomerMatchModal'
import POSPaymentModal from '../POSPaymentModal'
import { POSCashCountModal } from '../POSCashCountModal'
import { ErrorModal } from '@/components/ErrorModal'

// Context - Zero prop drilling!
import { useAppAuth } from '@/contexts/AppAuthContext'
import { usePOSSession } from '@/contexts/POSSessionContext'
import { useActiveModal, useModalData, checkoutUIActions } from '@/stores/checkout-ui.store'
import { useSelectedCustomer, useScannedDataForNewCustomer, useCustomerMatches } from '@/stores/customer.store'

interface POSCheckoutModalsProps {
  // Payment  - only coordination props needed
  onNoMatchFoundWithData: (data: AAMVAData) => void  // For customer matching logic
  total: number
  subtotal: number
  taxAmount: number
  taxRate: number
  itemCount: number
  onPaymentComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>

  // Session end
  sessionData: {
    sessionNumber: string
    totalSales: number
    totalCash: number
    openingCash: number
    totalCashDrops: number
    // Shift performance metrics
    shiftStart: Date | null
    transactionCount: number
    averageTransaction: number
    cardSales: number
    auditsCompleted: number
  } | null
  onCloseDrawerSubmit: (closingCash: number, notes: string) => void
  onCloseDrawerCancel: () => void
  onDropToSafe: () => void  // Opens cash drop modal from close drawer

  // Cash drop
  cashDropData: {
    drawerBalance: number
    safeBalance: number
  } | null
  onCashDropSubmit: (amount: number, notes: string) => void
  onCashDropCancel: () => void

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
  itemCount,
  onPaymentComplete,
  sessionData,
  onCloseDrawerSubmit,
  onCloseDrawerCancel,
  onDropToSafe,
  cashDropData,
  onCashDropSubmit,
  onCashDropCancel,
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
  const modalData = useModalData()
  const selectedCustomer = useSelectedCustomer()
  const scannedDataForNewCustomer = useScannedDataForNewCustomer()
  const customerMatches = useCustomerMatches()
  const isModalOpen = (id: string) => activeModal === id
  const closeModal = checkoutUIActions.closeModal

  // Check if we're in retry mode for payment modal
  const isRetryMode = modalData?.mode === 'retry'
  const retryTotal = isRetryMode ? modalData.amountRemaining : null

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
      {/* Also includes Create New Customer view */}
      <POSCustomerMatchModal />

      {/* Payment Modal - Always rendered, uses retry total in retry mode */}
      <POSPaymentModal
        visible={isModalOpen('payment')}
        total={isRetryMode ? retryTotal : total}
        subtotal={isRetryMode ? retryTotal : subtotal}
        taxAmount={isRetryMode ? 0 : taxAmount}
        taxRate={isRetryMode ? 0 : taxRate}
        taxName={apiConfig?.taxName}
        itemCount={isRetryMode ? 0 : itemCount}
        onPaymentComplete={onPaymentComplete}
        onCancel={closeModal}
        locationId={session?.locationId}
        registerId={session?.registerId}
      />

      {/* Close Cash Drawer Modal - Always rendered, visibility controlled by isModalOpen */}
      <POSCashCountModal
        visible={isModalOpen('cashDrawerClose') && !!sessionData}
        mode="close"
        totalSales={sessionData?.totalSales || 0}
        totalCashSales={sessionData?.totalCash || 0}
        openingCash={sessionData?.openingCash || 0}
        totalCashDrops={sessionData?.totalCashDrops || 0}
        expectedCash={(sessionData?.openingCash || 0) + (sessionData?.totalCash || 0) - (sessionData?.totalCashDrops || 0)}
        shiftPerformance={sessionData ? {
          shiftStart: sessionData.shiftStart,
          transactionCount: sessionData.transactionCount,
          averageTransaction: sessionData.averageTransaction,
          cardSales: sessionData.cardSales,
          auditsCompleted: sessionData.auditsCompleted,
          cashPercent: sessionData.totalSales > 0 ? Math.round((sessionData.totalCash / sessionData.totalSales) * 100) : 0,
          cardPercent: sessionData.totalSales > 0 ? Math.round((sessionData.cardSales / sessionData.totalSales) * 100) : 0,
        } : undefined}
        onSubmit={onCloseDrawerSubmit}
        onCancel={onCloseDrawerCancel}
        onDropToSafe={onDropToSafe}
      />

      {/* Cash Drop Modal - Move cash from drawer to safe */}
      <POSCashCountModal
        visible={isModalOpen('cashDrop') && !!cashDropData}
        mode="drop"
        currentDrawerBalance={cashDropData?.drawerBalance || 0}
        safeBalance={cashDropData?.safeBalance || 0}
        onSubmit={onCashDropSubmit}
        onCancel={onCashDropCancel}
      />
    </>
  )
}
