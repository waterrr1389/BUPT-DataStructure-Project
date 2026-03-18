import assert from "node:assert/strict";
import test from "node:test";

import {
  compressText,
  decompressText,
  InvertedIndex,
  MinHeap,
  rankFuzzyMatches,
  scoreFuzzyMatch,
  selectTopK,
  Trie,
} from "../src/algorithms/index";

test("MinHeap and selectTopK keep the best ranked items", () => {
  const heap = new MinHeap<number>((left, right) => left - right);
  heap.push(5);
  heap.push(1);
  heap.push(3);

  assert.equal(heap.peek(), 1);
  assert.deepEqual([heap.pop(), heap.pop(), heap.pop()], [1, 3, 5]);

  const topThree = selectTopK([5, 1, 4, 2, 3], 3, (left, right) => right - left);
  assert.deepEqual(topThree, [5, 4, 3]);

  assert.throws(() => {
    selectTopK([1, 2, 3], -1, (left, right) => right - left);
  }, /non-negative/);
});

test("Trie supports exact lookup, prefix search, and deletion", () => {
  const trie = new Trie<number>({
    normalizer: (value) => value.toLowerCase(),
  });

  trie.set("Apple", 1);
  trie.set("App", 2);
  trie.set("Apricot", 3);

  assert.equal(trie.get("apple"), 1);
  assert.deepEqual(
    trie.searchPrefix("ap").map((entry) => entry.key),
    ["App", "Apple", "Apricot"],
  );
  assert.equal(trie.delete("app"), true);
  assert.equal(trie.searchExact("app"), undefined);

  assert.throws(() => {
    trie.searchPrefix("ap", { limit: 0 });
  }, /positive integer/);
});

test("InvertedIndex supports add, update, remove, and ranked search", () => {
  const index = new InvertedIndex<string>();

  index.add({
    id: "d1",
    text: "Sunny lake trail by the mountain lake",
  });
  index.add({
    id: "d2",
    text: "Mountain cabin with lake access",
  });
  index.add({
    id: "d3",
    text: "Campus cafeteria lunch specials",
  });

  let results = index.search("mountain lake", {
    matchMode: "all",
  });

  assert.deepEqual(results.map((result) => result.id), ["d1", "d2"]);

  index.update({
    id: "d2",
    text: "Mountain cabin retreat",
  });

  results = index.search("mountain lake", {
    matchMode: "all",
  });

  assert.deepEqual(results.map((result) => result.id), ["d1"]);

  assert.equal(index.remove("d1"), true);
  assert.deepEqual(index.search("mountain lake", { matchMode: "all" }), []);
  assert.equal(index.remove("missing"), false);

  assert.throws(() => {
    index.search("mountain", { limit: 0 });
  }, /positive integer/);
});

test("Fuzzy scoring and ranking prefer close text matches", () => {
  const entries = [
    {
      id: "west-lake",
      name: "West Lake Scenic Area",
      tags: ["hangzhou", "lakefront"],
    },
    {
      id: "campus-cafe",
      name: "Campus Cafe",
      tags: ["student-center", "food"],
    },
    {
      id: "mountain-trail",
      name: "Mountain Trail",
      tags: ["forest", "hike"],
    },
  ];

  const lakeScore = scoreFuzzyMatch("west lk", "West Lake Scenic Area");
  const mountainScore = scoreFuzzyMatch("west lk", "Mountain Trail");

  assert.ok(lakeScore > mountainScore);

  const ranked = rankFuzzyMatches(
    "west lk",
    entries,
    (entry) => [
      { key: "name", text: entry.name, weight: 1.5 },
      { key: "tags", text: entry.tags.join(" "), weight: 1 },
    ],
    { threshold: 0.2 },
  );

  assert.equal(ranked[0]?.item.id, "west-lake");
  assert.ok((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0));

  assert.throws(() => {
    rankFuzzyMatches("lake", entries, (entry) => [entry.name], { threshold: 2 });
  }, /between 0 and 1/);
});

test("Compression round-trips text and rejects invalid payloads", () => {
  const input = "TOBEORNOTTOBEORTOBEORNOT";
  const compressed = compressText(input);

  assert.equal(decompressText(compressed.data), input);
  assert.ok(compressed.stats.outputLength < compressed.stats.inputLength);
  assert.ok(compressed.stats.spaceSavings > 0);

  assert.throws(() => {
    decompressText({
      alphabet: ["A"],
      codes: [0, 2],
    });
  }, /Invalid compressed code/);
});
