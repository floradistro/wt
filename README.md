# Whaletools Native

Production-ready React Native app for Whaletools - clean architecture, zero bloat.

## 🎯 What We Built

A **fresh, clean rewrite** of Whaletools using React Native + Expo, applying lessons learned from the web version without carrying over any tech debt.

### Key Features

- ✅ **Native iOS + Android** from single codebase
- ✅ **60fps camera scanning** (vs 10fps PWA)
- ✅ **Clean architecture** - organized by feature
- ✅ **Type-safe** - TypeScript strict mode
- ✅ **Production-ready** - no bloat, no duplication
- ✅ **Instant OTA updates** - push updates in seconds
- ✅ **Complete POS Checkout** - with Dejavoo terminal integration
- ✅ **Beautiful Success Modals** - iOS design language with glassmorphism

## 📁 Project Structure

```
whaletools-native/
├── src/
│   ├── app/                    # Screens (Expo Router)
│   │   ├── _layout.tsx        # Root layout
│   │   └── index.tsx          # Login screen
│   │
│   ├── components/            # Reusable UI
│   │   └── ui/                # Base components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       └── index.ts       # Barrel exports
│   │
│   ├── features/              # Business logic (by feature)
│   │   ├── auth/
│   │   ├── pos/
│   │   └── products/
│   │
│   ├── lib/                   # Shared utilities
│   │   ├── supabase/
│   │   │   └── client.ts      # Supabase config
│   │   ├── utils/
│   │   │   ├── currency.ts
│   │   │   └── validation.ts
│   │   ├── constants/
│   │   │   ├── colors.ts
│   │   │   └── spacing.ts
│   │   └── id-scanner/        # Copied from web (works as-is!)
│   │       └── aamva-parser.ts
│   │
│   ├── types/                 # TypeScript types
│   └── stores/                # Global state (Zustand)
│
├── assets/                    # Images, fonts
├── .env                       # Environment variables
├── app.json                   # Expo config
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- iOS: Xcode (Mac only)
- Android: Android Studio

### Installation

```bash
# Install dependencies
cd whaletools-native
npm install

# Start development server
npx expo start

# Then choose:
# - Press 'i' for iOS simulator
# - Press 'a' for Android emulator
# - Scan QR with Expo Go app on device
```

### Environment Variables

Create `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://uaednwpxursknmwdeejn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_API_URL=https://yachtclub.boats
```

## 🏗️ Architecture

WhaleTools Native follows Apple engineering principles with a focus on simplicity, performance, and maintainability.

### Core Principles

- **Zero Prop Drilling** - All business logic in Zustand stores
- **Focused Selectors** - Granular hooks prevent unnecessary re-renders
- **Type Safety** - Strict TypeScript, zero `any` types
- **Clean Separation** - UI components receive only visual props

### Store-First Architecture

```typescript
// Components read from stores
const users = useUsers()
const { createUser, updateUser } = useUsersActions()

// No props drilling needed
<UserList />  // Gets data from store directly
```

### Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete architecture guide with store patterns, best practices, and migration guides
- **[docs/](./docs/)** - Feature-specific implementation guides

## 🎨 Design System

Consistent design tokens:

```typescript
import { Colors, Spacing, FontSize } from '@/lib/constants'

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,        // 24px
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: FontSize.xl,      // 20px
    color: Colors.text,
  },
})
```

## 📦 Core Dependencies

- **expo** - React Native framework
- **expo-router** - File-based navigation
- **@supabase/supabase-js** - Backend (same as web!)
- **zustand** - State management
- **expo-camera** - Native camera access
- **expo-barcode-scanner** - Barcode scanning

## 🔄 Development Workflow

```bash
# Start dev server
npx expo start

# Make changes → Auto-reload!

# Test on:
# - iOS simulator (press 'i')
# - Android emulator (press 'a')
# - Real device (scan QR with Expo Go)
```

## 🚢 Deployment

### Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build iOS
eas build --platform ios

# Build Android
eas build --platform android

# Build both
eas build --platform all
```

### OTA Updates (Instant)

```bash
# Push update to users
eas update --branch production --message "Bug fixes"

# Users get update on next app open (2-30 seconds)
```

## 📝 Development Guidelines

### Component Pattern

```typescript
// Good - Single responsibility, typed props
interface ProductCardProps {
  product: Product
  onPress?: () => void
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <Card>
      <Text>{product.name}</Text>
      <Button onPress={onPress} title="View" />
    </Card>
  )
}
```

### Service Pattern

```typescript
// Good - Encapsulated API logic
export class ProductsService {
  static async getAll(vendorId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)

    if (error) throw error
    return data
  }
}
```

### Hook Pattern

```typescript
// Good - Reusable business logic
export function useProducts(vendorId: string) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [vendorId])

  const loadProducts = async () => {
    setLoading(true)
    const data = await ProductsService.getAll(vendorId)
    setProducts(data)
    setLoading(false)
  }

  return { products, loading, refetch: loadProducts }
}
```

## 📚 Resources

- [Expo Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Supabase Docs](https://supabase.com/docs)

## 🤝 Contributing

This is a clean rewrite - no legacy code, no tech debt. Let's keep it that way!

**Guidelines:**
- Write clean, self-documenting code
- Follow the established architecture
- No duplicate code
- Type everything
- Test before committing

---

**Built with ❤️ using React Native + Expo**
