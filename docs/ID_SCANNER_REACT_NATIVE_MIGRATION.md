# ID Scanner - React Native Migration Guide

## Quick Start

### Phase 1: Copy Portable Code
These files can be migrated with minimal changes:

```bash
# Core parsing logic (no dependencies on React/Web APIs)
cp whaletools/lib/id-scanner/aamva-parser.ts whaletools-native/lib/id-scanner/aamva-parser.ts

# Type definitions
cp whaletools/lib/types/database.ts whaletools-native/lib/types/database.ts
```

### Phase 2: Replace Platform-Specific Modules

#### Camera Access
**Web Version**:
```typescript
navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
})
```

**React Native Version** (using expo-camera):
```typescript
import { Camera } from 'expo-camera';

const [hasPermission, requestPermission] = useCameraPermissions();
// OR
import { useCameraPermissions } from 'react-native-vision-camera';
```

#### Barcode Decoding
**Web Version**:
```typescript
import { BrowserPDF417Reader } from '@zxing/browser';
const reader = new BrowserPDF417Reader();
const result = await reader.decodeFromCanvas(canvas);
```

**React Native Options**:
```typescript
// Option 1: Vision Camera + ML Kit (Recommended)
import { useCameraDevice } from 'react-native-vision-camera';
import { useScannedBarcodeSymbols } from 'react-native-vision-camera';

// Option 2: React Native Barcode Scanner
import { BarCodeScanner } from 'expo-barcode-scanner';

// Option 3: Native module wrapper
// Create native bridge to platform-specific libraries
```

#### Audio Feedback
**Web Version**:
```typescript
const audioContext = new AudioContext();
const oscillator = audioContext.createOscillator();
// Play sine wave tones
```

**React Native Version**:
```typescript
import { Audio } from 'expo-av';
// OR
import Sound from 'react-native-sound';

const playBeep = async () => {
  const sound = new Sound('beep.mp3');
  await sound.play();
};
```

#### UI & Styling
**Web Version**:
```typescript
// TailwindCSS + Framer Motion
className="bg-black/90 border border-white/20 rounded-2xl"
<motion.div animate={{ opacity: 1 }} />
```

**React Native Version**:
```typescript
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
  }
});
```

---

## Component Structure Mapping

### SimpleIDScanner.tsx
**Changes Required**:
- [ ] Replace `getUserMedia()` with `react-native-vision-camera`
- [ ] Replace Canvas rendering with camera preview
- [ ] Replace `BrowserPDF417Reader` with native barcode detection
- [ ] Replace Web Audio API with `expo-av` or `react-native-sound`
- [ ] Replace Tailwind styling with React Native StyleSheet
- [ ] Replace framer-motion with `react-native-reanimated`

**Core Logic to Keep**:
- Scanning loop logic (requestAnimationFrame replaces setTimeout)
- Error handling (adapt error types for platform)
- Success beep pattern (800Hz then 1000Hz)
- Processing flag to prevent concurrent decodes

### POSIDScanner.tsx
**No Changes Required** - Wrapper logic is platform-agnostic
- State management remains same
- API calls work identically
- Callback handling unchanged

### POSCustomerSelector.tsx
**Changes Required**:
- [ ] Replace dropdown with React Native modal/picker
- [ ] Adapt Tailwind styling
- [ ] Replace lucide-react icons with react-native-feather or custom SVGs

### POSNewCustomerForm.tsx
**Changes Required**:
- [ ] Replace form inputs with React Native TextInput
- [ ] Adapt Tailwind styling to StyleSheet
- [ ] Replace button styling

### POSCart.tsx
**Minimal Changes**:
- [ ] Adapt UI components
- [ ] Logic remains unchanged

---

## API Integration (No Changes!)

### Backend Endpoints
All backend endpoints work identically:

```typescript
// Identical on both platforms
POST /api/pos/customers/scan-id
POST /api/pos/customers/create
GET /api/pos/customers
```

**Request/Response Types**: Same across platforms

---

## Step-by-Step Migration Plan

### Step 1: Create Lib Structure
```bash
mkdir -p app/lib/id-scanner
mkdir -p app/lib/types
```

### Step 2: Copy Portable Code
```bash
cp whaletools/lib/id-scanner/aamva-parser.ts app/lib/id-scanner/
cp whaletools/lib/types/database.ts app/lib/types/
```

**Test**: Run AAMVA parser tests (no platform dependencies)

### Step 3: Create Camera Module Abstraction
```typescript
// app/lib/scanner/camera-adapter.ts
export interface CameraFrame {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface CameraScanner {
  startScanning(): Promise<void>;
  stopScanning(): void;
  onFrameDetected(callback: (frame: CameraFrame) => void): void;
}

// Platform-specific implementations
// app/lib/scanner/camera-adapter.expo.ts
// app/lib/scanner/camera-adapter.rn.ts
```

### Step 4: Implement Barcode Detection
```typescript
// app/lib/scanner/barcode-detector.ts
export interface BarcodeResult {
  text: string;
  format: string;
}

export interface BarcodeDetector {
  detect(frame: CameraFrame): Promise<BarcodeResult | null>;
}

// Use native implementation or JS library
```

### Step 5: Migrate SimpleIDScanner Component
```typescript
// app/components/SimpleIDScanner.tsx (React Native version)
import { CameraView } from 'react-native-camera';
// Import abstract interfaces from Step 3-4
```

### Step 6: Adapt UI Components
```typescript
// Update all Tailwind CSS to React Native StyleSheet
// Replace framer-motion with react-native-reanimated
// Replace lucide-react with react-native-feather or SVGs
```

### Step 7: Update Navigation Integration
Ensure POSCustomerSelector and POSCart integrate with React Native navigation

### Step 8: Test End-to-End
- [ ] Camera permission flows
- [ ] Barcode detection
- [ ] API calls to backend
- [ ] Age verification
- [ ] Customer matching
- [ ] New customer creation

---

## Recommended Dependencies

### Camera
```json
{
  "react-native-vision-camera": "^3.x",
  "vision-camera-barcode-scanner": "^0.x"
}
```

### Barcode Detection
```json
{
  "react-native-mlkit": "^0.x"
}
// OR
{
  "zxing-cpp": "^2.x"
}
```

### Audio
```json
{
  "expo-av": "^13.x"
}
// OR
{
  "react-native-sound": "^0.11.x"
}
```

### Animations
```json
{
  "react-native-reanimated": "^3.x"
}
```

### Icons
```json
{
  "react-native-feather": "^1.x"
}
```

### State Management
```json
{
  "react": "^18.x",
  "react-native": "^0.73.x"
}
// No changes needed - same hooks API
```

---

## Testing Strategy

### Unit Tests
```typescript
// __tests__/aamva-parser.test.ts
import { parseAAMVABarcode, isLegalAge } from '../lib/id-scanner/aamva-parser';

describe('AAMVA Parser', () => {
  it('parses valid barcode', () => {
    const data = parseAAMVABarcode(SAMPLE_BARCODE);
    expect(data.firstName).toBe('John');
  });

  it('rejects invalid barcode', () => {
    expect(() => parseAAMVABarcode('invalid')).toThrow();
  });

  it('calculates age correctly', () => {
    expect(isLegalAge('2003-01-01')).toBe(true);
    expect(isLegalAge('2010-01-01')).toBe(false);
  });
});
```

### Integration Tests
```typescript
// __tests__/scanner.integration.test.ts
describe('ID Scanner Integration', () => {
  it('scans barcode and looks up customer', async () => {
    // Mock camera frame
    // Mock API response
    // Verify customer selection callback
  });

  it('handles 21+ age rejection', async () => {
    // Scan underage ID
    // Verify error message
  });
});
```

### E2E Tests
```typescript
// e2e/scanner.e2e.test.ts
describe('ID Scanner E2E', () => {
  it('completes full scan-to-checkout flow', async () => {
    // Open POSCart
    // Click scan button
    // Take screenshot of camera
    // Verify customer selected
    // Verify proceed to checkout
  });
});
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Camera Permission Handling
**Issue**: Different permission flows on iOS vs Android

**Solution**: Create permission abstraction
```typescript
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // iOS-specific permission request
  } else {
    // Android-specific permission request
  }
}
```

### Pitfall 2: Frame Rate & Performance
**Issue**: JavaScript barcode detection may be slow

**Solution**: Use native module or optimize frame sampling
```typescript
// Only process every Nth frame
if (frameCount % 3 === 0) {
  detect(frame);
}
```

### Pitfall 3: Date Parsing Differences
**Issue**: Date parsing varies across platforms/locales

**Solution**: Explicit format validation (already done in parser)
```typescript
// AAMVA parser already handles MMDDCCYY format
// Result is always YYYY-MM-DD
```

### Pitfall 4: Audio Context Not Available
**Issue**: Web Audio API doesn't exist on React Native

**Solution**: Use expo-av or create native module

---

## Performance Checklist

- [ ] Camera frame processing < 100ms
- [ ] Barcode detection runs at 10fps minimum
- [ ] Memory usage < 100MB for camera stream
- [ ] No excessive re-renders of scanner UI
- [ ] Efficient API calls (batch customer lookups if needed)
- [ ] Proper cleanup on component unmount

---

## Validation Checklist

Before release:

- [ ] Scans US driver's licenses
- [ ] Scans Canadian driver's licenses
- [ ] Rejects invalid barcodes with error message
- [ ] Rejects underage users (< 21 years)
- [ ] Finds existing customers by DL#
- [ ] Finds existing customers by name+DOB (fuzzy)
- [ ] Creates new customers with prefilled data
- [ ] Works on iOS 12+
- [ ] Works on Android 8.0+
- [ ] Camera permissions handled gracefully
- [ ] Proper error messages for all failure modes
- [ ] Audio feedback plays on success
- [ ] Performance acceptable on low-end devices

---

## File Location Reference

### Source Files (whaletools)
- Barcode Parser: `lib/id-scanner/aamva-parser.ts`
- Components: `components/component-registry/pos/*.tsx`
- API: `app/api/pos/customers/scan-id/route.ts`
- Types: `lib/types/database.ts`

### Target Files (whaletools-native)
- Barcode Parser: `app/lib/id-scanner/aamva-parser.ts`
- Components: `app/screens/POS/*.tsx`
- Camera Module: `app/lib/scanner/camera-adapter.ts`
- Barcode Detector: `app/lib/scanner/barcode-detector.ts`
- Types: `app/lib/types/database.ts`

---

## Timeline Estimate

- Phase 1 (Setup & Copy): 1-2 days
- Phase 2 (Camera Integration): 3-4 days
- Phase 3 (Barcode Detection): 2-3 days
- Phase 4 (UI Adaptation): 2-3 days
- Phase 5 (Testing & QA): 3-5 days
- **Total: 2-3 weeks**

---

## Success Criteria

1. All AAMVA barcode tests pass
2. Camera integration works on both platforms
3. Barcode detection functional (at least 80% success rate)
4. Customer lookup works identically to web
5. Age verification enforced
6. No regressions from web version
7. Acceptable performance on target devices

