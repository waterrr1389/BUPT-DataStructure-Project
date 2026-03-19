## Finalize Summary

Finalize-phase simplifications were completed in commit `475bc05` (`refactor finalize simplifier cleanup`) while preserving behavior.

Simplifications made:
- Removed an extra helper layer from the shared selector-binding path.
- Simplified the journal/exchange adapter to a direct rename of `destinationOptions`.
- Removed the unused graph variant `id`.
- Centralized repeated indoor-edge construction.
- Reduced repeated coordinate-access boilerplate in graph variant setup.

Files modified during Finalize Phase:
- `public/journal-consumers.js`
- `src/services/fallback-data.ts`

Post-simplification verification:
- `npm test` passed (30 tests).
- `npm run validate:data` passed with counts:
  - destinations: 220
  - buildings: 660
  - facilityCategories: 10
  - facilities: 1100
  - edges: 4070
  - users: 12
  - journals: 12
  - foods: 880

Refactoring notes:
- No remaining finalize notes beyond preserving behavior while reducing indirection and duplication.
