// @ts-nocheck

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
const mediaTypeLabels: Record<string, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  media: "媒体",
};

function mediaTypeLabel(value: unknown): string {
  const key = typeof value === "string" ? value.trim() : "";
  return mediaTypeLabels[key] || "媒体";
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
  app.setDocumentTitle("笔记详情");

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
          <p class="eyebrow">笔记详情</p>
          <h1>找不到这篇笔记。</h1>
          <p class="route-lede">这篇笔记暂时无法加载。</p>
          <div class="hero-actions">
            <a class="primary-link" href="${escapeHtml(feedHref)}" data-nav="true">返回动态</a>
            <a class="secondary-link" href="${escapeHtml(composeHref)}" data-nav="true">写一篇新笔记</a>
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
        <p class="eyebrow">笔记详情</p>
        <h1 id="post-hero-title">${escapeHtml(journal.title)}</h1>
        <p class="route-lede" id="post-hero-attribution">
          ${escapeHtml(destinationName)} / ${escapeHtml(authorName)}
        </p>
        <div id="post-hero-meta">
          ${resultMetaMarkup([
            `浏览 ${journal.views || 0}`,
            `评分 ${journal.averageRating || 0}`,
            `${safeArray(journal.ratings).length} 个评分`,
            journal.likeCount != null ? `${journal.likeCount} 个赞` : "",
            journal.commentCount != null ? `${journal.commentCount} 条评论` : "",
          ])}
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">辅助上下文</p>
        <ul class="hero-list">
          <li>阅读质量优先；地图上下文作为可选辅助内容保留。</li>
          <li>评论和点赞在社交接口缺失时按预期降级。</li>
          <li>旧版笔记操作仍然可以在这里使用。</li>
        </ul>
      </div>
    </section>

    <section class="detail-grid">
      <article class="surface-card detail-story-card">
        <div class="section-head">
          <div>
            <p class="section-tag">现场笔记</p>
            <h2 id="post-story-title">${escapeHtml(journal.title)}</h2>
          </div>
          <a class="inline-link" href="${escapeHtml(feedHref)}" data-nav="true" data-feed-href="true">返回动态</a>
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
                      <h3>${escapeHtml(entry.title || "未命名媒体")}</h3>
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
          <p class="section-tag">笔记操作</p>
          <h2>轻量控制</h2>
          <form class="control-grid" id="post-action-form">
            <label>
              当前身份
              <select id="post-actor"></select>
            </label>
          </form>
          <div class="button-row">
            <button type="button" id="post-view">增加浏览</button>
            <button type="button" id="post-rate" class="ghost">评分 5</button>
            <button type="button" id="post-like" class="ghost">点赞</button>
            <button type="button" id="post-delete" class="ghost">删除</button>
          </div>
          ${resultMetaMarkup([
            `创建于 ${formatDate(journal.createdAt)}`,
            `更新于 ${formatDate(journal.updatedAt)}`,
          ])}
          <div class="story-card-actions">
            <a
              class="inline-link"
              href="${escapeHtml(buildMapHref(actorDefault, journal.destinationId))}"
              data-nav="true"
              data-map-href="true"
              data-map-destination="${escapeHtml(journal.destinationId)}"
            >在地图中打开目的地</a>
            <a
              class="inline-link"
              href="${escapeHtml(buildComposeHref(actorDefault, journal.destinationId))}"
              data-nav="true"
              data-compose-href="true"
              data-compose-destination="${escapeHtml(journal.destinationId)}"
            >写一篇附近笔记</a>
          </div>
        </article>

        <article class="surface-card">
          <div class="section-head">
            <div>
              <p class="section-tag">地图上下文</p>
              <h2>按需加载地点上下文</h2>
            </div>
          </div>
          <button type="button" id="post-load-map" class="ghost">显示目的地上下文</button>
          <div id="post-map-context">
            ${emptyStateMarkup({
              title: "地图上下文是辅助信息",
              body: "只有当空间细节对这篇笔记有帮助时，再打开辅助目的地图结构。",
            })}
          </div>
        </article>
      </aside>
    </section>

    <section class="surface-card comments-card">
      <div class="section-head">
        <div>
          <p class="section-tag">对话</p>
          <h2>评论</h2>
        </div>
      </div>
      <form class="control-grid" id="post-comment-form">
        <label class="span-all">
          添加评论
          <textarea id="post-comment-body" rows="4" placeholder="分享一个安静的观察，或一条路线提示。"></textarea>
        </label>
        <button type="submit">发布评论</button>
      </form>
      <div id="post-comment-notice"></div>
      <div id="post-comments">
        ${emptyStateMarkup({
          title: "评论加载中",
          body: "详情页会在这里检查社交接口；如果接口缺失，会按预期降级。",
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
      `浏览 ${item.views || 0}`,
      `评分 ${item.averageRating || 0}`,
      `${safeArray(item.ratings).length} 个评分`,
      item.likeCount != null ? `${item.likeCount} 个赞` : "",
      item.commentCount != null ? `${item.commentCount} 条评论` : "",
    ]);
  }

  function renderJournalState(item) {
    journal = item;
    renderHeroMeta(journal);
    currentLikeAction = journal.viewerHasLiked ? "unlike" : "like";
    likeButton.textContent = currentLikeAction === "like" ? "点赞" : "取消点赞";
    syncFeedLinks(actorSelect.value);
    syncMapLinks(actorSelect.value);
    syncComposeLinks(actorSelect.value);
  }

  function renderComments() {
    commentsContainer.innerHTML = commentsLoading && !commentItems.length
      ? emptyStateMarkup({
          title: "评论加载中",
          body: "正在加载这篇笔记的当前评论页。",
        })
      : commentsError && !commentItems.length
      ? emptyStateMarkup({
          title: "评论加载失败",
          body: commentsError,
        })
      : commentItems.length
      ? commentItems.map((item) => commentMarkup(app, item)).join("")
      : emptyStateMarkup({
          title: commentsAvailable ? "暂无评论" : "评论不可用",
          body: commentsAvailable
            ? "从这篇笔记开始一段安静的对话。"
            : "当前工作区尚未提供后端评论接口。",
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
            ? `已显示 ${commentItems.length} / ${commentsTotalCount} 条评论`
            : `${commentsTotalCount} 条评论`,
        ]),
      );
    }
    if (commentsNextCursor) {
      footerParts.push(`
        <div class="button-row">
          <button type="button" id="post-comments-more" class="ghost"${commentsLoading ? " disabled" : ""}>${commentsLoading ? "加载中..." : "加载更多评论"}</button>
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
      ? noticeMarkup(response.available ? "note" : "quiet", "评论状态", response.notice)
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
    commentsError = "评论无法加载。";
    commentNotice.innerHTML = noticeMarkup("error", "评论加载失败", commentsError);
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
      app.setStatus("浏览已记录。", "success");
    } catch (error) {
      app.setStatus("浏览操作失败。", "error");
    }
  });

  root.querySelector("#post-rate").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("rate", route.journalId, actorSelect.value);
      await refreshJournalDetail();
      app.setStatus("评分已记录。", "success");
    } catch (error) {
      app.setStatus("评分操作失败。", "error");
    }
  });

  root.querySelector("#post-delete").addEventListener("click", async () => {
    try {
      await app.sendJournalAction("delete", route.journalId, actorSelect.value);
      app.navigate(buildFeedHref(actorSelect.value));
    } catch (error) {
      app.setStatus("删除操作失败。", "error");
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
      app.setStatus("点赞状态已更新。", "success");
    } catch (error) {
      app.setStatus("点赞操作失败。", "error");
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
        "笔记详情刷新失败。",
        "error",
      );
    }
  });

  root.querySelector("#post-comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = root.querySelector("#post-comment-body").value.trim();
    if (!body) {
      app.setStatus("评论内容不能为空。", "error");
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
      app.setStatus("评论已发布。", "success");
    } catch (error) {
      app.setStatus("评论发布失败。", "error");
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
        "地图上下文不可用",
        "无法加载目的地上下文。",
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
      app.setStatus("评论无法加载。", "error");
    }
  });

  try {
    await refreshComments({ reset: true });
  } catch (error) {
    app.setStatus("评论无法加载。", "error");
  }

  return () => {
    disposed = true;
  };
}
