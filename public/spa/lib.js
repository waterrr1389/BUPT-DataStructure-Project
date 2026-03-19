export function text(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value == null) {
    return fallback;
  }
  return String(value);
}

export function escapeHtml(value, fallback = "") {
  const normalized = text(value, fallback);
  return normalized
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function optionMarkup(items, config = {}) {
  const {
    value = "id",
    label = "name",
    includeBlank = false,
    blankLabel = "Select an option",
    selectedValue = "",
  } = config;
  const list = [];

  if (includeBlank) {
    list.push(
      `<option value=""${selectedValue === "" ? " selected" : ""}>${escapeHtml(blankLabel)}</option>`,
    );
  }

  safeArray(items).forEach((item) => {
    const optionValue = text(item?.[value]);
    const optionLabel = escapeHtml(item?.[label] ?? optionValue);
    const selected = optionValue === text(selectedValue) ? " selected" : "";
    list.push(`<option value="${escapeHtml(optionValue)}"${selected}>${optionLabel}</option>`);
  });

  return list.join("");
}

export function fillSelect(target, items, config = {}) {
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) {
    return null;
  }
  element.innerHTML = optionMarkup(items, config);
  return element;
}

export function tagsMarkup(tags = []) {
  const items = safeArray(tags).map((tag) => escapeHtml(tag)).filter(Boolean);
  if (!items.length) {
    return "";
  }
  return `<div class="tag-row">${items.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>`;
}

export function resultMetaMarkup(items = [], className = "result-meta") {
  const values = safeArray(items).map((item) => escapeHtml(item)).filter(Boolean);
  if (!values.length) {
    return "";
  }
  return `<div class="${escapeHtml(className)}">${values.map((item) => `<span>${item}</span>`).join("")}</div>`;
}

export function emptyStateMarkup(options = {}) {
  const title = escapeHtml(options.title || "Nothing to show yet");
  const body = escapeHtml(
    options.body || "Choose a route or run a search to populate this space.",
  );
  const actionHref = text(options.actionHref);
  const actionLabel = escapeHtml(options.actionLabel || "Open Explore");
  const actionMarkup = actionHref
    ? `<a class="inline-link" href="${escapeHtml(actionHref)}" data-nav="true">${actionLabel}</a>`
    : "";

  return `
    <article class="empty-state">
      <p class="section-tag">Calm Empty State</p>
      <h3>${title}</h3>
      <p>${body}</p>
      ${actionMarkup}
    </article>
  `;
}

export function noticeMarkup(kind, title, body) {
  return `
    <article class="notice-block is-${escapeHtml(kind || "neutral")}">
      <p class="section-tag">${escapeHtml(kind || "Note")}</p>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

export function formatDate(value) {
  if (!value) {
    return "Unknown date";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return text(value, "Unknown date");
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "$0";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

export function splitLines(value) {
  return text(value)
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function debounce(callback, delay = 280) {
  let timeoutId = null;

  function wrapped(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      callback(...args);
    }, delay);
  }

  wrapped.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return wrapped;
}

export function createUrl(pathname, params = {}) {
  const url = new URL(pathname, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return `${url.pathname}${url.search}`;
}

export function parseListInput(value) {
  return text(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function summarizeSteps(nodeNames = []) {
  const names = safeArray(nodeNames).map((entry) => escapeHtml(entry?.name ?? entry));
  return names.join(" → ");
}

export function isPrimaryNavigationEvent(event) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
