# WhaleTools Native Documentation

> **Master Architecture**: See [`/bigswag/WHALETOOLS_UNIFIED_VISION.md`](../../bigswag/WHALETOOLS_UNIFIED_VISION.md) for the complete system vision, architecture rules, and Swift migration roadmap.

---

## Documentation Structure

### 📖 Guides
*How to get things done*

| Doc | Description |
|-----|-------------|
| [QUICK_START.md](./guides/QUICK_START.md) | Get up and running |
| [DEV_WORKFLOW.md](./guides/DEV_WORKFLOW.md) | Development process |
| [DEPLOYMENT_GUIDE.md](./guides/DEPLOYMENT_GUIDE.md) | Building and releasing |
| [IMPLEMENTATION_GUIDE.md](./guides/IMPLEMENTATION_GUIDE.md) | Feature implementation |
| [EMAIL_SYSTEM_GUIDE.md](./guides/EMAIL_SYSTEM_GUIDE.md) | Email system setup |
| [MIGRATE_USERS_GUIDE.md](./guides/MIGRATE_USERS_GUIDE.md) | User migration |

### 🔌 Integrations
*External services and APIs*

| Doc | Description |
|-----|-------------|
| [SUPABASE_MUST_READ.md](./integrations/SUPABASE_MUST_READ.md) | Supabase essentials |
| [SUPABASE_SETUP.md](./integrations/SUPABASE_SETUP.md) | Supabase configuration |
| [SUPABASE_WORKFLOWS.md](./integrations/SUPABASE_WORKFLOWS.md) | Common Supabase patterns |
| [README_SUPABASE.md](./integrations/README_SUPABASE.md) | Supabase overview |
| [PAYMENT_PROCESSOR_INTEGRATION.md](./integrations/PAYMENT_PROCESSOR_INTEGRATION.md) | Dejavoo setup |
| [README_PAYMENT_SYSTEM.md](./integrations/README_PAYMENT_SYSTEM.md) | Payment system overview |
| [PAYMENT_ERROR_HANDLING.md](./integrations/PAYMENT_ERROR_HANDLING.md) | Payment error handling |
| [AUTHORIZE_NET_INTEGRATION.md](./integrations/AUTHORIZE_NET_INTEGRATION.md) | Authorize.Net setup |
| [SENTRY_PAYMENT_INTEGRATION.md](./integrations/SENTRY_PAYMENT_INTEGRATION.md) | Sentry + payments |
| [PAYMENT_TEST_PLAN.md](./integrations/PAYMENT_TEST_PLAN.md) | Payment testing |

### ⚙️ Features
*Feature-specific implementation details*

| Doc | Description |
|-----|-------------|
| [ID_SCANNER_MAGIC.md](./features/ID_SCANNER_MAGIC.md) | AAMVA driver's license scanning |
| [AUTH_IMPLEMENTATION.md](./features/AUTH_IMPLEMENTATION.md) | Authentication system |
| [AUTH_PATTERNS.md](./features/AUTH_PATTERNS.md) | Auth patterns |
| [DEDUPLICATION_SYSTEM.md](./features/DEDUPLICATION_SYSTEM.md) | Customer deduplication |
| [LIQUID_GLASS_USAGE.md](./features/LIQUID_GLASS_USAGE.md) | Glass morphism effects |
| [MODAL_RENDERING_PATTERNS.md](./features/MODAL_RENDERING_PATTERNS.md) | Modal patterns |
| [DESIGN_SYSTEM.md](./features/DESIGN_SYSTEM.md) | Design tokens |
| [CUSTOM_EMAIL_TEMPLATES.md](./features/CUSTOM_EMAIL_TEMPLATES.md) | Email templates |
| [purchase-orders-implementation.md](./features/purchase-orders-implementation.md) | PO system |

### 🧪 Testing
*Test plans and commands*

| Doc | Description |
|-----|-------------|
| [IPAD_TEST_SHEET.md](./testing/IPAD_TEST_SHEET.md) | iPad testing checklist |
| [QUICK_TEST_COMMANDS.md](./testing/QUICK_TEST_COMMANDS.md) | Useful test commands |
| [SENTRY_TESTING_GUIDE.md](./testing/SENTRY_TESTING_GUIDE.md) | Sentry testing |

---

## Quick Start

New to the project? Start here:

1. **[Main README](../README.md)** - Project overview and setup
2. **[QUICK_START](./guides/QUICK_START.md)** - Get the app running
3. **[Master Architecture](../../bigswag/WHALETOOLS_UNIFIED_VISION.md)** - Understand the system

## Project Structure

```
whaletools-native/
├── src/
│   ├── screens/              # Main app screens
│   │   └── POSScreen.tsx     # Point of sale
│   ├── components/           # Reusable UI components
│   │   └── pos/              # POS-specific components
│   ├── stores/               # Zustand state (35 stores)
│   ├── hooks/                # Custom React hooks
│   ├── services/             # API services
│   ├── lib/                  # Shared utilities
│   │   └── id-scanner/       # AAMVA parser
│   └── types/                # TypeScript definitions
├── docs/
│   ├── guides/               # How-to guides
│   ├── integrations/         # External services
│   ├── features/             # Feature docs
│   └── testing/              # Test docs
└── .archive/                 # Superseded docs
```

## Architecture Principles

From the unified vision:

1. **Zero Prop Drilling** - All data from Zustand stores
2. **Focused Selectors** - Subscribe to specific state
3. **Domain Stores** - One store per business domain
4. **Auto-Reload** - State reflects backend truth
5. **Reset on Logout** - Clean slate

## Archived Documentation

Historical and superseded docs are in `.archive/`:
- `.archive/architecture-docs/` - Superseded by unified vision
- `.archive/historical-fixes/` - Past bug fixes and incidents
- `.archive/legacy-docs/` - Old documentation

---

*Last Updated: December 2024*
*Status: Production (React Native) / Migrating to Swift*
