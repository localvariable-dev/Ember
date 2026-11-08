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
- [ADR-012: Phase 1 Domain Gap Closure, WCAG Automated Contrast & Jest Optimization](#adr-012-phase-1-domain-gap-closure-wcag-automated-contrast--jest-optimization)
- [ADR-013: SQLite Persistence Architecture, Repositories & Idempotent Session Transactions](#adr-013-sqlite-persistence-architecture-repositories--idempotent-session-transactions)
- [ADR-014: Schema Reconciliation, Catalogue Alignment & Free Pass Entitlement Integrity](#adr-014-schema-reconciliation-catalogue-alignment--free-pass-entitlement-integrity)
- [ADR-015: Sanctuary Experience, Responsive Layout, and Root SheetHost Integration](#adr-015-sanctuary-experience-responsive-layout-and-root-sheethost-integration)
- [ADR-016: Audio Asset Pipeline, Main.wav Mastering, Offline Asset Management & Asset Registry](#adr-016-audio-asset-pipeline-mainwav-mastering-offline-asset-management--asset-registry)

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

---

### ADR-012: Phase 1 Domain Gap Closure, WCAG Automated Contrast & Jest Optimization

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** During the Phase 1 acceptance audit (Prompt 1.1), four domain and verification gaps were identified:
  1. `src/domain/dayKey.ts` lacked explicit unit tests verifying that sessions spanning midnight (e.g. 23:50 to 00:15) attribute streak credit strictly to the session START date.
  2. `src/domain/sessionMachine.ts` required explicit `DONE_SILENT` (for Sleep mode natural exit), `ABORTED` (for uncommitted exit before reaching `DONE`), a non-blocking `PRE_CHECKIN_SELECT` event for check-ins within the first 20 seconds of playback, and a pure `reconcileSleepSession` helper for app startup recovery.
  3. `src/domain/calmDelta.ts` was missing Pro insight domain aggregators: `computeMeanDeltaBySlice` (by protocol, voice, or mode) and `computeWeeklyMeanDelta` (8 consecutive ISO weeks starting on Monday).
  4. WCAG 2.1 token contrast ratios required automated mathematical unit tests in CI.
  5. Jest execution without Watchman suffered from slow recursive filesystem searches traversing the entire `node_modules` and `android` directories.
- **Decision:**
  1. Add explicit test vectors in `__tests__/domain/dayKey.test.ts` for midnight crossover session attribution and DST calendar boundaries.
  2. Expand `SessionStage` to include `'DONE_SILENT'` and `'ABORTED'`, implement `PRE_CHECKIN_SELECT` with a 20-second active window (`PRE_CHECKIN_WINDOW_MS = 20_000`) without pausing or interrupting audio, and implement `reconcileSleepSession` adhering to Part 2 §3.4.
  3. Implement `computeMeanDeltaBySlice` and `computeWeeklyMeanDelta` in `src/domain/calmDelta.ts`, covered by comprehensive unit tests.
  4. Implement `__tests__/design/contrast.test.ts` computing WCAG 2.1 relative luminance and contrast ratios, proving all token pairs exceed specifications (`text`/`bg` >= 15:1 [actual ~19.1:1], `textMuted`/`bg` >= 6:1 [actual ~6.48:1], `textMuted`/`surface` >= 5.5:1 [actual ~6.07:1], `onAccent`/`accent` >= 9:1 [actual ~9.8:1]).
  5. Configure `roots: ['<rootDir>/src', '<rootDir>/__tests__']` in `jest.config.js` to bound Jest's haste map search to source and test files, dropping test execution time from minutes to under 1 second.
  6. Document that local host `assembleDebug`/`assembleRelease` is explicitly **BLOCKED** due to absence of local Android SDK (`ANDROID_HOME`), with compilation offloaded to GitHub Actions CI (`.github/workflows/build-apk.yml`).
- **Rationale:**
  - Guarantees complete domain specification fidelity against Master Plan v1.1 Parts 1, 2, and 6 before beginning Phase 2 (SQLite database and repositories).
  - Keeps all domain and analytics logic 100% pure, deterministic, and instant to test.
- **Architectural Impact:**
  - Test suite expanded from 7 suites / 53 tests to 8 suites / 69 tests, all passing across both `Asia/Kolkata` (IST) and `America/New_York` (EST) in under 0.5s.
  - Zero TypeScript errors (`npx tsc --noEmit`), zero ESLint warnings (`eslint --max-warnings 0`), 100% Prettier formatting compliance.

---

## Phase 2: Offline SQLite Persistence Architecture & Repositories

### ADR-013: SQLite Persistence Architecture, Repositories & Idempotent Session Transactions

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Ember is strictly offline-first with no user accounts, no cloud sync, and no remote analytics. SQLite (`ember.db`) is the sole durable source of truth for all application data: session logs, practice ledgers, streak continuity, Rest Grace allocations, subscription and Free Pass entitlements, and user preferences. We required an enterprise-grade SQLite persistence layer adhering to Master Plan Part 4 §5, supporting both Android runtime execution (`expo-sqlite` synchronous operations) and headless CI unit testing (`better-sqlite3`).
- **Decision:**
  1. **Synchronous `Db` Interface Abstraction:** Created `src/data/db.ts` defining a synchronous database interface (`exec`, `run`, `all`, `first`, `tx`, `close`). Implemented `ExpoSqliteDb` wrapping `expo-sqlite` (`openDatabaseSync`, `withTransactionSync`, `execSync`, `runSync`, `getAllSync`, `getFirstSync`) and `BetterSqliteDb` wrapping `better-sqlite3`. Both enforce `journal_mode = WAL` and `foreign_keys = ON`.
  2. **Ordered Migration Framework (`PRAGMA user_version`):** Created `src/data/migrations.ts` executing linear schema migrations. Migration 1 constructs the complete 9-table relational schema:
     - `audio_protocols`, `voices`, `protocol_voice_tracks`, `ambient_beds`, `session_logs`, `day_ledger`, `streak_state`, `user_entitlements`, `user_preferences`.
     - Seeded initial catalog rows: protocols (`rapid_reset_5`, `afternoon_recharge_10`, `deep_rest_30`), voices (`maya_warm`, `arjun_deep`), ambient beds (`rain`, `brown_noise`, `theta_6hz`, `ocean_drift`, `night_forest`, `delta_2hz`), and bundled voice tracks. Catalogs are seeded prior to `user_preferences` to satisfy foreign-key constraints on `selected_voice_id`.
  3. **Domain-Driven Repositories:** Implemented clean repository layers in `src/data/repos/`:
     - `SessionRepo`: Complete session lifecycle (`createSession`, `updateProgress`, `recordCheckin`, `finalizeSession`, `commitSession`, `getById`, `getRecent`).
     - `StreakRepo`: Singleton streak state persistence (`get`, `save`).
     - `LedgerRepo`: Practice history and Rest Grace ledger queries (`recordPractice`, `isCoveredByGrace`, `getWeekSummary`, `getRecentPracticeDays`).
     - `EntitlementRepo`: Subscription, Lifetime, and Free Pass entitlement management (`getEffective`, `grantFreePass`, `consumeFreePass`, `setEntitlement`, `hasFreePassAvailable`).
     - `PrefsRepo`: User preferences management (`get`, `update`).
     - `ProtocolRepo`: Catalog protocol retrieval (`getAll`, `getById`, `seedProtocols`).
     - `VoiceRepo`: Catalog voice retrieval and track mapping (`getAll`, `getById`, `importVoicePack`, `getTrack`).
  4. **Single-Transaction Atomic Session Completion:** Implemented `SessionRepo.commitSession` executing within an atomic `db.tx(...)` transaction. The transaction:
     - Enforces row-level atomic guard (`UPDATE session_logs ... WHERE id=? AND committed_at_ms IS NULL`), returning immediately if already committed (guaranteeing absolute idempotency against duplicate streak credits or duplicate free pass grants).
     - Integrates pure domain algorithm `applyCredit` to compute streak continuity and Rest Grace bank progression.
     - Upserts daily practice minutes into `day_ledger`.
     - Evaluates 3-day consecutive short session qualification and automatically grants a Free Pass entitlement when eligible.
  5. **Persistence & Restart Unit Testing:** Built 4 dedicated test suites in `__tests__/data/`:
     - `db_migrations.test.ts`: Fresh DB creation, migration ordering, catalog seeding, foreign key cascades/enforcement, idempotency, and rollback.
     - `repositories.test.ts`: Comprehensive CRUD operations across all 7 repositories.
     - `session_transactions.test.ts`: Atomic completion, Rest Grace coverage, Free Pass grants, idempotency, finalize protection, and disk I/O rollback.
     - `persistence_restart.test.ts`: Disk-backed DB tests simulating application close and reopen across processes, verifying complete data survival, timezone preservation, and midnight boundary integrity.
- **Rationale:**
  - Wrapping SQLite operations in synchronous transactions eliminates asynchronous race conditions, UI flicker, and partial write corruption during Android activity suspension.
  - Row-level atomic guards (`committed_at_ms IS NULL`) ensure that duplicate commit events (e.g., player close + background heartbeat) cannot corrupt streak counts or grant redundant free passes.
- **Architectural Impact:**
  - Complete data layer ready for Phase 3 (audio playback engine) and Phase 4 (sanctuary and player UI).
  - Test suite grew to 12 test suites and 96 unit tests, running in < 0.6 seconds in CI.
  - Zero TypeScript errors (`npx tsc --noEmit`), zero ESLint warnings (`eslint --max-warnings 0`), 100% Prettier formatting compliance.

---

### ADR-014: Schema Reconciliation, Catalogue Alignment & Free Pass Entitlement Integrity

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Following the Phase 2 implementation audit (Prompt 2.1), discrepancies were audited against Master Plan v1.1 Parts 1, 2, 3, and 4:
  1. The catalogue report previously mentioned obsolete/unsupported protocol IDs (`deep_rest_10`, `midday_reboot_20`, `rest_unwind_sleep_30`) and invented ambient names (`rain_gentle`, `pink_noise`, `binaural_rest`, `none`). The canonical protocols are strictly `rapid_reset_5`, `afternoon_recharge_10`, and `deep_rest_30`. The canonical ambient beds are `rain` (free), `brown_noise` (free), `theta_6hz` (free, binaural), `ocean_drift` (pro), `night_forest` (pro), and `delta_2hz` (pro, binaural).
  2. In `ambient_beds` seed data, `theta_6hz` was mistakenly marked as `tier: 'pro'`. Per Part 1 §1 and Part 3 §4.1, 6 Hz Theta Waves is in the Free tier (with a one-time headphone recommendation hint).
  3. Free Pass validity was misstated in the previous session summary as 24 hours. The actual product rule (Part 2 §3.5) specifies: 14 days validity, maximum of 1 grant per lifetime (`FREE_PASS_MAX_LIFETIME = 1`), consumption at 20% of the 30-minute session (6:00), and zero redundant grants for active Pro users.
  4. Migration framework needed forward migration (`002_reconcile_catalogues_and_entitlement_integrity`) advancing `PRAGMA user_version` to 2 to safely update existing local databases without data loss or remapping.
- **Decision:**
  1. **Canonical Catalogues & Type Safety:** Reconciled `src/domain/constants.ts` and `src/data/types.ts` with canonical `AMBIENT_BED_IDS` and `PROTOCOL_IDS`. Typed `AudioProtocol.minutes` as `5 | 10 | 30`, `AmbientBed.id` as `AmbientBedId`, and `UserPreferences.ambientBedId` as `AmbientBedId | null`.
  2. **Migration 2 Deployment:** Added Migration 2 reconciling `ambient_beds` (`UPDATE ambient_beds SET tier = 'free' WHERE id = 'theta_6hz'`), inserting missing canonical catalogue rows, and cleaning up unreferenced non-canonical protocols while strictly preserving any historical session logs.
  3. **Free Pass Business Rules Enforcement:**
     - Enforced 14-day validity (`FREE_PASS_VALID_DAYS = 14`, `expiresAtMs = nowMs + 14 * 86_400_000`).
     - Enforced lifetime limit (`lifetimePassCount < FREE_PASS_MAX_LIFETIME`) within the atomic commit transaction.
     - Enforced Pro user exclusion (`!isPro`).
     - Enforced 20% consumption threshold: if `session.accessVia === 'free_pass'`, crossing `plannedMs * 0.2` (360,000 ms) in `heartbeat`, `finalize`, or `commitSession` triggers `consumePassForSession`. Quitting before 20% preserves the pass as `'available'`.
     - Automated background expiration via `expireStalePasses(nowMs)`.
  4. **Dedicated Verification Suite:** Implemented `__tests__/data/free_pass_rules.test.ts` testing all 6 mandatory guarantees, and verified forward migration upgrade in `__tests__/data/db_migrations.test.ts`.
- **Rationale:**
  - Guarantees 100% adherence to Ember Master Plan v1.1.
  - Preserves user history, offline guarantees, and transactional integrity.
- **Architectural Impact:**
  - Test suite grew from 12 test suites / 96 tests to 13 test suites / 103 tests, all passing across IST and EST in < 0.7s.
  - Zero TypeScript errors (`npx tsc --noEmit`), zero ESLint warnings (`eslint --max-warnings 0`), 100% Prettier formatting compliance.

---

## Phase 3: Sanctuary Experience & Navigation

### ADR-015: Sanctuary Experience, Responsive Layout, and Root SheetHost Integration

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Following the persistence architecture and schema reconciliation in Phase 2, Phase 3 requires the complete implementation of the **Sanctuary Experience** and root navigation sheets specified in Ember Master Plan Part 1 §2.3–§2.7:
  1. The core screen must deliver a friction-free, 2-tap entry into rest.
  2. Complete component hierarchy required: `TopBar`, `StreakPill`, `GreetingBlock`, `SessionCardList`, `SessionCard`, `ModeToggle`, `AmbientChips`, `VoiceAndPacerRow`, and sticky 72 dp `BeginRestButton`.
  3. Strictly the 3 canonical protocols (`rapid_reset_5`, `afternoon_recharge_10`, `deep_rest_30`) with Free, Pro (`🔒 PRO`), Free Pass (`Free pass · Nd left`), and Selected states.
  4. Root-hosted modal sheets: `JourneySheet` (92% height), `PaywallSheet` (84% height), `VoicePickerSheet`, and `AmbientPickerSheet` hosted via `SheetHost.tsx` with a guarantee that strictly only one sheet is open at any time.
  5. SQLite-backed user preferences (`selectedVoiceId`, `ambientBedId`, `lastMode`, `sighPacerDefault`, `firstRunCueShown`, `thetaHintShown`) synchronized with React context (`DatabaseProvider`).
  6. Ergonomic and responsive design supporting compact Android viewports (360×640 dp) without overlapping sticky controls or truncating touch targets.
- **Decision:**
  1. **Component Architecture & Hierarchy:**
     - `StreakPill`: 32 dp pill showing dynamic ember ring dot based on `projectStreak` (`done_today` = soft gold, `open` = amber, `held_by_grace` = amber ring, `lapsed` = dim text) and opening `JourneySheet`.
     - `GreetingBlock`: Renders circadian headline (`Fraunces 34/40`) and context line per selected card.
     - `SessionCardList`: Renders the 3 canonical cards with 12 dp gap, 88 dp minimum height, 1.5 dp amber border, `surfaceRaised` fill, and halo glow (`#F59E0B` opacity 0.22) when selected.
     - `ModeToggle`: Two-segment pill (`☼ Focus` · `☾ Sleep`) with haptic toggle feedback; displayed for 10-min and 30-min protocols.
     - `AmbientChips`: Single-select chips (`[Off] [Rain] [Brown] [6Hz θ] [+]`) with dynamic selected premium bed injection, and a 3-second auto-fading "Best with headphones" cue on first selection of 6 Hz Theta.
     - `VoiceAndPacerRow`: 48 dp row housing `VoiceChip` (opens `VoicePickerSheet`), separator `·`, and `Sigh Pacer` switch (with caption "Includes two sighs" for 5m card).
     - `BeginRestButton`: 72 dp tall sticky bottom CTA with lock glyph for locked states (`"🔒 Unlock Deep Rest"` vs `"Begin Rest"`), and a 6-second first-run whisper cue ("Tap Begin Rest.").
  2. **Root Sheet Architecture (`SheetHost`):**
     - Mounted at the root of `app/_layout.tsx` above all navigation stacks.
     - Exclusivity guaranteed by Zustand `useSheetStore` where `activeSheet` is a single discriminated union (`'none' | 'journey' | 'paywall' | 'voice_picker' | 'ambient_picker' | 'dev'`).
     - Backed by scrim backdrop dismiss, system back-button (`onRequestClose`), and clean entry/exit haptics.
  3. **Reactive SQLite Context (`DatabaseProvider`):**
     - Wraps the entire application, instantiating singletons for all 7 repositories.
     - Exposes synchronous SQLite preference mutation (`updatePreferences`) that updates both database and React state, eliminating state drift.
  4. **Responsive Layout & Safe Insets:**
     - Accommodates compact Android screens by using `SafeAreaView` with top/left/right insets, absolute sticky CTA positioned over navigation bar inset (`Math.max(insets.bottom, 16)`), and ScrollView `contentContainerStyle` with 130 dp bottom padding to eliminate content occlusion behind the sticky button.
  5. **Player Route Integration:**
     - Fullscreen player route (`/player`) wired to `useSessionStore` and `useDatabase`, presenting friendly narrator names, protocol duration, breathing ring cue, and session exit confirmation dialog.
- **Rationale:**
  - Satisfies every design token, typography spec, haptic requirement, and interaction rule from Master Plan Part 1.
  - Retains pure offline performance with zero network calls and sub-millisecond local SQLite queries.
- **Architectural Impact:**
  - Added full test coverage in `__tests__/features/sanctuary.test.ts`. Total test suite expanded to 14 test suites, 117 tests passing across both IST (`Asia/Kolkata`) and EST (`America/New_York`).
  - Zero TypeScript errors (`npx tsc --noEmit`), zero ESLint warnings (`npm run lint`), 100% Prettier formatting compliance.

---

## Phase 4: Audio Asset Pipeline & Offline Asset Management

### ADR-016: Audio Asset Pipeline, Main.wav Mastering, Offline Asset Management & Asset Registry

- **Date:** 2026-11-08
- **Status:** Accepted
- **Context:** Following the implementation of Sanctuary UI and navigation in Phase 3, Phase 4 requires building the audio asset infrastructure and offline asset delivery systems according to Ember Master Plan Part 5:
  1. An existing candidate studio recording for Rapid Reset 5 (`Voices/Main.wav`) exists in the workspace. Its original recording integrity must be 100% preserved and never destructively modified.
  2. The candidate recording must be verified against technical broadcast standards (duration ~300s, -18.0 LUFS integrated loudness, $\le -1.5$ dBTP true peak, LRA $\le 7$ LU) and mastered into an Android-optimized Opus asset (`assets/audio/voice/maya_warm/rapid_reset_5.ogg`, Opus 32 kbps mono, 48 kHz, size $\le 1.4$ MB).
  3. Real studio recordings for the 10-minute (`afternoon_recharge_10`) and 30-minute (`deep_rest_30`) sessions do not exist yet. Fabricating fake narration or pretending recordings exist is strictly prohibited. An explicit development placeholder strategy is required, with embedded metadata tags (`comment=EMBER_DEV_PLACEHOLDER_NOT_FOR_RELEASE`) and release verification tooling that strictly rejects placeholder audio.
  4. Ambient soundscapes (Rain, Brown Noise, Ocean Drift, Night Forest in 96 kbps Opus; 6 Hz Theta & 2 Hz Delta in 22.05 kHz stereo lossless FLAC) and a 3.2s rising harmonic chime (`assets/audio/chime_rise.wav`) must be synthesized and packaged within strict individual and total bundle budgets ($\le 42$ MB total).
  5. An asset registry and offline download architecture (`OfflineAudioManager`) must be implemented to manage downloads, exponential backoff retries, `.tmp` staging, atomic renames, SHA-256 validation, and corrupted file auto-pruning.
- **Decision:**
  1. **`Main.wav` Technical Verification & Preservation:**
     - Verified source file at `/Users/sam/Documents/Projects/Nidra/Voices/Main.wav`: PCM 16-bit little-endian mono (`pcm_s16le`), 24,000 Hz, 14,388,120 bytes, 299.75 seconds. Integrated loudness $-20.66$ LUFS, true peak $-1.99$ dBTP, LRA $6.70$ LU ($\le 7$ LU).
     - Fixed SHA-256 hash verified and monitored by automated test: `4a1f411ba472cb0f66687ea6e1f6dbef666370f884bd31677586fa0d6a868991`.
     - Mastered candidate playback asset: `assets/audio/voice/maya_warm/rapid_reset_5.ogg` (300.0s, Opus 32 kbps mono, 48 kHz, $-18.0$ LUFS, true peak $\le -1.5$ dBTP, size: 876,826 bytes $\le 1.4$ MB budget, SHA-256: `5370a4127a1838ef9353ff419cefe60520fc8d7379766bb94f3ba79b977e1806`).
  2. **Missing Narration & Release Guardrails:**
     - Missing 10m and 30m voice tracks generated as lightweight development placeholders using `tools/audio/make-placeholders.mjs`, encoded at 20 kbps Opus with comment metadata `EMBER_DEV_PLACEHOLDER_NOT_FOR_RELEASE`.
     - `tools/audio/verify-assets.mjs` checks all 17 assets. In `--release` mode, it scans file buffers and rejects any placeholder asset with non-zero exit code (verified in tests and CI).
  3. **Ambient Bed & Chime Generation (`tools/audio/`):**
     - Pure Node harmonic chime generator (`make-chime.mjs`) creates 3.2s rising harmonic chime (44.1 kHz 16-bit mono WAV, 282 KB $\le 0.3$ MB budget).
     - Noise and binaural generator (`make-beds.mjs`) creates 4 noise loops (Rain, Brown Noise, Ocean Drift, Night Forest at ~650 KB $\le 0.8$ MB) and 2 phase-exact 24s binaural loops in 22.05 kHz stereo FLAC (Theta 6 Hz, Delta 2 Hz at 608 KB $\le 3.5$ MB).
     - Total bundled audio package measures 40.58 MB, well within the 42 MB threshold.
  4. **Runtime Asset Registry (`src/audio/assetRegistry*.ts`):**
     - Implemented `assetRegistry.ts` defining `VoiceTrackMetadata`, `AmbientBedMetadata`, `ChimeMetadata`, `ProtocolAudioMetadata`, and `verifySha256`.
     - `assetRegistry.generated.ts` registers all canonical protocols, soundscape beds, and voice tracks with duration, byte size, SHA-256 checksums, and cue timeline markers. Maya Rapid Reset 5 is flagged `isPlaceholder: false`; all missing recordings are flagged `isPlaceholder: true`.
  5. **Offline Audio Manager (`src/audio/OfflineAudioManager.ts`):**
     - Manages progressive voice pack downloads with configurable exponential backoff retry (up to 3 retries, base delay 1000 ms, factor 2).
     - Staging pattern: downloads to `.tmp` files, verifies SHA-256 checksum against registry, and executes atomic file rename on match. Corrupted downloads are purged immediately.
     - Supports both React Native Expo filesystem (`expo-file-system`) and headless testing mock drivers (`FileSystemDriver`).
- **Rationale:**
  - Guarantees zero data loss, bit-for-bit master file preservation, and adherence to Android offline-first standards.
  - Prevents shipping mock/placeholder assets to production through fail-fast build verification.
- **Architectural Impact:**
  - Expanded test suite to 18 test suites and 145 tests passing in < 1.4s across all timezones.
  - Zero TypeScript errors (`npx tsc --noEmit`), zero ESLint warnings (`eslint --max-warnings 0`), 100% Prettier formatting compliance.
