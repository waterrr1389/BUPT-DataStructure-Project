import { appCopy } from "../copy.js";
import {
  escapeHtml,
  noticeMarkup,
  parseListInput,
  text,
} from "../lib.js";
import type { JsonRecord, SpaApp, SpaRoute, ViewCleanup } from "../types.js";

const COMPOSE_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const COMPOSE_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type ComposePreviewState = {
  authorLabel: string;
  body: string;
  destinationLabel: string;
  tags: string[];
  title: string;
};

type SelectedComposeImage = {
  file: File;
  previewUrl: string;
};

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

function createPreviewUrl(file: File): string {
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
 * Renders the compose view and publishes with the authenticated browser user.
 */
export async function render(
  app: SpaApp,
  route: SpaRoute,
  root: HTMLElement,
): Promise<ViewCleanup> {
  const copy = appCopy.compose;
  app.setDocumentTitle(copy.documentTitle);

  await app.loadBootstrap();
  const journalBindings = app.getJournalBindings();
  const currentUser = app.getCurrentUser();
  const defaultDestinationId = route.params.destinationId || app.getDestinationOptions()[0]?.id || "";
  const currentUserName = currentUser?.id ? app.getUserName(String(currentUser.id)) : "";

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
          <div class="readonly-field" id="compose-current-user">
            <span>${escapeHtml(copy.form.labels.author)}</span>
            <strong>${escapeHtml(currentUserName || copy.preview.authorFallback)}</strong>
          </div>
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
              <label class="file-input-label span-all">
                ${escapeHtml(copy.form.labels.mediaImage)}
                <input
                  id="compose-media-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                />
              </label>
              <div id="compose-media-preview" class="comment-image-preview compose-image-preview span-all" hidden></div>
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

  app.applySelectorBindings(root, journalBindings?.selectorBindings);
  root.querySelector("#compose-destination").value = defaultDestinationId;

  const preview = root.querySelector("#compose-preview") as HTMLDivElement;
  const notice = root.querySelector("#compose-notice") as HTMLDivElement;
  const destinationSelect = root.querySelector("#compose-destination") as HTMLSelectElement;
  const titleInput = root.querySelector("#compose-title") as HTMLInputElement;
  const bodyInput = root.querySelector("#compose-body") as HTMLTextAreaElement;
  const tagsInput = root.querySelector("#compose-tags") as HTMLInputElement;
  const form = root.querySelector("#compose-form") as HTMLFormElement;
  const submitButton = form.querySelector("button[type='submit']") as HTMLButtonElement;
  const mediaTitleInput = root.querySelector("#compose-media-title") as HTMLInputElement;
  const mediaImageInput = root.querySelector("#compose-media-image") as HTMLInputElement;
  const mediaImagePreview = root.querySelector("#compose-media-preview") as HTMLDivElement;
  const mediaNoteInput = root.querySelector("#compose-media-note") as HTMLTextAreaElement;
  let selectedComposeImage: SelectedComposeImage | null = null;

  function renderPreview(): void {
    preview.innerHTML = previewMarkup({
      authorLabel: currentUserName,
      destinationLabel: app.getDestinationName(destinationSelect.value),
      title: titleInput.value.trim(),
      body: bodyInput.value.trim().slice(0, 260),
      tags: parseListInput(tagsInput.value),
    });
  }

  function renderSelectedComposeImage(): void {
    if (!selectedComposeImage) {
      mediaImagePreview.innerHTML = "";
      mediaImagePreview.setAttribute("hidden", "");
      return;
    }

    const file = selectedComposeImage.file;
    const previewImage = selectedComposeImage.previewUrl
      ? `<img src="${escapeHtml(selectedComposeImage.previewUrl)}" alt="${escapeHtml(copy.form.imagePreviewAlt)}" />`
      : "";
    mediaImagePreview.removeAttribute("hidden");
    mediaImagePreview.innerHTML = `
      <div class="comment-image-preview-frame">${previewImage}</div>
      <div class="comment-image-preview-copy">
        <strong>${escapeHtml(file.name || copy.form.imageFallbackTitle)}</strong>
        <span>${escapeHtml(copy.form.imageSummary(file.type || copy.form.unknownImageType, formatFileSize(file.size)))}</span>
      </div>
      <button type="button" class="ghost" id="compose-media-image-remove">${escapeHtml(copy.form.removeImage)}</button>
    `;
  }

  function clearSelectedComposeImage(): void {
    if (selectedComposeImage) {
      revokePreviewUrl(selectedComposeImage.previewUrl);
    }
    selectedComposeImage = null;
    mediaImageInput.value = "";
    renderSelectedComposeImage();
  }

  function setFormDisabled(disabled: boolean): void {
    destinationSelect.disabled = disabled;
    titleInput.disabled = disabled;
    bodyInput.disabled = disabled;
    tagsInput.disabled = disabled;
    mediaTitleInput.disabled = disabled;
    mediaImageInput.disabled = disabled;
    mediaNoteInput.disabled = disabled;
    submitButton.disabled = disabled;
    const removeImageButton = root.querySelector("#compose-media-image-remove") as HTMLButtonElement | null;
    if (removeImageButton) {
      removeImageButton.disabled = disabled;
    }
  }

  async function deleteUploadedComposeImage(url: string): Promise<void> {
    if (!url || typeof app.deleteUploadedImage !== "function") {
      return;
    }
    try {
      await app.deleteUploadedImage(url);
    } catch {
      // Cleanup is best-effort; the visible recovery path is preserving the draft.
    }
  }

  [destinationSelect, titleInput, bodyInput, tagsInput].forEach((element) => {
    element.addEventListener("input", renderPreview);
    element.addEventListener("change", renderPreview);
  });

  mediaImageInput.addEventListener("change", () => {
    const file = mediaImageInput.files?.[0] ?? null;
    if (!file) {
      clearSelectedComposeImage();
      return;
    }
    if (!COMPOSE_IMAGE_MIME_TYPES.has(file.type)) {
      clearSelectedComposeImage();
      notice.innerHTML = noticeMarkup("error", copy.notices.failedTitle, copy.notices.invalidImageType);
      return;
    }
    if (file.size > COMPOSE_IMAGE_MAX_SIZE) {
      clearSelectedComposeImage();
      notice.innerHTML = noticeMarkup("error", copy.notices.failedTitle, copy.notices.imageTooLarge);
      return;
    }

    if (selectedComposeImage) {
      revokePreviewUrl(selectedComposeImage.previewUrl);
    }
    selectedComposeImage = {
      file,
      previewUrl: createPreviewUrl(file),
    };
    notice.innerHTML = "";
    renderSelectedComposeImage();
  });

  mediaImagePreview.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest("#compose-media-image-remove");
    if (!button) {
      return;
    }
    clearSelectedComposeImage();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mediaTitle = mediaTitleInput.value.trim();
    const mediaNote = mediaNoteInput.value.trim();
    let submitStage: "upload" | "journal" = "journal";
    let uploadedImageUrl = "";
    let journalPersisted = false;

    try {
      setFormDisabled(true);
      const media = [];
      if (selectedComposeImage) {
        submitStage = "upload";
        const uploaded = await app.uploadImage(selectedComposeImage.file);
        uploadedImageUrl = text(uploaded?.url);
        if (!uploadedImageUrl) {
          throw new Error("Uploaded image URL is missing.");
        }
        media.push({
          type: "image",
          title: mediaTitle || text(selectedComposeImage.file.name, copy.form.imageFallbackTitle),
          source: uploadedImageUrl,
          note: mediaNote || copy.form.imageSummary(
            uploaded?.mimeType || selectedComposeImage.file.type || copy.form.unknownImageType,
            formatFileSize(uploaded?.size ?? selectedComposeImage.file.size),
          ),
        });
      }

      submitStage = "journal";
      const payload = await app.requestJson<{ item?: JsonRecord }>("/api/journals", {
        method: "POST",
        body: JSON.stringify({
          destinationId: destinationSelect.value,
          title: titleInput.value,
          body: bodyInput.value,
          tags: parseListInput(tagsInput.value),
          media,
        }),
      });
      journalPersisted = true;

      notice.innerHTML = noticeMarkup(
        "success",
        copy.notices.createdTitle,
        copy.notices.createdBody,
      );
      const createdId = payload.item?.id;
      if (createdId) {
        app.navigate(app.buildPostHref(createdId));
      } else {
        app.navigate("/feed");
      }
    } catch (error) {
      if (!journalPersisted) {
        await deleteUploadedComposeImage(uploadedImageUrl);
      }
      notice.innerHTML = noticeMarkup(
        "error",
        copy.notices.failedTitle,
        submitStage === "upload" ? copy.notices.uploadFailedBody : copy.notices.failedBody,
      );
    } finally {
      setFormDisabled(false);
    }
  });

  renderPreview();

  return () => {
    clearSelectedComposeImage();
  };
}
