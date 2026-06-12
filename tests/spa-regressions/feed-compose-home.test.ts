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

function createImageFile(overrides: Partial<{ name: string; size: number; type: string }> = {}) {
  return {
    name: overrides.name ?? "trail-photo.png",
    size: overrides.size ?? 2048,
    type: overrides.type ?? "image/png",
  };
}

function setElementFiles(element: unknown, files: unknown[]): void {
  Object.defineProperty(element, "files", {
    configurable: true,
    value: files,
  });
}

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

test("compose uploads a selected image before publishing journal media", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ComposeModule>("views/compose.js");
    const uploadedUrl = "/uploads/images/image-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee.png";
    const fixture = createComposeFixture({
      uploadImageImpl: async (file) => ({
        mimeType: file.type,
        originalName: file.name,
        size: file.size,
        url: uploadedUrl,
      }),
    });
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:compose-preview";
      }
      static override revokeObjectURL() {}
    };
    globalThis.URL = urlStub as typeof URL;

    await module.render(
      fixture.app,
      {
        name: "compose",
        params: {
          destinationId: "dest-2",
        },
      },
      root,
    );

    const selectedFile = createImageFile({ name: "harbor-light.webp", type: "image/webp" });
    setElementFiles(requireElement(root, "#compose-media-image"), [selectedFile]);
    dispatchDomEvent(requireElement(root, "#compose-media-image"), "change");
    requireElement(root, "#compose-title").value = "Harbor image";
    requireElement(root, "#compose-body").value = "A note with one uploaded image.";
    requireElement(root, "#compose-tags").value = "harbor, light";
    requireElement(root, "#compose-media-title").value = "Harbor light";
    dispatchDomEvent(requireElement(root, "#compose-form"), "submit");
    await settleAsync();

    assert.equal(requireElement(root, "#compose-media-preview").hasAttribute("hidden"), false);
    assert.deepEqual(fixture.uploadImageCalls, [selectedFile]);
    assert.deepEqual(fixture.requestJsonCalls, [
      {
        endpoint: "/api/journals",
        payload: {
          body: "A note with one uploaded image.",
          destinationId: "dest-2",
          media: [
            {
              type: "image",
              title: "Harbor light",
              source: uploadedUrl,
              note: "image/webp · 2 KB",
            },
          ],
          tags: ["harbor", "light"],
          title: "Harbor image",
        },
      },
    ]);
    assert.deepEqual(fixture.deleteUploadedImageCalls, []);
    assert.deepEqual(fixture.navigateCalls, ["/posts/journal-9"]);
  } finally {
    globalThis.URL = previousUrl;
    restore();
  }
});

test("compose keeps image draft when upload fails", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ComposeModule>("views/compose.js");
    const fixture = createComposeFixture({
      uploadImageImpl: async () => {
        throw new Error("Upload failed.");
      },
    });
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:compose-preview";
      }
      static override revokeObjectURL() {}
    };
    globalThis.URL = urlStub as typeof URL;

    await module.render(fixture.app, { name: "compose", params: {} }, root);

    const selectedFile = createImageFile();
    setElementFiles(requireElement(root, "#compose-media-image"), [selectedFile]);
    dispatchDomEvent(requireElement(root, "#compose-media-image"), "change");
    requireElement(root, "#compose-title").value = "Keep draft";
    requireElement(root, "#compose-body").value = "Keep this note.";
    dispatchDomEvent(requireElement(root, "#compose-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.uploadImageCalls, [selectedFile]);
    assert.deepEqual(fixture.requestJsonCalls, []);
    assert.deepEqual(fixture.deleteUploadedImageCalls, []);
    assert.equal(requireElement(root, "#compose-title").value, "Keep draft");
    assert.equal(requireElement(root, "#compose-media-preview").hasAttribute("hidden"), false);
    assert.ok(requireElement(root, "#compose-notice").innerHTML.includes("图片上传失败"));
  } finally {
    globalThis.URL = previousUrl;
    restore();
  }
});

test("compose deletes uploaded image when journal creation fails", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  const previousUrl = globalThis.URL;
  try {
    const root = env.createRoot();
    const module = await importSpaModule<ComposeModule>("views/compose.js");
    const uploadedUrl = "/uploads/images/image-ffffffff-ffff-ffff-ffff-ffffffffffff.png";
    const fixture = createComposeFixture({
      requestJsonImpl: async () => {
        throw new Error("Create failed.");
      },
      uploadImageImpl: async (file) => ({
        mimeType: file.type,
        originalName: file.name,
        size: file.size,
        url: uploadedUrl,
      }),
    });
    const urlStub = class extends previousUrl {
      static override createObjectURL() {
        return "blob:compose-preview";
      }
      static override revokeObjectURL() {}
    };
    globalThis.URL = urlStub as typeof URL;

    await module.render(fixture.app, { name: "compose", params: {} }, root);

    const selectedFile = createImageFile();
    setElementFiles(requireElement(root, "#compose-media-image"), [selectedFile]);
    dispatchDomEvent(requireElement(root, "#compose-media-image"), "change");
    requireElement(root, "#compose-title").value = "Create fails";
    requireElement(root, "#compose-body").value = "The image upload should be cleaned.";
    dispatchDomEvent(requireElement(root, "#compose-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.uploadImageCalls, [selectedFile]);
    assert.equal(fixture.requestJsonCalls.length, 1);
    assert.deepEqual(fixture.deleteUploadedImageCalls, [uploadedUrl]);
    assert.deepEqual(fixture.navigateCalls, []);
    assert.ok(requireElement(root, "#compose-notice").innerHTML.includes("笔记创建失败"));
  } finally {
    globalThis.URL = previousUrl;
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
    assert.equal(requireElement(root, ".hero-actions .primary-link").getAttribute("href"), "/explore");
    assert.equal(root.querySelectorAll(".hero-actions .secondary-link")[0]?.getAttribute("href"), "/feed");
    assert.equal(root.querySelectorAll(".hero-actions .secondary-link")[1]?.getAttribute("href"), "/map");
    assert.equal(root.querySelectorAll(".home-card .section-head .inline-link")[0]?.getAttribute("href"), "/explore");
    assert.equal(root.querySelectorAll(".home-card .section-head .inline-link")[1]?.getAttribute("href"), "/feed");
    assert.equal(requireElement(root, ".compact-story-card .inline-link").getAttribute("href"), "/map?destinationId=dest-1");
    assert.deepEqual(fixture.fetchFeedCalls, [{ limit: 3 }]);
  } finally {
    restore();
  }
});

test("home entry links preserve actor context", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<HomeModule>("views/home.js");
    const fixture = createHomeFixture();

    await module.render(
      fixture.app,
      {
        name: "home",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    assert.equal(requireElement(root, ".hero-actions .primary-link").getAttribute("href"), "/explore?actor=user-2");
    assert.equal(root.querySelectorAll(".hero-actions .secondary-link")[0]?.getAttribute("href"), "/feed?actor=user-2");
    assert.equal(root.querySelectorAll(".hero-actions .secondary-link")[1]?.getAttribute("href"), "/map?actor=user-2");
    assert.equal(
      root.querySelectorAll(".home-card .section-head .inline-link")[0]?.getAttribute("href"),
      "/explore?actor=user-2",
    );
    assert.equal(
      root.querySelectorAll(".home-card .section-head .inline-link")[1]?.getAttribute("href"),
      "/feed?actor=user-2",
    );
    assert.equal(
      requireElement(root, ".compact-story-card .inline-link").getAttribute("href"),
      "/map?destinationId=dest-1&actor=user-2",
    );
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

    assert.ok(requireElement(root, "#feed-notice").innerHTML.includes("浏览量和评分"));
    assert.ok(requireElement(root, "#feed-notice").innerHTML.includes("个人兴趣"));
    assert.ok(fixture.fetchRecommendedCalls.length >= 1);
    assert.equal(root.querySelectorAll("#feed-results [data-journal-id]").length, 2);
    assert.equal(requireElement(root, "#feed-results [data-journal-id]").getAttribute("data-journal-id"), "journal-rec-1");
    assert.equal(requireElement(root, "#feed-results").innerHTML.includes("Other author note"), true);

    const exchangeButton = requireElement(root, "#feed-exchange-results button[data-action='view']");
    dispatchDomEvent(exchangeButton, "click");
    await settleAsync();

    assert.deepEqual(fixture.requestJsonCalls, ["/api/journal-exchange/search?query=indoor"]);
    assert.deepEqual(fixture.sendJournalActionCalls, [
      { action: "view", journalId: "journal-exchange-1" },
    ]);
    assert.equal(fixture.fetchRecommendedCalls.length, 2);
    assert.equal(fixture.fetchFeedCalls.length, 1);
    assert.equal(root.querySelectorAll("#feed-results [data-journal-id]").length, 2);
    assert.equal(requireElement(root, "#feed-results [data-journal-id]").getAttribute("data-journal-id"), "journal-rec-1");
    assert.equal(requireElement(root, "#feed-results").innerHTML.includes("Other author note"), true);
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
