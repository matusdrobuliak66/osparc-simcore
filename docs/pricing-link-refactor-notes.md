# Pricing-link refactor notes

## Scope

Simplify the web-server pricing call graph by sharing resolution, linking, and
resource-sizing logic. Keep copying semantics distinct: copied links retain the
source resources. Director-v2 pricing-link writes will be removed in a separate
PR; its sizing-calculation interface remains.

## Node-level consolidation

Creation and repair call `_ensure_node_pricing` through the best-effort
linking-and-sizing operation. Dynamic start calls the same resolver, checks wallet
credits, then sizes resources before scheduling. Pricing resolution returns the
link and full pricing unit, so default selection needs no second unit lookup.

Dynamic start now replaces an unknown link with the default, matching repair.
Copying and explicit pricing selection retain their separate paths.

Node pricing uses direct lookups without operation-scoped task sharing or caching.
Existing links are resolved by plan/unit IDs; defaults are resolved by service and
version. Both return the full pricing unit, including its hardware information.

## Deferred: computation-start preparation failures

The computation-start handler awaits pricing repair before forwarding start
requests.
Repair uses `_safe_link_pricing_unit_and_size_node`, which logs exceptions without
propagating them, and `limited_gather(..., reraise=False)` without checking results.
A per-node pricing or sizing failure therefore does not stop forwarding.

Agreed direction: keep creation best-effort, but block billed computation starts
when preparation fails. Add a regression test asserting an error response and no
director-v2 start calls. Preserve intentional sizing skips unless their policy is
explicitly changed. Implement this separately from call-graph simplification.

## Deferred: concurrent pricing selection

Automatic defaulting and repair must preserve a newer explicit selection, and the
persisted resources must match the resulting link. Missing-link insertion already
preserves an existing link; invalid-link replacement and separate sizing writes
need interleaving tests before claiming the same guarantee.
