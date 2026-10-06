# Vidhawk backend: cold-resolve stalls — fix brief for the backend owner

From the module side (Synthetiq Flux / `synthetiq-anime-direct`). This is the part that cannot be fixed
from a client: the provider's own latency and timeouts. All numbers below were measured directly
against `vidhawk.buzz` from this Mac, with the module's exact headers
(`Origin: https://vidhawk.buzz`, `Referer: /embed/ani/<id>/<ep>/<audio>`, Chrome UA).

## What we measured

| call | result |
|---|---|
| `GET /api/stream/resolve` with no params | **400 in 0.30 s** — service alive, params validated |
| `GET /api/play?t=<ticket>` | **200 in 0.09-0.15 s**, full payload (`tracks`, `captions`, `intro`, `outro`, `serverLabel`) — no issue |
| `GET /embed/ani/21/1/sub` | **200** — no issue |
| resolve, cold pair A (fresh episode) | **no response in 40 s** (twice in a row) |
| resolve, pair A a few minutes later | **0.29 s** |
| resolve, cold pair B | **19.9 s**, then **0.088 s** on the next attempt |
| resolve, cold pair C | **28.2 s**, then **0.13 s** next |
| resolve, cold pairs D and E | **0.54 s / 0.71 s** — fine |
| resolve with `server=flow`, two different pairs | **no response in 40 s** (0 bytes) |
| resolve with `server=flow`, another pair | **0.09 s** — so flow is not down, it stalls per request |
| `GET /api/stream/race`, fresh pair | **404 after 18.1 s** |
| `GET /api/stream/race`, warm pair | **200 in 12.3 s** (`{"winner":"flow","ticket":…}`) |
| `GET /api/anikage` browse + sources (rescue) | 200 in ~0.1 s — no issue |
| AniList GraphQL (catalogue) | 200 in 0.17 s — no issue |

## The pattern

The **first (cold) call for a given title/episode/audio** triggers upstream work that regularly exceeds
40 seconds and sometimes never answers at all. **The very next attempt for the same pair is typically
under 0.3 s.** So the work does complete server-side — the client just never gets told in time.

Secondary: `server=flow` stalls on individual requests (0 bytes, no status, >40 s) while other requests
to the same server answer in 0.09 s, and `/api/stream/race` 404'd once after 18 s on a pair whose
per-server resolve worked.

## What a client can and cannot do

- A **client cannot wait out a 40 s stall** — apps have per-call ceilings (~20-25 s here), and a
  spinner that long reads as "broken". The Flux module now retries once after its first round is
  capped (that recovers the 17-28 s cases, measured), but nothing client-side recovers a call that
  never answers.
- **Everything needed here lives on the backend.**

## Suggested backend changes

1. **Hard upstream timeout on resolve.** Cap the upstream fetch (e.g. 6-8 s). If it is not ready, answer
   immediately with a retryable state (503 + `{ "code": "WARMING", "retryAfterMs": 1500 }` or
   `CONTENT_UNAVAILABLE` when genuinely absent) instead of holding the connection. A fast, honest
   answer is strictly better for every client than a 40 s hang.
2. **Pre-warm on episode-list view** (or at least cache the in-flight upstream request so that
   concurrent/repeat calls join it instead of starting over). The observed "cold 28 s → warm 0.13 s"
   is exactly what a shared in-flight cache would collapse.
3. **Per-server health + timeouts.** `flow` should be marked unhealthy after N consecutive stalls and
   skipped briefly, or each server's upstream should carry its own short timeout so one stalled server
   cannot stall a whole resolve.
4. **Check the race endpoint's error path** — it should be the fast path (one call, both servers) and
   not return a 404 18 s later for content that per-server resolve can serve.
5. **Response contract worth keeping:** `{ "code": "CONTENT_UNAVAILABLE" }` / `available:false` on a
   404 is read as a real answer by the module and shown to users as "not available" — that is the
   behaviour to preserve.

## What the module does now (for context, already changed)

- Play path: **two resolve rounds** (`flow` + `zuri` asked in parallel each round, 9 s cap per round)
  inside a 19 s budget, instead of one 10 s round inside 11 s. The retry lands on the warmed result —
  measured: a pair that stalled 45 s resolved in 0.29 s on the retry, and a 19.9 s pair in 0.088 s.
- The AniKage rescue already runs **in parallel** with the Vidhawk chain and is halted the moment a
  verified Vidhawk route exists, so a provider outage costs one wait rather than two.
- Every play still ends with a **positive byte check** on the media before it is offered.
