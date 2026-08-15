# Global Intelligence V2 Architecture Baseline

**Status:** Phase 13 complete
**Date:** 2026-08-14
**Controlling specification:**
`GLOBAL_INTELLIGENCE_V2_CODEX_EXECUTION_PLAN_2026-08-14.md`
**Specification SHA-256:**
`975F72D8BA5CA18ACAD8A8BF1F4B68679B67E9B30A44EE573C8BE82D796FB961`

## Baseline and Change Boundary

- Formal repository: `daking32168-byte/worldmonitor`.
- Accepted functional head: `c730fc6a2c4a6c390b305ce19cb04b1fa805c43e`.
- Phase 13 parent: `integration/pokieticker-maritime-china-factory` at
  `cc5d8bfd81a8320f0940dee91e39572b13a47c2e`.
- Phase 13 branch: `integration/global-intelligence-v2`.
- Existing Draft PR #1, protected `main`, and existing worktrees are outside
  this branch's mutation boundary.
- Phase 13 changes integration documentation plus three repository audit
  utilities and their focused tests so source, frontmatter, and generated-text
  checks are platform-stable on Windows. It does not change product runtime
  source, a Provider, a route, runtime configuration, persisted data, or a
  deployment.

## Architecture Shape

Global Intelligence V2 remains part of the existing WorldMonitor product:

```text
Authorized sources
  -> adapters, licence gates, validation, provenance, dedupe, resolution
  -> evidence-bound domain records and model-output records
  -> generated RPC/REST, same-origin streams, jobs, cache, search and alerts
  -> existing dashboard routes, map, market workspace and Tauri desktop shell
```

The repository dependency direction remains:

```text
types -> config -> services -> components -> app -> App.ts
```

The detailed decisions are:

- [D-0041: domain boundaries](adr/0041-domain-boundaries.md)
- [D-0042: evidence model](adr/0042-evidence-model.md)
- [D-0043: stable entity IDs](adr/0043-stable-entity-ids.md)
- [D-0044: Provider licensing](adr/0044-provider-licensing.md)
- [D-0045: storage strategy](adr/0045-storage-strategy.md)

## Shared Contracts Before Domain Features

Phase 14 is the only owner of the shared vocabulary for:

- `EvidenceClass`, `AggregationLevel`, freshness, quality, license and
  presentation status;
- `SourceEvidence`, conflicts, explicit null reasons and source references;
- stable entity IDs and Provider-native identity aliases;
- the unified response envelope and no-empty-success rule; and
- compatibility mappings for existing Market, Maritime and China Factory
  surfaces.

Phase 15+ domains reuse those contracts. They may extend domain-specific types
but cannot create alternate evidence, identity, or Provider-state systems.

## Domain Sequence

```text
Phase 13 baseline and architecture
  -> Phase 14 shared evidence, identity and Provider envelope
  -> Phase 15-18 industry, company, trade, logistics and seed domains
  -> Phase 19-20 source items, events, trends and burst detection
  -> Phase 21 global exchanges and securities
  -> Phase 22 predictions and evaluation
  -> Phase 23 impact graph
  -> Phase 24 watchlists and desktop alerts
  -> Phase 25 end-to-end acceptance and release preparation
```

No downstream phase may bypass a failed upstream gate. Provider-backed visual
acceptance is required only where a lawful, owner-provisioned account and rights
exist; missing credentials produce tested unavailable states.

## Reuse and Implementation Entry Points

The Phase 13 inventory in
`PHASE13_REUSABLE_COMPONENT_INVENTORY.md` identifies reusable map, search,
status, SSE, Provider operations, market, and desktop components. New work must
extend those entry points and their tests instead of cloning them.

## Storage and Runtime Boundaries

- Redis remains bounded cache/coordination, never canonical identity.
- Existing durable application storage is reused only where schema, retention,
  rights, access, and scale fit.
- Canonical facts, source evidence, model output, cache, large artifacts,
  client state, and fixtures remain logically separate.
- A new database, graph engine, or search service requires a later measured ADR;
  Phase 13 selects none.
- Browser streams remain same-origin; private Provider transport stays on the
  server/relay/sidecar boundary.
- Secrets never enter client environment, Git, evidence, screenshots, or
  license records.

## Phase 13 Definition of Done

- The dedicated branch and clean linked worktree exist at the documented base.
- The controlling specification is stored byte-for-byte in `docs/integration/`.
- Five ADRs and the reusable-component inventory are reviewable.
- Path, ref, remote, ancestor, worktree, and Draft PR evidence is retained.
- Markdown, docs stats, source attribution, product facts, and diff checks pass.
- The final diff contains integration documentation, one plan-specific Git
  whitespace attribute, and narrowly scoped audit tooling/tests only; it
  contains no product runtime code or behavior change.
