import {
  createUrl,
  emptyStateMarkup,
  escapeHtml,
  fillSelect,
  formatDate,
  noticeMarkup,
  resultMetaMarkup,
  safeArray,
  splitLines,
} from "../lib.js";
import { getDestinationScene, renderRouteVisualization } from "../map-rendering.js";

const COMMENTS_PAGE_SIZE = 5;

function commentMarkup(app, item) {
  const userLabel = app.getUserName(item?.userId);
  return `
    <article class="comment-card">
      <div class="comment-head">
        <strong>${escapeHtml(userLabel)}</strong>
        <span>${escapeHtml(formatDate(item?.createdAt))}</span>
      </div>
      <p>${escapeHtml(item?.body)}</p>
    </article>
  `;
}

export async function render(app, route, root) {
  app.setDocumentTitle("Post Detail");

  await app.loadBootstrap();
  const users = safeArray(app.getBootstrap()?.users);
  const actorDefault = users.some((user) => user.id === route.params.actor)
    ? route.params.actor
    : users[0]?.id || "";
  const feedHref = createUrl("/feed", actorDefault ? { actor: actorDefault } : {});
  const composeHref = createUrl("/compose", actorDefault ? { actor: actorDefault } : {});

  let journal;
  try {
    journal = await app.fetchJournalDetail(route.journalId, {
      viewerUserId: actorDefault,
    });
  } catch (error) {
    root.innerHTML = `
      <section class="route-hero route-hero-feed">
        <div class="route-hero-copy">
          <p class="eyebrow">Post detail</p>
          <h1>This note could not be found.</h1>
          <p class="route-lede">${escapeHtml(
            error instanceof Error ? error.message : "Unknown journal.",
          )}</p>
          <div class="hero-actions">
            <a class="primary-link" href="${escapeHtml(feedHref)}" data-nav="true">Back to feed</a>
            <a class="secondary-link" href="${escapeHtml(composeHref)}" data-nav="true">Compose a new note</a>
          </div>
        </div>
      </section>
    `;
    return null;
  }

  const articleParagraphs = splitLines(journal.body);
  const destinationName = app.getDestinationName(journal.destinationId);
  const authorName = app.getUserName(journal.userId);

  root.innerHTML = `
    <section class="route-hero route-hero-feed">
      <div class="route-hero-copy">
        <p class="eyebrow">Post detail</p>
        <h1 id="post-hero-title">${escapeHtml(journal.title)}</h1>
        <p class="route-lede" id="post-hero-attribution">
          ${escapeHtml(destinationName)} / ${escapeHtml(authorName)}
        </p>
        <div id="post-hero-meta">
          ${resultMetaMarkup([
            `views ${journal.views || 0}`,
            `rating ${journal.averageRating || 0}`,
            `${safeArray(journal.ratings).length} scores`,
            journal.likeCount != null ? `${journal.likeCount} likes` : "",
            journal.commentCount != null ? `${journal.commentCount} comments` : "",
          ])}
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">Supporting context</p>
        <ul class="hero-list">
          <li>Reading quality comes first; map context stays secondary and opt-in.</li>
          <li>Comments and likes degrade intentionally when social endpoints are missing.</li>
          <li>Legacy journal actions still remain reachable here.</li>
        </ul>
      </div>
    </section>

    <section class="detail-grid">
      <article class="surface-card detail-story-card">
        <div class="section-head">
          <div>
            <p class="section-tag">Field note</p>
            <h2 id="post-story-title">${escapeHtml(journal.title)}</h2>
          </div>
          <a class="inline-link" href="${escapeHtml(feedHref)}" data-nav="true" data-feed-href="true">Back to feed</a>
        </div>
        <div class="reading-flow">
          ${articleParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        </div>
        ${app.tagsMarkup(journal.tags)}
        ${
          safeArray(journal.media).length
            ? `<div class="media-strip">${safeArray(journal.media)
                .map(
                  (entry) => `
                    <article class="media-card">
                      <p class="section-tag">${escapeHtml(entry.type || "media")}</p>
                      <h3>${escapeHtml(entry.title || "Untitled media")}</h3>
                      <p class="muted">${escapeHtml(entry.note || entry.source || "")}</p>
                    </article>
                  `,
                )
                .join("")}</div>`
            : ""
        }
      </article>

      <aside class="detail-sidebar">
        <article class="surface-card">
          <p class="section-tag">Journal actions</p>
          <h2>Quiet controls</h2>
          <form class="control-grid" id="post-action-form">
            <label>
              You are
              <select id="post-actor"></select>
            </label>
          </form>
          <div class="button-row">
            <button type="button" id="post-view">Add view</button>
            <button type="button" id="post-rate" class="ghost">Rate 5</button>
            <button type="button" id="post-like" class="ghost">Like</button>
            <button type="button" id="post-delete" class="ghost">Delete</button>
          </div>
          ${resultMetaMarkup([
            `Created ${formatDate(journal.createdAt)}`,
            `Updated ${formatDate(journal.updatedAt)}`,
          ])}
          <div class="story-card-actions">
            <a class="inline-link" href="${app.buildMapHref({ destinationId: journal.destinationId })}" data-nav="true">Open destination in map</a>
            <a
              class="inline-link"
              href="${escapeHtml(buildComposeHref(actorDefault, journal.destinationId))}"
              data-nav="true"
              data-compose-href="true"
              data-compose-destination="${escapeHtml(journal.destinationId)}"
            >Write a nearby note</a>
          </div>
        </article>

        <article class="surface-card">
          <div class="section-head">
            <div>
              <p class="section-tag">Map context</p>
              <h2>Load place context on demand</h2>
            </div>
          </div>
          <button type="button" id="post-load-map" class="ghost">Show destination context</button>
          <div id="post-map-context">
            ${emptyStateMarkup({
              title: "Map context is secondary",
              body: "Open the supporting destination graph only when spatial detail is useful for this note.",
            })}
          </div>
        </article>
      </aside>
    </section>

    <section class="surface-card comments-card">
      <div class="section-head">
        <div>
          <p class="section-tag">Conversation</p>
          <h2>Comments</h2>
        </div>
      </div>
      <form class="control-grid" id="post-comment-form">
        <label class="span-all">
          Add a comment
          <textarea id="post-comment-body" rows="4" placeholder="Share a quiet observation or route tip."></textarea>
        </label>
        <button type="submit">Post comment</button>
      </form>
      <div id="post-comment-notice"></div>
      <div id="post-comments">
        ${emptyStateMarkup({
          title: "Comments are loading",
          body: "The detail view checks for social endpoints here and degrades intentionally if they are absent.",
        })}
      </div>
      <div id="post-comments-footer"></div>
    </section>
  `;

  fillSelect(root.querySelector("#post-actor"), users, {
    selectedValue: actorDefault,
  });

  const commentNotice = root.querySelector("#post-comment-notice");
  const commentsContainer = root.querySelector("#post-comments");
  const commentsFooter = root.querySelector("#post-comments-footer");
  const actorSelect = root.querySelector("#post-actor");
  const likeButton = root.querySelector("#post-like");
  const heroMeta = root.querySelector("#post-hero-meta");
  let currentLikeAction = "like";
  let commentItems = [];
  let commentsNextCursor = "";
  let commentsTotalCount = 0;
  let commentsAvailable = false;
  let commentsLoading = false;
  let journalRequestToken = 0;
  let disposed = false;

  function buildFeedHref(actorId) {
    return createUrl("/feed", actorId ? { actor: actorId } : {});
  }

  function buildComposeHref(actorId, destinationId) {
    return createUrl("/compose", {
      actor: actorId,
      destinationId,
    });
  }

  function syncFeedLinks(actorId) {
    root.querySelectorAll("[data-feed-href]").forEach((link) => {
      link.setAttribute("href", buildFeedHref(actorId));
    });
  }

  function syncComposeLinks(actorId) {
    root.querySelectorAll("[data-compose-href]").forEach((link) => {
      link.setAttribute("href", buildComposeHref(actorId, link.getAttribute("data-compose-destination") || ""));
    });
  }

  function renderHeroMeta(item) {
    heroMeta.innerHTML = resultMetaMarkup([
      `views ${item.views || 0}`,
      `rating ${item.averageRating || 0}`,
      `${safeArray(item.ratings).length} scores`,
      item.likeCount != null ? `${item.likeCount} likes` : "",
      item.commentCount != null ? `${item.commentCount} comments` : "",
    ]);
  }

  function renderJournalState(item) {
    journal = item;
    renderHeroMeta(journal);
    currentLikeAction = journal.viewerHasLiked ? "unlike" : "like";
    likeButton.textContent = currentLikeAction === "like" ? "Like" : "Unlike";
    syncFeedLinks(actorSelect.value);
    syncComposeLinks(actorSelect.value);
  }

  function renderComments() {
    commentsContainer.innerHTML = commentsLoading && !commentItems.length
      ? emptyStateMarkup({
          title: "Comments are loading",
          body: "Loading the current comment page for this note.",
        })
      : commentItems.length
      ? commentItems.map((item) => commentMarkup(app, item)).join("")
      : emptyStateMarkup({
          title: commentsAvailable ? "No comments yet" : "Comments unavailable",
          body: commentsAvailable
            ? "Start a calm conversation on this note."
            : "The backend comments endpoint is not available in this workspace yet.",
        });

    if (!commentsAvailable) {
      commentsFooter.innerHTML = "";
      return;
    }

    const footerParts = [];
    if (commentsTotalCount > 0) {
      footerParts.push(
        resultMetaMarkup([
          commentsNextCursor
            ? `${commentItems.length} of ${commentsTotalCount} comments`
            : `${commentsTotalCount} comments`,
        ]),
      );
    }
    if (commentsNextCursor) {
      footerParts.push(`
        <div class="button-row">
          <button type="button" id="post-comments-more" class="ghost"${commentsLoading ? " disabled" : ""}>${commentsLoading ? "Loading…" : "Load more comments"}</button>
        </div>
      `);
    }
    commentsFooter.innerHTML = footerParts.join("");
  }

  async function refreshJournalDetail() {
    const token = journalRequestToken + 1;
    journalRequestToken = token;
    const detail = await app.fetchJournalDetail(route.journalId, {
      viewerUserId: actorSelect.value,
    });
    if (disposed || token !== journalRequestToken) {
      return;
    }
    renderJournalState(detail);
  }

  async function refreshComments(options = {}) {
    const reset = options.reset !== false;
    const cursor = reset ? "" : commentsNextCursor;
    commentsLoading = true;
    renderComments();

    const response = await app.fetchJournalComments(route.journalId, {
      cursor,
      limit: COMMENTS_PAGE_SIZE,
    });
    if (disposed) {
      return;
    }
    commentNotice.innerHTML = response.notice
      ? noticeMarkup(response.available ? "note" : "quiet", "Comment status", response.notice)
      : "";
    commentsAvailable = response.available;
    commentsTotalCount = response.totalCount;
    commentsNextCursor = response.nextCursor;
    commentItems = reset ? response.items : commentItems.concat(response.items);
    commentsLoading = false;
    renderComments();

    root.querySelector("#post-comment-body").disabled = !response.available;
    root.querySelector("#post-comment-form button[type='submit']").disabled = !response.available;
  }

  renderJournalState(journal);

  root.querySelector("#post-view").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("view", route.journalId, actorSelect.value);
      await refreshJournalDetail();
      app.setStatus("View recorded.", "success");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "View action failed.", "error");
    }
  });

  root.querySelector("#post-rate").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("rate", route.journalId, actorSelect.value);
      await refreshJournalDetail();
      app.setStatus("Rating recorded.", "success");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Rate action failed.", "error");
    }
  });

  root.querySelector("#post-delete").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("delete", route.journalId, actorSelect.value);
      app.navigate("/feed");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Delete action failed.", "error");
    }
  });

  likeButton.addEventListener("click", async () => {
    try {
      const result = await app.sendJournalAction(currentLikeAction, route.journalId, actorSelect.value);
      if (result.notice) {
        app.setStatus(result.notice, "note");
        return;
      }
      await refreshJournalDetail();
      app.setStatus("Like state updated.", "success");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Like action failed.", "error");
    }
  });

  actorSelect.addEventListener("change", async () => {
    app.navigate(app.buildPostHref(route.journalId, actorSelect.value ? { actor: actorSelect.value } : {}), {
      replace: true,
      preserveScroll: true,
      render: false,
    });
    try {
      await refreshJournalDetail();
    } catch (error) {
      app.setStatus(
        error instanceof Error ? error.message : "Post detail refresh failed.",
        "error",
      );
    }
  });

  root.querySelector("#post-comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = root.querySelector("#post-comment-body").value.trim();
    if (!body) {
      app.setStatus("Comment body is required.", "error");
      return;
    }

    try {
      const response = await app.createComment(route.journalId, actorSelect.value, body);
      if (!response.available) {
        app.setStatus(response.notice, "note");
        return;
      }
      root.querySelector("#post-comment-body").value = "";
      await refreshJournalDetail();
      await refreshComments({ reset: true });
      app.setStatus("Comment posted.", "success");
    } catch (error) {
      app.setStatus(error instanceof Error ? error.message : "Comment creation failed.", "error");
    }
  });

  root.querySelector("#post-load-map").addEventListener("click", async () => {
    try {
      const details = await app.ensureDestinationDetails(journal.destinationId);
      if (disposed || !details) {
        return;
      }
      const scene = getDestinationScene(app.state.mapScenes, journal.destinationId, details);
      root.querySelector("#post-map-context").innerHTML = renderRouteVisualization({
        details,
        route: null,
        previewStartId: "",
        previewEndId: "",
        scene,
      });
    } catch (error) {
      root.querySelector("#post-map-context").innerHTML = noticeMarkup(
        "note",
        "Map context unavailable",
        error instanceof Error ? error.message : "Could not load destination context.",
      );
    }
  });

  commentsFooter.addEventListener("click", async (event) => {
    const button = event.target.closest("#post-comments-more");
    if (!button || commentsLoading || !commentsNextCursor) {
      return;
    }
    try {
      await refreshComments({ reset: false });
    } catch (error) {
      commentsLoading = false;
      renderComments();
      app.setStatus(error instanceof Error ? error.message : "Comments could not be loaded.", "error");
    }
  });

  await refreshComments({ reset: true });

  return () => {
    disposed = true;
  };
}
