import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { collectBenchmarkResults } from "../scripts/benchmark-support";
import { createDemoReport } from "../scripts/demo-support";
import { createServerHandler } from "../src/server/index";
import { createAppServices } from "../src/services/index";

type JsonResponse<T> = {
  body: T;
  headers: Record<string, string>;
  status: number;
  text: string;
};

type TextResponse = {
  headers: Record<string, string>;
  status: number;
  text: string;
};

type RequestOptions = {
  body?: string | Record<string, unknown>;
  method?: string;
};

type RuntimeFs = {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
};

function expectMatches(value: string, pattern: RegExp): void {
  assert.equal(pattern.test(value), true, value);
}

function createMockResponse(): {
  body: Buffer[];
  headers: Record<string, string>;
  statusCode: number;
  end(chunk?: Buffer | string): void;
  writeHead(statusCode: number, headers: Record<string, unknown>): void;
} {
  return {
    body: [],
    headers: {},
    statusCode: 200,
    end(chunk?: Buffer | string) {
      if (chunk !== undefined) {
        this.body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    },
    writeHead(statusCode: number, headers: Record<string, unknown>) {
      this.statusCode = statusCode;
      this.headers = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
      );
    },
  };
}

function createMockRequest(requestPath: string, options: RequestOptions): {
  method: string;
  url: string;
  [Symbol.asyncIterator](): AsyncGenerator<Buffer, void, unknown>;
} {
  const bodyText =
    typeof options.body === "string"
      ? options.body
      : options.body
        ? JSON.stringify(options.body)
        : "";
  const chunks = bodyText ? [Buffer.from(bodyText)] : [];

  return {
    method: options.method ?? "GET",
    url: requestPath,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

async function withServer<T>(
  name: string,
  run: (context: {
    requestJson: <TResponse>(requestPath: string, options?: RequestOptions) => Promise<JsonResponse<TResponse>>;
    requestText: (requestPath: string, options?: RequestOptions) => Promise<TextResponse>;
  }) => Promise<T>,
): Promise<T> {
  const runtimeFs = fs as unknown as RuntimeFs;
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-integration-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await runtimeFs.mkdir(runtimeDir, { recursive: true });
  const services = await createAppServices({ runtimeDir });
  await services.journalStore.reset();
  const handler = createServerHandler(services);

  async function requestText(requestPath: string, options: RequestOptions = {}): Promise<TextResponse> {
    const request = createMockRequest(requestPath, options);
    const response = createMockResponse();
    await handler(request as never, response as never);

    return {
      headers: response.headers,
      status: response.statusCode,
      text: Buffer.concat(response.body).toString("utf8"),
    };
  }

  async function requestJson<TResponse>(
    requestPath: string,
    options: RequestOptions = {},
  ): Promise<JsonResponse<TResponse>> {
    const response = await requestText(requestPath, options);
    return {
      ...response,
      body: response.text ? JSON.parse(response.text) as TResponse : (null as TResponse),
    };
  }

  try {
    return await run({ requestJson, requestText });
  } finally {
    await runtimeFs.rm(runtimeDir, { force: true, recursive: true });
  }
}

test("demo support exposes deterministic end-to-end coverage", async () => {
  const report = await createDemoReport();

  assert.deepEqual(report.runtime, {
    dataSource: "external",
    destinationCount: 220,
    userCount: 12,
    seedJournalCount: 12,
    focusDestinationId: "dest-002",
    focusDestinationName: "River Polytechnic",
  });

  assert.equal(report.destination.searchQuery, "river polytechnic");
  assert.deepEqual(report.destination.searchTopIds, ["dest-002", "dest-022", "dest-042"]);
  assert.deepEqual(report.destination.searchTopMatches, ["river", "polytechnic"]);
  assert.equal(report.destination.recommendationUserId, "user-2");
  assert.equal(report.destination.recommendationTopIds.length, 3);
  assert.equal(
    report.destination.recommendationTopIds.every((entry) => entry.startsWith("dest-")),
    true,
  );
  assert.equal(report.destination.recommendationExactNameHits > 0, true);

  assert.equal(report.route.destinationId, "dest-002");
  assert.equal(report.route.startNodeId, "dest-002-gate");
  assert.equal(report.route.endNodeId, "dest-002-archive");
  assert.equal(report.route.reachable, true);
  assert.deepEqual(report.route.nodeIds, [
    "dest-002-gate",
    "dest-002-garden",
    "dest-002-hub",
    "dest-002-hall-entry",
    "dest-002-hall-l1",
    "dest-002-elevator-l1",
    "dest-002-elevator-l2",
    "dest-002-archive",
  ]);
  assert.deepEqual(report.route.indoorNodeIds, [
    "dest-002-hall-entry",
    "dest-002-hall-l1",
    "dest-002-elevator-l1",
    "dest-002-elevator-l2",
    "dest-002-archive",
  ]);
  assert.equal(report.route.indoorStepCount, 4);
  assert.deepEqual(report.route.usedModes, ["walk", "bike"]);

  assert.deepEqual(report.facility, {
    destinationId: "dest-002",
    category: "info",
    nearestId: "dest-002-facility-4",
    nearestName: "info station 4",
    nearestDistance: 480,
    nearestNodePath: ["dest-002-gate", "dest-002-garden", "dest-002-hub"],
  });

  assert.equal(report.journal.createdId, "journal-13");
  assert.equal(report.journal.createdTitle, "River Polytechnic indoor loop memo");
  assert.deepEqual(report.journal.createdTags, ["indoor", "loop", "nature", "waterfront"]);
  assert.equal(report.journal.loadedId, report.journal.createdId);
  assert.equal(report.journal.loadedViews, 0);
  assert.equal(report.journal.viewedViews, 1);
  assert.equal(report.journal.ratedAverage, 5);
  assert.equal(report.journal.recommendationTopId, report.journal.createdId);

  assert.equal(report.exchange.exactTitleId, report.journal.createdId);
  assert.equal(report.exchange.fullTextTopId, report.journal.createdId);
  assert.deepEqual(report.exchange.fullTextMatches, ["media", "lab", "noodle"]);
  assert.equal(report.exchange.inputLength > 0, true);
  assert.equal(report.exchange.compressedLength > 0, true);
  assert.equal(report.exchange.compressedLength < report.exchange.inputLength, true);
  assert.equal(report.exchange.compressionRatio > 0, true);
  assert.equal(report.exchange.compressionRatio < 1, true);
  assert.equal(report.exchange.algorithmCompressionRatio > 0, true);
  assert.equal(
    report.exchange.algorithmCompressionRatio < report.exchange.compressionRatio,
    true,
  );
  assert.equal(report.exchange.spaceSavings > 0, true);
  assert.equal(report.exchange.decompressedMatches, true);
  assert.equal(report.exchange.storyboardTitle, "River Polytechnic indoor loop memo storyboard");
  assert.deepEqual(report.exchange.storyboardFrameIds, [
    "frame-1",
    "frame-2",
    "frame-3",
    "frame-4",
  ]);

  assert.equal(report.food.searchQuery, "noodle lab");
  assert.equal(report.food.searchTopId, "dest-002-food-3");
  assert.equal(report.food.searchTopCuisine, "noodle lab");
  assert.equal(report.food.recommendationTopIds.length, 3);
  assert.equal(
    report.food.recommendationTopIds.every((entry) => entry.startsWith("dest-002-food-")),
    true,
  );
  assert.deepEqual([...report.food.recommendationTopCuisines].sort(), [
    "noodle lab",
    "sea bowl",
    "tea house",
  ]);
});

test("benchmark support covers the expected algorithm groups", () => {
  const results = collectBenchmarkResults({
    graphSize: 8,
    itemCount: 40,
    iterations: 2,
  });

  assert.deepEqual(
    results.map((result) => result.name),
    ["top-k", "search", "graph", "compression"],
  );
  assert.ok(results.every((result) => result.iterations === 2));
  assert.ok(results.every((result) => result.durationMs >= 0));
});

test("server exposes compact social journal APIs with SPA fallback and targeted cache headers", async () => {
  await withServer("social-http", async ({ requestJson, requestText }) => {
    const health = await requestJson<{ ok: boolean }>("/api/health");
    const bootstrap = await requestJson<{ users: Array<Record<string, unknown>>; destinations: Array<Record<string, unknown>> }>(
      "/api/bootstrap",
    );
    const created = await requestJson<{ item: { id: string; title: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "River Polytechnic social memo",
        body: "Started in the lobby, cut through the archive, and ended with tea by the indoor studio.",
        tags: ["indoor", "memo"],
      },
      method: "POST",
    });
    const createdId = created.body.item.id;

    const liked = await requestJson<{ item: { likeCount: number; viewerHasLiked: boolean } }>(
      `/api/journals/${createdId}/likes`,
      {
        body: { userId: "user-4" },
        method: "POST",
      },
    );
    const duplicateLike = await requestJson<{ error: string }>(`/api/journals/${createdId}/likes`, {
      body: { userId: "user-4" },
      method: "POST",
    });
    const firstComment = await requestJson<{ item: { id: string; userLabel: string } }>(
      `/api/journals/${createdId}/comments`,
      {
        body: {
          userId: "user-5",
          body: "Archive shortcut worked better than the outdoor loop.",
        },
        method: "POST",
      },
    );
    const secondComment = await requestJson<{ item: { id: string } }>(
      `/api/journals/${createdId}/comments`,
      {
        body: {
          userId: "user-6",
          body: "Tea stop at the end makes sense.",
        },
        method: "POST",
      },
    );
    const commentPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(`/api/journals/${createdId}/comments?limit=1`);
    const nextCommentPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(`/api/journals/${createdId}/comments?limit=1&cursor=${encodeURIComponent(commentPage.body.nextCursor ?? "")}`);
    const wrongDelete = await requestJson<{ error: string }>(
      `/api/comments/${firstComment.body.item.id}?userId=user-6`,
      {
        method: "DELETE",
      },
    );
    const deletedComment = await requestJson<{ deleted: boolean }>(
      `/api/comments/${firstComment.body.item.id}?userId=user-5`,
      {
        method: "DELETE",
      },
    );
    const feed = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(`/api/feed?limit=1&viewerUserId=user-4`);
    const invalidFeedCursor = await requestJson<{ error: string }>("/api/feed?cursor=bogus&viewerUserId=user-4");
    const overMaxFeedLimit = await requestJson<{ error: string }>("/api/feed?limit=999&viewerUserId=user-4");
    const detail = await requestJson<{ item: Record<string, unknown> }>(
      `/api/journals/${createdId}?viewerUserId=user-4`,
    );
    const overMaxCommentLimit = await requestJson<{ error: string }>(
      `/api/journals/${createdId}/comments?limit=999`,
    );
    const unliked = await requestJson<{ item: { likeCount: number; viewerHasLiked: boolean } }>(
      `/api/journals/${createdId}/likes?userId=user-4`,
      {
        method: "DELETE",
      },
    );
    const spaRoute = await requestText("/feed");
    const appAsset = await requestText("/app.js");
    const spaAsset = await requestText("/spa/app-shell.js");
    const cssAsset = await requestText("/styles.css");

    assert.equal(health.status, 200);
    assert.equal(health.text.includes("\n"), false, health.text);
    assert.equal(health.headers["cache-control"], "no-store");

    assert.equal(created.status, 201, created.text);
    assert.equal(created.body.item.id, "journal-13");
    assert.equal(created.body.item.title, "River Polytechnic social memo");

    assert.equal(liked.status, 200, liked.text);
    assert.equal(liked.body.item.likeCount, 1, liked.text);
    assert.equal(liked.body.item.viewerHasLiked, true, liked.text);
    assert.equal(duplicateLike.status, 400, duplicateLike.text);
    expectMatches(duplicateLike.body.error, /already liked/i);

    assert.equal(firstComment.status, 201, firstComment.text);
    assert.equal(secondComment.status, 201, secondComment.text);
    assert.equal(commentPage.body.totalCount, 2, commentPage.text);
    assert.equal(commentPage.body.items[0]?.id, secondComment.body.item.id, commentPage.text);
    assert.equal(commentPage.body.nextCursor !== null, true, commentPage.text);
    assert.equal(nextCommentPage.body.items[0]?.id, firstComment.body.item.id, nextCommentPage.text);
    assert.equal(wrongDelete.status, 400, wrongDelete.text);
    expectMatches(wrongDelete.body.error, /cannot delete comment/i);
    assert.equal(deletedComment.body.deleted, true, deletedComment.text);

    assert.equal(feed.status, 200, feed.text);
    assert.equal(feed.body.totalCount > 1, true, feed.text);
    assert.equal(feed.body.items[0]?.id, createdId, feed.text);
    assert.equal("body" in (feed.body.items[0] ?? {}), false, feed.text);
    assert.equal("ratings" in (feed.body.items[0] ?? {}), false, feed.text);
    assert.equal("comments" in (feed.body.items[0] ?? {}), false, feed.text);
    assert.equal(feed.body.items[0]?.viewerHasLiked, true, feed.text);
    assert.equal(feed.body.items[0]?.commentCount, 1, feed.text);
    assert.equal(invalidFeedCursor.status, 400, invalidFeedCursor.text);
    expectMatches(invalidFeedCursor.body.error, /Invalid cursor/);
    assert.equal(overMaxFeedLimit.status, 400, overMaxFeedLimit.text);
    expectMatches(overMaxFeedLimit.body.error, /Limit must be at most 40\./);

    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.body.item.likeCount, 1, detail.text);
    assert.equal(detail.body.item.commentCount, 1, detail.text);
    assert.equal(typeof detail.body.item.body, "string", detail.text);
    assert.equal(detail.body.item.destinationLabel, "River Polytechnic");
    assert.equal(overMaxCommentLimit.status, 400, overMaxCommentLimit.text);
    expectMatches(overMaxCommentLimit.body.error, /Limit must be at most 50\./);

    assert.equal(unliked.status, 200, unliked.text);
    assert.equal(unliked.body.item.likeCount, 0, unliked.text);
    assert.equal(unliked.body.item.viewerHasLiked, false, unliked.text);

    assert.equal(Array.isArray(bootstrap.body.users), true, bootstrap.text);
    assert.equal("interests" in (bootstrap.body.users[0] ?? {}), false, bootstrap.text);
    assert.equal("graph" in (bootstrap.body.destinations[0] ?? {}), false, bootstrap.text);

    assert.equal(spaRoute.status, 200);
    assert.equal(spaRoute.headers["cache-control"], "no-store");
    expectMatches(spaRoute.text, /<!DOCTYPE html>/i);
    assert.equal(appAsset.status, 200);
    assert.equal(appAsset.headers["cache-control"], "no-store");
    assert.equal(spaAsset.status, 200);
    assert.equal(spaAsset.headers["cache-control"], "no-store");
    assert.equal(cssAsset.status, 200);
    assert.equal(cssAsset.headers["cache-control"], "no-store");
  });
});

test("server keeps feed cursors valid across journal edits, ratings, and social activity", async () => {
  await withServer("social-route-regressions", async ({ requestJson }) => {
    const created = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "River Polytechnic route suffix regression",
        body: "Archive pass-through with a quiet indoor finish.",
        tags: ["indoor", "archive"],
      },
      method: "POST",
    });
    const createdId = created.body.item.id;
    const createdDetail = await requestJson<{ item: { updatedAt: string } }>(`/api/journals/${createdId}`);
    const feedPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(`/api/feed?limit=1&viewerUserId=user-4`);
    const malformedGetComments = await requestJson<{ error: string }>(`/api/journals/${createdId}/comments/extra`);
    const malformedPostComment = await requestJson<{ error: string }>(`/api/journals/${createdId}/comments/extra`, {
      body: { userId: "user-5", body: "Should not be accepted." },
      method: "POST",
    });
    const malformedPostLike = await requestJson<{ error: string }>(`/api/journals/${createdId}/likes/extra`, {
      body: { userId: "user-4" },
      method: "POST",
    });
    const malformedDeleteLike = await requestJson<{ error: string }>(
      `/api/journals/${createdId}/likes/extra?userId=user-4`,
      {
        method: "DELETE",
      },
    );

    assert.equal(feedPage.body.items[0]?.id, createdId, feedPage.text);
    assert.equal(feedPage.body.nextCursor !== null, true, feedPage.text);

    const patched = await requestJson<{ item: { id: string; title: string; updatedAt: string } }>(`/api/journals/${createdId}`, {
      body: {
        title: "River Polytechnic route suffix regression revised",
        body: "Archive pass-through with a quiet indoor finish and updated return guidance.",
        tags: ["indoor", "archive", "return"],
      },
      method: "PATCH",
    });
    const rated = await requestJson<{ item: { averageRating: number; updatedAt: string } }>(
      `/api/journals/${createdId}/rate`,
      {
        body: { userId: "user-4", score: 5 },
        method: "POST",
      },
    );
    await requestJson<{ item: Record<string, unknown> }>(`/api/journals/${createdId}/likes`, {
      body: { userId: "user-4" },
      method: "POST",
    });
    await requestJson<{ item: Record<string, unknown> }>(`/api/journals/${createdId}/comments`, {
      body: {
        userId: "user-5",
        body: "Archive finish still looks right.",
      },
      method: "POST",
    });
    await requestJson<{ item: Record<string, unknown> }>(`/api/journals/${createdId}/view`, {
      method: "POST",
    });
    await requestJson<{ item: Record<string, unknown> }>(`/api/journals/${createdId}/likes?userId=user-4`, {
      method: "DELETE",
    });

    const nextFeedPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(`/api/feed?limit=1&viewerUserId=user-4&cursor=${encodeURIComponent(feedPage.body.nextCursor ?? "")}`);

    assert.equal(patched.status, 200, patched.text);
    assert.equal(patched.body.item.id, createdId, patched.text);
    assert.equal(patched.body.item.title, "River Polytechnic route suffix regression revised", patched.text);
    assert.equal(patched.body.item.updatedAt === createdDetail.body.item.updatedAt, false, patched.text);
    assert.equal(rated.status, 200, rated.text);
    assert.equal(rated.body.item.averageRating, 5, rated.text);
    assert.equal(nextFeedPage.status, 200, nextFeedPage.text);
    assert.equal(nextFeedPage.body.items[0]?.id === createdId, false, nextFeedPage.text);

    assert.equal(malformedGetComments.status, 404, malformedGetComments.text);
    assert.equal(malformedGetComments.body.error, "Unknown API endpoint.", malformedGetComments.text);
    assert.equal(malformedPostComment.status, 404, malformedPostComment.text);
    assert.equal(malformedPostComment.body.error, "Unknown API endpoint.", malformedPostComment.text);
    assert.equal(malformedPostLike.status, 404, malformedPostLike.text);
    assert.equal(malformedPostLike.body.error, "Unknown API endpoint.", malformedPostLike.text);
    assert.equal(malformedDeleteLike.status, 404, malformedDeleteLike.text);
    assert.equal(malformedDeleteLike.body.error, "Unknown API endpoint.", malformedDeleteLike.text);
  });
});
