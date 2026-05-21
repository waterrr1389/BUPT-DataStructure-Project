// @ts-nocheck

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
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

/**
 * Wraps journal exchange results in the shared surface-card markup.
 */
function exchangeBlock(title: string, body: string) {
  return `
    <article class="surface-card exchange-result-card">
      <p class="section-tag">交换工具</p>
      <h3>${escapeHtml(title)}</h3>
      ${body}
    </article>
  `;
}

/**
 * Formats the comment count label used by feed cards.
 */
function commentCountLabel(item) {
  const value = Number(item?.commentCount);
  return Number.isFinite(value) && value > 0 ? `${value} 条评论` : "评论";
}

/**
 * Renders the journal feed plus secondary exchange tooling.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  app.setDocumentTitle("动态");

  const bootstrap = await app.loadBootstrap();
  const destinationBindings = app.getDestinationBindings();
  const users = safeArray(bootstrap?.users);
  const destinationOptions = app.getDestinationOptions();
  const actorDefault = users.some((user) => user.id === route.params.actor)
    ? route.params.actor
    : users[0]?.id || "";

  root.innerHTML = `
    <section class="route-hero route-hero-feed">
      <div class="route-hero-copy">
        <p class="eyebrow">动态</p>
        <h1>用克制的故事卡片浏览旅行笔记，同时保留课程工具。</h1>
        <p class="route-lede">
          动态页以摘要优先展示。完整内容进入 <code>/posts/&lt;journalId&gt;</code>，笔记推荐仍然可用，交换工具则作为辅助区域保留。
        </p>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">渐进降级</p>
        <ul class="hero-list">
          <li>界面会优先尝试 <code>/api/feed</code>。</li>
          <li>如果社交动态接口缺失，浏览器会回退到旧版旅行笔记时间线。</li>
          <li>点赞和评论控件会显示出来，在后端缺失时按预期降级。</li>
        </ul>
      </div>
    </section>

    <section class="feed-grid">
      <article class="surface-card feed-stream-card">
        <div class="section-head">
          <div>
            <p class="section-tag">笔记流</p>
            <h2>安静呈现旅行笔记和操作</h2>
          </div>
          <a
            class="inline-link"
            href="${escapeHtml(createUrl("/compose", actorDefault ? { actor: actorDefault } : {}))}"
            data-nav="true"
            data-compose-href="true"
          >写一篇新笔记</a>
        </div>
        <form class="control-grid" id="feed-filter-form">
          <label>
            当前身份
            <select id="feed-actor"></select>
          </label>
          <label>
            目的地筛选
            <select id="feed-destination-filter"></select>
          </label>
          <label>
            作者筛选
            <select id="feed-author-filter"></select>
          </label>
          <label>
            数量
            <input id="feed-limit" type="number" min="1" max="18" value="8" />
          </label>
          <div class="button-row">
            <button type="submit">加载最新</button>
            <button type="button" id="feed-load-recommended" class="ghost">推荐内容</button>
          </div>
        </form>
        <div id="feed-notice"></div>
        <div id="feed-results" class="story-grid"></div>
      </article>

      <aside class="surface-card exchange-card">
        <div class="section-head">
          <div>
            <p class="section-tag">笔记交换</p>
            <h2>在不离开动态的情况下搜索、压缩和生成故事板</h2>
          </div>
        </div>

        <form class="control-grid" id="feed-exchange-search-form">
          <label>
            精确标题
            <input id="feed-exchange-title" type="text" placeholder="琥珀湾现场笔记 1" />
          </label>
          <label>
            文本搜索
            <input id="feed-exchange-query" type="text" placeholder="室内大厅、餐台、黄昏路线" />
          </label>
          <label>
            目的地
            <select id="feed-exchange-destination"></select>
          </label>
          <div class="button-row">
            <button type="submit">搜索交换内容</button>
            <button type="button" id="feed-exchange-by-destination" class="ghost">加载目的地动态</button>
          </div>
        </form>

        <form class="control-grid" id="feed-compression-form">
          <label class="span-all">
            压缩文本
            <textarea id="feed-compression-body" rows="4" placeholder="粘贴一段旅行笔记用于压缩。"></textarea>
          </label>
          <div class="button-row">
            <button type="submit">压缩</button>
            <button type="button" id="feed-decompress" class="ghost">解压</button>
          </div>
        </form>

        <form class="control-grid" id="feed-storyboard-form">
          <label>
            故事标题
            <input id="feed-storyboard-title" type="text" placeholder="港湾黄昏环线" />
          </label>
          <label class="span-all">
            提示词
            <textarea id="feed-storyboard-prompt" rows="3" placeholder="描述想要生成动画的氛围、路线和片段。"></textarea>
          </label>
          <button type="submit">生成故事板</button>
        </form>

        <div id="feed-exchange-results"></div>
      </aside>
    </section>
  `;

  fillSelect(root.querySelector("#feed-actor"), users);
  fillSelect(root.querySelector("#feed-author-filter"), users, {
    includeBlank: true,
    blankLabel: "任意作者",
  });
  app.applySelectorBindings(root, destinationBindings?.selectorBindings);
  root.querySelector("#feed-exchange-destination").value = destinationOptions[0]?.id || "";
  root.querySelector("#feed-destination-filter").value = route.params.destinationId || "";
  root.querySelector("#feed-author-filter").value = route.params.author || "";
  root.querySelector("#feed-actor").value = actorDefault;

  const feedResults = root.querySelector("#feed-results");
  const feedNotice = root.querySelector("#feed-notice");
  const exchangeResults = root.querySelector("#feed-exchange-results");
  const actorSelect = root.querySelector("#feed-actor");
  const authorFilter = root.querySelector("#feed-author-filter");
  const destinationFilter = root.querySelector("#feed-destination-filter");

  let disposed = false;
  let currentFeedMode = "latest";

  function buildComposeHref(actorId) {
    return createUrl("/compose", actorId ? { actor: actorId } : {});
  }

  function syncComposeLinks(actorId) {
    root.querySelectorAll(".feed-stream-card a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (link.hasAttribute("data-compose-href") || href.startsWith("/compose")) {
        link.setAttribute("href", buildComposeHref(actorId));
      }
    });
  }

  function syncPostLinks(actorId) {
    root.querySelectorAll("[data-journal-id]").forEach((card) => {
      const journalId = card.getAttribute("data-journal-id") || "";
      if (!journalId) {
        return;
      }
      card.querySelectorAll("a").forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (href.startsWith("/posts/")) {
          link.setAttribute("href", app.buildPostHref(journalId, actorId ? { actor: actorId } : {}));
        }
      });
    });
  }

  function syncActorContext() {
    const actorId = actorSelect.value;
    syncComposeLinks(actorId);
    syncPostLinks(actorId);
  }

  function renderJournalCard(item, options = {}) {
    return app.createJournalCard(item, {
      ...options,
      actorId: actorSelect.value,
    });
  }

  async function loadFeed(mode = "latest") {
    currentFeedMode = mode;
    const actorId = actorSelect.value;
    const destinationId = destinationFilter.value;
    const authorId = authorFilter.value;
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
            items: safeArray(
              await app.fetchRecommendedJournals({
                destinationId,
                userId: actorId,
                limit,
              }),
            ).filter((item) => !authorId || item.userId === authorId),
            notice: actorId
              ? authorId
                ? "推荐笔记来自旧版笔记推荐工具，并已按所选作者筛选。"
                : "推荐笔记来自旧版笔记推荐工具。"
              : "请选择旅行者后加载推荐。",
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
      ? noticeMarkup("note", mode === "recommended" ? "推荐模式" : "动态模式", result.notice)
      : "";
    feedResults.innerHTML = safeArray(result.items).length
      ? safeArray(result.items).map((item) => renderJournalCard(item, { hideDelete: false })).join("")
      : emptyStateMarkup({
          title: "当前视图没有匹配的笔记",
          body: "可以调整目的地或作者筛选，也可以回到最新模式。",
          actionHref: buildComposeHref(actorId),
          actionLabel: "写第一篇笔记",
        });
    syncActorContext();
  }

  async function refreshExchangeResults(blocks) {
    exchangeResults.innerHTML = blocks.length
      ? blocks.join("")
      : emptyStateMarkup({
          title: "交换工具保留在辅助区域",
          body: "可以按标题或文本搜索，加载目的地动态，或在这里运行压缩和故事板生成。",
        });
  }

  async function handleJournalAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const card = button.closest("[data-journal-id]");
    const journalId = card?.dataset.journalId;
    const actorId = actorSelect.value;

    try {
      const result = await app.sendJournalAction(button.dataset.action, journalId, actorId);
      if (result.notice) {
        app.setStatus(result.notice, "note");
      }
      await loadFeed(currentFeedMode);
    } catch (error) {
      app.setStatus("笔记操作失败。", "error");
    }
  }

  root.querySelector("#feed-filter-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadFeed("latest");
    } catch (error) {
      app.setStatus("动态加载失败。", "error");
    }
  });

  root.querySelector("#feed-load-recommended").addEventListener("click", async () => {
    try {
      await loadFeed("recommended");
    } catch (error) {
      app.setStatus("推荐加载失败。", "error");
    }
  });

  actorSelect.addEventListener("change", async () => {
    syncActorContext();
    try {
      await loadFeed(currentFeedMode);
    } catch (error) {
      app.setStatus("动态加载失败。", "error");
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
            "精确标题",
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
            "文本搜索",
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
      app.setStatus("交换内容搜索失败。", "error");
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
          "目的地动态",
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
      app.setStatus("目的地交换内容加载失败。", "error");
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
          "压缩结果",
          `<p class="muted">${escapeHtml(payload.item?.compressed)}</p>${resultMetaMarkup([
            `压缩比 ${payload.item?.ratio}`,
          ])}`,
        ),
      ]);
    } catch (error) {
      app.setStatus("压缩失败。", "error");
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
        exchangeBlock("解压结果", `<p>${escapeHtml(payload.item?.text)}</p>`),
      ]);
    } catch (error) {
      app.setStatus("解压失败。", "error");
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
          payload.item?.title || "故事板",
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
      app.setStatus("故事板生成失败。", "error");
    }
  });

  syncActorContext();
  await loadFeed("latest");
  await refreshExchangeResults([]);

  return () => {
    disposed = true;
  };
}
