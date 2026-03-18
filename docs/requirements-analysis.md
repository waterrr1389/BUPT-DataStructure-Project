# Requirements Analysis

## Functional Requirements

### FR-1 Data and Validation

- Define stable domain models for destinations, campuses, buildings, roads, facilities, users, journals, food items, and media assets.
- Load seed data from project-owned sources.
- Reject incomplete or inconsistent records during validation.

### FR-2 Recommendation and Search

- Recommend destinations based on popularity, rating, and user interests.
- Support search by name, category, and keyword.
- Return top-k results efficiently for short ranked lists.

### FR-3 Routing and Facility Lookup

- Compute single-target shortest routes.
- Compute multi-stop closed routes with transport constraints.
- Find nearby facilities by network distance, not by straight-line distance.

### FR-4 Journals and Journal Exchange

- Support journal creation, browsing, rating, and recommendation.
- Support exact title lookup and full-text search across journal content.
- Support lossless compression and decompression of journal data.
- Support an AIGC pipeline that can generate a demonstrable artifact or report an explained failure.

### FR-5 Food Discovery

- Recommend food items by popularity, rating, distance, and category.
- Support fuzzy search across food names, vendors, and cuisine labels.

### FR-6 Demo and Delivery

- Expose a browser-facing demo or equivalent web surface.
- Provide script entrypoints for validation, benchmarks, tests, and guided demo playback.
- Provide course-delivery documents and example runs.

## Non-Functional Requirements

- Zero external npm dependencies.
- TypeScript compiled to `dist/` with global `tsc`.
- Deterministic command entrypoints defined in `package.json`.
- Readable module boundaries so multiple workers can implement in parallel.
- Test-first or test-driven development for algorithmic modules where practical.

## Data Scale Requirements

- Destinations or campuses: at least 200.
- Buildings: at least 20.
- Facility categories: at least 10.
- Facility instances: at least 50.
- Graph edges: at least 200.
- Sample users: at least 10.

## Risks and Assumptions

- Real-world map data may require manual cleanup before it can satisfy graph-quality constraints.
- AIGC output quality is not a hard acceptance target; reproducible generation flow is the target.
- Because no external type packages are allowed, Node-specific typing may require local shims in worker-owned areas.
