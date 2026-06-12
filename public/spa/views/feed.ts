// @ts-nocheck

import { appCopy } from "../copy.js";
import {
  createUrl,
  emptyStateMarkup,
  escapeHtml,
  fillSelect,
  noticeMarkup,
  resultMetaMarkup,
  safeArray,
} from "../lib.js";
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

/**
 * Wraps journal exchange results in the shared surface-card markup.
 */
function exchangeBlock(title: string, body: string) {
  return `
    <article class="surface-card exchange-result-card">
      <p class="section-tag">${escapeHtml(appCopy.feed.exchange.toolTag)}</p>
      <h3>${escapeHtml(title)}</h3>
      ${body}
    </article>
  `;
}

/**
 * Renders the journal feed plus secondary exchange tooling.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  const copy = appCopy.feed;
  app.setDocumentTitle(copy.documentTitle);

  const bootstrap = await app.loadBootstrap();
  const destinationBindings = app.getDestinationBindings();
  const destinationOptions = app.getDestinationOptions();
  const currentUserId = String(app.getCurrentUser()?.id ?? "");

  root.innerHTML = `
    <section class="route-hero route-hero-feed">
      <div class="route-hero-copy">
        <p class="eyebrow">${escapeHtml(copy.hero.eyebrow)}</p>
        <h1>${escapeHtml(copy.hero.title)}</h1>
        <p class="route-lede">
          ${escapeHtml(copy.hero.lede)}
        </p>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">${escapeHtml(copy.hero.panelTag)}</p>
        <ul class="hero-list">
          ${copy.hero.panelItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="feed-grid">
      <article class="surface-card feed-stream-card">
        <div class="section-head">
          <div>
            <p class="section-tag">${escapeHtml(copy.stream.tag)}</p>
            <h2>${escapeHtml(copy.stream.heading)}</h2>
          </div>
          <a
            class="inline-link"
            href="/compose"
            data-nav="true"
            data-compose-href="true"
          >${escapeHtml(copy.stream.composeLink)}</a>
        </div>
        <form class="control-grid" id="feed-filter-form">
          <label>
            ${escapeHtml(copy.stream.labels.destination)}
            <select id="feed-destination-filter"></select>
          </label>
          <label>
            ${escapeHtml(copy.stream.labels.limit)}
            <input id="feed-limit" type="number" min="1" max="18" value="8" />
          </label>
          <div class="button-row">
            <button type="submit">${escapeHtml(copy.stream.buttons.latest)}</button>
            <button type="button" id="feed-load-recommended" class="ghost">${escapeHtml(copy.stream.buttons.recommended)}</button>
          </div>
        </form>
        <div id="feed-notice"></div>
        <div id="feed-results" class="story-grid"></div>
      </article>

      <aside class="surface-card exchange-card">
        <div class="section-head">
          <div>
            <p class="section-tag">${escapeHtml(copy.exchange.tag)}</p>
            <h2>${escapeHtml(copy.exchange.heading)}</h2>
          </div>
        </div>

        <form class="control-grid" id="feed-exchange-search-form">
          <label>
            ${escapeHtml(copy.exchange.labels.exactTitle)}
            <input id="feed-exchange-title" type="text" placeholder="${escapeHtml(copy.exchange.placeholders.exactTitle)}" />
          </label>
          <label>
            ${escapeHtml(copy.exchange.labels.query)}
            <input id="feed-exchange-query" type="text" placeholder="${escapeHtml(copy.exchange.placeholders.query)}" />
          </label>
          <label>
            ${escapeHtml(copy.exchange.labels.destination)}
            <select id="feed-exchange-destination"></select>
          </label>
          <div class="button-row">
            <button type="submit">${escapeHtml(copy.exchange.buttons.search)}</button>
            <button type="button" id="feed-exchange-by-destination" class="ghost">${escapeHtml(copy.exchange.buttons.byDestination)}</button>
          </div>
        </form>

        <form class="control-grid" id="feed-compression-form">
          <label class="span-all">
            ${escapeHtml(copy.exchange.labels.compressionBody)}
            <textarea id="feed-compression-body" rows="4" placeholder="${escapeHtml(copy.exchange.placeholders.compressionBody)}"></textarea>
          </label>
          <div class="button-row">
            <button type="submit">${escapeHtml(copy.exchange.buttons.compress)}</button>
            <button type="button" id="feed-decompress" class="ghost">${escapeHtml(copy.exchange.buttons.decompress)}</button>
          </div>
        </form>

        <form class="control-grid" id="feed-storyboard-form">
          <label>
            ${escapeHtml(copy.exchange.labels.storyboardTitle)}
            <input id="feed-storyboard-title" type="text" placeholder="${escapeHtml(copy.exchange.placeholders.storyboardTitle)}" />
          </label>
          <label class="span-all">
            ${escapeHtml(copy.exchange.labels.storyboardPrompt)}
            <textarea id="feed-storyboard-prompt" rows="3" placeholder="${escapeHtml(copy.exchange.placeholders.storyboardPrompt)}"></textarea>
          </label>
          <button type="submit">${escapeHtml(copy.exchange.buttons.storyboard)}</button>
        </form>

        <div id="feed-exchange-results"></div>
      </aside>
    </section>
  `;

  app.applySelectorBindings(root, destinationBindings?.selectorBindings);
  root.querySelector("#feed-exchange-destination").value = destinationOptions[0]?.id || "";
  root.querySelector("#feed-destination-filter").value = route.params.destinationId || "";

  const feedResults = root.querySelector("#feed-results");
  const feedNotice = root.querySelector("#feed-notice");
  const exchangeResults = root.querySelector("#feed-exchange-results");
  const destinationFilter = root.querySelector("#feed-destination-filter");

  let disposed = false;
  let currentFeedMode = "latest";

  function renderJournalCard(item, options = {}) {
    return app.createJournalCard(item, {
      ...options,
    });
  }

  async function loadFeed(mode = "latest") {
    currentFeedMode = mode;
    const destinationId = destinationFilter.value;
    const limit = root.querySelector("#feed-limit").value;

    app.navigate(
      createUrl("/feed", {
        destinationId,
      }),
      { replace: true, preserveScroll: true, render: false },
    );

    const result =
      mode === "recommended"
        ? {
            items: safeArray(
              await app.fetchRecommendedJournals({
                destinationId,
                userId: currentUserId,
                limit,
              }),
            ),
            notice: currentUserId
              ? copy.stream.notices.recommended
              : copy.stream.notices.chooseTraveler,
          }
        : await app.fetchFeed({
            destinationId,
            viewerUserId: currentUserId,
            limit,
          });

    if (disposed) {
      return;
    }

    feedNotice.innerHTML = result.notice
      ? noticeMarkup(
          "note",
          mode === "recommended" ? copy.stream.noticeTitles.recommended : copy.stream.noticeTitles.latest,
          result.notice,
        )
      : "";
    feedResults.innerHTML = safeArray(result.items).length
      ? safeArray(result.items).map((item) => renderJournalCard(item, { hideDelete: false })).join("")
      : emptyStateMarkup({
          title: copy.stream.empty.title,
          body: copy.stream.empty.body,
          actionHref: "/compose",
          actionLabel: copy.stream.empty.actionLabel,
        });
  }

  async function refreshExchangeResults(blocks) {
    exchangeResults.innerHTML = blocks.length
      ? blocks.join("")
      : emptyStateMarkup({
          title: copy.exchange.empty.title,
          body: copy.exchange.empty.body,
        });
  }

  async function handleJournalAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const card = button.closest("[data-journal-id]");
    const journalId = card?.dataset.journalId;

    try {
      const result = await app.sendJournalAction(button.dataset.action, journalId);
      if (result.notice) {
        app.setStatus(result.notice, "note");
      }
      await loadFeed(currentFeedMode);
    } catch (error) {
      app.setStatus(copy.status.journalActionFailed, "error");
    }
  }

  root.querySelector("#feed-filter-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadFeed("latest");
    } catch (error) {
      app.setStatus(copy.status.loadingFailed, "error");
    }
  });

  root.querySelector("#feed-load-recommended").addEventListener("click", async () => {
    try {
      await loadFeed("recommended");
    } catch (error) {
      app.setStatus(copy.status.recommendationFailed, "error");
    }
  });

  feedResults.addEventListener("click", handleJournalAction);
  exchangeResults.addEventListener("click", handleJournalAction);

  root.querySelector("#feed-exchange-search-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const exactTitle = root.querySelector("#feed-exchange-title").value.trim();
      const query = root.querySelector("#feed-exchange-query").value.trim();
      const blocks = [];

      if (exactTitle) {
        const payload = await app.requestJson(
          `/api/journal-exchange/title?title=${encodeURIComponent(exactTitle)}`,
        );
        blocks.push(
          exchangeBlock(
            copy.exchange.results.exactTitle,
            payload.item ? renderJournalCard(payload.item, {
              hideDelete: true,
              hideSocialAction: true,
              hideSocialMeta: true,
            }) : emptyStateMarkup(),
          ),
        );
      }

      if (query) {
        const payload = await app.requestJson(
          `/api/journal-exchange/search?query=${encodeURIComponent(query)}`,
        );
        blocks.push(
          exchangeBlock(
            copy.exchange.results.textSearch,
            safeArray(payload.items).length
              ? safeArray(payload.items)
                  .map((item) => renderJournalCard(item, {
                    hideDelete: true,
                    hideSocialAction: true,
                    hideSocialMeta: true,
                  }))
                  .join("")
              : emptyStateMarkup(),
          ),
        );
      }

      await refreshExchangeResults(blocks);
    } catch (error) {
      app.setStatus(copy.status.exchangeSearchFailed, "error");
    }
  });

  root.querySelector("#feed-exchange-by-destination").addEventListener("click", async () => {
    try {
      const destinationId = root.querySelector("#feed-exchange-destination").value;
      const payload = await app.requestJson(
        `/api/journal-exchange/destination?destinationId=${encodeURIComponent(destinationId)}`,
      );
      await refreshExchangeResults([
        exchangeBlock(
          copy.exchange.results.destination,
          safeArray(payload.items).length
            ? safeArray(payload.items)
                .map((item) => renderJournalCard(item, {
                  hideDelete: true,
                  hideSocialAction: true,
                  hideSocialMeta: true,
                }))
                .join("")
            : emptyStateMarkup(),
        ),
      ]);
    } catch (error) {
      app.setStatus(copy.status.destinationExchangeFailed, "error");
    }
  });

  root.querySelector("#feed-compression-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = root.querySelector("#feed-compression-body").value;
      const payload = await app.requestJson("/api/journal-exchange/compress", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      app.state.lastCompressed =
        typeof payload.item?.compressed === "string" ? payload.item.compressed : String(payload.item?.compressed ?? "");
      await refreshExchangeResults([
        exchangeBlock(
          copy.exchange.results.compressed,
          `<p class="muted">${escapeHtml(payload.item?.compressed)}</p>${resultMetaMarkup([
            copy.exchange.compressionRatio(payload.item?.ratio),
          ])}`,
        ),
      ]);
    } catch (error) {
      app.setStatus(copy.status.compressionFailed, "error");
    }
  });

  root.querySelector("#feed-decompress").addEventListener("click", async () => {
    try {
      const body =
        app.state.lastCompressed || root.querySelector("#feed-compression-body").value;
      const payload = await app.requestJson("/api/journal-exchange/decompress", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      await refreshExchangeResults([
        exchangeBlock(copy.exchange.results.decompressed, `<p>${escapeHtml(payload.item?.text)}</p>`),
      ]);
    } catch (error) {
      app.setStatus(copy.status.decompressionFailed, "error");
    }
  });

  root.querySelector("#feed-storyboard-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = await app.requestJson("/api/journal-exchange/storyboard", {
        method: "POST",
        body: JSON.stringify({
          title: root.querySelector("#feed-storyboard-title").value,
          prompt: root.querySelector("#feed-storyboard-prompt").value,
          mediaSources: ["generated://cover/demo-1", "generated://clip/demo-1"],
        }),
      });
      await refreshExchangeResults([
        exchangeBlock(
          payload.item?.title || copy.exchange.results.storyboardFallback,
          `<div class="storyboard">${safeArray(payload.item?.frames)
            .map(
              (frame) => `
                <figure>
                  <img src="${escapeHtml(frame.art)}" alt="${escapeHtml(frame.caption)}" />
                  <figcaption>${escapeHtml(frame.caption)}</figcaption>
                </figure>
              `,
            )
            .join("")}</div>`,
        ),
      ]);
    } catch (error) {
      app.setStatus(copy.status.storyboardFailed, "error");
    }
  });

  await loadFeed("latest");
  await refreshExchangeResults([]);

  return () => {
    disposed = true;
  };
}
