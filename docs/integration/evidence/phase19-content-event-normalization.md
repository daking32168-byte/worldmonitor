# Phase 19 Content and Event Normalization Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** COMPLETE — LOCAL AND HOSTED CROSS-PLATFORM GATES PASS
**Implementation:** `a663e5c48e5bfc50534786e4d62fbaebc6d39784`

## Delivered Scope

- Runtime-neutral `ContentProvider` and `SocialProvider` interfaces.
- News, X and Bilibili adapter skeletons with explicit disabled policies.
- `SourceItem` preserving platform ID, canonical URL, author, publication and
  retrieval time, language, body fingerprint, licence and evidence status.
- Deterministic language, dictionary-based entity/location extraction and
  three-key de-duplication.
- Event candidates with original-source timelines and separate social,
  publisher and official-confirmation states.
- A bounded service/sidecar execution contract with minute budget,
  exponential retry and injected sleep.
- Disabled X and Bilibili entries in the owned Provider Operations surface.

## Admission and Licence Boundary

The only supported transports are `PROVIDER_API` and `LICENSED_FILE`. HTML or
page scraping is not a transport and there is no fallback path. Each Provider
policy separately records ingest, display and export permission. Records are
rejected before normalization when licence admission or ingest permission is
absent.

All three production skeletons are `NOT_CONFIGURED`, allow zero requests per
minute, register no executor and throw before sending a request. X and
Bilibili observations default to `SOCIAL_SIGNAL`; they become official only
when the record itself carries explicit official authority.

The shared request contains only a boolean credential-presence fact. It does
not contain a key, token, cookie or secret name, and browser production entry
code contains no X/Bilibili credential.

## Identity and De-duplication

Normalization removes tracking query parameters while retaining the canonical
source URL and original platform ID. It computes a deterministic normalized
content fingerprint and de-duplicates by:

1. platform plus platform item ID;
2. canonical URL; and
3. content fingerprint plus author identity.

An independent author may corroborate or propagate the same content, but a
same-author repost is not counted again. Event timelines retain every admitted
unique item's platform ID, canonical URL, publication time and confirmation
status.

## Acceptance Receipts

| Gate | Result |
|---|---|
| Three Provider skeletons | PASS — NEWS, X and BILIBILI exist and are disabled |
| Original provenance | PASS — platform ID, canonical URL, author and both timestamps retained |
| No scrape fallback | PASS — unsupported transport rejected; disabled Provider sends no request |
| Licence/rate/retry | PASS — policy admission, minute budget and bounded exponential retry covered |
| Language/entity/location | PASS — deterministic extraction covered |
| De-duplication | PASS — platform ID, URL and same-content/author paths covered |
| Official-state boundary | PASS — social records stay `SOCIAL_SIGNAL` without explicit official authority |
| Browser-secret boundary | PASS — production entry contains no X/Bilibili secret name |
| Phase 19 focused contract | PASS — 9/9 |
| Combined Phase 14–20 regression | PASS — 72/72 |
| TypeScript, Biome and secret scan | PASS |
| Production build | PASS — shared with Phase 20; 2,525 modules in 23.04 seconds |

## Hosted Closure Receipt

Draft PR #2 Run 15 at the Phase 17 head had one unrelated Ubuntu timing-test
failure while native macOS and every other top-level workflow passed. Run 16
at the Phase 18 head had a different unrelated native-macOS timing-test
failure while Ubuntu and every other top-level workflow passed. Neither is a
zero-exit cross-platform receipt. No waiver was applied. Final descendant Run
19 at `8ddd9cc1...` passed all five workflows, Ubuntu 23,088/23,082/0/6 and
native macOS 22,930/22,924/0/6, plus the optimized unsigned Tauri build and
clean-input gate. This closes Phase 19.

No Provider activation, credential, page scrape, production import, merge,
deployment, release, signing or notarization occurred.
