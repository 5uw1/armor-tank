# Armor Tank

2.5D tank wave-survival game for PC and mobile browsers (Three.js + TypeScript + Vite).
Requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) · Asset credits: [CREDITS.md](CREDITS.md)

## Run

```bash
npm install
npm run dev
```

Open the printed URL. To test on a phone on the same Wi-Fi, use the Network URL and hold the phone in landscape.

## Apps (Windows / Android / iOS / PWA)

| Platform | Technology | Build | Output |
|---|---|---|---|
| Windows | Electron | `npm run app:win` | `release/Armor Tank Setup x.y.z.exe` (installer) and `release/ArmorTank-portable-x.y.z.exe` |
| Android | Capacitor | `npm run app:android` (needs Android Studio; uses its bundled JDK via `JAVA_HOME`) | `android/app/build/outputs/apk/debug/app-debug.apk` → `adb install -r ...` |
| iOS | Capacitor | `npm run app:ios`, then open `ios/App/App.xcodeproj` in Xcode **on a Mac** | App Store / TestFlight (needs an Apple Developer account) |
| iPhone/iPad without a Mac, any browser | PWA | Deploy `dist/` to any HTTPS host | Safari → Share → *Add to Home Screen* (offline, full screen) |

Notes:
- Android uses Gradle 9.1, because Android Studio's bundled Java 25 needs it.
- Native builds lock the screen to landscape, run immersive full screen and keep the screen awake. On Android, the back button pauses and resumes the game and goes back in menus.
- `npm run icons` regenerates every app icon and splash screen from `assets/icon.svg`.
- Language: Thai / English (Settings → Language). The first launch picks the device language.

## Store release

Store text (Thai/English), the Data safety and App Privacy answers, and the screenshot checklist are in [docs/STORE_LISTING.md](docs/STORE_LISTING.md). The privacy policy is `public/privacy.html` (copied to `dist/privacy.html`), which must be hosted at a public HTTPS URL.

**Google Play**
1. Create the upload key once and keep it and its password safe; losing it means you can't ship updates:
   `"C:\Program Files\Android\Android Studio\jbrin\keytool" -genkeypair -v -keystore D:\keysrmortank-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Create `android/keystore.properties` (ignored by git):
   ```
   storeFile=D:/keys/armortank-upload.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
3. Increase `versionCode` (and `versionName`) in `android/app/build.gradle` for every upload.
4. `npm run app:android:release` → `android/app/build/outputs/bundle/release/app-release.aab`, which you upload to Play Console (internal testing first).

**App Store** (needs macOS + Xcode): `npm run app:ios`, open `ios/App/App.xcodeproj`, set the Team to your Apple Developer account, then Product → Archive → Distribute → App Store Connect → TestFlight. Without a Mac, use a cloud Mac (MacinCloud) or a CI service with macOS runners (Codemagic, GitHub Actions).

## Story

A 25-level campaign across 5 chapters:
- **RedCore**, a private military company with robot tanks and drones, versus the 3rd Armoured Battalion "Iron Wolves".
- The route runs Alden suburbs → downtown → Karz desert → Port Saris → Nordhavn (winter), ending at the TITAN AI core.
- Each level has a briefing with a difficulty rating and a debrief. Each chapter opens with an intro, and there is an ending after level 25.
- Scripts live in `src/game/story.ts`.

## Controls

| | PC | Mobile |
|---|---|---|
| Drive | WASD / arrow keys | Drag with the left thumb |
| Aim / fire the cannon | Mouse + left click | Drag with the right thumb toward a target (aims and fires, aim assist on); tap the right side to fire at the nearest enemy |
| Machine gun / laser | Right click / Space | Fires automatically while aiming |
| Drop mine | F / E | MINE button |
| Switch ammo | Q or 1–6 or the HUD buttons | HUD buttons |
| Zoom | Mouse wheel | — |
| Pause | Esc / P | ❚❚ button |

## Status — M2: 10 levels

| # | Level | Mode | Introduces |
|---|---|---|---|
| 1 | Quiet Street | Survival | Buggy, light tank, APC, MLRS |
| 2 | Cul-de-sac | Survival | Infantry (rifle / RPG), crushable by the tank |
| 3 | School Yard | Defend the field hospital (fail if destroyed) | APCs deploy infantry squads |
| 4 | Gas Station | Survival | Explosive fuel tanks and drums (chain reactions, fire) |
| 5 | Suburb Gate | Mini-boss | Attack helicopter (flies over buildings) |
| 6 | Main Avenue | Survival, downtown | Kamikaze drones |
| 7 | Crossroads | Destroy 3 jammer towers (radar jammed, waves loop) | — |
| 8 | Financial District | Survival | Heavy tanks |
| 9 | Convoy Run | Escort 3 trucks; they move while you're within 35 m | Robot tanks (UGV) |
| 10 | City Hall | Boss | Behemoth: 3 phases, rocket barrages, secondary MG, drone swarms |

### M3: chapters 3–5 (levels 11–25)

| Chapter | Theme | Levels |
|---|---|---|
| 3 · Desert | Sand, adobe towns, oasis, military bases (hangars, bunkers, watchtowers, T-walls, fuel) | 11 Dune Road · 12 Oasis (defend) · 13 Sandstorm · 14 Forward Base (destroy 4 radars) · 15 **Desert Tyrant** (boss) |
| 4 · Port | Container yards (stacks collapse tier by tier), warehouses, gantry and harbour cranes, sea and cargo ship | 16 Container Yard · 17 Dockside Convoy (escort) · 18 Warehouse District · 19 Harbor Radar (destroy) · 20 **Twin Gunships** (boss) |
| 5 · Winter | Snow ground and roofs, bare trees and snowy pines, **icy roads (vehicles slide)**, snowfall and blizzards | 21 Frozen Suburb · 22 Blizzard · 23 Winter Hospital (defend) · 24 Frozen Convoy (escort) · 25 **Frost Titan** (final boss with a telegraphed railgun) |

- Weather: sandstorms and blizzards bring close fog and blowing particles.
- Tall cranes fade out when they block the view.

Each level has an overall difficulty multiplier (×1.0 → ×2.7 enemy HP/damage) on top of the per-wave scaling. In defend and escort levels, ~45% of enemies go for the objective.

## M1 features

- Level 1 "Quiet Street": 5 waves with 5 enemy types (Scout Buggy, Light Tank, APC, MLRS, and a Medium Tank at the end).
- Enemy AI uses a flow field to path around buildings; each type has its own behaviour (strafe, chase, stand-off, artillery with ground warning rings).
- Destruction:
  - Buildings collapse in stages and finally turn to rubble; enemies re-path when a building falls.
  - Cars explode.
  - Trees fall over when rammed.
  - Destroyed tanks become burning wrecks and lose their turret.
- Pick-ups: supply crates parachute onto random open spots every 13–23 s (max 4 on the map). Destroyed enemies may leave a salvageable wreck (golden `?`; buggy 30% → heavy tank 75%): drive into it within 30 s for a random item. Drops are weighted toward what you need (repairs when HP is low, HE when you're short).

  | Pick-up | Effect |
  |---|---|
  | Repair `+` | +300 HP |
  | HE ammo | Refills HE rounds |
  | Guided missiles `➶` (20 s) | Pods on the turret auto-fire top-attack homing missiles at the nearest enemy |
  | ERA armour `▣` (25 s) | Reactive armour blocks bolted on; incoming damage −60% |
  | Nitro `»` (14 s) | +60% speed, sharper turning, blue exhaust flames |
  | Autoloader `⟳` (16 s) | 2.2× faster reload |
  | Overcharge `×2` (15 s) | Double damage |
  | Air strike `✈` | 12 guided artillery shells on enemies inside the map, nearest first, split by the HP each needs; held until a target enters the map |
  | Energy shield `◈` (20 s) | Fresnel force-field bubble absorbs up to 600 damage |
  | Mines `✹` | +5 proximity mines (max 10); drop behind the tank with F / MINE button; 350 damage |
  | Laser `ϟ` (15 s) | Replaces the coax MG with a continuous beam (170 DPS, burns buildings) |
  | Attack drones `✢` | +2 friendly quadcopters (max 3), each with its own 25 s lifetime (ring above it); they circle enemies within 45 m firing MG bursts, then dive onto a target for 160 blast damage |
- Friendly fire: enemy shells, bullets and rockets also damage other enemies (orange numbers).
- Enemy AI states:
  - **Patrol**: drive the road network in the right-hand lane.
  - **Detect**: sight 35–60 m by type, hearing 18 m, your cannon is heard up to 90 m and your MG up to 45 m, being shot reveals you.
  - **Radio**: the spotter alerts allies within 70 m.
  - **Engage**: limited attack slots, and no firing through allies.
  - **Search**: lost for 6 s → check your last known position → resume patrol.
  - **Intel**: after 25 s without contact, the 2 nearest enemies get your coordinates.
  - Enemies spawn on road spurs outside the map but cannot fire until they are inside the playable area, and once inside they cannot leave. Loot from an enemy killed outside becomes a crate at the nearest point inside the map edge.
  - Rocket trucks fire only while someone has eyes on you. A red `!` marks an enemy spotting you, a yellow `?` marks one searching.
- Progression (saved per slot, save format v2):
  - **Credits ◆ and EXP** are earned per kill and wave clear, with a victory bonus. They are banked into the profile at every wave clear, so quitting mid-level keeps them. Each wave adds +5% to rewards.
  - **Garage → Tank**: Attack +8%, Defense −5% damage taken, HP +10%, Engine +5% speed, Reload −5% (10 levels each; cost grows ×1.45 per level).
  - **Garage → Ammo**: unlock HEAT (heavy single-target damage), Incendiary (6 s fire field), Cluster (7 bomblets) and Railgun (pierces every vehicle in line). Select with 1–6, Q or the HUD buttons.
  - **Garage → Armour**: buy and equip one kit, shown on the tank:
    - Composite: +25% HP
    - ERA: −35% damage from shells and rockets
    - Slat cage: −50% damage from rockets and blasts
    - Heavy plate: −22% damage from everything, −12% speed
    - APS: intercepts incoming shells and rockets every 5 s
  - **Garage → Skills** (level-ups give skill points; permanent passives; free reset): drone time, buff time, missile pod, shield capacity, regeneration, salvage luck, mines, air-strike shells, critical hits, bounty.
  - Old v1 saves get 6 EXP per past kill when migrated.
- Waves:
  - Wave 1 spawns scattered on roads inside the map, at least 60 m from you and preferably out of sight, and patrolling.
  - From wave 2, about 40% of each wave arrives as reinforcements from the map edges.
  - Each wave adds +12% enemy HP and +7% enemy damage.
- Menus: main, level select, garage (3D viewer), settings, 3 save slots with export/import, pause, results with 3 stars.
- Saving: checkpoint after every wave (IndexedDB). Continue resumes from the last cleared wave, including the destruction state of the map.

Textures from Poly Haven are stored in `public/textures` (WebP). To regenerate them, download the sources into `assets-src/polyhaven/` and run `node scripts/convert-textures.mjs`.
