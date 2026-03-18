# Example Results and Tests

## Command Matrix

The repository command surface is fixed as:

- `npm run build`
- `npm run test`
- `npm run validate:data`
- `npm run benchmark`
- `npm run start`
- `npm run demo`

## Expected Test Coverage

### Unit Tests

- `tests/algorithms/**` should verify top-k ranking, trie lookup, inverted-index retrieval, fuzzy matching, shortest path, multi-route behavior, and compression round trips.

### Service Tests

- `tests/services/**` should verify recommendation ordering, search filters, route constraints, facility lookup ordering, journal recommendation, and food discovery.

### Smoke Tests

- `tests/integration/**` should exercise the compiled server or demo surface with deterministic seed data.

## Example Result Expectations

### Data Validation

- The validation command should print counts for destinations, buildings, facilities, edges, and users.
- The command should exit non-zero if any minimum count or integrity rule fails.

### Recommendation and Search

- A user profile with interest tags should return a stable ordered list of destinations.
- Empty or invalid ranking options should be rejected.

### Routing and Facility Lookup

- A valid start and goal should return node sequence, total distance, and transport mode summary.
- Facility lookup should return facilities ordered by network distance within the requested radius.

### Journals, Compression, and AIGC

- Journal search should show matching titles or keyword hits.
- Compression tests should prove that decompression restores the original payload exactly.
- AIGC tests should use a mock generator and verify success and missing-input paths.

### Demo Surface

- The demo should expose at least one scripted scenario for recommendation, routing, facility lookup, journal browsing, journal search, and food discovery.

## Benchmark Expectations

- `scripts/run-benchmarks.ts` should report timing or operation counts for top-k, search, graph, and compression modules.
- Benchmarks should use repeatable input sizes and avoid network access.
