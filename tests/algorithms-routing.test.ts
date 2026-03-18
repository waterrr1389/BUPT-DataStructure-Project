import assert from "node:assert/strict";
import test from "node:test";

import {
  findShortestPath,
  planClosedLoopRoute,
  WeightedGraph,
} from "../src/algorithms/index";

type TransportMode = "bike" | "walk";

test("WeightedGraph finds shortest distance and time routes with transport constraints", () => {
  const graph = new WeightedGraph<TransportMode>();
  graph.addNodes([
    { id: "A" },
    { id: "B" },
    { id: "C" },
    { id: "D" },
    { id: "E" },
  ]);

  graph.addEdges([
    {
      allowedModes: ["walk", "bike"],
      bidirectional: true,
      distance: 5,
      from: "A",
      speedByMode: { bike: 5, walk: 1 },
      to: "B",
    },
    {
      allowedModes: ["walk", "bike"],
      bidirectional: true,
      distance: 5,
      from: "B",
      speedByMode: { bike: 5, walk: 1 },
      to: "C",
    },
    {
      allowedModes: ["walk"],
      bidirectional: true,
      distance: 3,
      from: "A",
      speedByMode: { walk: 1 },
      to: "D",
    },
    {
      allowedModes: ["walk"],
      bidirectional: true,
      distance: 3,
      from: "D",
      speedByMode: { walk: 1 },
      to: "C",
    },
    {
      allowedModes: ["walk"],
      bidirectional: true,
      crowdFactor: 0.5,
      distance: 1,
      from: "A",
      speedByMode: { walk: 1 },
      to: "E",
    },
    {
      allowedModes: ["walk"],
      bidirectional: true,
      distance: 20,
      from: "E",
      speedByMode: { walk: 1 },
      to: "C",
    },
  ]);

  const distancePath = findShortestPath(graph, "A", "C", {
    strategy: "distance",
  });
  assert.equal(distancePath.reachable, true);
  assert.deepEqual(distancePath.nodes, ["A", "D", "C"]);
  assert.equal(distancePath.cost, 6);

  const timePath = findShortestPath(graph, "A", "C", {
    allowedModes: ["walk", "bike"],
    strategy: "time",
  });
  assert.equal(timePath.reachable, true);
  assert.deepEqual(timePath.nodes, ["A", "B", "C"]);
  assert.equal(timePath.time, 2);
  assert.deepEqual(timePath.steps.map((step) => step.mode), ["bike", "bike"]);

  const bikeOnly = findShortestPath(graph, "A", "D", {
    mode: "bike",
    strategy: "time",
  });
  assert.equal(bikeOnly.reachable, false);

  assert.throws(() => {
    findShortestPath(graph, "A", "Z");
  }, /Unknown target node/);
});

test("WeightedGraph validates edge data", () => {
  const graph = new WeightedGraph<TransportMode>();

  assert.throws(() => {
    graph.addEdge({
      allowedModes: ["walk"],
      crowdFactor: 0,
      distance: 1,
      from: "A",
      to: "B",
    });
  }, /crowd factor/);
});

test("planClosedLoopRoute builds the cheapest closed loop and rejects duplicate stops", () => {
  const graph = new WeightedGraph<"walk">();
  graph.addEdges([
    { allowedModes: ["walk"], bidirectional: true, distance: 1, from: "S", to: "B" },
    { allowedModes: ["walk"], bidirectional: true, distance: 1, from: "B", to: "C" },
    { allowedModes: ["walk"], bidirectional: true, distance: 1, from: "C", to: "D" },
    { allowedModes: ["walk"], bidirectional: true, distance: 1, from: "D", to: "S" },
    { allowedModes: ["walk"], bidirectional: true, distance: 3, from: "S", to: "C" },
    { allowedModes: ["walk"], bidirectional: true, distance: 3, from: "B", to: "D" },
  ]);

  const route = planClosedLoopRoute(graph, "S", ["B", "C", "D"]);
  assert.equal(route.reachable, true);
  assert.equal(route.method, "exact");
  assert.deepEqual(route.closedLoop[0], "S");
  assert.deepEqual(route.closedLoop[route.closedLoop.length - 1], "S");
  assert.equal(route.totalCost, 4);
  assert.ok(
    [
      ["S", "B", "C", "D", "S"],
      ["S", "D", "C", "B", "S"],
    ].some((candidate) => JSON.stringify(candidate) === JSON.stringify(route.path)),
  );
  assert.deepEqual(new Set(route.order), new Set(["B", "C", "D"]));

  assert.throws(() => {
    planClosedLoopRoute(graph, "S", ["B", "B"]);
  }, /Duplicate stop/);
});
