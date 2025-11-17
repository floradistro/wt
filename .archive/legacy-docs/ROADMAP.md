# WhaleTools Native - Product Roadmap

**Last Updated:** November 15, 2025  
**Current Version:** 1.0.0  
**Next Target:** 1.1.0 (Q1 2026)

---

## 🎯 Vision

Build the most elegant, reliable POS system for cannabis dispensaries with Apple-level quality and attention to detail.

---

## ✅ Completed (v1.0.0)

### Core Features
- ✅ POS screen with cart, products, and checkout
- ✅ ID scanner with AAMVA parsing
- ✅ Payment processing (Dejavoo integration)
- ✅ Customer management with loyalty points
- ✅ Session management (cash drawer, registers)
- ✅ Design system (455-line token system)
- ✅ Liquid glass UI components

### Infrastructure
- ✅ TypeScript with strict mode
- ✅ Zustand for global state
- ✅ Supabase backend integration
- ✅ Error boundaries
- ✅ Test suite foundation
- ✅ ESLint configuration

---

## 🔥 In Progress (v1.1.0 - Next 4 Weeks)

### Critical Architectural Fixes

#### 1. Refactor POSScreen (Week 1-2)
**Priority:** 🔴 CRITICAL  
**Effort:** 3-5 days  
**Impact:** Maintainability, scalability

**Current State:**
- 1,072 lines
- 14+ pieces of state
- Handles session, products, cart, filters, loyalty, modals

**Target Architecture:**
```
POSScreen (orchestrator - 200 lines)
├── POSSessionSetup (location/register - 150 lines)
│   ├── POSLocationSelector (existing)
│   └── POSRegisterSelector (existing)
├── POSProductBrowser (300 lines)
│   ├── POSSearchBar (existing)
│   ├── POSProductGrid (existing)
│   └── POSFilters (new)
├── POSCheckout (400 lines)
│   ├── POSCart (existing)
│   ├── POSCustomerSelector (existing)
│   └── POSPaymentModal (existing)
└── POSSessionActions (new - 100 lines)
    ├── OpenCashDrawerModal (existing)
    └── CloseCashDrawerModal (existing)
```

**Deliverables:**
- [ ] Extract POSProductBrowser component
- [ ] Extract POSCheckout component
- [ ] Extract POSSessionActions component
- [ ] Update tests for new structure
- [ ] Performance benchmarks

---

#### 2. Expand Test Coverage to 70% (Week 2-3)
**Priority:** 🔴 CRITICAL  
**Effort:** 4-6 days  
**Impact:** Code quality, confidence

**Test Plan:**

**Hooks (Target: 90% coverage)**
- [x] useCart.ts (7 tests) ✅
- [ ] useFilters.ts (8 tests needed)
  - Filter by category
  - Filter by strain type
  - Filter by consistency
  - Filter by flavor
  - Search functionality
  - Clear filters
  - Active filter count
  - Combined filters
- [ ] useSession.ts (6 tests needed)
  - Load vendor/locations
  - Select location
  - Select register
  - Open cash drawer
  - Close cash drawer
  - Session data updates
- [ ] useLoyalty.ts (5 tests needed)
  - Calculate discount
  - Max redeemable points
  - Point redemption
  - Reset loyalty
  - Invalid point values

**Utilities (Target: 95% coverage)**
- [ ] product-transformers.ts (10 tests needed)
  - transformInventoryToProducts
  - applyFilters
  - extractCategories
  - getLowestPrice
  - isProductInStock
  - getMatchingFilters
  - Edge cases (null, empty arrays)

**Integration Tests**
- [ ] Payment flow (5 tests)
  - Successful card payment
  - Failed payment
  - Split payment (cash + card)
  - Minimum card amount
  - Payment processor offline
- [ ] Checkout flow (4 tests)
  - Complete checkout
  - Apply loyalty discount
  - Calculate tax correctly
  - Empty cart handling

**Coverage Goals:**
```
Hooks:     90% (target)
Utils:     95% (target)
Stores:    80% (target)
Components: 60% (target)
Overall:   70% (target)
```

---

#### 3. Fix ESLint & Code Quality (Week 3)
**Priority:** 🟡 HIGH  
**Effort:** 1-2 days  
**Impact:** Code quality

**Tasks:**
- [ ] Set max-warnings to 0
- [ ] Re-enable react-hooks/rules-of-hooks
- [ ] Re-enable react-hooks/exhaustive-deps
- [ ] Fix all existing warnings (~20)
- [ ] Add pre-commit hook for linting
- [ ] Document exceptions (if any)

---

#### 4. State Management Consolidation (Week 4)
**Priority:** 🟡 HIGH  
**Effort:** 2-3 days  
**Impact:** Consistency, debugging

**Current State:**
- Session info: Local state in POSScreen
- Payment processor: Zustand (global)
- Auth: Zustand (global)

**Target State:**
```typescript
// All global state in Zustand
src/stores/
├── auth.store.ts (existing) ✅
├── payment-processor.store.ts (existing) ✅
├── session.store.ts (new) 🆕
│   ├── sessionInfo
│   ├── locations
│   ├── selectedRegister
│   └── sessionData
└── cart.store.ts (optional) 🤔
    └── Consider moving cart to Zustand
```

**Benefits:**
- Easier debugging with Redux DevTools
- Persistent session across tab switches
- Cleaner component code

---

## 🚀 Planned (v1.2.0 - Q1 2026)

### Feature Enhancements

#### 1. Advanced Analytics Dashboard
**Priority:** 🟢 MEDIUM  
**Effort:** 1 week

- Daily sales charts
- Top products
- Customer insights
- Inventory alerts
- Payment processor health history

#### 2. Inventory Management Screen
**Priority:** 🟢 MEDIUM  
**Effort:** 1 week

- Currently just placeholder
- Add/edit products
- Bulk import
- Stock alerts
- Category management

#### 3. Order History & Receipts
**Priority:** 🟢 MEDIUM  
**Effort:** 3 days

- Search past orders
- Reprint receipts
- Refund processing
- Customer purchase history

#### 4. Offline Mode
**Priority:** 🟡 HIGH  
**Effort:** 2 weeks

- Cache product data
- Queue transactions
- Sync when online
- Conflict resolution

---

## 🔮 Future (v2.0.0 - Q2 2026)

### Major Features

#### 1. Multi-Store Support
- Switch between locations
- Consolidated reporting
- Franchise management

#### 2. Staff Management
- Role-based permissions
- Time tracking
- Performance metrics
- Shift management

#### 3. Advanced Loyalty
- Tiered programs
- Birthday rewards
- Referral bonuses
- Points expiration

#### 4. Delivery Integration
- Delivery tracking
- Driver assignment
- Route optimization
- Customer notifications

---

## 🛠 Technical Debt Backlog

### High Priority
1. [ ] Refactor POSScreen (see v1.1.0)
2. [ ] Add request retry logic to payment processor
3. [ ] Optimize re-renders in POSProductGrid
4. [ ] Add error boundaries to modals
5. [ ] Document all component props with JSDoc

### Medium Priority
6. [ ] Update dependencies (React 19.2, RN 0.82)
7. [ ] Implement code splitting
8. [ ] Add performance monitoring (Sentry/Firebase)
9. [ ] Create Storybook for components
10. [ ] Add E2E tests with Detox

### Low Priority
11. [ ] Migrate to React Navigation (consider)
12. [ ] Add animations to list updates
13. [ ] Implement haptic patterns library
14. [ ] Create developer documentation
15. [ ] Add contribution guidelines

---

## 📊 Success Metrics

### v1.1.0 Goals
- 🎯 Test coverage: 0% → 70%
- 🎯 POSScreen size: 1,072 → <300 lines
- 🎯 ESLint warnings: 20 → 0
- 🎯 State consistency: 60% → 100%
- 🎯 Overall quality grade: B+ → A-

### v1.2.0 Goals
- 🎯 All core features implemented
- 🎯 Production-ready offline mode
- 🎯 Analytics dashboard live
- 🎯 Test coverage: 70% → 85%
- 🎯 Overall quality grade: A- → A

### v2.0.0 Goals
- 🎯 Multi-store support
- 🎯 100+ users in production
- 🎯 99.9% uptime
- 🎯 <100ms UI response time
- 🎯 Overall quality grade: A

---

## 🤝 Contributing

### For Team Members
1. Check this roadmap for current priorities
2. Pick tasks from "In Progress" section
3. Create feature branch from `main`
4. Write tests first (TDD)
5. Ensure all tests pass
6. Submit PR with description

### Code Review Checklist
- [ ] Tests written and passing
- [ ] No ESLint warnings
- [ ] Design system components used
- [ ] Performance considered
- [ ] Error handling added
- [ ] Documentation updated

---

## 📞 Contact & Resources

**Project Lead:** [Your Name]  
**Slack Channel:** #whaletools-native  
**Design System:** `/src/theme/tokens.ts`  
**Architecture Docs:** `HONEST_APPLE_ASSESSMENT.md`

---

**Next Review:** Weekly (Mondays 10am)  
**Sprint Duration:** 2 weeks  
**Release Cadence:** Every 4-6 weeks
