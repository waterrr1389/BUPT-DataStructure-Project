import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getRuntimePublicAssetPath } from "./support/runtime-public";

type Point = {
  x: number;
  y: number;
};

type RouteNode = Point & {
  id: string;
};

type MarkerInput = {
  label: string;
  node: RouteNode;
  shortLabel: string;
};

type RouteAnalysis = {
  routeNodes: RouteNode[];
  transitionMarkers: MarkerInput[];
  turnMarkers: MarkerInput[];
  stepDetails?: {
    edge?: { roadType?: string };
    fromNode: RouteNode;
    toNode: RouteNode;
  }[];
};

type Projection = {
  point(node: RouteNode): Point;
};

type MarkerOutput = {
  kind: "end" | "preview-end" | "preview-start" | "start" | "transition" | "turn";
  label: string;
  legendBadgeLabel: string;
  legendLabel: string;
  logicalPoint: Point;
  nodeId: string;
  point: Point;
  semanticKey: string;
  sharedLogicalNode?: boolean;
  state: "active-route" | "preview";
  variantClass: string;
};

type MarkerLayout = {
  endpointMarkers: MarkerOutput[];
  transitionMarkers: MarkerOutput[];
  turnMarkers: MarkerOutput[];
};

type LegendItem = {
  iconMarkup: string;
  label: string;
  semanticKey: string;
  state: string;
  type: string;
};

type MapRenderingModule = {
  buildRouteLegendItems(
    routeAnalysis: RouteAnalysis,
    markerLayout: MarkerLayout,
    previewMarkers: MarkerOutput[],
  ): LegendItem[];
};

type MarkerHelpersModule = {
  createEndpointMarkers(routeNodes: RouteNode[], projection: Projection): MarkerOutput[];
  createPreviewMarkers(
    previewSelection: { endNode?: RouteNode; startNode?: RouteNode },
    projection: Projection,
  ): MarkerOutput[];
  createRouteMarkerLayout(routeAnalysis: RouteAnalysis, projection: Projection): MarkerLayout;
};

type RequireWithCache = NodeRequire & {
  cache: Record<string, unknown>;
  resolve(id: string): string;
};

const routeVisualizationMarkersPath = getRuntimePublicAssetPath("route-visualization-markers.js");
const runtimeRequire = require as RequireWithCache;
const runtimeImport = new Function("specifier", "return import(specifier);") as (
  specifier: string,
) => Promise<unknown>;

const { createPreviewMarkers, createRouteMarkerLayout } = runtimeRequire(
  routeVisualizationMarkersPath,
) as MarkerHelpersModule;

function loadFreshRouteVisualizationMarkersModule(): MarkerHelpersModule {
  const runtimeGlobals = globalThis as typeof globalThis & {
    RouteVisualizationMarkers?: MarkerHelpersModule;
  };
  delete runtimeRequire.cache[runtimeRequire.resolve(routeVisualizationMarkersPath)];
  Reflect.deleteProperty(runtimeGlobals, "RouteVisualizationMarkers");
  const api = runtimeRequire(routeVisualizationMarkersPath) as MarkerHelpersModule;
  assert.equal(runtimeGlobals.RouteVisualizationMarkers, api);
  return api;
}

function createProjection(): Projection {
  return {
    point(node) {
      return {
        x: node.x,
        y: node.y,
      };
    },
  };
}

function createNode(id: string, x: number, y: number): RouteNode {
  return { id, x, y };
}

async function importMapRenderingModule(): Promise<MapRenderingModule> {
  const tempRoot = path.join(
    "/tmp",
    `ds-ts-route-marker-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const moduleRoot = path.join(tempRoot, "browser");
  const spaRoot = path.join(moduleRoot, "spa");
  await fs.mkdir(spaRoot, { recursive: true });
  await fs.writeFile(path.join(moduleRoot, "package.json"), JSON.stringify({ type: "module" }));
  await Promise.all(
    ["copy.js", "lib.js", "map-rendering.js"].map(async (relativePath) => {
      const source = await fs.readFile(getRuntimePublicAssetPath(path.join("spa", relativePath)), "utf8");
      await fs.writeFile(path.join(spaRoot, relativePath), source, "utf8");
    }),
  );
  return runtimeImport(`file://${path.join(spaRoot, "map-rendering.js")}`) as Promise<MapRenderingModule>;
}

test("route visualization markers keeps the CommonJS export attached to RouteVisualizationMarkers", () => {
  const api = loadFreshRouteVisualizationMarkersModule();

  assert.deepEqual(Object.keys(api).sort(), [
    "createEndpointMarkers",
    "createPreviewMarkers",
    "createRouteMarkerLayout",
  ]);
});

test("closed-loop routes offset start and end markers while preserving the shared node", () => {
  const sharedNode = createNode("loop-hub", 160, 200);
  const routeAnalysis: RouteAnalysis = {
    routeNodes: [sharedNode, createNode("mid-a", 220, 200), createNode("mid-b", 220, 260), sharedNode],
    transitionMarkers: [],
    turnMarkers: [],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());
  const startMarker = markerLayout.endpointMarkers.find((marker) => marker.kind === "start");
  const endMarker = markerLayout.endpointMarkers.find((marker) => marker.kind === "end");

  assert.ok(startMarker);
  assert.ok(endMarker);
  if (!startMarker || !endMarker) {
    throw new Error("Expected both endpoint markers.");
  }
  assert.equal(startMarker.nodeId, "loop-hub");
  assert.equal(endMarker.nodeId, "loop-hub");
  assert.deepEqual(startMarker.logicalPoint, endMarker.logicalPoint);
  assert.ok(
    startMarker.point.x !== endMarker.point.x || startMarker.point.y !== endMarker.point.y,
  );
  assert.equal(startMarker.semanticKey, "start");
  assert.equal(endMarker.semanticKey, "end");
  assert.equal(startMarker.sharedLogicalNode, true);
  assert.equal(endMarker.sharedLogicalNode, true);
  assert.equal(startMarker.state, "active-route");
  assert.equal(endMarker.state, "active-route");
});

test("non-loop routes keep exactly one start and one end marker at their node positions", () => {
  const routeAnalysis: RouteAnalysis = {
    routeNodes: [createNode("start", 80, 120), createNode("middle", 140, 120), createNode("end", 200, 180)],
    transitionMarkers: [],
    turnMarkers: [],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());
  const startMarkers = markerLayout.endpointMarkers.filter((marker) => marker.kind === "start");
  const endMarkers = markerLayout.endpointMarkers.filter((marker) => marker.kind === "end");

  assert.equal(startMarkers.length, 1);
  assert.equal(endMarkers.length, 1);
  assert.deepEqual(startMarkers[0].point, startMarkers[0].logicalPoint);
  assert.deepEqual(endMarkers[0].point, endMarkers[0].logicalPoint);
  assert.equal(startMarkers[0].label, "起点");
  assert.equal(startMarkers[0].legendLabel, "起点");
  assert.equal(startMarkers[0].semanticKey, "start");
  assert.equal(startMarkers[0].state, "active-route");
  assert.equal(startMarkers[0].variantClass, "is-start");
  assert.equal(endMarkers[0].label, "终点");
  assert.equal(endMarkers[0].legendLabel, "终点");
  assert.equal(endMarkers[0].semanticKey, "end");
  assert.equal(endMarkers[0].state, "active-route");
  assert.equal(endMarkers[0].variantClass, "is-end");
  assert.equal(startMarkers[0].sharedLogicalNode, false);
  assert.equal(endMarkers[0].sharedLogicalNode, false);
});

test("turn and transition markers remain intact alongside endpoint markers", () => {
  const transitionNode = createNode("transition", 120, 160);
  const turnNode = createNode("turn", 180, 220);
  const routeAnalysis: RouteAnalysis = {
    routeNodes: [createNode("start", 80, 80), transitionNode, turnNode, createNode("end", 260, 260)],
    transitionMarkers: [{ label: "进入室内", node: transitionNode, shortLabel: "室内" }],
    turnMarkers: [{ label: "转向", node: turnNode, shortLabel: "转向" }],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());

  assert.equal(markerLayout.endpointMarkers.length, 2);
  assert.equal(markerLayout.transitionMarkers.length, 1);
  assert.equal(markerLayout.turnMarkers.length, 1);
  assert.equal(markerLayout.transitionMarkers[0].nodeId, "transition");
  assert.equal(markerLayout.transitionMarkers[0].kind, "transition");
  assert.equal(markerLayout.transitionMarkers[0].label, "室内");
  assert.equal(markerLayout.transitionMarkers[0].legendLabel, "室内/户外切换");
  assert.equal(markerLayout.transitionMarkers[0].legendBadgeLabel, "室内");
  assert.equal(markerLayout.transitionMarkers[0].semanticKey, "transition");
  assert.equal(markerLayout.transitionMarkers[0].state, "active-route");
  assert.equal(markerLayout.transitionMarkers[0].variantClass, "is-transition");
  assert.equal(markerLayout.turnMarkers[0].nodeId, "turn");
  assert.equal(markerLayout.turnMarkers[0].kind, "turn");
  assert.equal(markerLayout.turnMarkers[0].label, "转向");
  assert.equal(markerLayout.turnMarkers[0].legendLabel, "方向或路线变化");
  assert.equal(markerLayout.turnMarkers[0].legendBadgeLabel, "转向");
  assert.equal(markerLayout.turnMarkers[0].semanticKey, "turn");
  assert.equal(markerLayout.turnMarkers[0].state, "active-route");
  assert.equal(markerLayout.turnMarkers[0].variantClass, "is-turn");
});

test("floor-change turns surface the floor label on the legend badge", () => {
  const floorNode = createNode("floor-change", 200, 220);
  const routeAnalysis: RouteAnalysis = {
    routeNodes: [createNode("start", 120, 80), floorNode, createNode("end", 320, 280)],
    transitionMarkers: [],
    turnMarkers: [{ label: "前往 1 层", node: floorNode, shortLabel: "1层" }],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());
  assert.equal(markerLayout.turnMarkers.length, 1);
  assert.equal(markerLayout.turnMarkers[0].nodeId, "floor-change");
  assert.equal(markerLayout.turnMarkers[0].label, "1层");
  assert.equal(markerLayout.turnMarkers[0].legendBadgeLabel, "1层");
  assert.equal(markerLayout.turnMarkers[0].legendLabel, "方向或路线变化");
  assert.equal(markerLayout.turnMarkers[0].semanticKey, "turn");
  assert.equal(markerLayout.turnMarkers[0].state, "active-route");
  assert.equal(markerLayout.turnMarkers[0].variantClass, "is-turn");
});

test("transition legend badge follows non-indoor transition pills", () => {
  const transitionNode = createNode("transition", 120, 160);
  const routeAnalysis: RouteAnalysis = {
    routeNodes: [createNode("start", 80, 80), transitionNode, createNode("end", 260, 260)],
    transitionMarkers: [{ label: "回到户外", node: transitionNode, shortLabel: "户外" }],
    turnMarkers: [],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());

  assert.equal(markerLayout.transitionMarkers.length, 1);
  assert.equal(markerLayout.transitionMarkers[0].label, "户外");
  assert.equal(markerLayout.transitionMarkers[0].legendBadgeLabel, "户外");
  assert.equal(markerLayout.transitionMarkers[0].legendLabel, "室内/户外切换");
  assert.equal(markerLayout.transitionMarkers[0].semanticKey, "transition");
  assert.equal(markerLayout.transitionMarkers[0].state, "active-route");
  assert.equal(markerLayout.transitionMarkers[0].variantClass, "is-transition");
});

test("legend captures every contextual cue variant instead of collapsing them", async () => {
  const { buildRouteLegendItems } = await importMapRenderingModule();
  const startNode = createNode("start", 0, 0);
  const indoorTransition = createNode("transition-indoor", 40, 60);
  const firstTurn = createNode("turn-first", 80, 90);
  const outdoorTransition = createNode("transition-outdoor", 120, 130);
  const secondTurn = createNode("turn-second", 160, 170);
  const endNode = createNode("end", 200, 210);
  const routeNodes = [startNode, indoorTransition, firstTurn, outdoorTransition, secondTurn, endNode];
  const stepDetails = routeNodes.slice(0, -1).map((node, index) => ({
    fromNode: node,
    toNode: routeNodes[index + 1],
    edge: { roadType: "walkway" },
  }));

  const routeAnalysis: RouteAnalysis = {
    routeNodes,
    stepDetails,
    transitionMarkers: [
      { label: "进入室内", node: indoorTransition, shortLabel: "室内" },
      { label: "回到户外", node: outdoorTransition, shortLabel: "户外" },
    ],
    turnMarkers: [
      { label: "转向", node: firstTurn, shortLabel: "转向" },
      { label: "第 2 层", node: secondTurn, shortLabel: "2层" },
    ],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());
  const legendItems = buildRouteLegendItems(routeAnalysis, markerLayout, []);
  const transitionEntries = legendItems.filter((item) => item.semanticKey === "transition");
  const turnEntries = legendItems.filter((item) => item.semanticKey === "turn");

  assert.equal(transitionEntries.length, 2);
  assert.ok(transitionEntries.some((entry) => entry.iconMarkup.includes(">室内<")));
  assert.ok(transitionEntries.some((entry) => entry.iconMarkup.includes(">户外<")));
  assert.equal(turnEntries.length, 2);
  assert.ok(turnEntries.some((entry) => entry.iconMarkup.includes(">转向<")));
  assert.ok(turnEntries.some((entry) => entry.iconMarkup.includes(">2层<")));
});

test("preview markers stay separate from active route markers and expose preview semantics", () => {
  const previewMarkers = createPreviewMarkers(
    {
      endNode: createNode("end", 200, 260),
      startNode: createNode("start", 120, 160),
    },
    createProjection(),
  );

  assert.equal(previewMarkers.length, 2);
  assert.equal(previewMarkers[0].kind, "preview-start");
  assert.equal(previewMarkers[0].label, "起点");
  assert.equal(previewMarkers[0].legendLabel, "预览起点");
  assert.equal(previewMarkers[0].semanticKey, "preview-start");
  assert.equal(previewMarkers[0].state, "preview");
  assert.equal(previewMarkers[0].variantClass, "is-preview");
  assert.equal(previewMarkers[1].kind, "preview-end");
  assert.equal(previewMarkers[1].label, "终点");
  assert.equal(previewMarkers[1].legendLabel, "预览终点");
  assert.equal(previewMarkers[1].semanticKey, "preview-end");
  assert.equal(previewMarkers[1].state, "preview");
  assert.equal(previewMarkers[1].variantClass, "is-preview");
});
