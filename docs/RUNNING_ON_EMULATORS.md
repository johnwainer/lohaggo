# Running Haggo Mobile App on Emulators

## Prerequisites

### For Android Emulator

1. **Install Android Studio**
   - Download from: https://developer.android.com/studio
   - During installation, make sure to install:
     - Android SDK
     - Android SDK Platform
     - Android Virtual Device (AVD)

2. **Set up Android SDK environment variables**

   Add these lines to your `~/.zshrc` or `~/.bash_profile`:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   ```

   Then reload your shell:
   ```bash
   source ~/.zshrc
   ```

   Or for the current session only:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
   ```

3. **Create an Android Virtual Device (AVD)**

   **Using Android Studio (Recommended):**
   - Open Android Studio
   - Click "More Actions" → "Virtual Device Manager" (or Tools → Device Manager)
   - Click "Create Device"
   - Select a device (recommended: Pixel 5 or Pixel 6)
   - Click "Next"
   - Select a system image (recommended: API 33 - Android 13.0 or API 34 - Android 14.0)
     - If not downloaded, click "Download" next to the system image
   - Click "Next"
   - Give it a name (e.g., "Pixel_5_API_33")
   - Click "Finish"

### For iOS Simulator (macOS only)

1. **Install Xcode**
   - Download from Mac App Store
   - Open Xcode and accept license agreements
   - Install Command Line Tools:
     ```bash
     xcode-select --install
     ```

2. **Verify installation**
   ```bash
   xcrun simctl list devices
   ```

## Running the App

### Android

1. **Start the Android Emulator**
   - Open Android Studio → Device Manager
   - Click the play button next to your AVD

   Or from command line:
   ```bash
   emulator -avd Pixel_5_API_33
   ```

2. **Run the app**
   ```bash
   npm run android
   ```

   This will:
   - Build the Next.js app for mobile
   - Sync the web assets to the Android project
   - Build the Android app
   - Install and launch it on the running emulator

### iOS

1. **Run the app** (this will automatically start a simulator)
   ```bash
   npm run ios
   ```

   Or to choose a specific simulator:
   ```bash
   npx cap run ios --target="iPhone 15 Pro"
   ```

## Useful Commands

### Android
- `npm run android` - Build and run on Android emulator
- `npm run cap:open:android` - Open Android project in Android Studio
- `npm run cap:sync:android` - Sync web assets to Android
- `npm run cap:build:android` - Build release APK

### iOS
- `npm run ios` - Build and run on iOS simulator
- `npm run cap:open:ios` - Open iOS project in Xcode
- `npm run cap:sync:ios` - Sync web assets to iOS
- `npm run cap:build:ios` - Build iOS app

### General
- `npm run build:mobile` - Build Next.js app for mobile
- `npm run export:mobile` - Build and sync to both platforms
- `npm run cap:sync` - Sync to both Android and iOS

## Troubleshooting

### Build Issues

If the build hangs or fails:

1. **Clear build cache**
   ```bash
   rm -rf .next out node_modules/.cache
   npm run build:mobile
   ```

2. **Check for errors**
   ```bash
   npm run build:mobile 2>&1 | tee build.log
   cat build.log
   ```

3. **Use webpack instead of turbopack**
   The build script already uses `--webpack` flag for compatibility

### Android SDK Not Found

```bash
# Verify Android SDK location
echo $ANDROID_HOME

# If not set, add to ~/.zshrc:
export ANDROID_HOME=$HOME/Library/Android/sdk
source ~/.zshrc
```

### iOS Simulator Not Found

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
xcrun simctl list devices
```

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## Development Workflow

1. **Make changes to your code**
2. **Rebuild and sync**
   ```bash
   npm run build:mobile && npm run cap:sync
   ```
3. **Reload app in emulator**
   - Android: Press R twice quickly
   - iOS: Cmd+R in simulator

## Live Reload (Development)

For faster development, you can use live reload:

```bash
# 1. Start Next.js dev server
npm run dev

# 2. Update capacitor.config.ts to point to dev server
# Change server.url to: http://localhost:3000

# 3. Sync and run
npm run cap:sync
npm run cap:open:android  # or ios
```

## Building Release APK/IPA

### Android Release Build
```bash
npm run cap:build:android
# APK will be in: android/app/build/outputs/apk/release/
```

### iOS Release Build
```bash
npm run cap:build:ios
# Then open Xcode and archive the app
```

## Current Status

✅ Capacitor configured
✅ All plugins installed
✅ Mobile assets generated
✅ Android and iOS platforms initialized
⚠️ Emulators need to be set up on your machine

## Next Steps

1. Install Android Studio or Xcode
2. Set up emulators/simulators
3. Run `npm run cap:run:android` or `npm run cap:run:ios`
4. Test the app on the emulator

## Useful Commands

```bash
# Check Capacitor configuration
npx cap doctor

# Update Capacitor
npm install @capacitor/cli@latest @capacitor/core@latest

# Add new plugin
npm install @capacitor/[plugin-name]
npx cap sync

# Clean and rebuild
rm -rf android ios
npm run cap:add:android
npm run cap:add:ios
npm run generate-mobile-assets
npm run build:mobile
npm run cap:sync
```
