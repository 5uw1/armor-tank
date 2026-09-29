# Armor Tank: notes for Claude

2.5D top-down tank battle game in Three.js + Vite + TypeScript. It ships as a web/PWA build,
Android and iOS apps (Capacitor) and Windows/macOS/Linux apps (Electron). [README.md](README.md)
covers features, platforms, the release process and store setup, so read it first.
[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) is the original spec.

## Working with the owner

- The owner writes in **Thai**. Reply in Thai, and keep code identifiers and comments in English.
- **Git commit messages are English only.** End them with the Co-Authored-By trailer.
- Commit and push to `main` when a task is done; the owner expects the change on GitHub. Ask
  before pushing a `v*` tag, because that publishes a public GitHub Release.
- App ID everywhere is `com.suw1labs.armortank` (Android package, iOS bundle, Capacitor,
  Electron). Developer name `suw1labs`. The sibling project [ProTrack](https://github.com/5uw1/ProTrack)
  is the reference for CI, store and Xcode Cloud conventions.

## Commands

```bash
npm run dev            # Vite dev server (exposes window.__game for debugging)
npm run build          # tsc --noEmit + production build to dist/
npm run app:android    # debug APK (needs Android Studio's JDK as JAVA_HOME and ANDROID_HOME)
npm run app:ios        # vite build + cap sync ios, then open ios/App/App.xcodeproj
npm run app:win        # Electron installer + portable EXE (Windows)
npm run store:capture  # regenerate store/ screenshots + feature graphic (Electron, off-screen)
```

There are no unit tests. `npm run build` (the type-check) is the gate, and CI runs it too.

## Code map

- `src/main.ts`: bootstrap, menu actions, `startLevel`, and `window.__game` in dev builds only.
- `src/game/game.ts`: the whole simulation, including AI, weapons, pick-ups, bosses, objectives,
  the HUD state (`hud()`) and the mission checklist (`missions()`).
- `src/game/data.ts`: enemies, ammo, pick-ups and all 25 `LEVELS` (chapter generators must stay
  above `LEVELS`, or you get a TDZ error).
- `src/game/story.ts`: the story (speakers, chapters, per-level intro/outro). `CHAPTERS` keys are Thai
  internal ids; don't translate them.
- `src/game/progression.ts`: upgrades, armour kits, passive skills, EXP.
- `src/assets/`: procedural models (`vehicles.ts`), the city generator (`city.ts`), materials and
  textures (`kit.ts`, `textures.ts`, `photo.ts`).
- `src/ui/`: HUD, menus and the garage viewer. `src/save/storage.ts`: save slots in IndexedDB.

## Conventions and gotchas

- **i18n:** every user-visible string is `tr('ไทย', 'English')` from `src/i18n.ts`. The language is
  fixed per session, and switching reloads the page. Add both languages for any new text.
- **Save data:** the owner plays in slot 1. Browser tests must use **slot 3** and delete it afterwards.
  Get the app's own `store` instance: after HMR, Vite serves `storage.ts?t=…`, and a plain
  `import('/src/save/storage.ts')` gives a separate, uninitialised copy. Take the URL from
  `performance.getEntriesByType('resource')`.
- **Performance:** discard objects with `Game.discard()` (frees geometry) rather than `scene.remove`.
  Many identical props should be instanced (see `Pole`). Coplanar faces flicker (z-fighting):
  `extrudeSide` bevels grow the shape by the bevel size.
- **Touch controls:** the right stick aims and fires; a tap fires at the nearest enemy; when the
  thumb is lifted, the turret keeps its heading.
- `package.json` must stay UTF-8 **without BOM** (electron-builder breaks on a BOM).
- Line endings: `.gitattributes` keeps `gradlew` and `*.sh` as LF, and they must stay executable
  (`git update-index --chmod=+x`).

## Platforms and CI

- **GitHub Actions** (`.github/workflows/build.yml`): every push to `main` builds all platforms.
  A `v*` tag publishes a GitHub Release. Android is signed with the `ANDROID_KEYSTORE_*` secrets,
  or falls back to the debug key, which Play rejects. **Check the AAB signature before the first Play
  upload** with `keytool -printcert -jarfile <aab>`: it must not say `CN=Android Debug`.
  `PLAY_SERVICE_ACCOUNT_JSON` enables automatic upload to the internal track.
- **GitHub Pages** (`.github/workflows/pages.yml`): serves the web game and the privacy policy at
  https://5uw1.github.io/armor-tank/privacy.html.
- **iOS** uses Xcode Cloud (same as ProTrack). `ios/App/ci_scripts/ci_post_clone.sh` builds the web
  app and runs `cap sync ios`; `ci_pre_xcodebuild.sh` stamps the version from the tag.
- **Android locally:** Gradle 9.1 (needed for Android Studio's bundled JDK 25). Versions come from
  `-PappVersion` / `-PappVersionCode`. Signing is read from the CI env vars, or from
  `android/keystore.properties` (gitignored), or else the debug key is used.
- **Google Play:** new personal accounts need a closed test with 12 testers for 14 days before production.
- **Store assets:** [`store/README.md`](store/README.md) and [`docs/STORE_LISTING.md`](docs/STORE_LISTING.md).
