# LoHaggo Mobile - Capacitor Implementation Guide

## Overview

This branch (`feat/mobile/capacitor-integration`) contains the complete Capacitor implementation for Android and iOS mobile versions of LoHaggo. The implementation follows **Option A**: API routes remain on the web server, and mobile apps consume them via HTTPS.

## Architecture

### Key Components

1. **Platform Detection** (`lib/platform.ts`)
   - Detects if running on native (iOS/Android) or web
   - Provides utilities to check platform and plugin availability

2. **API Client** (`lib/api-client.ts`)
   - Abstraction layer for all API calls
   - Automatically routes to `https://lohaggo.com/api` on mobile
   - Routes to `/api` on web
   - Includes timeout handling (10s default)

3. **Geolocation Service** (`lib/geolocation-service.ts`)
   - Unified interface for geolocation on native and web
   - Handles permission requests automatically
   - Supports both `getCurrentPosition` and `watchPosition`

4. **Camera Service** (`lib/camera-service.ts`)
   - Unified interface for camera/photo access
   - Supports single photo capture and multiple image selection
   - Handles permission requests automatically
   - Provides conversion utilities (Blob, File)

5. **Storage Service** (`lib/storage-service.ts`)
   - Unified interface for data persistence
   - Uses Capacitor Preferences on native
   - Uses localStorage on web
   - Supports JSON object storage

6. **Mobile Helpers** (`lib/mobile-helpers.ts`)
   - App lifecycle management
   - Status bar configuration
   - Keyboard handling
   - Haptic feedback
   - Share functionality
   - Network status monitoring

## Installation & Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- For Android: Android Studio, JDK 17+
- For iOS: Xcode 14+, macOS only

### Initial Setup

```bash
# Already completed in this branch
npm install

# Initialize Capacitor platforms (run once)
npm run cap:add:android
npm run cap:add:ios
```

## Build & Development

### Web Development (No changes)

```bash
npm run dev
npm run build
```

### Mobile Development

#### Build for Mobile

```bash
# Build Next.js static export for mobile
npm run build:mobile

# Sync with native platforms
npm run cap:sync
```

#### Run on Android

```bash
# Development
npm run cap:run:android

# Or manually
npm run build:mobile
npm run cap:sync:android
npm run cap:open:android
# Then run from Android Studio
```

#### Run on iOS

```bash
# Development
npm run cap:run:ios

# Or manually
npm run build:mobile
npm run cap:sync:ios
npm run cap:open:ios
# Then run from Xcode
```

#### Production Builds

```bash
# Android APK/AAB
npm run cap:build:android
# Output: android/app/build/outputs/apk/release/

# iOS (requires Xcode)
npm run cap:build:ios
# Then archive in Xcode
```

## Configuration Files

### `capacitor.config.ts`

Main Capacitor configuration:
- App ID: `com.lohaggo.app`
- App Name: `LoHaggo`
- Web directory: `out` (Next.js static export)
- Server configuration for API routing
- Plugin configurations (SplashScreen, StatusBar, etc.)

### `.env.mobile`

Mobile-specific environment variables:
```env
NEXT_PUBLIC_PLATFORM=mobile
NEXT_PUBLIC_API_URL=https://lohaggo.com/api
NEXT_PUBLIC_APP_NAME=LoHaggo
```

### `next.config.js`

Conditional configuration based on `NEXT_PUBLIC_PLATFORM`:
- Enables static export for mobile builds
- Disables image optimization for mobile
- Sets correct API URL

## Native Platform Configuration

### Android

**Location**: `android/app/src/main/AndroidManifest.xml`

Required permissions:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

**App Icons**: `android/app/src/main/res/mipmap-*/`
**Splash Screen**: `android/app/src/main/res/drawable/splash.png`

### iOS

**Location**: `ios/App/App/Info.plist`

Required permissions:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show nearby services</string>
<key>NSCameraUsageDescription</key>
<string>We need camera access to upload photos</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access to upload images</string>
```

**App Icons**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
**Splash Screen**: `ios/App/App/Assets.xcassets/Splash.imageset/`

## Usage Examples

### Using Geolocation

```typescript
import { GeolocationService } from '@/lib/geolocation-service';

// Get current position
const position = await GeolocationService.getCurrentPosition({
  enableHighAccuracy: true,
  timeout: 10000
});

console.log(position.coords.latitude, position.coords.longitude);
```

### Using Camera

```typescript
import { CameraService } from '@/lib/camera-service';

// Capture single photo
const photo = await CameraService.capturePhoto({
  quality: 90,
  source: 'camera',
  resultType: 'uri'
});

// Pick multiple images
const photos = await CameraService.pickImages({ limit: 5 });

// Convert to File for upload
const file = await CameraService.convertToFile(photo, 'photo.jpg');
```

### Using Storage

```typescript
import { StorageService } from '@/lib/storage-service';

// Store string
await StorageService.set('key', 'value');

// Get string
const value = await StorageService.get('key');

// Store object
await StorageService.setObject('user', { id: 1, name: 'John' });

// Get object
const user = await StorageService.getObject('user');
```

### Using API Client

```typescript
import { apiClient } from '@/lib/api-client';

// GET request
const cities = await apiClient.get('/cities');

// POST request
const result = await apiClient.post('/service-requests', {
  title: 'Fix plumbing',
  description: 'Leaking pipe'
});

// Upload with FormData
const formData = new FormData();
formData.append('photo', file);
const response = await apiClient.uploadFormData('/upload-photos', formData);
```

### Using Mobile Helpers

```typescript
import { MobileHelpers } from '@/lib/mobile-helpers';

// Initialize app (call in root layout)
await MobileHelpers.initializeApp();

// Haptic feedback
await MobileHelpers.hapticImpact('medium');

// Share content
await MobileHelpers.share({
  title: 'Check out LoHaggo',
  text: 'Find local services easily',
  url: 'https://lohaggo.com'
});

// Check network status
const status = await MobileHelpers.getNetworkStatus();
if (!status.connected) {
  console.log('No internet connection');
}
```

## Migration Checklist

When adapting existing code for mobile:

- [ ] Replace `fetch('/api/...')` with `apiClient.get('/...')`
- [ ] Replace `navigator.geolocation` with `GeolocationService`
- [ ] Replace `localStorage` with `StorageService`
- [ ] Replace file inputs with `CameraService` for photos
- [ ] Add platform checks where needed using `isNativePlatform()`
- [ ] Test on both web and mobile platforms

## Testing

### Web Testing
```bash
npm run dev
# Test at http://localhost:3000
```

### Android Testing
```bash
# Emulator
npm run cap:run:android

# Physical device (enable USB debugging)
npm run build:mobile
npm run cap:sync:android
# Connect device and run from Android Studio
```

### iOS Testing
```bash
# Simulator
npm run cap:run:ios

# Physical device (requires Apple Developer account)
# Open in Xcode and select device
npm run cap:open:ios
```

## Deployment

### Web Deployment (Vercel)
- Branch: `main`
- Automatic deployment on push
- No changes to existing workflow

### Mobile Deployment

#### Android (Google Play)
1. Build release APK/AAB:
   ```bash
   npm run cap:build:android
   ```
2. Sign the APK/AAB with your keystore
3. Upload to Google Play Console
4. Submit for review

#### iOS (App Store)
1. Build in Xcode:
   ```bash
   npm run cap:open:ios
   ```
2. Archive the app (Product > Archive)
3. Upload to App Store Connect
4. Submit for review

## Troubleshooting

### Build Errors

**"Cannot find module '@capacitor/...'"**
```bash
npm install
npm run cap:sync
```

**"Android SDK not found"**
- Install Android Studio
- Set `ANDROID_HOME` environment variable
- Install SDK Platform 33+ and Build Tools

**"Xcode not found"**
- Install Xcode from App Store
- Run: `sudo xcode-select --switch /Applications/Xcode.app`

### Runtime Errors

**"Plugin not available"**
- Check if plugin is installed: `npm list @capacitor/plugin-name`
- Sync platforms: `npm run cap:sync`
- Rebuild native project

**"Permission denied"**
- Check AndroidManifest.xml / Info.plist for permission declarations
- Request permissions at runtime using service methods

**"API calls failing"**
- Check network connectivity
- Verify API URL in `.env.mobile`
- Check CORS configuration on server
- Test API endpoint directly in browser

### Platform-Specific Issues

**Android: App crashes on startup**
- Check logcat: `adb logcat`
- Verify all permissions in AndroidManifest.xml
- Check for missing dependencies

**iOS: App rejected by App Store**
- Ensure all permission descriptions are clear
- Remove unused permissions from Info.plist
- Test on physical device before submission

## Performance Optimization

1. **Lazy Loading**: Use dynamic imports for heavy components
2. **Image Optimization**: Compress images before upload
3. **API Caching**: Implement request caching with StorageService
4. **Bundle Size**: Monitor and minimize JavaScript bundle
5. **Network Requests**: Batch API calls when possible

## Security Considerations

1. **API Authentication**: All API calls should include auth tokens
2. **HTTPS Only**: Enforce HTTPS for all network requests
3. **Data Encryption**: Sensitive data in StorageService should be encrypted
4. **Certificate Pinning**: Consider for production API calls
5. **Deep Link Validation**: Validate all deep link parameters

## Next Steps

1. **Initialize Native Platforms**:
   ```bash
   npm run cap:add:android
   npm run cap:add:ios
   ```

2. **Configure App Icons & Splash Screens**:
   - Generate icons: Use tools like [Capacitor Assets](https://github.com/ionic-team/capacitor-assets)
   - Place in respective platform directories

3. **Test Core Functionality**:
   - User authentication
   - Geolocation
   - Photo upload
   - Service requests

4. **Setup Push Notifications** (if needed):
   - Configure Firebase (Android) and APNs (iOS)
   - Implement push notification handling

5. **Prepare for Store Submission**:
   - Create store listings
   - Prepare screenshots
   - Write privacy policy
   - Set up developer accounts

## Support & Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Plugins](https://capacitorjs.com/docs/plugins)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Android Developer Guide](https://developer.android.com/)
- [iOS Developer Guide](https://developer.apple.com/)

## Branch Strategy

- `main`: Production web deployment (Vercel)
- `feat/mobile/capacitor-integration`: Mobile development (this branch)
- `feat/mobile/android-build`: Android-specific features
- `feat/mobile/ios-build`: iOS-specific features

**Important**: Do NOT merge mobile branch to `main` until web and mobile are fully separated in deployment pipeline.
