# POS Component Architecture

## Overview
This document establishes the component and hook patterns for the POS system that will be replicated across the entire application.

## Design Principles (Jobs Philosophy)
1. **Minimal, monochrome UI** - Clean, functional design
2. **Clear visual hierarchy** - Important information stands out
3. **Instant feedback** - Haptic and visual responses
4. **Smart defaults** - Pre-select common options
5. **No unnecessary chrome** - Every element serves a purpose

## Architecture Layers

### 1. Custom Hooks (Business Logic)
Hooks contain all business logic and state management, making them testable and reusable.

#### `useCart`
**Purpose:** Manage cart state and operations
**State:**
- `cart: CartItem[]`
- `discountingItemId: string | null`

**Operations:**
- `addToCart(product, tier?)`
- `updateQuantity(productId, delta)`
- `applyManualDiscount(productId, type, value)`
- `removeManualDiscount(productId)`
- `clearCart()`

**Computed:**
- `subtotal: number`
- `itemCount: number`

---

#### `useLoyalty`
**Purpose:** Handle loyalty points redemption
**State:**
- `loyaltyProgram: LoyaltyProgram | null`
- `loyaltyPointsToRedeem: number`

**Operations:**
- `setLoyaltyPointsToRedeem(points)`
- `resetLoyalty()`

**Computed:**
- `loyaltyDiscountAmount: number`
- `maxRedeemablePoints: number`

---

#### `usePOSSession`
**Purpose:** Manage POS session lifecycle
**State:**
- `sessionInfo: SessionInfo | null`
- `sessionData: SessionData | null`

**Operations:**
- `openSession(locationId, registerId, openingCash, notes)`
- `closeSession(closingCash, notes)`
- `loadSessionData()`

---

#### `useProducts`
**Purpose:** Product loading and filtering
**State:**
- `products: Product[]`
- `categories: string[]`
- `loading: boolean`

**Operations:**
- `loadProducts(locationId)`
- `filterProducts(query, category, filters)`

---

### 2. UI Components

#### `POSCartItem`
**File:** `src/components/pos/cart/POSCartItem.tsx`
**Props:**
```typescript
interface POSCartItemProps {
  item: CartItem
  onAdd: () => void
  onRemove: () => void
  onApplyDiscount?: (type: 'percentage' | 'amount', value: number) => void
  onRemoveDiscount?: () => void
  isDiscounting?: boolean
  onStartDiscounting?: () => void
  onCancelDiscounting?: () => void
}
```

**Responsibilities:**
- Display cart item with price, quantity, tier
- Staff discount UI (inline form)
- Quantity controls
- Line total

---

#### `POSCart`
**File:** `src/components/pos/cart/POSCart.tsx`
**Props:**
```typescript
interface POSCartProps {
  cart: CartItem[]
  subtotal: number
  taxAmount: number
  total: number
  itemCount: number
  selectedCustomer: Customer | null
  loyaltyPointsToRedeem: number
  loyaltyProgram: LoyaltyProgram | null
  taxRate: number
  onAddItem: (productId: string) => void
  onRemoveItem: (productId: string) => void
  onApplyDiscount: (productId: string, type: 'percentage' | 'amount', value: number) => void
  onRemoveDiscount: (productId: string) => void
  onSelectCustomer: () => void
  onClearCustomer: () => void
  onSetLoyaltyPoints: (points: number) => void
  onCheckout: () => void
  onClearCart: () => void
  onOpenIDScanner: () => void
}
```

**Responsibilities:**
- Full cart sidebar layout
- Customer selector
- Loyalty points section
- Totals breakdown
- Checkout button

---

#### `POSProductGrid`
**File:** `src/components/pos/POSProductGrid.tsx`
**Props:**
```typescript
interface POSProductGridProps {
  products: Product[]
  loading: boolean
  onAddToCart: (product: Product, tier?: PricingTier) => void
  activeFilters?: ActiveFilters
}
```

**Responsibilities:**
- Grid layout of products
- Loading state
- Empty state
- Product cards with pricing modals

---

#### `POSSearchBar`
**File:** `src/components/pos/POSSearchBar.tsx`
**Props:**
```typescript
interface POSSearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategory: string
  categories: string[]
  onCategorySelect: (category: string) => void
  itemCount: number
}
```

**Responsibilities:**
- Search input
- Category dropdown
- Item count display
- Clear search button

---

#### `POSTotalsSection`
**File:** `src/components/pos/cart/POSTotalsSection.tsx`
**Props:**
```typescript
interface POSTotalsSectionProps {
  subtotal: number
  loyaltyDiscountAmount: number
  taxAmount: number
  taxRate: number
  total: number
  onCheckout: () => void
  disabled?: boolean
}
```

**Responsibilities:**
- Subtotal display
- Loyalty discount line (if applicable)
- Tax calculation display
- Total display
- Checkout button

---

## File Structure

```
src/
├── hooks/
│   └── pos/
│       ├── useCart.ts
│       ├── useLoyalty.ts
│       ├── usePOSSession.ts
│       └── useProducts.ts
├── components/
│   └── pos/
│       ├── cart/
│       │   ├── POSCart.tsx
│       │   ├── POSCartItem.tsx
│       │   └── POSTotalsSection.tsx
│       ├── products/
│       │   ├── POSProductGrid.tsx
│       │   └── POSProductCard.tsx (existing)
│       ├── search/
│       │   └── POSSearchBar.tsx
│       └── index.ts (barrel export)
└── screens/
    └── POSScreen.tsx (orchestrator only)
```

## Refactored POSScreen

After refactoring, `POSScreen.tsx` should be ~500 lines, focusing on:
- Orchestrating hooks and components
- Session flow (location/register selection)
- Modal management
- Payment processor integration

## Benefits

1. **Testability**: Hooks can be unit tested independently
2. **Reusability**: Cart logic can be used in other screens (e.g., online ordering)
3. **Maintainability**: Smaller, focused files (~200-300 lines each)
4. **Scalability**: Clear patterns for adding features
5. **Type Safety**: Explicit interfaces for all props
6. **Team Development**: Multiple developers can work on different components

## Migration Strategy

1. ✅ Create hooks directory structure
2. ✅ Extract `useCart` hook with all cart logic
3. ✅ Extract `useLoyalty` hook
4. ✅ Extract `POSCartItem` component
5. ✅ Extract `POSTotalsSection` component
6. ✅ Extract `POSCart` component
7. ✅ Extract `POSSearchBar` component
8. ✅ Extract `POSProductGrid` component
9. ✅ Update `POSScreen` to use new hooks and components
10. ✅ Test all functionality thoroughly
11. ✅ Document patterns for team

## Testing Checklist

After refactoring, verify:
- [ ] Add items to cart
- [ ] Remove items from cart
- [ ] Apply staff discounts (% and $)
- [ ] Remove staff discounts
- [ ] Select customer
- [ ] Redeem loyalty points
- [ ] Clear loyalty points
- [ ] Search products
- [ ] Filter by category
- [ ] Checkout flow (cash, card)
- [ ] Session open/close
- [ ] Payment processor integration
- [ ] Tax calculations
- [ ] Cart total calculations
