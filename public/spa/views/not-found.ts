import { escapeHtml } from "../lib.js";
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

/**
 * Renders the deliberate SPA fallback route for unknown client-side paths.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  app.setDocumentTitle("Not Found");

  root.innerHTML = `
    <section class="route-hero route-hero-home">
      <div class="route-hero-copy">
        <p class="eyebrow">Not found</p>
        <h1>This frontend route does not exist in the SPA shell.</h1>
        <p class="route-lede">
          The server correctly returned the browser shell for <code>${escapeHtml(
            route.pathname,
          )}</code>, and the client resolved it to a deliberate fallback instead of a blank screen or accidental 404.
        </p>
        <div class="hero-actions">
          <a class="primary-link" href="/" data-nav="true">Go home</a>
          <a class="secondary-link" href="/explore" data-nav="true">Open Explore</a>
          <a class="secondary-link" href="/feed" data-nav="true">Open Feed</a>
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">Known routes</p>
        <ul class="hero-list">
          <li><code>/</code></li>
          <li><code>/explore</code></li>
          <li><code>/map</code></li>
          <li><code>/feed</code></li>
          <li><code>/compose</code></li>
          <li><code>/posts/&lt;journalId&gt;</code></li>
        </ul>
      </div>
    </section>
  `;

  return null;
}
