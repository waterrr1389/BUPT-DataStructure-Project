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
  createComposeFixture,
  createFeedFixture,
  createHomeFixture,
  type ComposeModule,
  type FeedModule,
  type HomeModule,
} from "../spa-regressions.test";

test("compose uses the current user and omits userId on publish", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ComposeModule>("views/compose.js");
    const fixture = createComposeFixture();

    await module.render(
      fixture.app,
      {
        name: "compose",
        params: {
          actor: "user-2",
          destinationId: "dest-2",
        },
      },
      root,
    );

    assert.equal(root.querySelector("#compose-user"), null);
    assert.ok(requireElement(root, "#compose-current-user"));
    assert.equal(root.innerHTML.includes("Avery Vale"), true);
    assert.equal(requireElement(root, "#compose-destination").value, "dest-2");

    requireElement(root, "#compose-title").value = "Harbor dusk";
    requireElement(root, "#compose-body").value = "Watched the lights come on above the pier.";
    dispatchDomEvent(requireElement(root, "#compose-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, [
      {
        endpoint: "/api/journals",
        payload: {
          body: "Watched the lights come on above the pier.",
          destinationId: "dest-2",
          media: [],
          tags: [],
          title: "Harbor dusk",
        },
      },
    ]);
    assert.deepEqual(fixture.navigateCalls, ["/posts/journal-9"]);
  } finally {
    restore();
  }
});

test("home preview strips dead journal action buttons", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<HomeModule>("views/home.js");
    const fixture = createHomeFixture();

    await module.render(fixture.app, { name: "home", params: {} }, root);

    assert.equal(root.querySelectorAll("[data-journal-id]").length, 1);
    assert.equal(root.querySelectorAll("button[data-action]").length, 0);
    assert.equal(root.innerHTML.includes("校园 · 北码头"), true);
    assert.equal(root.innerHTML.includes("campus · North Wharf"), false);
    assert.deepEqual(fixture.fetchFeedCalls, [{ limit: 3 }]);
  } finally {
    restore();
  }
});

test("feed actions handle exchange cards and preserve recommendation mode", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<FeedModule>("views/feed.js");
    const fixture = createFeedFixture();

    await module.render(
      fixture.app,
      {
        name: "feed",
        params: {
          actor: "user-2",
          author: "user-1",
          destinationId: "dest-1",
        },
      },
      root,
    );

    assert.equal(fixture.fetchFeedCalls.length, 1);
    assert.equal(root.querySelector("#feed-actor"), null);
    assert.equal(requireElement(root, ".feed-stream-card a[data-compose-href='true']").getAttribute("href"), "/compose");
    assert.equal(
      requireElement(root, "#feed-results [data-journal-id='journal-feed-1'] a").getAttribute("href"),
      "/posts/journal-feed-1",
    );

    requireElement(root, "#feed-exchange-query").value = "indoor";
    dispatchDomEvent(requireElement(root, "#feed-exchange-search-form"), "submit");
    await settleAsync();

    assert.equal(
      requireElement(root, "#feed-exchange-results [data-journal-id='journal-exchange-1'] a").getAttribute("href"),
      "/posts/journal-exchange-1",
    );
    assert.equal(root.querySelector("#feed-exchange-results button[data-action='like']"), null);
    assert.equal(requireElement(root, "#feed-exchange-results").textContent?.includes("0 likes"), false);
    assert.equal(requireElement(root, "#feed-exchange-results").textContent?.includes("0 comments"), false);

    dispatchDomEvent(requireElement(root, "#feed-load-recommended"), "click");
    await settleAsync();

    assert.equal(fixture.fetchRecommendedCalls.length, 1);
    assert.equal(root.querySelectorAll("#feed-results [data-journal-id]").length, 1);
    assert.equal(requireElement(root, "#feed-results [data-journal-id]").getAttribute("data-journal-id"), "journal-rec-1");
    assert.equal(requireElement(root, "#feed-results").textContent?.includes("Other author note"), false);

    const exchangeButton = requireElement(root, "#feed-exchange-results button[data-action='view']");
    dispatchDomEvent(exchangeButton, "click");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, ["/api/journal-exchange/search?query=indoor"]);
    assert.deepEqual(fixture.sendJournalActionCalls, [
      { action: "view", journalId: "journal-exchange-1" },
    ]);
    assert.equal(fixture.fetchRecommendedCalls.length, 2);
    assert.equal(fixture.fetchFeedCalls.length, 1);
    assert.equal(root.querySelectorAll("#feed-results [data-journal-id]").length, 1);
    assert.equal(requireElement(root, "#feed-results [data-journal-id]").getAttribute("data-journal-id"), "journal-rec-1");
    assert.equal(requireElement(root, "#feed-results").textContent?.includes("Other author note"), false);
  } finally {
    restore();
  }
});

test("feed exchange compression controls keep the legacy endpoint contract", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<FeedModule>("views/feed.js");
    const fixture = createFeedFixture();
    const exchangeRequests: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];

    fixture.app.requestJson = async (endpoint: string, options?: { body?: string }) => {
      exchangeRequests.push({
        endpoint,
        payload: JSON.parse(options?.body ?? "{}"),
      });
      if (endpoint === "/api/journal-exchange/compress") {
        return {
          item: {
            compressed: " \t10,20,30\n ",
            ratio: 0.5,
          },
        };
      }
      if (endpoint === "/api/journal-exchange/decompress") {
        return {
          item: {
            text: "Restored feed exchange note.",
          },
        };
      }
      throw new Error(`Unexpected request: ${endpoint}`);
    };

    await module.render(
      fixture.app,
      {
        name: "feed",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    requireElement(root, "#feed-compression-body").value = "Quiet feed exchange note.";
    dispatchDomEvent(requireElement(root, "#feed-compression-form"), "submit");
    await settleAsync();

    assert.deepEqual(exchangeRequests, [
      {
        endpoint: "/api/journal-exchange/compress",
        payload: {
          body: "Quiet feed exchange note.",
        },
      },
    ]);
    assert.equal((fixture.app.state as { lastCompressed?: string }).lastCompressed, " \t10,20,30\n ");
    assert.ok(requireElement(root, "#feed-exchange-results").innerHTML.includes("10,20,30"));

    requireElement(root, "#feed-compression-body").value = "Manual fallback text must not win.";
    dispatchDomEvent(requireElement(root, "#feed-decompress"), "click");
    await settleAsync();

    assert.deepEqual(exchangeRequests, [
      {
        endpoint: "/api/journal-exchange/compress",
        payload: {
          body: "Quiet feed exchange note.",
        },
      },
      {
        endpoint: "/api/journal-exchange/decompress",
        payload: {
          body: " \t10,20,30\n ",
        },
      },
    ]);
    assert.ok(requireElement(root, "#feed-exchange-results").innerHTML.includes("Restored feed exchange note."));

    (fixture.app.state as { lastCompressed?: string }).lastCompressed = "";
    requireElement(root, "#feed-compression-body").value = " \nlegacy compressed payload\t ";
    dispatchDomEvent(requireElement(root, "#feed-decompress"), "click");
    await settleAsync();

    assert.deepEqual(exchangeRequests[exchangeRequests.length - 1], {
      endpoint: "/api/journal-exchange/decompress",
      payload: {
        body: " \nlegacy compressed payload\t ",
      },
    });
  } finally {
    restore();
  }
});
