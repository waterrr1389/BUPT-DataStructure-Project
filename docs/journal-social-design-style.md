# Journal Social Design Style Reference

## Purpose
This document preserves the design language for the journal- and map-facing browser surfaces as a stable visual reference. It is meant to guide page hierarchy, tone, and visual acceptance without acting as an implementation plan.

## Core Product Feeling

The browser shell should not feel like a course-project control panel. It should feel closer to a quiet premium travel journal product where technology supports the experience without dominating it.

The intended emotional frame is:

- calm
- light
- restrained
- human
- editorial
- spatial

The product should make the user feel:

- I am here.
- I want to go there.
- I want to remember this moment.

## Design Direction

### Priorities

- Reduce obvious tool-console energy on first view.
- Emphasize place, atmosphere, memory, and route.
- Keep map, journals, and recommendations connected without making the interface feel like a dashboard.
- Move advanced controls behind secondary surfaces instead of exposing every control above the fold.

### Anti-Direction

- Do not use a hard admin-console layout as the visual default.
- Do not rely on neon gradients, glossy metal, or high-saturation tech styling.
- Do not signal polish through heavier UI chrome alone.

## Visual Language

### Core Imagery

- soft natural light
- paper, linen, wood, and matte surfaces
- quiet campus, garden, lakeside, courtyard, and indoor atrium spaces
- routes rendered as gentle traces instead of engineering lines
- journal cards that feel like editorial travel snippets rather than raw database rows

### Light And Material

- Prefer diffused light and gradual atmosphere shifts over sharp contrast.
- Use matte, paper-like or fabric-like surfaces when adding texture.
- Frosted or translucent layers are acceptable when subtle and readable.
- Avoid sharp metallic highlights and aggressive glass reflections.

### Color

Preferred base palette:

- warm gray
- mica white
- linen
- deep space gray

Preferred accents:

- very light warm orange for route highlights, halo states, and primary calls to action
- muted olive or gray-green for destination and nature semantics

Avoid:

- saturated blue as the main identity color
- purple-first gradients
- cold fluorescent white

### Typography

- Headlines should feel open, quiet, and spacious.
- Body copy for journal reading can lean editorial or serif if readability stays strong.
- Labels and controls should stay restrained and not turn into heavy management-console buttons.

### Motion

- Favor fade, translate, blur, and soft emphasis.
- Keep feed reveal stagger subtle.
- Keep map highlighting ambient and breathing rather than flashy.
- Avoid bouncy, flipping, or novelty-heavy transitions.

## Page-Level Guidance

### Landing Or Entry Surface

- If an entry view exists, it should lead with mood and orientation rather than every control.
- Hero messaging should emphasize recording journeys, discovering places, and returning to locations through map context.
- First-view navigation should focus on `Explore`, `Map`, and `Feed`.

Do not:

- expose all forms in the first viewport
- surface advanced route or utility controls before the user chooses a direction

### Explore

- Treat Explore as an inspiration and discovery surface, not a search console.
- Destination cards should read like editorial cards.
- Food and facility results should feel secondary to destination discovery.
- Each relevant result should provide a clear `Open in map` path.

### Map

- Map should feel like the most spatial and breathable view in the product.
- The map canvas should dominate the composition.
- Control density should stay low, with advanced route controls collapsed by default.
- Routes, nodes, buildings, and turn cues should share one gentle visual system.
- Map-based routing follows a cohesive hierarchy: origin and destination controls lead, segment details expand beneath, and overlays live in unified panels so the planner feels like a single journey. The legend mirrors each rendered trace by type (outdoor route, indoor route, bike lane, shuttle lane) and the marker cues (start, end, transition, turn) so the copy matches the visible cues, and the route-summary cards borrow the same spacing and tone as the feed's journal cards so no surface feels orphaned.

### World Map

- World view should feel like the broadest spatial surface in the system while still belonging to the same calm journal product.
- Region context, destination markers, and local/world/local handoff links should read as orientation aids rather than transport-console chrome.
- World-route explanations should stay readable and secondary to the sense of movement across places.

### Feed

- Feed should feel like a calm travel community, not a raw list of records.
- Cards should favor whitespace and reading hierarchy.
- Show title, author, destination, summary, and actions clearly.
- Actions such as like, comment, and open in map should be visually unified.

### Post Detail

- Reading quality comes first.
- Comments should feel like quiet conversation, not chat bubbles.
- Destination and map context should appear as secondary supporting information.

### Compose

- Compose should feel like writing a postcard or field note, not filling an admin form.
- Destination and title belong near the top.
- The writing area should feel open and generous.
- Tags and media placeholders should remain lightweight support surfaces.

## Performance-Aware Style Rules

- Use CSS variables for palette, spacing, shadows, and transparency systems.
- Prefer layering, whitespace, opacity, and type hierarchy over deeper DOM nesting.
- Avoid large UI frameworks or heavy media backgrounds solely for atmosphere.
- Motion choices must respect map and feed performance budgets.

## Reference Usage

- Use this document when evaluating page hierarchy, above-the-fold composition, and the balance between primary and advanced controls.
- Use this document as the visual acceptance reference for color, typography, spacing, motion, and page-specific mood.
