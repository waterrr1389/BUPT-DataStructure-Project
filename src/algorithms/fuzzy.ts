import { selectTopK } from "./top-k";

export interface FuzzyField {
  key?: string;
  text: string;
  weight?: number;
}

export interface FuzzyScoreOptions {
  gramSize?: number;
  normalizer?: (text: string) => string;
}

export interface FuzzyRankOptions<T> extends FuzzyScoreOptions {
  limit?: number;
  threshold?: number;
  tieBreaker?: (left: T, right: T) => number;
}

export interface RankedFuzzyMatch<T> {
  item: T;
  matchedFields: string[];
  score: number;
}

const DEFAULT_THRESHOLD = 0.25;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getFieldLabel(field: FuzzyField, index: number): string {
  return field.key ?? `field-${index + 1}`;
}

function normalizeText(text: string, normalizer: (text: string) => string): string {
  return normalizer(text).replace(/\s+/g, " ").trim();
}

function toFuzzyField(field: FuzzyField | string): FuzzyField {
  if (typeof field === "string") {
    return { text: field, weight: 1 };
  }

  const normalizedField: FuzzyField = {
    text: field.text,
    weight: field.weight ?? 1,
  };

  if (field.key !== undefined) {
    normalizedField.key = field.key;
  }

  return normalizedField;
}

function createFuzzyScoreOptions(
  gramSize: number,
  normalizer: ((text: string) => string) | undefined,
): FuzzyScoreOptions {
  const scoreOptions: FuzzyScoreOptions = { gramSize };

  if (normalizer !== undefined) {
    scoreOptions.normalizer = normalizer;
  }

  return scoreOptions;
}

function normalizedTokens(text: string): string[] {
  return text === "" ? [] : text.split(" ");
}

function jaccardSimilarity(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  return intersection / ((leftSet.size + rightSet.size) - intersection);
}

function buildGrams(text: string, gramSize: number): Set<string> {
  if (text.length === 0) {
    return new Set<string>();
  }

  if (text.length <= gramSize) {
    return new Set<string>([text]);
  }

  const grams = new Set<string>();

  for (let index = 0; index <= text.length - gramSize; index += 1) {
    grams.add(text.slice(index, index + gramSize));
  }

  return grams;
}

function diceCoefficient(left: string, right: string, gramSize: number): number {
  const leftGrams = buildGrams(left, gramSize);
  const rightGrams = buildGrams(right, gramSize);

  if (leftGrams.size === 0 || rightGrams.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (leftGrams.size + rightGrams.size);
}

function subsequenceScore(query: string, candidate: string): number {
  if (query.length === 0 || candidate.length === 0) {
    return 0;
  }

  let queryIndex = 0;
  let previousMatch = -1;
  let gaps = 0;

  for (let candidateIndex = 0; candidateIndex < candidate.length && queryIndex < query.length; candidateIndex += 1) {
    if (candidate[candidateIndex] === query[queryIndex]) {
      if (previousMatch >= 0) {
        gaps += candidateIndex - previousMatch - 1;
      }

      previousMatch = candidateIndex;
      queryIndex += 1;
    }
  }

  if (queryIndex === 0) {
    return 0;
  }

  const coverage = queryIndex / query.length;
  const gapPenalty = clamp(1 - (gaps / Math.max(candidate.length, 1)), 0, 1);
  return coverage * gapPenalty;
}

function validateOptions(gramSize: number, limit?: number, threshold?: number): void {
  if (!Number.isInteger(gramSize) || gramSize <= 0) {
    throw new Error("Fuzzy gram size must be a positive integer.");
  }

  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("Fuzzy search limit must be a positive integer.");
  }

  if (threshold !== undefined && (threshold < 0 || threshold > 1)) {
    throw new Error("Fuzzy search threshold must be between 0 and 1.");
  }
}

export function defaultFuzzyNormalizer(text: string): string {
  return text.toLowerCase();
}

export function scoreFuzzyMatch(
  query: string,
  candidate: string,
  options: FuzzyScoreOptions = {},
): number {
  const normalizer = options.normalizer ?? defaultFuzzyNormalizer;
  const gramSize = options.gramSize ?? 2;

  validateOptions(gramSize);

  const normalizedQuery = normalizeText(query, normalizer);
  const normalizedCandidate = normalizeText(candidate, normalizer);

  if (normalizedQuery === "" || normalizedCandidate === "") {
    return 0;
  }

  if (normalizedQuery === normalizedCandidate) {
    return 1;
  }

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactCandidate = normalizedCandidate.replace(/\s+/g, "");
  const tokenScore = jaccardSimilarity(
    normalizedTokens(normalizedQuery),
    normalizedTokens(normalizedCandidate),
  );
  const gramScore = diceCoefficient(compactQuery, compactCandidate, gramSize);
  const orderedScore = subsequenceScore(compactQuery, compactCandidate);
  const lengthRatio = Math.min(compactQuery.length, compactCandidate.length) / Math.max(compactQuery.length, compactCandidate.length);
  let score = (0.4 * gramScore) + (0.35 * tokenScore) + (0.15 * orderedScore) + (0.1 * lengthRatio);

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    score = Math.max(score, 0.9 - ((normalizedCandidate.length - normalizedQuery.length) / Math.max(normalizedCandidate.length, 1)) * 0.1);
  } else if (normalizedCandidate.includes(normalizedQuery)) {
    score = Math.max(score, 0.75 - ((normalizedCandidate.length - normalizedQuery.length) / Math.max(normalizedCandidate.length, 1)) * 0.1);
  }

  return clamp(score, 0, 1);
}

export function rankFuzzyMatches<T>(
  query: string,
  items: Iterable<T>,
  getFields: (item: T) => readonly FuzzyField[] | readonly string[],
  options: FuzzyRankOptions<T> = {},
): RankedFuzzyMatch<T>[] {
  const gramSize = options.gramSize ?? 2;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  validateOptions(gramSize, options.limit, threshold);

  const ranked: RankedFuzzyMatch<T>[] = [];

  for (const item of items) {
    const rawFields = getFields(item) as readonly (FuzzyField | string)[];
    const fields: FuzzyField[] = rawFields.map((field) => toFuzzyField(field));

    if (fields.length === 0) {
      continue;
    }

    const scoreOptions = createFuzzyScoreOptions(gramSize, options.normalizer);
    let bestScore = 0;
    let totalWeight = 0;
    let weightedScore = 0;
    const matchedFields: string[] = [];

    for (let index = 0; index < fields.length; index += 1) {
      const field = fields[index] as FuzzyField;
      const weight = field.weight ?? 1;
      const score = scoreFuzzyMatch(query, field.text, scoreOptions);

      totalWeight += weight;
      weightedScore += score * weight;

      if (score > 0) {
        matchedFields.push(getFieldLabel(field, index));
      }

      bestScore = Math.max(bestScore, score * Math.min(weight, 1.25));
    }

    const averageScore = totalWeight === 0 ? 0 : weightedScore / totalWeight;
    const score = clamp(
      Math.max(bestScore, averageScore + Math.min((matchedFields.length - 1) * 0.03, 0.1)),
      0,
      1,
    );

    if (score >= threshold) {
      ranked.push({
        item,
        matchedFields,
        score,
      });
    }
  }

  const compareMatches = (left: RankedFuzzyMatch<T>, right: RankedFuzzyMatch<T>): number => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    if (options.tieBreaker) {
      return options.tieBreaker(left.item, right.item);
    }

    return 0;
  };

  if (options.limit === undefined) {
    ranked.sort(compareMatches);
    return ranked;
  }

  return selectTopK(ranked, options.limit, compareMatches);
}
