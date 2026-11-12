# Frederik's Castle Defense — family-playtest-v2

A separate prototype based on the original GitHub game plus the P0 save branch.
Nothing in this branch deploys the public Pages site. Do not merge or release it
before the family has played it. The original audio.js is byte-for-byte unchanged.
The workshop, fonts, colors, controls, pixel sprites and page layout are reused.

## Play on your computer

```sh
git clone --branch family-playtest-v2 https://github.com/Sleepycatfuji/frederiks-zombie-castle.git
cd frederiks-zombie-castle
python3 -m http.server 8001 --directory dist
```

Open **http://localhost:8001**. Node/npm is not needed for the browser game.
Alternatively download this branch's source ZIP, unzip it, then run the server
from the extracted project directory. Keep using the same address/browser for
local progress. Use Export Save / Import Save to move a kingdom to another device.
For phone gameplay on the same Wi-Fi, open `http://YOUR-COMPUTER-LAN-IP:8001` and
allow the server through your computer's local firewall if necessary. Online
leaderboard CORS must explicitly allow that origin; use HTTPS for hosted play.
No separate public web preview was provisioned; this local URL and branch ZIP
leave the existing GitHub Pages website untouched.

## What changed in gameplay

- Before wave 1: unlimited preparation time. Start wave when ready.
- After victory: an eight-second countdown. Building, removal, bridge changes
  and Sky Watch upgrades are locked. The countdown uses normal time even at 2×.
  Pause and backgrounding pause it. Start Wave Early begins immediately when
  unpaused. Building works again during the active wave.
- Each wave is a level. Worlds change automatically at waves 6, 11 and 16, then
  cycle every five waves. Meadow, Amber Woods, Frosty Fields and Moonlit Meadow
  use the original ground artwork with different palettes. Buildings, upgrades,
  coins and difficulty remain intact. Existing wave-based enemy scaling remains.
- From wave 6, every fifth spawned zombie flies over walls and moats. Archers
  and ice towers attack flyers; fire towers attack ground enemies. Sky Watch
  upgrades an archer for 40 coins: +0.6 range, +50% damage against flying enemies.
  Upgrades are optional, do not alter ground damage, and do not repair damage.
- Limits per kingdom: wood 60, stone 40, archers 8, fire 4, ice 4, mines 4,
  moats 40, bridges 12. These also apply in Creative Mode. Existing imported
  structures above a limit are kept functional; new ones require going below it.
- The original eight prices remain 15, 35, 65, 110, 90, 80, 20 and 40 coins.
  Starting coins, starter defenses, mine income and base tower combat stats stay.
  A removed upgraded tower refunds half its base price; Sky Watch is not refunded.
- HP bars remain visible on destructible structures. Hover/point to inspect HP.
  Sky Watch adds a small badge in the existing pixel style.
- Mouse or touch: choose a favorite, then click/tap or drag across the grid.
  Each newly visited cell costs coins. Drag does not remove structures. Touch
  long-press does not invoke desktop right-click removal. Scroll outside the board.
- Keyboard 1–8 uses the current toolbar order; R removes, B operates bridges,
  U selects Sky Watch. Other original keyboard/audio controls remain.

## Building Inventory and toolbar

Open **Building Inventory · Customize toolbar** in the original workshop.
The catalogue groups Defense, Attack, Resources and Special and shows each
structure's icon, purpose, coins, HP, cap and any unlock wave. Add up to eight
favorites. Remove favorite never removes a placed structure. Move earlier/later
buttons support touch, keyboard and mouse without requiring precise dragging.
An empty toolbar is allowed; the Inventory button always remains available.

Preferences use `frederiks-castle-defense.family-v2.toolbar`, separate from kingdom
snapshots. Changes apply only after verified preference storage. Inventory remains
available during countdown; opening it pauses the game/countdown as other dialogs
do. Closing restores the prior pause state. It never bypasses construction locks.

Developer registry: `dist/js/data.js`, `Z.registerBuilding(id, definition)`.
Definitions carry name/short/description/detail, category, cost, hp, limit,
available/hidden flags, unlockWave, artwork, sounds, abilities and simulation stats
(range, damage, rate, splash, slow, income, block). Artwork can reuse a sprite ID or
provide a drawing function. Sounds reuse named effects in the original engine.
To retire a type, keep its ID/stats/artwork and set `available:false`; `hidden:true`
also removes it from construction. Never delete a definition still used by saves.
Retired placed buildings keep fighting, generating resources, blocking and drawing.
The player menu edits favorites only, not registry entries or statistics.

## Saves and online results

P0 verified generations/manual slots/checkpoints remain, with snapshot version 3.
Version 1 and P0 version 2 migrate without changing their source entries. A legacy
saved intermission becomes an eight-second countdown; active combat is retained.
Restored combat/countdowns start paused. Extra upgrade/resource fields survive.

Prototype writes use `frederiks-castle-defense.family-v2.*`. Original v1 and P0
slots are read-only sources, so testing on the same origin cannot replace them.
Older releases cannot read version-3 exports; keep an original backup for rollback.
Browser storage can still be cleared, and a forced kill may lose the last
unfinished checkpoint. Quota failures are shown; Export remains an escape hatch.

Local personal bests are saved per mode/difficulty in separate device preferences as well as snapshots, so loading an earlier kingdom does not reduce a best. Score = completed waves × 100
+ defeated zombies × 10. See LEADERBOARD-SETUP.md for the shared Supabase service.
Only newly started Survival runs qualify online. Creative use, changing difficulty
mid-run, legacy/imported kingdoms or copied runs from another device stay local.
Each player has independent coins, buildings, saves and toolbar preferences.

## Android preparation

The browser game remains buildless. Capacitor 8 and Android/native plugins are
pinned in package-lock.json. Native web assets have a separate build:

```sh
npm ci
npm run android:add     # first time only; generates ignored android/
npm run android:sync    # after changes
npm run android:open    # opens Android Studio
```

`capacitor.config.json` uses a prototype application ID, separate from a future
production app. The native bridge opens Capacitor Preferences before booting the
game. Save generations and preferences use native read-back verification. Failed
native initialization stops boot instead of silently switching storage systems.
App pause saves/pauses combat and audio; Back opens the existing help dialog.
Export uses Capacitor Filesystem/Share; import uses the WebView's file picker.

Native asset build, Android project generation and plugin synchronization were
checked. No signed APK/AAB or store release was built. Real Android persistence,
process termination, Back navigation, file sharing, audio focus and device layouts
still need Android Studio/device tests. Native storage is not cloud save/backup.

## Family test checklist

1. Start normally, build all eight types and hear the original tune. Test both
   audio toggles independently. Save, refresh, Continue, then close/reopen.
2. Finish wave 1; verify the eight-second lock, Pause/Resume and Start Wave Early.
   Try dragging, removing, bridges and upgrades while locked and during combat.
3. Change favorites/order, remove a favorite already on the board, and refresh.
   Check the board and coins are unchanged and number shortcuts match favorites.
4. Reach wave 6; check the new world, flyers and archer/ice defenses. Try Sky Watch.
5. Export during an active wave and during countdown; import on another browser.
   Check buildings, upgrades, coins, difficulty and spawn/countdown progress.
6. Choose nicknames and test shared scores on two devices once backend setup is
   complete. Confirm each device retains its own kingdom. Test offline retry.
7. Test narrow portrait/landscape, small/older Android hardware, actual speaker
   output, long-press, dragging outside the board, and browser interruption.

Automated commands: `npm test`, `npm run check`, `npm run build:native`,
`npm run test:browser`. Backend SQL and two-browser tests use a disposable
PostgreSQL container; see backend/tests/README.md. Tests never touch the live site.
