# Store graphics kit

Screenshots and graphics for Google Play Console and App Store Connect. They are captured from
the real game, and the store text is in [`../docs/STORE_LISTING.md`](../docs/STORE_LISTING.md).

## Contents

| Path | What | Where it goes |
|---|---|---|
| `icons/play-icon-512.png` | 512×512 app icon | Play Console → Main store listing → App icon |
| `graphics/play-feature-graphic-en.png` / `-th.png` | 1024×500 feature graphic (English / Thai title) | Play Console → Main store listing → Feature graphic (required). Use `-th` for the Thai translation. |
| `screenshots/play/<lang>/` | 1920×1080 (16:9), 7 per language | Play Console → Phone screenshots (2–8) |
| `screenshots/iphone-6.9/<lang>/` | 2868×1320, iPhone 6.9" landscape | App Store Connect → iPhone 6.9" display |
| `screenshots/ipad-13/<lang>/` | 2752×2064, iPad 13" landscape | App Store Connect → iPad 13" display (required, because the app runs on iPad) |

Languages: `en` (default listing, en-US) and `th` (Thai translation). All files are RGB with no
alpha channel.

| # | Screenshot |
|---|---|
| 01 | City battle: destructible buildings, mission checklist |
| 02 | Boss fight: Behemoth with its boss bar |
| 03 | Desert sandstorm |
| 04 | Port: container yard and cranes |
| 05 | Nordhavn in the snow |
| 06 | Garage: upgrades and the tank turntable |
| 07 | Story briefing (Chapter 3) |

## Regenerating

```bash
npm run store:capture              # everything (about 5 minutes)
npm run store:capture -- city boss # only scenes whose id contains these words
```

[`scripts/store-capture.mjs`](../scripts/store-capture.mjs) starts a Vite dev server and an
off-screen Electron window, and uses the dev-only `window.__game` hook to set up each scene:
- It creates a mid-campaign profile, starts the level and makes the player invulnerable.
- It places enemies in view, fires at them, and destroys a vehicle and a building.
- It renders each scene at the three store sizes, using the device pixel ratio so the HUD is laid out as it would be on the phone or tablet.

It then flattens every screenshot to JPEG and produces the 1024×500 feature graphic from a 2× render.
It runs in its own browser storage, so your saves are never touched.
