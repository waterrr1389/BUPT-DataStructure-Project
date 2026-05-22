import assert from "node:assert/strict";
import test from "node:test";

import {
  createSpaDomEnvironment,
  dispatchDomEvent,
  importSpaModule,
  requireElement,
  settleAsync,
} from "../support/spa-harness";
import {
  createDeferred,
  createExploreFixture,
  type ExploreModule,
} from "../spa-regressions.test";

test("explore food recommendation and search map links preserve actor context", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const searchResponse = createDeferred<Record<string, unknown>>();

  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      destinationOptions: [
        { id: "dest-1", label: "Harbor Reach", name: "Harbor Reach" },
        { id: "dest-2", label: "Lantern Point", name: "Lantern Point" },
      ],
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return {
            items: [
              {
                avgPrice: 3,
                cuisine: "tea",
                heat: 91,
                keywords: ["late", "quiet"],
                name: "Lantern Tea Room",
                rating: 4.8,
                venue: "Wharf Arcade",
              },
            ],
          };
        }
        if (endpoint === "/api/foods/search?destinationId=dest-1&query=noodles") {
          return searchResponse.promise;
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    assert.equal(
      requireElement(root, "#explore-food-results a").getAttribute("href"),
      "/map?destinationId=dest-1&actor=user-2",
    );
    assert.equal(requireElement(root, "#explore-food-results").innerHTML.includes("茶饮 · 码头拱廊"), true);
    assert.equal(requireElement(root, "#explore-food-results").innerHTML.includes("tea · Wharf Arcade"), false);
    assert.equal(requireElement(root, "#explore-food-results").innerHTML.includes("夜间,安静"), true);
    assert.equal(requireElement(root, "#explore-food-results").innerHTML.includes("late,quiet"), false);

    requireElement(root, "#explore-food-query").value = "noodles";
    dispatchDomEvent(requireElement(root, "#explore-food-form"), "submit");
    requireElement(root, "#explore-food-destination").value = "dest-2";

    searchResponse.resolve({
      items: [
        {
          avgPrice: 2,
          cuisine: "tea",
          heat: 88,
          keywords: ["quiet", "noodles"],
          name: "Noodle Stop",
          rating: 4.7,
          venue: "Atrium Hall",
        },
      ],
    });
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      "/api/foods/recommendations?destinationId=dest-1",
      "/api/foods/search?destinationId=dest-1&query=noodles",
    ]);
    assert.equal(
      requireElement(root, "#explore-food-results a").getAttribute("href"),
      "/map?destinationId=dest-1&actor=user-2",
    );
    assert.equal(requireElement(root, "#explore-food-results").innerHTML.includes("茶饮 · 中庭大厅"), true);
    assert.equal(requireElement(root, "#explore-food-results").innerHTML.includes("tea · Atrium Hall"), false);
    assert.equal(requireElement(root, "#explore-food-results").innerHTML.includes("安静,面食"), true);
    assert.equal(requireElement(root, "#explore-food-results").innerHTML.includes("quiet,noodles"), false);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore food recommendation and search map links stay clean without actor context", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const searchResponse = createDeferred<Record<string, unknown>>();

  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      destinationOptions: [
        { id: "dest-1", label: "Harbor Reach", name: "Harbor Reach" },
        { id: "dest-2", label: "Lantern Point", name: "Lantern Point" },
      ],
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return {
            items: [
              {
                avgPrice: 3,
                cuisine: "tea",
                heat: 91,
                keywords: ["late", "quiet"],
                name: "Lantern Tea Room",
                rating: 4.8,
                venue: "Wharf Arcade",
              },
            ],
          };
        }
        if (endpoint === "/api/foods/search?destinationId=dest-1&query=noodles") {
          return searchResponse.promise;
        }
        throw new Error(`Unexpected request: ${endpoint}`);
      },
    });

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {},
      },
      root,
    );

    assert.equal(requireElement(root, "#explore-food-results a").getAttribute("href"), "/map?destinationId=dest-1");

    requireElement(root, "#explore-food-query").value = "noodles";
    dispatchDomEvent(requireElement(root, "#explore-food-form"), "submit");
    requireElement(root, "#explore-food-destination").value = "dest-2";

    searchResponse.resolve({
      items: [
        {
          avgPrice: 2,
          cuisine: "tea",
          heat: 88,
          keywords: ["quiet", "noodles"],
          name: "Noodle Stop",
          rating: 4.7,
          venue: "Atrium Hall",
        },
      ],
    });
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      "/api/foods/recommendations?destinationId=dest-1",
      "/api/foods/search?destinationId=dest-1&query=noodles",
    ]);
    assert.equal(requireElement(root, "#explore-food-results a").getAttribute("href"), "/map?destinationId=dest-1");

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});
