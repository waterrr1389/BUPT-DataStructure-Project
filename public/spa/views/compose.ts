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
      <p class="muted">${escapeHtml(state.destinationLabel || "Choose a destination")} · ${escapeHtml(
        state.authorLabel || "Choose an author",
      )}</p>
      <h3>${escapeHtml(state.title || "Untitled field note")}</h3>
      <p>${escapeHtml(state.body || "Your postcard-like travel note preview appears here.")}</p>
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
  app.setDocumentTitle("Compose");

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
        <p class="eyebrow">Compose</p>
        <h1>Write a field note like a postcard, not an admin record.</h1>
        <p class="route-lede">
          Title and destination stay near the top, the writing area is generous, and media placeholders remain lightweight support surfaces. Successful submission routes straight back into the reading flow.
        </p>
      </div>
      <div class="route-hero-panel">
        <p class="section-tag">Preserved capability</p>
        <ul class="hero-list">
          <li>Journal creation still posts to the existing backend contract.</li>
          <li>Destination selection stays aligned with the shared disambiguated labels.</li>
          <li>Optional media placeholders remain zero-dependency.</li>
        </ul>
      </div>
    </section>

    <section class="compose-grid">
      <article class="surface-card compose-card">
        <div class="section-head">
          <div>
            <p class="section-tag">Write</p>
            <h2>Field note</h2>
          </div>
          <a class="inline-link" href="/feed" data-nav="true">Back to feed</a>
        </div>
        <form class="control-grid" id="compose-form">
          <label>
            Author
            <select id="compose-user"></select>
          </label>
          <label>
            Destination
            <select id="compose-destination"></select>
          </label>
          <label class="span-all">
            Title
            <input id="compose-title" type="text" placeholder="Golden hour loop through the harbor atrium" />
          </label>
          <label class="span-all">
            Body
            <textarea id="compose-body" rows="10" placeholder="Write the route, the atmosphere, and the moment you want to remember."></textarea>
          </label>
          <label class="span-all">
            Tags
            <input id="compose-tags" type="text" placeholder="history, lake, tea stop, quiet courtyard" />
          </label>
          <details class="advanced-panel span-all">
            <summary>Optional media placeholder</summary>
            <div class="advanced-panel-grid">
              <label>
                Media title
                <input id="compose-media-title" type="text" placeholder="Cover still" />
              </label>
              <label>
                Media source
                <input id="compose-media-source" type="text" placeholder="generated://cover/demo-1" />
              </label>
              <label class="span-all">
                Media note
                <textarea id="compose-media-note" rows="3" placeholder="Short note about the image or clip."></textarea>
              </label>
            </div>
          </details>
          <button type="submit">Publish note</button>
        </form>
        <div id="compose-notice"></div>
      </article>

      <aside class="compose-sidebar">
        <article class="surface-card">
          <p class="section-tag">Live preview</p>
          <h2>How the note will read</h2>
          <div id="compose-preview"></div>
        </article>
        <article class="surface-card">
          <p class="section-tag">Reminder</p>
          <h2>What to include</h2>
          <ul class="hero-list">
            <li>Name the place clearly so Map handoff stays obvious.</li>
            <li>Describe a route, atmosphere, and one memorable detail.</li>
            <li>Keep tags sparse; they power later discovery and recommendations.</li>
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
        "Note published",
        "The routed shell will now move from Compose into the new post detail view.",
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
        "Compose error",
        error instanceof Error ? error.message : "Journal creation failed.",
      );
    }
  });

  renderPreview();

  return null;
}
