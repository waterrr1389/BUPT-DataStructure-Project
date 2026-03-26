import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

type DestinationOption = {
  id: string;
  label: string;
  name: string;
  region?: string;
};

type DestinationInput = {
  id: string;
  name: string;
  region?: string;
};

type NamedRecord = {
  id: string;
  name: string;
};

type JournalEntry = {
  destinationId?: string;
  userId?: string;
};

type JournalPresentationModule = {
  createDestinationSelectOptions(destinations: DestinationInput[]): DestinationOption[];
  createSelectOptionsWithDisambiguatedLabels<TItem extends Record<string, unknown>>(
    items: TItem[],
    options?: {
      getBaseLabel?: (item: TItem | undefined) => unknown;
      getKey?: (item: TItem | undefined) => unknown;
      getQualifierParts?: (item: TItem | undefined) => unknown;
    },
  ): Array<TItem & { label: string }>;
  formatJournalMetadata(
    journal: JournalEntry,
    lookups?: {
      destinationById?: Map<string, NamedRecord>;
      userById?: Map<string, NamedRecord>;
    },
  ): {
    attribution: string;
    destinationLabel: string;
    userLabel: string;
  };
  resolveLookupLabel(
    id: string | undefined,
    lookup: Map<string, NamedRecord> | undefined,
    fallbackLabel: string,
  ): string;
  summarizeText(value: string, maxLength?: number): string;
};

type RequireWithCache = NodeRequire & {
  cache: Record<string, unknown>;
  resolve(id: string): string;
};

const journalPresentationPath = path.join(process.cwd(), "public", "journal-presentation.js");
const runtimeRequire = require as RequireWithCache;

const { createDestinationSelectOptions, formatJournalMetadata, summarizeText } = runtimeRequire(
  journalPresentationPath,
) as JournalPresentationModule;

function loadFreshJournalPresentationModule(): JournalPresentationModule {
  const runtimeGlobals = globalThis as typeof globalThis & {
    JournalPresentation?: JournalPresentationModule;
  };
  delete runtimeRequire.cache[runtimeRequire.resolve(journalPresentationPath)];
  Reflect.deleteProperty(runtimeGlobals, "JournalPresentation");
  const api = runtimeRequire(journalPresentationPath) as JournalPresentationModule;
  assert.equal(runtimeGlobals.JournalPresentation, api);
  return api;
}

test("journal presentation keeps the CommonJS export attached to JournalPresentation", () => {
  const api = loadFreshJournalPresentationModule();

  assert.deepEqual(Object.keys(api).sort(), [
    "createDestinationSelectOptions",
    "createSelectOptionsWithDisambiguatedLabels",
    "formatJournalMetadata",
    "resolveLookupLabel",
    "summarizeText",
  ]);
});

test("destination select labels disambiguate duplicate names while preserving destination ids", () => {
  const options = createDestinationSelectOptions([
    { id: "dest-001", name: "Amber Bay", region: "north belt" },
    { id: "dest-011", name: "Amber Bay", region: "east loop" },
    { id: "dest-002", name: "River Polytechnic", region: "river arc" },
  ]);

  assert.deepEqual(
    options.map((option) => ({ id: option.id, label: option.label })),
    [
      { id: "dest-001", label: "Amber Bay (north belt)" },
      { id: "dest-011", label: "Amber Bay (east loop)" },
      { id: "dest-002", label: "River Polytechnic" },
    ],
  );
});

test("destination select labels fall back to ids when earlier qualifiers still collide", () => {
  const options = createDestinationSelectOptions([
    { id: "dest-001", name: "Amber Bay", region: "north belt" },
    { id: "dest-021", name: "Amber Bay", region: "north belt" },
  ]);

  assert.deepEqual(
    options.map((option) => option.label),
    [
      "Amber Bay (north belt · dest-001)",
      "Amber Bay (north belt · dest-021)",
    ],
  );
});

test("journal metadata prefers readable destination and user names when lookups exist", () => {
  const metadata = formatJournalMetadata(
    {
      destinationId: "dest-034",
      userId: "user-12",
    },
    {
      destinationById: new Map([["dest-034", { id: "dest-034", name: "Summit Polytechnic" }]]),
      userById: new Map([["user-12", { id: "user-12", name: "Rory Pike" }]]),
    },
  );

  assert.equal(metadata.destinationLabel, "Summit Polytechnic");
  assert.equal(metadata.userLabel, "Rory Pike");
  assert.equal(metadata.attribution, "Summit Polytechnic / Rory Pike");
});

test("journal metadata falls back safely when destination or user lookups are missing", () => {
  const metadata = formatJournalMetadata(
    {
      destinationId: "dest-404",
      userId: "user-404",
    },
    {
      destinationById: new Map(),
      userById: new Map(),
    },
  );

  assert.equal(metadata.destinationLabel, "dest-404");
  assert.equal(metadata.userLabel, "user-404");
  assert.equal(metadata.attribution, "dest-404 / user-404");
});

test("journal summaries compress long prose without cutting straight through a word", () => {
  const summary = summarizeText(
    "Layered indoor walk with a quiet overlook, tea stop, long bridge, and a slow return through the atrium after sunset.",
    72,
  );

  assert.equal(summary, "Layered indoor walk with a quiet overlook, tea stop, long bridge,...");
});
