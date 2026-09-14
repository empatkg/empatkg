# FL Mobile Studio - Android Compilation Guide

This repository contains automated CI/CD and multiple compilation pathways for Android:

---

### Option 1: Automated GitHub Actions APK Build (Recommended)
This repository includes an automated GitHub Actions workflow at `.github/workflows/build-apk.yml`.

1. **Export to GitHub**: Use the AI Studio top-right menu > **Export to GitHub** (or push your repository to GitHub).
2. **Automatic Compilation**:
   - Whenever you push to `main` or `master`, GitHub Actions triggers automatically.
   - You can also go to your GitHub repository > **Actions** tab > **"Build Android APK"** > click **"Run workflow"**.
3. **Download your `.apk`**:
   - Once the build finishes (~2-3 minutes), click on the completed run.
   - Under the **Artifacts** section at the bottom, download **`FL-Studio-Mobile-APK`**.
   - Inside the zip, you will find `app-debug.apk` ready to install directly on any Android device!

---

### Option 2: Native Android WebAPK / PWA (Instant, 0 setup required)
The web app is equipped with a modern **PWA Service Worker** and **Web App Manifest**.

1. Open the preview URL or deployed Cloud Run URL in **Google Chrome** on your Android phone or tablet.
2. Tap the **"Install App"** button in the top transport bar (or tap Chrome's `⋮` menu > **"Add to Home screen"** / **"Install App"**).
3. Android automatically packages and compiles the app into a native **WebAPK** with its own home screen icon, fullscreen landscape orientation, microphone recording capabilities, and offline playback.

---

### Option 2: Native Android Studio (Kotlin + Jetpack Compose)
The native Kotlin Android source code is located in `/android`:

- **Gradle Build Script:** `android/app/build.gradle.kts`
- **Manifest & Permissions:** `android/app/src/main/AndroidManifest.xml`
- **Audio & Sampler Engine (Kotlin):** `android/app/src/main/java/com/flstudio/mobile/audio/AudioEngine.kt`
- **Polyphonic Synthesizer (Kotlin):** `android/app/src/main/java/com/flstudio/mobile/audio/SynthEngine.kt`
- **UI (Jetpack Compose):** `android/app/src/main/java/com/flstudio/mobile/ui/DawScreen.kt`

#### Steps to compile `.apk`:
1. Open **Android Studio** (Koala / Ladybug or newer).
2. Select **"Open an Existing Project"** and select the `/android` folder.
3. Allow Gradle to sync dependencies.
4. Run the Gradle build command in terminal:
   ```bash
   ./gradlew assembleDebug
   ```
5. Your compiled `.apk` will be output at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

### Option 3: Compile APK via Capacitor CLI (Instant Web-to-APK Wrapper)
You can bundle the high-performance Web Audio engine into a standalone Android APK:

```bash
# 1. Build web distribution
npm run build

# 2. Initialize Capacitor Android project
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "FL Mobile Studio" "com.flstudio.mobile" --web-dir dist
npx cap add android

# 3. Compile the APK
npx cap build android
# or open in Android Studio:
npx cap open android
```
