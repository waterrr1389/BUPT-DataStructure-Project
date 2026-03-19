import { averageRating, normalizeText, tokenize, uniqueStrings } from "./fallback-algorithms";
import type { DestinationRecord, JournalRecord, UserRecord } from "./contracts";

export function assertNonEmpty(value: string | undefined, message: string): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}

export function ensureLimit(
  limit: number | undefined,
  fallback = 10,
  max = 50,
  options: { strictMax?: boolean } = {},
): number {
  if (limit === undefined) {
    return fallback;
  }
  if (!Number.isFinite(limit)) {
    throw new Error("Limit must be a positive number.");
  }
  const normalized = Math.floor(limit);
  if (normalized <= 0) {
    throw new Error("Limit must be a positive number.");
  }
  if (normalized > max) {
    if (options.strictMax) {
      throw new Error(`Limit must be at most ${max}.`);
    }
    return max;
  }
  return normalized;
}

export function ensureRadius(radius: number | undefined, fallback = 900): number {
  if (radius === undefined) {
    return fallback;
  }
  if (!Number.isFinite(radius) || radius < 0) {
    throw new Error("Radius must be zero or greater.");
  }
  return radius;
}

export function findDestination(destinations: DestinationRecord[], destinationId: string): DestinationRecord {
  const destination = destinations.find((entry) => entry.id === destinationId);
  if (!destination) {
    throw new Error(`Unknown destination: ${destinationId}`);
  }
  return destination;
}

export function findUser(users: UserRecord[], userId: string | undefined): UserRecord | null {
  if (!userId) {
    return null;
  }
  return users.find((user) => user.id === userId) ?? null;
}

export function scoreDestination(destination: DestinationRecord, user: UserRecord | null, query = ""): number {
  const interestOverlap = user
    ? user.interests.filter((interest) =>
        [...destination.categories, ...destination.keywords].some((candidate) => normalizeText(candidate) === normalizeText(interest)),
      ).length
    : 0;
  const queryTokens = tokenize(query);
  const queryMatches = queryTokens.filter((token) =>
    normalizeText([destination.name, ...destination.categories, ...destination.keywords].join(" ")).includes(token),
  ).length;
  return destination.heat * 0.45 + destination.rating * 18 + interestOverlap * 14 + queryMatches * 12;
}

export function scoreJournal(journal: JournalRecord, user: UserRecord | null, destinationName = ""): number {
  const recommendationBonus = user ? (journal.recommendedFor.includes(user.id) ? 18 : 0) : 0;
  const interestBonus = user
    ? user.interests.filter((interest) => journal.tags.some((tag) => normalizeText(tag) === normalizeText(interest))).length * 8
    : 0;
  const destinationBonus = destinationName && normalizeText(journal.title + journal.body).includes(normalizeText(destinationName)) ? 6 : 0;
  return journal.views * 0.35 + averageRating(journal.ratings) * 22 + recommendationBonus + interestBonus + destinationBonus;
}

export function journalSummary(journal: JournalRecord): Record<string, unknown> {
  return {
    ...journal,
    averageRating: averageRating(journal.ratings),
  };
}

export function dedupeTags(tags: string[]): string[] {
  return uniqueStrings(
    tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => tag.toLowerCase()),
  );
}
