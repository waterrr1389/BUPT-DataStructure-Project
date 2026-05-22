import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { collectBenchmarkResults } from "../scripts/benchmark-support";
import { createDemoReport } from "../scripts/demo-support";
import { createServerHandler } from "../src/server/index";
import { WORLD_ROUTE_PORTAL_SELECTION_TIE_BREAK_ORDER } from "../src/services/contracts";
import { createAppServices, type AppServices } from "../src/services/index";
import { deriveWorldRuntimeState } from "../src/services/runtime";
import { parsePublicPageScriptContract } from "./support/spa-harness";
import { readRuntimePublicTextAsset } from "./support/runtime-public";

type JsonResponse<T> = {
  body: T;
  headers: Record<string, string>;
  status: number;
  text: string;
};

type TextResponse = {
  body: Buffer;
  headers: Record<string, string>;
  status: number;
  text: string;
};

type RequestOptions = {
  body?: Buffer | string | Record<string, unknown>;
  headers?: Record<string, string>;
  method?: string;
};

type ServerOptions = {
  prepareServices?: (services: AppServices) => Promise<void> | void;
};

type RuntimeFs = {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
};

const imageFixtures = {
  gif: {
    bytes: Buffer.from("GIF89a", "ascii"),
    extension: "gif",
    mimeType: "image/gif",
  },
  jpeg: {
    bytes: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
    extension: "jpg",
    mimeType: "image/jpeg",
  },
  png: {
    bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    extension: "png",
    mimeType: "image/png",
  },
  webp: {
    bytes: Buffer.from("RIFF\x04\x00\x00\x00WEBP", "binary"),
    extension: "webp",
    mimeType: "image/webp",
  },
} as const;

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
  headers: Record<string, string>;
  method: string;
  url: string;
  [Symbol.asyncIterator](): AsyncGenerator<Buffer, void, unknown>;
} {
  const chunks =
    options.body === undefined
      ? []
      : [Buffer.isBuffer(options.body) ? options.body : Buffer.from(typeof options.body === "string" ? options.body : JSON.stringify(options.body))];

  return {
    headers: options.headers ?? {},
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
    reloadServices: () => Promise<void>;
    requestJson: <TResponse>(requestPath: string, options?: RequestOptions) => Promise<JsonResponse<TResponse>>;
    requestText: (requestPath: string, options?: RequestOptions) => Promise<TextResponse>;
    runtimeDir: string;
  }) => Promise<T>,
  options: ServerOptions = {},
): Promise<T> {
  const runtimeFs = fs as unknown as RuntimeFs;
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-integration-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await runtimeFs.mkdir(runtimeDir, { recursive: true });
  let services = await createAppServices({ runtimeDir });
  await services.journalStore.reset();
  await options.prepareServices?.(services);
  let handler = createServerHandler(services);

  async function reloadServices(): Promise<void> {
    services = await createAppServices({ runtimeDir });
    handler = createServerHandler(services);
  }

  async function requestText(requestPath: string, options: RequestOptions = {}): Promise<TextResponse> {
    const request = createMockRequest(requestPath, options);
    const response = createMockResponse();
    await handler(request as never, response as never);
    const responseBody = Buffer.concat(response.body);

    return {
      body: responseBody,
      headers: response.headers,
      status: response.statusCode,
      text: responseBody.toString("utf8"),
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
    return await run({ reloadServices, requestJson, requestText, runtimeDir });
  } finally {
    await runtimeFs.rm(runtimeDir, { force: true, recursive: true });
  }
}

function createMultipartBody(file: { content: Buffer; fileName: string; mimeType: string }): {
  body: Buffer;
  contentType: string;
} {
  const boundary = `trail-atlas-${Math.random().toString(36).slice(2, 10)}`;
  const head = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${file.fileName}"`,
      `Content-Type: ${file.mimeType}`,
      "",
      "",
    ].join("\r\n"),
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, file.content, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function createMultiFileMultipartBody(files: Array<{ content: Buffer; fileName: string; mimeType: string }>): {
  body: Buffer;
  contentType: string;
} {
  const boundary = `trail-atlas-${Math.random().toString(36).slice(2, 10)}`;
  const parts = files.flatMap((file) => [
    Buffer.from(
      [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${file.fileName}"`,
        `Content-Type: ${file.mimeType}`,
        "",
        "",
      ].join("\r\n"),
    ),
    file.content,
    Buffer.from("\r\n"),
  ]);
  return {
    body: Buffer.concat([...parts, Buffer.from(`--${boundary}--\r\n`)]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function disableWorld(services: AppServices): void {
  services.runtime.seedData = {
    ...services.runtime.seedData,
    world: undefined,
  };
  services.runtime.lookups.world = undefined;
  services.runtime.world = deriveWorldRuntimeState(services.runtime.seedData);
}

function cloneWorld(services: AppServices) {
  const world = services.runtime.seedData.world;
  if (!world) {
    throw new Error("World mode is unavailable.");
  }
  return JSON.parse(JSON.stringify(world)) as typeof world;
}

function applyWorld(services: AppServices, world: NonNullable<AppServices["runtime"]["seedData"]["world"]>): void {
  services.runtime.seedData = {
    ...services.runtime.seedData,
    world,
  };
  services.runtime.lookups.world = world;
  services.runtime.world = deriveWorldRuntimeState(services.runtime.seedData);
}

test("demo support exposes deterministic end-to-end coverage", async () => {
  const report = await createDemoReport();

  assert.deepEqual(report.runtime, {
    dataSource: "external",
    destinationCount: 220,
    userCount: 12,
    seedJournalCount: 12,
    focusDestinationId: "dest-002",
    focusDestinationName: "North Institute",
  });

  assert.equal(report.destination.searchQuery, "north institute");
  assert.deepEqual(report.destination.searchTopIds, ["dest-002", "dest-134", "dest-024"]);
  assert.deepEqual(report.destination.searchTopMatches, ["north", "institute"]);
  assert.equal(report.destination.recommendationUserId, "user-2");
  assert.equal(report.destination.recommendationTopIds.length, 3);
  assert.equal(
    report.destination.recommendationTopIds.every((entry) => entry.startsWith("dest-")),
    true,
  );
  assert.equal(report.destination.recommendationExactNameHits, 0);

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
  assert.equal(report.journal.createdTitle, "North Institute indoor loop memo");
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
  assert.equal(report.exchange.storyboardTitle, "North Institute indoor loop memo storyboard");
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

test("server uploads an image file and serves it from runtime storage", async () => {
  await withServer("image-upload-success", async ({ reloadServices, requestJson, requestText }) => {
    for (const [label, fixture] of Object.entries(imageFixtures)) {
      const multipart = createMultipartBody({
        content: fixture.bytes,
        fileName: label === "png" ? "../original-name.png" : `sample.${fixture.extension}`,
        mimeType: fixture.mimeType,
      });
      const uploaded = await requestJson<{
        item: {
          fileName: string;
          id: string;
          mimeType: string;
          originalName: string;
          size: number;
          url: string;
        };
      }>("/api/uploads/images", {
        body: multipart.body,
        headers: { "content-type": multipart.contentType },
        method: "POST",
      });

      assert.equal(uploaded.status, 201, uploaded.text);
      assert.equal(uploaded.body.item.mimeType, fixture.mimeType, uploaded.text);
      assert.equal(uploaded.body.item.originalName, label === "png" ? "original-name.png" : `sample.${fixture.extension}`, uploaded.text);
      assert.equal(uploaded.body.item.size, fixture.bytes.length, uploaded.text);
      assert.equal(uploaded.body.item.fileName.endsWith(`.${fixture.extension}`), true, uploaded.text);
      assert.equal(uploaded.body.item.fileName.includes("original-name"), false, uploaded.text);
      assert.equal(uploaded.body.item.url, `/uploads/images/${uploaded.body.item.fileName}`, uploaded.text);
      expectMatches(
        uploaded.body.item.fileName,
        new RegExp(`^image-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.${fixture.extension}$`),
      );

      const served = await requestText(uploaded.body.item.url);
      assert.equal(served.status, 200, served.text);
      assert.equal(served.headers["content-type"], fixture.mimeType);
      assert.deepEqual(served.body, fixture.bytes);

      await reloadServices();
      const servedAfterReload = await requestText(uploaded.body.item.url);
      assert.equal(servedAfterReload.status, 200, servedAfterReload.text);
      assert.equal(servedAfterReload.headers["content-type"], fixture.mimeType);
      assert.deepEqual(servedAfterReload.body, fixture.bytes);
    }
  });
});

test("server rejects invalid image uploads and unsafe uploaded image paths", async () => {
  await withServer("image-upload-rejections", async ({ requestJson }) => {
    const textMultipart = createMultipartBody({
      content: Buffer.from("not an image", "utf8"),
      fileName: "note.txt",
      mimeType: "text/plain",
    });
    const oversizedMultipart = createMultipartBody({
      content: Buffer.alloc((5 * 1024 * 1024) + 1, 0x61),
      fileName: "large.png",
      mimeType: "image/png",
    });
    const emptyMultipart = createMultipartBody({
      content: Buffer.alloc(0),
      fileName: "empty.png",
      mimeType: "image/png",
    });
    const invalidBytesMultipart = createMultipartBody({
      content: Buffer.from("declared png but not image bytes", "utf8"),
      fileName: "fake.png",
      mimeType: "image/png",
    });
    const multiFileMultipart = createMultiFileMultipartBody([
      {
        content: imageFixtures.png.bytes,
        fileName: "first.png",
        mimeType: "image/png",
      },
      {
        content: imageFixtures.jpeg.bytes,
        fileName: "second.jpg",
        mimeType: "image/jpeg",
      },
    ]);
    const malformedBoundary = "trail-atlas-malformed";
    const malformedMultipart = Buffer.from(
      [
        `--${malformedBoundary}`,
        `Content-Disposition: form-data; name="file"; filename="broken.png"`,
        "Content-Type: image/png",
        "",
        "not closed",
      ].join("\r\n"),
    );

    const textUpload = await requestJson<{ code: string; error: string }>("/api/uploads/images", {
      body: textMultipart.body,
      headers: { "content-type": textMultipart.contentType },
      method: "POST",
    });
    const oversizedUpload = await requestJson<{ code: string; error: string }>("/api/uploads/images", {
      body: oversizedMultipart.body,
      headers: { "content-type": oversizedMultipart.contentType },
      method: "POST",
    });
    const emptyUpload = await requestJson<{ code: string; error: string }>("/api/uploads/images", {
      body: emptyMultipart.body,
      headers: { "content-type": emptyMultipart.contentType },
      method: "POST",
    });
    const invalidBytesUpload = await requestJson<{ code: string; error: string }>("/api/uploads/images", {
      body: invalidBytesMultipart.body,
      headers: { "content-type": invalidBytesMultipart.contentType },
      method: "POST",
    });
    const multiFileUpload = await requestJson<{ code: string; error: string }>("/api/uploads/images", {
      body: multiFileMultipart.body,
      headers: { "content-type": multiFileMultipart.contentType },
      method: "POST",
    });
    const malformedUpload = await requestJson<{ code: string; error: string }>("/api/uploads/images", {
      body: malformedMultipart,
      headers: { "content-type": `multipart/form-data; boundary=${malformedBoundary}` },
      method: "POST",
    });
    const traversal = await requestJson<{ error: string }>("/uploads/images/../journals.json");
    const encodedTraversal = await requestJson<{ error: string }>("/uploads/images/%2e%2e%2fjournals.json");

    assert.equal(textUpload.status, 415, textUpload.text);
    assert.equal(textUpload.body.code, "upload_unsupported_image_type", textUpload.text);
    assert.equal(oversizedUpload.status, 413, oversizedUpload.text);
    assert.equal(oversizedUpload.body.code, "upload_image_too_large", oversizedUpload.text);
    assert.equal(emptyUpload.status, 400, emptyUpload.text);
    assert.equal(emptyUpload.body.code, "upload_image_empty", emptyUpload.text);
    assert.equal(invalidBytesUpload.status, 400, invalidBytesUpload.text);
    assert.equal(invalidBytesUpload.body.code, "upload_invalid_image_bytes", invalidBytesUpload.text);
    assert.equal(multiFileUpload.status, 400, multiFileUpload.text);
    assert.equal(multiFileUpload.body.code, "upload_single_file_required", multiFileUpload.text);
    assert.equal(malformedUpload.status, 400, malformedUpload.text);
    assert.equal(malformedUpload.body.code, "upload_invalid_multipart", malformedUpload.text);
    assert.equal(traversal.status, 403, traversal.text);
    assert.equal(encodedTraversal.status, 403, encodedTraversal.text);
  });
});

test("server rejects malformed comment media over HTTP", async () => {
  await withServer("comment-media-http-rejections", async ({ requestJson }) => {
    const created = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "North Institute comment media validation",
        body: "A short route note for validating comment media.",
        tags: ["indoor", "media"],
      },
      method: "POST",
    });
    const commentPath = `/api/journals/${created.body.item.id}/comments`;
    const validUploadSource = "/uploads/images/image-11111111-1111-1111-1111-111111111111.png";
    const cases = [
      {
        body: {
          userId: "user-5",
          body: "Unsupported media type should fail.",
          media: [{ type: "video", title: "Archive clip", source: validUploadSource }],
        },
        pattern: /Comment media type must be image/,
      },
      {
        body: {
          userId: "user-5",
          body: "Missing media type should fail.",
          media: [{ title: "Archive", source: validUploadSource }],
        },
        pattern: /Comment media type must be image/,
      },
      {
        body: {
          userId: "user-5",
          body: "Missing media title should fail.",
          media: [{ type: "image", source: validUploadSource }],
        },
        pattern: /Comment media title is required/,
      },
      {
        body: {
          userId: "user-5",
          body: "Missing media source should fail.",
          media: [{ type: "image", title: "Archive" }],
        },
        pattern: /Comment media source is required/,
      },
      {
        body: {
          userId: "user-5",
          body: "Too many images should fail.",
          media: [
            { type: "image", title: "Archive entrance", source: validUploadSource },
            {
              type: "image",
              title: "Archive exit",
              source: "/uploads/images/image-22222222-2222-2222-2222-222222222222.jpg",
            },
          ],
        },
        pattern: /Comment media supports one image/,
      },
      {
        body: {
          userId: "user-5",
          body: "Non-array media should fail.",
          media: { type: "image", title: "Archive", source: validUploadSource },
        },
        pattern: /Comment media must be an array/,
      },
      {
        body: {
          userId: "user-5",
          body: "External URLs should fail.",
          media: [{ type: "image", title: "External archive", source: "https://example.com/archive.png" }],
        },
        pattern: /Comment media source must be a generated upload image URL/,
      },
      {
        body: {
          userId: "user-5",
          body: "Unrelated local paths should fail.",
          media: [{ type: "image", title: "Local archive", source: "/assets/archive.png" }],
        },
        pattern: /Comment media source must be a generated upload image URL/,
      },
      {
        body: {
          userId: "user-5",
          body: "Forged generated upload paths should fail.",
          media: [{ type: "image", title: "Forged archive", source: validUploadSource }],
        },
        pattern: /Comment media source must reference an uploaded image/,
      },
    ];

    for (const entry of cases) {
      const response = await requestJson<{ error: string }>(commentPath, {
        body: entry.body,
        method: "POST",
      });
      assert.equal(response.status, 400, response.text);
      expectMatches(response.body.error, entry.pattern);
    }
  });
});

test("server rejects uploaded comment media for unknown journal or user", async () => {
  await withServer("comment-media-http-known-entities", async ({ requestJson }) => {
    const created = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "North Institute known entity validation",
        body: "A route note for upload-backed comment media entity validation.",
        tags: ["indoor", "media"],
      },
      method: "POST",
    });
    const multipart = createMultipartBody({
      content: imageFixtures.png.bytes,
      fileName: "comment.png",
      mimeType: "image/png",
    });
    const upload = await requestJson<{ item: { url: string } }>("/api/uploads/images", {
      body: multipart.body,
      headers: { "content-type": multipart.contentType },
      method: "POST",
    });
    const media = [
      {
        type: "image",
        title: "Archive route snapshot",
        source: upload.body.item.url,
      },
    ];
    const unknownJournal = await requestJson<{ error: string }>("/api/journals/journal-missing/comments", {
      body: {
        userId: "user-5",
        body: "Unknown journals should still fail with media.",
        media,
      },
      method: "POST",
    });
    const unknownUser = await requestJson<{ error: string }>(`/api/journals/${created.body.item.id}/comments`, {
      body: {
        userId: "user-missing",
        body: "Unknown users should still fail with media.",
        media,
      },
      method: "POST",
    });

    assert.equal(upload.status, 201, upload.text);
    assert.equal(unknownJournal.status, 400, unknownJournal.text);
    expectMatches(unknownJournal.body.error, /Unknown journal: journal-missing/);
    assert.equal(unknownUser.status, 400, unknownUser.text);
    expectMatches(unknownUser.body.error, /Unknown user: user-missing/);
  });
});

test("server persists uploaded comment media after reload and removes it after deletion", async () => {
  await withServer("comment-media-http-lifecycle", async ({ reloadServices, requestJson }) => {
    const created = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "North Institute media lifecycle",
        body: "A route note for upload-backed comment media persistence.",
        tags: ["indoor", "media"],
      },
      method: "POST",
    });
    const multipart = createMultipartBody({
      content: imageFixtures.png.bytes,
      fileName: "comment.png",
      mimeType: "image/png",
    });
    const upload = await requestJson<{ item: { mimeType: string; size: number; url: string } }>("/api/uploads/images", {
      body: multipart.body,
      headers: { "content-type": multipart.contentType },
      method: "POST",
    });
    const media = [
      {
        type: "image",
        title: "Archive route snapshot",
        source: upload.body.item.url,
        note: "A compact route preview.",
      },
    ];
    const comment = await requestJson<{ item: { id: string; media: unknown[] } }>(
      `/api/journals/${created.body.item.id}/comments`,
      {
        body: {
          userId: "user-5",
          body: "The uploaded route snapshot should persist.",
          media,
        },
        method: "POST",
      },
    );

    assert.equal(upload.status, 201, upload.text);
    assert.equal(upload.body.item.mimeType, "image/png", upload.text);
    assert.equal(upload.body.item.size, imageFixtures.png.bytes.length, upload.text);
    assert.equal(comment.status, 201, comment.text);
    assert.deepEqual(comment.body.item.media, media, comment.text);

    await reloadServices();
    const reloadedPage = await requestJson<{ items: Array<{ id: string; media: unknown[] }>; totalCount: number }>(
      `/api/journals/${created.body.item.id}/comments?limit=10`,
    );
    assert.equal(reloadedPage.status, 200, reloadedPage.text);
    assert.equal(reloadedPage.body.totalCount, 1, reloadedPage.text);
    assert.equal(reloadedPage.body.items[0]?.id, comment.body.item.id, reloadedPage.text);
    assert.deepEqual(reloadedPage.body.items[0]?.media, media, reloadedPage.text);

    const deleted = await requestJson<{ deleted: boolean }>(`/api/comments/${comment.body.item.id}?userId=user-5`, {
      method: "DELETE",
    });
    const afterDeletePage = await requestJson<{ items: Array<{ id: string; media: unknown[] }>; totalCount: number }>(
      `/api/journals/${created.body.item.id}/comments?limit=10`,
    );
    assert.equal(deleted.status, 200, deleted.text);
    assert.equal(deleted.body.deleted, true, deleted.text);
    assert.equal(afterDeletePage.status, 200, afterDeletePage.text);
    assert.equal(afterDeletePage.body.totalCount, 0, afterDeletePage.text);
    assert.deepEqual(afterDeletePage.body.items, [], afterDeletePage.text);
  });
});

test("server hides parent journal comments after deleting a journal with media comments", async () => {
  await withServer("journal-comment-parent-delete-http", async ({ requestJson }) => {
    const created = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "North Institute comment cleanup route",
        body: "A route note with plain and image comments that should disappear with the parent journal.",
        tags: ["indoor", "cleanup"],
      },
      method: "POST",
    });
    const multipart = createMultipartBody({
      content: imageFixtures.png.bytes,
      fileName: "cleanup-comment.png",
      mimeType: "image/png",
    });
    const upload = await requestJson<{ item: { url: string } }>("/api/uploads/images", {
      body: multipart.body,
      headers: { "content-type": multipart.contentType },
      method: "POST",
    });
    const media = [
      {
        type: "image",
        title: "Cleanup image",
        source: upload.body.item.url,
      },
    ];
    const plainComment = await requestJson<{ item: { id: string; media: unknown[] } }>(
      `/api/journals/${created.body.item.id}/comments`,
      {
        body: {
          userId: "user-5",
          body: "Plain comment should not survive as a visible stale record.",
        },
        method: "POST",
      },
    );
    const mediaComment = await requestJson<{ item: { id: string; media: unknown[] } }>(
      `/api/journals/${created.body.item.id}/comments`,
      {
        body: {
          userId: "user-6",
          body: "Image comment should not survive as a visible stale record.",
          media,
        },
        method: "POST",
      },
    );
    const beforeDelete = await requestJson<{
      items: Array<{ id: string; media: unknown[] }>;
      totalCount: number;
    }>(`/api/journals/${created.body.item.id}/comments?limit=10`);
    const deleted = await requestJson<{ deleted: boolean }>(`/api/journals/${created.body.item.id}`, {
      method: "DELETE",
    });
    const afterDelete = await requestJson<{ error: string }>(`/api/journals/${created.body.item.id}/comments?limit=10`);

    assert.equal(created.status, 201, created.text);
    assert.equal(upload.status, 201, upload.text);
    assert.equal(plainComment.status, 201, plainComment.text);
    assert.deepEqual(plainComment.body.item.media, [], plainComment.text);
    assert.equal(mediaComment.status, 201, mediaComment.text);
    assert.deepEqual(mediaComment.body.item.media, media, mediaComment.text);
    assert.equal(beforeDelete.status, 200, beforeDelete.text);
    assert.equal(beforeDelete.body.totalCount, 2, beforeDelete.text);
    assert.equal(
      beforeDelete.body.items.some((item) => item.id === plainComment.body.item.id),
      true,
      beforeDelete.text,
    );
    assert.equal(
      beforeDelete.body.items.some((item) => item.id === mediaComment.body.item.id && item.media.length === 1),
      true,
      beforeDelete.text,
    );
    assert.equal(deleted.status, 200, deleted.text);
    assert.equal(deleted.body.deleted, true, deleted.text);
    assert.equal(afterDelete.status, 400, afterDelete.text);
    expectMatches(afterDelete.body.error, new RegExp(`Unknown journal: ${created.body.item.id}`));
  });
});

test("server rejects blank comment bodies with empty media over HTTP", async () => {
  await withServer("comment-blank-body-empty-media-http", async ({ requestJson }) => {
    const created = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "North Institute blank comment validation",
        body: "A route note for validating empty image comment payloads.",
        tags: ["indoor", "validation"],
      },
      method: "POST",
    });
    const blankComment = await requestJson<{ error: string }>(`/api/journals/${created.body.item.id}/comments`, {
      body: {
        userId: "user-5",
        body: "   ",
        media: [],
      },
      method: "POST",
    });
    const commentPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      totalCount: number;
    }>(`/api/journals/${created.body.item.id}/comments?limit=10`);

    assert.equal(created.status, 201, created.text);
    assert.equal(blankComment.status, 400, blankComment.text);
    assert.equal(blankComment.body.error, "Comment body is required.", blankComment.text);
    assert.equal(commentPage.status, 200, commentPage.text);
    assert.equal(commentPage.body.totalCount, 0, commentPage.text);
    assert.deepEqual(commentPage.body.items, [], commentPage.text);
  });
});

test("server normalizes legacy comments without media over HTTP", async () => {
  let journalId = "";
  let commentId = "";

  await withServer(
    "comment-legacy-media-http",
    async ({ requestJson }) => {
      const commentPage = await requestJson<{
        items: Array<Record<string, unknown>>;
        totalCount: number;
      }>(`/api/journals/${journalId}/comments?limit=10`);

      assert.equal(commentPage.status, 200, commentPage.text);
      assert.equal(commentPage.body.totalCount, 1, commentPage.text);
      assert.equal(commentPage.body.items[0]?.id, commentId, commentPage.text);
      assert.deepEqual(commentPage.body.items[0]?.media, [], commentPage.text);
    },
    {
      prepareServices: async (services) => {
        const created = await services.journals.create({
          userId: "user-2",
          destinationId: "dest-002",
          title: "North Institute legacy comment route",
          body: "A route note with an old comment record.",
          tags: ["indoor", "legacy"],
        });
        const legacyComment = await services.journalStore.upsertComment({
          id: "comment-legacy-http-1",
          journalId: created.id,
          userId: "user-5",
          body: "Legacy comment was stored before media existed.",
          createdAt: "2026-04-03T09:00:00.000Z",
          updatedAt: "2026-04-03T09:00:00.000Z",
        });
        journalId = created.id;
        commentId = legacyComment.id;
      },
    },
  );
});

test("server preserves legacy journal media and exposes compact feed media counts", async () => {
  await withServer("journal-legacy-media-http", async ({ requestJson }) => {
    const legacyMedia = [
      {
        type: "image",
        title: "Archive route card",
        source: "generated://journal-media/archive-route-card",
        note: "Legacy generated image card.",
      },
      {
        type: "video",
        title: "Archive route clip",
        source: "generated://journal-media/archive-route-clip",
      },
    ];
    const created = await requestJson<{ item: { id: string; media: unknown[] } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "North Institute legacy media route",
        body: "A route note carrying legacy generated journal media.",
        tags: ["indoor", "legacy"],
        media: legacyMedia,
      },
      method: "POST",
    });
    const detail = await requestJson<{ item: { media: unknown[] } }>(`/api/journals/${created.body.item.id}`);
    const patched = await requestJson<{ item: { media: unknown[]; title: string } }>(`/api/journals/${created.body.item.id}`, {
      body: {
        userId: "user-2",
        title: "North Institute legacy media route update",
        body: "Updated route text should not clear legacy media.",
      },
      method: "PATCH",
    });
    const feed = await requestJson<{
      items: Array<Record<string, unknown>>;
      totalCount: number;
    }>("/api/feed?limit=1");

    assert.equal(created.status, 201, created.text);
    assert.deepEqual(created.body.item.media, legacyMedia, created.text);
    assert.equal(detail.status, 200, detail.text);
    assert.deepEqual(detail.body.item.media, legacyMedia, detail.text);
    assert.equal(patched.status, 200, patched.text);
    assert.equal(patched.body.item.title, "North Institute legacy media route update", patched.text);
    assert.deepEqual(patched.body.item.media, legacyMedia, patched.text);
    assert.equal(feed.status, 200, feed.text);
    assert.equal(feed.body.totalCount > 1, true, feed.text);
    assert.equal(feed.body.items[0]?.id, created.body.item.id, feed.text);
    assert.equal(feed.body.items[0]?.mediaCount, legacyMedia.length, feed.text);
    assert.equal("media" in (feed.body.items[0] ?? {}), false, feed.text);
    assert.equal("body" in (feed.body.items[0] ?? {}), false, feed.text);
    assert.equal("ratings" in (feed.body.items[0] ?? {}), false, feed.text);
    assert.equal("comments" in (feed.body.items[0] ?? {}), false, feed.text);
  });
});

test("server keeps journal exchange compression endpoints compatible", async () => {
  await withServer("journal-exchange-http-compression", async ({ requestJson }) => {
    const body = `  ${"North Institute indoor archive loop. ".repeat(12)}\n`;
    const compressed = await requestJson<{
      item: {
        compressed: string;
        compressionRatio: number;
        inputLength: number;
        payloadLength: number;
        spaceSavings: number;
      };
    }>("/api/journal-exchange/compress", {
      body: { body },
      method: "POST",
    });
    const decompressed = await requestJson<{ item: { text: string } }>("/api/journal-exchange/decompress", {
      body: { body: compressed.body.item.compressed },
      method: "POST",
    });

    assert.equal(compressed.status, 200, compressed.text);
    assert.equal(compressed.body.item.inputLength, body.length, compressed.text);
    assert.equal(compressed.body.item.payloadLength, compressed.body.item.compressed.length, compressed.text);
    assert.equal(compressed.body.item.compressionRatio > 0, true, compressed.text);
    assert.equal(compressed.body.item.spaceSavings > 0, true, compressed.text);
    assert.equal(decompressed.status, 200, decompressed.text);
    assert.equal(decompressed.body.item.text, body, decompressed.text);
  });
});

test("server exposes read-only world summary and details while keeping bootstrap lightweight", async () => {
  await withServer("world-http", async ({ requestJson, requestText }) => {
    const summary = await requestJson<{
      enabled: boolean;
      world?: Record<string, unknown>;
      regions: Array<Record<string, unknown>>;
      destinations: Array<Record<string, unknown>>;
      capabilities: Record<string, unknown>;
    }>("/api/world");
    const details = await requestJson<{
      world: {
        id: string;
        graph: { nodes: unknown[]; edges: unknown[] };
        portals: unknown[];
        regions: unknown[];
      };
    }>("/api/world/details");
    const bootstrap = await requestJson<Record<string, unknown>>("/api/bootstrap");
    const worldBackground = await requestText("/assets/world-map/atlas-boston-inspired-v1.png");
    const leafletMarker = await requestText("/vendor/leaflet/images/marker-icon.png");

    assert.equal(summary.status, 200, summary.text);
    assert.equal(summary.body.enabled, true, summary.text);
    assert.deepEqual(summary.body.capabilities, {
      worldView: true,
      destinationRouting: true,
      crossMapRouting: true,
    });
    assert.deepEqual(
      Object.keys(summary.body.world ?? {}).sort(),
      ["backgroundImage", "height", "id", "name", "width"],
      summary.text,
    );
    assert.equal("polygon" in (summary.body.regions[0] ?? {}), false, summary.text);
    assert.equal("tags" in (summary.body.regions[0] ?? {}), false, summary.text);
    assert.equal("radius" in (summary.body.destinations[0] ?? {}), false, summary.text);
    assert.equal("portalIds" in (summary.body.destinations[0] ?? {}), false, summary.text);

    assert.equal(details.status, 200, details.text);
    assert.equal(details.body.world.id.length > 0, true, details.text);
    assert.equal(details.body.world.regions.length > 0, true, details.text);
    assert.equal(details.body.world.graph.nodes.length > 0, true, details.text);
    assert.equal(details.body.world.graph.edges.length > 0, true, details.text);
    assert.equal(details.body.world.portals.length > 0, true, details.text);

    assert.equal(bootstrap.status, 200, bootstrap.text);
    assert.equal("world" in bootstrap.body, false, bootstrap.text);

    assert.equal(worldBackground.status, 200, worldBackground.text);
    assert.equal(worldBackground.headers["content-type"], "image/png");
    assert.equal(leafletMarker.status, 200, leafletMarker.text);
    assert.equal(leafletMarker.headers["content-type"], "image/png");
  });
});

test("server returns disabled world summary and a conflict for details when world mode is unavailable", async () => {
  await withServer(
    "world-http-unavailable",
    async ({ requestJson }) => {
      const summary = await requestJson<{
        enabled: boolean;
        regions: unknown[];
        destinations: unknown[];
        capabilities: Record<string, unknown>;
      }>("/api/world");
      const details = await requestJson<{ error: string; code: string }>("/api/world/details");
      const bootstrap = await requestJson<Record<string, unknown>>("/api/bootstrap");

      assert.equal(summary.status, 200, summary.text);
      assert.deepEqual(summary.body, {
        enabled: false,
        regions: [],
        destinations: [],
        capabilities: {
          worldView: false,
          destinationRouting: false,
          crossMapRouting: false,
        },
      });

      assert.equal(details.status, 409, details.text);
      assert.deepEqual(details.body, {
        error: "World mode is unavailable.",
        code: "world_unavailable",
      });

      assert.equal(bootstrap.status, 200, bootstrap.text);
      assert.equal("world" in bootstrap.body, false, bootstrap.text);
    },
    {
      prepareServices: disableWorld,
    },
  );
});

test("server exposes world route planning for cross-map destination-to-destination and local-node-to-local-node requests", async () => {
  await withServer("world-routes-success", async ({ requestJson }) => {
    const destinationToDestination = await requestJson<{
      item: {
        reachable: boolean;
        scope: string;
        legs: Array<Record<string, unknown>>;
        portalSelection: { entryPortalId: string; exitPortalId: string };
      };
    }>("/api/world/routes/plan", {
      method: "POST",
      body: {
        scope: "cross-map",
        fromDestinationId: "dest-002",
        toDestinationId: "dest-004",
        strategy: "distance",
        mode: "walk",
      },
    });

    assert.equal(destinationToDestination.status, 200, destinationToDestination.text);
    assert.equal(destinationToDestination.body.item.reachable, true, destinationToDestination.text);
    assert.equal(destinationToDestination.body.item.scope, "cross-map");
    assert.equal(destinationToDestination.body.item.legs.length, 3, destinationToDestination.text);
    assert.equal(destinationToDestination.body.item.legs[0]?.scope, "destination", destinationToDestination.text);
    assert.equal(destinationToDestination.body.item.legs[1]?.scope, "world", destinationToDestination.text);
    assert.equal(destinationToDestination.body.item.legs[2]?.scope, "destination", destinationToDestination.text);
    assert.equal(destinationToDestination.body.item.portalSelection.entryPortalId, "portal-dest-002-main");
    assert.equal(destinationToDestination.body.item.portalSelection.exitPortalId, "portal-dest-004-main");

    const localNodeToLocalNode = await requestJson<{
      item: {
        reachable: boolean;
        legs: Array<Record<string, unknown>>;
      };
    }>("/api/world/routes/plan", {
      method: "POST",
      body: {
        scope: "cross-map",
        fromDestinationId: "dest-002",
        toDestinationId: "dest-004",
        fromLocalNodeId: "dest-002-archive",
        toLocalNodeId: "dest-004-archive",
        strategy: "distance",
        mode: "walk",
      },
    });

    assert.equal(localNodeToLocalNode.status, 200, localNodeToLocalNode.text);
    assert.equal(localNodeToLocalNode.body.item.reachable, true, localNodeToLocalNode.text);
    assert.equal(
      (localNodeToLocalNode.body.item.legs[0]?.localNodeIds as string[])[0],
      "dest-002-archive",
      localNodeToLocalNode.text,
    );
    assert.equal(
      (localNodeToLocalNode.body.item.legs[2]?.localNodeIds as string[])[
        (localNodeToLocalNode.body.item.legs[2]?.localNodeIds as string[]).length - 1
      ],
      "dest-004-archive",
      localNodeToLocalNode.text,
    );

    const worldOnly = await requestJson<{
      item: {
        reachable: boolean;
        scope: string;
        legs: Array<Record<string, unknown>>;
      };
    }>("/api/world/routes/plan", {
      method: "POST",
      body: {
        scope: "world-only",
        fromWorldNodeId: "world-node-dest-002-main",
        toWorldNodeId: "world-node-dest-004-main",
        strategy: "distance",
        mode: "walk",
      },
    });

    assert.equal(worldOnly.status, 200, worldOnly.text);
    assert.equal(worldOnly.body.item.reachable, true, worldOnly.text);
    assert.equal(worldOnly.body.item.scope, "world-only", worldOnly.text);
    assert.equal(worldOnly.body.item.legs.length, 1, worldOnly.text);
    assert.equal(worldOnly.body.item.legs[0]?.scope, "world", worldOnly.text);
  });
});

test("server ranks portal priority ahead of cheaper transfer cost for cross-map route planning", async () => {
  await withServer(
    "world-routes-priority-before-transfer",
    async ({ requestJson }) => {
      const response = await requestJson<{
        item: {
          reachable: boolean;
          summary: { transferCost: number };
          portalSelection: {
            entryPortalId: string;
            exitPortalId: string;
            tieBreakOrder: string[];
          };
        };
      }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "walk",
        },
      });

      assert.equal(response.status, 200, response.text);
      assert.equal(response.body.item.reachable, true, response.text);
      assert.equal(response.body.item.portalSelection.entryPortalId, "portal-dest-002-priority-high-expensive");
      assert.equal(response.body.item.portalSelection.exitPortalId, "portal-dest-004-priority-high-expensive");
      assert.equal(response.body.item.summary.transferCost, 240, response.text);
      assert.deepEqual(response.body.item.portalSelection.tieBreakOrder, WORLD_ROUTE_PORTAL_SELECTION_TIE_BREAK_ORDER);
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        const originMain = world.portals.find((portal) => portal.id === "portal-dest-002-main");
        const targetMain = world.portals.find((portal) => portal.id === "portal-dest-004-main");
        if (!originMain || !targetMain) {
          throw new Error(JSON.stringify({ originMain, targetMain }));
        }

        world.portals = world.portals.filter(
          (portal) => portal.id !== originMain.id && portal.id !== targetMain.id,
        );
        world.portals.push(
          {
            ...originMain,
            id: "portal-dest-002-priority-high-expensive",
            label: "North Institute High Priority Connector",
            priority: 500,
            transferDistance: 40,
            transferCost: 120,
          },
          {
            ...originMain,
            id: "portal-dest-002-priority-low-cheap",
            label: "North Institute Low Priority Connector",
            priority: 10,
            transferDistance: 1,
            transferCost: 1,
          },
          {
            ...targetMain,
            id: "portal-dest-004-priority-high-expensive",
            label: "Summit Learning Hub High Priority Connector",
            priority: 500,
            transferDistance: 40,
            transferCost: 120,
          },
          {
            ...targetMain,
            id: "portal-dest-004-priority-low-cheap",
            label: "Summit Learning Hub Low Priority Connector",
            priority: 10,
            transferDistance: 1,
            transferCost: 1,
          },
        );
        applyWorld(services, world);
      },
    },
  );
});

test("server returns empty cross-map prefix legs when origin portal direction blocks outbound transfer", async () => {
  await withServer(
    "world-routes-empty-prefix-legs",
    async ({ requestJson }) => {
      const response = await requestJson<{
        item: {
          reachable: boolean;
          legs: Array<Record<string, unknown>>;
          failure: { stage: string; code: string };
        };
      }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "walk",
        },
      });

      assert.equal(response.status, 200, response.text);
      assert.equal(response.body.item.reachable, false, response.text);
      assert.equal(response.body.item.failure.stage, "origin-portal", response.text);
      assert.equal(response.body.item.failure.code, "origin_portal_unavailable", response.text);
      assert.equal(response.body.item.legs.length, 0, response.text);
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        const originMain = world.portals.find((portal) => portal.id === "portal-dest-002-main");
        if (!originMain) {
          throw new Error(JSON.stringify({ originMain }));
        }
        originMain.direction = "inbound";
        applyWorld(services, world);
      },
    },
  );
});

test("server returns destination and world cross-map prefix legs when destination local traversal is unreachable", async () => {
  await withServer(
    "world-routes-destination-prefix-legs",
    async ({ requestJson }) => {
      const response = await requestJson<{
        item: {
          reachable: boolean;
          legs: Array<Record<string, unknown>>;
          failure: { stage: string; code: string };
        };
      }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          toLocalNodeId: "dest-004-archive",
          strategy: "distance",
          mode: "walk",
        },
      });

      assert.equal(response.status, 200, response.text);
      assert.equal(response.body.item.reachable, false, response.text);
      assert.equal(response.body.item.failure.stage, "destination-local", response.text);
      assert.equal(response.body.item.failure.code, "destination_local_unreachable", response.text);
      assert.equal(response.body.item.legs.length, 2, response.text);
      assert.equal(response.body.item.legs[0]?.scope, "destination", response.text);
      assert.equal(response.body.item.legs[1]?.scope, "world", response.text);
    },
    {
      prepareServices: (services) => {
        const targetDestination = services.runtime.seedData.destinations.find(
          (destination) => destination.id === "dest-004",
        );
        if (!targetDestination) {
          throw new Error(JSON.stringify({ targetDestination }));
        }
        const mutatedDestination = {
          ...targetDestination,
          graph: {
            ...targetDestination.graph,
            edges: targetDestination.graph.edges.filter(
              (edge) => edge.from !== "dest-004-archive" && edge.to !== "dest-004-archive",
            ),
          },
        };
        services.runtime.seedData = {
          ...services.runtime.seedData,
          destinations: services.runtime.seedData.destinations.map((destination) =>
            destination.id === mutatedDestination.id ? mutatedDestination : destination,
          ),
        };
        const destinationById = new Map(services.runtime.lookups.destinationById);
        destinationById.set(mutatedDestination.id, mutatedDestination);
        services.runtime.lookups = {
          ...services.runtime.lookups,
          destinationById,
        };
      },
    },
  );
});

test("server returns reachable=false with world failure and prefix legs when world graph is disconnected", async () => {
  await withServer(
    "world-routes-world-failure",
    async ({ requestJson }) => {
      const response = await requestJson<{
        item: {
          reachable: boolean;
          legs: Array<Record<string, unknown>>;
          failure: { stage: string; code: string };
        };
      }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "walk",
        },
      });

      assert.equal(response.status, 200, response.text);
      assert.equal(response.body.item.reachable, false, response.text);
      assert.equal(response.body.item.failure.stage, "world", response.text);
      assert.equal(response.body.item.failure.code, "world_segment_unreachable", response.text);
      assert.equal(response.body.item.legs.length, 1, response.text);
      assert.equal(response.body.item.legs[0]?.scope, "destination", response.text);
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        world.graph.edges = world.graph.edges.filter(
          (edge) => edge.id !== "world-edge-west-to-crossing" && edge.id !== "world-edge-west-to-central",
        );
        applyWorld(services, world);
      },
    },
  );
});

test("server returns world_unavailable for world route planning and keeps bootstrap free of world payload", async () => {
  await withServer(
    "world-routes-unavailable",
    async ({ requestJson }) => {
      const route = await requestJson<{ error: string; code: string }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "walk",
        },
      });
      const bootstrap = await requestJson<Record<string, unknown>>("/api/bootstrap");

      assert.equal(route.status, 409, route.text);
      assert.deepEqual(route.body, {
        error: "World mode is unavailable.",
        code: "world_unavailable",
      });
      assert.equal(bootstrap.status, 200, bootstrap.text);
      assert.equal("world" in bootstrap.body, false, bootstrap.text);
    },
    {
      prepareServices: disableWorld,
    },
  );
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
        title: "North Institute social memo",
        body: "Started in the lobby, cut through the archive, and ended with tea by the indoor studio.",
        tags: ["indoor", "memo"],
      },
      method: "POST",
    });
    const createdId = created.body.item.id;
    const commentImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const commentImageMultipart = createMultipartBody({
      content: commentImageBytes,
      fileName: "comment.png",
      mimeType: "image/png",
    });
    const commentImageUpload = await requestJson<{
      item: {
        mimeType: string;
        originalName: string;
        size: number;
        url: string;
      };
    }>("/api/uploads/images", {
      body: commentImageMultipart.body,
      headers: { "content-type": commentImageMultipart.contentType },
      method: "POST",
    });
    const commentMedia = [
      {
        type: "image",
        title: "Archive route snapshot",
        source: commentImageUpload.body.item.url,
        note: "A compact route preview.",
      },
    ];

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
          media: commentMedia,
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
    const malformedFeedLimit = await requestJson<{ error: string }>("/api/feed?limit=abc&viewerUserId=user-4");
    const overMaxFeedLimit = await requestJson<{ error: string }>("/api/feed?limit=999&viewerUserId=user-4");
    const detail = await requestJson<{ item: Record<string, unknown> }>(
      `/api/journals/${createdId}?viewerUserId=user-4`,
    );
    const malformedCommentLimit = await requestJson<{ error: string }>(
      `/api/journals/${createdId}/comments?limit=abc`,
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
    const builtIndexHtml = await readRuntimePublicTextAsset("index.html");
    const builtRouteMarkersAsset = await readRuntimePublicTextAsset("route-visualization-markers.js");
    const builtJournalPresentationAsset = await readRuntimePublicTextAsset("journal-presentation.js");
    const builtJournalConsumersAsset = await readRuntimePublicTextAsset("journal-consumers.js");
    const builtAppAsset = await readRuntimePublicTextAsset("app.js");
    const builtSpaAsset = await readRuntimePublicTextAsset("spa/app-shell.js");
    const builtCssAsset = await readRuntimePublicTextAsset("styles.css");
    const builtLeafletCssAsset = await readRuntimePublicTextAsset("vendor/leaflet/leaflet.css");
    const builtLeafletJsAsset = await readRuntimePublicTextAsset("vendor/leaflet/leaflet.js");
    const spaRoute = await requestText("/feed");
    const spaScripts = parsePublicPageScriptContract(spaRoute.text);
    const builtSpaScripts = parsePublicPageScriptContract(builtIndexHtml);
    const routeMarkersAsset = await requestText("/route-visualization-markers.js");
    const journalPresentationAsset = await requestText("/journal-presentation.js");
    const journalConsumersAsset = await requestText("/journal-consumers.js");
    const appAsset = await requestText("/app.js");
    const spaAsset = await requestText("/spa/app-shell.js");
    const cssAsset = await requestText("/styles.css");
    const leafletCssAsset = await requestText("/vendor/leaflet/leaflet.css");
    const leafletJsAsset = await requestText("/vendor/leaflet/leaflet.js");

    assert.equal(health.status, 200);
    assert.equal(health.text.includes("\n"), false, health.text);
    assert.equal(health.headers["cache-control"], "no-store");

    assert.equal(created.status, 201, created.text);
    assert.equal(created.body.item.id, "journal-13");
    assert.equal(created.body.item.title, "North Institute social memo");
    assert.equal(commentImageUpload.status, 201, commentImageUpload.text);
    assert.equal(commentImageUpload.body.item.mimeType, "image/png", commentImageUpload.text);
    assert.equal(commentImageUpload.body.item.originalName, "comment.png", commentImageUpload.text);
    assert.equal(commentImageUpload.body.item.size, commentImageBytes.length, commentImageUpload.text);

    assert.equal(liked.status, 200, liked.text);
    assert.equal(liked.body.item.likeCount, 1, liked.text);
    assert.equal(liked.body.item.viewerHasLiked, true, liked.text);
    assert.equal(duplicateLike.status, 400, duplicateLike.text);
    expectMatches(duplicateLike.body.error, /already liked/i);

    assert.equal(firstComment.status, 201, firstComment.text);
    assert.equal(secondComment.status, 201, secondComment.text);
    assert.equal(commentPage.body.totalCount, 2, commentPage.text);
    assert.equal(commentPage.body.items[0]?.id, secondComment.body.item.id, commentPage.text);
    assert.deepEqual(commentPage.body.items[0]?.media, [], commentPage.text);
    assert.equal(commentPage.body.nextCursor !== null, true, commentPage.text);
    assert.equal(nextCommentPage.body.items[0]?.id, firstComment.body.item.id, nextCommentPage.text);
    assert.deepEqual(nextCommentPage.body.items[0]?.media, commentMedia, nextCommentPage.text);
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
    assert.equal(malformedFeedLimit.status, 400, malformedFeedLimit.text);
    expectMatches(malformedFeedLimit.body.error, /Limit must be a positive number\./);
    assert.equal(overMaxFeedLimit.status, 400, overMaxFeedLimit.text);
    expectMatches(overMaxFeedLimit.body.error, /Limit must be at most 40\./);

    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.body.item.likeCount, 1, detail.text);
    assert.equal(detail.body.item.commentCount, 1, detail.text);
    assert.equal(typeof detail.body.item.body, "string", detail.text);
    assert.equal(detail.body.item.destinationLabel, "North Institute");
    assert.equal(malformedCommentLimit.status, 400, malformedCommentLimit.text);
    expectMatches(malformedCommentLimit.body.error, /Limit must be a positive number\./);
    assert.equal(overMaxCommentLimit.status, 400, overMaxCommentLimit.text);
    expectMatches(overMaxCommentLimit.body.error, /Limit must be at most 50\./);

    assert.equal(unliked.status, 200, unliked.text);
    assert.equal(unliked.body.item.likeCount, 0, unliked.text);
    assert.equal(unliked.body.item.viewerHasLiked, false, unliked.text);

    assert.equal(Array.isArray(bootstrap.body.users), true, bootstrap.text);
    assert.equal("interests" in (bootstrap.body.users[0] ?? {}), false, bootstrap.text);
    assert.equal("graph" in (bootstrap.body.destinations[0] ?? {}), false, bootstrap.text);
    assert.equal("world" in bootstrap.body, false, bootstrap.text);

    assert.equal(spaRoute.status, 200);
    assert.equal(spaRoute.headers["cache-control"], "no-store");
    expectMatches(spaRoute.text, /<!DOCTYPE html>/i);
    assert.equal(spaRoute.text, builtIndexHtml);
    assert.deepEqual(spaScripts, builtSpaScripts);
    assert.deepEqual(spaScripts, [
      { src: "/route-visualization-markers.js", type: "classic" },
      { src: "/journal-presentation.js", type: "classic" },
      { src: "/journal-consumers.js", type: "classic" },
      { src: "/app.js", type: "module" },
    ]);
    assert.equal(routeMarkersAsset.status, 200);
    assert.equal(routeMarkersAsset.headers["cache-control"], "no-store");
    expectMatches(routeMarkersAsset.headers["content-type"] ?? "", /javascript/i);
    assert.equal(routeMarkersAsset.text, builtRouteMarkersAsset);
    assert.equal(journalPresentationAsset.status, 200);
    assert.equal(journalPresentationAsset.headers["cache-control"], "no-store");
    expectMatches(journalPresentationAsset.headers["content-type"] ?? "", /javascript/i);
    assert.equal(journalPresentationAsset.text, builtJournalPresentationAsset);
    assert.equal(journalConsumersAsset.status, 200);
    assert.equal(journalConsumersAsset.headers["cache-control"], "no-store");
    expectMatches(journalConsumersAsset.headers["content-type"] ?? "", /javascript/i);
    assert.equal(journalConsumersAsset.text, builtJournalConsumersAsset);
    assert.equal(appAsset.status, 200);
    assert.equal(appAsset.headers["cache-control"], "no-store");
    expectMatches(appAsset.headers["content-type"] ?? "", /javascript/i);
    assert.equal(appAsset.text, builtAppAsset);
    assert.equal(spaAsset.status, 200);
    assert.equal(spaAsset.headers["cache-control"], "no-store");
    expectMatches(spaAsset.headers["content-type"] ?? "", /javascript/i);
    assert.equal(spaAsset.text, builtSpaAsset);
    assert.equal(cssAsset.status, 200);
    assert.equal(cssAsset.headers["cache-control"], "no-store");
    expectMatches(cssAsset.headers["content-type"] ?? "", /css/i);
    assert.equal(cssAsset.text, builtCssAsset);
    assert.equal(leafletCssAsset.status, 200);
    assert.equal(leafletCssAsset.headers["cache-control"], "no-store");
    expectMatches(leafletCssAsset.headers["content-type"] ?? "", /css/i);
    assert.equal(leafletCssAsset.text, builtLeafletCssAsset);
    assert.equal(leafletJsAsset.status, 200);
    assert.equal(leafletJsAsset.headers["cache-control"], "no-store");
    expectMatches(leafletJsAsset.headers["content-type"] ?? "", /javascript/i);
    assert.equal(leafletJsAsset.text, builtLeafletJsAsset);
  });
});

test("server keeps feed cursors valid across journal edits, ratings, and social activity", async () => {
  await withServer("social-route-regressions", async ({ requestJson }) => {
    const created = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "North Institute route suffix regression",
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
        title: "North Institute route suffix regression revised",
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
    assert.equal(patched.body.item.title, "North Institute route suffix regression revised", patched.text);
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

test("server keeps feed and comment cursors valid when the anchor item is deleted", async () => {
  await withServer("social-deleted-anchor-cursors", async ({ requestJson }) => {
    const first = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "Deleted anchor first",
        body: "Newest tie case entry.",
        tags: ["tie"],
      },
      method: "POST",
    });
    const second = await requestJson<{ item: { id: string } }>("/api/journals", {
      body: {
        userId: "user-2",
        destinationId: "dest-002",
        title: "Deleted anchor second",
        body: "Second tie case entry.",
        tags: ["tie"],
      },
      method: "POST",
    });

    const feedPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(`/api/feed?limit=1&viewerUserId=user-4`);

    assert.equal(feedPage.body.items[0]?.id, second.body.item.id, feedPage.text);
    assert.equal(feedPage.body.nextCursor !== null, true, feedPage.text);

    const deletedFeedAnchor = await requestJson<{ deleted: boolean }>(`/api/journals/${second.body.item.id}`, {
      method: "DELETE",
    });
    const nextFeedPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(`/api/feed?limit=1&viewerUserId=user-4&cursor=${encodeURIComponent(feedPage.body.nextCursor ?? "")}`);

    assert.equal(deletedFeedAnchor.body.deleted, true, deletedFeedAnchor.text);
    assert.equal(nextFeedPage.status, 200, nextFeedPage.text);
    assert.equal(nextFeedPage.body.items[0]?.id, first.body.item.id, nextFeedPage.text);

    const firstComment = await requestJson<{ item: { id: string } }>(`/api/journals/${first.body.item.id}/comments`, {
      body: {
        userId: "user-2",
        body: "First comment anchor.",
      },
      method: "POST",
    });
    const secondComment = await requestJson<{ item: { id: string } }>(`/api/journals/${first.body.item.id}/comments`, {
      body: {
        userId: "user-2",
        body: "Second comment anchor.",
      },
      method: "POST",
    });
    const commentPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(`/api/journals/${first.body.item.id}/comments?limit=1`);

    assert.equal(commentPage.body.items[0]?.id, secondComment.body.item.id, commentPage.text);
    assert.equal(commentPage.body.nextCursor !== null, true, commentPage.text);

    const deletedCommentAnchor = await requestJson<{ deleted: boolean }>(
      `/api/comments/${secondComment.body.item.id}?userId=user-2`,
      {
        method: "DELETE",
      },
    );
    const nextCommentPage = await requestJson<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
      totalCount: number;
    }>(
      `/api/journals/${first.body.item.id}/comments?limit=1&cursor=${encodeURIComponent(commentPage.body.nextCursor ?? "")}`,
    );

    assert.equal(firstComment.status, 201, firstComment.text);
    assert.equal(deletedCommentAnchor.body.deleted, true, deletedCommentAnchor.text);
    assert.equal(nextCommentPage.status, 200, nextCommentPage.text);
    assert.equal(nextCommentPage.body.items[0]?.id, firstComment.body.item.id, nextCommentPage.text);
  });
});

test("GET / returns built index.html with text/html and no-store", async () => {
  await withServer("built-index-root", async ({ requestText }) => {
    const builtIndexHtml = await readRuntimePublicTextAsset("index.html");
    const response = await requestText("/");

    assert.equal(response.status, 200, response.text);
    assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.text, builtIndexHtml);
  });
});

test("changing cwd outside repo still serves built assets via the compiled handler", async () => {
  const repoRoot = process.cwd();
  const proofScriptPath = path.join(repoRoot, "dist", "tests", "support", "built-server-cwd-proof.js");
  const processWithExecPath = process as typeof process & { execPath: string };
  const { spawn } = require("child_process") as any;

  await new Promise<void>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const child = spawn(processWithExecPath.execPath, [proofScriptPath], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
        return;
      }

      const stdoutText = Buffer.concat(stdoutChunks).toString("utf8").trim();
      const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();
      reject(
        new Error(
          `Built server proof script failed with code ${code}\nstdout:\n${stdoutText}\nstderr:\n${stderrText}`,
        ),
      );
    });
  });
});
