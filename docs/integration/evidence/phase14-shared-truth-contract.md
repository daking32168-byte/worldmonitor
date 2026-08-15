# Phase 14 Shared Truth Contract Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** COMPLETE — HOSTED FULL DATA GATES PASS
**Implementation commit:** `1a58948d7c84be9b758b555d13f272c89babea34`

## Implemented Scope

- Runtime-neutral Global Intelligence V2 contract with the 18 required
  `EvidenceClass` values and 13 `AggregationLevel` values.
- Coverage, license, freshness, quality and the nine canonical UI data states.
- `SourceEvidence` with traceable URL/reference, explicit-null reasons,
  timestamps, confidence and methodology validation.
- Stable opaque entity IDs with the 16 approved prefixes and explicit legacy
  aliases.
- Unified Provider response envelope, conflict retention and no-empty-success
  validation.
- Aggregation compatibility validation that rejects country evidence for town
  results.
- Fact-table guard that rejects modelled, AI, social and unverified evidence.
- Additive Market, Maritime and China Factory compatibility mappings; existing
  routes, protos, generated clients and response shapes are unchanged.
- Provider Operations truth profiles and canonical visible UI status mapping;
  readiness remains a separate execution control and no secrets are exposed.

## Changed Runtime Paths

```text
shared/global-intelligence-contract.ts
shared/global-intelligence-compatibility.ts
src/services/global-intelligence-status.ts
src/services/provider-operations.ts
src/features/provider-operations/provider-operations.ts
src/features/provider-operations/provider-operations.css
```

The focused contract is in `tests/global-intelligence-contract.test.mts`.
`AGENTS.md` and `docs/generated/stats.json` change only the generated service
module count from 233 to 234.

## Passing Gates

| Gate | Result |
|---|---|
| New Phase 14 contract suite | PASS — 10 tests |
| Existing Provider Operations suite | PASS — 5 tests |
| Market, Maritime and China Factory suites | PASS — 13 tests |
| Production TypeScript | PASS — `tsc --noEmit` |
| API TypeScript and Convex string audit | PASS |
| sebuf API contract | PASS — 149 API files, 114 manifest entries, 96 query parameters |
| DOM suite | PASS — 31 files, 293 tests |
| Source attribution | PASS — 533 active hosts |
| Documentation statistics | PASS — 150 claims |
| Product facts | PASS |
| Strict Vite environment-secret scan | PASS |
| Production Vite build | PASS — 2,508 modules, build 25.80 seconds |
| Changed-file Biome lint | PASS — 7 files, no fixes |
| Candidate cached diff | PASS — 9 implementation paths, 0 outside scope |

No Provider, account, credential, entitlement, live data, database, migration,
remote, Draft PR, deployment or release changed.

## Full Data Gate Blocker

The repository-wide `test:data` command is not green in the available native
Windows environment. Three increasingly equivalent runs were retained:

| Environment | Total | Pass | Fail | Skip |
|---|---:|---:|---:|---:|
| Active CRLF/non-ASCII worktree | 22,671 | 22,510 | 148 | 13 |
| Detached ASCII-path/LF worktree | 22,580 | 22,473 | 94 | 13 |
| ASCII/LF plus Node/project bins in PATH | 22,580 | 22,485 | 82 | 13 |

No failing test belongs to the Phase 14 contract, Provider Operations, Market,
Maritime or China Factory focused suites. Representative remaining failures
show native-Windows infrastructure assumptions outside Phase 14:

- tests resolve source paths as `D:\\D:\\...` from file URL pathnames;
- a product-freshness test hard-spawns `npm run product:facts`, but the bundled
  runtime has no npm executable;
- workflow, hook, bootstrap and shell tests require the Linux/CI toolchain or
  repository control-plane state absent from this local environment.

The detached verifier is retained at `D:\wm-gi-v2-lf`, clean at
`1a58948d7c84be9b758b555d13f272c89babea34`. Windows has the WSL launcher but no
installed Linux distribution; Docker and Bash are unavailable. Installing a
system runtime was not authorized.

## Hosted Closure Receipt

The native-Windows results above remain a useful portability diagnosis but no
longer block the phase. Stacked Draft PR #2 head
`a23d9af9a84f78aae43ffd1462619da42e8adffb` completed GitHub Actions Test run
`31868040572` with:

- authoritative Ubuntu `unit`: 23,038 tests, 23,032 pass, 0 fail, 6 skip;
- native `macos-14` clean-source data gate: 22,880 tests, 22,874 pass, 0 fail,
  6 skip;
- checksum-verified Node sidecar preparation and unsigned ARM64 Tauri release
  profile build;
- generated desktop inputs clean after the build; and
- all 14 Test jobs plus the four other Run 12 workflows successful.

The job was read-only, secret-free and artifact-free. It did not sign,
notarize, package, release, deploy or activate a Provider. Phase 14 is complete
and Phase 15 may start; the exact cross-platform workflow and Git transport
receipt is retained in `phase14-cross-platform-environment.md`.
