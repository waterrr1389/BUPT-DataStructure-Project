import { escapeHtml, noticeMarkup, resultMetaMarkup, safeArray, text } from "../lib.js";
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
  app.setDocumentTitle("Trail Atlas");

  const bootstrap = await app.loadBootstrap();
  const featuredDestinations = app.getFeaturedDestinations().slice(0, 4);
  let feedPreview: JsonRecord[] = [];
  let feedNotice = "";

  try {
    const feed = await app.fetchFeed({ limit: 3 });
    feedPreview = feed.items.slice(0, 3);
    feedNotice = feed.notice;
  } catch {
    feedNotice = "动态预览暂时不可用。";
  }

  root.innerHTML = `
    <section class="route-hero route-hero-home">
      <div class="route-hero-copy">
        <p class="eyebrow">安静精致的旅行日志</p>
        <h1>记录路线，留住气氛，也能再次回到那个地点。</h1>
        <p class="route-lede">
          Trail Atlas 现在是一套按路线组织的浏览器体验。你可以探索目的地，在需要空间细节时打开地图，浏览克制的旅行笔记动态，也可以直接写下现场记录。
        </p>
        <div class="hero-actions">
          <a class="primary-link" href="/explore" data-nav="true">打开探索</a>
          <a class="secondary-link" href="/feed" data-nav="true">阅读动态</a>
          <a class="secondary-link" href="/map" data-nav="true">进入地图</a>
        </div>
        ${resultMetaMarkup([
          `${safeArray(bootstrap?.destinations).length} 个目的地`,
          `${safeArray(bootstrap?.users).length} 位本地旅行者`,
          `${safeArray(bootstrap?.featured).length} 个精选地点`,
        ], "result-meta hero-metrics")}
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">主要路径</p>
        <ul class="hero-list">
          <li>探索页保留目的地推荐、美食发现和附近设施。</li>
          <li>地图页继续承载路线规划和目的地图结构可视化。</li>
          <li>动态和笔记详情把旅行日志呈现为更像故事的阅读体验。</li>
          <li>写笔记页保持宽松、轻量的创作流程。</li>
        </ul>
      </div>
    </section>

    <section class="home-grid">
      <article class="surface-card home-card">
        <div class="section-head">
          <div>
            <p class="section-tag">精选地点</p>
            <h2>从目的地开始，而不是从控制面板开始</h2>
          </div>
          <a class="inline-link" href="/explore" data-nav="true">浏览全部</a>
        </div>
        <div class="story-grid">
          ${featuredDestinations
            .map(
              (destination) => `
                <article class="story-card compact-story-card">
                  <p class="muted">${escapeHtml(destination.type)} · ${escapeHtml(destination.region)}</p>
                  <h3>${escapeHtml(destination.name)}</h3>
                  ${resultMetaMarkup([
                    `热度 ${destination.heat}`,
                    `评分 ${destination.rating}`,
                    `${destination.nodeCount} 个节点`,
                  ])}
                  <p>${escapeHtml(destination.description)}</p>
                  <div class="story-card-actions">
                    <a class="inline-link" href="/map?destinationId=${encodeURIComponent(text(destination.id))}" data-nav="true">在地图中打开</a>
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
            <p class="section-tag">笔记预览</p>
            <h2>最近笔记，无需完整社交层也能加载</h2>
          </div>
          <a class="inline-link" href="/feed" data-nav="true">打开动态</a>
        </div>
        ${feedNotice ? noticeMarkup("note", "动态备用来源", feedNotice) : ""}
        ${
          feedPreview.length
            ? `<div class="story-grid">${feedPreview
                .map((item) => withoutJournalActions(app.createJournalCard(item, { hideDelete: true })))
                .join("")}</div>`
            : noticeMarkup(
                "quiet",
                "暂无预览笔记",
                "动态预览为空，但路由界面已经可以直接进入 /feed 和 /posts/<journalId>。",
              )
        }
      </article>
    </section>
  `;

  return null;
}
