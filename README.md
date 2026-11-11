# Zombie Castle Defense

See [MIGRATION.md](MIGRATION.md) for original-save transfer, new portable saves, difficulty settings, deployment status and current verification limits.

A complete first playable castle-building game for Frederik (age 8), built with HTML5 Canvas, CSS, and plain JavaScript. No backend, dependencies, paid services, accounts, external fonts, or downloaded game assets. All pixel graphics, sound effects, and the cheerful medieval-inspired musical loop are original and generated in code.

## Run locally

1. Unzip the project.
2. Open `dist/index.html` in a current desktop Chrome, Edge, Firefox, or Safari browser.
3. Choose a building and click the meadow. Press **Start wave 1** when you are ready.

For consistent localStorage behavior, serve the folder instead of using a `file:` URL:

```sh
cd zombie-castle-defense
python3 -m http.server 8000 --directory dist
```

Open **http://localhost:8000**. Use the same browser and address to return to your saved kingdom. No installation or build step is needed. Audio starts after the first click or key press. Sound and music can be switched on or off independently, and those preferences are remembered.

## Play

- Build on the 15 × 10 meadow around Frederik's 3 × 2 central castle. Two archer towers and six wooden walls are free starter defenses. You begin with 420 coins.
- Start a wave when ready. Towers attack automatically. You can continue building, removing, or operating bridges during a wave.
- Zombies follow open paths, or chew through buildings when they need to. Three funny zombie types appear as waves get harder: Shufflers, Bucketheads, and Big Bob.
- Defeated zombies drop coins. Each completed wave pays **40 + 5 × wave number**, plus **30 per surviving gold mine**, and repairs 8 castle health (up to 100).
- Remove a building for a 50% refund. The castle cannot be removed. Buildings do not repair themselves; replace damaged ones between attacks.
- In Creative Mode, building costs nothing. Castle health and zombie attacks still work, so you can test your grandest defenses. Switch modes anytime.
- **Save** stores the current kingdom and active wave in this browser's localStorage. **Load** replaces the current battlefield after confirmation. Starting over preserves your last save until you save again. Storage errors are shown without destroying the current game.
- The game ends when castle health reaches zero. Choose **Build again** or load a saved kingdom. Waves continue indefinitely, becoming more difficult.
- The game pauses when its tab is hidden. Choose **Resume** when you return.

| Building | Coins | What it does |
|---|---:|---|
| Wooden wall | 15 | Blocks zombies; 100 health |
| Stone wall | 35 | Blocks zombies; 280 health |
| Archer tower | 65 | 17 damage every 0.72 seconds; 3.5-tile range; 140 health |
| Fire tower | 110 | 23 damage in a 0.95-tile splash every 1.35 seconds; 3-tile range; 130 health |
| Ice tower | 90 | 8 damage every 0.95 seconds; 3.3-tile range; slows movement to 45% for 2.4 seconds; 130 health |
| Gold mine | 80 | Generates 30 coins after each survived wave; 90 health |
| Water moat | 20 | Zombies wade at 35% speed; cannot be destroyed |
| Drawbridge | 40 | Lowered: normal crossing. Raised: destructible wall with 180 health. Includes its own water tile. |

Choose the **Bridge** tool and click a placed drawbridge to raise or lower it. A bridge cannot be raised while a zombie stands on it. Ice and moat slowing stack. Towers and mines also block movement and can be attacked.

| Key | Action |
|---|---|
| 1–8 | Select the corresponding building |
| R | Remove tool |
| B | Drawbridge control tool |
| Arrow keys | Move the grid cursor |
| Enter on the grid | Place / remove / operate selected tool |
| Space | Start a wave or pause / resume (when the grid or page is focused) |
| Escape | Return to the last building, or close a dialog |
| H or ? | Instructions |
| Right mouse button on grid | Remove a building |

## Deploy to GitHub Pages

### Option A: Deploy with the included workflow

1. Create a GitHub repository and upload this project's files, including `.github/workflows/pages.yml` and `dist/`.
2. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Push to the `main` branch, or run **Actions → Deploy game to GitHub Pages → Run workflow**.
4. Open the URL shown by the completed deployment, normally `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

The workflow publishes only `dist/`. The game uses relative paths and works under a repository subpath. It requires no API keys or backend. GitHub Pages is available free for public repositories.

### Option B: Publish without Actions

Copy the **contents of `dist/`** to the root of a repository. In **Settings → Pages**, choose **Deploy from a branch**, then `main` and `/ (root)`. Save and wait for the Pages URL. You can also put those contents in `docs/` and select `/docs`.

Saves belong to a browser and origin. Localhost, a `file:` URL, the hosted preview, and GitHub Pages have separate saves. Clearing site data clears saved games. Private browsing or restrictive storage settings may disable persistence.

## Files and extension points

```text
dist/
  index.html       Accessible controls, dialogs, and Canvas
  style.css        Responsive storybook interface
  favicon.svg      Original castle icon
  js/
    data.js        Building registry, monster registry, grid rules
    engine.js      DOM-independent simulation, pathfinding, saves
    render.js      Original pixel sprites, Canvas rendering, effects
    audio.js       Web Audio synthesis and original looping music
    app.js         Input, UI, settings, simulation/render loop
tests/
  engine.test.cjs   Gameplay, paths, economics, save integrity
  audio.test.cjs    Interaction gating, sound scheduling, toggles
  ui.test.cjs       Connected controls and Canvas/DOM smoke tests
.github/workflows/pages.yml
scripts/package.py   Rebuild the portable source ZIP (Python 3)
```

Add a building to `ZCD.BUILDINGS` in `data.js`, then add its artwork in `render.js`. The palette is generated from the registry. The first eight entries have number shortcuts; additional entries automatically appear in the palette. Combat stats support `range`, `damage`, `rate`, `splash`, and `slow`. To add a monster, extend `ZCD.MONSTERS`, its drawing in `render.js`, and the wave selection in `engine.js`. The event interface lets sound and rendering respond without coupling them to the simulation. Save data is versioned; introduce a migration if future changes alter its shape.

## Verification

With Node.js 20 or newer installed:

```sh
npm test
npm run check
```

No `npm install` is required. Tests cover all eight buildings, placement and refunds, automated attacks, area damage, slowing, walls and bridge damage, pathfinding, castle attacks, wave difficulty and victory, mine income, Creative Mode, pause/speed, restart, active-wave saving, invalid saves, interaction-gated audio, original music scheduling, independent audio toggles, and connected UI controls.

The migrated release passes **29 automated tests**. See MIGRATION.md for production browser checks. To refresh the downloadable source after editing, run `python3 scripts/package.py`.

These automated tests run the simulation and a lightweight DOM/Canvas/audio harness. They do not measure actual browser layout, speaker output, or autoplay policy. Visual browser testing and listening were unavailable in the build environment because its browser-control tool was missing. For a manual browser check: place each building; toggle a bridge twice; remove a wall; play a wave; save midway, reload, and load; try both audio toggles independently; deliberately let the castle fall and restart.

## License

MIT. See `LICENSE`. The game contains no third-party game assets.
