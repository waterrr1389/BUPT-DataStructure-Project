import {
  escapeHtml,
  fillSelect,
  noticeMarkup,
  parseListInput,
  resultMetaMarkup,
  safeArray,
  text,
} from "../lib.js";
import type { JsonRecord, SpaApp, SpaRoute, ViewCleanup } from "../types.js";

type ComposePreviewState = {
  authorLabel: string;
  body: string;
  destinationLabel: string;
  tags: string[];
  title: string;
};

/**
 * Builds the live preview card shown beside the compose form.
 */
function previewMarkup(state: ComposePreviewState): string {
  return `
    <article class="story-card compose-preview-card">
      <p class="muted">${escapeHtml(state.destinationLabel || "请选择目的地")} · ${escapeHtml(
        state.authorLabel || "请选择作者",
      )}</p>
      <h3>${escapeHtml(state.title || "未命名现场笔记")}</h3>
      <p>${escapeHtml(state.body || "明信片式旅行笔记预览会显示在这里。")}</p>
      ${state.tags.length ? `<div class="tag-row">${state.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    </article>
  `;
}

/**
 * Renders the compose view and preserves destination and actor handoff on publish.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  app.setDocumentTitle("写笔记");

  const bootstrap = await app.loadBootstrap();
  const journalBindings = app.getJournalBindings();
  const users = safeArray(bootstrap?.users);
  const defaultDestinationId = route.params.destinationId || app.getDestinationOptions()[0]?.id || "";
  const defaultUserId = users.some((user) => user.id === route.params.actor)
    ? route.params.actor
    : users[0]?.id || "";

  root.innerHTML = `
    <section class="route-hero route-hero-compose">
      <div class="route-hero-copy">
        <p class="eyebrow">写笔记</p>
        <h1>像写明信片一样写现场笔记，而不是填写管理记录。</h1>
        <p class="route-lede">
          标题和目的地保持在上方，正文区域足够宽松，媒体占位只作为轻量辅助。提交成功后会直接回到阅读流程。
        </p>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">保留能力</p>
        <ul class="hero-list">
          <li>笔记创建仍然提交到既有后端契约。</li>
          <li>目的地选择继续使用共享的消歧标签。</li>
          <li>可选媒体占位保持零依赖。</li>
        </ul>
      </div>
    </section>

    <section class="compose-grid">
      <article class="surface-card compose-card">
        <div class="section-head">
          <div>
            <p class="section-tag">撰写</p>
            <h2>现场笔记</h2>
          </div>
          <a class="inline-link" href="/feed" data-nav="true">返回动态</a>
        </div>
        <form class="control-grid" id="compose-form">
          <label>
            作者
            <select id="compose-user"></select>
          </label>
          <label>
            目的地
            <select id="compose-destination"></select>
          </label>
          <label class="span-all">
            标题
            <input id="compose-title" type="text" placeholder="金色时刻穿过港湾中庭的环线" />
          </label>
          <label class="span-all">
            正文
            <textarea id="compose-body" rows="10" placeholder="写下路线、气氛，以及你想记住的那个瞬间。"></textarea>
          </label>
          <label class="span-all">
            标签
            <input id="compose-tags" type="text" placeholder="历史、湖边、茶歇、安静庭院" />
          </label>
          <details class="advanced-panel span-all">
            <summary>可选媒体占位</summary>
            <div class="advanced-panel-grid">
              <label>
                媒体标题
                <input id="compose-media-title" type="text" placeholder="封面定帧" />
              </label>
              <label>
                媒体来源
                <input id="compose-media-source" type="text" placeholder="generated://cover/demo-1" />
              </label>
              <label class="span-all">
                媒体说明
                <textarea id="compose-media-note" rows="3" placeholder="简单说明这张图片或这段片段。"></textarea>
              </label>
            </div>
          </details>
          <button type="submit">发布笔记</button>
        </form>
        <div id="compose-notice"></div>
      </article>

      <aside class="compose-sidebar">
        <article class="surface-card">
          <p class="section-tag">实时预览</p>
          <h2>笔记阅读效果</h2>
          <div id="compose-preview"></div>
        </article>
        <article class="surface-card">
          <p class="section-tag">提醒</p>
          <h2>可以写什么</h2>
          <ul class="hero-list">
            <li>清楚写出地点，方便后续交接到地图。</li>
            <li>描述一条路线、一种气氛和一个难忘细节。</li>
            <li>标签保持克制；它们会参与后续发现和推荐。</li>
          </ul>
        </article>
      </aside>
    </section>
  `;

  fillSelect(root.querySelector("#compose-user"), users, { selectedValue: defaultUserId });
  app.applySelectorBindings(root, journalBindings?.selectorBindings);
  root.querySelector("#compose-destination").value = defaultDestinationId;

  const preview = root.querySelector("#compose-preview") as HTMLDivElement;
  const notice = root.querySelector("#compose-notice") as HTMLDivElement;
  const authorSelect = root.querySelector("#compose-user") as HTMLSelectElement;
  const destinationSelect = root.querySelector("#compose-destination") as HTMLSelectElement;
  const titleInput = root.querySelector("#compose-title") as HTMLInputElement;
  const bodyInput = root.querySelector("#compose-body") as HTMLTextAreaElement;
  const tagsInput = root.querySelector("#compose-tags") as HTMLInputElement;

  function renderPreview(): void {
    preview.innerHTML = previewMarkup({
      authorLabel: app.getUserName(authorSelect.value),
      destinationLabel: app.getDestinationName(destinationSelect.value),
      title: titleInput.value.trim(),
      body: bodyInput.value.trim().slice(0, 260),
      tags: parseListInput(tagsInput.value),
    });
  }

  [authorSelect, destinationSelect, titleInput, bodyInput, tagsInput].forEach((element) => {
    element.addEventListener("input", renderPreview);
    element.addEventListener("change", renderPreview);
  });

  root.querySelector("#compose-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mediaTitle = (root.querySelector("#compose-media-title") as HTMLInputElement).value.trim();
    const mediaSource = (root.querySelector("#compose-media-source") as HTMLInputElement).value.trim();
    const mediaNote = (root.querySelector("#compose-media-note") as HTMLTextAreaElement).value.trim();

    try {
      const payload = await app.requestJson<{ item?: JsonRecord }>("/api/journals", {
        method: "POST",
        body: JSON.stringify({
          userId: authorSelect.value,
          destinationId: destinationSelect.value,
          title: titleInput.value,
          body: bodyInput.value,
          tags: parseListInput(tagsInput.value),
          media:
            mediaTitle && mediaSource
              ? [
                  {
                    type: "image",
                    title: mediaTitle,
                    source: mediaSource,
                    note: mediaNote || undefined,
                  },
                ]
              : [],
        }),
      });

      notice.innerHTML = noticeMarkup(
        "success",
        "笔记已发布",
        "路由界面将从写笔记页进入新的笔记详情视图。",
      );
      const createdId = payload.item?.id;
      if (createdId) {
        app.navigate(app.buildPostHref(createdId, authorSelect.value ? { actor: authorSelect.value } : {}));
      } else {
        app.navigate("/feed");
      }
    } catch (error) {
      notice.innerHTML = noticeMarkup(
        "note",
        "写笔记出错",
        "笔记创建失败。",
      );
    }
  });

  renderPreview();

  return null;
}
