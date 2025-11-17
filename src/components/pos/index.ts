// Barrel export for POS components - cleaner imports

// Session & Setup
export { CloseCashDrawerModal } from './CloseCashDrawerModal'
export { OpenCashDrawerModal } from './OpenCashDrawerModal'
export { POSLocationSelector } from './POSLocationSelector'
export { POSRegisterSelector } from './POSRegisterSelector'

// Customer & ID Scanning
export { POSUnifiedCustomerSelector } from './POSUnifiedCustomerSelector'
export { POSAddCustomerModal } from './POSAddCustomerModal'
export { POSCustomerMatchModal } from './POSCustomerMatchModal'
export type { CustomerMatch, MatchConfidence } from './POSCustomerMatchModal'

// Unified Modal Component
export { POSModal } from './POSModal'

// Payment
export { default as POSPaymentModal } from './POSPaymentModal'
export { PaymentProcessorStatus } from './PaymentProcessorStatus'
export { default as POSSaleSuccessModal } from './POSSaleSuccessModal'

// Products (Legacy - maintained for grid compatibility)
export { POSProductCard } from './POSProductCard'

// Cart Components
export * from './cart'

// Product Components
export * from './products'

// Search Components
export * from './search'

// Session Components
export * from './session'

// Checkout Components
export * from './checkout'
