# Task Description

## Project Goal

Build a personalized travel system for a course-design setting. The system should support the full trip lifecycle:

- Before travel: destination recommendation and search.
- During travel: route planning and nearby facility lookup.
- After travel: journal creation, journal exchange, search, compression, and media-based AIGC output.
- Around the trip: food recommendation and demo delivery.

## Mandatory Scope

The final deliverable must satisfy all of the following:

- Maintain a dataset large enough for course acceptance: at least 200 destinations or campuses, 20 buildings, 10 facility categories, 50 facility instances, 200 edges, and 10 users.
- Implement core algorithms in project code rather than delegating ranking, search, routing, or compression to database-native features.
- Provide a runnable demo surface through `src/server/index.ts`, `public/`, and the command scripts in `scripts/`.
- Provide automated verification under `tests/` plus course documents under `docs/`.

## Implementation Boundary

Round 0 only establishes the planning anchor, build metadata, and delivery docs. Product code is expected later in these paths:

- `src/domain/models.ts`
- `src/data/seed.ts`
- `src/data/validation.ts`
- `src/algorithms/*.ts`
- `src/services/**`
- `src/server/index.ts`
- `public/**`
- `scripts/*.ts`
- `tests/**`

## Success Definition

The project is successful when a reviewer can load the dataset, validate scale and integrity, run automated tests, launch the demo, and observe all main feature areas through predictable commands and documented scenarios.
