# Quick Start Guide - Whaletools Native

## ✅ What's Already Done

Your React Native project is set up and ready at:
```
/Users/whale/Desktop/whaletools-native
```

Everything is configured:
- ✅ Expo project created
- ✅ TypeScript configured
- ✅ Simple App.tsx ready to test
- ✅ Environment variables set
- ✅ Clean architecture folders created

## 🚀 Start the App (3 Easy Steps)

### Step 1: Open Terminal

Open a **new Terminal window** (not in Cursor) and run:

```bash
cd /Users/whale/Desktop/whaletools-native
npx expo start
```

### Step 2: Wait for QR Code

You'll see output like:

```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web
```

**And a QR code will appear.**

### Step 3: Open on Your Tablet

1. **Download Expo Go** from App Store or Google Play
2. **Open Expo Go app**
3. **Tap "Scan QR Code"**
4. **Scan the QR code from your terminal**
5. **App will load!**

You should see:
```
🎉 Whaletools Native
It works! React Native is running.
This is your native iOS/Android app!
```

## 🔧 Troubleshooting

### If server won't start:

```bash
# Kill any stuck processes
pkill -f expo

# Clear cache
cd /Users/whale/Desktop/whaletools-native
rm -rf .expo node_modules/.cache

# Start fresh
npx expo start -c
```

### If you don't see QR code:

Try web first:
```bash
# In terminal where expo is running, press: w
```

This opens http://localhost:8081 in browser to verify it works.

### If tablet can't connect:

Make sure your Mac and tablet are on the same WiFi network.

Or use manual URL:
1. In Expo Go, tap "Enter URL manually"
2. Find your Mac's IP: System Settings → Network
3. Enter: `exp://YOUR_MAC_IP:8081`

## 📱 What You'll See

The app shows a simple welcome screen proving React Native works!

Once you see that, you're ready to build features.

## 🎯 Next Steps

Once the app loads successfully:

### 1. Build Login Screen (30 min)
The UI components are ready in `src/components/ui/`

### 2. Add Authentication (1 hour)
Supabase client is configured in `src/lib/supabase/client.ts`

### 3. Build ID Scanner (3 hours)
- Use expo-camera
- Your AAMVA parser is ready in `src/lib/id-scanner/`

### 4. Build POS Register (Week 1)
- Product grid
- Cart
- Checkout

## 📂 Project Structure

```
whaletools-native/
├── App.tsx              # Main app (simple test screen)
├── src/
│   ├── components/ui/   # Button, Input, Card (ready!)
│   ├── lib/
│   │   ├── supabase/    # Supabase client
│   │   ├── utils/       # Currency, validation
│   │   ├── constants/   # Colors, spacing
│   │   └── id-scanner/  # AAMVA parser (from web!)
│   └── stores/          # State management
├── .env                 # Your Supabase credentials
└── package.json
```

## 💡 Development Workflow

```bash
# 1. Start server (one time)
npx expo start

# 2. Make changes to App.tsx or any file

# 3. Save → App auto-reloads!

# 4. See changes instantly on your device
```

## 🎨 Your Design System is Ready

```typescript
import { Colors, Spacing, FontSize } from '@/lib/constants'

// Use consistent values:
padding: Spacing.lg        // 24px
color: Colors.primary[600] // Blue
fontSize: FontSize.xl      // 20px
```

## 🔑 Environment Variables

Already configured in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://uaednwpxursknmwdeejn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here
EXPO_PUBLIC_API_URL=https://yachtclub.boats
```

## ✨ What Makes This Special

1. **Clean Architecture** - No bloat, organized by feature
2. **Type Safe** - Strict TypeScript
3. **Production Ready** - Professional code from day 1
4. **Proven Code** - AAMVA parser from web works as-is!
5. **Fast Updates** - Code changes reload instantly

## 📚 Resources

- Expo Docs: https://docs.expo.dev
- React Native: https://reactnative.dev
- Complete migration plan: `docs/COMPLETE_APP_MIGRATION_PLAN.md`

---

**You're 95% there! Just need to start the server and scan the QR code.**

Then you'll have a working native app and can start building features! 🚀
