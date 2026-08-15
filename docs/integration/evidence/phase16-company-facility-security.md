# Phase 16 Company, Facility, Brand and Security Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** CANDIDATE — LOCAL GATES PASS, HOSTED RUN PENDING
**Implementation commit:** `fea9e555b40d8bd312454c4d47b986a9b6e48b1c`

## Implemented Scope

- Runtime-neutral `Company`, `Facility`, `Brand` and `Security` entities.
- Stable company identity from ISO registration country plus registration
  number; stable security identity from MIC plus local ticker.
- Explicit sourced relationship edges for headquarters, ownership, operation,
  production, brand, listing and industry-cluster relationships.
- Company/facility search and detail routes under the existing lazy
  `/industry-map` workspace.
- A second `COMPANY_FACILITY` map mode with truthful empty-state counts and
  coverage-rate boundary.
- Verified-entity coverage sections on location and cluster details.
- A stock-workspace relationship panel that requires a unique reviewed
  Security or an explicit MIC and otherwise returns `SOURCE_REQUIRED` or
  `MIC_REQUIRED`.
- Operator-only company, facility, brand and security CSV templates plus a
  fail-closed validator.

## Production Fact Boundary

The repository has stock symbols, company display names and office-location
configuration, but those values do not establish a legal registration
identity, production facility, ISO 10383 market identity or sourced industry
relationship. Phase 16 therefore promotes none of them.

The production registry starts at:

```text
companies = 0
facilities = 0
brands = 0
securities = 0
relationships = 0
evidence = 0
```

This is a functioning fail-closed registry, not a claim that no companies or
facilities exist. Phase 18 source review can add records through the enforced
contract. Test-only positive examples are created inside the contract test and
are not imported by production code.

Every production entity requires at least one valid fact-capable
`SourceEvidence`. Every relationship encoded by an entity field also requires
its own sourced edge. An identity source therefore cannot silently prove a
headquarters, factory, brand, parent, security or industry relationship.

## Identity and Coverage Boundary

Display names are never keys. Two companies with the same canonical name but
different registrations produce different IDs. A security key includes both
MIC and local ticker; when one ticker has multiple MIC candidates, the stock
resolver returns `MIC_REQUIRED` until a market is selected.

Company headquarters use `headquarters_geo_id`; a facility is a separate
entity with a type and `geo_id`. Production-base UI is derived only from the
three manufacturing/assembly/processing facility types. An enterprise record
does not imply a production location.

Location and cluster panels display verified company/facility counts, highest
available coverage tier, source count and last verification time. Because no
reviewed total-population denominator exists, `coverage_rate` is `null`, the
status is `DENOMINATOR_UNAVAILABLE`, and `complete` is false. The UI contains
no unsupported completeness claim.

## Acceptance Receipts

| Gate | Result |
|---|---|
| Phase 16 focused contract | PASS — 8/8 |
| Phase 14–16 plus China Factory regression | PASS — 28/28 |
| Same-name company isolation | PASS — registration identities remain distinct |
| Same-ticker market isolation | PASS — XNAS and XNYS produce separate IDs; ambiguous lookup returns `MIC_REQUIRED` |
| Unsourced fact/edge rejection | PASS — both entity and relationship negative tests reject promotion |
| Operator CSV templates | PASS — four files; reviewed rows require stable source ID, HTTPS source and verification time |
| Production TypeScript | PASS — `tsc --noEmit` |
| Changed-file Biome | PASS — 11 files, no fixes |
| Strict local Vite secret scan | PASS |
| Production Vite build | PASS — 2,514 modules; 21.65 seconds |
| Production bundle isolation | PASS — no template example, test fixture path or prohibited completeness copy in `dist` |

## Browser Receipt

The local Vite application was inspected through the in-app browser:

| Route / viewport | Result |
|---|---|
| `/industry-map?mode=companies`, 1440 x 900 | Active enterprise/facility mode; four zero fact counts; no horizontal overflow |
| Huidong location detail, 1440 x 900 | Verified company/facility counts are zero; coverage rate explicitly unavailable; scroll panes retain independent overflow |
| `/industry-map?mode=companies`, 390 x 844 | document/body width 390/390; no horizontal overflow; empty state readable |
| `/stocks/AAPL`, 1440 x 900 | Relationship panel displays `SOURCE_REQUIRED`; the stock result is not promoted to an entity or facility fact |

No Phase 16 browser error occurred. The known Vite-development PWA MIME warning
remained the only console warning; the production build generated its service
worker successfully. Local feed fetch failures during the stock-page dev check
were fail-closed network responses and did not populate the Phase 16 registry.

## Remote Closure Condition

Phase 16 becomes complete only after this implementation and evidence receipt
are published by ordinary non-force fast-forward to stacked Draft PR #2 and
the authoritative Ubuntu plus native macOS gates return zero. No merge,
deployment, release, signing, notarization, Provider activation or data
promotion is authorized by this candidate.
