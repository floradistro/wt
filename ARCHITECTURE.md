# WhaleTools Native - Architecture Guide

**Last Updated:** 2025-11-22
**Status:** Production

---

## Overview

WhaleTools Native is a React Native iPad POS application built with TypeScript, Expo, and Supabase. The architecture follows Apple's engineering principles with a focus on simplicity, performance, and maintainability.

---

## Core Principles

### 1. Zero Prop Drilling
All business logic and data lives in Zustand stores. Components receive only visual props (styling, animations) and unavoidable context (IDs, navigation callbacks).

### 2. Zustand Store Architecture
State management uses Zustand with the following patterns:
- **Domain-specific stores** - One store per business domain
- **Focused selectors** - Granular hooks prevent unnecessary re-renders
- **Auto-reload** - CRUD operations automatically refresh data
- **Reset on logout** - All stores reset when user logs out

### 3. Component Structure
```
Component
├── Reads data from stores (via focused selectors)
├── Uses store actions for mutations
├── Receives visual props only (headerOpacity, colors, etc.)
└── Contains only UI logic (no business logic)
```

---

## Store Architecture

### Store Pattern
All stores follow this structure:

```typescript
// stores/example.store.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

interface ExampleState {
  // State
  data: Item[]
  isLoading: boolean
  error: string | null

  // Actions
  loadData: (userId: string) => Promise<void>
  createItem: (data: ItemData) => Promise<Result>
  updateItem: (id: string, data: Partial<ItemData>) => Promise<Result>
  deleteItem: (id: string) => Promise<Result>
  reset: () => void
}

export const useExampleStore = create<ExampleState>()(
  devtools(
    (set, get) => ({
      data: [],
      isLoading: false,
      error: null,

      loadData: async (userId) => {
        set({ isLoading: true, error: null })
        // API call
        set({ data: result, isLoading: false })
      },

      createItem: async (itemData) => {
        const result = await api.create(itemData)
        if (result.success) {
          get().loadData(userId) // Auto-reload
        }
        return result
      },

      reset: () => set({ data: [], isLoading: false, error: null }),
    }),
    { name: 'ExampleStore' }
  )
)

// Focused selectors
export const useData = () => useExampleStore((state) => state.data)
export const useLoading = () => useExampleStore((state) => state.isLoading)
export const useActions = () => useExampleStore(
  useShallow((state) => ({
    loadData: state.loadData,
    createItem: state.createItem,
    updateItem: state.updateItem,
    deleteItem: state.deleteItem,
  }))
)
```

### Active Stores

| Store | Purpose | Lines | Status |
|-------|---------|-------|--------|
| **auth.store.ts** | Authentication & session | 199 | Production |
| **cart.store.ts** | Shopping cart | ~500 | Production |
| **posSession.store.ts** | POS session management | ~400 | Production |
| **product-filter.store.ts** | Product filtering | ~300 | Production |
| **checkout-ui.store.ts** | Checkout modal state | ~200 | Production |
| **payment.store.ts** | Payment processing | ~300 | Production |
| **tax.store.ts** | Tax calculations | ~200 | Production |
| **orders.store.ts** | Order management | ~400 | Production |
| **orders-ui.store.ts** | Orders modal state | ~150 | Production |
| **order-detail.store.ts** | Single order details | ~300 | Production |
| **customers-list.store.ts** | Customer data | ~400 | Production |
| **customers-ui.store.ts** | Customer modal state | ~150 | Production |
| **users-management.store.ts** | User CRUD | 518 | Production |
| **suppliers-management.store.ts** | Supplier CRUD | 233 | Production |
| **settings-ui.store.ts** | Settings modal state | ~200 | Production |
| **loyalty-campaigns.store.ts** | Loyalty & campaigns | ~250 | Skeleton |
| **payment-processors-settings.store.ts** | Payment config | ~200 | Skeleton |

---

## View Architecture

### POS View
**Zero prop drilling achieved** - All data from stores

```
POSScreen
├── POSSessionSetup (session management)
├── POSProductBrowser (product display)
│   └── POSProductGrid
│       └── POSProductCard
├── POSCart (cart display)
│   └── POSTotalsSection
└── POSCheckout (checkout flow)
    └── POSCheckoutModals
```

**Key Stores:**
- `posSession.store.ts` - Session state
- `cart.store.ts` - Cart items
- `product-filter.store.ts` - Filtering
- `checkout-ui.store.ts` - Modal state
- `payment.store.ts` - Payment processing

### Orders View
**Zero prop drilling achieved** - All data from stores

```
OrdersScreen
└── OrdersContent
    ├── OrdersList
    └── OrderDetail
        ├── OrderStatusSection
        ├── OrderCustomerSection
        ├── OrderItemsSection
        └── OrderTotalsSection
```

**Key Stores:**
- `orders.store.ts` - Order list & filters
- `orders-ui.store.ts` - Modal state
- `order-detail.store.ts` - Selected order details

### Customers View
**Zero prop drilling achieved** - All data from stores

```
CustomersScreen
└── CustomersList
    └── CustomerDetail
        ├── CustomerInfo
        ├── LoyaltySection
        └── OrderHistory
```

**Key Stores:**
- `customers-list.store.ts` - Customer data
- `customers-ui.store.ts` - Modal state

### Settings View
**Zero prop drilling achieved** - All data from stores

```
SettingsScreen
├── AccountDetail
├── LocationsDetail
│   └── LocationConfigurationDetail
├── UserManagementDetail
│   └── UserManagementModals
├── SupplierManagementDetail
│   └── SupplierManagementModals
├── LoyaltyManagementDetail
│   └── CampaignsDetail
└── DeveloperToolsDetail
```

**Key Stores:**
- `users-management.store.ts` - User CRUD
- `suppliers-management.store.ts` - Supplier CRUD
- `settings-ui.store.ts` - Modal state
- `loyalty-campaigns.store.ts` - Loyalty/campaigns (skeleton)
- `payment-processors-settings.store.ts` - Payment config (skeleton)

---

## Data Loading Patterns

### On Mount Loading
```typescript
// Parent screen loads all data on mount
useEffect(() => {
  if (!user?.id) return

  useExampleStore.getState().loadData(user.id)
  useOtherStore.getState().loadOtherData(user.id)
}, [user?.id])
```

### Auto-Reload After Mutations
```typescript
// Store actions auto-reload after successful mutations
createItem: async (itemData) => {
  const result = await api.create(itemData)
  if (result.success) {
    // Auto-reload to get fresh data
    get().loadData(currentUserId)
  }
  return result
}
```

### Reset on Logout
```typescript
// auth.store.ts logout function
logout: async () => {
  await AuthService.logout()

  // Reset all stores
  usePOSSessionStore.getState().reset()
  useCartStore.getState().reset()
  useOrdersStore.getState().reset()
  useUsersManagementStore.getState().reset()
  // ... all other stores
}
```

---

## Modal State Management

### Pattern: UI State Stores
Modal visibility is managed by dedicated UI stores (not component state):

```typescript
// Example: settings-ui.store.ts
interface SettingsUIState {
  activeModal: SettingsModalType | null
  selectedUser: User | null

  openModal: (modal: SettingsModalType, item?: any) => void
  closeModal: () => void
}

// Usage in component:
const { openModal } = useSettingsUIActions()
const handleEdit = (user) => openModal('editUser', user)

// Usage in modal:
const activeModal = useActiveModal()
const selectedUser = useSelectedUser()
return activeModal === 'editUser' ? <EditUserModal /> : null
```

---

## Performance Optimization

### 1. Focused Selectors
```typescript
// ✅ Good - Only re-renders when data changes
const data = useData()

// ❌ Bad - Re-renders on any store change
const { data } = useExampleStore()
```

### 2. useShallow for Action Selectors
```typescript
// ✅ Good - Object reference stays stable
const actions = useExampleStore(
  useShallow((state) => ({
    create: state.create,
    update: state.update,
  }))
)

// ❌ Bad - New object on every render
const actions = {
  create: useExampleStore((state) => state.create),
  update: useExampleStore((state) => state.update),
}
```

### 3. React.memo for Pure Components
```typescript
const Component = memo(({ visualProp }) => {
  const data = useData()
  return <View>{/* ... */}</View>
})
```

---

## TypeScript Patterns

### Store Types
```typescript
// Always define explicit interfaces
interface StoreState {
  data: Item[]
  isLoading: boolean
  loadData: (userId: string) => Promise<void>
}

// Use create<Type>() for type safety
export const useStore = create<StoreState>()(...)
```

### Component Props
```typescript
// Props should be visual only
interface ComponentProps {
  headerOpacity: Animated.Value  // Animation
  vendorLogo?: string | null     // Visual
  onBack?: () => void            // Navigation (minimal)
}

// NOT business logic:
// ❌ data: Item[]
// ❌ onCreateItem: (item: Item) => void
```

---

## Debugging

### Redux DevTools
All stores have DevTools middleware:
```typescript
{ name: 'ExampleStore' }
```

Enable Redux DevTools to inspect:
- Store state
- Action history
- Time-travel debugging

### Logging
Use `logger` utility for consistent logging:
```typescript
import { logger } from '@/utils/logger'

logger.debug('[Component] Debug message', { data })
logger.error('[Component] Error occurred', { error })
```

---

## Testing Considerations

### Store Testing
```typescript
// Test store actions directly
const store = useExampleStore.getState()
await store.loadData('user-123')
expect(store.data).toHaveLength(5)
```

### Component Testing
```typescript
// Mock store selectors
jest.mock('@/stores/example.store', () => ({
  useData: () => mockData,
  useActions: () => mockActions,
}))
```

---

## Common Patterns

### Loading States
```typescript
// In store
const isLoading = useLoading()
if (isLoading) return <LoadingSpinner />
```

### Error Handling
```typescript
// Stores return Result objects
type Result = { success: boolean; error?: string }

const result = await createItem(data)
if (!result.success) {
  Alert.alert('Error', result.error)
}
```

### Conditional UI
```typescript
// Use focused selectors
const activeModal = useActiveModal()
return activeModal === 'edit' ? <EditModal /> : null
```

---

## Migration Guide

### Converting Component to Use Stores

**Before:**
```typescript
function Component({
  data,
  loading,
  onCreate,
  onUpdate,
  onDelete,
}) {
  return <View>{/* ... */}</View>
}

<Component
  data={data}
  loading={loading}
  onCreate={onCreate}
  onUpdate={onUpdate}
  onDelete={onDelete}
/>
```

**After:**
```typescript
function Component() {
  const data = useData()
  const loading = useLoading()
  const { create, update, delete } = useActions()

  return <View>{/* ... */}</View>
}

<Component />  // Zero props!
```

---

## Best Practices

### DO ✅
- Use focused selectors (`useData()` not `useStore()`)
- Put business logic in stores
- Auto-reload after mutations
- Reset stores on logout
- Use DevTools middleware
- Keep components thin (UI only)

### DON'T ❌
- Pass data as props (use stores)
- Pass callbacks as props (use store actions)
- Call store actions in render (use handlers)
- Subscribe to entire store (use focused selectors)
- Forget to reset stores on logout

---

## References

- **Store Directory:** `/src/stores/`
- **Component Directory:** `/src/components/`
- **Screens Directory:** `/src/screens/`
- **Hooks Directory:** `/src/hooks/` (mostly types now)

---

**Maintained by:** WhaleTools Team
**Architecture Pattern:** Zustand + Focused Selectors
**Quality Standard:** Apple Engineering Principles
