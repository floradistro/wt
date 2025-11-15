// Barrel export for POS components - cleaner imports

// Session & Setup
export { CloseCashDrawerModal } from './CloseCashDrawerModal'
export { OpenCashDrawerModal } from './OpenCashDrawerModal'
export { POSLocationSelector } from './POSLocationSelector'
export { POSRegisterSelector } from './POSRegisterSelector'

// Customer & ID Scanning
export { POSCustomerSelector } from './POSCustomerSelector'
export { POSIDScannerModal } from './POSIDScannerModal'

// Payment
export { POSPaymentModal } from './POSPaymentModal'
export { PaymentProcessorStatus } from './PaymentProcessorStatus'

// Products (Legacy - use products/index.ts for new code)
export { POSProductCard } from './POSProductCard'

// Cart Components
export * from './cart'

// Product Components
export * from './products'

// Search Components
export * from './search'
