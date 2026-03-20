import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { importSpaModule } from "./support/spa-harness";

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
  createPreviewMarkers(
    previewSelection: { endNode?: RouteNode; startNode?: RouteNode },
    projection: Projection,
  ): MarkerOutput[];
  createRouteMarkerLayout(routeAnalysis: RouteAnalysis, projection: Projection): MarkerLayout;
};

const { createPreviewMarkers, createRouteMarkerLayout } = require(path.join(
  process.cwd(),
  "public",
  "route-visualization-markers.js",
)) as MarkerHelpersModule;

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
  assert.equal(startMarkers[0].legendLabel, "Start");
  assert.equal(endMarkers[0].legendLabel, "End");
  assert.equal(startMarkers[0].sharedLogicalNode, false);
  assert.equal(endMarkers[0].sharedLogicalNode, false);
});

test("turn and transition markers remain intact alongside endpoint markers", () => {
  const transitionNode = createNode("transition", 120, 160);
  const turnNode = createNode("turn", 180, 220);
  const routeAnalysis: RouteAnalysis = {
    routeNodes: [createNode("start", 80, 80), transitionNode, turnNode, createNode("end", 260, 260)],
    transitionMarkers: [{ label: "Indoor entry", node: transitionNode, shortLabel: "Indoor" }],
    turnMarkers: [{ label: "Turn", node: turnNode, shortLabel: "Turn" }],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());

  assert.equal(markerLayout.endpointMarkers.length, 2);
  assert.equal(markerLayout.transitionMarkers.length, 1);
  assert.equal(markerLayout.turnMarkers.length, 1);
  assert.equal(markerLayout.transitionMarkers[0].nodeId, "transition");
  assert.equal(markerLayout.transitionMarkers[0].label, "Indoor");
  assert.equal(markerLayout.transitionMarkers[0].legendLabel, "Indoor/outdoor change");
  assert.equal(markerLayout.transitionMarkers[0].legendBadgeLabel, "Indoor");
  assert.equal(markerLayout.transitionMarkers[0].semanticKey, "transition");
  assert.equal(markerLayout.transitionMarkers[0].variantClass, "is-transition");
  assert.equal(markerLayout.turnMarkers[0].nodeId, "turn");
  assert.equal(markerLayout.turnMarkers[0].label, "Turn");
  assert.equal(markerLayout.turnMarkers[0].legendLabel, "Direction or route change");
  assert.equal(markerLayout.turnMarkers[0].legendBadgeLabel, "Turn");
  assert.equal(markerLayout.turnMarkers[0].semanticKey, "turn");
  assert.equal(markerLayout.turnMarkers[0].variantClass, "is-turn");
});

test("floor-change turns surface the floor label on the legend badge", () => {
  const floorNode = createNode("floor-change", 200, 220);
  const routeAnalysis: RouteAnalysis = {
    routeNodes: [createNode("start", 120, 80), floorNode, createNode("end", 320, 280)],
    transitionMarkers: [],
    turnMarkers: [{ label: "Move to L1", node: floorNode, shortLabel: "L1" }],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());
  assert.equal(markerLayout.turnMarkers.length, 1);
  assert.equal(markerLayout.turnMarkers[0].nodeId, "floor-change");
  assert.equal(markerLayout.turnMarkers[0].label, "L1");
  assert.equal(markerLayout.turnMarkers[0].legendBadgeLabel, "L1");
  assert.equal(markerLayout.turnMarkers[0].legendLabel, "Direction or route change");
});

test("transition legend badge follows non-indoor transition pills", () => {
  const transitionNode = createNode("transition", 120, 160);
  const routeAnalysis: RouteAnalysis = {
    routeNodes: [createNode("start", 80, 80), transitionNode, createNode("end", 260, 260)],
    transitionMarkers: [{ label: "Open-air return", node: transitionNode, shortLabel: "Outdoor" }],
    turnMarkers: [],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());

  assert.equal(markerLayout.transitionMarkers.length, 1);
  assert.equal(markerLayout.transitionMarkers[0].label, "Outdoor");
  assert.equal(markerLayout.transitionMarkers[0].legendBadgeLabel, "Outdoor");
  assert.equal(markerLayout.transitionMarkers[0].legendLabel, "Indoor/outdoor change");
  assert.equal(markerLayout.transitionMarkers[0].semanticKey, "transition");
});

test("legend captures every contextual cue variant instead of collapsing them", async () => {
  const { buildRouteLegendItems } = await importSpaModule<MapRenderingModule>("map-rendering.js");
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
      { label: "Indoor entry", node: indoorTransition, shortLabel: "Indoor" },
      { label: "Open-air return", node: outdoorTransition, shortLabel: "Outdoor" },
    ],
    turnMarkers: [
      { label: "Turn", node: firstTurn, shortLabel: "Turn" },
      { label: "Level 2", node: secondTurn, shortLabel: "L2" },
    ],
  };

  const markerLayout = createRouteMarkerLayout(routeAnalysis, createProjection());
  const legendItems = buildRouteLegendItems(routeAnalysis, markerLayout, []);
  const transitionEntries = legendItems.filter((item) => item.semanticKey === "transition");
  const turnEntries = legendItems.filter((item) => item.semanticKey === "turn");

  assert.equal(transitionEntries.length, 2);
  assert.ok(transitionEntries.some((entry) => entry.iconMarkup.includes(">Indoor<")));
  assert.ok(transitionEntries.some((entry) => entry.iconMarkup.includes(">Outdoor<")));
  assert.equal(turnEntries.length, 2);
  assert.ok(turnEntries.some((entry) => entry.iconMarkup.includes(">Turn<")));
  assert.ok(turnEntries.some((entry) => entry.iconMarkup.includes(">L2<")));
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
  assert.equal(previewMarkers[0].label, "Start");
  assert.equal(previewMarkers[0].legendLabel, "Preview start");
  assert.equal(previewMarkers[0].semanticKey, "preview-start");
  assert.equal(previewMarkers[0].state, "preview");
  assert.equal(previewMarkers[0].variantClass, "is-preview");
  assert.equal(previewMarkers[1].kind, "preview-end");
  assert.equal(previewMarkers[1].label, "End");
  assert.equal(previewMarkers[1].legendLabel, "Preview end");
  assert.equal(previewMarkers[1].semanticKey, "preview-end");
  assert.equal(previewMarkers[1].state, "preview");
  assert.equal(previewMarkers[1].variantClass, "is-preview");
});
