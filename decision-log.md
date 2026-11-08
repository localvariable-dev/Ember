# Architectural Decision Log: Ember (NSDR & Deep Rest)

This document tracks all significant product, architectural, technical, and engineering decisions made throughout the lifecycle of **Ember: NSDR & Deep Rest**. It documents the context, the rationale, and the specific impact on the application architecture.

> **Maintenance Rule:** This document must be updated after the completion of each implementation phase.

---

## Index of Decisions

- [ADR-001: Project Root Placement (`/Users/sam/Documents/Projects/Nidra`)](#adr-001-project-root-placement)
- [ADR-002: React 19.3.1 & React Native 0.88.1 Peer Dependency Harmonization](#adr-002-react-1931--react-native-0881-peer-dependency-harmonization)
- [ADR-003: Upgrade to `better-sqlite3@13.0.3` for Node 26 ABI Compatibility](#adr-003-upgrade-to-better-sqlite31303-for-node-26-abi-compatibility)
- [ADR-004: Configuration Plugin vs. Autolinking Separation in `app.config.ts`](#adr-004-configuration-plugin-vs-autolinking-separation-in-appconfigts)
- [ADR-005: Expo SDK 58 Config Modernization (Removal of Legacy `splash` and `newArchEnabled`)](#adr-005-expo-sdk-58-config-modernization)
- [ADR-006: Integration of `expo-system-ui` for Native Android Dark Palette](#adr-006-integration-of-expo-system-ui-for-native-android-dark-palette)
- [ADR-007: `Main.wav` Preservation and Offline Delivery Target Specification](#adr-007-mainwav-preservation-and-offline-delivery-target-specification)
- [ADR-008: Decoupled Mock Billing Adapter Architecture](#adr-008-decoupled-mock-billing-adapter-architecture)
- [ADR-009: Strict Offline-First Local Storage via Synchronous SQLite](#adr-009-strict-offline-first-local-storage-via-synchronous-sqlite)
- [ADR-010: SDK 58 Dependency Closure, Peer Direct Linking & Toolchain Alignment](#adr-010-sdk-58-dependency-closure-peer-direct-linking--toolchain-alignment)
- [ADR-011: Pure Domain Segregation, Root SheetHost & Ephemeral State Architecture](#adr-011-pure-domain-segregation-root-sheethost--ephemeral-state-architecture)

---

## Phase 0: Workspace Audit & Project Bootstrap

### ADR-001: Project Root Placement

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** The workspace contained `Docs/` (Master Plan v1.1 Markdown files) and `Voices/` (raw studio masters `Main.wav` and `Whisper-YF.wav`). An active editor workspace was scoped to `Docs/`. We needed to determine whether to scaffold the Expo project in `Docs/`, inside a nested `ember/` folder, or at `/Users/sam/Documents/Projects/Nidra`.
- **Decision:** Scaffold the root application directly at `/Users/sam/Documents/Projects/Nidra`.
- **Rationale:**
  1. Placing application source code, `node_modules`, and package manifests inside a directory called `Docs/` breaks standard software directory conventions and pollutes documentation archives.
  2. Placing the app at `/Users/sam/Documents/Projects/Nidra` allows `Docs/` (specifications) and `Voices/` (uncompressed voice assets) to sit as clean siblings to `app/`, `src/`, `assets/`, and `plugins/`.
- **Architectural Impact:**
  - Establishes a clean, single-repository monostructure where tools, assets, documentation, and mobile source code share a unified Git root.
  - CI workflows and scripts in `.github/workflows/build-apk.yml` run directly from repo root without path gymnastics (`cd ember && ...`).

---

### ADR-002: React 19.3.1 & React Native 0.88.1 Peer Dependency Harmonization

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** `ember_master_plan_part_6.md` originally specified `"react": "19.0.0"` alongside `"react-native": "0.88.1"`. During `npm install`, npm halted with `ERESOLVE` because `react-native@0.88.1` declares a strict peer dependency on `react@^19.3.0`, and `@expo/router-server` subdependencies declared peers on `react@^19.3.1`.
- **Decision:** Align the root `package.json` to `"react": "19.3.1"` and `"@types/react": "~19.3.0"`.
- **Rationale:** React 19.3.1 satisfies the version bounds for both React Native 0.88.1 (`^19.3.0`) and Expo Router's web/bundling dependencies without resorting to `--legacy-peer-deps` or `--force`.
- **Architectural Impact:**
  - Guarantees strict peer-dependency closure across the entire dependency graph.
  - Ensures clean, deterministic `npm ci` execution on GitHub Actions CI.

---

### ADR-003: Upgrade to `better-sqlite3@13.0.3` for Node 26 ABI Compatibility

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** The local host environment runs Node.js `v26.13.0` (with V8 13.x+ where `v8::PropertyCallbackInfo::This()` was removed). `better-sqlite3@11.x` failed to compile its native C++ binding during `npm install` with C++ compilation errors.
- **Decision:** Upgrade `better-sqlite3` from `^11.0.0` to `^13.0.3` for Node-based unit testing.
- **Rationale:** `better-sqlite3@13.0.3` provides modern C++ N-API bindings compatible with Node 22 through Node 26. In testing, it compiled and passed in-memory SQLite transactions on Apple Silicon in under 2 seconds.
- **Architectural Impact:**
  - `better-sqlite3` is strictly a `devDependency` used to run Jest unit tests for repositories, schema migrations, and SQL queries in headless Node environments without booting an Android emulator.
  - The runtime production app on Android uses `expo-sqlite` (`openDatabaseSync`). Upgrading the test driver maintains complete SQL behavioral parity without impacting production runtime APK size or code.

---

### ADR-004: Configuration Plugin vs. Autolinking Separation in `app.config.ts`

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Initial prebuild failed with `PluginError: Cannot find module 'expo/build/Expo.fx'` because `expo-haptics`, `expo-crypto`, and `expo-keep-awake` were included in the `plugins` array of `app.config.ts`.
- **Decision:** Remove `expo-haptics`, `expo-crypto`, and `expo-keep-awake` from the `plugins` array in `app.config.ts`. Retain only packages that expose valid `app.plugin.js` hooks (`expo-router`, `expo-sqlite`, `expo-audio`, `expo-notifications`, `expo-splash-screen`, and `./plugins/withReleaseSigning`).
- **Rationale:** In Expo CNG, native modules that do not modify `AndroidManifest.xml` or `Info.plist` are autolinked automatically via `expo-modules-autolinking`. Declaring them as config plugins forces the plugin resolver to attempt loading their runtime JS bundles as Node config scripts, resulting in module resolution crashes.
- **Architectural Impact:**
  - Native build generation (`npx expo prebuild --platform android --clean --no-install`) runs cleanly and deterministically.
  - Eliminates fragile workarounds and adheres to standard Expo CNG architecture.

---

### ADR-005: Expo SDK 58 Config Modernization

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** TypeScript strict checking on `app.config.ts` flagged two errors:
  1. `splash` does not exist on `ExpoConfig`.
  2. `newArchEnabled` does not exist on `ExpoConfig`.
- **Decision:**
  1. Remove legacy top-level `splash` object in favor of the official `expo-splash-screen` plugin block in `plugins`.
  2. Remove deprecated `newArchEnabled: true` property.
- **Rationale:** In Expo SDK 58, the New Architecture (Fabric) is enabled by default for all projects; the opt-in flag has been sunset. Splash screens are now exclusively configured through the `expo-splash-screen` config plugin to prevent conflicting manifest definitions.
- **Architectural Impact:**
  - TypeScript strict compilation (`npx tsc --noEmit`) passes with zero errors.
  - Native splash configuration in `android/app/src/main/res/values/strings.xml` and `styles.xml` is generated by the dedicated plugin.

---

### ADR-006: Integration of `expo-system-ui` for Native Android Dark Palette

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Expo prebuild output warned that `userInterfaceStyle: 'dark'` requires `expo-system-ui` to apply system-level UI theming on Android.
- **Decision:** Add `expo-system-ui` (`~58.0.6`) to `dependencies`.
- **Rationale:** Ember is designed as an OLED black, night-friendly application (`#000000` background). Without `expo-system-ui`, the native Android window background and status/navigation bars can flash white during activity cold start before React Native renders.
- **Architectural Impact:**
  - Guarantees zero screen glare and an immersive dark window background from the initial native process launch (`android:theme="@style/AppTheme"`).

---

### ADR-007: `Main.wav` Preservation and Offline Delivery Target Specification

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** `Main.wav` is an existing 5-minute NSDR studio recording (299.75 s) located in `Voices/Main.wav`. Technical inspection showed: uncompressed 16-bit PCM mono at 24,000 Hz, 14.38 MB, integrated loudness -20.66 LUFS, true peak -1.99 dBTP.
- **Decision:** Preserve `Voices/Main.wav` untouched as the master asset. For runtime delivery, encode to Opus in Ogg (`.opus`/`.ogg`) at 32–48 kbps VBR mono, resampled to 48 kHz, and normalized to -18.0 LUFS (±1.0 LUFS) with true peak $\le -1.0\text{ dBTP}$.
- **Rationale:**
  1. Bundling 14.38 MB for a single 5-minute track violates Ember's total asset budget of $\le 42\text{ MB}$ for all protocols and ambient beds combined.
  2. Opus at 32–48 kbps reduces the file size to ~1.2 MB (~92% reduction) with zero perceptible loss in spoken voice quality.
  3. Resampling to 48 kHz aligns with standard Android audio hardware mixing rates, preventing runtime resampling latency in the audio engine.
- **Architectural Impact:**
  - The runtime audio driver (`expo-audio`) streams compressed `.ogg`/`.opus` files locally from disk.
  - The `tools/audio/build-audio.mjs` script will ingest `Voices/Main.wav` to generate production-ready delivery tracks.

---

### ADR-008: Decoupled Mock Billing Adapter Architecture

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Payment gateways (Google Play Billing, RevenueCat, Razorpay) are planned for a subsequent milestone. However, the Pro paywall, lock/unlock mechanics, and entitlement flags must function end-to-end immediately for testing.
- **Decision:** Implement a decoupled `BillingService` and `EntitlementService` interface with a `MockBillingAdapter` backed by a persistent SQLite entitlement table.
- **Rationale:**
  1. Prevents payment provider vendor lock-in.
  2. Enables end-to-end testing of paywall sheets, Pro tier badges, access guards, and restore flows in developer/test mode without live merchant accounts or network connectivity.
- **Architectural Impact:**
  - Feature code (Sanctuary screen, Player screen, Journey sheet) depends solely on `EntitlementService.hasAccess(featureId)`.
  - Switching to real Google Play Billing later requires only swapping the adapter injection (`EXPO_PUBLIC_BILLING_MODE=google_play`) without touching UI or audio code.

---

### ADR-009: Strict Offline-First Local Storage via Synchronous SQLite

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Ember guarantees absolute privacy: no accounts, no cloud sync, no analytics SDKs, and no ads. Session history, streaks, preferences, and entitlements must persist locally.
- **Decision:** Use `expo-sqlite` with synchronous operations (`openDatabaseSync`, `execSync`, `runSync`, `getAllSync`) in WAL mode.
- **Rationale:**
  1. Synchronous reads eliminate UI flicker, loading spinners, and layout shift when reading streak state or user preferences at launch.
  2. WAL (Write-Ahead Logging) mode enables concurrent reads while writing session logs or heartbeats.
  3. SQLite `PRAGMA user_version` allows atomic, transactional schema migrations.
- **Architectural Impact:**
  - Ephemeral UI state lives in Zustand (`useSheetStore`, `useSessionStore`).
  - All durable business data lives in SQLite (`ember.db`), accessed through clean repository classes (`SessionRepo`, `StreakRepo`, `EntitlementRepo`, `PrefsRepo`).

---

### ADR-010: SDK 58 Dependency Closure, Peer Direct Linking & Toolchain Alignment

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** `npx expo-doctor` and `npx expo install --check` flagged missing direct peer dependencies (`expo-asset` required by `expo-audio`, `expo-constants` and `expo-linking` required by `expo-router`), version mismatches on dev tools (`typescript`, `jest`, `@types/jest`), and a patch divergence on `react` (19.3.1 vs 19.3.0). Furthermore, the actual Android SDK configuration needed verification against Expo SDK 58 defaults.
- **Decision:**
  1. Add `expo-asset`, `expo-constants`, and `expo-linking` as direct root dependencies so they are linked into standalone native Android builds.
  2. Pin `react-native-svg` to `15.16.0` to match the exact Expo SDK 58 specification.
  3. Upgrade `typescript` to `~6.0.3`, `jest` to `~30.5.2`, and `@types/jest` to `^30.0.0` (with `"types": ["jest"]` in `tsconfig.json`) to satisfy Expo SDK 58 tooling requirements.
  4. Explicitly declare `"expo": { "install": { "exclude": ["react"] } }` in `package.json` to safely permit React 19.3.1 (required by `react-dom@19.3.1` in Expo Router).
  5. Verify Android build configuration: Expo SDK 58 `ExpoRootProjectPlugin` sets `compileSdkVersion=37`, `targetSdkVersion=36`, `minSdkVersion=24`, `buildToolsVersion=37.0.0`, `AGP=9.2.1`, `Gradle=9.4.1`, `Kotlin=2.2.10`, and `jvmToolchain(17)`.
- **Rationale:**
  1. Standalone Android builds crash at runtime outside Expo Go if transitive native peers are not declared as root dependencies.
  2. Aligning to Expo SDK 58's expected dev toolchain ensures 100% compliance across all 20 automated checks in `expo-doctor` (`20/20 checks passed`).
- **Architectural Impact:**
  - `npx expo-doctor` passes all 20 checks with zero failures.
  - `npx expo install --check` reports `Dependencies are up to date`.
  - Android prebuild generates `com.emberrest.app` targeting Android 15 (API 36) with compile SDK 37 and minSdk 24 (Android 7.0+).

---

## Phase 1: Foundation, Design System & Pure Domain Logic

### ADR-011: Pure Domain Segregation, Root SheetHost & Ephemeral State Architecture

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Ember's core habit psychology, streak mathematics, session progression, in-flight narrator switching, and Calm Delta insights must be deterministic, mathematically rigorous, and testable without UI frameworks or physical devices. Furthermore, modal sheets (Journey, Paywall, Voice Picker) must open smoothly above both routes (`/` Sanctuary and `/player` Player).
- **Decision:**
  1. **Strict Pure Domain Isolation:** Segregated all business logic (`src/domain/`) with zero imports of React, React Native, Expo, or SQLite.
  2. **Pure Reducer Session Machine:** Modeled the session lifecycle in `src/domain/sessionMachine.ts` as a deterministic reducer (`reduceSession(state, event) => { state, effects[] }`). The reducer calculates commit thresholds (90% Focus, 85% Sleep), Free Pass 20% consumption, cubic ambient Sleep fade, and in-flight voice switching without side effects.
  3. **Root SheetHost Pattern:** Created `src/providers/SheetHost.tsx` mounted at root level inside `app/_layout.tsx` above Expo Router's `<Stack>`, controlled by ephemeral `useSheetStore`.
  4. **Strict Ephemeral State in Zustand:** Zustand is restricted strictly to ephemeral UI state (`useSheetStore` for sheet visibility and `useSessionStore` for active playback timers). All persistent data (sessions, ledger, streaks, preferences, entitlements) will be managed via SQLite repositories.
  5. **Centralized Design System:** Implemented `src/design/tokens.ts` (OLED black `#000000`, Candlelight Amber `#F59E0B`, Soft Gold `#FBBF24`, Fraunces Light 300, Inter typography, 48 dp min touch targets) and preference-guarded haptics in `src/design/haptics.ts`.
- **Rationale:**
  - Pure domain functions can be thoroughly tested across edge cases (leap years, DST transitions, clock rollbacks, quiet-hour clamping) in milliseconds on Node without mocking React components or SQLite databases.
  - Root-level sheet hosting prevents navigation nesting bugs and ensures paywalls and voice pickers can overlay active sessions without unmounting the underlying player view.
- **Architectural Impact:**
  - 100% of domain rules verified with 53 unit tests passing in both `Asia/Kolkata` (IST) and `America/New_York` (EST).
  - Clean separation of concerns: UI views read Zustand stores, domain logic executes pure reducers, and database repositories handle persistence.
