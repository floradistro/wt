# Implementation Guide - Replace API Calls with Supabase Services

**Created:** November 16, 2025
**Status:** Ready to implement

---

## 📁 **What Was Created**

### **New Service Files:**

```
src/services/
├── index.ts                   # Central export
├── loyalty.service.ts         # ✅ Loyalty program operations
├── orders.service.ts          # ✅ Order CRUD operations
├── products.service.ts        # ✅ Product & inventory operations
└── customers.service.ts       # ✅ Customer operations
```

---

## 🎯 **Immediate Action Required**

### **Replace Loyalty API Call**

**File to update:** `src/hooks/pos/useLoyalty.ts`

**Current code (lines 17-29):**
```typescript
// ❌ REMOVE THIS
const response = await fetch(`${BASE_URL}/api/vendor/loyalty/program`, {
  headers: {
    'x-vendor-id': vendorId,
  },
})

if (response.ok) {
  const data = await response.json()
  setLoyaltyProgram(data.program)
}
```

**Replace with:**
```typescript
// ✅ USE THIS INSTEAD
import { loyaltyService } from '@/services'

useEffect(() => {
  const loadLoyaltyProgram = async () => {
    if (!vendorId) return

    try {
      const program = await loyaltyService.getLoyaltyProgram(vendorId)
      setLoyaltyProgram(program)
    } catch (error) {
      // Silently fail - loyalty is optional
      console.error('Failed to load loyalty program:', error)
    }
  }

  loadLoyaltyProgram()
}, [vendorId])
```

---

## 📖 **How to Use the Services**

### **1. Import Services**

```typescript
// Import individual services
import { ordersService } from '@/services/orders.service'
import { productsService } from '@/services/products.service'
import { customersService } from '@/services/customers.service'
import { loyaltyService } from '@/services/loyalty.service'

// OR import from index
import { ordersService, productsService, customersService, loyaltyService } from '@/services'
```

---

### **2. Orders Service Examples**

```typescript
import { ordersService } from '@/services'

// Get all orders
const orders = await ordersService.getOrders({ limit: 20 })

// Get today's orders (for POS)
const todaysOrders = await ordersService.getTodaysOrders()

// Get single order with items
const order = await ordersService.getOrderById(orderId)

// Create order
const newOrder = await ordersService.createOrder({
  customer_id: customerId,
  vendor_id: vendorId,
  items: [
    {
      product_id: 'prod_123',
      quantity: 2,
      unit_price: 10.00,
      subtotal: 20.00,
      tax_amount: 1.60,
      discount_amount: 0,
      total: 21.60,
    }
  ],
  subtotal: 20.00,
  tax_amount: 1.60,
  discount_amount: 0,
  total_amount: 21.60,
  payment_method: 'cash',
  payment_status: 'paid',
  status: 'completed',
})

// Search orders
const results = await ordersService.searchOrders('ORD-20251116')
```

---

### **3. Products Service Examples**

```typescript
import { productsService } from '@/services'

// Get all products
const products = await productsService.getProducts()

// Search products (for POS)
const searchResults = await productsService.searchProducts('apple')

// Get product by barcode (for scanning)
const product = await productsService.getProductByBarcode('123456789')

// Get products with inventory for a location
const productsWithStock = await productsService.getProductsWithInventory(locationId)

// Check if product has enough inventory
const hasStock = await productsService.checkInventoryAvailability(
  productId,
  locationId,
  quantity
)

// Get low stock products
const lowStock = await productsService.getLowStockProducts(locationId, threshold)
```

---

### **4. Customers Service Examples**

```typescript
import { customersService } from '@/services'

// Search customers (for POS)
const customers = await customersService.searchCustomers('john')

// Get customer by phone
const customer = await customersService.getCustomerByPhone('555-1234')

// Create new customer
const newCustomer = await customersService.createCustomer({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '555-1234',
  vendor_id: vendorId,
})

// Get customer with recent orders
const customerWithOrders = await customersService.getCustomerWithOrders(customerId)

// Update loyalty points
await customersService.updateCustomerLoyaltyPoints(customerId, 100) // Add 100 points
```

---

### **5. Loyalty Service Examples**

```typescript
import { loyaltyService } from '@/services'

// Get loyalty program settings
const program = await loyaltyService.getLoyaltyProgram(vendorId)

// Get customer's current points balance
const points = await loyaltyService.getCustomerLoyaltyBalance(customerId)

// Calculate discount from points (client-side preview only)
const discount = loyaltyService.calculateLoyaltyDiscount(pointsToRedeem, program)

// Note: Points calculation and updates now happen server-side in the
// process-checkout edge function for security and atomicity.
// The edge function calls:
// - calculate_loyalty_points_to_earn() for server-side calculation
// - update_customer_loyalty_points_atomic() for atomic updates
```

---

## 🚀 **React Hooks Pattern**

Create custom hooks that wrap the services:

```typescript
// src/hooks/useOrders.ts
import { useState, useEffect } from 'react'
import { ordersService, type Order } from '@/services'

export function useOrders(limit = 20) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true)
        const data = await ordersService.getOrders({ limit })
        setOrders(data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [limit])

  return { orders, loading, error }
}

// Usage in component:
const { orders, loading, error } = useOrders(20)
```

---

## ⚠️ **What to KEEP (Don't Replace)**

### **These API calls are NECESSARY:**

1. **Payment Processing**
   - `POST /api/pos/payment/process`
   - File: `src/components/pos/POSPaymentModal.tsx`
   - Reason: Requires backend for payment terminals

2. **Processor Health Check**
   - `GET /api/pos/payment-processors/health`
   - File: `src/stores/payment-processor.store.ts`
   - Reason: Terminal connectivity testing

3. **Processor Test**
   - `POST /api/pos/payment-processors/test`
   - File: `src/stores/payment-processor.store.ts`
   - Reason: Terminal validation

4. **Dejavoo Library**
   - File: `src/lib/dejavoo.ts`
   - Reason: Payment terminal SDK

---

## 🧪 **Testing**

After implementing, test each service:

```typescript
// Test orders service
const orders = await ordersService.getTodaysOrders()
console.log('Today\'s orders:', orders)

// Test products service
const product = await productsService.getProductByBarcode('123456')
console.log('Product:', product)

// Test customers service
const customer = await customersService.getCustomerByPhone('555-1234')
console.log('Customer:', customer)

// Test loyalty service
const program = await loyaltyService.getLoyaltyProgram(vendorId)
console.log('Loyalty program:', program)
```

---

## 📊 **Migration Checklist**

- [ ] Update `useLoyalty.ts` to use loyaltyService
- [ ] Test loyalty program loading
- [ ] Create `useOrders` hook using ordersService
- [ ] Create `useProducts` hook using productsService
- [ ] Create `useCustomers` hook using customersService
- [ ] Remove any unused API calls
- [ ] Test all POS flows with new services
- [ ] Verify real-time updates work (if needed)
- [ ] Remove EXPO_PUBLIC_API_URL dependency for data operations (keep for payments)

---

## 🎯 **Next Steps**

1. **Immediate:** Update `useLoyalty.ts` (1 file change)
2. **Soon:** Create React hooks for orders, products, customers
3. **Later:** Add real-time subscriptions where needed

---

## 📖 **Additional Resources**

**Documentation:**
- `API_AUDIT_REPORT.md` - Full audit findings
- Supabase docs: https://supabase.com/docs

**Service Files:**
- All services have inline JSDoc comments
- Each function has type definitions
- Error handling included

---

## ✅ **Benefits of This Approach**

1. ✅ **Faster** - Direct database access, no API middleman
2. ✅ **Real-time** - Can add Supabase subscriptions easily
3. ✅ **Offline** - Easier to implement offline support
4. ✅ **Type-safe** - Full TypeScript support
5. ✅ **Maintainable** - All DB logic in one place
6. ✅ **Scalable** - Easy to add caching, optimistic updates

---

**Ready to implement! Start with updating `useLoyalty.ts`.**
