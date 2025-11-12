# PWA Configuration - LoHaggo

## ✅ PWA Features Implemented

### 📱 Installation Support
- ✅ iOS (Safari) - Add to Home Screen
- ✅ Android (Chrome) - Install App
- ✅ Desktop (Chrome, Edge) - Install App
- ✅ Custom install prompt with PWAInstallPrompt component

### 🔄 Service Worker
- ✅ Offline support with fallback page
- ✅ Cache strategies (Cache First, Network First, Stale While Revalidate)
- ✅ Automatic updates with user notification
- ✅ Background sync ready

### 🎨 Icons & Assets
- ✅ Favicon (16x16, 32x32)
- ✅ Apple Touch Icon (180x180)
- ✅ PWA Icons (192x192, 512x512)
- ✅ Maskable icons for Android
- ✅ SVG icon for modern browsers

### 📄 Configuration Files
- ✅ manifest.json - PWA manifest
- ✅ sw.js - Service worker
- ✅ offline.html - Offline fallback page
- ✅ browserconfig.xml - Windows tile configuration

## 🚀 Testing PWA

### Local Testing
```bash
# 1. Build the app
npm run build

# 2. Start production server
npm start

# 3. Open in browser
# Chrome: chrome://flags/#unsafely-treat-insecure-origin-as-secure
# Add: http://localhost:3000
```

### Production Testing
1. Deploy to Vercel/production
2. Open in mobile browser
3. Look for "Add to Home Screen" or "Install" prompt

### Lighthouse Audit
```bash
# Run Lighthouse PWA audit
npx lighthouse https://lohaggo.vercel.app --view --preset=desktop
```

## 🛠️ Development Scripts

```bash
# Generate all PWA icons from SVG
npm run generate-icons

# Check PWA configuration
npm run check-pwa
```

## 📱 iOS Installation

1. Open Safari on iOS
2. Navigate to https://lohaggo.vercel.app
3. Tap the Share button
4. Scroll down and tap "Add to Home Screen"
5. Tap "Add"

## 🤖 Android Installation

1. Open Chrome on Android
2. Navigate to https://lohaggo.vercel.app
3. Tap the menu (three dots)
4. Tap "Install app" or "Add to Home screen"
5. Tap "Install"

## 💻 Desktop Installation

1. Open Chrome or Edge
2. Navigate to https://lohaggo.vercel.app
3. Look for install icon in address bar
4. Click "Install"

## 🔧 Customization

### Update Icons
1. Edit `public/icon.svg`
2. Run `npm run generate-icons`
3. All PNG icons will be regenerated

### Update Manifest
Edit `public/manifest.json`:
- `name` - Full app name
- `short_name` - Short name for home screen
- `theme_color` - Theme color
- `background_color` - Splash screen background

### Update Service Worker
Edit `public/sw.js`:
- `CACHE_NAME` - Increment version to force update
- `PRECACHE_URLS` - Add/remove URLs to cache
- Cache strategies - Modify caching behavior

## 📊 PWA Score

Run `npm run check-pwa` to see current PWA score:
- ✅ 100% - All requirements met
- ⚠️  <100% - Some warnings
- ❌ <80% - Critical issues

## 🔍 Troubleshooting

### Service Worker Not Updating
1. Increment `CACHE_NAME` in `public/sw.js`
2. Clear browser cache
3. Hard reload (Ctrl+Shift+R)

### Icons Not Showing
1. Check `public/` directory for icon files
2. Run `npm run generate-icons`
3. Verify manifest.json icon paths

### Install Prompt Not Showing
1. Must be HTTPS (or localhost)
2. Must have valid manifest.json
3. Must have service worker
4. User must visit site at least twice
5. Must wait 5 minutes between visits

## 📚 Resources

- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Builder](https://www.pwabuilder.com/)
