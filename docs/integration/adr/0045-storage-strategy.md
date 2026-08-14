# D-0045: Separate Durable Facts, Evidence, Models, Cache, Fixtures, and Client State

- **Status:** Accepted
- **Date:** 2026-08-14
- **Phase:** 13

## Context

The repository already uses several storage mechanisms: Upstash Redis and
shared cache contracts, Convex for account and durable application records,
client persistence for layout/preferences and offline resilience, plus R2/KV
helpers for bounded artifacts. The execution plan requires a storage strategy
but does not select a new database or authorize a migration.

## Decision

Define storage by record responsibility before choosing or changing a physical
backend:

| Logical store | Contents | Required boundary |
|---|---|---|
| Source evidence | Source metadata, scope, time, license and methodology references | Append-oriented, auditable, retained according to source rights |
| Canonical facts | Stable entities, validated observations, and typed relationships | No model or fixture writes; conflict history retained |
| Model outputs | Routes, flows, impacts, predictions, evaluations | Separate namespace/table and explicit model/version/cutoff/expiry |
| Cache and stream state | Provider responses, hydration, leases, locks, cursors, SSE state | TTL and full result-varying key; never authoritative identity |
| Large permitted artifacts | Reviewed imports, exports, snapshots, generated evidence | Content hash, provenance, retention and export permission |
| Client state | Layout, preferences, local watch state, last safe view | Not a shared fact database or source of Provider truth |
| Test fixtures | Deterministic test-only inputs | Excluded from production ingestion, bundles, and fallback paths |

Reuse Redis for bounded cache, locks, rate limits, idempotency windows, and
stream coordination. Reuse existing durable application storage where its
schema, retention, access, and volume fit. Any decision to add PostgreSQL,
another database, a search engine, or a graph store requires a later ADR with
measured need, migration, rollback, operations, cost, and license impact.

Cache keys include every result-varying dimension, including Provider, entity
type and stable ID, market or geography, interval/range, currency, language,
license tier, and evidence/model class where applicable. Delayed observations,
real-time observations, model output, facts, and test fixtures never share a
cache namespace.

## Consequences

- Phase 13 introduces no database, migration, production record, secret, or
  infrastructure resource.
- Phase 14 may add storage interfaces and validators while keeping physical
  persistence behind existing runtime boundaries.
- Domain phases must document retention, export, deletion, and idempotency for
  each new record type before enabling Provider-backed ingestion.
