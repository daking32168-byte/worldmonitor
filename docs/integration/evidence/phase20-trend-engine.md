# Phase 20 Cross-Platform Trend Engine Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** COMPLETE — LOCAL AND HOSTED CROSS-PLATFORM GATES PASS
**Implementation:** `a663e5c48e5bfc50534786e4d62fbaebc6d39784`

## Delivered Scope

- Versioned `TrendPoint` and `TrendSnapshot` contracts.
- Deterministic 15-minute, 1-hour, 6-hour and 24-hour windows.
- Configurable explainable scoring with saved component values and reasons.
- `NORMAL`, `EMERGING`, `ACCELERATING`, `BREAKOUT`, `COOLING` and `RESOLVED`
  state transitions.
- Cross-platform first-observation propagation path and observed delays.
- Owned lazy `/trends` overview and `/trends/:eventId` detail routes.
- Named SSE serialization plus an explicit, closable browser client contract.
- A disabled trend SSE operation in Provider Operations.

## Explainable Algorithm

`TREND_EXPLAINABLE_V1` scores unique content, independent authors, platform
diversity, velocity, positive acceleration and official confirmation. It
subtracts audience concentration. Count contributions use logarithmic
saturation, and input is de-duplicated before every window; repeated reposts
therefore cannot amplify heat linearly.

The score stores every weighted component, source counts, audience
concentration, large-account author count, velocity, acceleration, state,
algorithm version and transition reasons. A single large account and many
independent small authors produce observably different author, concentration
and heat values.

## Realtime and Production-Fixture Boundary

The SSE envelope provides `id`, named event, retry interval and a versioned
snapshot. The browser client connects only to an explicitly supplied endpoint,
accepts HTTPS or a loopback HTTP endpoint for controlled tests, validates the
snapshot shape and exposes connect/live/error/closed states.

The production Provider endpoint is `null`, fixture enablement is false and
the client returns `NOT_CONFIGURED` without constructing `EventSource`. The
production trend import graph contains no test or fixture import. Unknown
event detail IDs render `SOURCE_REQUIRED` rather than substituting a demo
event.

## Acceptance Receipts

| Gate | Result |
|---|---|
| Determinism | PASS — identical inputs and `as_of` produce deep-equal snapshots |
| Multiple windows | PASS — 15, 60, 360 and 1,440 minutes |
| Repost amplification | PASS — de-duplication plus logarithmic saturation |
| Account distinction | PASS — large-account count and audience concentration distinguish the cases |
| State-machine reasons | PASS — all six states and transition explanations covered |
| Propagation path | PASS — earliest observation per platform and delay retained |
| Realtime SSE | PASS — serializer, secure endpoint gate, no-op disabled path, close and payload validation covered |
| Production fixture isolation | PASS — endpoint null, fixture false, no production fixture import |
| Phase 20 focused contract | PASS — 9/9 |
| Phase 19 focused contract | PASS — 9/9 |
| Combined Phase 14–20 regression | PASS — 72/72 |
| Production TypeScript | PASS — `tsc --noEmit` |
| Changed-file Biome | PASS — 11 files, no fixes |
| Strict local Vite secret scan | PASS |
| Production Vite build | PASS — 2,525 modules in 23.04 seconds; lazy trends chunk emitted |

## Browser Receipt

| Route / viewport | Result |
|---|---|
| `/trends`, 1440 x 900 | Width 1440/1440; four windows and all six states visible; SSE `NOT_CONFIGURED`; no fixture/test script |
| `/trends/event_missing`, 390 x 844 | Width 390/390; mobile grid layout; `SOURCE_REQUIRED`; no unknown-ID fallback |

The in-app browser tab, temporary Vite server and viewport override were
cleaned after inspection. Dev-only upstream feed failures did not populate the
trend workspace.

## Hosted Closure Receipt

Run 19 at exact Draft PR #2 head
`8ddd9cc1eba76fe2632f23b01a158a111936a52b` passed Test, Typecheck, Lint,
Lint Code and Pro bundle freshness. Ubuntu reported 23,088 total / 23,082 pass
/ 0 fail / 6 skip. Native `macos-14-arm64` reported 22,930 total / 22,924 pass
/ 0 fail / 6 skip, built the optimized unsigned Tauri release profile in 1
minute 17 seconds and passed `git diff --exit-code`. This closes Phase 20 and
its Phase 17–19 dependencies.

No merge, deployment, release, signing, notarization, Provider activation or
production fixture occurred.
