# Data Structures and Dictionary

## Core Domain Records

`src/domain/models.ts` defines the data contracts used across the runtime:

- `Destination`: top-level scenic or campus destination with graph, buildings, facilities, and food venues.
- `DestinationNode`: graph node with coordinates, floor, kind, optional building binding, and keywords.
- `DestinationEdge`: graph edge with distance, congestion, road type, and allowed travel modes.
- `Building`: building metadata including entrance node, floor count, and tags.
- `FacilityCategoryDefinition`: facility taxonomy entry with label, summary, and keywords.
- `Facility`: nearby-service record with category, node binding, and opening hours.
- `FoodVenue`: food record with venue name, cuisine, rating, heat, price, node binding, and keywords.
- `WorldMapRecord`: optional world-level map with regions, destination placements, a world graph, and destination portals.
- `WorldRegionRecord`, `WorldDestinationPlacement`, `WorldNodeRecord`, `WorldEdgeRecord`, and `DestinationPortalRecord`: supporting records for world-mode browsing and cross-map routing.
- `UserProfile`: recommendation profile with interests, dietary preferences, and home destination.
- `JournalEntry`: travel journal record with title, body, tags, media metadata, views, ratings, and recommendation targets.
- `JournalMedia` and `JournalRating`: supporting value objects for journal content and scoring.

`src/services/contracts.ts` mirrors the public service contracts and also defines cursor-based feed and world-routing payloads such as `CursorPage`, `JournalFeedItem`, `WorldSummaryRecord`, `WorldDetailsRecord`, and the world-route request/response records.

## Validation Rules In Use

`src/data/validation.ts` currently checks:

- minimum counts for destinations, buildings, facility categories, facilities, edges, and users;
- unique identifiers across destinations, buildings, facilities, foods, journals, and users;
- referential integrity for nodes, edges, entrances, facilities, foods, journals, and ratings;
- required coordinates, names, categories, keywords, and timestamps;
- positive distances and valid congestion bounds;
- road-type to travel-mode compatibility;
- indoor edges staying within a single building when both endpoints are building-bound;
- world-map bounds, region polygons, destination placements, world-graph nodes and edges, and destination-portal consistency when `SeedData.world` is present.

## Implemented Algorithm Data Structures

### Ranking

- `src/algorithms/top-k.ts` implements bounded top-k selection so recommendation flows do not need a full sort for short result lists.

### Prefix And Exact Lookup

- `src/algorithms/trie.ts` supports prefix matching on names and labels.

### Keyword Retrieval

- `src/algorithms/inverted-index.ts` supports token indexing and ranked keyword retrieval for destination and journal search surfaces.

### Fuzzy Matching

- `src/algorithms/fuzzy.ts` supports tolerant food lookup so typo queries such as `nodle` still recover real results on the dataset.

### Routing

- `src/algorithms/graph.ts` uses an adjacency-list style weighted graph for shortest-path work.
- `src/algorithms/multi-route.ts` extends the routing layer for multi-stop closed walks.
- Route requests use the shared `RouteStrategy` union: `distance`, `time`, or `mixed`.
- Travel-mode constraints use the shared `TravelMode` union: `walk`, `bike`, `shuttle`, or `mixed`.
- World-mode routing composes `WorldGraphRecord` plus `DestinationPortalRecord` so `/api/world/routes/plan` can bridge local and cross-map itinerary legs.

### Compression

- `src/algorithms/compression.ts` performs reversible LZW-style text compression.
- `src/services/exchange-service.ts` serializes the compressed payload into a compact reversible transport string for the exchange API and demo.

## Storage Notes

- Seed data is loaded from `src/data/seed.ts`.
- The seed payload can include `world` data in the same source tree; it is validated as part of the runtime dataset rather than treated as separate browser-only content.
- Runtime journal mutations are persisted by `src/services/journal-store.ts` inside the chosen runtime directory.
- Stable string identifiers are used throughout the dataset so the API, tests, and deterministic demo can refer to the same records.
