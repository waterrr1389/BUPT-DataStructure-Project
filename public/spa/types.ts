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

export type JournalActionResult = {
  notice?: string;
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
  state: SpaAppState;
  setDocumentTitle(title: string): void;
  setStatus(message: string, tone?: string): void;
  navigate(href: string, options?: Record<string, unknown>): void;
  requestJson<TResponse = JsonRecord>(
    path: string,
    options?: RequestJsonOptions,
  ): Promise<TResponse>;
  loadBootstrap(): Promise<JsonRecord>;
  getBootstrap(): JsonRecord | null;
  getDestinationBindings(): DestinationBindings | null;
  getJournalBindings(): DestinationBindings | null;
  getDestinationOptions(): SelectOption[];
  getFeaturedDestinations(): JsonRecord[];
  getCategories(): string[];
  getCuisines(): string[];
  fetchFeed(filters?: Record<string, unknown>): Promise<FeedResult>;
  fetchRecommendedJournals(filters?: Record<string, unknown>): Promise<JsonRecord[]>;
  fetchJournalDetail(journalId: string, options?: Record<string, unknown>): Promise<JsonRecord>;
  fetchJournalComments(
    journalId: string,
    options?: Record<string, unknown>,
  ): Promise<CommentResponse>;
  createComment?(journalId: string, userId: string, body: string): Promise<JsonRecord>;
  sendJournalAction?(
    action: string,
    journalId: string,
    selectedUserId: string,
  ): Promise<JournalActionResult>;
  ensureDestinationDetails(destinationId: string): Promise<JsonRecord | null>;
  applySelectorBindings(container: ParentNode, bindings?: SelectorBinding[] | null): void;
  getUserName(userId: string): string;
  getDestinationName(destinationId: string): string;
  buildMapHref(params?: Record<string, string>): string;
  buildPostHref(journalId: string, params?: Record<string, string>): string;
  createJournalCard(item: JsonRecord, options?: Record<string, unknown>): string;
  debounce<TArgs extends unknown[]>(
    callback: (...args: TArgs) => void,
    delay?: number,
  ): DebouncedFunction<TArgs>;
  tagsMarkup(tags?: unknown[]): string;
}

export interface SpaAppShell extends SpaApp {
  start(): Promise<void>;
  parseRoute(url?: URL): SpaRoute;
}
