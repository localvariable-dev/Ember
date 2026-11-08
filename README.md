# Ember: NSDR & Deep Rest

> **Android-first, offline-first guided-rest application for nervous system recovery, circadian dip management, and deep sleep wind-down.**

---

## 1. Product Philosophy & Guarantees

- **Zero Overwhelm:** Fast session start under 5 seconds — no endless catalogs or scrolling.
- **Strict Privacy & Offline-First:**
  - Zero analytics SDKs.
  - Zero cloud synchronisation.
  - Zero advertisements.
  - Core rest sessions and personal history run entirely offline in local SQLite.
- **Neuroscience-Backed Rest Architecture:**
  - **5 min — Rapid Reset (Free):** Acute stress & pre-meeting physiological sigh release.
  - **10 min — Afternoon Recharge (Free):** Post-lunch circadian dip restoration with body scan & breath slowing (supports Focus and Sleep modes).
  - **30 min — Deep Rest & Yoga Nidra (PRO):** Deep parasympathetic recovery, sleep debt compensation, and insomnia wind-down.
- **In-Flight Narrator Switching:** Seamlessly change narrators during active playback with smooth crossfading and synchronised timelines.
- **Calm Retention:** Forgiving ember streak with banked Grace Days (Rest Grace) and a self-reported perceived-state Calm Delta.

---

## 2. Technical Stack

| Component        | Choice                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------- |
| **Framework**    | Expo SDK 58 (React Native 0.88.1, React 19, CNG / Prebuild)                            |
| **Language**     | TypeScript 5.6 (Strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| **Router**       | Expo Router v4 (`app/`)                                                                |
| **Audio Engine** | `expo-audio` dual-track engine (voice master clock + ambient slave)                    |
| **Database**     | `expo-sqlite` (WAL mode, synchronous API, local SQLite)                                |
| **Animations**   | `react-native-reanimated` v4 + `react-native-worklets`                                 |
| **Graphics**     | `react-native-svg`                                                                     |
| **Package ID**   | `com.emberrest.app` (Min API 24 — Android 7.0+)                                        |

---

## 3. Directory Layout

```
.
├── .github/
│   └── workflows/
│       └── build-apk.yml          # GitHub Actions APK build & verification pipeline
├── app/                           # Expo Router screens (Sanctuary "/", Player "/player")
├── assets/                        # Bundled audio, fonts, icon, splash
├── Docs/                          # Ember Master Plan v1.1 specifications (Parts 1–6)
├── plugins/                       # Expo config plugins (withReleaseSigning.ts)
├── src/
│   ├── audio/                     # DualTrackEngine, AudioDriver, voice pack importer
│   ├── billing/                   # Decoupled EntitlementService & MockBillingAdapter
│   ├── data/                      # SQLite schema, migrations, and repositories
│   ├── design/                    # Design tokens (colors, typography, haptics)
│   ├── domain/                    # Pure domain models (streak engine, session machine, calm delta)
│   ├── features/                  # UI components (sanctuary, player, journey, paywall, dev)
│   ├── providers/                 # React context providers
│   └── stores/                    # Ephemeral Zustand stores
├── tools/                         # Offline audio generation & verification scripts
├── Voices/                        # Master uncompressed voice recordings (Main.wav)
├── app.config.ts                  # Expo CNG configuration
├── metro.config.js                # Metro bundler config (supports ogg, opus, flac)
├── tsconfig.json                  # TypeScript strict configuration
└── package.json                   # Verified dependencies
```

---

## 4. Development Prerequisites

- **Node.js:** v20+ (v26 LTS compatible)
- **Package Manager:** npm v10+
- **JDK:** Java 17 Temurin (for Android builds)
- **Android SDK:** API Level 34+ (Build tools 34.0.0+, minSdk 24)
- **FFmpeg & FFprobe:** Installed via Homebrew (`brew install ffmpeg`) for audio tooling

---

## 5. Getting Started

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run start
```

### Run on Android (Local Prebuild)

```bash
npm run android
```

### Generate Native Android Project (CNG / Prebuild)

```bash
npm run prebuild
```

---

## 6. Testing, Linting & Verification

```bash
# Type check TypeScript codebase
npx tsc --noEmit

# Run ESLint
npm run lint

# Check code formatting with Prettier
npm run format

# Run Jest unit tests (with force exit)
npm test

# Run tests across target timezones (Asia/Kolkata and America/New_York)
npm run test:tz
```

---

## 7. Building Production APK

The APK build pipeline runs via GitHub Actions or locally:

```bash
npm run build:apk
```

For release signing, configure the following environment properties in `android/gradle.properties` or CI secrets:

- `EMBER_RELEASE_STORE_FILE`
- `EMBER_RELEASE_STORE_PASSWORD`
- `EMBER_RELEASE_KEY_ALIAS`
- `EMBER_RELEASE_KEY_PASSWORD`
