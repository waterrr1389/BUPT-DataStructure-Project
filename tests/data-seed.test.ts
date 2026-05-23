import assert from "node:assert/strict";
import test from "node:test";

import {
  destinationById,
  facilityCategoryById,
  lookups,
  seedData,
  userById,
  worldData,
} from "../src/data/seed";
import { MINIMUM_COUNTS, validateSeedData } from "../src/data/validation";
import { WORLD_ROUTE_LIMITS } from "../src/services/contracts";

function requireWorld(): NonNullable<typeof seedData.world> {
  const world = seedData.world;
  if (!world) {
    throw new Error("Expected seedData.world to be available");
  }
  return world;
}

function expectedDestinationId(index: number): string {
  return `dest-${String(index + 1).padStart(3, "0")}`;
}

const EXPECTED_DESTINATION_IDS = Array.from(
  { length: 220 },
  (_, index) => expectedDestinationId(index),
);

function hasAdjacentRepeatedWords(value: string): boolean {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.some((word, index) => {
    const nextWord = words[index + 1];
    return typeof nextWord === "string" && word.toLowerCase() === nextWord.toLowerCase();
  });
}

test("seedData exports a validation-ready dataset with matching lookups", () => {
  const result = validateSeedData(seedData);

  assert.equal(result.ok, true, result.issues.join("\n"));
  assert.ok(seedData.version.length > 0);
  assert.ok(!Number.isNaN(Date.parse(seedData.generatedAt)));

  assert.equal(seedData.destinations.length >= MINIMUM_COUNTS.destinations, true);
  assert.equal(seedData.users.length >= MINIMUM_COUNTS.users, true);
  assert.equal(
    seedData.facilityCategories.length >= MINIMUM_COUNTS.facilityCategories,
    true,
  );

  assert.equal(lookups.destinationById, destinationById);
  assert.equal(lookups.userById, userById);
  assert.equal(lookups.facilityCategoryById, facilityCategoryById);

  assert.equal(destinationById.size, seedData.destinations.length);
  assert.equal(userById.size, seedData.users.length);
  assert.equal(facilityCategoryById.size, seedData.facilityCategories.length);
  assert.equal(seedData.world, worldData);
  assert.equal(lookups.world, worldData);
});

test("seed destination ids stay stable while names remain unique and credible", () => {
  assert.equal(seedData.destinations.length, 220);
  assert.deepEqual(seedData.destinations.map((destination) => destination.id), EXPECTED_DESTINATION_IDS);

  const names = seedData.destinations.map((destination) => destination.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(
    seedData.destinations
      .filter((destination) => hasAdjacentRepeatedWords(destination.name))
      .map((destination) => ({ id: destination.id, name: destination.name })),
    [],
  );

  assert.equal(destinationById.get("dest-001")?.name, "Amber Bay");
  assert.equal(destinationById.get("dest-002")?.name, "North Institute");
  assert.equal(destinationById.get("dest-003")?.name, "Juniper Reserve");
  assert.equal(destinationById.get("dest-005")?.name, "Harbor Haven");
});

test("validateSeedData keeps world optional for local-only seed data", () => {
  const localOnlySeed = structuredClone(seedData);
  delete localOnlySeed.world;

  const result = validateSeedData(localOnlySeed);

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("validateSeedData rejects duplicate destination names and adjacent repeated words", () => {
  const duplicateName = structuredClone(seedData);
  duplicateName.destinations[2].name = duplicateName.destinations[0].name;

  const duplicateResult = validateSeedData(duplicateName);

  assert.equal(duplicateResult.ok, false);
  assert.match(duplicateResult.issues.join("\n"), /destination name "Amber Bay" is duplicated/);

  const repeatedWords = structuredClone(seedData);
  repeatedWords.destinations[2].name = "Harbor Harbor";

  const repeatedResult = validateSeedData(repeatedWords);

  assert.equal(repeatedResult.ok, false);
  assert.match(
    repeatedResult.issues.join("\n"),
    /destination "dest-003" name "Harbor Harbor" has adjacent repeated words/,
  );
});

test("validateSeedData rejects invalid world references and portal semantics", () => {
  const cases: Array<{
    name: string;
    mutate: (candidate: typeof seedData) => void;
    expectedIssue: RegExp;
  }> = [
    {
      name: "unknown placement region",
      mutate: (candidate) => {
        candidate.world!.destinations[0].regionId = "world-region-missing";
      },
      expectedIssue: /references unknown region "world-region-missing"/,
    },
    {
      name: "unknown placement portal",
      mutate: (candidate) => {
        candidate.world!.destinations[0].portalIds = ["portal-missing"];
      },
      expectedIssue: /references unknown portal "portal-missing"/,
    },
    {
      name: "portal world node must stay portal-kind",
      mutate: (candidate) => {
        const portalWorldNodeId = candidate.world!.portals[0].worldNodeId;
        const worldNode = candidate.world!.graph.nodes.find((node) => node.id === portalWorldNodeId);
        if (!worldNode) {
          throw new Error(`Expected world node ${portalWorldNodeId} to exist`);
        }
        const portalNode = worldNode;
        portalNode.kind = "hub";
      },
      expectedIssue: /references world node "world-node-dest-001-main" that is not kind "portal"/,
    },
    {
      name: "portal local node must exist in the destination graph",
      mutate: (candidate) => {
        candidate.world!.portals[0].localNodeId = "dest-001-missing-gate";
      },
      expectedIssue: /references unknown local node "dest-001-missing-gate" in destination "dest-001"/,
    },
    {
      name: "world node kind must stay in the frozen domain",
      mutate: (candidate) => {
        const worldNode = candidate.world!.graph.nodes[0];
        worldNode.kind = "sky-node" as unknown as (typeof worldNode)["kind"];
      },
      expectedIssue: /has unsupported kind "sky-node"/,
    },
    {
      name: "world edge roadType must stay in the frozen domain",
      mutate: (candidate) => {
        const worldEdge = candidate.world!.graph.edges[0];
        worldEdge.roadType = "hyperloop" as unknown as (typeof worldEdge)["roadType"];
      },
      expectedIssue: /has unsupported roadType "hyperloop"/,
    },
    {
      name: "world edge distance must stay within the frozen max",
      mutate: (candidate) => {
        const worldEdge = candidate.world!.graph.edges[0];
        worldEdge.distance = WORLD_ROUTE_LIMITS.distance.max + 1;
      },
      expectedIssue: /exceeds distance max/,
    },
    {
      name: "world edge allowedModes must stay in the frozen domain",
      mutate: (candidate) => {
        const worldEdge = candidate.world!.graph.edges[0];
        worldEdge.allowedModes = ["teleport"] as unknown as typeof worldEdge.allowedModes;
      },
      expectedIssue: /includes unsupported travel mode "teleport"/,
    },
    {
      name: "world portal allowedModes must stay in the frozen domain",
      mutate: (candidate) => {
        const portal = candidate.world!.portals[0];
        portal.allowedModes = ["walk", "teleport"] as unknown as typeof portal.allowedModes;
      },
      expectedIssue: /includes unsupported travel mode "teleport"/,
    },
    {
      name: "world portal direction must stay in the frozen domain",
      mutate: (candidate) => {
        const portal = candidate.world!.portals[0];
        portal.direction = "outbound-only" as unknown as (typeof portal)["direction"];
      },
      expectedIssue: /has unsupported direction "outbound-only"/,
    },
    {
      name: "world portal transferDistance must stay within the frozen max",
      mutate: (candidate) => {
        const portal = candidate.world!.portals[0];
        portal.transferDistance = WORLD_ROUTE_LIMITS.transferDistance.max + 1;
      },
      expectedIssue: /exceeds transferDistance max/,
    },
    {
      name: "world portal transferCost must stay within the frozen max",
      mutate: (candidate) => {
        const portal = candidate.world!.portals[0];
        portal.transferCost = WORLD_ROUTE_LIMITS.transferCost.max + 1;
      },
      expectedIssue: /exceeds transferCost max/,
    },
    {
      name: "world placement label must follow the catalog name",
      mutate: (candidate) => {
        candidate.world!.destinations[0].label = "Stale Placement Label";
      },
      expectedIssue: /world destination placement "dest-001" label "Stale Placement Label" must match catalog label "Amber Bay · North Belt"/,
    },
    {
      name: "world portal node label must follow the catalog name",
      mutate: (candidate) => {
        const portalNode = candidate.world!.graph.nodes.find(
          (node) => node.id === "world-node-dest-001-main",
        );
        if (!portalNode) {
          throw new Error("Expected world-node-dest-001-main to exist");
        }
        portalNode.label = "Stale Node Label";
      },
      expectedIssue: /world node "world-node-dest-001-main" label "Stale Node Label" must match catalog label "Amber Bay Gate"/,
    },
    {
      name: "world portal label must follow the catalog name",
      mutate: (candidate) => {
        candidate.world!.portals[0].label = "Stale Portal Label";
      },
      expectedIssue: /world portal "portal-dest-001-main" label "Stale Portal Label" must match catalog label "Amber Bay Main Gate"/,
    },
    {
      name: "non-main world portal label must begin with the catalog name",
      mutate: (candidate) => {
        const portal = candidate.world!.portals[0];
        portal.portalType = "connector";
        portal.label = "Wrong Destination Connector";
      },
      expectedIssue: /world portal "portal-dest-001-main" label "Wrong Destination Connector" must begin with catalog destination name "Amber Bay"/,
    },
    {
      name: "non-main world portal label must not mix another catalog name",
      mutate: (candidate) => {
        const portal = candidate.world!.portals[0];
        portal.portalType = "connector";
        portal.label = "Amber Bay North Institute Connector";
      },
      expectedIssue: /world portal "portal-dest-001-main" label "Amber Bay North Institute Connector" must not include another catalog destination name "North Institute"/,
    },
    {
      name: "world portal must not be wired to another destination portal node",
      mutate: (candidate) => {
        candidate.world!.portals[0].worldNodeId = "world-node-dest-002-main";
      },
      expectedIssue: /world portal "portal-dest-001-main" destination "dest-001" does not match world node destination "dest-002"/,
    },
    {
      name: "world placement must not reference another destination portal",
      mutate: (candidate) => {
        candidate.world!.destinations[0].portalIds = ["portal-dest-002-main"];
      },
      expectedIssue: /world destination placement "dest-001" references portal "portal-dest-002-main" for destination "dest-002"/,
    },
  ];

  for (const testCase of cases) {
    const candidate = structuredClone(seedData);
    testCase.mutate(candidate);

    const result = validateSeedData(candidate);

    assert.equal(result.ok, false, `${testCase.name} unexpectedly passed validation`);
    assert.equal(testCase.expectedIssue.test(result.issues.join("\n")), true, testCase.name);
  }
});

test("world visible destination labels align with the catalog names", () => {
  const world = requireWorld();
  const regionById = new Map(world.regions.map((region) => [region.id, region]));
  const portalNodeByDestinationId = new Map(
    world.graph.nodes
      .filter((node) => node.kind === "portal" && node.destinationId)
      .map((node) => [node.destinationId!, node]),
  );

  for (const placement of world.destinations) {
    const destination = destinationById.get(placement.destinationId);
    const region = regionById.get(placement.regionId);
    if (!destination || !region) {
      throw new Error(`Expected placement ${placement.destinationId} to resolve`);
    }

    assert.equal(placement.label, `${destination.name} · ${region.name}`);

    const portalNode = portalNodeByDestinationId.get(placement.destinationId);
    assert.equal(portalNode?.label, `${destination.name} Gate`);

    for (const portalId of placement.portalIds) {
      const portal = world.portals.find((candidate) => candidate.id === portalId);
      assert.equal(portal?.label, `${destination.name} Main Gate`);
    }
  }
});

test("validateSeedData accepts world edge distance at the frozen min", () => {
  const candidate = structuredClone(seedData);
  candidate.world!.graph.edges[0].distance = WORLD_ROUTE_LIMITS.distance.min;

  const result = validateSeedData(candidate);

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("validateSeedData accepts frozen world portal directions inbound and outbound", () => {
  const candidate = structuredClone(seedData);
  candidate.world!.portals[0].direction = "inbound";
  candidate.world!.portals[1].direction = "outbound";

  const result = validateSeedData(candidate);

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("validateSeedData accepts empty world region and node tags", () => {
  const candidate = structuredClone(seedData);
  candidate.world!.regions[0].tags = [];
  candidate.world!.graph.nodes[0].tags = [];

  const result = validateSeedData(candidate);

  assert.equal(result.ok, true, result.issues.join("\n"));
});

test("world seed keeps the Boston-inspired structural constraints deterministic", () => {
  const world = requireWorld();

  assert.equal(world.regions.length, 6);
  assert.equal(world.destinations.length, 12);
  assert.equal(world.portals.length, 12);
  assert.equal(
    world.graph.nodes.filter((node) => node.kind === "portal").length,
    12,
  );
  assert.equal(
    world.graph.nodes.filter(
      (node) => node.kind === "junction" && node.tags.includes("chokepoint"),
    ).length,
    4,
  );

  const portalById = new Map(world.portals.map((portal) => [portal.id, portal]));
  for (const placement of world.destinations) {
    assert.equal(placement.portalIds.length > 0, true, placement.destinationId);
    for (const portalId of placement.portalIds) {
      const portal = portalById.get(portalId);
      if (!portal) {
        throw new Error(`Expected world portal ${portalId} to exist`);
      }
      const placementPortal = portal;
      assert.equal(placementPortal.destinationId, placement.destinationId);
    }
  }
});
