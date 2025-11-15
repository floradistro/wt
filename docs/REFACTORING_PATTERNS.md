# Refactoring Patterns Guide

This guide documents the proven patterns established during the POS refactoring. Use these patterns to refactor other screens in the app.

## 📋 Table of Contents

1. [Overview](#overview)
2. [The Pattern](#the-pattern)
3. [Step-by-Step Process](#step-by-step-process)
4. [Custom Hooks Pattern](#custom-hooks-pattern)
5. [Component Extraction Pattern](#component-extraction-pattern)
6. [Type Definitions Pattern](#type-definitions-pattern)
7. [Examples for Other Screens](#examples-for-other-screens)

---

## Overview

The refactoring follows a consistent pattern:

```
Large Screen (2000+ lines)
    ↓
Business Logic → Custom Hooks (100-150 lines each)
UI Sections → Components (200-500 lines each)
Shared Types → Centralized Type File
    ↓
Clean Screen (1200-1500 lines) - Orchestration only
```

**Benefits:**
- ✅ Reusable business logic
- ✅ Testable components
- ✅ Maintainable codebase
- ✅ Scalable architecture
- ✅ Parallel development

---

## The Pattern

### 1. **Identify Large Screens**
Target screens with:
- **2000+ lines** of code
- **Complex state management** (5+ useState calls)
- **Mixed concerns** (UI + business logic together)
- **Repeated logic** (copy-pasted code)

### 2. **Extract Business Logic to Hooks**
Create custom hooks for:
- **State management** (CRUD operations)
- **API calls** (data fetching/mutations)
- **Computed values** (derived state)
- **Side effects** (useEffect logic)

### 3. **Extract UI to Components**
Create components for:
- **Repeated sections** (lists, cards, forms)
- **Self-contained UI** (modals, sidebars, headers)
- **Complex widgets** (search bars, filters, charts)

### 4. **Centralize Types**
Create type files for:
- **Domain entities** (Product, Customer, Order)
- **Component props** (clear interfaces)
- **API responses** (data contracts)

---

## Step-by-Step Process

### Phase 1: Planning (1-2 hours)

1. **Analyze the screen**
   - Count lines of code
   - Identify state variables
   - Map out UI sections
   - Find repeated patterns

2. **Create extraction plan**
   - List hooks to create
   - List components to extract
   - Identify types to centralize

3. **Create documentation**
   ```bash
   touch docs/SCREEN_NAME_REFACTOR_STATUS.md
   ```

### Phase 2: Type Definitions (30 mins)

1. **Create centralized types file**
   ```bash
   touch src/types/screenName.ts
   ```

2. **Move all interfaces**
   ```typescript
   // src/types/inventory.ts
   export interface InventoryItem {
     id: string
     name: string
     quantity: number
     price: number
   }

   export interface InventoryFilters {
     search: string
     category: string
     inStock: boolean
   }
   ```

### Phase 3: Custom Hooks (2-3 hours)

1. **Create hooks directory**
   ```bash
   mkdir -p src/hooks/screenName
   touch src/hooks/screenName/index.ts
   ```

2. **Extract business logic**
   - One hook per concern (data, filters, etc.)
   - Keep hooks focused (100-150 lines max)
   - Return clear interface

**Example:**
```typescript
// src/hooks/inventory/useInventoryData.ts
export function useInventoryData() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = async () => {
    // API logic
  }

  const addItem = (item: InventoryItem) => {
    // Add logic
  }

  const updateItem = (id: string, updates: Partial<InventoryItem>) => {
    // Update logic
  }

  const deleteItem = (id: string) => {
    // Delete logic
  }

  useEffect(() => {
    fetchItems()
  }, [])

  return {
    items,
    loading,
    addItem,
    updateItem,
    deleteItem,
    refetch: fetchItems,
  }
}
```

3. **Create barrel export**
   ```typescript
   // src/hooks/inventory/index.ts
   export { useInventoryData } from './useInventoryData'
   export { useInventoryFilters } from './useInventoryFilters'
   ```

### Phase 4: Component Extraction (3-4 hours)

1. **Create component directories**
   ```bash
   mkdir -p src/components/screenName/{section1,section2}
   ```

2. **Extract UI sections**
   - Start with self-contained sections
   - Create clear prop interfaces
   - Keep components focused (200-500 lines)

**Example:**
```typescript
// src/components/inventory/InventoryList.tsx
interface InventoryListProps {
  items: InventoryItem[]
  loading: boolean
  onEdit: (item: InventoryItem) => void
  onDelete: (id: string) => void
}

export function InventoryList({
  items,
  loading,
  onEdit,
  onDelete,
}: InventoryListProps) {
  if (loading) {
    return <LoadingState />
  }

  if (items.length === 0) {
    return <EmptyState />
  }

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => (
        <InventoryItemCard
          item={item}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      )}
    />
  )
}
```

3. **Create barrel exports**
   ```typescript
   // src/components/inventory/index.ts
   export { InventoryList } from './InventoryList'
   export { InventoryItemCard } from './InventoryItemCard'
   export { InventoryFilters } from './InventoryFilters'
   ```

### Phase 5: Screen Integration (2-3 hours)

1. **Update imports**
   ```typescript
   // Before
   import { useState, useEffect } from 'react'

   // After
   import { useInventoryData, useInventoryFilters } from '@/hooks/inventory'
   import { InventoryList, InventoryFilters } from '@/components/inventory'
   import type { InventoryItem, InventoryFilters as Filters } from '@/types/inventory'
   ```

2. **Replace logic with hooks**
   ```typescript
   // Before
   const [items, setItems] = useState([])
   const [loading, setLoading] = useState(true)
   // ... 100 lines of logic

   // After
   const { items, loading, addItem, updateItem, deleteItem } = useInventoryData()
   ```

3. **Replace UI with components**
   ```typescript
   // Before
   return (
     <View>
       {/* 500 lines of JSX */}
     </View>
   )

   // After
   return (
     <View>
       <InventoryFilters {...filterProps} />
       <InventoryList {...listProps} />
     </View>
   )
   ```

### Phase 6: Testing & Validation (1-2 hours)

1. **Test TypeScript compilation**
   ```bash
   npx tsc --noEmit
   ```

2. **Test app functionality**
   - All features work
   - No runtime errors
   - Performance OK

3. **Update documentation**
   - Mark phase complete
   - Document any issues
   - Update metrics

---

## Custom Hooks Pattern

### Structure

```typescript
export function useFeatureName(params) {
  // State
  const [data, setData] = useState()
  const [loading, setLoading] = useState(false)

  // Operations
  const create = async (item) => { ... }
  const update = async (id, updates) => { ... }
  const remove = async (id) => { ... }

  // Side Effects
  useEffect(() => {
    // Initial load
  }, [dependencies])

  // Computed Values
  const computed = useMemo(() => {
    // Derive value
  }, [dependencies])

  // Return Interface
  return {
    // State
    data,
    loading,
    // Operations
    create,
    update,
    remove,
    // Computed
    computed,
  }
}
```

### Best Practices

✅ **DO:**
- Keep hooks focused (single responsibility)
- Return clear, consistent interface
- Use meaningful names
- Document complex logic
- Handle loading/error states
- Use TypeScript properly

❌ **DON'T:**
- Mix multiple concerns in one hook
- Return inconsistent shapes
- Forget error handling
- Skip TypeScript types
- Create mega-hooks (150+ lines)

---

## Component Extraction Pattern

### Structure

```typescript
interface ComponentProps {
  // Data
  items: Item[]

  // State
  loading: boolean

  // Callbacks
  onAction: (item: Item) => void

  // Optional
  variant?: 'default' | 'compact'
}

export function ComponentName({
  items,
  loading,
  onAction,
  variant = 'default',
}: ComponentProps) {
  // State (if needed)
  const [localState, setLocalState] = useState()

  // Handlers (if needed)
  const handleAction = () => { ... }

  // Render
  return (
    <View>
      {/* JSX */}
    </View>
  )
}

const styles = StyleSheet.create({
  // Styles
})
```

### Best Practices

✅ **DO:**
- Define clear prop interfaces
- Use TypeScript
- Keep components focused
- Extract styles to bottom
- Use barrel exports
- Add loading/empty states

❌ **DON'T:**
- Create god components (500+ lines)
- Mix business logic in components
- Forget prop types
- Inline complex logic
- Skip accessibility

---

## Type Definitions Pattern

### Structure

```typescript
// src/types/domain.ts

/**
 * Core entity types
 */
export interface Entity {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

/**
 * API request/response types
 */
export interface EntityCreateRequest {
  name: string
}

export interface EntityUpdateRequest {
  name?: string
}

/**
 * Component prop types
 */
export interface EntityListProps {
  entities: Entity[]
  onSelect: (entity: Entity) => void
}

/**
 * Utility types
 */
export type EntityWithMetadata = Entity & {
  metadata: Record<string, any>
}
```

### Best Practices

✅ **DO:**
- Group related types
- Document complex types
- Use clear naming
- Export all types
- Use type vs interface appropriately

❌ **DON'T:**
- Use `any` type
- Duplicate type definitions
- Create circular dependencies
- Skip documentation

---

## Examples for Other Screens

### Inventory Screen

**Hooks to create:**
- `useInventoryData()` - CRUD operations
- `useInventoryFilters()` - Search, category, stock filters
- `useInventoryExport()` - CSV/Excel export

**Components to extract:**
- `InventoryList` - Product list view
- `InventoryItemCard` - Individual product card
- `InventoryFilters` - Filter panel
- `InventoryForm` - Add/edit form
- `LowStockAlert` - Alert banner

### Orders Screen

**Hooks to create:**
- `useOrders()` - Fetch, filter orders
- `useOrderActions()` - Fulfill, cancel, refund
- `useOrderStats()` - Sales metrics

**Components to extract:**
- `OrdersList` - Orders list
- `OrderCard` - Individual order
- `OrderDetails` - Order detail view
- `OrderFilters` - Status, date filters
- `OrderStats` - Dashboard widgets

### Customers Screen

**Hooks to create:**
- `useCustomers()` - CRUD operations
- `useCustomerSearch()` - Search logic
- `useCustomerLoyalty()` - Points, tiers

**Components to extract:**
- `CustomerList` - Customer list
- `CustomerCard` - Customer card
- `CustomerProfile` - Detail view
- `CustomerForm` - Add/edit form
- `LoyaltyWidget` - Points display

### Reports Screen

**Hooks to create:**
- `useReportData()` - Fetch reports
- `useReportFilters()` - Date range, filters
- `useReportExport()` - PDF/CSV export

**Components to extract:**
- `ReportChart` - Chart widget
- `ReportTable` - Data table
- `ReportFilters` - Filter controls
- `ReportSummary` - Stats cards
- `DateRangePicker` - Date selector

---

## Checklist for Each Screen

### Planning
- [ ] Analyze screen complexity
- [ ] Count lines of code
- [ ] Identify state variables
- [ ] Map UI sections
- [ ] Create refactor plan document

### Implementation
- [ ] Create type definitions file
- [ ] Extract custom hooks
- [ ] Create barrel exports for hooks
- [ ] Extract UI components
- [ ] Create barrel exports for components
- [ ] Update screen to use hooks/components

### Testing
- [ ] TypeScript compiles
- [ ] App runs without errors
- [ ] All features work
- [ ] No performance degradation
- [ ] UI unchanged

### Documentation
- [ ] Update status document
- [ ] Document metrics
- [ ] Note any issues
- [ ] Update patterns guide

---

## Success Metrics

Track these metrics for each refactoring:

- **Lines Removed:** Target 30-40% reduction
- **New Files Created:** Hooks + Components + Types
- **TypeScript Errors:** 0 new errors
- **Runtime Errors:** 0 new errors
- **Reusability:** Can hooks/components be used elsewhere?
- **Testability:** Can code be unit tested?

---

## Tips & Tricks

1. **Start Small:** Extract one hook or component at a time
2. **Test Often:** Run the app after each extraction
3. **Use Git:** Commit after each successful extraction
4. **Ask Questions:** If unclear, clarify before refactoring
5. **Document:** Keep notes on decisions made
6. **Be Patient:** Quality refactoring takes time

---

## Common Pitfalls

### ❌ Over-extraction
Don't create a component for 10 lines of JSX. Balance DRY with simplicity.

### ❌ Under-extraction
Don't leave 1000-line components. Break down complexity.

### ❌ Premature Optimization
Don't optimize before measuring. Refactor for clarity first.

### ❌ Breaking Changes
Don't change functionality during refactoring. Preserve behavior.

### ❌ Poor Naming
Don't use vague names like `useData()`. Be specific: `useInventoryData()`.

---

## Conclusion

Follow these patterns to maintain a clean, scalable, and maintainable codebase. The POS refactoring proves these patterns work - apply them consistently across the app.

**Remember:** The goal is **reusability, testability, and maintainability** - not just fewer lines of code.
