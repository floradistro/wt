# Website & Payment Processor Integration Analysis
## Migrating WhaleTools Web Features to React Native App

> **Goal**: Integrate the complete website management system (GitHub integration, Vercel deployment, domain management, branding) + Authorize.Net payment processor into the React Native app's Settings → Website view

---

## 📊 Current State Analysis

### React Native App (whaletools-native)
**Status**: ✅ Well-structured settings system, ❌ No website view exists yet

**Existing Structure**:
- **Settings Screen**: `/src/screens/SettingsScreen.tsx`
- **Detail Components**: `/src/components/settings/details/`
  - AccountDetail
  - LocationsDetail
  - LocationConfigurationDetail
  - UserManagementDetail
  - SupplierManagementDetail
  - LoyaltyManagementDetail
  - **PaymentProcessorsManagementDetail** ← Already exists!
  - CampaignsDetail
  - DeveloperToolsDetail

**Payment Processor Support**:
- Hook: `/src/hooks/usePaymentProcessors.ts`
- Modal: `/src/components/settings/PaymentProcessorModal.tsx`
- **Supported**: Dejavoo, Stripe, Square, Authorize.Net (UI only), Clover
- **Architecture**: Location-scoped processors with test connection support

**Navigation Structure**:
- Centralized: `/src/lib/navigation.ts`
- **Planned but not built**: `storefront` section with:
  - 🌐 Website
  - 🎨 Branding
  - 📸 Media Library
  - 📺 TV Menus

---

### WhaleTools Web App (Current Projects/whaletools)
**Status**: ✅ Fully implemented website management system

**Core Features**:
1. **GitHub Integration**
   - OAuth connection flow
   - Repository creation from template
   - Multi-file atomic commits
   - Webhook integration for continuous deployment

2. **Vercel Deployment**
   - Separate isolated projects per vendor
   - Automatic deployments from GitHub
   - Real-time status monitoring
   - Deployment history with commit tracking

3. **Domain Management**
   - Custom domain setup
   - DNS verification (A, CNAME, TXT records)
   - SSL provisioning
   - Multi-domain support

4. **Branding System**
   - Color customization (5 presets)
   - Logo/banner upload
   - Font selection (8+ fonts)
   - Custom CSS editor
   - Business hours configuration
   - Return/shipping policies
   - Social media links

5. **Authorize.Net Payment Processor**
   - Accept.js tokenization (PCI compliant)
   - E-commerce payment processing
   - Webhook handling (payment/refund/dispute/fraud)
   - Customer profile management
   - Saved payment methods

**File Structure**:
```
app/vendor/website/page.tsx                        - Main website dashboard
app/vendor/branding/page.tsx                       - Branding configuration
app/vendor/website/components/DomainSetup.tsx      - Domain management

app/api/vendor/website/
  ├── status/route.ts                              - Get website status
  ├── create/route.ts                              - Create GitHub repo
  ├── push-template/route.ts                       - Push storefront template
  ├── deploy/route.ts                              - Trigger deployment
  ├── create-vercel-project/route.ts               - Create Vercel project
  ├── setup-domain/route.ts                        - Setup custom domain
  ├── verify-domain/route.ts                       - Verify DNS records
  ├── vercel-deployments/route.ts                  - Get deployment history
  └── deployments/route.ts                         - Get deployment logs

app/api/auth/github/callback/route.ts              - GitHub OAuth callback
app/api/webhooks/github/route.ts                   - GitHub webhook handler

app/api/payment/route.ts                           - Authorize.Net payment processing
app/api/authorize-keys/route.ts                    - Get Authorize.Net public keys
app/api/authorize-tokenize/route.ts                - Tokenize payment method
app/api/webhooks/authorize/route.ts                - Authorize.Net webhooks

lib/deployment/
  ├── github.ts                                    - GitHub API client
  ├── vercel.ts                                    - Vercel API client
  └── storefront-template.ts                       - Template generation

lib/payment-processors/
  ├── index.ts                                     - Payment processor factory
  ├── types.ts                                     - Payment processor types
  └── dejavoo.ts                                   - Dejavoo client (example)

components/vendor/branding/                        - 10+ branding components
```

---

## 🎯 Integration Architecture

### Phase 1: Create Website Detail Component
**New File**: `/src/components/settings/details/WebsiteDetail.tsx`

**Sections to Include**:
1. **GitHub Connection** (top section)
   - Connection status badge
   - "Connect GitHub" button → OAuth flow
   - Repository info display
   - "Open in VS Code/Cursor" buttons

2. **Repository Management** (collapsible)
   - Repository status
   - "Create Repository" button
   - "Push Template" button
   - File count and last push timestamp

3. **Deployment Status** (prominent)
   - Current deployment URL (clickable)
   - Status indicator (ready/building/error)
   - "Deploy Now" button
   - Deployment history list (last 10)
   - Real-time polling (5 second intervals)

4. **Domain Configuration** (collapsible)
   - Current domain display
   - "Setup Custom Domain" button → modal
   - DNS record instructions
   - Verification status
   - SSL certificate status

5. **Quick Actions** (bottom)
   - "View Live Site" button
   - "Manage Branding" → navigate to BrandingDetail
   - "View Deployment Logs" → modal

**Dependencies to Install**:
```bash
npm install @octokit/rest           # GitHub API
npm install @vercel/client          # Vercel SDK (if exists)
npm install react-native-webview   # For OAuth flow
```

---

### Phase 2: Create Branding Detail Component
**New File**: `/src/components/settings/details/BrandingDetail.tsx`

**Sections to Include**:
1. **Color Palette** (visual color pickers)
   - Primary, Secondary, Accent, Background, Text
   - 5 brand presets (quick selection)

2. **Brand Assets** (image upload)
   - Logo uploader (with preview)
   - Banner uploader (with preview)
   - Image library grid

3. **Typography** (dropdown)
   - Font family selector (8+ fonts)
   - Preview text

4. **Business Information** (forms)
   - Store tagline input
   - Store description textarea
   - Business hours editor

5. **Policies** (rich text)
   - Return policy editor
   - Shipping policy editor

6. **Social Media** (input fields)
   - Website, Instagram, Facebook, Twitter, TikTok, YouTube

7. **Advanced** (collapsible)
   - Custom CSS editor (syntax highlighted)
   - Preview toggle

**React Native Components Needed**:
- `react-native-linear-gradient` (already installed?)
- `react-native-image-picker` (for logo/banner upload)
- `@react-native-community/slider` (for color pickers)
- Monaco-like code editor or fallback to TextInput

---

### Phase 3: Enhance Payment Processors for Authorize.Net E-commerce
**File to Modify**: `/src/components/settings/details/PaymentProcessorsManagementDetail.tsx`

**Current State**:
- Supports Authorize.Net credential input
- Missing: E-commerce integration logic

**Additions Needed**:
1. **Tab System** in Payment Processor Modal:
   - Tab 1: Terminal/POS Processors (Dejavoo, Square, Clover)
   - Tab 2: E-commerce Processors (Authorize.Net, Stripe)

2. **Authorize.Net Section**:
   - **For POS**: Not applicable
   - **For E-commerce**:
     - API Login ID
     - Transaction Key
     - Public Client Key (for Accept.js)
     - Signature Key (for webhooks)
     - Environment toggle (Sandbox/Production)
     - "Test Connection" button

3. **E-commerce Settings** (new section in WebsiteDetail):
   - Active payment processors for storefront
   - Checkout settings:
     - Require CVV
     - Enable saved payment methods
     - Card types accepted (Visa, MC, Amex, Discover)
     - 3D Secure toggle

4. **Webhook URL Display**:
   - Show webhook URL for Authorize.Net configuration
   - Copy to clipboard button
   - Event types to enable (payment, refund, fraud, dispute)

---

### Phase 4: Navigation Integration
**File to Modify**: `/src/screens/SettingsScreen.tsx`

**Add to Settings Categories**:
```typescript
{
  id: 'storefront',
  title: 'STOREFRONT',
  items: [
    {
      id: 'website',
      label: 'Website',
      icon: '🌐',
      component: WebsiteDetail,
      description: 'Manage your online storefront, GitHub repo, and deployments'
    },
    {
      id: 'branding',
      label: 'Branding',
      icon: '🎨',
      component: BrandingDetail,
      description: 'Customize your brand colors, logos, and theme'
    },
    {
      id: 'media-library',
      label: 'Media Library',
      icon: '📸',
      component: MediaLibraryDetail, // Future
      description: 'Upload and manage product images and assets'
    }
  ]
}
```

**Update Navigation Config**: `/src/lib/navigation.ts`
- Ensure `storefrontSection` is exported and integrated

---

## 🔄 Data Flow Architecture

### GitHub OAuth Flow (React Native)
```
1. User taps "Connect GitHub" in WebsiteDetail
2. Open WebView with GitHub OAuth URL
3. User authorizes WhaleTools app
4. GitHub redirects to callback URL (deep link)
5. React Native intercepts deep link
6. Extract auth code from URL
7. POST to /api/auth/github/callback
8. Store access token in Supabase (vendors.github_access_token)
9. Update UI with connection status
```

**Deep Link Setup Required**:
- iOS: Configure URL scheme in Info.plist
- Android: Configure intent filter in AndroidManifest.xml
- URL scheme: `whaletools://github-callback`

**Alternative**: Use in-app browser with message passing

---

### Deployment Workflow
```
User Action → API Call → Backend Processing → Real-time Update

1. Create Repository:
   POST /api/vendor/website/create
   → GitHub API creates repo
   → Update vendors table
   → Return repo info

2. Push Template:
   POST /api/vendor/website/push-template
   → Generate storefront files with branding
   → Commit to GitHub repo
   → Return commit SHA

3. Create Vercel Project:
   POST /api/vendor/website/create-vercel-project
   → Vercel API creates project
   → Link GitHub repo
   → Set environment variables
   → Update vendors table
   → Return project info

4. Deploy:
   POST /api/vendor/website/deploy
   → Trigger Vercel deployment
   → Poll deployment status (5s intervals)
   → Update vendor_deployments table
   → Return deployment URL

5. Domain Setup:
   POST /api/vendor/website/setup-domain
   → Generate verification token
   → Create vendor_domains record
   → Return DNS instructions

6. Domain Verification:
   POST /api/vendor/website/verify-domain
   → Check DNS records (TXT, A, CNAME)
   → Add domain to Vercel project
   → Update vendor_domains.verified
   → Trigger SSL provisioning
```

---

### Authorize.Net E-commerce Flow
```
Customer Checkout → Tokenization → Payment Processing → Order Creation

1. Customer enters card on storefront (vendor's website)
2. Accept.js tokenizes card client-side (PCI compliant)
3. POST /api/payment with payment token
4. Backend processes with Authorize.Net:
   - Create transaction (authCaptureTransaction)
   - Create order in Supabase
   - Create order items
   - Update customer stats
5. Return order confirmation
6. Authorize.Net webhook confirms payment
7. Update order status if webhook arrives
```

**Webhook Events Handled**:
- `net.authorize.payment.authcapture.created` → Payment confirmed
- `net.authorize.payment.refund.created` → Refund processed
- `net.authorize.payment.void.created` → Payment voided
- `net.authorize.customer.dispute.created` → Chargeback filed
- `net.authorize.payment.fraud.held` → Fraud detection triggered

---

## 📱 React Native Implementation Details

### Custom Hooks to Create

#### `useWebsiteStatus.ts`
```typescript
export const useWebsiteStatus = () => {
  const [status, setStatus] = useState<WebsiteStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    const response = await api.get('/api/vendor/website/status');
    setStatus(response.data);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return { status, loading, refresh: fetchStatus };
};
```

#### `useGitHubOAuth.ts`
```typescript
export const useGitHubOAuth = () => {
  const [isConnecting, setIsConnecting] = useState(false);

  const connectGitHub = () => {
    const clientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri = 'whaletools://github-callback';
    const scope = 'repo';
    const state = generateRandomState(); // CSRF protection

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    // Open WebView or system browser
    Linking.openURL(authUrl);
  };

  return { connectGitHub, isConnecting };
};
```

#### `useDeployments.ts`
```typescript
export const useDeployments = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);

  const triggerDeployment = async () => {
    setIsDeploying(true);
    try {
      await api.post('/api/vendor/website/deploy');
      await fetchDeployments();
    } finally {
      setIsDeploying(false);
    }
  };

  const fetchDeployments = async () => {
    const response = await api.get('/api/vendor/website/vercel-deployments');
    setDeployments(response.data.deployments);
  };

  return { deployments, triggerDeployment, isDeploying };
};
```

#### `useBranding.ts`
```typescript
export const useBranding = () => {
  const [branding, setBranding] = useState<VendorBranding | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveBranding = async (updates: Partial<VendorBranding>) => {
    setIsSaving(true);
    try {
      const response = await api.put('/api/vendor/branding', updates);
      setBranding(response.data);
    } finally {
      setIsSaving(false);
    }
  };

  return { branding, saveBranding, isSaving };
};
```

---

### UI Components to Create

#### `GitHubConnectionCard.tsx`
**Design**: Card showing GitHub connection status
- Avatar/icon
- Username (if connected)
- Repository name and URL
- "Connect GitHub" or "Disconnect" button
- Last sync timestamp

#### `DeploymentStatusCard.tsx`
**Design**: Prominent status indicator
- Deployment URL (large, tappable)
- Status badge (ready/building/error)
- Progress indicator (when building)
- "Deploy Now" button
- Last deployed timestamp
- Deploy history list (collapsible)

#### `DomainSetupModal.tsx`
**Design**: Full-screen modal with steps
- Step 1: Enter domain name
- Step 2: Show DNS records to add
- Step 3: Auto-verification with spinner
- Step 4: Success confirmation
- Copy buttons for each DNS record
- Registrar-specific instructions (tabs)

#### `BrandColorPicker.tsx`
**Design**: Color selection interface
- Color preview circle (large)
- Hex input field
- RGB sliders (optional)
- Preset colors grid
- "Reset to default" button

#### `BrandPresetSelector.tsx`
**Design**: Horizontal scrollable preset cards
- Cannabis Modern (green theme)
- Luxury Minimal (gold theme)
- Earth Tones (brown theme)
- Bold & Vibrant (pink theme)
- Dark Mode (dark theme)
- Preview image for each preset
- "Apply" button

#### `DeploymentHistoryList.tsx`
**Design**: FlatList of deployment records
- Commit message (truncated)
- Commit SHA (short, monospace)
- Status badge
- Deployment URL
- Timestamp (relative: "2 hours ago")
- Tap to view logs

---

## 🗄️ Database Schema (Already Exists in Supabase)

### Tables Used:
- ✅ **vendors** - GitHub/Vercel credentials, deployment status
- ✅ **vendor_domains** - Custom domain management
- ✅ **vendor_deployments** - Deployment history
- ✅ **payment_processors** - Payment processor configurations
- ✅ **payment_transactions** - E-commerce transactions
- ✅ **orders** - E-commerce orders
- ✅ **order_items** - Order line items
- ✅ **customers** - E-commerce customers

**No database migrations needed** - schema already supports all features!

---

## 🔐 Security Considerations

### GitHub OAuth
- Use state parameter for CSRF protection
- Store access tokens securely (Supabase RLS)
- Never expose tokens to client
- Implement token refresh if needed

### Vercel API
- Store API token server-side only
- Use project-level isolation
- Validate all deployment requests

### Authorize.Net
- Use Accept.js for PCI compliance (no card data touches server)
- Validate webhook signatures (HMAC-SHA256)
- Store credentials encrypted at rest
- Environment separation (sandbox/production)

### DNS Verification
- Generate unique verification tokens
- Implement rate limiting on verification attempts
- Validate DNS record format

---

## 📦 Dependencies to Add

### React Native Packages:
```json
{
  "dependencies": {
    "react-native-webview": "^13.6.0",           // GitHub OAuth
    "react-native-image-picker": "^5.6.0",       // Logo/banner upload
    "@react-native-community/slider": "^4.4.3",  // Color pickers
    "react-native-syntax-highlighter": "^2.1.0", // Custom CSS editor
    "react-native-clipboard": "^1.5.1",          // Copy DNS records
    "react-native-vector-icons": "^10.0.0"       // Icons (if not installed)
  }
}
```

### Backend APIs to Proxy:
All API routes already exist in whaletools web app - just need to expose them via React Native API client.

---

## 🎨 Design Principles (Following Existing Patterns)

### Apple iOS Settings Style
- Split-view layout (sidebar + detail panel)
- Collapsible sections with headers
- Minimal, clean design
- LiquidGlassView for frosted glass effects
- LinearGradient for subtle fades
- Animated.Value for scroll-based UI changes

### Color Scheme (Match Existing)
- Background: `#000000` (pure black)
- Card background: `#1C1C1E` (dark gray)
- Border: `rgba(255, 255, 255, 0.1)` (subtle white)
- Text: `#FFFFFF` (white)
- Secondary text: `rgba(255, 255, 255, 0.6)` (60% white)
- Accent: Follow vendor's brand primary color

### Typography
- Headers: 16px, bold, uppercase, letter-spacing 0.2em
- Body: 14px, regular
- Labels: 12px, medium, uppercase, letter-spacing 0.2em
- Code: 13px, monospace

---

## 🚀 Implementation Phases

### Phase 1: Website Detail Component (Week 1)
- [ ] Create `WebsiteDetail.tsx`
- [ ] Implement `useWebsiteStatus` hook
- [ ] Build `GitHubConnectionCard`
- [ ] Build `DeploymentStatusCard`
- [ ] Implement GitHub OAuth flow (WebView)
- [ ] Add to SettingsScreen navigation

### Phase 2: GitHub Integration (Week 1-2)
- [ ] Setup deep link handling (`whaletools://github-callback`)
- [ ] Create `useGitHubOAuth` hook
- [ ] Implement repository creation flow
- [ ] Implement template push flow
- [ ] Add "Open in VS Code/Cursor" buttons

### Phase 3: Vercel Deployment (Week 2)
- [ ] Create `useDeployments` hook
- [ ] Build `DeploymentHistoryList`
- [ ] Implement real-time status polling
- [ ] Add deployment trigger button
- [ ] Add deployment logs viewer (modal)

### Phase 4: Domain Management (Week 2-3)
- [ ] Create `DomainSetupModal`
- [ ] Implement DNS verification logic
- [ ] Add auto-polling for verification
- [ ] Add copy-to-clipboard for DNS records
- [ ] Display SSL certificate status

### Phase 5: Branding Detail Component (Week 3-4)
- [ ] Create `BrandingDetail.tsx`
- [ ] Implement `useBranding` hook
- [ ] Build `BrandColorPicker`
- [ ] Build `BrandPresetSelector`
- [ ] Implement image upload (logo/banner)
- [ ] Build business hours editor
- [ ] Build policy editors
- [ ] Add custom CSS editor

### Phase 6: Authorize.Net E-commerce (Week 4-5)
- [ ] Enhance `PaymentProcessorsManagementDetail`
- [ ] Add e-commerce processor section
- [ ] Display webhook URLs
- [ ] Add test connection for Authorize.Net
- [ ] Create e-commerce settings section
- [ ] Add Accept.js integration docs

### Phase 7: Testing & Polish (Week 5-6)
- [ ] Test GitHub OAuth flow end-to-end
- [ ] Test deployment workflow
- [ ] Test domain verification
- [ ] Test branding updates
- [ ] Add error handling and retries
- [ ] Add loading states everywhere
- [ ] Add success/error notifications
- [ ] Polish animations and transitions
- [ ] Test on iOS and Android

---

## 📝 API Endpoints Summary

All these endpoints already exist in the web app and can be called from React Native:

### Website Management
- `GET /api/vendor/website/status` - Get current website status
- `POST /api/vendor/website/create` - Create GitHub repository
- `POST /api/vendor/website/push-template` - Push storefront template to repo
- `POST /api/vendor/website/deploy` - Trigger deployment
- `POST /api/vendor/website/create-vercel-project` - Create Vercel project
- `GET /api/vendor/website/vercel-deployments` - Get deployment history
- `GET /api/vendor/website/deployments` - Get deployment logs

### Domain Management
- `POST /api/vendor/website/setup-domain` - Setup custom domain
- `POST /api/vendor/website/verify-domain` - Verify DNS records

### GitHub Integration
- `GET /api/auth/github/callback?code=xxx` - OAuth callback
- `POST /api/webhooks/github` - Webhook receiver (internal)

### Branding
- `GET /api/vendor/branding` - Get current branding
- `PUT /api/vendor/branding` - Update branding settings
- `POST /api/vendor/branding/upload-asset` - Upload logo/banner

### Authorize.Net E-commerce
- `GET /api/authorize-keys` - Get public keys for Accept.js
- `POST /api/authorize-tokenize` - Tokenize payment method
- `POST /api/payment` - Process payment
- `POST /api/webhooks/authorize` - Webhook receiver (internal)

---

## 🔗 External Services Configuration

### GitHub App
- Create GitHub OAuth app at https://github.com/settings/developers
- Callback URL: `whaletools://github-callback` (mobile) + `https://yourdomain.com/api/auth/github/callback` (web)
- Scopes: `repo` (full repository access)
- Store client ID and secret in environment variables

### Vercel
- Create Vercel account with API access
- Generate API token at https://vercel.com/account/tokens
- Store token in environment variables
- Documentation: https://vercel.com/docs/rest-api

### Authorize.Net
- Sign up for merchant account at https://www.authorize.net/
- Generate API credentials in merchant dashboard
- Get Public Client Key for Accept.js
- Generate Signature Key for webhooks
- Test in Sandbox mode first

---

## 🎯 Success Criteria

### Minimum Viable Product (MVP)
- [ ] Vendor can connect GitHub account
- [ ] Vendor can create repository
- [ ] Vendor can push storefront template
- [ ] Vendor can deploy to Vercel
- [ ] Vendor can view deployment status
- [ ] Vendor can customize brand colors
- [ ] Vendor can upload logo
- [ ] Vendor can setup custom domain
- [ ] Vendor can configure Authorize.Net for e-commerce

### Nice to Have
- [ ] Real-time deployment progress
- [ ] Deployment rollback functionality
- [ ] A/B testing for branding
- [ ] Multi-domain support (staging + production)
- [ ] Automated SSL renewal
- [ ] CDN configuration
- [ ] Analytics integration

---

## 📚 Resources & Documentation

### GitHub API
- REST API: https://docs.github.com/en/rest
- OAuth: https://docs.github.com/en/developers/apps/building-oauth-apps
- Octokit SDK: https://github.com/octokit/rest.js

### Vercel API
- REST API: https://vercel.com/docs/rest-api
- Deployments: https://vercel.com/docs/rest-api/endpoints/deployments
- Domains: https://vercel.com/docs/rest-api/endpoints/domains

### Authorize.Net
- Accept.js: https://developer.authorize.net/api/reference/features/acceptjs.html
- API Reference: https://developer.authorize.net/api/reference/index.html
- Webhooks: https://developer.authorize.net/api/reference/features/webhooks.html
- Testing: https://developer.authorize.net/hello_world/testing_guide/

### React Native
- WebView: https://github.com/react-native-webview/react-native-webview
- Deep Linking: https://reactnative.dev/docs/linking
- Image Picker: https://github.com/react-native-image-picker/react-native-image-picker

---

## ✅ Next Steps

1. **Review this document** with your team
2. **Prioritize features** (MVP vs nice-to-have)
3. **Setup external services** (GitHub App, Vercel token, Authorize.Net account)
4. **Create feature branch** in whaletools-native repo
5. **Start with Phase 1** (Website Detail Component)
6. **Implement hooks first** (easier to test)
7. **Build UI components** (reuse existing design patterns)
8. **Test incrementally** (don't wait until the end)
9. **Deploy to TestFlight/Internal Testing** early and often

---

## 💡 Key Insights

### Why This Integration Makes Sense
1. **Unified Management**: Vendors manage website + payment processing in one place
2. **Mobile-First**: React Native app provides better UX than web dashboard
3. **Real-time Updates**: Push notifications for deployments, payments, disputes
4. **Offline Capability**: Cache deployment status, branding settings
5. **Native Performance**: Faster image uploads, smoother animations

### Architecture Benefits
1. **Separation of Concerns**: Vendor websites run on isolated Vercel projects
2. **Scalability**: Each vendor gets their own infrastructure
3. **Security**: No vendor code touches platform code
4. **Flexibility**: Vendors can customize GitHub repo freely
5. **Reliability**: GitHub + Vercel = 99.99% uptime

### Technical Challenges
1. **GitHub OAuth in Mobile**: Requires deep linking or WebView
2. **Real-time Polling**: Battery/data usage concerns (optimize intervals)
3. **Large Images**: Optimize uploads for mobile bandwidth
4. **DNS Verification**: Need clear UX for non-technical vendors
5. **Error Handling**: Many external API failure points

### UX Considerations
1. **Progressive Disclosure**: Show simple options first, advanced later
2. **Clear Status Indicators**: Use colors, icons, badges
3. **Helpful Error Messages**: Explain what went wrong and how to fix
4. **Confirm Destructive Actions**: "Are you sure?" for redeploy, domain changes
5. **Celebrate Success**: Show confetti/animation when site goes live

---

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Author**: Claude Code (via analysis of whaletools + whaletools-native)
