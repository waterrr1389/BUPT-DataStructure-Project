import { escapeHtml, noticeMarkup, resultMetaMarkup, safeArray, text } from "../lib.js";
import type { JsonRecord, SpaApp, SpaRoute, ViewCleanup } from "../types.js";

/**
 * Strips journal action buttons from preview cards while leaving the reading markup intact.
 */
function withoutJournalActions(markup: unknown): string {
  return text(markup).replace(/\s*<div class="actions">[\s\S]*?<\/div>\s*/u, "");
}

/**
 * Renders the SPA landing page with featured destinations and a feed preview.
 */
export async function render(
  app: SpaApp,
  _route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  app.setDocumentTitle("Trail Atlas");

  const bootstrap = await app.loadBootstrap();
  const featuredDestinations = app.getFeaturedDestinations().slice(0, 4);
  let feedPreview: JsonRecord[] = [];
  let feedNotice = "";

  try {
    const feed = await app.fetchFeed({ limit: 3 });
    feedPreview = feed.items.slice(0, 3);
    feedNotice = feed.notice;
  } catch (error) {
    feedNotice = error instanceof Error ? error.message : "Feed preview unavailable.";
  }

  root.innerHTML = `
    <section class="route-hero route-hero-home">
      <div class="route-hero-copy">
        <p class="eyebrow">Quiet Premium Travel Journal</p>
        <h1>Record the route, keep the atmosphere, return to the place.</h1>
        <p class="route-lede">
          Trail Atlas is now a routed browser experience. Explore destinations, open the map when spatial detail matters, browse a calm journal feed, and compose field notes without the old dashboard sprawl.
        </p>
        <div class="hero-actions">
          <a class="primary-link" href="/explore" data-nav="true">Open Explore</a>
          <a class="secondary-link" href="/feed" data-nav="true">Read the feed</a>
          <a class="secondary-link" href="/map" data-nav="true">Jump to map</a>
        </div>
        ${resultMetaMarkup([
          `${safeArray(bootstrap?.destinations).length} destinations`,
          `${safeArray(bootstrap?.users).length} local travelers`,
          `${safeArray(bootstrap?.featured).length} featured places`,
        ], "result-meta hero-metrics")}
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">Primary paths</p>
        <ul class="hero-list">
          <li>Explore preserves destination recommendation, food discovery, and nearby facilities.</li>
          <li>Map keeps route planning and the existing destination graph visualization.</li>
          <li>Feed and Post Detail stage journals as editorial stories with graceful social fallbacks.</li>
          <li>Compose keeps journal creation generous and lightweight.</li>
        </ul>
      </div>
    </section>

    <section class="home-grid">
      <article class="surface-card home-card">
        <div class="section-head">
          <div>
            <p class="section-tag">Featured places</p>
            <h2>Start with a destination, not a control panel</h2>
          </div>
          <a class="inline-link" href="/explore" data-nav="true">Browse all</a>
        </div>
        <div class="story-grid">
          ${featuredDestinations
            .map(
              (destination) => `
                <article class="story-card compact-story-card">
                  <p class="muted">${escapeHtml(destination.type)} · ${escapeHtml(destination.region)}</p>
                  <h3>${escapeHtml(destination.name)}</h3>
                  ${resultMetaMarkup([
                    `heat ${destination.heat}`,
                    `rating ${destination.rating}`,
                    `${destination.nodeCount} nodes`,
                  ])}
                  <p>${escapeHtml(destination.description)}</p>
                  <div class="story-card-actions">
                    <a class="inline-link" href="/map?destinationId=${encodeURIComponent(text(destination.id))}" data-nav="true">Open in map</a>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="surface-card home-card">
        <div class="section-head">
          <div>
            <p class="section-tag">Journal preview</p>
            <h2>Recent notes, loaded without the full social layer</h2>
          </div>
          <a class="inline-link" href="/feed" data-nav="true">Open feed</a>
        </div>
        ${feedNotice ? noticeMarkup("note", "Feed fallback", feedNotice) : ""}
        ${
          feedPreview.length
            ? `<div class="story-grid">${feedPreview
                .map((item) => withoutJournalActions(app.createJournalCard(item, { hideDelete: true })))
                .join("")}</div>`
            : noticeMarkup(
                "quiet",
                "No preview notes yet",
                "The feed preview is empty, but the routed shell is ready for direct entry on /feed and /posts/<journalId>.",
              )
        }
      </article>
    </section>
  `;

  return null;
}
