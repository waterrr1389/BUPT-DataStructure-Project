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
  createExploreFixture,
  type ExploreModule,
} from "../spa-regressions.test";

test("explore facility result map links preserve actor context", async () => {
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
        if (
          endpoint === "/api/facilities/nearby?destinationId=dest-1&fromNodeId=dest-1-node-a&category=all&radius=900"
        ) {
          return {
            item: {
              destinationId: "dest-1",
              fromNodeId: "dest-1-node-a",
              items: [
                {
                  category: "museum",
                  distance: 140,
                  name: "North Gallery Desk",
                  nodeId: "dest-1-node-c",
                  nodePath: ["dest-1-node-a", "dest-1-node-c"],
                  openHours: "08:00-18:00",
                },
              ],
            },
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

    dispatchDomEvent(requireElement(root, "#explore-facility-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      "/api/foods/recommendations?destinationId=dest-1",
      "/api/facilities/nearby?destinationId=dest-1&fromNodeId=dest-1-node-a&category=all&radius=900",
    ]);
    assert.equal(
      requireElement(root, "#explore-facility-results a").getAttribute("href"),
      "/map?destinationId=dest-1&from=dest-1-node-a&to=dest-1-node-c&actor=user-2",
    );

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});
