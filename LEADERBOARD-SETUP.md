# Shared Supabase leaderboard setup

Project: `fbsscxstkjgvluvrjrbz`. The public API URL and publishable key are in
`dist/js/online-config.js`. A publishable key is intentionally public and grants
no database administration. Anonymous sign-ins have been verified enabled.
The schema/Edge Function still need installation in the hosted project. Local
PostgreSQL and isolated-browser checks passed, but hosted two-device verification
must happen after the following setup. Production GitHub Pages remains unchanged.

## Dashboard setup (no privileged credentials in chat)

1. **Authentication → Sign In / Providers → Anonymous Sign-Ins**: enable/save.
   Confirm email can stay enabled; anonymous players do not supply emails.
2. **SQL Editor → New query**: paste the complete contents of
   `supabase/migrations/202611120001_family_leaderboard.sql` and Run **once**.
   This transaction creates private tables and a service-only score RPC. It does
   not store or change game saves. Do not enable public table access or add
   permissive RLS policies. Re-running against an installed schema is unnecessary;
   do not delete existing leaderboard tables to fix an installation error.
3. **Edge Functions → Secrets**: add `LEADERBOARD_IP_SALT`, a long random secret
   generated privately (for example `openssl rand -hex 32` on your computer).
   Add `LEADERBOARD_ALLOWED_ORIGINS` with this comma-separated value:
   `http://localhost:8001,http://127.0.0.1:8001,https://localhost`.
   Add a specific separate HTTPS preview origin or local LAN origin only when
   needed. The existing production Pages origin need not be enabled yet.
4. **Edge Functions → Deploy a new function → Via Editor**: name it exactly
   `leaderboard` and use `supabase/functions/leaderboard/index.ts` as `index.ts`.
   Deploy. In its settings disable the platform's **Verify JWT** toggle: this
   handler validates every player JWT through Supabase Auth itself before calling
   the private database RPC. Do not remove that handler authentication check.
5. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function
   server environment. These values stay server-side. Never put a service-role
   key, database password, JWT signing secret or access token in game files.
6. Open the local prototype, choose a nickname in Leaderboard, and start a fresh
   Survival game. End a run, then check its rank. Repeat on another browser/device
   using the same configured backend and an approved origin. Check both names
   appear and that each browser still has its own coins/buildings/progress.

CLI alternative for developers with their own authenticated Supabase CLI session:

```sh
supabase link --project-ref fbsscxstkjgvluvrjrbz
supabase db push
supabase functions deploy leaderboard --no-verify-jwt
```

Configure the two custom secrets through the dashboard or a local secrets file
excluded from Git. Never paste privileged CLI credentials into chat or commit them.
No backend deployment runs automatically from this prototype branch.

## Scoring and fairness

Rules version: `family-v2-1`. Score is **100 × highest wave completed + 10 × zombies
defeated**, calculated by PostgreSQL. Difficulty is selected when a run registers;
rankings are separate for Easy/Normal/Hard. Each player contributes their best run
per difficulty. Ties share a rank; timestamps give stable display order. The first
10 players appear, with another 10 available per See more scores action.

Only new Survival runs from this device qualify. Creative use, difficulty changes,
imported/legacy kingdoms and foreign-device run tokens stay local. A run token
belongs to one authenticated player and can finalize only once. Duplicate retries
return the existing result rather than adding scores. The server supplies dates,
checks wave/kill bounds, duration limits, mode/rules, ownership and difficulty,
rejects caller-supplied total-score fields, and throttles requests by user and
salted IP hash. Offline-started runs are explicitly marked offline. Completed
waves require their full cumulative zombie count; partial final-wave kills count.
Scores beyond wave 1000 require a later rules review rather than silently accepting
unbounded metrics. No gameplay limit is imposed at that wave by the browser.

This is a client-reported family leaderboard, **not cheat-proof competitive
verification**. Browser code and local saves can be modified; plausible forged
stats, altered Creative flags, anonymous-account churn and offline duration claims
cannot be fully disproved by these bounds. CORS is not an authentication boundary.
Authoritative server simulation/replay and stronger attestation would be required
for prize-bearing competitions. Provider Auth IP limits and a production CAPTCHA
or equivalent abuse control should be configured before opening broad public use.

## Privacy, offline operation and failures

Players intentionally choose a 1–20 character public nickname. No email/real name
is requested. Supabase issues a random anonymous user ID; the browser retains its
session privately on that device. IDs/tokens are not included in public rows.
Only nickname, difficulty, wave/kills summary, duration, run token, score and server
date go to this service. Buildings, coins, settings and full saves are never sent.
Provider access logs may still retain network metadata. Rate-limit rows contain
salted IP hashes and are cleaned after two days. Achievement rows remain until
removed by the project administrator; decide a retention/deletion policy before
commercial release. Losing browser data loses that anonymous identity's access.

Eligible final results are durably queued before network submission. Manual retry
and the browser online event resend them with idempotent run tokens. An existing
queue survives restarts and failed requests. Validation-rejected results are kept
locally with their reason; they are not repeatedly spammed to the server. The
queue caps at 100 results; it never silently discards them. Imported save files do
not transfer leaderboard identity or its auth session. Native builds keep identity
and queue in Capacitor Preferences. Secrets are never exported with game saves.

## Expected costs and release limits

A small family test can often fit Supabase's **Free ($0)** plan within its current
quotas. This code does not purchase a plan or enable paid add-ons. Check current
pricing at https://supabase.com/pricing and your project's limits before choosing
production hosting. Costs depend on database/compute, storage, anonymous Auth
usage, Edge Function invocations and egress. Free projects can have availability
or inactivity limits; a paid plan may be appropriate for a commercial release.
No fixed production quote is implied here. Add usage alerts and review abuse
limits before public launch; rate limiting reduces, but cannot eliminate, costs.

The static frontend can continue using GitHub Pages. No API secret is needed by
Pages. Changing public configuration on this branch does not publish the game;
merging/releasing and enabling a production origin remain separate decisions.
