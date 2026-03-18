import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

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
};

type Projection = {
  point(node: RouteNode): Point;
};

type MarkerOutput = {
  kind: "end" | "start" | "transition" | "turn";
  label: string;
  logicalPoint: Point;
  nodeId: string;
  point: Point;
  sharedLogicalNode?: boolean;
  variantClass: string;
};

type MarkerLayout = {
  endpointMarkers: MarkerOutput[];
  transitionMarkers: MarkerOutput[];
  turnMarkers: MarkerOutput[];
};

type MarkerHelpersModule = {
  createRouteMarkerLayout(routeAnalysis: RouteAnalysis, projection: Projection): MarkerLayout;
};

const { createRouteMarkerLayout } = require(path.join(
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
  assert.equal(startMarker.sharedLogicalNode, true);
  assert.equal(endMarker.sharedLogicalNode, true);
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
  assert.equal(markerLayout.transitionMarkers[0].variantClass, "is-transition");
  assert.equal(markerLayout.turnMarkers[0].nodeId, "turn");
  assert.equal(markerLayout.turnMarkers[0].label, "Turn");
  assert.equal(markerLayout.turnMarkers[0].variantClass, "is-turn");
});
