import { appCopy } from "../copy.js";
import {
  escapeHtml,
  fillSelect,
  noticeMarkup,
  parseListInput,
  safeArray,
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
  const copy = appCopy.compose.preview;
  return `
    <article class="story-card compose-preview-card">
      <p class="muted">${escapeHtml(state.destinationLabel || copy.destinationFallback)} · ${escapeHtml(
        state.authorLabel || copy.authorFallback,
      )}</p>
      <h3>${escapeHtml(state.title || copy.titleFallback)}</h3>
      <p>${escapeHtml(state.body || copy.bodyFallback)}</p>
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
  const copy = appCopy.compose;
  app.setDocumentTitle(copy.documentTitle);

  const bootstrap = await app.loadBootstrap();
  const journalBindings = app.getJournalBindings();
  const users = safeArray(bootstrap?.users);
  const defaultDestinationId = route.params.destinationId || app.getDestinationOptions()[0]?.id || "";
  const defaultUserId = users.some((user) => user.id === route.params.actor)
    ? route.params.actor
    : app.state.currentUser?.id || users[0]?.id || "";

  root.innerHTML = `
    <section class="route-hero route-hero-compose">
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

    <section class="compose-grid">
      <article class="surface-card compose-card">
        <div class="section-head">
          <div>
            <p class="section-tag">${escapeHtml(copy.form.tag)}</p>
            <h2>${escapeHtml(copy.form.heading)}</h2>
          </div>
          <a class="inline-link" href="/feed" data-nav="true">${escapeHtml(copy.form.returnToFeed)}</a>
        </div>
        <form class="control-grid" id="compose-form">
          <label>
            ${escapeHtml(copy.form.labels.author)}
            <select id="compose-user"></select>
          </label>
          <label>
            ${escapeHtml(copy.form.labels.destination)}
            <select id="compose-destination"></select>
          </label>
          <label class="span-all">
            ${escapeHtml(copy.form.labels.title)}
            <input id="compose-title" type="text" placeholder="${escapeHtml(copy.form.placeholders.title)}" />
          </label>
          <label class="span-all">
            ${escapeHtml(copy.form.labels.body)}
            <textarea id="compose-body" rows="10" placeholder="${escapeHtml(copy.form.placeholders.body)}"></textarea>
          </label>
          <label class="span-all">
            ${escapeHtml(copy.form.labels.tags)}
            <input id="compose-tags" type="text" placeholder="${escapeHtml(copy.form.placeholders.tags)}" />
          </label>
          <details class="advanced-panel span-all">
            <summary>${escapeHtml(copy.form.mediaSummary)}</summary>
            <div class="advanced-panel-grid">
              <label>
                ${escapeHtml(copy.form.labels.mediaTitle)}
                <input id="compose-media-title" type="text" placeholder="${escapeHtml(copy.form.placeholders.mediaTitle)}" />
              </label>
              <label>
                ${escapeHtml(copy.form.labels.mediaSource)}
                <input id="compose-media-source" type="text" placeholder="${escapeHtml(copy.form.placeholders.mediaSource)}" />
              </label>
              <label class="span-all">
                ${escapeHtml(copy.form.labels.mediaNote)}
                <textarea id="compose-media-note" rows="3" placeholder="${escapeHtml(copy.form.placeholders.mediaNote)}"></textarea>
              </label>
            </div>
          </details>
          <button type="submit">${escapeHtml(copy.form.submit)}</button>
        </form>
        <div id="compose-notice"></div>
      </article>

      <aside class="compose-sidebar">
        <article class="surface-card">
          <p class="section-tag">${escapeHtml(copy.preview.tag)}</p>
          <h2>${escapeHtml(copy.preview.heading)}</h2>
          <div id="compose-preview"></div>
        </article>
        <article class="surface-card">
          <p class="section-tag">${escapeHtml(copy.prompts.tag)}</p>
          <h2>${escapeHtml(copy.prompts.heading)}</h2>
          <ul class="hero-list">
            ${copy.prompts.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
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
        copy.notices.createdTitle,
        copy.notices.createdBody,
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
        copy.notices.failedTitle,
        copy.notices.failedBody,
      );
    }
  });

  renderPreview();

  return null;
}
