# Module Design

## Expected File Contract

The worker team should preserve this module layout:

- `src/domain/models.ts`
- `src/data/seed.ts`
- `src/data/validation.ts`
- `src/algorithms/top-k.ts`
- `src/algorithms/trie.ts`
- `src/algorithms/inverted-index.ts`
- `src/algorithms/fuzzy.ts`
- `src/algorithms/graph.ts`
- `src/algorithms/multi-route.ts`
- `src/algorithms/compression.ts`
- `src/services/**`
- `src/server/index.ts`
- `public/**`
- `scripts/validate-data.ts`
- `scripts/run-benchmarks.ts`
- `scripts/demo.ts`
- `tests/**`

## Module Responsibilities

### Domain and Data

- `src/domain/models.ts` centralizes shared types and invariants.
- `src/data/seed.ts` exposes deterministic seed fixtures or loaders.
- `src/data/validation.ts` exports reusable validators and a command-friendly validation entry.

### Algorithms

- `top-k.ts`: bounded ranking and top-k extraction.
- `trie.ts`: prefix-oriented lookup and exact title support where useful.
- `inverted-index.ts`: token indexing, lookup, update, and delete support.
- `fuzzy.ts`: tolerant search helpers for food and content.
- `graph.ts`: shortest-path primitives and network-distance helpers.
- `multi-route.ts`: multi-destination route planning.
- `compression.ts`: compress and restore journal payloads.

### Services

`src/services/**` should wrap algorithm modules with domain-aware use cases. Suggested service groups:

- `recommendation-service`
- `search-service`
- `routing-service`
- `facility-service`
- `journal-service`
- `food-service`
- `aigc-service`

### Server and Public Assets

- `src/server/index.ts` should expose a lightweight HTTP surface without external frameworks.
- `public/**` should contain the demo HTML, CSS, client-side JavaScript, static media, and scenario fixtures.

### Scripts and Tests

- `scripts/validate-data.ts` should fail fast on broken counts or invalid records.
- `scripts/run-benchmarks.ts` should compare algorithm behavior on repeatable fixtures.
- `scripts/demo.ts` should drive a scripted end-to-end showcase.
- `tests/**` should include unit tests for algorithms plus higher-level scenario tests.

## Dependency Rules

- Services may depend on domain and algorithms.
- Server and scripts may depend on services.
- Algorithms should not depend on services or server code.
- Tests may depend on any public module contract.
