// @ts-nocheck

import { appCopy } from "../copy.js";
import {
  createRouteContextHref,
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
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

const COMMENTS_PAGE_SIZE = 5;

function mediaTypeLabel(value: unknown): string {
  const key = typeof value === "string" ? value.trim() : "";
  return appCopy.postDetail.mediaTypes[key] || appCopy.postDetail.mediaTypes.media;
}

/**
 * Renders a single comment card for the post detail conversation view.
 */
function commentMarkup(app: SpaApp, item) {
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

/**
 * Renders journal detail, actor-aware actions, optional map context, and comments.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  const copy = appCopy.postDetail;
  app.setDocumentTitle(copy.documentTitle);

  await app.loadBootstrap();
  const users = safeArray(app.getBootstrap()?.users);
  const actorDefault = users.some((user) => user.id === route.params.actor)
    ? route.params.actor
    : users[0]?.id || "";
  const feedHref = createRouteContextHref("/feed", {}, actorDefault);
  const composeHref = createRouteContextHref("/compose", {}, actorDefault);

  let journal;
  try {
    journal = await app.fetchJournalDetail(route.journalId, {
      viewerUserId: actorDefault,
    });
  } catch (error) {
    root.innerHTML = `
      <section class="route-hero route-hero-feed">
        <div class="route-hero-copy">
          <p class="eyebrow">${escapeHtml(copy.hero.eyebrow)}</p>
          <h1>${escapeHtml(copy.hero.notFoundTitle)}</h1>
          <p class="route-lede">${escapeHtml(copy.hero.notFoundBody)}</p>
          <div class="hero-actions">
            <a class="primary-link" href="${escapeHtml(feedHref)}" data-nav="true">${escapeHtml(copy.hero.returnToFeed)}</a>
            <a class="secondary-link" href="${escapeHtml(composeHref)}" data-nav="true">${escapeHtml(copy.hero.compose)}</a>
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
        <p class="eyebrow">${escapeHtml(copy.hero.eyebrow)}</p>
        <h1 id="post-hero-title">${escapeHtml(journal.title)}</h1>
        <p class="route-lede" id="post-hero-attribution">
          ${escapeHtml(destinationName)} / ${escapeHtml(authorName)}
        </p>
        <div id="post-hero-meta">
          ${resultMetaMarkup([
            copy.metrics.views(journal.views || 0),
            copy.metrics.rating(journal.averageRating || 0),
            copy.metrics.ratingCount(safeArray(journal.ratings).length),
            journal.likeCount != null ? copy.metrics.likes(journal.likeCount) : "",
            journal.commentCount != null ? copy.metrics.comments(journal.commentCount) : "",
          ])}
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">${escapeHtml(copy.hero.panelTag)}</p>
        <ul class="hero-list">
          ${copy.hero.panelItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="detail-grid">
      <article class="surface-card detail-story-card">
        <div class="section-head">
          <div>
            <p class="section-tag">${escapeHtml(copy.article.tag)}</p>
            <h2 id="post-story-title">${escapeHtml(journal.title)}</h2>
          </div>
          <a class="inline-link" href="${escapeHtml(feedHref)}" data-nav="true" data-feed-href="true">${escapeHtml(copy.hero.returnToFeed)}</a>
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
                      <p class="section-tag">${escapeHtml(mediaTypeLabel(entry.type))}</p>
                      <h3>${escapeHtml(entry.title || copy.article.mediaFallbackTitle)}</h3>
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
          <p class="section-tag">${escapeHtml(copy.actions.tag)}</p>
          <h2>${escapeHtml(copy.actions.heading)}</h2>
          <form class="control-grid" id="post-action-form">
            <label>
              ${escapeHtml(copy.actions.labels.actor)}
              <select id="post-actor"></select>
            </label>
          </form>
          <div class="button-row">
            <button type="button" id="post-view">${escapeHtml(copy.actions.buttons.view)}</button>
            <button type="button" id="post-rate" class="ghost">${escapeHtml(copy.actions.buttons.rate)}</button>
            <button type="button" id="post-like" class="ghost">${escapeHtml(copy.actions.buttons.like)}</button>
            <button type="button" id="post-delete" class="ghost">${escapeHtml(copy.actions.buttons.delete)}</button>
          </div>
          ${resultMetaMarkup([
            copy.metrics.createdAt(formatDate(journal.createdAt)),
            copy.metrics.updatedAt(formatDate(journal.updatedAt)),
          ])}
          <div class="story-card-actions">
            <a
              class="inline-link"
              href="${escapeHtml(buildMapHref(actorDefault, journal.destinationId))}"
              data-nav="true"
              data-map-href="true"
              data-map-destination="${escapeHtml(journal.destinationId)}"
            >${escapeHtml(copy.actions.links.openMap)}</a>
            <a
              class="inline-link"
              href="${escapeHtml(buildComposeHref(actorDefault, journal.destinationId))}"
              data-nav="true"
              data-compose-href="true"
              data-compose-destination="${escapeHtml(journal.destinationId)}"
            >${escapeHtml(copy.actions.links.composeNearby)}</a>
          </div>
        </article>

        <article class="surface-card">
          <div class="section-head">
            <div>
              <p class="section-tag">${escapeHtml(copy.mapContext.tag)}</p>
              <h2>${escapeHtml(copy.mapContext.heading)}</h2>
            </div>
          </div>
          <button type="button" id="post-load-map" class="ghost">${escapeHtml(copy.actions.buttons.loadMap)}</button>
          <div id="post-map-context">
            ${emptyStateMarkup({
              title: copy.mapContext.emptyTitle,
              body: copy.mapContext.emptyBody,
            })}
          </div>
        </article>
      </aside>
    </section>

    <section class="surface-card comments-card">
      <div class="section-head">
        <div>
          <p class="section-tag">${escapeHtml(copy.commentsSurface.tag)}</p>
          <h2>${escapeHtml(copy.commentsSurface.heading)}</h2>
        </div>
      </div>
      <form class="control-grid" id="post-comment-form">
        <label class="span-all">
          ${escapeHtml(copy.commentsSurface.label)}
          <textarea id="post-comment-body" rows="4" placeholder="${escapeHtml(copy.commentsSurface.placeholder)}"></textarea>
        </label>
        <button type="submit">${escapeHtml(copy.commentsSurface.submit)}</button>
      </form>
      <div id="post-comment-notice"></div>
      <div id="post-comments">
        ${emptyStateMarkup({
          title: copy.commentsSurface.loadingTitle,
          body: copy.commentsSurface.loadingBody,
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
  const commentBody = root.querySelector("#post-comment-body");
  const commentSubmitButton = root.querySelector("#post-comment-form button[type='submit']");
  const actorSelect = root.querySelector("#post-actor");
  const likeButton = root.querySelector("#post-like");
  const heroMeta = root.querySelector("#post-hero-meta");
  let currentLikeAction = "like";
  let commentItems = [];
  let commentsNextCursor = "";
  let commentsTotalCount = 0;
  let commentsAvailable = false;
  let commentsError = "";
  let commentsLoading = false;
  let journalRequestToken = 0;
  let disposed = false;

  function buildFeedHref(actorId) {
    return createRouteContextHref("/feed", {}, actorId);
  }

  function buildMapHref(actorId, destinationId) {
    return createRouteContextHref("/map", { destinationId }, actorId);
  }

  function buildComposeHref(actorId, destinationId) {
    return createRouteContextHref("/compose", { destinationId }, actorId);
  }

  function syncFeedLinks(actorId) {
    root.querySelectorAll("[data-feed-href]").forEach((link) => {
      link.setAttribute("href", buildFeedHref(actorId));
    });
  }

  function syncMapLinks(actorId) {
    root.querySelectorAll("[data-map-href]").forEach((link) => {
      link.setAttribute("href", buildMapHref(actorId, link.getAttribute("data-map-destination") || ""));
    });
  }

  function syncComposeLinks(actorId) {
    root.querySelectorAll("[data-compose-href]").forEach((link) => {
      link.setAttribute("href", buildComposeHref(actorId, link.getAttribute("data-compose-destination") || ""));
    });
  }

  function renderHeroMeta(item) {
    heroMeta.innerHTML = resultMetaMarkup([
      copy.metrics.views(item.views || 0),
      copy.metrics.rating(item.averageRating || 0),
      copy.metrics.ratingCount(safeArray(item.ratings).length),
      item.likeCount != null ? copy.metrics.likes(item.likeCount) : "",
      item.commentCount != null ? copy.metrics.comments(item.commentCount) : "",
    ]);
  }

  function renderJournalState(item) {
    journal = item;
    renderHeroMeta(journal);
    currentLikeAction = journal.viewerHasLiked ? "unlike" : "like";
    likeButton.textContent =
      currentLikeAction === "like" ? copy.actions.buttons.like : copy.actions.buttons.unlike;
    syncFeedLinks(actorSelect.value);
    syncMapLinks(actorSelect.value);
    syncComposeLinks(actorSelect.value);
  }

  function renderComments() {
    commentsContainer.innerHTML = commentsLoading && !commentItems.length
      ? emptyStateMarkup({
          title: copy.commentsSurface.loadingTitle,
          body: copy.commentsSurface.pageLoadingBody,
        })
      : commentsError && !commentItems.length
      ? emptyStateMarkup({
          title: copy.commentsSurface.failedTitle,
          body: commentsError,
        })
      : commentItems.length
      ? commentItems.map((item) => commentMarkup(app, item)).join("")
      : emptyStateMarkup({
          title: commentsAvailable ? copy.commentsSurface.emptyTitle : copy.commentsSurface.unavailableTitle,
          body: commentsAvailable
            ? copy.commentsSurface.emptyBody
            : copy.commentsSurface.unavailableBody,
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
            ? copy.commentsSurface.shownCount(commentItems.length, commentsTotalCount)
            : copy.metrics.comments(commentsTotalCount),
        ]),
      );
    }
    if (commentsNextCursor) {
      footerParts.push(`
        <div class="button-row">
          <button type="button" id="post-comments-more" class="ghost"${commentsLoading ? " disabled" : ""}>${escapeHtml(
            commentsLoading ? copy.commentsSurface.loadingMore : copy.commentsSurface.loadMore,
          )}</button>
        </div>
      `);
    }
    commentsFooter.innerHTML = footerParts.join("");
  }

  function setCommentFormDisabled(disabled) {
    commentBody.disabled = disabled;
    commentSubmitButton.disabled = disabled;
  }

  function applyCommentsResponse(response, reset) {
    commentNotice.innerHTML = response.notice
      ? noticeMarkup(response.available ? "note" : "quiet", copy.commentsSurface.statusTitle, response.notice)
      : "";
    commentsAvailable = response.available;
    commentsTotalCount = response.totalCount;
    commentsNextCursor = response.nextCursor;
    commentItems = reset ? response.items : commentItems.concat(response.items);
    commentsLoading = false;
    renderComments();
    setCommentFormDisabled(!response.available);
  }

  function applyCommentsError(error) {
    commentsLoading = false;
    commentsError = copy.status.commentsLoadFailed;
    commentNotice.innerHTML = noticeMarkup("error", copy.commentsSurface.failedTitle, commentsError);
    renderComments();
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
    commentsError = "";
    commentsLoading = true;
    renderComments();

    try {
      const response = await app.fetchJournalComments(route.journalId, {
        cursor,
        limit: COMMENTS_PAGE_SIZE,
      });
      if (disposed) {
        return;
      }
      applyCommentsResponse(response, reset);
    } catch (error) {
      if (disposed) {
        return;
      }
      applyCommentsError(error);
      throw error;
    }
  }

  renderJournalState(journal);

  root.querySelector("#post-view").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("view", route.journalId, actorSelect.value);
      await refreshJournalDetail();
      app.setStatus(copy.status.viewRecorded, "success");
    } catch (error) {
      app.setStatus(copy.status.viewFailed, "error");
    }
  });

  root.querySelector("#post-rate").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("rate", route.journalId, actorSelect.value);
      await refreshJournalDetail();
      app.setStatus(copy.status.ratingRecorded, "success");
    } catch (error) {
      app.setStatus(copy.status.ratingFailed, "error");
    }
  });

  root.querySelector("#post-delete").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("delete", route.journalId, actorSelect.value);
      app.navigate(buildFeedHref(actorSelect.value));
    } catch (error) {
      app.setStatus(copy.status.deleteFailed, "error");
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
      app.setStatus(copy.status.likeUpdated, "success");
    } catch (error) {
      app.setStatus(copy.status.likeFailed, "error");
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
        copy.status.refreshFailed,
        "error",
      );
    }
  });

  root.querySelector("#post-comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = root.querySelector("#post-comment-body").value.trim();
    if (!body) {
      app.setStatus(copy.status.emptyComment, "error");
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
      app.setStatus(copy.status.commentCreated, "success");
    } catch (error) {
      app.setStatus(copy.status.commentCreateFailed, "error");
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
        copy.mapContext.unavailableTitle,
        copy.mapContext.unavailableBody,
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
      app.setStatus(copy.status.commentsLoadFailed, "error");
    }
  });

  try {
    await refreshComments({ reset: true });
  } catch (error) {
    app.setStatus(copy.status.commentsLoadFailed, "error");
  }

  return () => {
    disposed = true;
  };
}
