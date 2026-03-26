declare const module:
  | {
      exports?: unknown;
    }
  | undefined;

type NamedRecord = {
  id?: string;
  name?: string;
};

type JournalMetadataInput = {
  destinationId?: string;
  userId?: string;
};

type LookupLike<TRecord> =
  | {
      get(key: string): TRecord | undefined;
    }
  | undefined;

type LabelledRecord<TItem extends Record<string, unknown>> = TItem & {
  label: string;
};

type LabelEntry<TItem extends Record<string, unknown>> = {
  baseLabel: string;
  item: TItem;
  key: string;
  qualifierParts: string[];
};

type LabelOptionConfig<TItem extends Record<string, unknown>> = {
  getBaseLabel?: (item: TItem | undefined) => unknown;
  getKey?: (item: TItem | undefined) => unknown;
  getQualifierParts?: (item: TItem | undefined) => unknown;
};

type DestinationInput = {
  id?: string;
  name?: string;
  region?: string;
  [key: string]: unknown;
};

type JournalMetadataLookups = {
  destinationById?: LookupLike<NamedRecord>;
  userById?: LookupLike<NamedRecord>;
};

type JournalPresentationApi = {
  createDestinationSelectOptions(
    destinations: DestinationInput[] | null | undefined,
  ): LabelledRecord<DestinationInput>[];
  createSelectOptionsWithDisambiguatedLabels<TItem extends Record<string, unknown>>(
    items: TItem[] | null | undefined,
    options?: LabelOptionConfig<TItem>,
  ): LabelledRecord<TItem>[];
  formatJournalMetadata(
    journal: JournalMetadataInput | null | undefined,
    lookups?: JournalMetadataLookups,
  ): {
    attribution: string;
    destinationLabel: string;
    userLabel: string;
  };
  resolveLookupLabel(
    id: string | null | undefined,
    lookup: LookupLike<NamedRecord>,
    fallbackLabel: string,
  ): string;
  summarizeText(value: unknown, maxLength?: number): string;
};

type JournalPresentationRoot = typeof globalThis & {
  JournalPresentation?: JournalPresentationApi;
};

/**
 * Publishes the helper API to both browser-global and CommonJS consumers.
 */
(function attachJournalPresentation(
  root: JournalPresentationRoot,
  factory: () => JournalPresentationApi,
): void {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.JournalPresentation = api;
})(
  (typeof globalThis !== "undefined" ? globalThis : this) as JournalPresentationRoot,
  () => {
    /**
     * Normalizes user-facing text while keeping a fallback for empty input.
     */
    function normalizeText(value: unknown, fallback = ""): string {
      if (typeof value !== "string") {
        return value == null ? fallback : String(value);
      }
      const trimmed = value.trim();
      return trimmed || fallback;
    }

    /**
     * Converts label qualifiers into a clean list of display-safe parts.
     */
    function normalizeQualifierParts(parts: unknown): string[] {
      const list = Array.isArray(parts) ? parts : parts == null ? [] : [parts];
      return list.map((part) => normalizeText(part)).filter(Boolean);
    }

    /**
     * Builds a candidate label from the current disambiguation depth.
     */
    function createLabelCandidate<TItem extends Record<string, unknown>>(
      entry: LabelEntry<TItem>,
      depth: number,
    ): string {
      const qualifier = entry.qualifierParts.slice(0, depth).join(" · ");
      return qualifier ? `${entry.baseLabel} (${qualifier})` : `${entry.baseLabel} [${entry.key}]`;
    }

    /**
     * Produces select options that widen qualifiers only when labels collide.
     */
    function createSelectOptionsWithDisambiguatedLabels<TItem extends Record<string, unknown>>(
      items: TItem[] | null | undefined,
      {
        getKey = (item) => item?.id,
        getBaseLabel = (item) => item?.name ?? item?.id,
        getQualifierParts = (item) => [item?.id],
      }: LabelOptionConfig<TItem> = {},
    ): LabelledRecord<TItem>[] {
      const prepared = (Array.isArray(items) ? items : []).map((item, index) => {
        const key = normalizeText(getKey(item), `item-${index + 1}`);
        const baseLabel = normalizeText(getBaseLabel(item), key);
        const qualifierParts = normalizeQualifierParts(getQualifierParts(item));

        if (!qualifierParts.includes(key)) {
          qualifierParts.push(key);
        }

        return {
          item,
          key,
          baseLabel,
          qualifierParts,
        };
      });

      const groupByBaseLabel = new Map<string, Array<LabelEntry<TItem>>>();
      prepared.forEach((entry) => {
        if (!groupByBaseLabel.has(entry.baseLabel)) {
          groupByBaseLabel.set(entry.baseLabel, []);
        }
        groupByBaseLabel.get(entry.baseLabel)?.push(entry);
      });

      return prepared.map((entry) => {
        const group = groupByBaseLabel.get(entry.baseLabel) ?? [];
        if (group.length === 1) {
          return {
            ...entry.item,
            label: entry.baseLabel,
          };
        }

        const maxDepth = Math.max(0, ...group.map((candidate) => candidate.qualifierParts.length));
        for (let depth = 1; depth <= maxDepth; depth += 1) {
          const labels = group.map((candidate) => createLabelCandidate(candidate, depth));
          if (new Set(labels).size === labels.length) {
            return {
              ...entry.item,
              label: createLabelCandidate(entry, depth),
            };
          }
        }

        return {
          ...entry.item,
          label: `${entry.baseLabel} [${entry.key}]`,
        };
      });
    }

    /**
     * Applies destination-specific qualifiers for shared destination selectors.
     */
    function createDestinationSelectOptions(
      destinations: DestinationInput[] | null | undefined,
    ): LabelledRecord<DestinationInput>[] {
      return createSelectOptionsWithDisambiguatedLabels(destinations, {
        getKey: (destination) => destination?.id,
        getBaseLabel: (destination) => destination?.name ?? destination?.id,
        getQualifierParts: (destination) => [destination?.region, destination?.id],
      });
    }

    /**
     * Resolves a readable label from an id-backed lookup with a safe fallback.
     */
    function resolveLookupLabel(
      id: string | null | undefined,
      lookup: LookupLike<NamedRecord>,
      fallbackLabel: string,
    ): string {
      if (id && lookup && typeof lookup.get === "function") {
        const record = lookup.get(id);
        const name = normalizeText(record?.name);
        if (name) {
          return name;
        }
      }

      if (id) {
        return String(id);
      }

      return fallbackLabel;
    }

    /**
     * Trims long prose to a readable summary without splitting a later word boundary.
     */
    function summarizeText(value: unknown, maxLength = 180): string {
      const normalized = normalizeText(value).replace(/\s+/g, " ");
      if (normalized.length <= maxLength) {
        return normalized;
      }

      const trimmed = normalized.slice(0, Math.max(0, maxLength - 3));
      const safeBoundary = trimmed.lastIndexOf(" ");
      return `${(safeBoundary > 40 ? trimmed.slice(0, safeBoundary) : trimmed).trim()}...`;
    }

    /**
     * Formats journal attribution from destination and user lookups.
     */
    function formatJournalMetadata(
      journal: JournalMetadataInput | null | undefined,
      lookups: JournalMetadataLookups = {},
    ): {
      attribution: string;
      destinationLabel: string;
      userLabel: string;
    } {
      const destinationLabel = resolveLookupLabel(
        journal?.destinationId,
        lookups.destinationById,
        "Unknown destination",
      );
      const userLabel = resolveLookupLabel(journal?.userId, lookups.userById, "Unknown user");

      return {
        destinationLabel,
        userLabel,
        attribution: `${destinationLabel} / ${userLabel}`,
      };
    }

    return {
      createDestinationSelectOptions,
      createSelectOptionsWithDisambiguatedLabels,
      formatJournalMetadata,
      resolveLookupLabel,
      summarizeText,
    };
  },
);
