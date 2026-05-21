import { escapeHtml } from "../lib.js";
import { appCopy } from "../copy.js";
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

/**
 * Renders the deliberate SPA fallback route for unknown client-side paths.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  const copy = appCopy.notFound;
  const escapedPathname = escapeHtml(route.pathname);
  const routeLede = escapeHtml(copy.hero.lede(route.pathname));
  app.setDocumentTitle(copy.documentTitle);

  root.innerHTML = `
    <section class="route-hero route-hero-home">
      <div class="route-hero-copy">
        <p class="eyebrow">${escapeHtml(copy.hero.eyebrow)}</p>
        <h1>${escapeHtml(copy.hero.title)}</h1>
        <p class="route-lede">
          ${escapedPathname ? routeLede.replace(escapedPathname, `<code>${escapedPathname}</code>`) : routeLede}
        </p>
        <div class="hero-actions">
          <a class="primary-link" href="/" data-nav="true">${escapeHtml(copy.hero.actions.home)}</a>
          <a class="secondary-link" href="/explore" data-nav="true">${escapeHtml(copy.hero.actions.explore)}</a>
          <a class="secondary-link" href="/feed" data-nav="true">${escapeHtml(copy.hero.actions.feed)}</a>
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">${escapeHtml(copy.hero.panelTag)}</p>
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
