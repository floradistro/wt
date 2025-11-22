# Zero Prop Drilling Plan - POS Architecture
**Goal:** Eliminate ALL prop drilling in POS while maintaining Context for auth/session

---

## 🎯 Architecture Decision

### **Keep Context For:**
- ✅ **AppAuthContext** - User authentication, vendor, locations
- ✅ **POSSessionContext** - Active session, register, API config

### **Move Everything Else to Zustand:**
All component state, UI state, business logic → Global stores

---

## 📊 Current State Analysis

### **POSCart Component (12 props currently)**
```typescript
interface POSCartProps {
  // 🔴 Customer state (3 props) → Move to customer.store
  selectedCustomer: Customer | null

  // 🔴 Loyalty state (4 props) → Move to loyalty.store
  loyaltyPointsToRedeem: number
  loyaltyProgram: LoyaltyProgram | null
  loyaltyDiscountAmount: number
  maxRedeemablePoints: number

  // 🔴 Products (1 prop) → Move to products.store
  products: Product[]

  // 🔴 Orchestration callbacks (4 props) → Replace with store actions
  onSelectCustomer: () => void         // → modalActions.open('customerSelector')
  onClearCustomer: () => void          // → customerActions.clearCustomer()
  onSetLoyaltyPoints: (n) => void      // → loyaltyActions.setPointsToRedeem(n)
  onCheckout: () => void               // → modalActions.open('payment')
  onEndSession: () => void             // → sessionActions.endSession()

  // 🔴 Tax (1 prop) → Already available from tax.store
  taxRate: number
}
```

**Target:** POSCart with **ZERO props** ✅

---

### **POSCheckout Component (2 props currently)**
```typescript
interface POSCheckoutProps {
  products: Product[]              // 🔴 → products.store
  onCheckoutComplete?: () => void  // 🔴 → Remove (handled in payment.store)
}
```

**Target:** POSCheckout with **ZERO props** ✅

---

### **POSCheckoutModals Component (30+ props currently)**
```typescript
interface POSCheckoutModalsProps {
  // 🔴 Modal state (2 props) → Already in checkout-ui.store
  isModalOpen: (id: any) => boolean
  closeModal: () => void

  // 🔴 Customer selection (12 props) → customer.store
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

  // 🔴 Totals/Tax (7 props) → Computed in component from stores
  total: number
  subtotal: number
  taxAmount: number
  taxRate: number
  loyaltyDiscountAmount: number
  loyaltyPointsEarned: number
  itemCount: number

  // 🔴 Loyalty (3 props) → loyalty.store
  loyaltyProgram: LoyaltyProgram | null
  getMaxRedeemablePoints: (subtotal: number) => number
  onApplyLoyaltyPoints: (points: number) => void

  // Plus more...
}
```

**Target:** POSCheckoutModals with **ZERO props** (reads from stores) ✅

---

## 🏗️ New Stores to Create

### **1. customer.store.ts** 🆕
**Purpose:** Customer selection and ID scanning
```typescript
interface CustomerState {
  // State
  selectedCustomer: Customer | null
  scannedDataForNewCustomer: AAMVAData | null
  customerMatches: CustomerMatch[]

  // Actions
  selectCustomer: (customer: Customer) => void
  clearCustomer: () => void
  setScannedData: (data: AAMVAData) => void
  clearScannedData: () => void
  setCustomerMatches: (matches: CustomerMatch[]) => void
  clearCustomerMatches: () => void
  findMatchingCustomer: (data: AAMVAData) => Promise<MatchResult>
  createCustomerFromScan: (data: AAMVAData) => Promise<Customer>
}
```

**Replaces:**
- `useCustomerSelection` hook in POSCheckout
- All customer-related props in POSCart, POSCheckoutModals

---

### **2. loyalty.store.ts** 🆕
**Purpose:** Loyalty points management and calculations
```typescript
interface LoyaltyState {
  // State
  loyaltyProgram: LoyaltyProgram | null
  pointsToRedeem: number

  // Computed (getters)
  getDiscountAmount: () => number
  getMaxRedeemablePoints: (subtotal: number) => number
  getPointsEarned: (total: number) => number

  // Actions
  loadLoyaltyProgram: (vendorId: string) => Promise<void>
  setPointsToRedeem: (points: number) => void
  resetLoyalty: () => void
  applyLoyaltyPoints: (customerId: string, points: number) => Promise<void>
}
```

**Replaces:**
- `useLoyalty` hook
- All loyalty-related props

---

### **3. products.store.ts** 🆕
**Purpose:** Product catalog management
```typescript
interface ProductsState {
  // State
  products: Product[]
  loading: boolean
  error: string | null

  // Actions
  loadProducts: (vendorId: string, locationId: string) => Promise<void>
  refreshProducts: () => Promise<void>
  getProductById: (id: string) => Product | undefined
}
```

**Replaces:**
- Products state in POSScreen
- Products prop passed to POSCart, POSCheckout

---

### **4. Expand checkout-ui.store.ts** 🔄
**Current:** Discount selector, tier selector
**Add:** Modal orchestration state

```typescript
interface CheckoutUIState {
  // Existing
  selectedDiscountId: string | null
  tierSelectorProductId: string | null
  showDiscountSelector: boolean
  discountingItemId: string | null

  // 🆕 Add modal state
  activeModal: string | null
  modalData: Record<string, any> | null

  // Actions
  openModal: (id: string, data?: any) => void
  closeModal: () => void
  isModalOpen: (id: string) => boolean
}
```

**Replaces:**
- `useModalState` hook
- Modal callback props

---

## 📋 Implementation Checklist

### **Phase 1: Create New Stores** 🏗️

- [ ] **Create `src/stores/customer.store.ts`**
  - [ ] Move customer selection logic from useCustomerSelection hook
  - [ ] Add ID scanning data management
  - [ ] Add customer matching logic
  - [ ] Export actions as plain object (not hooks)
  - [ ] Add useShallow for object selectors

- [ ] **Create `src/stores/loyalty.store.ts`**
  - [ ] Move loyalty logic from useLoyalty hook
  - [ ] Add points redemption state
  - [ ] Add computed getters for discount/max points
  - [ ] Load loyalty program from vendor
  - [ ] Export actions as plain object

- [ ] **Create `src/stores/products.store.ts`**
  - [ ] Move products state from POSScreen
  - [ ] Add product loading logic from POSProductBrowser
  - [ ] Add product search/filter (future)
  - [ ] Export actions as plain object

- [ ] **Update `src/stores/checkout-ui.store.ts`**
  - [ ] Add modal state (activeModal, modalData)
  - [ ] Add openModal/closeModal/isModalOpen actions
  - [ ] Keep existing discount/tier selector state

---

### **Phase 2: Refactor Components** 🔄

- [ ] **POSCheckout.tsx**
  - [ ] Remove all props from interface
  - [ ] Replace `useCustomerSelection()` → `useCustomerStore()`
  - [ ] Replace `useLoyalty()` → `useLoyaltyStore()`
  - [ ] Replace products prop → `useProducts()`
  - [ ] Replace modal callbacks → `modalActions.*`
  - [ ] Remove onCheckoutComplete prop

- [ ] **POSCart.tsx**
  - [ ] Remove ALL 12 props
  - [ ] Import customer from `useCustomerStore()`
  - [ ] Import loyalty from `useLoyaltyStore()`
  - [ ] Import products from `useProductsStore()`
  - [ ] Replace callbacks with direct action calls
  - [ ] Compute tax from tax.store directly

- [ ] **POSCheckoutModals.tsx**
  - [ ] Remove ALL props
  - [ ] Read modal state from `useCheckoutUI()`
  - [ ] Read customer from `useCustomerStore()`
  - [ ] Read loyalty from `useLoyaltyStore()`
  - [ ] Compute totals from cart/tax/loyalty stores
  - [ ] Use direct action imports

- [ ] **POSScreen.tsx**
  - [ ] Remove products state
  - [ ] Remove all customer/loyalty state
  - [ ] Keep ONLY Context usage (auth, session)
  - [ ] Simplify to pure orchestrator

---

### **Phase 3: Delete Legacy Hooks** 🗑️

- [ ] Delete `src/hooks/pos/useCustomerSelection.ts`
- [ ] Delete `src/hooks/pos/useLoyalty.ts`
- [ ] Delete `src/hooks/pos/useModalState.ts`
- [ ] Update `src/hooks/pos/index.ts` exports

---

### **Phase 4: Update Documentation** 📝

- [ ] Update `REFACTORING_GUIDE.md`
- [ ] Update `REFACTORING_SUMMARY.md`
- [ ] Create `ARCHITECTURE.md` (Context vs Zustand decision tree)
- [ ] Add store usage examples

---

## 🎯 Final Architecture

### **Component Tree (Zero Props)**
```
POSScreen (reads Context only)
  └─ POSCheckout (no props)
      ├─ POSCheckoutModals (no props)
      └─ POSCart (no props)
          └─ POSCartItem (minimal props: item data only)
```

### **Context Layer (Global App State)**
```typescript
AppAuthContext {
  user: User
  vendor: Vendor
  locations: Location[]
}

POSSessionContext {
  session: SessionInfo
  register: RegisterInfo
  apiConfig: APIConfig
}
```

### **Zustand Layer (Domain State)**
```typescript
// Auth & Session (matches Context)
auth.store.ts
posSession.store.ts

// Cart & Checkout
cart.store.ts           // Items, quantities, discounts
checkout-ui.store.ts    // Modals, selectors, UI state
payment.store.ts        // Payment processing
tax.store.ts            // Tax calculations

// Customer & Loyalty
customer.store.ts       // 🆕 Customer selection, ID scanning
loyalty.store.ts        // 🆕 Loyalty points, rewards

// Products
products.store.ts       // 🆕 Product catalog

// Monitoring
payment-processor.store.ts  // Terminal health monitoring
```

---

## 📊 Prop Drilling Metrics

### **Before This Refactoring:**
- POSCart: 25 props → 12 props (**52% reduction**)
- POSCheckout: Still has props
- POSCheckoutModals: 30+ props

### **After Full Refactoring:**
- POSCart: 12 props → **0 props** (**100% elimination**)
- POSCheckout: 2 props → **0 props** (**100% elimination**)
- POSCheckoutModals: 30+ props → **0 props** (**100% elimination**)

**Total Props Eliminated:** ~67 props across POS components ✅

---

## 🚀 Benefits

### **Developer Experience**
- ✅ Zero prop drilling - components read directly from stores
- ✅ No callback hell - direct action imports
- ✅ Easy to add features - just add to store
- ✅ Clear separation - Context for app, Zustand for domain

### **Performance**
- ✅ Focused re-renders - only components using specific store slices
- ✅ No prop change detection - components subscribe to exact data needed
- ✅ Computed values cached - getters only recalculate when needed

### **Maintainability**
- ✅ Single source of truth - all domain state in stores
- ✅ Testable - stores can be tested independently
- ✅ Debuggable - Redux DevTools for all state
- ✅ AI-accessible - stores can be called outside React

---

## ⚠️ Important Patterns

### **When to Use Context vs Zustand**

**Use Context for:**
- ✅ App-level state (auth, session)
- ✅ Rarely changes
- ✅ Needed by many components
- ✅ React-only (not accessed outside components)

**Use Zustand for:**
- ✅ Domain state (cart, customer, loyalty)
- ✅ Changes frequently
- ✅ Needs Redux DevTools
- ✅ Accessed outside React (API calls, services)
- ✅ Complex computed values
- ✅ State machines (payment flow)

### **Store Action Pattern**
```typescript
// ✅ ALWAYS export actions as plain object
export const customerActions = {
  get selectCustomer() { return useCustomerStore.getState().selectCustomer },
  get clearCustomer() { return useCustomerStore.getState().clearCustomer },
}

// ✅ Components use direct imports (no hooks for actions)
import { customerActions } from '@/stores/customer.store'
customerActions.selectCustomer(customer)

// ❌ NEVER do this (creates subscription loop)
const { selectCustomer } = useCustomerActions()
```

### **Store Selector Pattern**
```typescript
// ✅ Primitive values - direct selector
export const useSelectedCustomer = () =>
  useCustomerStore((state) => state.selectedCustomer)

// ✅ Object returns - use useShallow
export const useCustomerState = () =>
  useCustomerStore(
    useShallow((state) => ({
      selectedCustomer: state.selectedCustomer,
      scannedData: state.scannedData,
      matches: state.matches,
    }))
  )
```

---

## 📅 Implementation Timeline

**Estimated Time:** 4-6 hours

1. **Hour 1-2:** Create customer.store.ts + loyalty.store.ts
2. **Hour 2-3:** Create products.store.ts + update checkout-ui.store.ts
3. **Hour 3-4:** Refactor POSCart (remove all props)
4. **Hour 4-5:** Refactor POSCheckout + POSCheckoutModals
5. **Hour 5-6:** Delete legacy hooks, update docs, test

---

## ✅ Success Criteria

- [ ] Zero prop drilling in all POS components
- [ ] All components pass TypeScript strict checks
- [ ] No React compiler warnings
- [ ] Redux DevTools shows all state changes
- [ ] All existing functionality works
- [ ] No performance regressions
- [ ] Documentation updated
- [ ] Legacy hooks deleted
- [ ] Git committed with clear message

---

**Next Step:** Start with Phase 1 - Create customer.store.ts
