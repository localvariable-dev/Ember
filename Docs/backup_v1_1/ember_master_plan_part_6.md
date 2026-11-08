---

## 7. Tech Stack, GitHub Actions APK Build Pipeline & Implementation Phases

### 7.1 Stack Decision & Rationale

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **React Native (Expo, CNG/Prebuild)** | Expo's Continuous Native Generation eliminates committing `android/` to source control while still supporting native modules (`expo-audio`, `expo-sqlite`, `expo-notifications`). One `npx expo prebuild --platform android` regenerates the native project from `app.config.ts`. The entire codebase is TypeScript — Codex builds it without switching languages. |
| **Router** | **Expo Router v4** (file-based, `app/` directory) | Two routes (`/` = Sanctuary, `/player` = Player) + bottom sheets. Deep links (`ember://begin?protocol=<id>`) map directly to Expo Router's scheme handling. |
| **Audio** | **`expo-audio`** (Plan A); native Kotlin module via Expo Modules API (Plan B, §6.9) | `expo-audio` provides background playback, lock-screen controls, and `setAudioModeAsync`. Plan B is a pre-designed escape hatch if dual-player focus issues surface on real devices. |
| **Database** | **`expo-sqlite`** (synchronous API via `openDatabaseSync`) | WAL mode, zero network, instant reads. All state lives in one `ember.db` file. Migration system uses `PRAGMA user_version`. |
| **Animations** | **`react-native-reanimated` v4** + **`react-native-worklets`** | Worklet-based animations for the breathing orb, card selection halos, and sheet transitions. All animated properties are `transform`/`opacity` only (§2.1.3). Reanimated v4 requires New Architecture (Fabric), which is the default in SDK 58. |
| **SVG** | **`react-native-svg`** | Streak ember ring, progress arc, heatmap cells, breathing orb radial gradient. |
| **Haptics** | **`expo-haptics`** + `Vibration` API | See the full haptic map in §2.1.4. |
| **Notifications** | **`expo-notifications`** | One pending date-trigger at a time; Android channel `gentle` (§3.6). |
| **Fonts** | **`@expo-google-fonts/fraunces`**, **`@expo-google-fonts/inter`** | Bundled via Expo's font loading. Splash stays up until fonts resolve (`expo-splash-screen`). |
| **Crypto** | **`expo-crypto`** | `randomUUID()` for all primary keys. |
| **Screen wake** | **`expo-keep-awake`** | Focus mode only (§6.8). |
| **Build** | **EAS Build (local) or Gradle `assembleRelease`** | GitHub Actions runs `npx expo prebuild --platform android` then `cd android && ./gradlew assembleRelease`. No EAS cloud required — the APK is built locally in CI. |
| **Language** | **TypeScript 5.x, strict mode** | `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`. No `any` outside generated files. |
| **Linting / formatting** | **ESLint (Expo preset)** + **Prettier** | Single config; CI fails on lint errors. |
| **Testing** | **Jest** (unit) + **`better-sqlite3`** (SQL in CI) | Domain logic and SQL queries are tested in Node (no emulator). Integration tests run on a physical device or emulator manually before release. |
| **State management** | **Zustand** (tiny, no boilerplate) | `useSheetStore` (which sheets are open), `useSessionStore` (active session state). All persistent state lives in SQLite via repositories; Zustand is ephemeral UI state only. |

### 7.2 Project Structure (canonical)

```
ember/
├── .github/
│   └── workflows/
│       └── build-apk.yml              # §7.5
├── app/
│   ├── _layout.tsx                     # RootProviders → GestureHandlerRootView → Stack
│   ├── index.tsx                       # Sanctuary (route "/")
│   └── player.tsx                      # Player (route "/player")
├── assets/
│   ├── audio/
│   │   ├── voice/                      # *.ogg (Opus 32 kbps mono per voice)
│   │   ├── beds/                       # *.ogg, *.flac
│   │   ├── chime_rise.wav
│   │   └── LICENSES.md
│   ├── fonts/                          # auto-linked by @expo-google-fonts
│   ├── icon.png                        # 1024×1024 adaptive icon source
│   ├── splash.png                      # OLED black + amber ember ring
│   └── adaptive-icon.png
├── plugins/
│   └── withReleaseSigning.ts           # Expo config plugin for Gradle signing
├── src/
│   ├── design/
│   │   ├── tokens.ts                   # §2.1.1 color, type, spacing, shape
│   │   └── haptics.ts                  # §2.1.4
│   ├── domain/
│   │   ├── constants.ts                # §3.2 — single source of truth
│   │   ├── clock.ts                    # Clock interface, SystemClock, DevClock
│   │   ├── dayKey.ts                   # DayKey type, dayKeyFromMs, daysBetween, addDays
│   │   ├── streakEngine.ts             # §3.3 applyCredit, projectStreak, qualifiesForFreePass
│   │   ├── sessionMachine.ts           # §3.4 pure reducer + effect types
│   │   ├── calmDelta.ts                # §3.8 insight computation
│   │   ├── timeOfDay.ts                # §3.7 defaultProtocol, greeting
│   │   └── notificationPlanner.ts      # §3.6 planNextNotification
│   ├── data/
│   │   ├── db.ts                       # Db interface, ExpoSqliteDb, TestDb (better-sqlite3)
│   │   ├── migrations.ts               # §5.2 ordered SQL migrations
│   │   ├── types.ts                    # §5.3 TypeScript models
│   │   ├── queries.ts                  # §5.5 raw SQL strings
│   │   └── repos/
│   │       ├── SessionRepo.ts
│   │       ├── StreakRepo.ts
│   │       ├── LedgerRepo.ts
│   │       ├── EntitlementRepo.ts
│   │       ├── PrefsRepo.ts
│   │       ├── ProtocolRepo.ts
│   │       └── VoiceRepo.ts
│   ├── billing/
│   │   ├── types.ts                    # §4.3 BillingService, EntitlementService interfaces
│   │   ├── entitlementTypes.ts         # §4.3 AccessLevel, GateDecision, etc.
│   │   ├── MockBillingAdapter.ts       # §4.7
│   │   ├── EntitlementServiceImpl.ts   # §4.6 resolution logic
│   │   ├── PaywallProvider.tsx         # §4.3 PaywallProvider context + controller
│   │   └── createBillingService.ts     # factory: env → adapter
│   ├── audio/
│   │   ├── AudioDriver.ts             # §6.7 PlayerHandle, AudioDriver interface
│   │   ├── ExpoAudioDriver.ts         # Plan A implementation
│   │   ├── DualTrackEngine.ts          # §6.7 voice + ambient orchestration
│   │   ├── VoicePackService.ts         # Runtime .embervoice pack importer
│   │   ├── assetRegistry.generated.ts  # generated — static require() map
│   │   ├── protocols.generated.json    # generated — cues, SHA-256, asset versions
│   │   └── beds.ts                     # static ambient bed declarations
│   ├── features/
│   │   ├── sanctuary/
│   │   │   ├── SanctuaryScreen.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── StreakPill.tsx
│   │   │   ├── GreetingBlock.tsx
│   │   │   ├── SessionCardList.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   ├── ModeToggle.tsx
│   │   │   ├── AmbientChips.tsx
│   │   │   ├── VoiceAndPacerRow.tsx     # VoiceChip selector + Sigh Pacer switch
│   │   │   └── BeginRestButton.tsx
│   │   ├── player/
│   │   │   ├── PlayerScreen.tsx
│   │   │   ├── OrbitalRing.tsx         # SVG: ProgressArc + BreathingOrb + CoreDot
│   │   │   ├── CueLabel.tsx
│   │   │   ├── RemainingTime.tsx
│   │   │   ├── PreStateStrip.tsx
│   │   │   ├── TransportControls.tsx
│   │   │   ├── MixerSliders.tsx        # VoiceSlider + VoiceChip, AmbientSlider + BedChip
│   │   │   ├── VoicePickerSheet.tsx    # Switch narrator voice / import pack
│   │   │   ├── PostCheckIn.tsx
│   │   │   ├── SessionSummary.tsx
│   │   │   ├── SighPacer.tsx
│   │   │   └── SessionController.ts    # thin side-effect executor for sessionMachine
│   │   ├── journey/
│   │   │   ├── JourneySheet.tsx
│   │   │   ├── StreakHeader.tsx
│   │   │   ├── Heatmap.tsx
│   │   │   ├── StatsRow.tsx
│   │   │   ├── CalmDeltaCard.tsx
│   │   │   ├── SessionRow.tsx
│   │   │   ├── ProInsightsTeaser.tsx
│   │   │   └── MembershipCard.tsx
│   │   ├── paywall/
│   │   │   ├── PaywallSheet.tsx
│   │   │   ├── PlanCard.tsx
│   │   │   └── ValueProps.tsx
│   │   └── dev/
│   │       └── DevPanel.tsx            # §4.7 — compiled only in dev/mock
│   ├── providers/
│   │   ├── DbProvider.tsx
│   │   ├── ClockProvider.tsx
│   │   ├── EntitlementProvider.tsx
│   │   └── SheetHost.tsx               # renders Journey + Paywall + VoicePicker sheets above all routes
│   └── stores/
│       ├── useSheetStore.ts            # Zustand: which sheet is open
│       └── useSessionStore.ts          # Zustand: ephemeral active session state
├── tools/
│   └── audio/                          # §6.4 offline generation pipeline
│       ├── voices.config.json
│       ├── tts/
│       │   ├── TtsAdapter.mjs
│       │   └── VoiceStudioAdapter.mjs
│       ├── scripts/
│       │   ├── rapid_reset_5.script.json
│       │   ├── afternoon_recharge_10.script.json
│       │   └── deep_rest_30.script.json
│       ├── lib/
│       │   ├── timeline.mjs
│       │   └── ffmpeg.mjs
│       ├── build-audio.mjs
│       ├── make-placeholders.mjs
│       ├── make-beds.mjs
│       ├── make-chime.mjs
│       └── verify-assets.mjs
├── package.json
├── app.config.ts                       # Expo config (CNG)
├── babel.config.js                     # presets: ['babel-preset-expo']
├── metro.config.js                     # assetExts: ogg, opus, flac
├── tsconfig.json
└── README.md
```

### 7.3 `app.config.ts` (key fields)

```ts
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Ember: NSDR & Deep Rest',
  slug: 'ember',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  scheme: 'ember',                      // deep links: ember://begin?protocol=<id>
  newArchEnabled: true,
  updates: { enabled: false },          // offline-first, no OTA
  assetBundlePatterns: ['assets/**/*'],
  android: {
    package: 'com.emberrest.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    permissions: [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.WAKE_LOCK',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
    ],
    blockedPermissions: [
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
    ],
    allowBackup: false,                 // mock entitlements intentionally reset on reinstall
    softwareKeyboardLayoutMode: 'pan',
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    ['expo-audio', { microphonePermission: false }],
    'expo-notifications',
    'expo-haptics',
    'expo-crypto',
    'expo-keep-awake',
    './plugins/withReleaseSigning',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/splash.png',
        imageWidth: 200,
      },
    ],
  ],
  extra: {
    eas: { projectId: '<EAS_PROJECT_ID>' },     // set when EAS is initialized
  },
});
```

### 7.4 `metro.config.js` & `babel.config.js`

`metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'ogg', 'opus', 'flac']));
module.exports = config;
```

`babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

### 7.5 `package.json` (dependencies — versions pinned)

```json
{
  "name": "ember",
  "version": "1.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "prebuild": "expo prebuild --platform android --clean",
    "build:apk": "npm run prebuild && cd android && ./gradlew assembleRelease",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "format": "prettier --check .",
    "test": "jest --forceExit",
    "test:tz": "TZ=Asia/Kolkata jest --forceExit && TZ=America/New_York jest --forceExit",
    "verify:assets": "node tools/audio/verify-assets.mjs",
    "placeholders": "node tools/audio/make-placeholders.mjs && node tools/audio/make-chime.mjs"
  },
  "dependencies": {
    "expo": "~58.0.0",
    "expo-audio": "~58.0.11",
    "expo-crypto": "~58.0.7",
    "expo-font": "~58.0.0",
    "expo-haptics": "~58.0.7",
    "expo-keep-awake": "~58.0.3",
    "expo-notifications": "~58.1.8",
    "expo-router": "~58.0.30",
    "expo-splash-screen": "~58.0.0",
    "expo-sqlite": "~58.0.15",
    "expo-status-bar": "~58.0.0",
    "@expo-google-fonts/fraunces": "*",
    "@expo-google-fonts/inter": "*",
    "react": "19.0.0",
    "react-native": "0.88.1",
    "react-native-reanimated": "~4.7.1",
    "react-native-worklets": "~1.0.0",
    "react-native-safe-area-context": "~5.0.0",
    "react-native-screens": "~4.4.0",
    "react-native-svg": "~15.16.1",
    "react-native-gesture-handler": "~2.20.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~19.0.0",
    "better-sqlite3": "^11.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "eslint": "^9.0.0",
    "eslint-config-expo": "~8.0.0",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "prettier": "^3.4.0",
    "typescript": "~5.6.0"
  }
}
```

### 7.6 `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "paths": {
      "@/*": ["./src/*"],
      "@assets/*": ["./assets/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

### 7.7 GitHub Actions APK Build Pipeline (`.github/workflows/build-apk.yml`)

```yaml
name: Build APK

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

env:
  NODE_VERSION: '20'
  JAVA_VERSION: '17'
  EXPO_PUBLIC_BILLING_MODE: 'mock'

jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate placeholders (so asset verification succeeds in CI)
        run: npm run placeholders

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format

      - name: Verify audio assets
        run: npm run verify:assets

      - name: Run tests (IST timezone)
        run: TZ=Asia/Kolkata npx jest --forceExit --ci

      - name: Run tests (EST timezone)
        run: TZ=America/New_York npx jest --forceExit --ci

  build-apk:
    name: Build Android APK
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: ${{ env.JAVA_VERSION }}

      - name: Setup Gradle cache
        uses: gradle/actions/setup-gradle@v4

      - name: Install dependencies
        run: npm ci

      - name: Generate placeholders
        run: npm run placeholders

      - name: Generate native project (Expo Prebuild)
        run: npx expo prebuild --platform android --clean --no-install

      - name: Decode keystore (release builds only)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 --decode > android/app/release.keystore

      - name: Configure signing (release builds only)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: |
          cat >> android/gradle.properties <<EOF
          EMBER_RELEASE_STORE_FILE=release.keystore
          EMBER_RELEASE_STORE_PASSWORD=${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          EMBER_RELEASE_KEY_ALIAS=${{ secrets.ANDROID_KEY_ALIAS }}
          EMBER_RELEASE_KEY_PASSWORD=${{ secrets.ANDROID_KEY_PASSWORD }}
          EOF

      - name: Build APK
        working-directory: android
        run: ./gradlew assembleRelease --no-daemon -Dorg.gradle.jvmargs="-Xmx4g"

      - name: Verify APK size
        run: |
          APK_PATH=$(find android/app/build/outputs/apk/release -name '*.apk' | head -1)
          SIZE_MB=$(du -m "$APK_PATH" | cut -f1)
          echo "APK size: ${SIZE_MB} MB"
          if [ "$SIZE_MB" -gt 90 ]; then
            echo "::error::APK size ${SIZE_MB} MB exceeds 90 MB hard limit"
            exit 1
          fi

      - name: Verify no placeholder audio in release
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: |
          if grep -q '"placeholder": true' src/audio/protocols.generated.json 2>/dev/null; then
            echo "::error::Release build contains placeholder audio assets"
            exit 1
          fi

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: ember-release-apk
          path: android/app/build/outputs/apk/release/*.apk
          retention-days: 30
          if-no-files-found: error
```

### 7.8 Release Signing Config Plugin (`plugins/withReleaseSigning.ts`)

```ts
import { ConfigPlugin, withAppBuildGradle } from '@expo/config-plugins';

const withReleaseSigning: ConfigPlugin = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('EMBER_RELEASE_STORE_FILE')) {
      config.modResults.contents += `
android {
    signingConfigs {
        release {
            if (project.hasProperty('EMBER_RELEASE_STORE_FILE')) {
                storeFile file(EMBER_RELEASE_STORE_FILE)
                storePassword EMBER_RELEASE_STORE_PASSWORD
                keyAlias EMBER_RELEASE_KEY_ALIAS
                keyPassword EMBER_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
`;
    }
    return config;
  });
};

export default withReleaseSigning;
```

### 7.9 Implementation Phases Summary (Phases 1–6)
Follows the exact sequential structure from §8, ensuring Phase 1 creates placeholders so asset verification succeeds immediately, and wrapping `app/_layout.tsx` in `<GestureHandlerRootView>`.