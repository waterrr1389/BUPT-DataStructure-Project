# Trail Atlas Localization Specification

## Overview

This document defines the normative localization contract for Trail Atlas. It is the implementation anchor for Chinese user-facing copy, protocol stability, data-display boundaries, error-display behavior, and validation expectations.

The current localization target is a single-language Chinese interface. Runtime language switching, browser-language negotiation, lazy-loaded language packs, and a full multi-locale content model are outside this specification unless a later spec explicitly extends this one.

## Authority and Scope

This specification governs:

- browser user-interface copy under `public`
- shared browser presentation helpers
- route, map, world-map, and journal display labels
- frontend error display for API failures
- seed and fallback fields that are directly displayed to users
- tests that distinguish localized display from stable protocol contracts

This specification does not redefine:

- API route structure
- service method ownership
- domain model identities
- algorithm behavior
- browser build rules
- third-party vendor assets

When this specification conflicts with implementation convenience, this specification takes precedence for localization work.

## Localization Model

Trail Atlas uses a Chinese default display model:

- The application presents user-facing interface text in Chinese.
- The project may keep the product name `Trail Atlas` in Chinese copy.
- The application must not expose a language switcher in this localization pass.
- The application must not infer locale from the browser or request headers in this localization pass.
- Chinese copy should be centralized in a lightweight browser copy module, such as `public/spa/copy.ts`.

The copy module is a presentation resource. It must not become a protocol registry, route registry, or business-logic owner.

## Copy Ownership

The copy module should own these categories:

- navigation labels
- document title fragments
- common buttons and links
- form labels and placeholders
- status messages
- empty states
- notice titles and bodies
- frontend fallback error messages
- journal metadata labels
- route and map display labels
- world-route display labels
- date, money, count, and unit display helpers

Long page copy may be grouped by route or surface:

- home
- explore
- map
- world map
- feed
- compose
- post detail
- not found

Dynamic Chinese sentences must be generated through helper functions when English word order would make string interpolation awkward or ambiguous.

## Stable Protocol Boundary

Localization must not change stable protocol identifiers. The following values remain English and stable:

- API paths
- URL query keys
- request body field names
- response field names
- `code`
- `id`
- `type`
- `kind`
- `roadType`
- `mode`
- `strategy`
- category enum values
- DOM ids
- CSS class names
- `data-*` attributes
- CommonJS and browser-global export names
- script filenames and module paths

Select controls may display Chinese option text, but their `value` attributes must keep the original protocol values.

Route markers may display Chinese labels, but semantic marker fields must remain stable. Journal actions may display Chinese button text, but `data-action` values must remain stable.

## Display Label Mapping

Protocol values that appear in the interface need explicit display labels instead of direct translation in-place.

At minimum, the presentation layer should provide labels for:

- travel modes: `walk`, `bike`, `shuttle`, `mixed`
- route strategies: `distance`, `time`, `mixed`
- road types: `walkway`, `bike-lane`, `shuttle-lane`, `indoor`
- facility categories, including the synthetic UI category `all`
- route marker roles such as start, end, preview start, preview end, transition, turn, and floor change
- world-route scopes such as `world-only` and `cross-map`

The protocol value remains the key. The Chinese label is a display projection of that key.

## Frontend Surface Requirements

The following surfaces must present Chinese user-facing copy:

- static HTML shell metadata
- browser startup fallback
- SPA shell navigation and status
- Home
- Explore
- Map
- World Map
- Feed
- Compose
- Post Detail
- Not Found
- shared empty-state and notice markup
- journal cards and journal detail actions
- route visualization and route result summaries
- world-route forms, pending states, success states, failure states, and handoff links
- Leaflet tooltips created by first-party code
- SVG `aria-label` and accessibility-facing text created by first-party code

Third-party vendor copy is not owned by this specification unless first-party code explicitly renders it.

## Error Display Contract

Backend API errors should keep stable machine-readable contracts. The frontend is responsible for displaying localized fallback messages.

The preferred frontend lookup order is:

1. stable API `code` when available
2. known frontend request context when the API has no code
3. generic Chinese fallback message
4. backend English `error` or `message` only as diagnostic fallback

The primary user-facing error text must be Chinese. Backend English `error` or `message` text may appear only as secondary diagnostic detail for unknown failures, or as an internal fallback when no localized message can be selected.

World-route errors already expose structured codes and fields. Localization must not change their HTTP status, field names, or codes.

General request errors, malformed JSON errors, oversized request errors, and unknown endpoint errors must remain stable enough for API tests to assert them as protocol behavior.

## Data Display Boundary

Seed and fallback data contain both display content and machine-oriented values.

Display fields may be Chinese when they are directly shown to users:

- `label`
- `name`
- `description`
- `summary`
- `title`
- `body`
- `region` when used only as display copy
- `openHours` when used only as display copy
- `venue` when used only as display copy
- media display text
- user-facing world labels
- user-facing facility and food names

Machine-oriented fields must remain stable:

- ids
- enum values
- route modes
- route strategies
- road types
- portal directions
- icon types
- categories used as protocol values
- building categories used for grouping or filtering
- lookup keys

Search-related `keywords`, `tags`, cuisines, categories, regions, venue names, building categories, opening-hour strings, and generated terms must keep existing search, grouping, and filtering behavior. Chinese search expansion may be added only when tests cover both the original English search path and the added Chinese search path.

If a display field is intentionally left English because it is a brand name, fixture name, test datum, or deferred content-localization item, the final implementation report must classify it as retained data content rather than missed UI copy.

## Test Contract

Tests must cover two independent dimensions:

- Chinese display behavior
- stable protocol behavior

Display tests should assert Chinese user-visible text on representative surfaces:

- shell and navigation
- home and explore
- map route planning
- world map route planning
- feed and journal cards
- compose
- post detail and comments
- not-found and error fallback states

Protocol tests should continue to assert stable internal behavior:

- API paths and request payloads
- URL query keys
- API error codes and structured fields
- `data-*` hooks
- `data-action` values
- marker semantic keys
- CommonJS and browser-global exports
- option values

API error tests must not be converted into Chinese UI-copy tests. Chinese API-error presentation belongs in frontend or SPA tests.

## Validation Matrix

A conforming implementation must pass:

- browser build
- TypeScript server build
- aggregated runtime tests
- SPA regression tests
- journal presentation and consumer tests
- route visualization marker tests
- world-route API error tests
- data seed validation when seed or fallback display data changes

The expected commands are:

```bash
npm run build
node dist/tests/index.js
npm test
```

If an environment issue prevents one command from completing, the final report must include the exact command, observed failure, and why the failure is not caused by localization changes.

## Implementation Boundaries

Localization work must not:

- change browser build rules
- rewrite service APIs for locale negotiation
- introduce a large i18n framework
- rename public contracts
- translate comments or code identifiers
- commit `.humanize` contents
- add development-process notes to `README.md`

Localization work may:

- add small presentation helpers
- add a browser copy module
- add display-label maps keyed by stable protocol values
- add frontend error-message maps keyed by stable API codes
- update tests to distinguish Chinese display from stable protocol contracts

## Relationship to Planning

This document defines the localization contract. Implementation batches, agent ownership, scheduling, and fallback decisions belong in `plan.md`. Work that changes this contract must update this specification before implementation proceeds.
