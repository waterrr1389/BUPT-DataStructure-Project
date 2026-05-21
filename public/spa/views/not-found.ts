import { escapeHtml } from "../lib.js";
import type { SpaApp, SpaRoute, ViewCleanup } from "../types.js";

/**
 * Renders the deliberate SPA fallback route for unknown client-side paths.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  app.setDocumentTitle("未找到");

  root.innerHTML = `
    <section class="route-hero route-hero-home">
      <div class="route-hero-copy">
        <p class="eyebrow">未找到</p>
        <h1>这个前端路由不在单页应用外壳中。</h1>
        <p class="route-lede">
          服务器已经为 <code>${escapeHtml(
            route.pathname,
          )}</code> 返回浏览器应用外壳；客户端将它解析为明确的备用页面，而不是空白屏幕或意外 404。
        </p>
        <div class="hero-actions">
          <a class="primary-link" href="/" data-nav="true">回到首页</a>
          <a class="secondary-link" href="/explore" data-nav="true">打开探索</a>
          <a class="secondary-link" href="/feed" data-nav="true">打开动态</a>
        </div>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">已知路由</p>
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
