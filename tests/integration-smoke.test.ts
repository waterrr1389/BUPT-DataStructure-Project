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
  headers: Record<string, string>;
  status: number;
  text: string;
};

type RequestOptions = {
  body?: string | Record<string, unknown>;
  method?: string;
};

type ServerOptions = {
  prepareServices?: (services: AppServices) => Promise<void> | void;
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
  options: ServerOptions = {},
): Promise<T> {
  const runtimeFs = fs as unknown as RuntimeFs;
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-integration-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await runtimeFs.mkdir(runtimeDir, { recursive: true });
  const services = await createAppServices({ runtimeDir });
  await services.journalStore.reset();
  await options.prepareServices?.(services);
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
            label: "River Polytechnic High Priority Connector",
            priority: 500,
            transferDistance: 40,
            transferCost: 120,
          },
          {
            ...originMain,
            id: "portal-dest-002-priority-low-cheap",
            label: "River Polytechnic Low Priority Connector",
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
    assert.equal(malformedFeedLimit.status, 400, malformedFeedLimit.text);
    expectMatches(malformedFeedLimit.body.error, /Limit must be a positive number\./);
    assert.equal(overMaxFeedLimit.status, 400, overMaxFeedLimit.text);
    expectMatches(overMaxFeedLimit.body.error, /Limit must be at most 40\./);

    assert.equal(detail.status, 200, detail.text);
    assert.equal(detail.body.item.likeCount, 1, detail.text);
    assert.equal(detail.body.item.commentCount, 1, detail.text);
    assert.equal(typeof detail.body.item.body, "string", detail.text);
    assert.equal(detail.body.item.destinationLabel, "River Polytechnic");
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
  const originalCwd = process.cwd();
  const repoRoot = path.resolve(originalCwd);
  const runtimeFs = fs as unknown as RuntimeFs;
  const outsideCwd = path.join(
    "/tmp",
    `ds-ts-built-server-cwd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await runtimeFs.mkdir(outsideCwd, { recursive: true });
  const processWithChdir = process as typeof process & { chdir(directory: string): void };
  let runtimeDir: string | null = null;

  try {
    processWithChdir.chdir(outsideCwd);

    const builtServerModulePath = path.join(repoRoot, "dist", "src", "server", "index.js");
    const builtServicesModulePath = path.join(repoRoot, "dist", "src", "services", "index.js");
    const builtServerModule = require(builtServerModulePath) as {
      createServerHandler: typeof createServerHandler;
    };
    const builtServicesModule = require(builtServicesModulePath) as {
      createAppServices: typeof createAppServices;
    };
    const builtHandler = builtServerModule.createServerHandler;
    const builtCreateAppServices = builtServicesModule.createAppServices;

    runtimeDir = path.join(
      "/tmp",
      `ds-ts-built-runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    );
    await runtimeFs.mkdir(runtimeDir, { recursive: true });
    const services = await builtCreateAppServices({ runtimeDir });
    await services.journalStore.reset();
    const handler = builtHandler(services);

    async function requestTextBuilt(requestPath: string, options: RequestOptions = {}): Promise<TextResponse> {
      const request = createMockRequest(requestPath, options);
      const response = createMockResponse();
      await handler(request as never, response as never);
      return {
        headers: response.headers,
        status: response.statusCode,
        text: Buffer.concat(response.body).toString("utf8"),
      };
    }

    const builtIndexHtml = await fs.readFile(path.join(repoRoot, "dist", "public", "index.html"), "utf8");
    const builtAppJs = await fs.readFile(path.join(repoRoot, "dist", "public", "app.js"), "utf8");

    const rootResponse = await requestTextBuilt("/");
    assert.equal(rootResponse.status, 200, rootResponse.text);
    assert.equal(rootResponse.headers["content-type"], "text/html; charset=utf-8");
    assert.equal(rootResponse.headers["cache-control"], "no-store");
    assert.equal(rootResponse.text, builtIndexHtml);

    const appResponse = await requestTextBuilt("/app.js");
    assert.equal(appResponse.status, 200, appResponse.text);
    assert.equal(appResponse.headers["cache-control"], "no-store");
    expectMatches(appResponse.headers["content-type"] ?? "", /javascript/i);
    assert.equal(appResponse.text, builtAppJs);
  } finally {
    processWithChdir.chdir(originalCwd);
    if (runtimeDir) {
      await runtimeFs.rm(runtimeDir, { force: true, recursive: true });
    }
    await runtimeFs.rm(outsideCwd, { force: true, recursive: true });
  }
});
