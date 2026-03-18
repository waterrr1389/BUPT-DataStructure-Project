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
- `UserProfile`: recommendation profile with interests, dietary preferences, and home destination.
- `JournalEntry`: travel journal record with title, body, tags, media metadata, views, ratings, and recommendation targets.
- `JournalMedia` and `JournalRating`: supporting value objects for journal content and scoring.

## Validation Rules In Use

`src/data/validation.ts` currently checks:

- minimum counts for destinations, buildings, facility categories, facilities, edges, and users;
- unique identifiers across destinations, buildings, facilities, foods, journals, and users;
- referential integrity for nodes, edges, entrances, facilities, foods, journals, and ratings;
- required coordinates, names, categories, keywords, and timestamps;
- positive distances and valid congestion bounds;
- road-type to travel-mode compatibility;
- indoor edges staying within a single building when both endpoints are building-bound.

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

### Compression

- `src/algorithms/compression.ts` performs reversible LZW-style text compression.
- `src/services/exchange-service.ts` serializes the compressed payload into a compact reversible transport string for the exchange API and demo.

## Storage Notes

- Seed data is loaded from `src/data/seed.ts`.
- Runtime journal mutations are persisted by `src/services/journal-store.ts` inside the chosen runtime directory.
- Stable string identifiers are used throughout the dataset so the API, tests, and deterministic demo can refer to the same records.
