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

test("explore defers destination details until the facility surface is first touched", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        name: "explore",
        params: {},
      },
      root,
    );

    assert.deepEqual(fixture.ensureDestinationDetailsCalls, []);
    assert.deepEqual(fixture.requestJsonCalls, ["/api/foods/recommendations?destinationId=dest-1"]);

    const facilityForm = requireElement(root, "#explore-facility-form");
    dispatchDomEvent(facilityForm, "focusin");
    dispatchDomEvent(facilityForm, "pointerdown");
    await settleAsync();

    assert.deepEqual(fixture.ensureDestinationDetailsCalls, ["dest-1"]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore destination cards preserve actor context across featured, search, and recommendation results", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return { items: [] };
        }
        if (endpoint === "/api/destinations?query=harbor&limit=8") {
          return {
            items: [
              {
                categories: ["museum"],
                description: "Lantern decks and quiet overlooks.",
                heat: 76,
                id: "dest-2",
                name: "Lantern Point",
                nodeCount: 9,
                rating: 4.6,
                region: "East Bluffs",
                type: "campus",
              },
            ],
          };
        }
        if (endpoint === "/api/destinations/recommendations?query=harbor&limit=8") {
          return {
            items: [
              {
                categories: ["museum"],
                description: "Reeds, galleries, and late ferry light.",
                heat: 82,
                id: "dest-3",
                name: "Reed Market",
                nodeCount: 11,
                rating: 4.9,
                region: "South Basin",
                type: "district",
              },
            ],
          };
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

    const featuredLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(featuredLinks[0]?.getAttribute("href"), "/map?destinationId=dest-1&actor=user-2");
    assert.equal(featuredLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-1&actor=user-2");
    assert.equal(requireElement(root, "#explore-category").innerHTML.includes('<option value="museum">博物馆</option>'), true);
    assert.equal(requireElement(root, "#explore-food-cuisine").innerHTML.includes('<option value="tea">茶饮</option>'), true);
    assert.equal(root.innerHTML.includes("校园 · 北码头"), true);
    assert.equal(root.innerHTML.includes("campus · North Wharf"), false);
    assert.equal(root.innerHTML.includes("博物馆"), true);

    requireElement(root, "#explore-query").value = "harbor";
    dispatchDomEvent(requireElement(root, "#explore-destination-form"), "submit");
    await settleAsync();

    const searchLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(searchLinks[0]?.getAttribute("href"), "/map?destinationId=dest-2&actor=user-2");
    assert.equal(searchLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-2&actor=user-2");
    assert.equal(requireElement(root, "#explore-destination-results").innerHTML.includes("校园 · 东崖"), true);
    assert.equal(requireElement(root, "#explore-destination-results").innerHTML.includes("campus · East Bluffs"), false);

    dispatchDomEvent(requireElement(root, "#explore-destination-recommend"), "click");
    await settleAsync();

    const recommendationLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(recommendationLinks[0]?.getAttribute("href"), "/map?destinationId=dest-3&actor=user-2");
    assert.equal(recommendationLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-3&actor=user-2");
    assert.equal(requireElement(root, "#explore-destination-results").innerHTML.includes("街区 · 南湾"), true);
    assert.equal(requireElement(root, "#explore-destination-results").innerHTML.includes("district · South Basin"), false);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore destination cards keep clean URLs when no actor is present", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      requestJsonImpl: async (endpoint: string) => {
        if (endpoint === "/api/foods/recommendations?destinationId=dest-1") {
          return { items: [] };
        }
        if (endpoint === "/api/destinations?query=harbor&limit=8") {
          return {
            items: [
              {
                categories: ["museum"],
                description: "Lantern decks and quiet overlooks.",
                heat: 76,
                id: "dest-2",
                name: "Lantern Point",
                nodeCount: 9,
                rating: 4.6,
                region: "East Bluffs",
                type: "campus",
              },
            ],
          };
        }
        if (endpoint === "/api/destinations/recommendations?query=harbor&limit=8") {
          return {
            items: [
              {
                categories: ["museum"],
                description: "Reeds, galleries, and late ferry light.",
                heat: 82,
                id: "dest-3",
                name: "Reed Market",
                nodeCount: 11,
                rating: 4.9,
                region: "South Basin",
                type: "district",
              },
            ],
          };
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

    const featuredLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(featuredLinks[0]?.getAttribute("href"), "/map?destinationId=dest-1");
    assert.equal(featuredLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-1");

    requireElement(root, "#explore-query").value = "harbor";
    dispatchDomEvent(requireElement(root, "#explore-destination-form"), "submit");
    await settleAsync();

    const searchLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(searchLinks[0]?.getAttribute("href"), "/map?destinationId=dest-2");
    assert.equal(searchLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-2");

    dispatchDomEvent(requireElement(root, "#explore-destination-recommend"), "click");
    await settleAsync();

    const recommendationLinks = root.querySelectorAll("#explore-destination-results .destination-card a");
    assert.equal(recommendationLinks[0]?.getAttribute("href"), "/map?destinationId=dest-3");
    assert.equal(recommendationLinks[1]?.getAttribute("href"), "/compose?destinationId=dest-3");

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("explore ignores stale facility node loads after destination changes", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const detailsById = new Map([
    [
      "dest-1",
      {
        graph: {
          nodes: [
            { id: "dest-1-node-a", name: "Atrium" },
            { id: "dest-1-node-b", name: "Bridge" },
          ],
        },
      },
    ],
    [
      "dest-2",
      {
        graph: {
          nodes: [
            { id: "dest-2-node-a", name: "Garden" },
            { id: "dest-2-node-b", name: "Lookout" },
          ],
        },
      },
    ],
  ]);
  const staleDest1Details = createDeferred<Record<string, unknown>>();
  let delayDest1 = false;

  try {
    const root = env.createRoot();
    const module = await importSpaModule<ExploreModule>("views/explore.js");
    const fixture = createExploreFixture({
      destinationOptions: [
        { id: "dest-1", label: "Harbor Reach", name: "Harbor Reach" },
        { id: "dest-2", label: "Lantern Point", name: "Lantern Point" },
      ],
      ensureDestinationDetailsImpl: async (destinationId: string) => {
        if (delayDest1 && destinationId === "dest-1") {
          return staleDest1Details.promise;
        }
        const details = detailsById.get(destinationId);
        if (!details) {
          throw new Error(`Unknown destination: ${destinationId}`);
        }
        return details;
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

    delayDest1 = true;
    dispatchDomEvent(requireElement(root, "#explore-facility-form"), "focusin");
    const facilityDestinationSelect = requireElement(root, "#explore-facility-destination");
    facilityDestinationSelect.value = "dest-2";
    dispatchDomEvent(facilityDestinationSelect, "change");
    await settleAsync();

    const facilityNodeSelect = requireElement(root, "#explore-facility-node");
    assert.equal(facilityNodeSelect.value, "dest-2-node-a");

    staleDest1Details.resolve(detailsById.get("dest-1") as Record<string, unknown>);
    await settleAsync();

    assert.equal(facilityDestinationSelect.value, "dest-2");
    assert.equal(facilityNodeSelect.value, "dest-2-node-a");
    assert.equal(facilityNodeSelect.innerHTML.includes("dest-1-node-a"), false);
    assert.equal(facilityNodeSelect.innerHTML.includes("dest-2-node-a"), true);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});
