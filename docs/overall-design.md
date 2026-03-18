# Overall Design

## Architecture Summary

The project is designed as a single TypeScript codebase with custom algorithm modules, service orchestration, a lightweight server, static demo assets, and scriptable validation or benchmark commands.

## Layered Design

### Domain Layer

- `src/domain/models.ts` defines the shared entities and value objects.
- `src/data/seed.ts` provides loadable seed data.
- `src/data/validation.ts` enforces scale and integrity constraints.

### Algorithm Layer

- `src/algorithms/top-k.ts` handles efficient ranking for recommendation and food discovery.
- `src/algorithms/trie.ts` supports prefix-oriented lookup.
- `src/algorithms/inverted-index.ts` supports keyword and full-text retrieval.
- `src/algorithms/fuzzy.ts` handles tolerant food and content matching.
- `src/algorithms/graph.ts` handles shortest-path graph operations.
- `src/algorithms/multi-route.ts` handles multi-stop route planning.
- `src/algorithms/compression.ts` handles lossless content compression.

### Service Layer

`src/services/**` coordinates domain data with algorithm modules. Expected service groups include:

- Recommendation services
- Search services
- Routing services
- Facility lookup services
- Journal services
- Food services
- AIGC orchestration services

### Delivery Layer

- `src/server/index.ts` serves the web or API demo.
- `public/**` contains browser-facing assets and scenario data.
- `scripts/validate-data.ts`, `scripts/run-benchmarks.ts`, and `scripts/demo.ts` provide repeatable CLI entrypoints.
- `tests/**` contains unit, integration, and smoke tests.

## Data Flow

1. Seed data loads through `src/data/seed.ts`.
2. Validation confirms data shape, counts, and graph integrity.
3. Services build or consume indexes and graph structures from the validated dataset.
4. The server and demo scripts expose the service outputs for browser and CLI use.
5. Tests and benchmarks exercise the same service and algorithm contracts.

## Design Decisions

- Use JSON-compatible data and plain TypeScript modules to avoid external dependencies.
- Keep algorithm modules independent so benchmarks and tests can target them directly.
- Use a single compile target in `dist/` to keep commands predictable.
- Keep demo and server entrypoints thin so the core logic remains testable in isolation.
