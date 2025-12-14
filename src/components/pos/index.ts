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
// CustomerMatch and PendingOrder types are now exported from @/stores/customer.store

// Customer Contact Info
export { POSMissingContactBanner } from './POSMissingContactBanner'
export { POSUpdateContactModal } from './POSUpdateContactModal'

// Unified Modal Component
export { POSModal } from './POSModal'

// Payment
export { default as POSPaymentModal } from './POSPaymentModal'
export { PaymentProcessorStatus } from './PaymentProcessorStatus'

// Products (Legacy - maintained for grid compatibility)
export { POSProductCard } from './POSProductCard'

// Orders
export { POSOrderCard } from './POSOrderCard'

// Swipeable Browser (Products + Orders)
export { POSSwipeableBrowser } from './POSSwipeableBrowser'

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

// Order Components
export * from './orders'
