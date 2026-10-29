# App Review Information (Guideline 2.1 answers)

Paste the block below into **App Store Connect → App Review Information → Notes**, and send the
same text as the reply in the Resolution Center if Apple asks for more information. It answers the
six points Apple asks for on a new app submission. Keep it here so future submissions reuse the
same wording, and update it when the game changes (see [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md)).

Quick facts: no account, no login, no in-app purchases, no ads, no user-generated content, no chat,
no network access while playing. Sign-in required: **No**, so no demo account is needed.

---

## Notes text (paste verbatim)

**Demo account:** none required. The game has no accounts and no login; every feature is available
immediately after launch.

**1. Screen recording**

A screen recording made on an iPhone running the latest iOS is attached. It starts with the app
launch and shows the typical flow: the main menu, choosing the language, starting a new game and
playing level 1 with the touch controls (driving, aiming and firing, collecting a pick-up), the
garage where the tank is upgraded with credits earned in the level, the save slots and the
settings.

The game has no account registration, no login and no account deletion flow, because it has no
accounts. It has no user-generated content and no communication between players, so no reporting
or blocking mechanism is required. It has no advertising, no paid content and no in-app purchases;
the full game is included in the download. The credits used in the garage are earned only by
playing and cannot be bought.

**2. Purpose and target audience**

Armor Tank is an offline single-player action game. The player commands a tank in a 2.5D city seen
from almost straight above and fights through 25 levels in 5 story chapters (suburbs, downtown,
desert, port and a winter city). Missions include surviving waves of enemy vehicles, defending a
field hospital, destroying radar towers, escorting a convoy and boss battles. Buildings, cars and
trees are destructible. Between levels the player spends the credits and experience earned in play
on tank upgrades, ammunition types, armour kits and passive skills.

The audience is players aged 13 and over who enjoy short action sessions on a phone or tablet. The
violence is combat between military vehicles (tanks, armoured trucks, helicopters, drones) and
small infantry figures, shown from a distance with explosions and wreckage. There is **no blood, no
gore** and no close-up depiction of injury. There is no sexual content, no profanity, no drug use
and no gambling. The story is fictional: an army battalion stops a private military company and
its AI; it names no real country, army or group.

**3. Setting up and accessing the main features**

No credentials, files or configuration are needed. The game opens on the main menu, in the
device's language (Thai or English).

1. **Settings → Language**: switch between Thai and English (the game reloads in that language).
2. **New game**: shows the chapter introduction and the briefing for level 1, then starts the level.
3. **Controls** (landscape): drag with the left thumb to drive; drag with the right thumb towards
   an enemy to aim and fire (aim assist is on by default); tap the right side of the screen to fire
   at the nearest enemy. The buttons on the HUD switch ammunition, drop a mine and pause.
4. **Pick-ups**: supply crates drop onto the map and destroyed enemies may leave a wreck marked
   with a golden "?". Drive over them to collect repairs, ammunition, a shield, missiles, drones and
   other short power-ups.
5. **Progress**: the game saves automatically after every wave. Clearing all waves completes the
   level, awards up to 3 stars and unlocks the next one. **Select level** replays any unlocked
   level; **Continue** resumes the last unfinished level from its last cleared wave.
6. **Garage · Upgrades**: spend credits on Tank upgrades (attack, defense, HP, engine, reload),
   Ammo types, Armour kits shown on the 3D tank, and Skills bought with skill points from levelling
   up. The Vehicles tab shows every vehicle in the game on the 3D turntable.
7. **Save slots**: three independent save slots. **Export** saves the slot as a file and **Import**
   reads a save file the user picks with the system file picker. Both are optional backups.
8. **Settings**: language, sound effects volume, graphics quality, camera shake, damage numbers
   and aim assist.

Each completed level unlocks the next. Deleting the app removes all saves; exported save files stay
where the user put them.

**4. External services, tools and platforms**

None. The game makes no network requests and contains no third-party SDK: no analytics, no
advertising, no tracking, no crash reporting, no authentication provider, no payment processor, no
AI service, no backend of our own. All game content (models, textures, sounds, story) is packaged
in the app, and saves are stored only in the app's local storage on the device.

The only components used are Apple system frameworks (WKWebView for rendering through WebGL, the
system file picker for save import) and open-source libraries compiled into
the app: Capacitor (the native shell) and Three.js (the 3D engine), both MIT-licensed.

The App Privacy answers are therefore "Data Not Collected" in every category, matching the privacy
manifest (`PrivacyInfo.xcprivacy`) in the build and the privacy policy at
https://5uw1.github.io/armor-tank/privacy.html.

**5. Regional differences**

There are none. The game behaves identically in every region and country; nothing is gated by
region, and the game does not read the device location. The interface and story are localized
into Thai and English; on first launch the game follows the device language and can be switched in
Settings. Every feature is available everywhere.

**6. Regulated industry / third-party material**

The game is not part of a regulated industry. It offers no gambling, loot boxes bought with money,
real-money rewards, banking, health or legal services.

It contains no protected third-party material. All vehicle and building models, effects, sound
effects, icons and story text are our own and generated in code. The vehicles are generic
designs, not replicas of real branded or trademarked military products, and no real company, army
or person is named. The only third-party assets are photo-scanned ground and wall textures from
Poly Haven (https://polyhaven.com), released under **CC0** (public domain), credited in the
repository's CREDITS.md. The open-source libraries listed in point 4 are used under their MIT
licences.

---

## Screen recording: what to capture

Record on a physical iPhone on the latest iOS (Settings → Control Centre → Screen Recording),
**landscape**, roughly 2–4 minutes, starting from the home screen with the game not running. Use a
fresh install (or an empty save slot) so the recording starts from the beginning:

1. Tap the app icon: show the launch screen and the main menu.
2. **Settings → Language**: switch to English (or Thai and back) so the reviewer sees both are
   supported, then return to the main menu.
3. **New game**: let the chapter intro and the level 1 briefing show, then start the level.
4. Level 1 with **touch controls**: drive with the left thumb, aim and fire with the right thumb,
   tap to fire at the nearest enemy, switch ammunition, drop a mine. Destroy a few vehicles and a
   building.
5. Drive over a **pick-up** (a supply crate or a wreck marked "?") and show its effect on the HUD.
6. Clear a wave (the checkpoint save), then pause → **Save & quit to menu**, or finish the level to
   show the results and stars.
7. **Garage · Upgrades**: buy a Tank upgrade with the credits just earned; open the Ammo, Armour and
   Skills tabs and rotate the 3D tank.
8. **Save slots**: show the three slots and the Export and Import buttons.
9. **Settings**: sound effects volume, graphics quality, aim assist.

Nothing in the game is behind a login or a purchase, so there is nothing else to unlock on camera.
Upload the file in the Resolution Center reply (App Store Connect accepts .mp4/.mov; if it is too
large, trim it or share an unlisted link).
