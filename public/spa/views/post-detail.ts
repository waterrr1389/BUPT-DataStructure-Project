// @ts-nocheck

import { appCopy } from "../copy.js";
import {
  createUrl,
  emptyStateMarkup,
  escapeHtml,
  formatDate,
  noticeMarkup,
  resultMetaMarkup,
  safeArray,
  splitLines,
  text,
} from "../lib.js";
import { getDestinationScene, renderRouteVisualization } from "../map-rendering.js";
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

const COMMENTS_PAGE_SIZE = 5;
const COMMENT_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const COMMENT_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const COMPRESSED_JOURNAL_FORMAT = "trail-atlas-journal-lzw-v1";
const COMPRESSED_JOURNAL_ALGORITHM = "lzw";

function mediaTypeLabel(value: unknown): string {
  const key = typeof value === "string" ? value.trim() : "";
  return appCopy.postDetail.mediaTypes[key] || appCopy.postDetail.mediaTypes.media;
}

function formatFileSize(size: unknown): string {
  const bytes = Number(size) || 0;
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function createPreviewUrl(file): string {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(file);
  }
  return "";
}

function revokePreviewUrl(url: string): void {
  if (url && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function compressionNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function rawString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function escapeLiteralHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requiredCompressionStat(stats, key: string): number {
  const value = stats?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Compressed journal file has invalid stats.");
  }
  return value;
}

function normalizeCompressionStats(item, body: string) {
  const compressed = rawString(item?.compressed);
  const inputLength = compressionNumber(item?.inputLength ?? item?.originalLength, body.length);
  const payloadLength = compressionNumber(item?.payloadLength, compressed.length);
  const compressionRatio = compressionNumber(
    item?.compressionRatio ?? item?.ratio,
    inputLength > 0 ? payloadLength / inputLength : 0,
  );
  const spaceSavings = compressionNumber(item?.spaceSavings ?? item?.savingsRatio, 1 - compressionRatio);

  return {
    inputLength,
    payloadLength,
    compressionRatio,
    spaceSavings,
  };
}

function compressionMetricsMarkup(stats) {
  const copy = appCopy.postDetail.compression.metrics;
  return resultMetaMarkup([
    copy.originalLength(stats?.inputLength ?? stats?.originalLength ?? 0),
    copy.payloadLength(stats?.payloadLength ?? 0),
    copy.compressionRatio(stats?.compressionRatio ?? 0),
    copy.savingsRatio(stats?.spaceSavings ?? stats?.savingsRatio ?? 0),
  ]);
}

function sanitizedDownloadName(value: unknown): string {
  const normalized = text(value, "journal")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized || "journal"}-compressed.json`;
}

function downloadJsonFile(fileName: string, payload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  if (typeof link.click === "function") {
    link.click();
  }
  if (typeof link.remove === "function") {
    link.remove();
  }
  URL.revokeObjectURL(url);
}

async function readTextFile(file): Promise<string> {
  if (file && typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error("File could not be read.")));
    reader.readAsText(file);
  });
}

function isCompressedJournalJsonFile(file): boolean {
  const name = text(file?.name).toLowerCase();
  const mimeType = text(file?.type).toLowerCase();
  if (name) {
    return name.endsWith(".json");
  }
  return mimeType === "application/json" || mimeType.endsWith("+json");
}

function validateCompressedJournalFile(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid compressed journal file.");
  }
  if (payload.format !== COMPRESSED_JOURNAL_FORMAT || payload.algorithm !== COMPRESSED_JOURNAL_ALGORITHM) {
    throw new Error("Unsupported compressed journal file.");
  }
  const compressedBody = rawString(payload.compressedBody);
  if (!compressedBody.trim()) {
    throw new Error("Compressed journal file is missing a body payload.");
  }
  if (!payload.stats || typeof payload.stats !== "object") {
    throw new Error("Compressed journal file is missing stats.");
  }
  return {
    compressedBody,
    stats: {
      inputLength: requiredCompressionStat(payload.stats, "inputLength"),
      payloadLength: requiredCompressionStat(payload.stats, "payloadLength"),
      compressionRatio: requiredCompressionStat(payload.stats, "compressionRatio"),
      spaceSavings: requiredCompressionStat(payload.stats, "spaceSavings"),
    },
    title: text(payload.title, appCopy.postDetail.compression.previewFallbackTitle),
  };
}

function commentMediaMarkup(item) {
  return safeArray(item?.media)
    .filter((entry) => entry?.type === "image" && text(entry?.source))
    .map((entry) => {
      const title = text(entry.title, appCopy.postDetail.commentsSurface.imageFallbackTitle);
      return uploadedMediaImageMarkup(entry.source, title);
    })
    .join("");
}

function uploadedMediaImageMarkup(source: unknown, title: unknown) {
  return `
    <figure class="comment-media-frame" data-image-state="available">
      <img
        class="comment-media-image"
        src="${escapeHtml(source)}"
        alt="${escapeHtml(title)}"
        loading="lazy"
        data-comment-media-image="true"
        data-uploaded-media-image="true"
      />
      <div
        class="comment-media-fallback"
        hidden
        role="note"
        data-comment-media-fallback="true"
        data-uploaded-media-fallback="true"
      >${escapeHtml(appCopy.postDetail.commentsSurface.imageLoadFailed)}</div>
      <figcaption>${escapeHtml(title)}</figcaption>
    </figure>
  `;
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
      ${commentMediaMarkup(item)}
    </article>
  `;
}

/**
 * Renders journal detail, authenticated actions, optional map context, and comments.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  const copy = appCopy.postDetail;
  app.setDocumentTitle(copy.documentTitle);

  await app.loadBootstrap();
  const currentUser = app.getCurrentUser();
  const currentUserId = String(currentUser?.id ?? "");
  const currentUserName = currentUserId ? app.getUserName(currentUserId) : "";
  const feedHref = "/feed";
  const composeHref = "/compose";

  let journal;
  try {
    journal = await app.fetchJournalDetail(route.journalId, {
      viewerUserId: currentUserId,
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
  const canDelete = currentUserId && currentUserId === journal.userId;

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
                      ${entry.type === "image" && text(entry.source) ? uploadedMediaImageMarkup(entry.source, entry.title || copy.article.mediaFallbackTitle) : ""}
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
          <div class="identity-summary" id="post-identity-summary">
            <p><span>${escapeHtml(copy.actions.labels.author)}</span><strong>${escapeHtml(authorName)}</strong></p>
            <p><span>${escapeHtml(copy.actions.labels.currentUser)}</span><strong>${escapeHtml(currentUserName || copy.actions.labels.guest)}</strong></p>
          </div>
          <div class="button-row">
            <button type="button" id="post-view">${escapeHtml(copy.actions.buttons.view)}</button>
            <button type="button" id="post-rate" class="ghost">${escapeHtml(copy.actions.buttons.rate)}</button>
            <button type="button" id="post-like" class="ghost">${escapeHtml(copy.actions.buttons.like)}</button>
            ${canDelete ? `<button type="button" id="post-delete" class="ghost">${escapeHtml(copy.actions.buttons.delete)}</button>` : ""}
          </div>
          ${resultMetaMarkup([
            copy.metrics.createdAt(formatDate(journal.createdAt)),
            copy.metrics.updatedAt(formatDate(journal.updatedAt)),
          ])}
          <div class="story-card-actions">
            <a
              class="inline-link"
              href="${escapeHtml(buildMapHref(journal.destinationId))}"
              data-nav="true"
              data-map-href="true"
              data-map-destination="${escapeHtml(journal.destinationId)}"
            >${escapeHtml(copy.actions.links.openMap)}</a>
            <a
              class="inline-link"
              href="${escapeHtml(buildComposeHref(journal.destinationId))}"
              data-nav="true"
              data-compose-href="true"
              data-compose-destination="${escapeHtml(journal.destinationId)}"
            >${escapeHtml(copy.actions.links.composeNearby)}</a>
          </div>
        </article>

        <article class="surface-card journal-compression-card">
          <div class="section-head">
            <div>
              <p class="section-tag">${escapeHtml(copy.compression.tag)}</p>
              <h2>${escapeHtml(copy.compression.heading)}</h2>
            </div>
          </div>
          <div class="button-row">
            <button type="button" id="post-export-compressed">${escapeHtml(copy.compression.exportButton)}</button>
          </div>
          <label class="file-input-label">
            ${escapeHtml(copy.compression.importLabel)}
            <input id="post-import-compressed" type="file" accept="application/json,.json" />
          </label>
          <div id="post-compression-notice"></div>
          <div id="post-compression-preview" class="compression-preview"></div>
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
        <div class="comment-image-tools span-all">
          <label class="file-input-label">
            ${escapeHtml(copy.commentsSurface.imageLabel)}
            <input
              id="post-comment-image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
            />
          </label>
          <div id="post-comment-image-preview" class="comment-image-preview" hidden></div>
        </div>
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

  const commentNotice = root.querySelector("#post-comment-notice");
  const commentsContainer = root.querySelector("#post-comments");
  const commentsFooter = root.querySelector("#post-comments-footer");
  const commentBody = root.querySelector("#post-comment-body");
  const commentImageInput = root.querySelector("#post-comment-image");
  const commentImagePreview = root.querySelector("#post-comment-image-preview");
  const commentSubmitButton = root.querySelector("#post-comment-form button[type='submit']");
  const compressionNotice = root.querySelector("#post-compression-notice");
  const compressionPreview = root.querySelector("#post-compression-preview");
  const compressionImportInput = root.querySelector("#post-import-compressed");
  const likeButton = root.querySelector("#post-like");
  const heroMeta = root.querySelector("#post-hero-meta");
  let currentLikeAction = "like";
  let selectedCommentImage = null;
  let commentItems = [];
  let commentsNextCursor = "";
  let commentsTotalCount = 0;
  let commentsAvailable = false;
  let commentsError = "";
  let commentsLoading = false;
  let journalRequestToken = 0;
  let disposed = false;

  function buildFeedHref() {
    return "/feed";
  }

  function buildMapHref(destinationId) {
    return app.buildMapHref({ destinationId });
  }

  function buildComposeHref(destinationId) {
    return createUrl("/compose", { destinationId });
  }

  function syncFeedLinks() {
    root.querySelectorAll("[data-feed-href]").forEach((link) => {
      link.setAttribute("href", buildFeedHref());
    });
  }

  function syncMapLinks() {
    root.querySelectorAll("[data-map-href]").forEach((link) => {
      link.setAttribute("href", buildMapHref(link.getAttribute("data-map-destination") || ""));
    });
  }

  function syncComposeLinks() {
    root.querySelectorAll("[data-compose-href]").forEach((link) => {
      link.setAttribute("href", buildComposeHref(link.getAttribute("data-compose-destination") || ""));
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
    syncFeedLinks();
    syncMapLinks();
    syncComposeLinks();
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

  function renderSelectedCommentImage() {
    if (!selectedCommentImage) {
      commentImagePreview.innerHTML = "";
      commentImagePreview.setAttribute("hidden", "");
      return;
    }

    const file = selectedCommentImage.file;
    const previewImage = selectedCommentImage.previewUrl
      ? `<img src="${escapeHtml(selectedCommentImage.previewUrl)}" alt="${escapeHtml(copy.commentsSurface.imagePreviewAlt)}" />`
      : "";
    commentImagePreview.removeAttribute("hidden");
    commentImagePreview.innerHTML = `
      <div class="comment-image-preview-frame">${previewImage}</div>
      <div class="comment-image-preview-copy">
        <strong>${escapeHtml(file.name || copy.commentsSurface.imageFallbackTitle)}</strong>
        <span>${escapeHtml(copy.commentsSurface.imageSummary(file.type || copy.commentsSurface.unknownImageType, formatFileSize(file.size)))}</span>
      </div>
      <button type="button" class="ghost" id="post-comment-image-remove">${escapeHtml(copy.commentsSurface.removeImage)}</button>
    `;
  }

  function clearSelectedCommentImage() {
    if (selectedCommentImage) {
      revokePreviewUrl(selectedCommentImage.previewUrl);
    }
    selectedCommentImage = null;
    commentImageInput.value = "";
    renderSelectedCommentImage();
  }

  function setCommentNotice(kind, title, body) {
    commentNotice.innerHTML = noticeMarkup(kind, title, body);
  }

  function setCommentFormDisabled(disabled) {
    commentBody.disabled = disabled;
    commentImageInput.disabled = disabled;
    commentSubmitButton.disabled = disabled;
    const removeImageButton = root.querySelector("#post-comment-image-remove");
    if (removeImageButton) {
      removeImageButton.disabled = disabled;
    }
  }

  async function deleteUploadedCommentImage(url) {
    if (!url || typeof app.deleteUploadedImage !== "function") {
      return;
    }
    try {
      await app.deleteUploadedImage(url);
    } catch {
      // Cleanup is best-effort; the visible recovery path is preserving the draft.
    }
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

  function applyCommentsError() {
    commentsLoading = false;
    commentsError = copy.status.commentsLoadFailed;
    commentNotice.innerHTML = noticeMarkup("error", copy.commentsSurface.failedTitle, commentsError);
    renderComments();
  }

  async function refreshJournalDetail() {
    const token = journalRequestToken + 1;
    journalRequestToken = token;
    const detail = await app.fetchJournalDetail(route.journalId, {
      viewerUserId: currentUserId,
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
      applyCommentsError();
      throw error;
    }
  }

  function renderCompressionPreview(title, restoredBody, stats) {
    compressionPreview.innerHTML = `
      <article class="compression-preview-result">
        <p class="section-tag">${escapeHtml(copy.compression.previewTag)}</p>
        <h3>${escapeHtml(title)}</h3>
        ${compressionMetricsMarkup(stats)}
        <pre class="compression-restored-body">${escapeLiteralHtml(restoredBody)}</pre>
      </article>
    `;
  }

  function setCompressionNotice(kind, title, body) {
    compressionNotice.innerHTML = noticeMarkup(kind, title, body);
  }

  renderJournalState(journal);

  root.querySelector("#post-view").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("view", route.journalId);
      await refreshJournalDetail();
      app.setStatus(copy.status.viewRecorded, "success");
    } catch (error) {
      app.setStatus(copy.status.viewFailed, "error");
    }
  });

  root.querySelector("#post-rate").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("rate", route.journalId);
      await refreshJournalDetail();
      app.setStatus(copy.status.ratingRecorded, "success");
    } catch (error) {
      app.setStatus(copy.status.ratingFailed, "error");
    }
  });

  root.querySelector("#post-delete")?.addEventListener("click", async () => {
    try {
      await app.sendJournalAction("delete", route.journalId);
      app.navigate(buildFeedHref());
    } catch (error) {
      app.setStatus(copy.status.deleteFailed, "error");
    }
  });

  likeButton.addEventListener("click", async () => {
    try {
      const result = await app.sendJournalAction(currentLikeAction, route.journalId);
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

  root.querySelector("#post-comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = root.querySelector("#post-comment-body").value.trim();
    if (!body) {
      app.setStatus(copy.status.emptyComment, "error");
      return;
    }
    if (!commentsAvailable) {
      setCommentNotice("note", copy.commentsSurface.statusTitle, copy.commentsSurface.unavailableBody);
      app.setStatus(copy.commentsSurface.unavailableBody, "note");
      return;
    }

    let submitStage = "comment";
    let uploadedImageUrl = "";
    let commentPersisted = false;
    try {
      setCommentFormDisabled(true);
      let media = [];
      if (selectedCommentImage) {
        submitStage = "upload";
        const uploaded = await app.uploadImage(selectedCommentImage.file);
        uploadedImageUrl = text(uploaded?.url);
        if (!uploadedImageUrl) {
          throw new Error("Uploaded image URL is missing.");
        }
        media = [
          {
            type: "image",
            title: text(selectedCommentImage.file.name, copy.commentsSurface.imageFallbackTitle),
            source: uploadedImageUrl,
            note: copy.commentsSurface.imageSummary(
              uploaded?.mimeType || selectedCommentImage.file.type || copy.commentsSurface.unknownImageType,
              formatFileSize(uploaded?.size ?? selectedCommentImage.file.size),
            ),
          },
        ];
      }
      submitStage = "comment";
      const response = await app.createComment(route.journalId, body, media);
      if (!response.available) {
        await deleteUploadedCommentImage(uploadedImageUrl);
        app.setStatus(response.notice, "note");
        return;
      }
      commentPersisted = true;
      root.querySelector("#post-comment-body").value = "";
      clearSelectedCommentImage();
      await refreshJournalDetail();
      await refreshComments({ reset: true });
      app.setStatus(copy.status.commentCreated, "success");
    } catch (error) {
      if (!commentPersisted) {
        await deleteUploadedCommentImage(uploadedImageUrl);
      }
      const message = submitStage === "upload"
        ? copy.status.commentImageUploadFailed
        : copy.status.commentCreateFailed;
      setCommentNotice("error", copy.commentsSurface.failedTitle, message);
      app.setStatus(message, "error");
    } finally {
      if (commentsAvailable) {
        setCommentFormDisabled(false);
      }
    }
  });

  commentImageInput.addEventListener("change", () => {
    const file = commentImageInput.files?.[0] ?? null;
    if (!file) {
      clearSelectedCommentImage();
      return;
    }
    if (!COMMENT_IMAGE_MIME_TYPES.has(file.type)) {
      clearSelectedCommentImage();
      setCommentNotice("error", copy.commentsSurface.failedTitle, copy.status.invalidCommentImageType);
      app.setStatus(copy.status.invalidCommentImageType, "error");
      return;
    }
    if (file.size > COMMENT_IMAGE_MAX_SIZE) {
      clearSelectedCommentImage();
      setCommentNotice("error", copy.commentsSurface.failedTitle, copy.status.commentImageTooLarge);
      app.setStatus(copy.status.commentImageTooLarge, "error");
      return;
    }

    if (selectedCommentImage) {
      revokePreviewUrl(selectedCommentImage.previewUrl);
    }
    selectedCommentImage = {
      file,
      previewUrl: createPreviewUrl(file),
    };
    commentNotice.innerHTML = "";
    renderSelectedCommentImage();
  });

  commentImagePreview.addEventListener("click", (event) => {
    const button = event.target.closest("#post-comment-image-remove");
    if (!button) {
      return;
    }
    clearSelectedCommentImage();
  });

  root.addEventListener("error", (event) => {
    const image = event.target?.closest?.("[data-uploaded-media-image='true']");
    if (!image) {
      return;
    }
    image.classList.add("is-load-failed");
    image.setAttribute("aria-hidden", "true");
    image.setAttribute("hidden", "");
    image.setAttribute("alt", copy.commentsSurface.imageLoadFailed);
    const frame = image.closest(".comment-media-frame");
    if (frame) {
      frame.classList.add("is-image-load-failed");
      frame.setAttribute("data-image-state", "failed");
      frame.setAttribute("data-image-error", copy.commentsSurface.imageLoadFailed);
      const fallback = frame.querySelector("[data-uploaded-media-fallback='true']");
      if (fallback) {
        fallback.removeAttribute("hidden");
      }
    }
  }, true);

  root.querySelector("#post-export-compressed").addEventListener("click", async () => {
    try {
      const payload = await app.requestJson("/api/journal-exchange/compress", {
        method: "POST",
        body: JSON.stringify({
          body: rawString(journal.body),
        }),
      });
      const compressedBody = rawString(payload?.item?.compressed);
      if (!compressedBody.trim()) {
        throw new Error("Compressed payload is missing.");
      }
      const stats = normalizeCompressionStats(payload.item, rawString(journal.body));
      const filePayload = {
        format: COMPRESSED_JOURNAL_FORMAT,
        algorithm: COMPRESSED_JOURNAL_ALGORITHM,
        title: text(journal.title, copy.compression.previewFallbackTitle),
        compressedBody,
        stats,
        exportedAt: new Date().toISOString(),
      };
      downloadJsonFile(sanitizedDownloadName(journal.title), filePayload);
      setCompressionNotice("success", copy.compression.exportedTitle, copy.compression.exportedBody);
      app.setStatus(copy.status.compressionExported, "success");
    } catch (error) {
      setCompressionNotice("error", copy.compression.failedTitle, copy.status.compressionExportFailed);
      app.setStatus(copy.status.compressionExportFailed, "error");
    }
  });

  compressionImportInput.addEventListener("change", async () => {
    const file = compressionImportInput.files?.[0] ?? null;
    if (!file) {
      return;
    }

    try {
      if (!isCompressedJournalJsonFile(file)) {
        throw new Error("Compressed journal import must be a JSON file.");
      }
      const raw = await readTextFile(file);
      const imported = validateCompressedJournalFile(JSON.parse(raw));
      const payload = await app.requestJson("/api/journal-exchange/decompress", {
        method: "POST",
        body: JSON.stringify({
          body: imported.compressedBody,
        }),
      });
      const restoredBody = rawString(payload?.item?.text);
      if (!restoredBody.length) {
        throw new Error("Decompressed text is missing.");
      }
      renderCompressionPreview(imported.title, restoredBody, imported.stats);
      setCompressionNotice("success", copy.compression.importedTitle, copy.compression.importedBody);
      app.setStatus(copy.status.compressionImported, "success");
    } catch (error) {
      setCompressionNotice("error", copy.compression.failedTitle, copy.status.compressionImportFailed);
      app.setStatus(copy.status.compressionImportFailed, "error");
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
    if (selectedCommentImage) {
      revokePreviewUrl(selectedCommentImage.previewUrl);
      selectedCommentImage = null;
    }
  };
}
