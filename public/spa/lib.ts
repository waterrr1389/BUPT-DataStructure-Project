import type {
  DebouncedFunction,
  EmptyStateOptions,
  OptionMarkupConfig,
  RouteActorContext,
} from "./types.js";

type NamedRecord = Record<string, unknown>;
type FillableElement = {
  innerHTML: string;
};

type NavigationLikeEvent = {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/**
 * Reads a named property from a record-like value without assuming shape.
 */
function recordValue(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object") {
    return undefined;
  }
  return (record as NamedRecord)[key];
}

/**
 * Normalizes unknown values into a trimmed string with a fallback.
 */
export function text(value: unknown, fallback = ""): string {
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
export function escapeHtml(value: unknown, fallback = ""): string {
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
export function safeArray<T>(value: readonly T[] | T[] | unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Builds option markup from plain records and select configuration.
 */
export function optionMarkup(
  items: readonly NamedRecord[] | NamedRecord[] | unknown,
  config: OptionMarkupConfig = {},
): string {
  const {
    value = "id",
    label = "name",
    includeBlank = false,
    blankLabel = "Select an option",
    selectedValue = "",
  } = config;
  const list: string[] = [];

  if (includeBlank) {
    list.push(
      `<option value=""${selectedValue === "" ? " selected" : ""}>${escapeHtml(blankLabel)}</option>`,
    );
  }

  safeArray<NamedRecord>(items).forEach((item) => {
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
export function fillSelect<TElement extends FillableElement>(
  target: string | TElement | null,
  items: readonly NamedRecord[] | NamedRecord[] | unknown,
  config: OptionMarkupConfig = {},
): TElement | Element | null {
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
export function tagsMarkup(tags: readonly unknown[] | unknown = []): string {
  const items = safeArray(tags).map((tag) => escapeHtml(tag)).filter(Boolean);
  if (!items.length) {
    return "";
  }
  return `<div class="tag-row">${items.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>`;
}

/**
 * Renders compact metadata pills for result summaries.
 */
export function resultMetaMarkup(
  items: readonly unknown[] | unknown = [],
  className = "result-meta",
): string {
  const values = safeArray(items).map((item) => escapeHtml(item)).filter(Boolean);
  if (!values.length) {
    return "";
  }
  return `<div class="${escapeHtml(className)}">${values.map((item) => `<span>${item}</span>`).join("")}</div>`;
}

/**
 * Creates a reusable empty-state block with an optional contextual action.
 */
export function emptyStateMarkup(options: EmptyStateOptions = {}): string {
  const title = escapeHtml(options.title || "Nothing to show yet");
  const body = escapeHtml(
    options.body || "Choose a route or run a search to populate this space.",
  );
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
export function noticeMarkup(kind: unknown, title: unknown, body: unknown): string {
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
export function formatDate(value: unknown): string {
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
export function formatMoney(value: unknown): string {
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
export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Splits a block of prose into trimmed paragraphs.
 */
export function splitLines(value: unknown): string[] {
  return text(value)
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Debounces a callback while exposing cancellation for view cleanup.
 */
export function debounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay = 280,
): DebouncedFunction<TArgs> {
  let timeoutId: number | null = null;

  const wrapped = ((...args: TArgs) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      callback(...args);
    }, delay);
  }) as DebouncedFunction<TArgs>;

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
export function createUrl(pathname: string, params: Record<string, unknown> = {}): string {
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
export function resolveRouteActor(context: RouteActorContext): string {
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
export function mergeRouteContextParams(
  params: Record<string, unknown> = {},
  context: RouteActorContext = null,
): Record<string, unknown> {
  const nextParams: Record<string, unknown> = { ...params };
  const actor = text(nextParams.actor) || resolveRouteActor(context);

  if (actor) {
    nextParams.actor = actor;
  } else {
    delete nextParams.actor;
  }

  return nextParams;
}

/**
 * Creates a route href while preserving the active actor context.
 */
export function createRouteContextHref(
  pathname: string,
  params: Record<string, unknown> = {},
  context: RouteActorContext = null,
): string {
  return createUrl(pathname, mergeRouteContextParams(params, context));
}

/**
 * Parses comma-separated text into trimmed non-empty ids.
 */
export function parseListInput(value: unknown): string[] {
  return text(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Summarizes ordered node names for route display copy.
 */
export function summarizeSteps(
  nodeNames: readonly ({ name?: unknown } | unknown)[] | unknown = [],
): string {
  const names = safeArray(nodeNames).map((entry) =>
    escapeHtml(typeof entry === "object" && entry ? (entry as { name?: unknown }).name ?? entry : entry),
  );
  return names.join(" → ");
}

/**
 * Detects unmodified primary-button navigation gestures for SPA interception.
 */
export function isPrimaryNavigationEvent(event: NavigationLikeEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
