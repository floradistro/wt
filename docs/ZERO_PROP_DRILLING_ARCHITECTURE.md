# Zero Prop Drilling Architecture - POS Refactor

## Overview

This document describes the architectural pattern we implemented to eliminate prop drilling in the POS (Point of Sale) system. This same pattern should be applied to other complex features like the Products view.

## The Problem

**Before:** Complex components were passing 30+ props through multiple layers:
- POSScreen → POSCheckout → POSCheckoutModals → Individual Modals
- POSScreen → POSCheckout → POSCart → POSCartItem
- Data flowing as props through 3-4 component layers
- Difficult to maintain and debug
- Re-renders propagating unnecessarily

## The Solution: Zero Prop Drilling

**After:** Data flows through two architectural layers:
1. **Context** - For environmental/session data (rarely changes)
2. **Zustand Stores** - For transient UI state (frequently changes)

### Key Principle
> Components read data from stores/context directly instead of receiving it as props. Only pass callbacks for complex orchestration that requires coordination between multiple stores.

---

## Architecture Layers

### Layer 1: Context (Environmental Data)

Use React Context for data that:
- Changes rarely (auth state, session info, vendor config)
- Needs to be available throughout the component tree
- Represents "environmental" or "session" information

**Implemented Contexts:**

#### `AppAuthContext`
```typescript
// What it provides:
- user: User | null
- vendor: Vendor | null
- locations: Location[]

// When to use:
- Authentication status
- Vendor configuration
- Available locations

// Example:
const { vendor } = useAppAuth()
```

#### `POSSessionContext`
```typescript
// What it provides:
- session: POSSession | null (locationId, registerId, sessionId)
- register: Register | null
- apiConfig: APIConfig | null (taxRate, taxName)
- openCashDrawer()
- closeCashDrawer()

// When to use:
- Current POS session data
- Cash drawer operations
- Tax configuration

// Example:
const { session, apiConfig } = usePOSSession()
```

**Key Context Rules:**
1. ✅ DO: Use for environmental data
2. ✅ DO: Sync to AsyncStorage for persistence
3. ❌ DON'T: Use for frequently changing UI state
4. ❌ DON'T: Put business logic in Context (use stores instead)

---

### Layer 2: Zustand Stores (Transient State)

Use Zustand stores for:
- Frequently changing state (cart items, UI toggles)
- Business logic and state mutations
- Data that needs Redux DevTools visibility
- State that multiple components need to read/write

**Implemented Stores:**

#### `customer.store.ts`
```typescript
// State:
- selectedCustomer: Customer | null
- scannedDataForNewCustomer: AAMVAData | null
- customerMatches: CustomerMatch[]
- vendorId: string | null

// Actions:
- selectCustomer(customer)
- clearCustomer()
- setScannedData(data)
- setCustomerMatches(matches)
- clearCustomerMatches()

// Selectors:
export const useSelectedCustomer = () =>
  useCustomerStore((state) => state.selectedCustomer)

export const useScannedDataForNewCustomer = () =>
  useCustomerStore((state) => state.scannedDataForNewCustomer)

export const useCustomerMatches = () =>
  useCustomerStore((state) => state.customerMatches)

// Actions Object (for non-component use):
export const customerActions = {
  get selectCustomer() { return useCustomerStore.getState().selectCustomer },
  get clearCustomer() { return useCustomerStore.getState().clearCustomer },
  // ... other actions
}
```

#### `cart.store.ts`
```typescript
// State:
- items: CartItem[]
- discountingItemId: string | null

// Actions:
- addToCart(product, tier)
- updateQuantity(itemId, delta)
- changeTier(itemId, product, tier)
- clearCart()
- applyManualDiscount(itemId, type, value)

// Selectors:
export const useCartItems = () => useCartStore((state) => state.items)
export const useCartTotals = () => useCartStore(
  useShallow((state) => ({
    subtotal: state.items.reduce(...),
    itemCount: state.items.reduce(...)
  }))
)

// Actions Object:
export const cartActions = {
  get addToCart() { return useCartStore.getState().addToCart },
  get clearCart() { return useCartStore.getState().clearCart },
  // ... other actions
}
```

#### `checkout-ui.store.ts`
```typescript
// State:
- selectedDiscountId: string | null
- tierSelectorProductId: string | null
- activeModal: string | null
- modalData: Record<string, any> | null

// Actions:
- openModal(id, data)
- closeModal()
- setSelectedDiscountId(id)
- setTierSelectorProductId(id)

// Selectors:
export const useActiveModal = () =>
  useCheckoutUIStore((state) => state.activeModal)

export const useSelectedDiscountId = () =>
  useCheckoutUIStore((state) => state.selectedDiscountId)

// Actions Object:
export const checkoutUIActions = {
  get openModal() { return useCheckoutUIStore.getState().openModal },
  get closeModal() { return useCheckoutUIStore.getState().closeModal },
  isModalOpen: (id: string) => useCheckoutUIStore.getState().activeModal === id,
  // ... other actions
}
```

#### `products.store.ts`
```typescript
// State:
- products: Product[]
- loading: boolean
- error: string | null

// Actions:
- setProducts(products)
- updateProduct(product)
- deleteProduct(id)

// Selectors:
export const useProducts = () => useProductsStore((state) => state.products)
export const useProductsLoading = () => useProductsStore((state) => state.loading)
```

**Key Store Rules:**
1. ✅ DO: Create focused stores (customer, cart, checkout-ui)
2. ✅ DO: Export selectors for optimal re-renders
3. ✅ DO: Export actions object for non-component use
4. ✅ DO: Use devtools middleware for debugging
5. ❌ DON'T: Put session/auth data in stores (use Context)
6. ❌ DON'T: Create circular dependencies between stores

---

## Migration Pattern: Step-by-Step

### Step 1: Identify Data Flow

**Example from POS migration:**

Before:
```
POSScreen (has: products, vendor, session)
  ↓ props
POSCheckout (receives: products, vendor, session, customer)
  ↓ props
POSCart (receives: products, customer, loyalty)
  ↓ props
POSCartItem (receives: product, customer)
```

After:
```
POSScreen (provides: AppAuthContext, POSSessionContext)
  ↓ context
POSCheckout (reads: useSelectedCustomer, uses: Context)
  ↓ zero props
POSCart (reads: useProducts, useCartItems, useSelectedCustomer)
  ↓ zero props
POSCartItem (reads: useCartItems, uses: cartActions)
```

### Step 2: Create/Update Stores

**Example: customer.store.ts**

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface CustomerState {
  // State
  selectedCustomer: Customer | null
  scannedDataForNewCustomer: AAMVAData | null

  // Actions
  selectCustomer: (customer: Customer) => void
  clearCustomer: () => void
  setScannedData: (data: AAMVAData | null) => void
}

export const useCustomerStore = create<CustomerState>()(
  devtools(
    (set) => ({
      // Initial state
      selectedCustomer: null,
      scannedDataForNewCustomer: null,

      // Actions
      selectCustomer: (customer) => {
        set({ selectedCustomer: customer }, false, 'customer/select')
      },

      clearCustomer: () => {
        set({
          selectedCustomer: null,
          scannedDataForNewCustomer: null
        }, false, 'customer/clear')
      },

      setScannedData: (data) => {
        set({ scannedDataForNewCustomer: data }, false, 'customer/setScannedData')
      },
    }),
    { name: 'CustomerStore' }
  )
)

// Selectors (for optimal re-renders)
export const useSelectedCustomer = () =>
  useCustomerStore((state) => state.selectedCustomer)

export const useScannedDataForNewCustomer = () =>
  useCustomerStore((state) => state.scannedDataForNewCustomer)

// Actions object (for non-component use)
export const customerActions = {
  get selectCustomer() { return useCustomerStore.getState().selectCustomer },
  get clearCustomer() { return useCustomerStore.getState().clearCustomer },
  get setScannedData() { return useCustomerStore.getState().setScannedData },
}
```

### Step 3: Update Components to Read from Stores

**Before (POSCheckout with props):**
```typescript
interface POSCheckoutProps {
  products: Product[]
  vendor: Vendor
  session: SessionInfo
  selectedCustomer: Customer | null
  onSelectCustomer: () => void
  // ... 25+ more props
}

export function POSCheckout({
  products,
  vendor,
  session,
  selectedCustomer,
  onSelectCustomer,
  // ... 25+ more props
}: POSCheckoutProps) {
  // Component logic
}
```

**After (POSCheckout with stores):**
```typescript
interface POSCheckoutProps {
  onCheckoutComplete?: () => void  // Only orchestration callbacks
}

export function POSCheckout({ onCheckoutComplete }: POSCheckoutProps) {
  // ========================================
  // CONTEXT - Environmental Data
  // ========================================
  const { vendor } = useAppAuth()
  const { session, apiConfig } = usePOSSession()

  // ========================================
  // STORES - Transient State
  // ========================================
  const selectedCustomer = useSelectedCustomer()
  const cart = useCartItems()
  const { subtotal, itemCount } = useCartTotals()

  // ========================================
  // HANDLERS - Use store actions
  // ========================================
  const handleSelectCustomer = useCallback(() => {
    checkoutUIActions.openModal('customerSelector')
  }, [])

  const handleClearCustomer = useCallback(() => {
    customerActions.clearCustomer()
  }, [])

  // Component logic
}
```

### Step 4: Update Child Components (TRUE ZERO PROPS)

**Before (POSCustomerMatchModal with props):**
```typescript
interface POSCustomerMatchModalProps {
  visible: boolean
  matches: CustomerMatch[]
  scannedData: AAMVAData | null
  onSelectMatch: (customer: Customer) => void
  onCreateNew: () => void
  onClose: () => void
}

export function POSCustomerMatchModal({
  visible,
  matches,
  scannedData,
  onSelectMatch,
  onCreateNew,
  onClose,
}: POSCustomerMatchModalProps) {
  // Component logic
}
```

**After (POSCustomerMatchModal - TRUE ZERO PROPS):**
```typescript
// NO PROPS! Reads everything from stores
export function POSCustomerMatchModal() {
  // ========================================
  // STORES - Read state directly
  // ========================================
  const activeModal = useActiveModal()
  const visible = activeModal === 'customerMatch'
  const { scannedData, matches } = useCustomerState()

  // ========================================
  // HANDLERS - Call store actions directly
  // ========================================
  const handleSelectMatch = (customer: Customer) => {
    customerActions.selectCustomer(customer)
    customerActions.clearCustomerMatches()
    checkoutUIActions.closeModal()
  }

  const handleCreateNew = () => {
    customerActions.clearCustomerMatches()
    checkoutUIActions.openModal('addCustomer')
  }

  const handleClose = () => {
    customerActions.clearCustomerMatches()
    checkoutUIActions.closeModal()
  }

  // Component logic
}
```

### Step 5: Sync Context with Stores When Needed

**Example: Syncing vendorId to customer store**

```typescript
// AppAuthContext.tsx
useEffect(() => {
  const loadVendor = async () => {
    const vendorData = await fetchVendor()
    setVendor(vendorData)

    // Sync vendorId to customer store for customer search
    useCustomerStore.getState().setVendorId(vendorData.id)
  }

  loadVendor()
}, [])
```

---

## Common Patterns

### Pattern 1: Modal Management

**Store Pattern:**
```typescript
// checkout-ui.store.ts
interface CheckoutUIState {
  activeModal: string | null
  modalData: Record<string, any> | null

  openModal: (id: string, data?: any) => void
  closeModal: () => void
}

export const checkoutUIActions = {
  get openModal() { return useCheckoutUIStore.getState().openModal },
  get closeModal() { return useCheckoutUIStore.getState().closeModal },
  isModalOpen: (id: string) => useCheckoutUIStore.getState().activeModal === id,
}
```

**Component Pattern:**
```typescript
// Parent component
const handleOpenCustomer = () => {
  checkoutUIActions.openModal('customerSelector')
}

// Modal component
export function CustomerSelectorModal() {
  const activeModal = useActiveModal()
  const visible = activeModal === 'customerSelector'

  const handleClose = () => {
    checkoutUIActions.closeModal()
  }

  return <Modal visible={visible} onClose={handleClose}>...</Modal>
}
```

### Pattern 2: List Item Actions

**Store Pattern:**
```typescript
// cart.store.ts
export const cartActions = {
  get updateQuantity() { return useCartStore.getState().updateQuantity },
  get removeItem() { return useCartStore.getState().removeItem },
}
```

**Component Pattern:**
```typescript
// POSCartItem.tsx
export function POSCartItem({ item }: { item: CartItem }) {
  const handleAdd = () => {
    cartActions.updateQuantity(item.id, 1)
  }

  const handleRemove = () => {
    cartActions.updateQuantity(item.id, -1)
  }

  return (
    <View>
      <Text>{item.name}</Text>
      <Button onPress={handleAdd}>+</Button>
      <Button onPress={handleRemove}>-</Button>
    </View>
  )
}
```

### Pattern 3: Coordinated Multi-Store Actions

**When to use callbacks:**
Only when an action requires coordination between multiple stores AND complex business logic.

```typescript
// POSCheckout.tsx
const handlePaymentComplete = async (paymentData: PaymentData) => {
  // Complex orchestration across multiple stores
  await paymentActions.processPayment({
    paymentData,
    cart,
    total,
    sessionInfo,
    onSuccess: () => {
      // Coordinate multiple stores
      cartActions.clearCart()
      customerActions.clearCustomer()
      resetLoyalty()
      onCheckoutComplete?.()
    }
  })
}

// Pass this as a prop to POSPaymentModal
<POSPaymentModal onPaymentComplete={handlePaymentComplete} />
```

---

## Applying to Products View

### Current Products Architecture (Assumed)

```
ProductsScreen
  ↓ props (products, categories, filters, etc.)
ProductList
  ↓ props (products, onEdit, onDelete, etc.)
ProductCard
  ↓ props (product, onPress, etc.)
ProductEditModal
  ↓ props (product, visible, onSave, onClose)
```

### Target Products Architecture

```
ProductsScreen (provides: AppAuthContext)
  ↓ context only
ProductList (reads: useProducts, useProductFilters)
  ↓ zero props
ProductCard (reads: product from list, uses: productActions)
  ↓ zero props
ProductEditModal (reads: useSelectedProduct, useEditState)
```

### Step-by-Step for Products

#### 1. Create/Update `products.store.ts`

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ProductsState {
  // State
  products: Product[]
  loading: boolean
  error: string | null

  // Actions
  setProducts: (products: Product[]) => void
  addProduct: (product: Product) => void
  updateProduct: (product: Product) => void
  deleteProduct: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useProductsStore = create<ProductsState>()(
  devtools(
    (set) => ({
      products: [],
      loading: false,
      error: null,

      setProducts: (products) => {
        set({ products, loading: false }, false, 'products/setAll')
      },

      addProduct: (product) => {
        set((state) => ({
          products: [...state.products, product]
        }), false, 'products/add')
      },

      updateProduct: (product) => {
        set((state) => ({
          products: state.products.map(p =>
            p.id === product.id ? product : p
          )
        }), false, 'products/update')
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter(p => p.id !== id)
        }), false, 'products/delete')
      },

      setLoading: (loading) => {
        set({ loading }, false, 'products/setLoading')
      },

      setError: (error) => {
        set({ error, loading: false }, false, 'products/setError')
      },
    }),
    { name: 'ProductsStore' }
  )
)

// Selectors
export const useProducts = () => useProductsStore((state) => state.products)
export const useProductsLoading = () => useProductsStore((state) => state.loading)
export const useProductsError = () => useProductsStore((state) => state.error)

// Actions
export const productActions = {
  get setProducts() { return useProductsStore.getState().setProducts },
  get addProduct() { return useProductsStore.getState().addProduct },
  get updateProduct() { return useProductsStore.getState().updateProduct },
  get deleteProduct() { return useProductsStore.getState().deleteProduct },
}
```

#### 2. Create `product-ui.store.ts` for UI state

```typescript
interface ProductUIState {
  // Selected product for editing
  selectedProductId: string | null

  // Active modal
  activeModal: 'edit' | 'delete' | 'duplicate' | null

  // Filters
  searchQuery: string
  selectedCategoryId: string | null
  showOutOfStock: boolean

  // Actions
  selectProduct: (id: string | null) => void
  openModal: (modal: 'edit' | 'delete' | 'duplicate') => void
  closeModal: () => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (id: string | null) => void
  toggleOutOfStock: () => void
}

export const useProductUIStore = create<ProductUIState>()(
  devtools(
    (set) => ({
      selectedProductId: null,
      activeModal: null,
      searchQuery: '',
      selectedCategoryId: null,
      showOutOfStock: true,

      selectProduct: (id) => {
        set({ selectedProductId: id }, false, 'productUI/selectProduct')
      },

      openModal: (modal) => {
        set({ activeModal: modal }, false, 'productUI/openModal')
      },

      closeModal: () => {
        set({
          activeModal: null,
          selectedProductId: null
        }, false, 'productUI/closeModal')
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query }, false, 'productUI/setSearch')
      },

      setSelectedCategory: (id) => {
        set({ selectedCategoryId: id }, false, 'productUI/setCategory')
      },

      toggleOutOfStock: () => {
        set((state) => ({
          showOutOfStock: !state.showOutOfStock
        }), false, 'productUI/toggleOutOfStock')
      },
    }),
    { name: 'ProductUIStore' }
  )
)

// Selectors
export const useSelectedProductId = () =>
  useProductUIStore((state) => state.selectedProductId)

export const useActiveProductModal = () =>
  useProductUIStore((state) => state.activeModal)

export const useProductFilters = () =>
  useProductUIStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      selectedCategoryId: state.selectedCategoryId,
      showOutOfStock: state.showOutOfStock,
    }))
  )

// Actions
export const productUIActions = {
  get selectProduct() { return useProductUIStore.getState().selectProduct },
  get openModal() { return useProductUIStore.getState().openModal },
  get closeModal() { return useProductUIStore.getState().closeModal },
  get setSearchQuery() { return useProductUIStore.getState().setSearchQuery },
  get setSelectedCategory() { return useProductUIStore.getState().setSelectedCategory },
  get toggleOutOfStock() { return useProductUIStore.getState().toggleOutOfStock },
}
```

#### 3. Update ProductsScreen

**Before:**
```typescript
export function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setEditModalVisible(true)
  }

  return (
    <View>
      <ProductList
        products={products}
        onEditProduct={handleEditProduct}
      />
      <ProductEditModal
        visible={editModalVisible}
        product={selectedProduct}
        onClose={() => setEditModalVisible(false)}
      />
    </View>
  )
}
```

**After:**
```typescript
export function ProductsScreen() {
  // Context only - no local state!
  const { vendor } = useAppAuth()

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      productActions.setLoading(true)
      const products = await fetchProducts(vendor.id)
      productActions.setProducts(products)
    }
    loadProducts()
  }, [vendor.id])

  return (
    <View>
      {/* ZERO PROPS - components read from stores */}
      <ProductList />
      <ProductEditModal />
      <ProductDeleteModal />
    </View>
  )
}
```

#### 4. Update ProductList (Zero Props)

```typescript
export function ProductList() {
  // ========================================
  // STORES
  // ========================================
  const products = useProducts()
  const loading = useProductsLoading()
  const { searchQuery, selectedCategoryId, showOutOfStock } = useProductFilters()

  // ========================================
  // COMPUTED
  // ========================================
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!showOutOfStock && p.inventory_quantity === 0) return false
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (selectedCategoryId && p.category_id !== selectedCategoryId) return false
      return true
    })
  }, [products, searchQuery, selectedCategoryId, showOutOfStock])

  if (loading) return <LoadingSpinner />

  return (
    <FlatList
      data={filteredProducts}
      renderItem={({ item }) => <ProductCard product={item} />}
      keyExtractor={(item) => item.id}
    />
  )
}
```

#### 5. Update ProductCard (Zero Props Except Data)

```typescript
interface ProductCardProps {
  product: Product  // Only the data item itself
}

export function ProductCard({ product }: ProductCardProps) {
  // ========================================
  // HANDLERS - Use store actions
  // ========================================
  const handleEdit = () => {
    productUIActions.selectProduct(product.id)
    productUIActions.openModal('edit')
  }

  const handleDelete = () => {
    productUIActions.selectProduct(product.id)
    productUIActions.openModal('delete')
  }

  const handleDuplicate = () => {
    productUIActions.selectProduct(product.id)
    productUIActions.openModal('duplicate')
  }

  return (
    <View>
      <Text>{product.name}</Text>
      <Text>${product.price}</Text>
      <Button onPress={handleEdit}>Edit</Button>
      <Button onPress={handleDelete}>Delete</Button>
      <Button onPress={handleDuplicate}>Duplicate</Button>
    </View>
  )
}
```

#### 6. Update ProductEditModal (TRUE ZERO PROPS)

```typescript
export function ProductEditModal() {
  // ========================================
  // STORES
  // ========================================
  const activeModal = useActiveProductModal()
  const visible = activeModal === 'edit'
  const selectedProductId = useSelectedProductId()
  const products = useProducts()

  // Get the selected product
  const product = useMemo(() =>
    products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  )

  // ========================================
  // LOCAL STATE (for form editing)
  // ========================================
  const [editedProduct, setEditedProduct] = useState<Product | null>(null)

  useEffect(() => {
    if (product) {
      setEditedProduct({ ...product })
    }
  }, [product])

  // ========================================
  // HANDLERS
  // ========================================
  const handleSave = async () => {
    if (!editedProduct) return

    await saveProduct(editedProduct)
    productActions.updateProduct(editedProduct)
    productUIActions.closeModal()
  }

  const handleClose = () => {
    productUIActions.closeModal()
  }

  if (!editedProduct) return null

  return (
    <Modal visible={visible} onClose={handleClose}>
      <TextInput
        value={editedProduct.name}
        onChangeText={(name) => setEditedProduct({ ...editedProduct, name })}
      />
      <Button onPress={handleSave}>Save</Button>
    </Modal>
  )
}
```

---

## Benefits Achieved

### 1. **Simplified Component API**
- POSCheckout: 30+ props → 1 prop
- POSCart: 12 props → 11 props
- POSCustomerMatchModal: 6 props → 0 props (TRUE ZERO PROPS)
- POSAddCustomerModal: 8 props → 0 props
- POSUnifiedCustomerSelector: 10+ props → 0 props

### 2. **Improved Maintainability**
- Clear separation: Context (env) vs Stores (transient)
- No prop drilling through 3-4 layers
- Easy to add new features (just add to store)
- Components only care about their immediate needs

### 3. **Better Performance**
- Selective re-renders with store selectors
- Memoization works better (fewer props to compare)
- No unnecessary re-renders from prop changes

### 4. **Enhanced Developer Experience**
- Redux DevTools for debugging all state
- Clear action names in DevTools
- Easy to test (just mock stores)
- Self-documenting (stores show all available data/actions)

### 5. **Easier Onboarding**
- New developers can see all available data in stores
- No need to trace props through multiple files
- Actions are discoverable via `customerActions.`, `cartActions.`, etc.

---

## Migration Checklist

When applying this pattern to Products or any other feature:

- [ ] **Identify data layers**
  - [ ] What's environmental? (Context)
  - [ ] What's transient? (Stores)

- [ ] **Create/update stores**
  - [ ] Create focused stores (products.store, product-ui.store)
  - [ ] Add devtools middleware
  - [ ] Export selectors for each state field
  - [ ] Export actions object

- [ ] **Update root component**
  - [ ] Remove local state
  - [ ] Use Context for env data
  - [ ] Use stores for transient data
  - [ ] Remove props from child components

- [ ] **Update child components**
  - [ ] Remove props interfaces (or reduce to data-only)
  - [ ] Read from stores using selectors
  - [ ] Use action objects for mutations
  - [ ] Add comments showing architecture

- [ ] **Update modals to TRUE ZERO PROPS**
  - [ ] Read visible state from UI store
  - [ ] Read data from data stores
  - [ ] Call store actions directly in handlers
  - [ ] Remove all props

- [ ] **Test**
  - [ ] Verify Redux DevTools shows all actions
  - [ ] Verify re-renders are optimal
  - [ ] Test that state persists correctly

---

## Common Pitfalls to Avoid

### ❌ Pitfall 1: Mixing Local State with Store State

**Wrong:**
```typescript
const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

const handleSelectCustomer = (customer: Customer) => {
  setSelectedCustomer(customer)  // Local state
  customerActions.selectCustomer(customer)  // Store
}
```

**Right:**
```typescript
const selectedCustomer = useSelectedCustomer()  // Always from store

const handleSelectCustomer = (customer: Customer) => {
  customerActions.selectCustomer(customer)  // Only store
}
```

### ❌ Pitfall 2: Overusing Context

**Wrong:**
```typescript
// DON'T put frequently changing data in Context
<CartContext.Provider value={{ items, setItems }}>
```

**Right:**
```typescript
// Use stores for frequently changing data
const items = useCartItems()
cartActions.addToCart(product)
```

### ❌ Pitfall 3: Not Using Selectors

**Wrong (causes unnecessary re-renders):**
```typescript
const store = useCustomerStore()  // Re-renders on ANY store change
const customer = store.selectedCustomer
```

**Right:**
```typescript
const customer = useSelectedCustomer()  // Only re-renders when customer changes
```

### ❌ Pitfall 4: Circular Dependencies

**Wrong:**
```typescript
// cart.store.ts
import { customerActions } from './customer.store'

// customer.store.ts
import { cartActions } from './cart.store'
```

**Right:**
```typescript
// Create coordinated actions in parent component
const handleClearAll = () => {
  cartActions.clearCart()
  customerActions.clearCustomer()
}
```

---

## Testing Strategy

### Unit Testing Stores

```typescript
import { renderHook, act } from '@testing-library/react-hooks'
import { useCustomerStore, customerActions } from '../customer.store'

describe('CustomerStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useCustomerStore.setState({
      selectedCustomer: null,
      scannedDataForNewCustomer: null,
      customerMatches: [],
    })
  })

  it('should select a customer', () => {
    const customer = { id: '1', name: 'Test' }

    act(() => {
      customerActions.selectCustomer(customer)
    })

    const { result } = renderHook(() => useSelectedCustomer())
    expect(result.current).toEqual(customer)
  })

  it('should clear customer', () => {
    const customer = { id: '1', name: 'Test' }

    act(() => {
      customerActions.selectCustomer(customer)
      customerActions.clearCustomer()
    })

    const { result } = renderHook(() => useSelectedCustomer())
    expect(result.current).toBeNull()
  })
})
```

### Component Testing with Stores

```typescript
import { render, fireEvent } from '@testing-library/react-native'
import { customerActions } from '../stores/customer.store'
import { POSCart } from '../POSCart'

jest.mock('../stores/customer.store')

describe('POSCart', () => {
  it('should open customer selector on button press', () => {
    const { getByText } = render(<POSCart />)

    fireEvent.press(getByText('Customer'))

    expect(checkoutUIActions.openModal).toHaveBeenCalledWith('customerSelector')
  })
})
```

---

## Performance Optimization

### Use Shallow Comparison for Objects

```typescript
import { useShallow } from 'zustand/react/shallow'

// Instead of:
const { subtotal, itemCount } = useCartTotals()  // May re-render unnecessarily

// Use:
const { subtotal, itemCount } = useCartTotals(
  useShallow((state) => ({
    subtotal: state.subtotal,
    itemCount: state.itemCount
  }))
)
```

### Memoize Selectors

```typescript
const filteredProducts = useMemo(() => {
  return products.filter(p => p.category === selectedCategory)
}, [products, selectedCategory])
```

### Use Action Objects Outside Components

```typescript
// Good - no re-render
setTimeout(() => {
  cartActions.clearCart()
}, 1000)

// Bad - creates new function on each render
const clearCart = useCartStore((state) => state.clearCart)
setTimeout(clearCart, 1000)
```

---

## Conclusion

The Zero Prop Drilling architecture provides:

1. ✅ **Clear separation** of concerns (Context vs Stores)
2. ✅ **Simplified components** (fewer props, clearer intent)
3. ✅ **Better performance** (selective re-renders)
4. ✅ **Enhanced debugging** (Redux DevTools visibility)
5. ✅ **Easier maintenance** (focused stores, discoverable actions)

Apply this same pattern to Products, Orders, or any complex feature to achieve the same benefits.

---

## Quick Reference

### When to Use Context
- ✅ Authentication state
- ✅ Session information
- ✅ Configuration data
- ✅ Rarely changing environmental data

### When to Use Stores
- ✅ UI state (modals, filters, selections)
- ✅ Business data (cart, products, customers)
- ✅ Frequently changing state
- ✅ State that needs DevTools visibility

### When to Pass Props
- ✅ Data items in lists (product in ProductCard)
- ✅ Complex orchestration callbacks (onPaymentComplete)
- ✅ Generic reusable components (Button, Input)

---

**Last Updated:** November 23, 2025
**Applied To:** POS System (Checkout, Cart, Customer Selection)
**Next Target:** Products View
