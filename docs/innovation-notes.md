# Innovation Notes

## Candidate Innovation Points

### Unified Campus and Scenic Routing Model

Use one shared graph representation for campus and scenic-area navigation while preserving scene labels and transport constraints. This keeps the algorithm layer reusable and makes comparison demos easier.

### Journal Exchange with Compression and AIGC Output

Treat journals as both searchable records and media-generation inputs. Combining exact lookup, full-text search, lossless compression, and a mockable AIGC pipeline creates a stronger post-trip workflow than a basic diary feature.

### Zero-Dependency Teaching Build

A zero-dependency TypeScript implementation makes the project easier to inspect in a course review because all core logic, scripts, and data structures remain in-repo rather than hidden behind libraries.

## Evidence to Collect Later

- Benchmark results that show custom top-k, indexing, routing, and compression behavior.
- Demo recordings or screenshots that show the end-to-end flow.
- Test outputs proving journal search, compression round trips, and route constraints.

## Boundaries

- Innovation claims should stay tied to implemented behavior, not to aspirational UI polish.
- If AIGC output is mocked for the course demo, the documentation should state that clearly.
