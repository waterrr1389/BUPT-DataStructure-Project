import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createAppServices, type AppServices } from "../src/services/index";

type Destination = {
  id: string;
  name: string;
  region?: string;
};

type DestinationOption = Destination & {
  label: string;
};

type BootstrapPayload = {
  destinations?: Destination[];
  featured?: Destination[];
};

type SelectorBinding = {
  config: {
    label: string;
  };
  items: DestinationOption[];
  selector: string;
};

type JournalEntry = {
  averageRating?: number;
  body: string;
  destinationId: string;
  id: string;
  ratings: number[];
  tags: string[];
  title: string;
  userId: string;
  views: number;
};

type JournalPresentationModule = {
  createDestinationSelectOptions(destinations: Destination[]): DestinationOption[];
  formatJournalMetadata(
    journal: Pick<JournalEntry, "destinationId" | "userId">,
    lookups?: {
      destinationById?: Map<string, Destination>;
      userById?: Map<string, { id: string; name: string }>;
    },
  ): {
    attribution: string;
    destinationLabel: string;
    userLabel: string;
  };
};

type JournalConsumersModule = {
  journalCard(
    journal: JournalEntry,
    metadata: { attribution: string },
    renderTagsMarkup: (tags: string[]) => string,
  ): string;
  prepareJournalExchangeDestinationBindings(
    bootstrap: BootstrapPayload,
    createDestinationSelectOptions: (destinations: Destination[]) => DestinationOption[],
  ): {
    destinationById: Map<string, Destination>;
    featuredDestinations: Destination[];
    journalDestinationOptions: DestinationOption[];
    selectorBindings: SelectorBinding[];
  };
  resolveJournalActionRequest(
    action: string,
    journalId: string,
    selectedUserId?: string,
  ): {
    options: {
      body?: string;
      method: string;
    };
    path: string;
  } | null;
};

const SEEDED_JOURNAL_DESTINATION_IDS = [
  "dest-001",
  "dest-004",
  "dest-007",
  "dest-010",
  "dest-013",
  "dest-016",
  "dest-019",
  "dest-022",
  "dest-025",
  "dest-028",
  "dest-031",
  "dest-034",
] as const;

const { createDestinationSelectOptions, formatJournalMetadata } = require(path.join(
  process.cwd(),
  "public",
  "journal-presentation.js",
)) as JournalPresentationModule;

const { journalCard, prepareJournalExchangeDestinationBindings, resolveJournalActionRequest } = require(path.join(
  process.cwd(),
  "public",
  "journal-consumers.js",
)) as JournalConsumersModule;

async function createIsolatedApp(name: string): Promise<AppServices> {
  const runtimeDir = path.join("/tmp", `ds-ts-journal-consumers-${name}`);
  await fs.mkdir(runtimeDir, { recursive: true });
  const app = await createAppServices({ runtimeDir });
  await app.journalStore.reset();
  return app;
}

function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function renderTagsMarkup(tags: string[] = []): string {
  if (!tags.length) {
    return "";
  }
  return `<div class="tag-row">${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>`;
}

function readJournalId(markup: string): string {
  const match = markup.match(/data-journal-id="([^"]+)"/);
  if (!match) {
    throw new Error(markup);
  }
  return match[1];
}

test("journal and exchange destination selectors consume bootstrap.destinations with seeded ids preserved", async () => {
  const app = await createIsolatedApp("selectors");
  const bootstrap = (await app.bootstrap()) as unknown as BootstrapPayload;
  const prepared = prepareJournalExchangeDestinationBindings(bootstrap, createDestinationSelectOptions);

  assert.deepEqual(
    prepared.selectorBindings.map((binding) => binding.selector),
    ["#journal-destination", "#exchange-destination"],
  );
  assert.equal(prepared.featuredDestinations.length, 12);
  assert.equal(prepared.journalDestinationOptions.length, bootstrap.destinations?.length);
  assert.equal(prepared.featuredDestinations.some((destination) => destination.id === "dest-013"), false);
  assert.equal(prepared.destinationById.get("dest-034")?.id, "dest-034");

  for (const binding of prepared.selectorBindings) {
    assert.deepEqual(binding.items, prepared.journalDestinationOptions);
    assert.deepEqual(binding.config, { label: "label" });
  }

  for (const destinationId of SEEDED_JOURNAL_DESTINATION_IDS) {
    assert.ok(
      prepared.journalDestinationOptions.some((option) => option.id === destinationId),
      format({
        destinationId,
        optionIds: prepared.journalDestinationOptions.map((option) => option.id),
      }),
    );
  }
});

test("journal cards keep data-journal-id and journal actions stay anchored to the journal id", () => {
  const journal: JournalEntry = {
    averageRating: 4.7,
    body: "Layered indoor walk with a quiet overlook and late-night tea stop.",
    destinationId: "dest-034",
    id: "journal-12",
    ratings: [5, 4, 5],
    tags: ["campus", "night"],
    title: "Summit Polytechnic field note 12",
    userId: "user-12",
    views: 42,
  };

  const readableMarkup = journalCard(
    journal,
    formatJournalMetadata(journal, {
      destinationById: new Map([["dest-034", { id: "dest-034", name: "Summit Polytechnic" }]]),
      userById: new Map([["user-12", { id: "user-12", name: "Rory Pike" }]]),
    }),
    renderTagsMarkup,
  );
  const readableJournalId = readJournalId(readableMarkup);
  const viewRequest = resolveJournalActionRequest("view", readableJournalId, "user-03");
  const rateRequest = resolveJournalActionRequest("rate", readableJournalId, "user-03");
  const deleteRequest = resolveJournalActionRequest("delete", readableJournalId, "user-03");

  assert.equal(readableJournalId, "journal-12");
  assert.ok(/Summit Polytechnic \/ Rory Pike/.test(readableMarkup), readableMarkup);
  assert.deepEqual(viewRequest, {
    path: "/api/journals/journal-12/view",
    options: {
      method: "POST",
      body: "{}",
    },
  });
  assert.deepEqual(rateRequest, {
    path: "/api/journals/journal-12/rate",
    options: {
      method: "POST",
      body: JSON.stringify({ userId: "user-03", score: 5 }),
    },
  });
  assert.deepEqual(deleteRequest, {
    path: "/api/journals/journal-12",
    options: {
      method: "DELETE",
    },
  });
  assert.equal(viewRequest?.path.includes("dest-034"), false);
  assert.equal(rateRequest?.path.includes("user-12"), false);
  assert.equal(deleteRequest?.path.includes("dest-034"), false);

  const fallbackMarkup = journalCard(
    journal,
    formatJournalMetadata(journal, {
      destinationById: new Map(),
      userById: new Map(),
    }),
    renderTagsMarkup,
  );
  const fallbackJournalId = readJournalId(fallbackMarkup);
  const fallbackViewRequest = resolveJournalActionRequest("view", fallbackJournalId, "user-88");

  assert.equal(fallbackJournalId, "journal-12");
  assert.ok(/dest-034 \/ user-12/.test(fallbackMarkup), fallbackMarkup);
  assert.deepEqual(fallbackViewRequest, {
    path: "/api/journals/journal-12/view",
    options: {
      method: "POST",
      body: "{}",
    },
  });
});
