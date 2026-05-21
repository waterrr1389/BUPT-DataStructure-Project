import { escapeHtml, noticeMarkup, resultMetaMarkup, safeArray, text } from "../lib.js";
import { appCopy, displayDestinationMeta } from "../copy.js";
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
  const copy = appCopy.home;
  app.setDocumentTitle(copy.documentTitle);

  const bootstrap = await app.loadBootstrap();
  const featuredDestinations = app.getFeaturedDestinations().slice(0, 4);
  let feedPreview: JsonRecord[] = [];
  let feedNotice = "";

  try {
    const feed = await app.fetchFeed({ limit: 3 });
    feedPreview = feed.items.slice(0, 3);
    feedNotice = feed.notice;
  } catch {
    feedNotice = copy.feedPreview.unavailableNotice;
  }

  root.innerHTML = `
    <section class="route-hero route-hero-home">
      <div class="route-hero-copy">
        <p class="eyebrow">${escapeHtml(copy.hero.eyebrow)}</p>
        <h1>${escapeHtml(copy.hero.title)}</h1>
        <p class="route-lede">
          ${escapeHtml(copy.hero.lede)}
        </p>
        <div class="hero-actions">
          <a class="primary-link" href="/explore" data-nav="true">${escapeHtml(copy.hero.actions.explore)}</a>
          <a class="secondary-link" href="/feed" data-nav="true">${escapeHtml(copy.hero.actions.feed)}</a>
          <a class="secondary-link" href="/map" data-nav="true">${escapeHtml(copy.hero.actions.map)}</a>
        </div>
        ${resultMetaMarkup([
          copy.hero.metrics.destinations(safeArray(bootstrap?.destinations).length),
          copy.hero.metrics.travelers(safeArray(bootstrap?.users).length),
          copy.hero.metrics.featured(safeArray(bootstrap?.featured).length),
        ], "result-meta hero-metrics")}
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">${escapeHtml(copy.hero.panelTag)}</p>
        <ul class="hero-list">
          ${copy.hero.panelItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="home-grid">
      <article class="surface-card home-card">
        <div class="section-head">
          <div>
            <p class="section-tag">${escapeHtml(copy.featured.tag)}</p>
            <h2>${escapeHtml(copy.featured.heading)}</h2>
          </div>
          <a class="inline-link" href="/explore" data-nav="true">${escapeHtml(copy.featured.linkLabel)}</a>
        </div>
        <div class="story-grid">
          ${featuredDestinations
            .map(
              (destination) => `
                <article class="story-card compact-story-card">
                  <p class="muted">${escapeHtml(displayDestinationMeta(destination.type, destination.region))}</p>
                  <h3>${escapeHtml(destination.name)}</h3>
                  ${resultMetaMarkup([
                    copy.featured.metrics.heat(destination.heat),
                    copy.featured.metrics.rating(destination.rating),
                    copy.featured.metrics.nodeCount(destination.nodeCount),
                  ])}
                  <p>${escapeHtml(destination.description)}</p>
                  <div class="story-card-actions">
                    <a class="inline-link" href="/map?destinationId=${encodeURIComponent(text(destination.id))}" data-nav="true">${escapeHtml(copy.featured.openInMap)}</a>
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
            <p class="section-tag">${escapeHtml(copy.feedPreview.tag)}</p>
            <h2>${escapeHtml(copy.feedPreview.heading)}</h2>
          </div>
          <a class="inline-link" href="/feed" data-nav="true">${escapeHtml(copy.feedPreview.linkLabel)}</a>
        </div>
        ${feedNotice ? noticeMarkup("note", copy.feedPreview.fallbackNoticeTitle, feedNotice) : ""}
        ${
          feedPreview.length
            ? `<div class="story-grid">${feedPreview
                .map((item) => withoutJournalActions(app.createJournalCard(item, { hideDelete: true })))
                .join("")}</div>`
            : noticeMarkup(
                "quiet",
                copy.feedPreview.emptyTitle,
                copy.feedPreview.emptyBody,
              )
        }
      </article>
    </section>
  `;

  return null;
}
