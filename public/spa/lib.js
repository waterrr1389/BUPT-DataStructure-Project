/**
 * Reads a named property from a record-like value without assuming shape.
 */
function recordValue(record, key) {
    if (!record || typeof record !== "object") {
        return undefined;
    }
    return record[key];
}
/**
 * Normalizes unknown values into a trimmed string with a fallback.
 */
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
/**
 * Escapes user-visible text for safe HTML interpolation.
 */
export function escapeHtml(value, fallback = "") {
    const normalized = text(value, fallback);
    return normalized
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
/**
 * Returns an array when the input is array-like, otherwise an empty list.
 */
export function safeArray(value) {
    return Array.isArray(value) ? value : [];
}
/**
 * Builds option markup from plain records and select configuration.
 */
export function optionMarkup(items, config = {}) {
    const { value = "id", label = "name", includeBlank = false, blankLabel = "Select an option", selectedValue = "", } = config;
    const list = [];
    if (includeBlank) {
        list.push(`<option value=""${selectedValue === "" ? " selected" : ""}>${escapeHtml(blankLabel)}</option>`);
    }
    safeArray(items).forEach((item) => {
        const optionValue = text(recordValue(item, value));
        const optionLabel = escapeHtml(recordValue(item, label) ?? optionValue);
        const selected = optionValue === text(selectedValue) ? " selected" : "";
        list.push(`<option value="${escapeHtml(optionValue)}"${selected}>${optionLabel}</option>`);
    });
    return list.join("");
}
/**
 * Replaces a select element's options while preserving the current API shape.
 */
export function fillSelect(target, items, config = {}) {
    const element = typeof target === "string" ? document.querySelector(target) : target;
    if (!element) {
        return null;
    }
    element.innerHTML = optionMarkup(items, config);
    return element;
}
/**
 * Renders a simple tag row from free-form labels.
 */
export function tagsMarkup(tags = []) {
    const items = safeArray(tags).map((tag) => escapeHtml(tag)).filter(Boolean);
    if (!items.length) {
        return "";
    }
    return `<div class="tag-row">${items.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>`;
}
/**
 * Renders compact metadata pills for result summaries.
 */
export function resultMetaMarkup(items = [], className = "result-meta") {
    const values = safeArray(items).map((item) => escapeHtml(item)).filter(Boolean);
    if (!values.length) {
        return "";
    }
    return `<div class="${escapeHtml(className)}">${values.map((item) => `<span>${item}</span>`).join("")}</div>`;
}
/**
 * Creates a reusable empty-state block with an optional contextual action.
 */
export function emptyStateMarkup(options = {}) {
    const title = escapeHtml(options.title || "Nothing to show yet");
    const body = escapeHtml(options.body || "Choose a route or run a search to populate this space.");
    const actionHref = text(options.actionHref);
    const actionLabel = escapeHtml(options.actionLabel || "Open Explore");
    const actionMarkup = actionHref
        ? `<a class="inline-link" href="${escapeHtml(actionHref)}" data-nav="true">${actionLabel}</a>`
        : "";
    const tagText = text(options.tag ?? options.sectionTag ?? "");
    const tagMarkup = tagText ? `<p class="section-tag">${escapeHtml(tagText)}</p>` : "";
    return `
    <article class="empty-state">
      ${tagMarkup}
      <h3>${title}</h3>
      <p>${body}</p>
      ${actionMarkup}
    </article>
  `;
}
/**
 * Builds a shared notice block for loading, note, success, and error states.
 */
export function noticeMarkup(kind, title, body) {
    return `
    <article class="notice-block is-${escapeHtml(kind || "neutral")}">
      <p class="section-tag">${escapeHtml(kind || "Note")}</p>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}
/**
 * Formats a date-like value into the existing English browser locale style.
 */
export function formatDate(value) {
    if (!value) {
        return "Unknown date";
    }
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
        return text(value, "Unknown date");
    }
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(parsed);
}
/**
 * Formats numeric values as USD while preserving whole-number display.
 */
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
/**
 * Clamps unknown numeric input to a closed interval.
 */
export function clampNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}
/**
 * Splits a block of prose into trimmed paragraphs.
 */
export function splitLines(value) {
    return text(value)
        .split(/\n{2,}/)
        .map((line) => line.trim())
        .filter(Boolean);
}
/**
 * Debounces a callback while exposing cancellation for view cleanup.
 */
export function debounce(callback, delay = 280) {
    let timeoutId = null;
    const wrapped = ((...args) => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = window.setTimeout(() => {
            timeoutId = null;
            callback(...args);
        }, delay);
    });
    wrapped.cancel = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };
    return wrapped;
}
/**
 * Builds an application URL from a pathname and sparse query params.
 */
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
/**
 * Reads the actor id from either a route object or a direct actor string.
 */
export function resolveRouteActor(context) {
    if (typeof context === "string") {
        return text(context);
    }
    if (!context || typeof context !== "object") {
        return "";
    }
    if ("actor" in context) {
        return text(context.actor);
    }
    return text(context.params?.actor);
}
/**
 * Merges actor context into query params without leaking blank values.
 */
export function mergeRouteContextParams(params = {}, context = null) {
    const nextParams = { ...params };
    const actor = text(nextParams.actor) || resolveRouteActor(context);
    if (actor) {
        nextParams.actor = actor;
    }
    else {
        delete nextParams.actor;
    }
    return nextParams;
}
/**
 * Creates a route href while preserving the active actor context.
 */
export function createRouteContextHref(pathname, params = {}, context = null) {
    return createUrl(pathname, mergeRouteContextParams(params, context));
}
/**
 * Parses comma-separated text into trimmed non-empty ids.
 */
export function parseListInput(value) {
    return text(value)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
/**
 * Summarizes ordered node names for route display copy.
 */
export function summarizeSteps(nodeNames = []) {
    const names = safeArray(nodeNames).map((entry) => escapeHtml(typeof entry === "object" && entry ? entry.name ?? entry : entry));
    return names.join(" → ");
}
/**
 * Detects unmodified primary-button navigation gestures for SPA interception.
 */
export function isPrimaryNavigationEvent(event) {
    return (!event.defaultPrevented &&
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey);
}
