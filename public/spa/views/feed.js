import {
  createUrl,
  emptyStateMarkup,
  escapeHtml,
  fillSelect,
  noticeMarkup,
  resultMetaMarkup,
  safeArray,
  text,
} from "../lib.js";

function exchangeBlock(title, body) {
  return `
    <article class="surface-card exchange-result-card">
      <p class="section-tag">Exchange</p>
      <h3>${escapeHtml(title)}</h3>
      ${body}
    </article>
  `;
}

function commentCountLabel(item) {
  const value = Number(item?.commentCount);
  return Number.isFinite(value) && value > 0 ? `${value} comments` : "Comments";
}

export async function render(app, route, root) {
  app.setDocumentTitle("Feed");

  const bootstrap = await app.loadBootstrap();
  const destinationBindings = app.getDestinationBindings();
  const users = safeArray(bootstrap?.users);
  const destinationOptions = app.getDestinationOptions();

  root.innerHTML = `
    <section class="route-hero route-hero-feed">
      <div class="route-hero-copy">
        <p class="eyebrow">Feed</p>
        <h1>Browse journals as calm editorial cards, with course utilities still within reach.</h1>
        <p class="route-lede">
          Feed is summary-first. Full detail moves to <code>/posts/&lt;journalId&gt;</code>, journal recommendations remain available, and exchange tooling is preserved as a secondary surface instead of dominating the page.
        </p>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">Graceful fallback</p>
        <ul class="hero-list">
          <li>The shell tries <code>/api/feed</code> first when it exists.</li>
          <li>If the social feed endpoint is absent, the browser falls back to the legacy journal timeline.</li>
          <li>Like and comment controls are surfaced, but degrade intentionally when backend support is missing.</li>
        </ul>
      </div>
    </section>

    <section class="feed-grid">
      <article class="surface-card feed-stream-card">
        <div class="section-head">
          <div>
            <p class="section-tag">Journal stream</p>
            <h2>Quiet travel notes and actions</h2>
          </div>
          <a class="inline-link" href="/compose" data-nav="true">Write a new note</a>
        </div>
        <form class="control-grid" id="feed-filter-form">
          <label>
            You are
            <select id="feed-actor"></select>
          </label>
          <label>
            Destination filter
            <select id="feed-destination-filter"></select>
          </label>
          <label>
            Author filter
            <select id="feed-author-filter"></select>
          </label>
          <label>
            Limit
            <input id="feed-limit" type="number" min="1" max="18" value="8" />
          </label>
          <div class="button-row">
            <button type="submit">Load latest</button>
            <button type="button" id="feed-load-recommended" class="ghost">Recommended</button>
          </div>
        </form>
        <div id="feed-notice"></div>
        <div id="feed-results" class="story-grid"></div>
      </article>

      <aside class="surface-card exchange-card">
        <div class="section-head">
          <div>
            <p class="section-tag">Journal exchange</p>
            <h2>Search, compress, and storyboard without losing the feed</h2>
          </div>
        </div>

        <form class="control-grid" id="feed-exchange-search-form">
          <label>
            Exact title
            <input id="feed-exchange-title" type="text" placeholder="Amber Bay field note 1" />
          </label>
          <label>
            Text query
            <input id="feed-exchange-query" type="text" placeholder="indoor hall, food counter, dusk route" />
          </label>
          <label>
            Destination
            <select id="feed-exchange-destination"></select>
          </label>
          <div class="button-row">
            <button type="submit">Search exchange</button>
            <button type="button" id="feed-exchange-by-destination" class="ghost">Load destination feed</button>
          </div>
        </form>

        <form class="control-grid" id="feed-compression-form">
          <label class="span-all">
            Compression text
            <textarea id="feed-compression-body" rows="4" placeholder="Paste a journal paragraph to compress."></textarea>
          </label>
          <div class="button-row">
            <button type="submit">Compress</button>
            <button type="button" id="feed-decompress" class="ghost">Decompress</button>
          </div>
        </form>

        <form class="control-grid" id="feed-storyboard-form">
          <label>
            Story title
            <input id="feed-storyboard-title" type="text" placeholder="Harbor dusk loop" />
          </label>
          <label class="span-all">
            Prompt
            <textarea id="feed-storyboard-prompt" rows="3" placeholder="Describe the mood, route, and moments to animate."></textarea>
          </label>
          <button type="submit">Generate storyboard</button>
        </form>

        <div id="feed-exchange-results"></div>
      </aside>
    </section>
  `;

  fillSelect(root.querySelector("#feed-actor"), users);
  fillSelect(root.querySelector("#feed-author-filter"), users, {
    includeBlank: true,
    blankLabel: "any author",
  });
  app.applySelectorBindings(root, destinationBindings?.selectorBindings);
  root.querySelector("#feed-exchange-destination").value = destinationOptions[0]?.id || "";
  root.querySelector("#feed-destination-filter").value = route.params.destinationId || "";
  root.querySelector("#feed-author-filter").value = route.params.author || "";
  root.querySelector("#feed-actor").value = route.params.actor || users[0]?.id || "";

  const feedResults = root.querySelector("#feed-results");
  const feedNotice = root.querySelector("#feed-notice");
  const exchangeResults = root.querySelector("#feed-exchange-results");

  let disposed = false;
  let currentFeedMode = "latest";

  function renderJournalCard(item, options = {}) {
    return app.createJournalCard(item, {
      ...options,
      actorId: root.querySelector("#feed-actor").value,
    });
  }

  async function loadFeed(mode = "latest") {
    currentFeedMode = mode;
    const actorId = root.querySelector("#feed-actor").value;
    const destinationId = root.querySelector("#feed-destination-filter").value;
    const authorId = root.querySelector("#feed-author-filter").value;
    const limit = root.querySelector("#feed-limit").value;

    app.navigate(
      createUrl("/feed", {
        destinationId,
        actor: actorId,
        author: authorId,
      }),
      { replace: true, preserveScroll: true, render: false },
    );

    const result =
      mode === "recommended"
        ? {
            items: await app.fetchRecommendedJournals({
              destinationId,
              userId: actorId,
              limit,
            }),
            notice: actorId
              ? "Recommended notes are sourced from the legacy journal recommendation helper."
              : "Select a traveler to load recommendations.",
          }
        : await app.fetchFeed({
            destinationId,
            userId: authorId,
            viewerUserId: actorId,
            limit,
          });

    if (disposed) {
      return;
    }

    feedNotice.innerHTML = result.notice
      ? noticeMarkup("note", mode === "recommended" ? "Recommendation mode" : "Feed mode", result.notice)
      : "";
    feedResults.innerHTML = safeArray(result.items).length
      ? safeArray(result.items).map((item) => renderJournalCard(item, { hideDelete: false })).join("")
      : emptyStateMarkup({
          title: "No journals matched this view",
          body: "Shift the destination or author filter, or move back to latest mode.",
          actionHref: "/compose",
          actionLabel: "Write the first note",
        });
  }

  async function refreshExchangeResults(blocks) {
    exchangeResults.innerHTML = blocks.length
      ? blocks.join("")
      : emptyStateMarkup({
          title: "Exchange tools stay secondary",
          body: "Search by title or text, load a destination feed, or run compression and storyboard generation here.",
        });
  }

  async function handleJournalAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const card = button.closest("[data-journal-id]");
    const journalId = card?.dataset.journalId;
    const actorId = root.querySelector("#feed-actor").value;

    try {
      const result = await app.sendJournalAction(button.dataset.action, journalId, actorId);
      if (result.notice) {
        app.setStatus(result.notice, "note");
      }
      await loadFeed(currentFeedMode);
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Journal action failed.", "error");
    }
  }

  root.querySelector("#feed-filter-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadFeed("latest");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Feed loading failed.", "error");
    }
  });

  root.querySelector("#feed-load-recommended").addEventListener("click", async () => {
    try {
      await loadFeed("recommended");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Recommendations failed.", "error");
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
            "Exact title",
            payload.item ? renderJournalCard(payload.item, { hideDelete: true }) : emptyStateMarkup(),
          ),
        );
      }

      if (query) {
        const payload = await app.requestJson(
          `/api/journal-exchange/search?query=${encodeURIComponent(query)}`,
        );
        blocks.push(
          exchangeBlock(
            "Text search",
            safeArray(payload.items).length
              ? safeArray(payload.items)
                  .map((item) => renderJournalCard(item, { hideDelete: true }))
                  .join("")
              : emptyStateMarkup(),
          ),
        );
      }

      await refreshExchangeResults(blocks);
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Exchange search failed.", "error");
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
          "Destination feed",
          safeArray(payload.items).length
            ? safeArray(payload.items)
                .map((item) => renderJournalCard(item, { hideDelete: true }))
                .join("")
            : emptyStateMarkup(),
        ),
      ]);
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Destination exchange failed.", "error");
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
      app.state.lastCompressed = text(payload.item?.compressed);
      await refreshExchangeResults([
        exchangeBlock(
          "Compression",
          `<p class="muted">${escapeHtml(payload.item?.compressed)}</p>${resultMetaMarkup([
            `ratio ${payload.item?.ratio}`,
          ])}`,
        ),
      ]);
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Compression failed.", "error");
    }
  });

  root.querySelector("#feed-decompress").addEventListener("click", async () => {
    try {
      const body =
        app.state.lastCompressed || root.querySelector("#feed-compression-body").value.trim();
      const payload = await app.requestJson("/api/journal-exchange/decompress", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      await refreshExchangeResults([
        exchangeBlock("Decompression", `<p>${escapeHtml(payload.item?.text)}</p>`),
      ]);
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Decompression failed.", "error");
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
          payload.item?.title || "Storyboard",
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
      app.setStatus(error instanceof Error ? error.message : "Storyboard generation failed.", "error");
    }
  });

  await loadFeed("latest");
  await refreshExchangeResults([]);

  return () => {
    disposed = true;
  };
}
