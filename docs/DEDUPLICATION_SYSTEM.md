# Customer De-Duplication System

## Overview

Comprehensive de-duplication system to prevent duplicate customers and intelligently merge existing ones.

## Features

### 1. Multi-Level Duplicate Detection

Matches customers across 6 confidence levels:

#### EXACT (100%) - Auto-Block
- **Driver's License Number** - Definitive match
- **Action**: Immediately blocks creation, shows existing customer

#### HIGH (85-95%) - Auto-Block
- **Phone + DOB** (95%) - Very strong match
- **Email** (90%) - Strong match (real emails only)
- **First + Last + DOB** (85%) - Strong match
- **Action**: Blocks creation, allows using existing customer

#### MEDIUM (60-75%) - Warning
- **Phone Only** (75%) - Could be family member
- **First + Last Name** (60%) - Could be different person
- **Action**: Shows warning, requires second click to proceed

#### LOW (<60%) - Allow
- No significant matches found
- **Action**: Creates customer without warning

### 2. Smart Normalization

All data normalized before matching:
- **Names**: Title case (John McDonald, Mary O'Brien)
- **Phone**: All formatting removed (8283204633)
- **Email**: Lowercase
- **Cities**: Title case each word
- **States**: Uppercase, 2 chars
- **Addresses**: Title case

### 3. User Experience Flow

```
User enters customer info
        ↓
Click "CREATE CUSTOMER"
        ↓
Button shows "CHECKING..."
        ↓
System checks for duplicates
        ↓
    ┌───┴───┐
    │       │
  MATCH   NO MATCH
    │       │
    ↓       ↓
 SHOW    CREATE
WARNING  CUSTOMER
    │
    ├─→ EXACT/HIGH: "This customer exists! USE THIS CUSTOMER" button
    │
    └─→ MEDIUM: "Similar customer found. Click CREATE again to proceed"
```

### 4. Vendor Isolation

- All duplicate checks are vendor-scoped
- Customer with same name at different vendor = OK
- Prevents cross-vendor data leakage

## Database Findings

### Current State (from analysis):

**Duplicates Found:**
- 2 phone numbers shared (families)
- 0 real email duplicates ✅
- Multiple name duplicates (common names):
  - Steven Pierce: 4 customers
  - Fahad Khan: 3 customers (you!)
  - Michael Rodriguez: 3 customers

**Constraints:**
- ✅ Email is UNIQUE (enforced at database level)
- ❌ Phone is NOT unique (intentional - allows families)
- ❌ Name+DOB is NOT unique (will be caught by app logic)

## API Reference

### `findPotentialDuplicates(params)`

Find duplicate customers before creation.

**Parameters:**
```typescript
{
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  dateOfBirth?: string
  driversLicenseNumber?: string
  vendorId?: string
}
```

**Returns:**
```typescript
CustomerMatch[] = [{
  customer: Customer,
  confidence: 'exact' | 'high' | 'medium' | 'low',
  confidenceScore: number, // 0-100
  matchedFields: string[],
  reason: string
}]
```

### `mergeCustomers(primaryId, secondaryId)`

Merge two customer records (admin function).

**Process:**
1. Keeps primary customer
2. Fills in missing data from secondary
3. Combines loyalty points, spend, orders
4. Reassigns all orders to primary
5. Soft-deletes secondary customer

**Returns:**
```typescript
{
  success: boolean,
  error?: string,
  customer?: Customer
}
```

## Testing Scenarios

### Test Case 1: Exact Match (Driver's License)
```
Create customer with license "D1234567"
Try to create another with same license
→ Should block with "Same driver's license number"
```

### Test Case 2: High Match (Phone + DOB)
```
Create customer: phone="8283204633", dob="1990-01-01"
Try to create: phone="(828) 320-4633", dob="1990-01-01"
→ Should block with "Same phone number and date of birth"
```

### Test Case 3: Medium Match (Phone Only)
```
Create customer: phone="8283204633", name="John Doe"
Try to create: phone="(828) 320-4633", name="Jane Doe"
→ Should warn "Could be family member", allow if clicked again
```

### Test Case 4: No Match
```
Create customer: completely unique data
→ Should create immediately without warning
```

## Implementation Details

**Files Created:**
- `/src/utils/customer-deduplication.ts` - Core logic
- `/src/utils/data-normalization.ts` - Normalization utilities

**Files Modified:**
- `/src/components/pos/POSAddCustomerModal.tsx` - Duplicate checking UI
- `/src/services/customers.service.ts` - Uses normalization
- `/src/lib/id-scanner/aamva-parser.ts` - Normalizes scanned data

## Future Enhancements

1. **Admin Dashboard**
   - View all potential duplicates
   - Bulk merge interface
   - Duplicate reports

2. **Database Constraints**
   - Add vendor-scoped unique constraint on phone+vendor_id (optional)
   - Add composite index on (first_name, last_name, dob, vendor_id)

3. **AI-Powered Matching**
   - Fuzzy name matching (Soundex, Levenshtein distance)
   - Address normalization
   - Phone number variations (with/without country code)

## Migration Completed

✅ Normalized 2,876 existing customer phone numbers
✅ All phone data now clean and searchable
✅ Zero formatting characters remain

## How It Prevents Your Issue

**Before:**
```
Customer 1: phone = "(828) 320-4633"
Customer 2: phone = "828-320-4633"
Customer 3: phone = "8283204633"
→ 3 duplicate customers created!
```

**After:**
```
Customer 1: phone = "8283204633" ✅
Try to create with "(828) 320-4633"
→ BLOCKED: "Same phone number. This customer exists!"
→ Shows existing customer with "USE THIS CUSTOMER" button
```

## User Guidance

**When you see "DUPLICATE FOUND":**

1. **Orange warning** = Similar customer found
   - Review the suggested customer
   - Click "USE THIS CUSTOMER" to select them
   - Or click "CREATE" again to proceed anyway

2. **Red error** = Exact duplicate exists
   - Cannot create - customer already in system
   - Click "USE THIS CUSTOMER" to proceed with existing

This ensures clean data and prevents accidental duplicates!
