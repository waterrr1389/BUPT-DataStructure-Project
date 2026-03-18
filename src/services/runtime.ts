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
} from "./contracts";

export interface ResolvedRuntime {
  seedData: SeedDataContract;
  lookups: Required<SeedLookupsContract>;
  algorithms: ResolvedAlgorithmBundle;
  validation: ResolvedValidationBundle;
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

function createLookups(data: SeedDataContract): Required<SeedLookupsContract> {
  return {
    destinationById: new Map(data.destinations.map((destination) => [destination.id, destination])),
    userById: new Map(data.users.map((user) => [user.id, user])),
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

function normalizeSeedModule(module: unknown): { seedData: SeedDataContract; lookups: Required<SeedLookupsContract> } | null {
  const candidate = unwrapModule(module) as { seedData?: SeedDataContract; lookups?: SeedLookupsContract } | null;
  if (!candidate?.seedData) {
    return null;
  }
  return {
    seedData: candidate.seedData,
    lookups: {
      destinationById: candidate.lookups?.destinationById ?? createLookups(candidate.seedData).destinationById,
      userById: candidate.lookups?.userById ?? createLookups(candidate.seedData).userById,
    },
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
    const externalValidation = externalSeed
      ? normalizeValidationModule(await loadOptionalModule("../data/validation"))
      : null;
    const externalAlgorithms = normalizeAlgorithmsModule(
      await loadOptionalModule("../algorithms/index"),
    );

    const fallback = createFallbackRuntime();
    const resolvedSeed = externalSeed ?? fallback;
    const resolvedValidation = mergeValidation(externalValidation);
    resolvedValidation.assertValidSeedData(resolvedSeed.seedData);
    const source: ResolvedRuntime["source"] = {
      data: resolveSourceKind(externalSeed),
      algorithms: resolveSourceKind(externalAlgorithms),
      validation: resolveSourceKind(externalValidation),
    };

    return {
      seedData: resolvedSeed.seedData,
      lookups: resolvedSeed.lookups as Required<SeedLookupsContract>,
      algorithms: mergeAlgorithms(externalAlgorithms),
      validation: resolvedValidation,
      runtimeDir,
      source,
    };
  })();

  if (!options.runtimeDir) {
    cachedRuntimePromise = runtimePromise;
  }
  return runtimePromise;
}
