(function attachJournalConsumers(root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) {
    module.exports = api
  }
  root.JournalConsumers = api
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function listOrEmpty(items) {
    return Array.isArray(items) ? items : []
  }

  function prepareJournalExchangeDestinationBindings(bootstrap, createDestinationSelectOptions) {
    const featuredDestinations = listOrEmpty(bootstrap?.featured)
    const allDestinations = listOrEmpty(bootstrap?.destinations)
    const journalDestinations = allDestinations.length ? allDestinations : featuredDestinations
    const optionFactory =
      typeof createDestinationSelectOptions === "function" ? createDestinationSelectOptions : (items) => items
    const journalDestinationOptions = optionFactory(journalDestinations)
    const allKnownDestinations = [...featuredDestinations, ...journalDestinations]
    const selectorConfig = { label: "label" }
    const selectors = ["#journal-destination", "#exchange-destination"]

    return {
      destinationById: new Map(allKnownDestinations.map((destination) => [destination.id, destination])),
      featuredDestinations,
      journalDestinationOptions,
      selectorBindings: selectors.map((selector) => ({
        selector,
        items: journalDestinationOptions,
        config: selectorConfig,
      })),
    }
  }

  function journalCard(item, metadata, renderTagsMarkup) {
    const attribution = metadata?.attribution || ""
    const ratings = Array.isArray(item?.ratings) ? item.ratings : []
    const tags = Array.isArray(item?.tags) ? item.tags : []
    const tagsMarkup = typeof renderTagsMarkup === "function" ? renderTagsMarkup(tags) : ""
    const title = typeof item?.title === "string" ? item.title : ""
    const body = typeof item?.body === "string" ? item.body : ""

    return `
      <article class="result-card" data-journal-id="${item?.id || ""}">
        <p class="muted">${attribution}</p>
        <h3>${title}</h3>
        <div class="result-meta">
          <span>views ${item?.views || 0}</span>
          <span>rating ${item?.averageRating || 0}</span>
          <span>${ratings.length} scores</span>
        </div>
        <p>${body.slice(0, 180)}</p>
        ${tagsMarkup}
        <div class="actions">
          <button type="button" data-action="view">Add view</button>
          <button type="button" data-action="rate">Rate 5</button>
          <button type="button" data-action="delete" class="ghost">Delete</button>
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

    return null
  }

  return {
    journalCard,
    prepareJournalExchangeDestinationBindings,
    resolveJournalActionRequest,
  }
})
