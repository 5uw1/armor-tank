# Release checklist

Copy this list into the release issue (or tick it here) and go through it before every `v*` tag.
The tag publishes a public GitHub Release and feeds Google Play and Xcode Cloud, so anything missed
here ships to players.

## 1. Code

- [ ] `npm run build` passes. It is the gate (`tsc --noEmit` + the production build); there are no
      unit tests, and CI runs the same command.
- [ ] Native builds still work if anything platform-specific changed: `npm run app:android`,
      `npm run app:win`, and `npm run app:ios` on a Mac.
- [ ] Working tree clean, everything committed and pushed to `main`, and the latest `main` run of
      `.github/workflows/build.yml` is green.
- [ ] No debug-only code ships: `window.__game` exists in dev builds only, and no test cheats
      (invulnerability, unlocked levels, free credits) are left switched on.

## 2. Data: the part that cannot be fixed afterwards

- [ ] Saves from the **previously released** version load in the new build, not just saves from
      the last commit. If the profile shape changed, bump `SAVE_VERSION` in
      `src/save/storage.ts` and extend `migrate()`; a v1 save must still come through as well.
- [ ] A checkpoint saved mid-level by the released version still resumes ("Continue"), including the
      map's destruction state.
- [ ] Save slots → **Export** in the released version, then **Import** that file into the new build.
- [ ] Browser tests use **slot 3** only, through the app's own `store` instance (see CLAUDE.md), and
      slot 3 is deleted afterwards. Slot 1 is the owner's real save.
- [ ] Nothing personal or test-only ships as a default (`newProfile()`, `defaultSettings()`).

## 3. Languages

- [ ] Every new user-visible string is a `tr('ไทย', 'English')` pair, with both sides filled in and
      reading naturally (not machine-passed through the other language).
- [ ] Story text in `src/game/story.ts` exists in both languages for every new level or chapter.
- [ ] Look at Thai on a **phone** (tallest glyphs) and English (usually longest): nothing clipped in
      the HUD, buttons, briefings or the garage.
- [ ] Switching the language in Settings reloads the page and the whole UI follows.

## 4. Screens

Run on a **physical** Android phone and iPhone (and an iPad if the layout changed), in landscape:

- [ ] Play a level with **touch controls**: drive with the left thumb, aim and fire with the right
      stick, tap to fire at the nearest enemy, MINE button, ammo buttons, pause.
- [ ] Collect a pick-up and salvage a wreck; finish a wave (checkpoint) and finish the level (results
      and stars).
- [ ] Garage: Tank, Ammo, Armour, Skills and Vehicles tabs; buy an upgrade and see it on the
      turntable.
- [ ] Settings: language, sound effects volume, graphics quality, camera shake, damage numbers,
      aim assist.
- [ ] Save slots: switch slot, export, import. Check that Export really produces a file on
      Android and iOS, not only in a desktop browser.
- [ ] Landscape lock, immersive full screen and keep-awake on native builds; Android back button
      pauses / resumes and steps back in menus.
- [ ] Frame rate holds on the weakest test phone in the heaviest new scene.

## 5. Store listings

- [ ] Screenshots and feature graphic regenerated if anything on screen changed:
      `npm run store:capture` (see [store/README.md](store/README.md)).
- [ ] Release notes written in **English and Thai** for Play Console and App Store Connect.
- [ ] Store text in [docs/STORE_LISTING.md](docs/STORE_LISTING.md) still true (level count, enemies,
      weapons, "offline, no ads, no in-app purchases").
- [ ] App Store keywords still ≤ 100 characters per locale, with no other companies' trademarks.

## 6. Legal and review

- [ ] [CREDITS.md](CREDITS.md) lists every third-party asset that ships (Poly Haven textures,
      Three.js) after any new texture or dependency.
- [ ] [public/privacy.html](public/privacy.html) still describes what the game does (no accounts, no
      network, no analytics, local saves only), and the Google Play Data safety and App Store App
      Privacy answers match it. Update its effective date if the text changed.
- [ ] If a new permission, SDK or network call was added, update the privacy policy, Data safety,
      App Privacy and `PrivacyInfo.xcprivacy` together.
- [ ] [store/APP_REVIEW.md](store/APP_REVIEW.md) still true; paste it into App Review Information
      if anything changed.
- [ ] A new screen recording only for the first submission, if Apple asks, or if the release adds
      accounts, purchases, ads or user-generated content (shot list in `store/APP_REVIEW.md`).
- [ ] Content rating answers still hold (violence between military vehicles and soldiers, no blood).

## 7. Ship

- [ ] **Ask the owner before pushing the tag.** Then
      `git tag vX.Y.Z && git push origin vX.Y.Z`; a hyphen (`v1.1.0-rc1`) makes a pre-release.
- [ ] The GitHub Release has every asset: Android APK/AAB, Windows setup and portable EXE, macOS
      DMG, Linux deb/AppImage, web zip.
- [ ] Before the first Play upload: `keytool -printcert -jarfile <aab>` must **not** say
      `CN=Android Debug`.
- [ ] Android: the AAB lands on the Play **internal testing** track (`PLAY_SERVICE_ACCOUNT_JSON`);
      install it there, test, then promote. A new personal account needs the 12-tester, 14-day
      closed test before production.
- [ ] iOS: Xcode Cloud builds the tag to **TestFlight**; install that build, walk section 4 again
      on it, then submit for review.
- [ ] After approval: open the live store pages and check both locales (en and th).
