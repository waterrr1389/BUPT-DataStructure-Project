import path from "node:path";
import {
  fallbackRecommendationHelpers,
  fallbackRoutingHelpers,
  fallbackSearchHelpers,
} from "./fallback-algorithms";
import { createFallbackRuntime, summarizeSeedData } from "./fallback-data";
import type {
  AlgorithmBundle,
  RecommendationHelpers,
  ResolvedAlgorithmBundle,
  ResolvedValidationBundle,
  RoutingHelpers,
  SearchHelpers,
  SeedDataContract,
  SeedLookupsContract,
  ServiceContextOptions,
  ValidationBundle,
  WorldCapabilityRecord,
} from "./contracts";

export interface WorldRuntimeState {
  available: boolean;
  capabilities: WorldCapabilityRecord;
}

export interface ResolvedSeedLookups extends Required<SeedLookupsContract> {
  world?: SeedDataContract["world"];
}

export interface ResolvedRuntime {
  seedData: SeedDataContract;
  lookups: ResolvedSeedLookups;
  algorithms: ResolvedAlgorithmBundle;
  validation: ResolvedValidationBundle;
  world: WorldRuntimeState;
  runtimeDir: string;
  source: {
    data: "fallback" | "external";
    algorithms: "fallback" | "external";
    validation: "fallback" | "external";
  };
}

let cachedRuntimePromise: Promise<ResolvedRuntime> | null = null;

type ValidateSeedDataFn = ResolvedValidationBundle["validateSeedData"];
type AssertValidSeedDataFn = ResolvedValidationBundle["assertValidSeedData"];
type RuntimeSourceKind = ResolvedRuntime["source"]["data"];

async function loadOptionalModule<T>(relativePath: string): Promise<T | null> {
  const modulePath = path.resolve(__dirname, relativePath);
  try {
    return require(modulePath) as T;
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException;
    // Only treat the requested module as optional; nested dependency failures should still surface.
    if (candidate?.code === "MODULE_NOT_FOUND" && String(candidate.message ?? "").includes(modulePath)) {
      return null;
    }
    throw error;
  }
}

function unwrapModule<T>(module: T): T {
  const candidate = module as { default?: T } | null;
  return candidate?.default ?? module;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isValidateSeedDataFn(value: unknown): value is ValidateSeedDataFn {
  return typeof value === "function";
}

function isAssertValidSeedDataFn(value: unknown): value is AssertValidSeedDataFn {
  return typeof value === "function";
}

function resolveSourceKind(value: unknown): RuntimeSourceKind {
  return value ? "external" : "fallback";
}

export function deriveWorldRuntimeState(data: SeedDataContract): WorldRuntimeState {
  const available = Boolean(data.world);
  const routingAvailable = Boolean(
    data.world &&
      data.world.graph.nodes.length > 0 &&
      data.world.graph.edges.length > 0 &&
      data.world.portals.length > 0,
  );
  return {
    available,
    capabilities: {
      worldView: available,
      destinationRouting: routingAvailable,
      crossMapRouting: routingAvailable,
    },
  };
}

function createLookups(data: SeedDataContract): ResolvedSeedLookups {
  return {
    destinationById: new Map(data.destinations.map((destination) => [destination.id, destination])),
    userById: new Map(data.users.map((user) => [user.id, user])),
    world: data.world,
  };
}

export function validateSeedDataLocally(data: SeedDataContract): { ok: boolean; issues: string[] } {
  const metrics = summarizeSeedData(data);
  const issues: string[] = [];

  if (metrics.destinations < 200) {
    issues.push(`Need at least 200 destinations, received ${metrics.destinations}.`);
  }
  if (metrics.buildings < 20) {
    issues.push(`Need at least 20 buildings, received ${metrics.buildings}.`);
  }
  if (metrics.facilityTypes < 10) {
    issues.push(`Need at least 10 facility categories, received ${metrics.facilityTypes}.`);
  }
  if (metrics.facilities < 50) {
    issues.push(`Need at least 50 facilities, received ${metrics.facilities}.`);
  }
  if (metrics.edges < 200) {
    issues.push(`Need at least 200 graph edges, received ${metrics.edges}.`);
  }
  if (metrics.users < 10) {
    issues.push(`Need at least 10 users, received ${metrics.users}.`);
  }

  data.destinations.forEach((destination) => {
    if (destination.graph.nodes.length === 0 || destination.graph.edges.length === 0) {
      issues.push(`Destination ${destination.id} is missing graph data.`);
    }
    destination.graph.edges.forEach((edge) => {
      if (edge.congestion <= 0 || edge.congestion > 1) {
        issues.push(`Edge ${edge.id} has invalid congestion ${edge.congestion}.`);
      }
    });
  });

  data.journals.forEach((journal) => {
    if (!journal.userId || !journal.destinationId || !journal.title || !journal.body) {
      issues.push(`Journal ${journal.id} is missing required fields.`);
    }
  });

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function assertValidSeedDataLocally(data: SeedDataContract): void {
  const result = validateSeedDataLocally(data);
  if (!result.ok) {
    throw new Error(result.issues.join(" "));
  }
}

function mergeValidation(bundle: ValidationBundle | null): ResolvedValidationBundle {
  return {
    validateSeedData: bundle?.validateSeedData ?? validateSeedDataLocally,
    assertValidSeedData: bundle?.assertValidSeedData ?? assertValidSeedDataLocally,
  };
}

function mergeAlgorithms(bundle: AlgorithmBundle | null): ResolvedAlgorithmBundle {
  return {
    recommendation: {
      // External helpers can override individual functions, but the fallback bundle remains the baseline contract.
      ...fallbackRecommendationHelpers,
      ...(bundle?.recommendation ?? {}),
    },
    search: {
      ...fallbackSearchHelpers,
      ...(bundle?.search ?? {}),
    },
    routing: {
      ...fallbackRoutingHelpers,
      ...(bundle?.routing ?? {}),
    },
  };
}

function normalizeSeedModule(module: unknown): { seedData: SeedDataContract; lookups: ResolvedSeedLookups } | null {
  const candidate = unwrapModule(module) as { seedData?: SeedDataContract; lookups?: SeedLookupsContract } | null;
  if (!candidate?.seedData) {
    return null;
  }
  // Rebuild missing lookup maps from the resolved seed so downstream services always receive complete indexes.
  const defaultLookups = createLookups(candidate.seedData);
  const lookups: ResolvedSeedLookups = {
    destinationById: candidate.lookups?.destinationById ?? defaultLookups.destinationById,
    userById: candidate.lookups?.userById ?? defaultLookups.userById,
    world: candidate.seedData.world,
  };
  return {
    seedData: candidate.seedData,
    lookups,
  };
}

function normalizeValidationModule(module: unknown): ValidationBundle | null {
  const candidate = unwrapModule(module);
  if (!isObjectRecord(candidate)) {
    return null;
  }

  const validateSeedData = isValidateSeedDataFn(candidate.validateSeedData)
    ? candidate.validateSeedData
    : undefined;
  const assertValidSeedData = isAssertValidSeedDataFn(candidate.assertValidSeedData)
    ? candidate.assertValidSeedData
    : undefined;

  if (!validateSeedData && !assertValidSeedData) {
    return null;
  }

  return {
    validateSeedData,
    assertValidSeedData,
  };
}

function normalizeAlgorithmsModule(module: unknown): AlgorithmBundle | null {
  const candidate = unwrapModule(module);
  if (!isObjectRecord(candidate)) {
    return null;
  }

  const recommendation = isObjectRecord(candidate.recommendation)
    ? (candidate.recommendation as Partial<RecommendationHelpers>)
    : undefined;
  const search = isObjectRecord(candidate.search)
    ? (candidate.search as Partial<SearchHelpers>)
    : undefined;
  const routing = isObjectRecord(candidate.routing)
    ? (candidate.routing as Partial<RoutingHelpers>)
    : undefined;

  if (!recommendation && !search && !routing) {
    return null;
  }

  return {
    recommendation,
    search,
    routing,
  };
}

export async function getRuntime(options: ServiceContextOptions = {}): Promise<ResolvedRuntime> {
  if (!options.runtimeDir && cachedRuntimePromise) {
    return cachedRuntimePromise;
  }

  const runtimePromise = (async () => {
    const runtimeDir = options.runtimeDir ?? path.resolve(process.cwd(), ".runtime");
    const externalSeed = normalizeSeedModule(await loadOptionalModule("../data/seed"));
    // Validation extensions are only loaded with external seed data; fallback data validates through the local contract.
    const externalValidation = externalSeed
      ? normalizeValidationModule(await loadOptionalModule("../data/validation"))
      : null;
    const externalAlgorithms = normalizeAlgorithmsModule(
      await loadOptionalModule("../algorithms/index"),
    );

    const fallback = createFallbackRuntime();
    // Resolve each bundle independently so external algorithms can coexist with fallback data and validation.
    const resolvedSeed = externalSeed ?? fallback;
    const defaultLookups = createLookups(resolvedSeed.seedData);
    const resolvedLookups: ResolvedSeedLookups = {
      destinationById: resolvedSeed.lookups.destinationById ?? defaultLookups.destinationById,
      userById: resolvedSeed.lookups.userById ?? defaultLookups.userById,
      world: resolvedSeed.seedData.world,
    };
    const resolvedValidation = mergeValidation(externalValidation);
    resolvedValidation.assertValidSeedData(resolvedSeed.seedData);
    const source: ResolvedRuntime["source"] = {
      data: resolveSourceKind(externalSeed),
      algorithms: resolveSourceKind(externalAlgorithms),
      validation: resolveSourceKind(externalValidation),
    };

    return {
      seedData: resolvedSeed.seedData,
      lookups: resolvedLookups,
      algorithms: mergeAlgorithms(externalAlgorithms),
      validation: resolvedValidation,
      world: deriveWorldRuntimeState(resolvedSeed.seedData),
      runtimeDir,
      source,
    };
  })();

  if (!options.runtimeDir) {
    // Callers that use the default runtime share one in-memory singleton; explicit runtimeDir keeps isolation for tests.
    cachedRuntimePromise = runtimePromise;
  }
  return runtimePromise;
}
