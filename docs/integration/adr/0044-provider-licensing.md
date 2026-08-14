# D-0044: Gate Provider Use by Reviewed Rights and Fail Closed

- **Status:** Accepted
- **Date:** 2026-08-14
- **Phase:** 13

## Context

Authentication proves that a request can be made; it does not prove display,
redistribution, export, caching, or real-time labelling rights. The project also
contains public, official, user-authorized, commercial, delayed, historical,
and terms-review sources with different restrictions.

## Decision

Maintain a non-secret license registry for every Provider with at least:

```text
provider_id
terms_url
license_status
allowed_use
display_rights
redistribution_rights
retention_policy
cache_ttl
export_allowed
user_authorization_required
reviewed_at
reviewer
```

Runtime capabilities evaluate the specific right needed for the action. A
source may be usable for internal analysis while display, export, or
redistribution remains disabled. Unknown, missing, expired, or unreviewed
rights fail closed and produce an explicit status; they do not fall back to a
less restricted label.

Secrets, tokens, cookies, authorization headers, payment details, and protected
payloads are never stored in the license registry or evidence logs. Provider
Operations may expose only non-sensitive presence, validity, entitlement,
review, last-attempt, last-success, and error-category state.

## Capability Gates

| Capability | Minimum gate |
|---|---|
| Fetch/ingest | Authorized access and allowed use |
| Display | Display right for the actual fields and audience |
| `REALTIME_VERIFIED` label | Display right plus verified real-time path and timing |
| Cache/retain | Retention policy and TTL permit the stored form |
| Export | Explicit export right for the requested fields |
| Redistribute/relay | Explicit redistribution right and server-side transport |

## Consequences

- Phase 14 extends the existing Provider Operations contract and shared
  response envelope with reviewed license state.
- Later ingestion work may ship disabled adapters and tests without a secret;
  it may not invent observations or use unauthorized sessions.
- License review remains an owner/legal activity and is not inferred from a
  passing source registry or CI check.
