import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createServerHandler } from "../src/server/index";
import { createAppServices, type AppServices } from "../src/services/index";
import { deriveWorldRuntimeState } from "../src/services/runtime";

type JsonResponse<T> = {
  body: T;
  status: number;
  text: string;
};

type RequestOptions = {
  body?: unknown;
  method?: string;
};

type ServerOptions = {
  prepareServices?: (services: AppServices) => Promise<void> | void;
};

type RuntimeFs = {
  mkdir(targetPath: string, options?: { recursive?: boolean }): Promise<void>;
  rm(targetPath: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
};

function createMockResponse(): {
  body: Buffer[];
  statusCode: number;
  end(chunk?: Buffer | string): void;
  writeHead(statusCode: number): void;
} {
  return {
    body: [],
    statusCode: 200,
    end(chunk?: Buffer | string) {
      if (chunk !== undefined) {
        this.body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    },
    writeHead(statusCode: number) {
      this.statusCode = statusCode;
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
      : options.body === undefined
        ? ""
        : JSON.stringify(options.body);
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
  run: (requestJson: <TResponse>(requestPath: string, options?: RequestOptions) => Promise<JsonResponse<TResponse>>) => Promise<T>,
  options: ServerOptions = {},
): Promise<T> {
  const runtimeFs = fs as unknown as RuntimeFs;
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-world-route-errors-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await runtimeFs.mkdir(runtimeDir, { recursive: true });
  const services = await createAppServices({ runtimeDir });
  await services.journalStore.reset();
  await options.prepareServices?.(services);
  const handler = createServerHandler(services);

  async function requestJson<TResponse>(
    requestPath: string,
    options: RequestOptions = {},
  ): Promise<JsonResponse<TResponse>> {
    const request = createMockRequest(requestPath, options);
    const response = createMockResponse();
    await handler(request as never, response as never);
    const text = Buffer.concat(response.body).toString("utf8");
    return {
      body: text ? JSON.parse(text) as TResponse : (null as TResponse),
      status: response.statusCode,
      text,
    };
  }

  try {
    return await run(requestJson);
  } finally {
    await runtimeFs.rm(runtimeDir, { force: true, recursive: true });
  }
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

function replaceWorldWithAlternativeModeRoutes(world: NonNullable<AppServices["runtime"]["seedData"]["world"]>): void {
  world.portals = world.portals.filter(
    (portal) => portal.id === "portal-dest-002-main" || portal.id === "portal-dest-004-main",
  );
  world.graph.nodes = world.graph.nodes.filter(
    (node) => node.id === "world-node-dest-002-main" || node.id === "world-node-dest-004-main",
  );
  world.graph.nodes.push({
    id: "world-node-mode-detour",
    kind: "junction",
    label: "Mode Detour Junction",
    tags: ["mode", "test-only"],
    x: 300,
    y: 280,
  });
  world.graph.edges = [
    {
      id: "world-edge-mode-shuttle-direct",
      from: "world-node-dest-002-main",
      to: "world-node-dest-004-main",
      distance: 10,
      roadType: "road",
      allowedModes: ["shuttle"],
      congestion: 0,
      bidirectional: true,
    },
    {
      id: "world-edge-mode-bike-a",
      from: "world-node-dest-002-main",
      to: "world-node-mode-detour",
      distance: 100,
      roadType: "road",
      allowedModes: ["bike"],
      congestion: 0,
      bidirectional: true,
    },
    {
      id: "world-edge-mode-bike-b",
      from: "world-node-mode-detour",
      to: "world-node-dest-004-main",
      distance: 100,
      roadType: "road",
      allowedModes: ["bike"],
      congestion: 0,
      bidirectional: true,
    },
  ];
}

test("world route plan returns world_route_destination_not_found with frozen 404 payload", async () => {
  await withServer("destination-not-found", async (requestJson) => {
    const response = await requestJson<{ error: string; code: string; destinationId: string }>("/api/world/routes/plan", {
      method: "POST",
      body: {
        scope: "cross-map",
        fromDestinationId: "dest-404",
        toDestinationId: "dest-004",
        strategy: "distance",
        mode: "walk",
      },
    });

    assert.equal(response.status, 404, response.text);
    assert.deepEqual(response.body, {
      error: "Destination was not found.",
      code: "world_route_destination_not_found",
      destinationId: "dest-404",
    });
  });
});

test("world route plan returns world_route_local_node_not_found with frozen 404 payload", async () => {
  await withServer("local-node-not-found", async (requestJson) => {
    const response = await requestJson<{ error: string; code: string; destinationId: string; localNodeId: string }>("/api/world/routes/plan", {
      method: "POST",
      body: {
        scope: "cross-map",
        fromDestinationId: "dest-002",
        toDestinationId: "dest-004",
        fromLocalNodeId: "dest-002-missing-node",
        strategy: "distance",
        mode: "walk",
      },
    });

    assert.equal(response.status, 404, response.text);
    assert.deepEqual(response.body, {
      error: "Local node was not found in destination.",
      code: "world_route_local_node_not_found",
      destinationId: "dest-002",
      localNodeId: "dest-002-missing-node",
    });
  });
});

test("world route plan returns world_route_mode_not_allowed with frozen 422 payload", async () => {
  await withServer(
    "mode-not-allowed",
    async (requestJson) => {
      const response = await requestJson<{ error: string; code: string; mode: string; allowedModes: string[] }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "shuttle",
        },
      });

      assert.equal(response.status, 422, response.text);
      assert.deepEqual(response.body, {
        error: "Route mode is not allowed by selected edges or portals.",
        code: "world_route_mode_not_allowed",
        mode: "shuttle",
        allowedModes: ["walk", "mixed"],
      });
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        world.portals = world.portals.map((portal) =>
          portal.destinationId === "dest-002"
            ? { ...portal, allowedModes: ["walk"] }
            : portal,
        );
        applyWorld(services, world);
      },
    },
  );
});

test("world route plan returns world_route_mode_not_allowed when world edges reject the requested mode", async () => {
  await withServer(
    "mode-not-allowed-world-edges",
    async (requestJson) => {
      const response = await requestJson<{ error: string; code: string; mode: string; allowedModes: string[] }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "walk",
        },
      });

      assert.equal(response.status, 422, response.text);
      assert.deepEqual(response.body, {
        error: "Route mode is not allowed by selected edges or portals.",
        code: "world_route_mode_not_allowed",
        mode: "walk",
        allowedModes: ["shuttle", "mixed"],
      });
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        const originMain = world.portals.find((portal) => portal.id === "portal-dest-002-main");
        if (!originMain) {
          throw new Error("Expected the seeded world to include portal-dest-002-main.");
        }

        world.graph.edges = world.graph.edges.map((edge) =>
          edge.id === "world-edge-west-to-crossing" || edge.id === "world-edge-west-to-central"
            ? { ...edge, allowedModes: ["shuttle", "mixed"] }
            : edge,
        );
        world.graph.nodes.push({
          id: "world-node-dest-002-detached",
          kind: "portal",
          label: "River Polytechnic Detached Gate",
          tags: [],
          destinationId: "dest-002",
          x: 0,
          y: 0,
        });
        world.portals.push({
          ...originMain,
          id: "portal-dest-002-detached",
          label: "River Polytechnic Detached Connector",
          worldNodeId: "world-node-dest-002-detached",
          priority: 10,
        });
        applyWorld(services, world);
      },
    },
  );
});

test("world route plan restricts world_route_mode_not_allowed to portal-compatible retry modes", async () => {
  await withServer(
    "mode-not-allowed-portal-compatible",
    async (requestJson) => {
      const response = await requestJson<{ error: string; code: string; mode: string; allowedModes: string[] }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "walk",
        },
      });

      assert.equal(response.status, 422, response.text);
      assert.deepEqual(response.body, {
        error: "Route mode is not allowed by selected edges or portals.",
        code: "world_route_mode_not_allowed",
        mode: "walk",
        allowedModes: ["mixed"],
      });
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        replaceWorldWithAlternativeModeRoutes(world);
        world.portals = world.portals.map((portal) =>
          portal.id === "portal-dest-002-main" || portal.id === "portal-dest-004-main"
            ? { ...portal, allowedModes: ["walk"] }
            : portal,
        );
        applyWorld(services, world);
      },
    },
  );
});

test("world route plan restricts early world_route_mode_not_allowed retry modes to viable cross-map options", async () => {
  await withServer(
    "mode-not-allowed-early",
    async (requestJson) => {
      const response = await requestJson<{ error: string; code: string; mode: string; allowedModes: string[] }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "shuttle",
        },
      });

      assert.equal(response.status, 422, response.text);
      assert.deepEqual(response.body, {
        error: "Route mode is not allowed by selected edges or portals.",
        code: "world_route_mode_not_allowed",
        mode: "shuttle",
        allowedModes: ["walk", "mixed"],
      });
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        replaceWorldWithAlternativeModeRoutes(world);
        world.graph.edges = [
          {
            id: "world-edge-mode-walk-direct",
            from: "world-node-dest-002-main",
            to: "world-node-dest-004-main",
            distance: 120,
            roadType: "road",
            allowedModes: ["walk"],
            congestion: 0,
            bidirectional: true,
          },
        ];
        world.portals = world.portals.map((portal) =>
          portal.id === "portal-dest-002-main" || portal.id === "portal-dest-004-main"
            ? { ...portal, allowedModes: ["walk", "bike"] }
            : portal,
        );
        applyWorld(services, world);
      },
    },
  );
});

test("world route plan returns world_route_portal_misconfigured with frozen 409 payload", async () => {
  await withServer(
    "portal-misconfigured",
    async (requestJson) => {
      const response = await requestJson<{ error: string; code: string; portalId: string }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "walk",
        },
      });

      assert.equal(response.status, 409, response.text);
      assert.deepEqual(response.body, {
        error: "Portal binding is misconfigured.",
        code: "world_route_portal_misconfigured",
        portalId: "portal-dest-002-main",
      });
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        world.portals = world.portals.map((portal) =>
          portal.id === "portal-dest-002-main"
            ? { ...portal, localNodeId: "dest-002-missing-node" }
            : portal,
        );
        applyWorld(services, world);
      },
    },
  );
});

test("world route plan returns world_route_portal_misconfigured for a higher-priority invalid portal", async () => {
  await withServer(
    "portal-misconfigured-high-priority",
    async (requestJson) => {
      const response = await requestJson<{ error: string; code: string; portalId: string }>("/api/world/routes/plan", {
        method: "POST",
        body: {
          scope: "cross-map",
          fromDestinationId: "dest-002",
          toDestinationId: "dest-004",
          strategy: "distance",
          mode: "walk",
        },
      });

      assert.equal(response.status, 409, response.text);
      assert.deepEqual(response.body, {
        error: "Portal binding is misconfigured.",
        code: "world_route_portal_misconfigured",
        portalId: "portal-dest-002-high-bad",
      });
    },
    {
      prepareServices: (services) => {
        const world = cloneWorld(services);
        const originMain = world.portals.find((portal) => portal.id === "portal-dest-002-main");
        if (!originMain) {
          throw new Error("Expected the seeded world to include portal-dest-002-main.");
        }

        world.portals = world.portals.filter((portal) => portal.destinationId !== "dest-002");
        world.portals.push(
          {
            ...originMain,
            id: "portal-dest-002-high-bad",
            label: "River Polytechnic Broken High Priority Connector",
            localNodeId: "dest-002-missing-node",
            priority: 500,
          },
          {
            ...originMain,
            id: "portal-dest-002-low-good",
            label: "River Polytechnic Low Priority Connector",
            priority: 1,
          },
        );
        applyWorld(services, world);
      },
    },
  );
});
