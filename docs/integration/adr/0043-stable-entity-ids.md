# D-0043: Use Opaque Stable IDs and Source Identity Mappings

- **Status:** Accepted
- **Date:** 2026-08-14
- **Phase:** 13

## Context

Names, URLs, coordinates, tickers, platform handles, and Provider record IDs can
change or collide. A ticker is not globally unique across exchanges, a company
may own many brands and facilities, and multiple source records may resolve to
one canonical entity.

## Decision

Every canonical entity receives an opaque internal ID generated once and kept
stable for its lifetime. IDs use a lowercase type prefix followed by a
repository-owned opaque identifier, for example:

```text
geo_
cluster_
product_
company_
facility_
brand_
security_
exchange_
node_
event_
item_
flow_
shipment_
route_
pred_
source_
```

The suffix format will be implemented centrally in Phase 14. It must be safe to
generate without embedding a mutable name, URL, ticker, coordinate, or secret.
Import idempotency comes from a persistent source identity mapping keyed by
Provider, source namespace/type, and native source ID, not by regenerating a
canonical ID from mutable display fields.

Aliases and entity-resolution decisions are versioned relationships. A merge
retains both original IDs and creates an auditable redirect/supersession record;
it does not silently reuse or delete identity. A split creates new canonical
IDs and preserves the resolution history.

## Required Uniqueness Rules

- A security identity includes its exchange/MIC context; identical ticker text
  on different exchanges remains distinct.
- A facility is not inferred from a company headquarters or mailing address.
- A brand is related to, but is not the same identifier as, its company owner.
- A location label or coordinate is an attribute or source alias, never the
  canonical geo ID.
- Provider-native IDs are aliases scoped to that Provider and dataset.

## Consequences

- Phase 14 owns the ID generator, parsers, prefix registry, source-identity map,
  and validation tests.
- Later domains reference stable IDs and cannot introduce name/ticker-keyed
  primary records.
- Public URLs may use stable IDs while retaining human-readable labels as
  optional, non-authoritative slugs.
