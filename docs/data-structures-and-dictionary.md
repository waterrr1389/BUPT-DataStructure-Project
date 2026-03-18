# Data Structures and Dictionary

## Core Domain Entities

`src/domain/models.ts` is expected to define these records or equivalent interfaces:

- `Destination`: id, name, kind, tags, popularity, rating, geo anchor.
- `CampusOrScenicArea`: id, label, scene type, buildings, facilities, road graph.
- `Building`: id, area id, name, category, coordinates, floor metadata.
- `Facility`: id, area id, category, label, node id, operating metadata.
- `RoadNode`: id, area id, coordinates, scene label.
- `RoadEdge`: id, from node, to node, distance, crowd factor, allowed transport.
- `UserProfile`: id, display name, interests, preferences, history.
- `Journal`: id, author id, destination id, title, body, media list, score state, views.
- `FoodItem`: id, area id, vendor, cuisine, popularity, rating, distance anchor.
- `MediaAsset`: id, type, uri or local key, caption, source journal or destination.

## Required Validation Rules

`src/data/validation.ts` should check at least:

- Hard minimum counts for destinations, buildings, facility categories, facility instances, edges, and users.
- Referential integrity between nodes, edges, facilities, journals, and users.
- Required fields such as coordinates, categories, and transport rules.
- Numeric ranges such as rating bounds and crowd factor bounds.

## Planned Data Structures

### Ranking

- Min-heap or quickselect-based top-k structure in `src/algorithms/top-k.ts`.

### Prefix and Exact Lookup

- Trie in `src/algorithms/trie.ts` for prefix search on destination names, titles, or categories.

### Keyword Retrieval

- Inverted index in `src/algorithms/inverted-index.ts` for destination keywords and journal full-text search.

### Fuzzy Matching

- Edit-distance or token-similarity helper in `src/algorithms/fuzzy.ts` for food and tolerant content queries.

### Routing

- Adjacency-list graph in `src/algorithms/graph.ts`.
- State-aware multi-stop planner in `src/algorithms/multi-route.ts`.

### Compression

- Lossless dictionary or Huffman-style representation in `src/algorithms/compression.ts`.

## Data Dictionary Notes

- Use stable string identifiers across all entities so fixtures, tests, and demo scripts can refer to the same records.
- Keep transport permissions on edges explicit so route validation can reject illegal vehicle choices.
- Keep journal media metadata separate from binary payloads so compression and AIGC steps remain mockable.
