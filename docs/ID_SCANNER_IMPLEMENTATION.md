# WhaleTools ID Scanner Implementation - Complete Overview

## Executive Summary
The WhaleTools web application implements a comprehensive ID scanning system for age verification in the POS (Point of Sale) system. This document provides a complete technical overview for migration to React Native.

---

## 1. CORE COMPONENTS

### 1.1 SimpleIDScanner Component
**File**: `/Users/whale/Desktop/whaletools/components/component-registry/pos/SimpleIDScanner.tsx`

**Purpose**: Low-level barcode scanning component that interfaces with camera hardware

**Key Features**:
- Real-time camera feed via `getUserMedia()` API
- PDF417 barcode detection using ZXing library
- Video to canvas rendering for frame capture
- Success sound effects using Web Audio API
- Real-time scanning loop (100ms intervals = 10fps)

**Technical Implementation**:
```
Camera Access Flow:
1. Request getUserMedia with environment (rear) camera
2. Stream video to <video> element
3. Render video frames to canvas in scanning loop
4. Use BrowserPDF417Reader to decode canvas
5. Parse AAMVA barcode data on detection
6. Play success beep and stop scanning
```

**Key Dependencies**:
- `@zxing/browser`: BrowserPDF417Reader for PDF417 decoding
- `@zxing/library`: DecodeHintType for scanning hints
- Web Audio API: For success beep sounds

**Camera Constraints**:
```javascript
{
  video: {
    facingMode: "environment",  // Rear camera only
    width: { ideal: 1280 },
    height: { ideal: 720 },
  }
}
```

**Scanning Loop**: Continuous canvas-based decoding every 100ms

---

### 1.2 POSIDScanner Component
**File**: `/Users/whale/Desktop/whaletools/components/component-registry/pos/POSIDScanner.tsx`

**Purpose**: Wrapper component that adds customer lookup/creation logic to SimpleIDScanner

**Responsibilities**:
1. Handles scan completion events from SimpleIDScanner
2. Calls backend API to lookup/match customers
3. Shows confirmation dialog for fuzzy matches
4. Provides fallback data for new customer creation

**Workflow**:
```
Scan Complete
    ↓
POST /api/pos/customers/scan-id
    ↓
Check Match Confirmation Needed?
    ├─ Exact Match (DL#) → Auto-select customer
    ├─ Fuzzy Match (Name+DOB) → Show confirmation dialog
    └─ No Match → Provide scanned data for new customer form
```

**Key Props**:
- `vendorId`: For customer lookup scope
- `locationId`: For transaction context
- `onCustomerFound(customer)`: Selected customer callback
- `onNoMatchFoundWithData(scannedData)`: New customer fallback

---

### 1.3 POSCustomerSelector Component
**File**: `/Users/whale/Desktop/whaletools/components/component-registry/pos/POSCustomerSelector.tsx`

**Purpose**: Primary customer selection interface with integrated ID scanner

**Features**:
- Customer search/dropdown
- ID scanner button in dropdown
- New customer form creation
- Loyalty points display

**Integration Points**:
- Opens POSIDScanner modal when "Scan ID / License" button clicked
- Routes scanned data to PrefilledData → NewCustomerForm
- Or auto-selects customer if match found

---

### 1.4 POSNewCustomerForm Component
**File**: `/Users/whale/Desktop/whaletools/components/component-registry/pos/POSNewCustomerForm.tsx`

**Purpose**: Creates new customer records with optional pre-filled ID data

**Pre-filled Fields** (from ID scan):
- firstName, middleName, lastName
- dateOfBirth
- address, city, state, postalCode

**Auto-Generated** (if missing):
- email: `{firstName}.{lastName}@walk-in.local`

---

### 1.5 POSCart Component
**File**: `/Users/whale/Desktop/whaletools/components/component-registry/pos/POSCart.tsx`

**Purpose**: Shopping cart with integrated ID scanner for customer selection

**Integration**:
```
POSCart
├─ POSCustomerSelector (with integrated ID scanner)
├─ POSIDScanner modal
└─ NewCustomerForm modal
```

**Key Functions**:
- `onAddToCart(product, quantity)`
- `onCheckout(customer, loyaltyPointsRedeemed?, loyaltyDiscountAmount?)`
- Manual discount application
- Loyalty point redemption

---

## 2. BARCODE PARSING LIBRARY

### 2.1 AAMVA Parser
**File**: `/Users/whale/Desktop/whaletools/lib/id-scanner/aamva-parser.ts`

**Standard**: AAMVA (American Association of Motor Vehicle Administrators) PDF417

**Exported Functions**:

#### parseAAMVABarcode(barcodeData: string): AAMVAData
Parses raw barcode text into structured data

**AAMVA Data Element IDs**:
```
Name Fields:
- DAA: Full name
- DAC: First name
- DAD: Middle name
- DCS: Last name

Birth/ID:
- DBB: Date of birth (MMDDCCYY format)
- DAQ: Driver license number
- DBA: License expiration date
- DBD: License issue date

Address:
- DAG: Street address
- DAI: City
- DAJ: State
- DAK: Zip code

Physical:
- DAU: Height
- DAY: Eye color
```

**Header Validation**:
```javascript
if (!barcodeData.includes("ANSI")) {
  throw new Error("Invalid AAMVA barcode format");
}
```

#### isLegalAge(dateOfBirth: string): boolean
**Purpose**: Age verification for 21+ requirement

**Implementation**:
```typescript
export function isLegalAge(dateOfBirth: string): boolean {
  const age = calculateAge(dateOfBirth);
  return age !== undefined && age >= 21;
}
```

#### calculateAge(dateOfBirth: string): number | undefined
Calculates age from YYYY-MM-DD format date

#### formatAAMVAData(data: AAMVAData): string
Formats parsed data for display

**Output Type: AAMVAData**
```typescript
interface AAMVAData {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  licenseNumber?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  height?: string;
  eyeColor?: string;
  issueDate?: string; // YYYY-MM-DD
  expirationDate?: string; // YYYY-MM-DD
  raw?: string; // Raw barcode data
}
```

---

## 3. BACKEND API ENDPOINTS

### 3.1 POST /api/pos/customers/scan-id
**File**: `/Users/whale/Desktop/whaletools/app/api/pos/customers/scan-id/route.ts`

**Purpose**: Customer lookup and matching logic

**Request Body**:
```typescript
interface ScanIDRequest {
  scannedData: AAMVAData;
  vendorId: string;
  locationId: string;
}
```

**Matching Strategy** (in order):
1. **Exact Match by Driver's License Number** (highest accuracy)
   - Query: `drivers_license_number === scannedData.licenseNumber`
   - Result: Auto-select (no confirmation needed)

2. **Exact Name + DOB Match**
   - Query: `first_name + last_name + date_of_birth`
   - Result: Auto-select if single match

3. **Fuzzy Match by DOB + Name Similarity**
   - Gets all customers with matching DOB
   - Calculates similarity score:
     - Last name exact match: +50 points
     - Last name starts with/contains: +30/+20 points
     - First name exact match: +30 points
     - First name starts with/contains: +20/+10 points
     - Middle name match: +15 points
   - Minimum threshold: 50 points
   - Result: Requires user confirmation

**Response**:
```typescript
{
  success: true,
  customer: Customer | null,
  isNew: boolean,
  requiresConfirmation: boolean,
  matchType: "license" | "name_dob" | null,
  message: string
}
```

**Security**:
- Requires authentication via `requireAuth()` middleware
- Scopes to vendor_id (multi-tenant isolation)

---

## 4. DATABASE SCHEMA

### Customer Table Fields
```typescript
interface Customer {
  id: string;
  vendor_id: string;           // FK to vendors
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  date_of_birth?: string;      // From ID scan
  drivers_license_number?: string; // From ID scan
  total_spent?: number;
  order_count?: number;
  loyalty_points?: number;
  loyalty_tier?: string;
  vendor_customer_number?: string;
  created_at: string;
  updated_at: string;
}
```

**Indexes** (for performance):
- `vendor_id, drivers_license_number` (DL# lookup)
- `vendor_id, first_name, last_name, date_of_birth` (fuzzy matching)

---

## 5. DATA FLOW DIAGRAM

```
User Interface
    ↓
[POSCustomerSelector]
    ├─ Search customers
    └─ "Scan ID" button
         ↓
    [POSIDScanner]
         ├─ Camera access
         ├─ Video feed
         ├─ PDF417 detection
         └─ Parse AAMVA
              ↓
         [SimpleIDScanner]
              ├─ BrowserPDF417Reader
              └─ Canvas decoding
                   ↓
              Barcode detected
                   ↓
              [parseAAMVABarcode]
                   ├─ Extract fields
                   ├─ Parse dates
                   └─ Validate ANSI header
                        ↓
                   [isLegalAge check]
                        ├─ Valid (21+) → Continue
                        └─ Invalid (<21) → Show error
                             ↓
                        POST /api/pos/customers/scan-id
                             ├─ DL# lookup
                             ├─ Name+DOB lookup
                             └─ Fuzzy match
                                  ↓
                        Match Result?
                        ├─ Exact → Auto-select
                        ├─ Fuzzy → Show confirmation
                        └─ None → Prefill new customer form
                             ↓
                        [POSNewCustomerForm]
                             └─ Create customer
                                  ↓
                        [POSCart]
                             └─ Continue checkout
```

---

## 6. DEPENDENCIES & LIBRARIES

### npm Packages
```json
{
  "@zxing/browser": "^0.1.5",      // PDF417 reader
  "@zxing/library": "^0.21.3",      // Barcode decoding library
  "lucide-react": "^0.545.0",       // UI icons
  "framer-motion": "^12.23.24",     // Animations
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "next": "15.5.5"
}
```

### Optional Scandit Integration
The codebase includes Scandit SDK files in `/public/scandit/` but the primary implementation uses ZXing (open source).

**Scandit files** (not actively used):
- `index.d.ts`: Type definitions
- `Camera-C_4xOv5n.d.ts`: Camera module
- ML models for barcode localization

---

## 7. AUDIO FEEDBACK SYSTEM

**Web Audio API Implementation**:
```typescript
const playSuccessBeep = () => {
  const audioContext = new (window.AudioContext || webkitAudioContext)();
  audioContext.resume();
  
  const playBeep = (startTime, frequency) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.4, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.08);
  };
  
  const now = audioContext.currentTime;
  playBeep(now, 800);      // First beep
  playBeep(now + 0.1, 1000); // Second beep (higher pitch)
};
```

**Features**:
- Double beep pattern for success confirmation
- 800Hz + 1000Hz frequency tones
- iOS-compatible (requires resume() call)

---

## 8. ERROR HANDLING

### Camera Errors
```javascript
NotAllowedError   → "Camera permission denied"
NotFoundError     → "No camera found"
NotReadableError  → "Camera already in use"
OverconstrainedError → Retry with minimal constraints
```

### Barcode Parsing Errors
```javascript
"No barcode data provided"
"Invalid AAMVA barcode format - missing ANSI header"
"Could not parse name from barcode"
"Could not parse date of birth from barcode"
"Customer is under 21 years old"
```

---

## 9. MOBILE CONSIDERATIONS

### Android-Specific Notes
```javascript
// Camera constraints optimized for Android
{
  video: {
    facingMode: "environment",
    // NO exact/ideal constraints (prevents camera flipping)
    width: { ideal: 1280 },
    height: { ideal: 720 },
  }
}

// Video transform to prevent mirroring
<video style={{ transform: "scaleX(1)", WebkitTransform: "scaleX(1)" }} />
```

### iOS Requirements
- Audio context requires user interaction (auto-resume on camera start)
- `playsInline` attribute on video element

---

## 10. MIGRATION STRATEGY FOR REACT NATIVE

### What to Migrate
1. **AAMVA Parser** (no dependencies - pure TypeScript)
   - Can be copied as-is into React Native
   - No platform-specific code

2. **Customer Lookup Logic** (backend API)
   - No changes needed
   - Works for any client platform

3. **Age Verification** (isLegalAge function)
   - Pure logic, platform-independent

### Platform Considerations

**Camera Access**:
- Replace Web APIs with React Native Camera
- Candidate libraries:
  - `react-native-camera`
  - `react-native-vision-camera`
  - `@react-native-camera-roll/camera-roll`

**Barcode Decoding**:
- Replace BrowserPDF417Reader with native implementation
- Options:
  - `react-native-barcode-builder` (generation only)
  - Native module wrapper for ZXing
  - Platform-native APIs (iOS AVFoundation, Android ML Kit)

**Audio**:
- Replace Web Audio API with `react-native-sound` or `expo-av`

**UI Components**:
- Adapt TailwindCSS styling to React Native StyleSheet
- Use `react-native-reanimated` for animations (replaces framer-motion)

### Data Flow Changes
- Replace `fetch()` API with same endpoints (compatible)
- State management adapts easily (hooks remain same)
- Database schema/types remain unchanged

---

## 11. FILE REFERENCE GUIDE

### Core Components
- `/components/component-registry/pos/SimpleIDScanner.tsx` - Barcode scanner UI
- `/components/component-registry/pos/POSIDScanner.tsx` - Customer lookup wrapper
- `/components/component-registry/pos/POSCustomerSelector.tsx` - Customer selection dropdown
- `/components/component-registry/pos/POSNewCustomerForm.tsx` - Customer creation
- `/components/component-registry/pos/POSCart.tsx` - Cart with scanner integration

### Libraries
- `/lib/id-scanner/aamva-parser.ts` - AAMVA PDF417 parsing
- `/lib/types/database.ts` - Customer type definitions

### APIs
- `/app/api/pos/customers/scan-id/route.ts` - Customer lookup/matching

### Configuration
- `/package.json` - Dependencies (@zxing/browser, @zxing/library)

---

## 12. SECURITY NOTES

1. **No Client-Side Storage**: Scanned data not persisted to LocalStorage
2. **Authentication Required**: All API endpoints require `requireAuth()`
3. **Vendor Isolation**: All queries filtered by `vendor_id`
4. **Data Validation**: ANSI header validation on barcode parsing
5. **Age Verification**: Enforced at client-side (21+ check) and should be enforced server-side

---

## 13. TESTING CONSIDERATIONS

### Test Data
- Use real driver's license for testing (or test barcodes with ANSI header)
- Date of birth must be 21+ years ago to pass age verification

### Mock Implementations
- Mock `navigator.mediaDevices.getUserMedia()`
- Mock `BrowserPDF417Reader.decodeFromCanvas()`
- Mock fetch for `/api/pos/customers/scan-id`

---

## 14. PERFORMANCE OPTIMIZATIONS

### Current Implementation
- Scanning loop: 100ms intervals (10fps)
- Canvas size matches video resolution (1280x720)
- Non-blocking: Processing flag prevents concurrent decodes

### For React Native
- Consider native module for PDF417 decoding (faster than JS)
- Use platform-native camera APIs (more efficient)
- Implement frame throttling based on device capabilities

---

## Summary

The WhaleTools ID scanner is a feature-complete implementation with:
- Real-time PDF417 barcode detection
- AAMVA standard parsing
- Age verification (21+)
- Smart customer matching (exact, fuzzy)
- Seamless new customer creation flow
- Full POS integration

The core logic is platform-agnostic; migration requires replacing:
1. Camera access (Web APIs → React Native Camera)
2. Barcode detection (ZXing browser → native implementation)
3. Audio feedback (Web Audio → React Native audio library)
4. UI (TailwindCSS → React Native styles)

All backend APIs and business logic remain unchanged.
