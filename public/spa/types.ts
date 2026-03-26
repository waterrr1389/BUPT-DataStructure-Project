export type JsonRecord = Record<string, unknown>;

export type RouteName = "home" | "explore" | "map" | "feed" | "compose" | "post" | "notFound";

export type RouteParams = {
  destinationId: string;
  from: string;
  to: string;
  waypoints: string;
  strategy: string;
  mode: string;
  view: string;
  actor: string;
  author: string;
};

export type SpaRoute = {
  name: RouteName;
  pathname: string;
  search: string;
  params: RouteParams;
  journalId?: string;
};

export type ViewCleanup = (() => void) | null | void;

export type SelectOption = {
  id: string;
  name: string;
  [key: string]: unknown;
};

export type OptionMarkupConfig = {
  value?: string;
  label?: string;
  includeBlank?: boolean;
  blankLabel?: string;
  selectedValue?: string;
};

export type EmptyStateOptions = {
  title?: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
  tag?: string;
  sectionTag?: string;
};

export type RequestJsonOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: string;
  headers?: Record<string, string>;
};

export type RouteActorContext =
  | string
  | {
      actor?: unknown;
      params?: {
        actor?: unknown;
      };
    }
  | null
  | undefined;

export type SelectorBinding = {
  selector: string;
  items: SelectOption[];
  config?: OptionMarkupConfig;
};

export type DestinationBindings = {
  selectorBindings?: SelectorBinding[];
};

export type FeedResult = {
  items: JsonRecord[];
  nextCursor?: string;
  notice: string;
  source?: string;
};

export type CommentResponse = {
  available: boolean;
  items: JsonRecord[];
  nextCursor: string;
  notice: string;
  totalCount: number;
};

export type CommentCreationResult = {
  available: boolean;
  item: JsonRecord | null;
  notice: string;
};

export type JournalActionResult = {
  available: boolean;
  notice?: string;
  payload: unknown;
};

export type DebouncedFunction<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  cancel(): void;
};

export type SpaAppState = {
  mapScenes: Map<string, unknown>;
  lastCompressed: string;
  [key: string]: unknown;
};

export interface SpaApp {
  /** Stores mutable runtime data shared across SPA views. */
  state: SpaAppState;
  /** Updates the document title using the shell naming convention. */
  setDocumentTitle(title: string): void;
  /** Announces a shell status message with an optional tone token. */
  setStatus(message: string, tone?: string): void;
  /** Changes the active SPA route without forcing a full page load. */
  navigate(href: string, options?: Record<string, unknown>): void;
  /** Sends a JSON request and rejects when the response is not successful. */
  requestJson<TResponse = JsonRecord>(
    path: string,
    options?: RequestJsonOptions,
  ): Promise<TResponse>;
  /** Loads and caches the bootstrap payload required by SPA views. */
  loadBootstrap(): Promise<JsonRecord>;
  /** Returns the cached bootstrap payload when it has already been loaded. */
  getBootstrap(): JsonRecord | null;
  /** Returns destination selector bindings prepared from bootstrap data. */
  getDestinationBindings(): DestinationBindings | null;
  /** Returns journal exchange selector bindings prepared from bootstrap data. */
  getJournalBindings(): DestinationBindings | null;
  /** Returns the destination select options derived from bootstrap data. */
  getDestinationOptions(): SelectOption[];
  /** Returns the featured destinations advertised by the bootstrap payload. */
  getFeaturedDestinations(): JsonRecord[];
  /** Returns the category list exposed by bootstrap data. */
  getCategories(): string[];
  /** Returns the cuisine list exposed by bootstrap data. */
  getCuisines(): string[];
  /** Loads feed items and reports whether the social feed or fallback source was used. */
  fetchFeed(filters?: Record<string, unknown>): Promise<FeedResult>;
  /** Loads recommended journals for the supplied filter context. */
  fetchRecommendedJournals(filters?: Record<string, unknown>): Promise<JsonRecord[]>;
  /** Loads a single journal detail record for the requested journal id. */
  fetchJournalDetail(journalId: string, options?: Record<string, unknown>): Promise<JsonRecord>;
  /** Loads journal comments and reports whether comment APIs are available. */
  fetchJournalComments(
    journalId: string,
    options?: Record<string, unknown>,
  ): Promise<CommentResponse>;
  /** Attempts to create a journal comment and reports comment endpoint availability. */
  createComment(journalId: string, userId: string, body: string): Promise<CommentCreationResult>;
  /** Sends a supported journal action and returns an availability-aware result envelope. */
  sendJournalAction(
    action: string,
    journalId: string,
    selectedUserId: string,
  ): Promise<JournalActionResult>;
  /** Loads and caches destination detail data for the requested destination id. */
  ensureDestinationDetails(destinationId: string): Promise<JsonRecord | null>;
  /** Fills matching select elements inside a container from selector bindings. */
  applySelectorBindings(container: ParentNode, bindings?: SelectorBinding[] | null): void;
  /** Returns the display name for a user id when the shell has that bootstrap data. */
  getUserName(userId: string): string;
  /** Returns the display name for a destination id when the shell has that bootstrap data. */
  getDestinationName(destinationId: string): string;
  /** Builds a map route href while preserving SPA route context rules. */
  buildMapHref(params?: Record<string, string>): string;
  /** Builds a post detail href while preserving SPA route context rules. */
  buildPostHref(journalId: string, params?: Record<string, string>): string;
  /** Renders a journal card string using the shell presentation helpers. */
  createJournalCard(item: JsonRecord, options?: Record<string, unknown>): string;
  /** Wraps a callback in a debounced function that can also be cancelled. */
  debounce<TArgs extends unknown[]>(
    callback: (...args: TArgs) => void,
    delay?: number,
  ): DebouncedFunction<TArgs>;
  /** Renders tag markup from a list-like tag payload. */
  tagsMarkup(tags?: unknown[]): string;
}

export interface SpaAppShell extends SpaApp {
  /** Renders the shell, installs event handlers, and opens the current route. */
  start(): Promise<void>;
  /** Parses a URL into the route contract consumed by SPA views. */
  parseRoute(url?: URL): SpaRoute;
}
