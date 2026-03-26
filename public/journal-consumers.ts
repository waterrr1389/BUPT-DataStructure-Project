declare const module:
  | {
      exports?: unknown;
    }
  | undefined;

const ALL_DESTINATION_SELECTORS = [
  "#explore-facility-destination",
  "#explore-food-destination",
  "#map-destination",
  "#feed-destination-filter",
  "#feed-exchange-destination",
  "#compose-destination",
] as const;

const JOURNAL_EXCHANGE_SELECTORS = [
  "#compose-destination",
  "#feed-exchange-destination",
] as const;

const DESTINATION_SELECTOR_CONFIG = { label: "label" } as const;

type DestinationLike = {
  id?: string;
  [key: string]: unknown;
};

type DestinationOptionLike = DestinationLike & {
  label?: string;
};

type BootstrapPayload<TDestination extends DestinationLike = DestinationLike> = {
  destinations?: TDestination[];
  featured?: TDestination[];
};

type SelectorBinding<TOption extends DestinationOptionLike> = {
  config: typeof DESTINATION_SELECTOR_CONFIG;
  items: TOption[];
  selector: string;
};

type PreparedDestinationBindings<
  TDestination extends DestinationLike,
  TOption extends DestinationOptionLike,
> = {
  destinationById: Map<string, TDestination>;
  destinationOptions: TOption[];
  featuredDestinations: TDestination[];
  selectorBindings: Array<SelectorBinding<TOption>>;
};

type PreparedJournalExchangeBindings<
  TDestination extends DestinationLike,
  TOption extends DestinationOptionLike,
> = Omit<PreparedDestinationBindings<TDestination, TOption>, "destinationOptions"> & {
  journalDestinationOptions: TOption[];
};

type DestinationSelectFactory<
  TDestination extends DestinationLike,
  TOption extends DestinationOptionLike,
> = (destinations: TDestination[]) => TOption[];

type JournalCardMetadata = {
  attribution?: unknown;
};

type JournalCardItem = {
  averageRating?: unknown;
  body?: unknown;
  commentCount?: unknown;
  id?: unknown;
  likeCount?: unknown;
  ratings?: unknown;
  summaryBody?: unknown;
  tags?: unknown;
  title?: unknown;
  viewerHasLiked?: boolean;
  views?: unknown;
};

type JournalCardOptions = {
  hideDelete?: boolean;
  hideSocialAction?: boolean;
  hideSocialMeta?: boolean;
  mapHref?: unknown;
  postHref?: unknown;
  summarizeBody?: (body: string, maxLength?: number) => string;
  summaryLength?: unknown;
};

type JournalActionRequest =
  | {
      options: {
        body?: string;
        method: string;
      };
      path: string;
    }
  | null;

type JournalConsumersApi = {
  journalCard(
    item: JournalCardItem | null | undefined,
    metadata: JournalCardMetadata | null | undefined,
    renderTagsMarkup: ((tags: string[]) => string) | null | undefined,
    options?: JournalCardOptions,
  ): string;
  prepareDestinationSelectorBindings<
    TDestination extends DestinationLike,
    TOption extends DestinationOptionLike = TDestination,
  >(
    bootstrap: BootstrapPayload<TDestination> | null | undefined,
    createDestinationSelectOptions?: DestinationSelectFactory<TDestination, TOption> | null,
    selectors?: readonly string[],
  ): PreparedDestinationBindings<TDestination, TOption>;
  prepareJournalExchangeDestinationBindings<
    TDestination extends DestinationLike,
    TOption extends DestinationOptionLike = TDestination,
  >(
    bootstrap: BootstrapPayload<TDestination> | null | undefined,
    createDestinationSelectOptions?: DestinationSelectFactory<TDestination, TOption> | null,
  ): PreparedJournalExchangeBindings<TDestination, TOption>;
  resolveJournalActionRequest(
    action: string,
    journalId: string,
    selectedUserId?: string,
  ): JournalActionRequest;
};

type JournalConsumersRoot = typeof globalThis & {
  JournalConsumers?: JournalConsumersApi;
};

/**
 * Publishes the helper API to both browser-global and CommonJS consumers.
 */
(function attachJournalConsumers(
  root: JournalConsumersRoot,
  factory: () => JournalConsumersApi,
): void {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.JournalConsumers = api;
})(
  (typeof globalThis !== "undefined" ? globalThis : this) as JournalConsumersRoot,
  () => {
    /**
     * Returns an array only when the input is already array-like.
     */
    function listOrEmpty<TItem>(items: TItem[] | null | undefined): TItem[] {
      return Array.isArray(items) ? items : [];
    }

    /**
     * Normalizes display text while preserving a fallback for empty values.
     */
    function text(value: unknown, fallback = ""): string {
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
     * Escapes HTML-sensitive text for safe inline markup output.
     */
    function escapeHtml(value: unknown, fallback = ""): string {
      return text(value, fallback)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    /**
     * Creates a compact journal summary without splitting a later word boundary.
     */
    function summarizeBody(value: unknown, maxLength = 180): string {
      const normalized = text(value).replace(/\s+/g, " ");
      if (normalized.length <= maxLength) {
        return normalized;
      }

      const trimmed = normalized.slice(0, Math.max(0, maxLength - 3));
      const boundary = trimmed.lastIndexOf(" ");
      return `${(boundary > 40 ? trimmed.slice(0, boundary) : trimmed).trim()}...`;
    }

    /**
     * Converts a numeric input to a finite number with a fallback.
     */
    function numberOr(value: unknown, fallback = 0): number {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    /**
     * Indexes destinations by id while ignoring records without usable ids.
     */
    function createDestinationByIdLookup<TDestination extends DestinationLike>(
      destinations: TDestination[] | null | undefined,
    ): Map<string, TDestination> {
      return new Map(
        listOrEmpty(destinations)
          .filter(
            (destination): destination is TDestination & { id: string } =>
              typeof destination?.id === "string" && destination.id.length > 0,
          )
          .map((destination) => [destination.id, destination]),
      );
    }

    /**
     * Prepares the shared destination option payload for all destination selectors.
     */
    function prepareDestinationSelectorBindings<
      TDestination extends DestinationLike,
      TOption extends DestinationOptionLike = TDestination,
    >(
      bootstrap: BootstrapPayload<TDestination> | null | undefined,
      createDestinationSelectOptions?: DestinationSelectFactory<TDestination, TOption> | null,
      selectors: readonly string[] = ALL_DESTINATION_SELECTORS,
    ): PreparedDestinationBindings<TDestination, TOption> {
      const featuredDestinations = listOrEmpty(bootstrap?.featured);
      const allDestinations = listOrEmpty(bootstrap?.destinations);
      const authoritativeDestinations = allDestinations.length ? allDestinations : featuredDestinations;
      const optionFactory =
        typeof createDestinationSelectOptions === "function"
          ? createDestinationSelectOptions
          : ((items: TDestination[]) => items as unknown as TOption[]);
      const destinationOptions = optionFactory(authoritativeDestinations);

      return {
        destinationById: createDestinationByIdLookup([
          ...featuredDestinations,
          ...authoritativeDestinations,
        ]),
        destinationOptions,
        featuredDestinations,
        selectorBindings: listOrEmpty([...selectors]).map((selector) => ({
          selector,
          items: destinationOptions,
          config: DESTINATION_SELECTOR_CONFIG,
        })),
      };
    }

    /**
     * Narrows the shared destination selector payload to journal exchange targets.
     */
    function prepareJournalExchangeDestinationBindings<
      TDestination extends DestinationLike,
      TOption extends DestinationOptionLike = TDestination,
    >(
      bootstrap: BootstrapPayload<TDestination> | null | undefined,
      createDestinationSelectOptions?: DestinationSelectFactory<TDestination, TOption> | null,
    ): PreparedJournalExchangeBindings<TDestination, TOption> {
      const { destinationOptions: journalDestinationOptions, ...prepared } =
        prepareDestinationSelectorBindings(
          bootstrap,
          createDestinationSelectOptions,
          JOURNAL_EXCHANGE_SELECTORS,
        );

      return {
        ...prepared,
        journalDestinationOptions,
      };
    }

    /**
     * Renders the journal card markup used by the browser shell and feed views.
     */
    function journalCard(
      item: JournalCardItem | null | undefined,
      metadata: JournalCardMetadata | null | undefined,
      renderTagsMarkup: ((tags: string[]) => string) | null | undefined,
      options: JournalCardOptions = {},
    ): string {
      const attribution = text(metadata?.attribution);
      const ratings = Array.isArray(item?.ratings) ? item.ratings : null;
      const tags = Array.isArray(item?.tags) ? item.tags : [];
      const mapHref = text(options?.mapHref);
      const postHref = text(options?.postHref);
      const hideDelete = options?.hideDelete === true;
      const hideSocialAction = options?.hideSocialAction === true;
      const hideSocialMeta = options?.hideSocialMeta === true;
      const summaryLength = Number.isFinite(Number(options?.summaryLength))
        ? Number(options.summaryLength)
        : 220;
      const summarize =
        typeof options?.summarizeBody === "function" ? options.summarizeBody : summarizeBody;
      const journalId = text(item?.id);
      const title = text(item?.title);
      const summarySource = text(item?.summaryBody, text(item?.body));
      const likeCount = numberOr(item?.likeCount);
      const commentCount = numberOr(item?.commentCount);
      const tagsMarkup = typeof renderTagsMarkup === "function" ? renderTagsMarkup(tags) : "";
      const likeAction = item?.viewerHasLiked ? "unlike" : "like";
      const likeLabel = likeAction === "like" ? "Like" : "Unlike";
      const summary = text(
        summarize(summarySource, summaryLength),
        summarizeBody(summarySource, summaryLength),
      );
      const metadataItems = [
        `views ${numberOr(item?.views)}`,
        `rating ${numberOr(item?.averageRating).toFixed(1)}`,
        ratings ? `${ratings.length} scores` : "",
        hideSocialMeta ? "" : `${likeCount} likes`,
        hideSocialMeta ? "" : `${commentCount} comments`,
      ]
        .filter(Boolean)
        .map((value) => `<span>${escapeHtml(value)}</span>`)
        .join("");

      return `
      <article class="result-card" data-journal-id="${escapeHtml(journalId)}">
        <p class="muted">${escapeHtml(attribution)}</p>
        <h3>${escapeHtml(title)}</h3>
        <div class="result-meta">${metadataItems}</div>
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
    `;
    }

    /**
     * Maps UI journal actions to the request payload expected by the API.
     */
    function resolveJournalActionRequest(
      action: string,
      journalId: string,
      selectedUserId?: string,
    ): JournalActionRequest {
      if (!journalId) {
        return null;
      }

      if (action === "view") {
        return {
          path: `/api/journals/${journalId}/view`,
          options: { method: "POST", body: "{}" },
        };
      }

      if (action === "rate") {
        return {
          path: `/api/journals/${journalId}/rate`,
          options: {
            method: "POST",
            body: JSON.stringify({ userId: selectedUserId, score: 5 }),
          },
        };
      }

      if (action === "delete") {
        return {
          path: `/api/journals/${journalId}`,
          options: { method: "DELETE" },
        };
      }

      if (action === "like") {
        return {
          path: `/api/journals/${journalId}/likes`,
          options: {
            method: "POST",
            body: JSON.stringify({ userId: selectedUserId }),
          },
        };
      }

      if (action === "unlike") {
        return {
          path: `/api/journals/${journalId}/likes`,
          options: {
            method: "DELETE",
            body: JSON.stringify({ userId: selectedUserId }),
          },
        };
      }

      return null;
    }

    return {
      journalCard,
      prepareDestinationSelectorBindings,
      prepareJournalExchangeDestinationBindings,
      resolveJournalActionRequest,
    };
  },
);
