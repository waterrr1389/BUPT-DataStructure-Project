(function attachJournalConsumers(root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) {
    module.exports = api
  }
  root.JournalConsumers = api
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ALL_DESTINATION_SELECTORS = [
    "#explore-facility-destination",
    "#explore-food-destination",
    "#map-destination",
    "#feed-destination-filter",
    "#feed-exchange-destination",
    "#compose-destination",
  ]
  const JOURNAL_EXCHANGE_SELECTORS = ["#compose-destination", "#feed-exchange-destination"]
  const DESTINATION_SELECTOR_CONFIG = { label: "label" }

  function listOrEmpty(items) {
    return Array.isArray(items) ? items : []
  }

  function text(value, fallback = "") {
    if (typeof value === "string") {
      const trimmed = value.trim()
      return trimmed || fallback
    }
    if (value == null) {
      return fallback
    }
    return String(value)
  }

  function escapeHtml(value, fallback = "") {
    return text(value, fallback)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }

  function summarizeBody(value, maxLength = 180) {
    const normalized = text(value).replace(/\s+/g, " ")
    if (normalized.length <= maxLength) {
      return normalized
    }

    const trimmed = normalized.slice(0, Math.max(0, maxLength - 3))
    const boundary = trimmed.lastIndexOf(" ")
    return `${(boundary > 40 ? trimmed.slice(0, boundary) : trimmed).trim()}...`
  }

  function numberOr(value, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  function createDestinationByIdLookup(destinations) {
    return new Map(
      listOrEmpty(destinations)
        .filter((destination) => destination && destination.id)
        .map((destination) => [destination.id, destination]),
    )
  }

  function prepareDestinationSelectorBindings(
    bootstrap,
    createDestinationSelectOptions,
    selectors = ALL_DESTINATION_SELECTORS,
  ) {
    const featuredDestinations = listOrEmpty(bootstrap?.featured)
    const allDestinations = listOrEmpty(bootstrap?.destinations)
    const authoritativeDestinations = allDestinations.length ? allDestinations : featuredDestinations
    const optionFactory =
      typeof createDestinationSelectOptions === "function" ? createDestinationSelectOptions : (items) => items
    const destinationOptions = optionFactory(authoritativeDestinations)

    return {
      destinationById: createDestinationByIdLookup([...featuredDestinations, ...authoritativeDestinations]),
      destinationOptions,
      featuredDestinations,
      selectorBindings: listOrEmpty(selectors).map((selector) => ({
        selector,
        items: destinationOptions,
        config: DESTINATION_SELECTOR_CONFIG,
      })),
    }
  }

  function prepareJournalExchangeDestinationBindings(bootstrap, createDestinationSelectOptions) {
    const { destinationOptions: journalDestinationOptions, ...prepared } = prepareDestinationSelectorBindings(
      bootstrap,
      createDestinationSelectOptions,
      JOURNAL_EXCHANGE_SELECTORS,
    )

    return {
      ...prepared,
      journalDestinationOptions,
    }
  }

  function journalCard(item, metadata, renderTagsMarkup, options = {}) {
    const attribution = text(metadata?.attribution)
    const ratings = Array.isArray(item?.ratings) ? item.ratings : []
    const tags = Array.isArray(item?.tags) ? item.tags : []
    const mapHref = text(options?.mapHref)
    const postHref = text(options?.postHref)
    const hideDelete = options?.hideDelete === true
    const hideSocialAction = options?.hideSocialAction === true
    const summaryLength = Number.isFinite(Number(options?.summaryLength))
      ? Number(options.summaryLength)
      : 220
    const summarize =
      typeof options?.summarizeBody === "function"
        ? options.summarizeBody
        : summarizeBody
    const journalId = text(item?.id)
    const title = text(item?.title)
    const body = text(item?.body)
    const likeCount = numberOr(item?.likeCount)
    const commentCount = numberOr(item?.commentCount)
    const tagsMarkup = typeof renderTagsMarkup === "function" ? renderTagsMarkup(tags) : ""
    const likeAction = item?.viewerHasLiked ? "unlike" : "like"
    const likeLabel = likeAction === "like" ? "Like" : "Unlike"
    const summary = text(summarize(body, summaryLength), summarizeBody(body, summaryLength))

    return `
      <article class="result-card" data-journal-id="${escapeHtml(journalId)}">
        <p class="muted">${escapeHtml(attribution)}</p>
        <h3>${escapeHtml(title)}</h3>
        <div class="result-meta">
          <span>views ${numberOr(item?.views)}</span>
          <span>rating ${numberOr(item?.averageRating).toFixed(1)}</span>
          <span>${ratings.length} scores</span>
          <span>${likeCount} likes</span>
          <span>${commentCount} comments</span>
        </div>
        <p>${escapeHtml(summary)}</p>
        ${tagsMarkup}
        <div class="story-card-actions">
          ${postHref ? `<a class="inline-link" href="${escapeHtml(postHref)}" data-nav="true">Open post</a>` : ""}
          ${mapHref ? `<a class="inline-link" href="${escapeHtml(mapHref)}" data-nav="true">Open in map</a>` : ""}
        </div>
        <div class="actions">
          <button type="button" data-action="view">Add view</button>
          <button type="button" data-action="rate">Rate 5</button>
          ${hideSocialAction ? "" : `<button type="button" data-action="${likeAction}" class="ghost">${likeLabel}</button>`}
          ${hideDelete ? "" : `<button type="button" data-action="delete" class="ghost">Delete</button>`}
        </div>
      </article>
    `
  }

  function resolveJournalActionRequest(action, journalId, selectedUserId) {
    if (!journalId) {
      return null
    }

    if (action === "view") {
      return {
        path: `/api/journals/${journalId}/view`,
        options: { method: "POST", body: "{}" },
      }
    }

    if (action === "rate") {
      return {
        path: `/api/journals/${journalId}/rate`,
        options: {
          method: "POST",
          body: JSON.stringify({ userId: selectedUserId, score: 5 }),
        },
      }
    }

    if (action === "delete") {
      return {
        path: `/api/journals/${journalId}`,
        options: { method: "DELETE" },
      }
    }

    if (action === "like") {
      return {
        path: `/api/journals/${journalId}/likes`,
        options: {
          method: "POST",
          body: JSON.stringify({ userId: selectedUserId }),
        },
      }
    }

    if (action === "unlike") {
      return {
        path: `/api/journals/${journalId}/likes`,
        options: {
          method: "DELETE",
          body: JSON.stringify({ userId: selectedUserId }),
        },
      }
    }

    return null
  }

  return {
    journalCard,
    prepareDestinationSelectorBindings,
    prepareJournalExchangeDestinationBindings,
    resolveJournalActionRequest,
  }
})
