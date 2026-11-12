# P0: Protect Progress

This branch changes persistence and save controls only. Prices, artwork, sound,
combat, the eight building IDs and the 15 × 10 grid remain unchanged.

## Existing formats and compatibility

The old `zombie-castle-defense-v1` localStorage entry contains a version-1 JSON
snapshot. Original Sites saves lack difficulty; the GitHub migration added an
optional difficulty field without changing that version. Both migrate purely
to snapshot version 2; missing difficulty becomes Normal. No existing upgrade
mechanic exists, but extra building fields and root resource/upgrade fields are
retained rather than discarded. The original entry is read-only in this UI.
The audio preference entry is unchanged.

A future schema change must add a migration in Game.migrate, retain v1/v2 fixture
tests, and only then advance the snapshot version. Unsupported newer formats
are never silently reset and block persistence by this older client.

## Storage and recovery

New records use the unique prefix `frederiks-zombie-castle.saves.`:

- `auto.a` / `auto.b`: latest two autosave generations.
- `manual.a` / `manual.b`: latest two explicitly confirmed manual generations.
- `checkpoint.<time>.<revision>`: retained snapshots before new games, imports,
  or replacement of an active battlefield through Load / Recover.
- `recovery.<time>.<revision>`: unreadable bytes quarantined before an inactive
  autosave/manual generation is reused. These raw forensic copies are not
  offered as playable kingdoms unless repaired externally.

Each record has envelope format 1, a monotonic revision, timestamp, snapshot
payload and checksum over its metadata and payload. This checksum detects
accidental corruption; it is not anti-cheat or cryptographic authentication.
Each generation is one localStorage setItem, then exact read-back and validation.
There is no separate pointer that can get out of step. Writes rotate away from
the newest valid generation, and failed writes never receive a success indicator.
Continue sorts all valid records by revision and falls back when newer data is
unreadable. Legacy records have revision 0 because they have no save timestamp.

Autosaves run after building/removal/bridge changes, wave starts/ends, defeats,
mode/difficulty changes and game over, plus changed-state checkpoints every second.
They also run on pagehide and when the document becomes hidden. Event saves are
queued until the current simulation operation is complete. Restored active
battles start paused. Resume continues the saved wave, including zombie positions,
health, spawn counters, tower cooldowns, coins and difficulty.

Manual Save is separate from autosave. Replacing an existing manual snapshot
requires confirmation. New kingdom and Import also require confirmation and
preserve the outgoing kingdom as a checkpoint before replacement. Export writes
the current battlefield to portable version-2 JSON; it does not change storage.
Import accepts version 1 and 2, validates before changing state, and uses autosave
without touching the manual or original legacy entry.

Web Locks permits only one writing tab where supported. Other tabs can inspect
or export their battlefield, but must close the first tab and reload before
saving. A revision fingerprint additionally rejects stale writes. On browsers
without Web Locks the fingerprint is best-effort; it cannot make simultaneous
cross-tab read/modify/write operations atomic.

## Manual review before merging

Use a separate browser profile or copy your original game's Export Save first.
Do not clear production site data. To run this branch locally:

```sh
git switch p0/protect-progress
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. This has separate storage from the public website.

1. Import a copy of an existing save. Review and confirm. Verify all eight
   building types/positions, coins, difficulty, bridge state and current wave.
   Extra upgrade fields are preserved, but this game has no upgrade UI to inspect.
2. Start or resume a wave. Wait for Autosaved, refresh, then choose Continue Game.
   The restored battle should be paused. Check the board and resume.
3. Close the browser, reopen the same profile and URL, then Continue. Verify it
   returns to the saved kingdom instead of a fresh battlefield.
4. Press Save, change the kingdom and wait for Autosaved. In Load / Recover,
   select the manual entry; verify the manual state is still available. Cancel a
   manual overwrite and a New kingdom request; neither should replace progress.
5. Export, then import the JSON in another browser/profile and refresh it.
6. In this disposable local profile only, use DevTools to replace the newest
   `auto.a` or `auto.b` value with invalid JSON. Refresh and Continue. It should
   load the previous valid generation and retain damaged bytes in recovery storage.
7. Open a second tab. It must not overwrite the first tab's progress. Close the
   first tab and reload the second to take over.

## Tests and limits

Verified locally: **39 Node tests**, JavaScript syntax checks, and all eight browser persistence scenarios passed.

Run `npm test`, `npm run check`, and `python3 tests/browser-saves.py`.
The browser script requires Python Playwright and Chromium (or Playwright's
installed Chromium); CHROMIUM_PATH can specify a system executable. It uses a
private temporary profile and a loopback server, never the live origin. Rendering
and audio are stubbed in persistence browser tests to keep them focused; the
existing Node drawing/audio tests still run. GitHub save checks run all suites
on this branch and pull requests without deploying Pages.

Storage tests cover both legacy variants, full active-state round trips, optional
upgrade/resource preservation, independent generations, checksum corruption,
truncated/silent/quota failures, interruption immediately after commit, immutable
checkpoints, future-version protection and stale tabs. Browser tests cover actual
reload, browser-process close/reopen using a disk profile, file download/upload,
mobile-sized import, corruption recovery, failure indicators and confirmations.

Browser storage cannot guarantee protection from device failure, clearing app or
site data, uninstalling, private-mode cleanup or an OS disk-write failure. No cloud
sync or Android storage is introduced. A forced kill can lose changes since the
last completed checkpoint (normally up to one second of combat, longer if the
browser stalls). Explicit checkpoints and raw recovery copies are retained without
auto-pruning; repeated new games/imports can eventually fill storage. A failed
checkpoint blocks replacement so the player can export instead.

Rollback to main leaves every P0 key untouched but main does not understand
version-2 saves. The original version-1 slot remains available. Export newer
progress before rollback and return to this branch to restore it; do not simply
change version numbers in a save file.
