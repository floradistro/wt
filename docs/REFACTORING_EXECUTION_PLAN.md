# Component Refactoring Execution Plan
## Apple Engineering Standards - Complete Implementation

**Status:** Ready for Execution
**Goal:** Reduce all files to <300 lines
**Current:** 18 files over 300 lines
**Estimated Time:** 8-12 hours of focused work

---

## COMPLETED (Session 1)

✅ **Created Foundation:**
- `/src/components/pos/payment/PaymentTypes.ts` (58 lines)
- `/src/components/pos/payment/CashPaymentView.tsx` (246 lines)

---

## PHASE 1: POSPaymentModal (1,481 → 5 files)

### Priority: CRITICAL
### Estimated Time: 3 hours

**Files to Create:**

1. ✅ **PaymentTypes.ts** (58 lines) - DONE
   - Shared types and interfaces
   - No dependencies

2. ✅ **CashPaymentView.tsx** (246 lines) - DONE
   - Cash payment UI
   - Quick amount buttons
   - Change calculation
   - Input handling

3. **CardPaymentView.tsx** (280 lines)
   ```typescript
   // Single Responsibility: Card payment processing
   - Terminal connection UI
   - Payment stage indicator
   - Card processing logic
   - Sentry integration for card payments
   - Error handling with retry logic
   ```

4. **SplitPaymentView.tsx** (250 lines)
   ```typescript
   // Single Responsibility: Split payment handling
   - Cash/card input fields
   - Total validation
   - Fill buttons for auto-calculation
   - Combined payment processing
   ```

5. **POSPaymentModal.tsx** (300 lines)
   ```typescript
   // Single Responsibility: Payment orchestration
   - Modal container
   - Tab switching (Cash/Card/Split)
   - Summary section
   - Action buttons
   - Animation handling
   - Route to appropriate payment view
   ```

**Dependencies:**
- All views import from `PaymentTypes.ts`
- Modal imports all 3 views
- No circular dependencies

**Testing Checklist:**
- [ ] Cash payment completes successfully
- [ ] Card payment processes correctly
- [ ] Split payment calculates properly
- [ ] Modal animations work
- [ ] All haptic feedback functional
- [ ] Error handling preserved
- [ ] Type-check passes

---

## PHASE 2: ProductsScreen (1,146 → 3 files)

### Priority: HIGH
### Estimated Time: 2 hours

**Files to Create:**

1. **ProductListPanel.tsx** (450 lines)
   ```typescript
   // Single Responsibility: Product list display
   - Grid/list view of products
   - Search filtering
   - Category filtering
   - Selection handling
   - Product cards
   ```

2. **ProductDetailPanel.tsx** (450 lines)
   ```typescript
   // Single Responsibility: Product detail view
   - Product information display
   - Edit capabilities
   - Pricing information
   - Stock status
   - Actions (edit, delete)
   ```

3. **ProductsScreen.tsx** (250 lines)
   ```typescript
   // Single Responsibility: Screen orchestration
   - Layout container
   - Panel switching logic
   - State management
   - Navigation
   ```

---

## PHASE 3: SettingsScreen (1,087 → 4 files)

### Priority: HIGH
### Estimated Time: 2 hours

**Files to Create:**

1. **SettingsCategoryList.tsx** (200 lines)
   ```typescript
   // Single Responsibility: Category navigation
   - Category list display
   - Category icons
   - Selection handling
   - Active state
   ```

2. **settings/ProfileDetail.tsx** (220 lines)
   ```typescript
   // Single Responsibility: Profile settings
   - User profile display
   - Name/email editing
   - Avatar management
   ```

3. **settings/LocationsDetail.tsx** (220 lines)
   ```typescript
   // Single Responsibility: Location settings
   - Location list
   - Location selection
   - Location management
   ```

4. **settings/DeveloperToolsDetail.tsx** (200 lines)
   ```typescript
   // Single Responsibility: Developer tools
   - Sentry testing
   - Debug options
   - Test buttons
   ```

5. **SettingsScreen.tsx** (250 lines)
   ```typescript
   // Single Responsibility: Settings orchestration
   - Split view layout
   - Category <-> Detail routing
   - Sign out handling
   ```

---

## PHASE 4: POSUnifiedCustomerSelector (958 → 4 files)

### Priority: HIGH
### Estimated Time: 2.5 hours

**Files to Create:**

1. **CameraScanView.tsx** (250 lines)
   ```typescript
   // Single Responsibility: ID scanning
   - Camera initialization
   - Barcode detection
   - AAMVA parsing
   - Scan feedback
   ```

2. **CustomerSearchView.tsx** (250 lines)
   ```typescript
   // Single Responsibility: Customer search
   - Search input
   - Results list
   - Filtering logic
   - Selection handling
   ```

3. **CustomerMatchingLogic.tsx** (200 lines)
   ```typescript
   // Single Responsibility: Customer matching
   - Name matching algorithm
   - Fuzzy search
   - Match scoring
   - Duplicate detection
   ```

4. **POSUnifiedCustomerSelector.tsx** (260 lines)
   ```typescript
   // Single Responsibility: Customer selector orchestration
   - Mode switching (scan/search)
   - Results coordination
   - Modal management
   - Props delegation
   ```

---

## PHASE 5: Remaining Large Files (14 files)

### Priority: MEDIUM
### Estimated Time: 4-6 hours

**Files to Refactor:**

1. **POSCheckout.tsx** (768 → 3 files @ 250 lines each)
   - `CheckoutContainer.tsx` - Main orchestration
   - `CheckoutModals.tsx` - Modal management
   - `CheckoutActions.tsx` - Payment/customer actions

2. **POSAddCustomerModal.tsx** (765 → 3 files)
   - `CustomerForm.tsx` - Form fields
   - `CustomerValidation.tsx` - Validation logic
   - `POSAddCustomerModal.tsx` - Modal wrapper

3. **EditablePricingSection.tsx** (744 → 3 files)
   - `SimplePricingView.tsx` - Fixed price mode
   - `WeightPricingView.tsx` - Weight-based mode
   - `TierPricingView.tsx` - Tiered pricing mode

4. **payment-processor.store.ts** (694 → 2 files)
   - `payment-processor.store.ts` - Core store
   - `payment-processor.health.ts` - Health check logic

5. **components.tsx (theme)** (673 → 2 files)
   - `components.tsx` - Layout components
   - `form-components.tsx` - Form-specific components

6. **POSCart.tsx** (591 → 2 files)
   - `POSCart.tsx` - Cart display
   - `POSCartItem.tsx` - Individual cart item

7. **POSRegisterSelector.tsx** (563 → 2 files)
   - `RegisterList.tsx` - Register options
   - `POSRegisterSelector.tsx` - Modal wrapper

8. **POSProductCard.tsx** (554 → 2 files)
   - `POSProductCard.tsx` - Card layout
   - `ProductPricing.tsx` - Pricing display logic

9. **EditProductModal.tsx** (553 → 2 files)
   - `ProductForm.tsx` - Form sections
   - `EditProductModal.tsx` - Modal wrapper

10. **POSProductBrowser.tsx** (549 → 2 files)
    - `ProductGrid.tsx` - Grid display
    - `POSProductBrowser.tsx` - Browser wrapper

11. **MoreScreen.tsx** (530 → 2 files)
    - `NavigationGrid.tsx` - Nav options
    - `MoreScreen.tsx` - Screen wrapper

12. **dejavoo.ts** (514 → 2 files)
    - `dejavoo.ts` - Core integration
    - `dejavoo-types.ts` - Type definitions

13. **CloseCashDrawerModal.tsx** (509 → 2 files)
    - `CashSummaryForm.tsx` - Form inputs
    - `CloseCashDrawerModal.tsx` - Modal wrapper

14. **ScanScreen.tsx** (488 → 2 files)
    - `BarcodeScanner.tsx` - Camera component
    - `ScanScreen.tsx` - Screen wrapper

---

## EXECUTION METHODOLOGY

### Per-File Process:

1. **Analyze** (10 min)
   - Identify responsibilities
   - Map dependencies
   - Plan extraction points

2. **Extract** (30-60 min)
   - Create new component files
   - Move code to appropriate files
   - Preserve all functionality
   - Maintain type safety

3. **Integrate** (15 min)
   - Update imports
   - Wire up new components
   - Ensure props flow correctly

4. **Test** (15 min)
   - Run type-check
   - Manual UI testing
   - Verify all features work
   - Check animations/haptics

5. **Verify** (10 min)
   - Confirm < 300 lines
   - Check for regressions
   - Update documentation

### Safety Measures:

1. ✅ **Backup Original Files**
   ```bash
   cp POSPaymentModal.tsx POSPaymentModal.tsx.backup
   ```

2. ✅ **Type-Check After Each File**
   ```bash
   npm run type-check
   ```

3. ✅ **Git Commit After Each Phase**
   ```bash
   git add .
   git commit -m "refactor: POSPaymentModal into 5 components"
   ```

4. ✅ **Test in Running App**
   - Actually use the feature
   - Verify no visual regressions
   - Check error states

---

## SUCCESS CRITERIA

### Code Quality:
- [ ] All files < 300 lines
- [ ] No TypeScript errors
- [ ] No functionality broken
- [ ] All tests passing
- [ ] No console errors

### Performance:
- [ ] No performance degradation
- [ ] Animations smooth (60fps)
- [ ] No memory leaks
- [ ] Fast hot-reload

### Maintainability:
- [ ] Clear single responsibilities
- [ ] Well-named components
- [ ] Minimal prop drilling
- [ ] Good type safety
- [ ] Documentation comments

---

## ROLLBACK PLAN

If issues arise:

```bash
# Restore from backup
mv POSPaymentModal.tsx.backup POSPaymentModal.tsx

# Or revert git commit
git revert HEAD

# Or full reset
git reset --hard origin/master
```

---

## FINAL VERIFICATION

After all phases complete:

```bash
# 1. Type check
npm run type-check

# 2. Count lines
find src -name "*.tsx" -o -name "*.ts" | \
  grep -v ".test." | \
  xargs wc -l | \
  sort -rn | \
  head -20

# 3. Run lint
npm run lint

# 4. Test build
npm run type-check && echo "✅ ALL CHECKS PASSED"
```

Expected result: **0 files over 300 lines**

---

## TIME ESTIMATE SUMMARY

| Phase | Files | Est. Time |
|-------|-------|-----------|
| Phase 1: POSPaymentModal | 5 | 3 hours |
| Phase 2: ProductsScreen | 3 | 2 hours |
| Phase 3: SettingsScreen | 4 | 2 hours |
| Phase 4: POSUnifiedCustomerSelector | 4 | 2.5 hours |
| Phase 5: Remaining 14 files | 28 | 5 hours |
| **Total** | **44 files** | **14.5 hours** |

With testing and verification: **16-18 hours total**

---

## NEXT STEPS

**Option A: Continue Now** (Recommended if you have 3+ hours)
- I'll complete Phase 1 (POSPaymentModal)
- Test thoroughly
- Move to Phase 2

**Option B: Pause and Resume** (Recommended for safety)
- Review this plan
- Schedule dedicated refactoring time
- Execute phases sequentially with testing between each

**Option C: Automated Approach**
- I can create a script to do the refactoring
- Higher risk, but faster
- Requires thorough testing after

Which approach would you prefer?

---

**Current Status:** Foundation complete (2 of 44 files created)
**Next File:** CardPaymentView.tsx (280 lines)
**Ready to Continue:** Yes ✅
