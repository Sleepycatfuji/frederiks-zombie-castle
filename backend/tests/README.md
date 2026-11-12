# Disposable backend integration tests

These scripts are for a disposable local Docker PostgreSQL database only. The
runner resets the `leaderboard_private` schema in that container. Never point it
at a production database/container. No external ports are published:

```sh
docker run --rm -d --name zcd-leaderboard-test -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
# Wait until docker exec zcd-leaderboard-test pg_isready -U postgres succeeds.
python3 backend/tests/run-postgres.py
python3 backend/tests/browser-shared.py
docker stop zcd-leaderboard-test
```

Python Playwright/Chromium is required for the browser script. The first script
tests the real schema/RPC, score calculation, difficulty isolation, top-10 paging,
private-table permissions, ownership, idempotency, invalid metrics and rate limits.
The second uses two isolated Chromium browser contexts with separate device
identities and kingdom storage. A loopback test gateway emulates anonymous Auth
and passes summaries to the real PostgreSQL RPC. Both clients see each other's
scores and retain independent coins. It tests the integration contract without
claiming a hosted Supabase deployment or physical-device test.
