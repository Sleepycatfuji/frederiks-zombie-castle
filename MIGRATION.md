# Migration from ChatGPT Sites

The source is the original Sites version 2, commit
1880d0adc574c769fe627803d8c7d9506ff1b2bc, exported on 2026-11-11.
All eight buildings, Canvas artwork, generated Web Audio music and effects,
pathfinding, combat and the 15 × 10 building grid are retained. There are no
external assets, network APIs, secrets or server-side functions to migrate.
Normal preserves the original combat values. Easy uses 70% zombie health and
damage; Hard uses 140%. These affect new spawns. Survival and Creative remain.

## Transfer your existing saved kingdom

Browser storage cannot be read by another website or by this migration session.
On the original site, in the browser/profile holding your progress, use Save if
you want to transfer the current battlefield. Otherwise leave the old save alone.
Open browser Developer Tools → Application (Chrome/Edge) or Storage (Firefox) →
Local Storage → the original game's origin. Copy the complete value of
`zombie-castle-defense-v1` into a plain UTF-8 file named `kingdom.json`.
Do not clear, delete or edit the entry. It contains buildings, coins, waves,
active zombies and game mode. Original saves have no separate difficulty field;
they load as Normal. Sound preferences are under `zombie-castle-audio-v1`.

Alternatively, run this reviewed snippet in the original site's console. It
reads only the game's saved entry and downloads it without changing storage:

```js
(() => {
  const raw = localStorage.getItem('zombie-castle-defense-v1');
  if (!raw) { alert('No saved kingdom found in this browser.'); return; }
  JSON.parse(raw);
  const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url; link.download = 'kingdom.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
})();
```

On the new game, choose Import save, select that file, review its summary, then
confirm. Export your current kingdom first if you want to keep it. Import does
not overwrite the browser's saved slot; press Save after checking the result.
To return later, use Load and confirm. Save is explicit, not automatic on reload.
Export save downloads the current battlefield, even when browser storage is
unavailable. Transfer this JSON file to any other browser and Import it there.
Never commit personal save files to the public repository.

## GitHub Pages

Create public repository `Sleepycatfuji/frederiks-zombie-castle`. Push this source
to `main`, excluding `.openai`, `.git` credentials and local work files.
Set Settings → Pages → Source to GitHub Actions. The included workflow tests
JavaScript and gameplay, regenerates the downloadable source ZIP, and publishes
only `dist/` using GitHub's temporary built-in token. No user token belongs in
source or Actions secrets. Relative URLs support the repository subpath.

The expected URL after a successful deployment is:
https://sleepycatfuji.github.io/frederiks-zombie-castle/
This is not a confirmation that deployment has completed.

Future updates: edit source in `dist/`, run `npm test` and `npm run check`, then
commit and push to `main`. Actions deploys automatically after tests pass.
The workflow can also run manually from the Actions tab.

## Validation and remaining checks

29 Node tests and syntax checks passed. Tests exercise Canvas drawing calls,
audio gating/scheduling and toggles, all buildings, combat, economics, save/load,
legacy imports, invalid imports and difficulty persistence. This is buildless:
`dist/` is the production artifact. The source ZIP is regenerated with
`python3 scripts/package.py`.

Browser automation was unavailable in the migration environment. Actual desktop
and mobile rendering, touch interactions, real audio output, file download and
file-picker behavior still need browser checks. Test Chrome, Firefox and Safari,
plus iOS Safari and Android Chrome: place each building; operate bridges; start
a wave; hear sound and music; change difficulty; Save; reload; Load; Export;
Import in another browser; Save and reload again. Check narrow portrait and
landscape layouts. Audio requires a click/tap first. Storage restrictions can
prevent local saving; export remains available.

The original Sites project and its browser data have not been changed.
