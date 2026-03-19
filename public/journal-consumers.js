(function attachJournalConsumers(root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) {
    module.exports = api
  }
  root.JournalConsumers = api
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ALL_DESTINATION_SELECTORS = [
    "#route-destination",
    "#facility-destination",
    "#food-destination",
    "#journal-destination",
    "#exchange-destination",
  ]
  const JOURNAL_EXCHANGE_SELECTORS = ["#journal-destination", "#exchange-destination"]
  const DESTINATION_SELECTOR_CONFIG = { label: "label" }

  function listOrEmpty(items) {
    return Array.isArray(items) ? items : []
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
    prepareDestinationSelectorBindings,
    prepareJournalExchangeDestinationBindings,
    resolveJournalActionRequest,
  }
})
