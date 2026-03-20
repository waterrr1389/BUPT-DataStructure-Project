import type {
  WorldCapabilityRecord,
  WorldDetailsRecord,
  WorldSummaryRecord,
  WorldUnavailableRecord,
} from "./contracts";
import type { ResolvedRuntime } from "./runtime";

const WORLD_UNAVAILABLE_MESSAGE = "World mode is unavailable.";

function disabledCapabilities(): WorldCapabilityRecord {
  return {
    worldView: false,
    destinationRouting: false,
    crossMapRouting: false,
  };
}

function unavailableRecord(): WorldUnavailableRecord {
  return {
    error: WORLD_UNAVAILABLE_MESSAGE,
    code: "world_unavailable",
  };
}

function summarizeWorld(runtime: ResolvedRuntime): WorldSummaryRecord {
  const world = runtime.seedData.world;
  const available = runtime.world.available && Boolean(world);

  if (!available || !world) {
    return {
      enabled: false,
      regions: [],
      destinations: [],
      capabilities: disabledCapabilities(),
    };
  }

  return {
    enabled: true,
    world: {
      id: world.id,
      name: world.name,
      width: world.width,
      height: world.height,
      backgroundImage: world.backgroundImage,
    },
    regions: world.regions.map((region) => ({
      id: region.id,
      name: region.name,
    })),
    destinations: world.destinations.map((destination) => ({
      destinationId: destination.destinationId,
      label: destination.label,
      x: destination.x,
      y: destination.y,
      iconType: destination.iconType,
      regionId: destination.regionId,
    })),
    capabilities: runtime.world.capabilities,
  };
}

export interface WorldService {
  isAvailable(): boolean;
  summary(): WorldSummaryRecord;
  details(): WorldDetailsRecord;
  unavailable(): WorldUnavailableRecord;
}

export function createWorldService(runtime: ResolvedRuntime): WorldService {
  return {
    isAvailable() {
      return runtime.world.available && Boolean(runtime.seedData.world);
    },
    summary() {
      return summarizeWorld(runtime);
    },
    details() {
      if (!runtime.world.available || !runtime.seedData.world) {
        throw new Error(WORLD_UNAVAILABLE_MESSAGE);
      }
      return {
        world: runtime.seedData.world,
      };
    },
    unavailable() {
      return unavailableRecord();
    },
  };
}
