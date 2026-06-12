import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createAppServices, type AppServices } from "../src/services/index";

function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function createIsolatedApp(name: string): Promise<AppServices> {
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-runtime-services-exchange-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await fs.mkdir(runtimeDir, { recursive: true });
  const app = await createAppServices({ runtimeDir });
  await app.journalStore.reset();
  return app;
}

test("food search tolerates typo queries on the real dataset", async () => {
  const app = await createIsolatedApp("food-typo");
  const results = app.foods.search({
    destinationId: "dest-001",
    query: "nodle",
    limit: 5,
  }) as Array<{ name: string; matchScore?: number; matches?: string[] }>;
  const noodleLab = results.find((item) => item.name === "面食工坊厨房 4");

  if (!noodleLab) {
    throw new Error(format(results));
  }
  assert.ok((noodleLab.matchScore ?? 0) > 0, format(noodleLab));
  assert.ok((noodleLab.matches?.length ?? 0) > 0, format(noodleLab));
});

test("legacy destination, food, and exchange queries clamp over-max limits", async () => {
  const app = await createIsolatedApp("legacy-limit-clamping");

  const catalog = app.destinations.listCatalog(999);
  const foods = app.foods.search({
    destinationId: "dest-002",
    cuisine: "tea",
    limit: 99,
  });
  const exchangeResults = await app.exchange.searchText("路线", 99);

  assert.equal(catalog.length, 60, format(catalog));
  assert.equal(Array.isArray(foods), true, format(foods));
  assert.equal(Array.isArray(exchangeResults), true, format(exchangeResults));
});

test("journal exchange keeps exact-title lookup separate from full-text search", async () => {
  const app = await createIsolatedApp("journal-search");
  const exact = await app.exchange.exactTitle("青岚湖景区半日慢游记录");
  const bodyOnly = await app.exchange.exactTitle("花径步道");
  const results = await app.exchange.searchText("花径步道", 5);
  const match = results.find((entry) => (entry as { id?: string }).id === "journal-1") as
    | { id?: string; excerpt?: string; matches?: string[] }
    | undefined;

  assert.equal(exact?.id, "journal-1");
  assert.equal(bodyOnly, null);
  if (!match) {
    throw new Error(format(results));
  }
  assert.ok(match.excerpt?.includes("花径步道"), format(match));
});

test("journal exchange compression preserves leading and trailing body whitespace", async () => {
  const app = await createIsolatedApp("journal-exchange-lossless-whitespace");
  const body = "  北辰学院室内档案路线。\n\n第二行。  \n";
  const compressed = app.exchange.compress(body);
  const decompressed = app.exchange.decompress(compressed.compressed);

  assert.equal(compressed.inputLength, body.length, format(compressed));
  assert.equal(decompressed.text, body);

  const leadingWhitespacePayload = app.exchange.compress("abcdefghi");
  assert.equal(leadingWhitespacePayload.compressed.startsWith("\t"), true, format(leadingWhitespacePayload));
  assert.equal(app.exchange.decompress(leadingWhitespacePayload.compressed).text, "abcdefghi");

  const trailingWhitespacePayload = app.exchange.compress("0123456789abcdefghijklmnopqrstuvw");
  assert.equal(trailingWhitespacePayload.compressed.endsWith(" "), true, format(trailingWhitespacePayload));
  assert.equal(app.exchange.decompress(trailingWhitespacePayload.compressed).text, "0123456789abcdefghijklmnopqrstuvw");
});
