import { averageRating } from "./fallback-algorithms";
import { assertNonEmpty, dedupeTags, ensureLimit, findDestination, findUser, journalSummary, scoreJournal } from "./service-helpers";
import type { JournalCreateInput, JournalRecord, JournalUpdateInput } from "./contracts";
import type { JournalStore } from "./journal-store";
import type { ResolvedRuntime } from "./runtime";

function nowIso(): string {
  return new Date().toISOString();
}

function nextJournalId(journals: JournalRecord[]): string {
  const maxId = journals.reduce((max, journal) => {
    const value = Number.parseInt(journal.id.replace("journal-", ""), 10);
    return Number.isNaN(value) ? max : Math.max(max, value);
  }, 0);
  return `journal-${maxId + 1}`;
}

export function createJournalService(runtime: ResolvedRuntime, store: JournalStore) {
  return {
    async list(options: { destinationId?: string; userId?: string; limit?: number } = {}) {
      const limit = ensureLimit(options.limit, 12, 60);
      const journals = await store.list();
      return journals
        .filter((journal) => (options.destinationId ? journal.destinationId === options.destinationId : true))
        .filter((journal) => (options.userId ? journal.userId === options.userId : true))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, limit)
        .map((journal) => journalSummary(journal));
    },

    async get(journalId: string) {
      const journal = await store.get(journalId);
      if (!journal) {
        throw new Error(`Unknown journal: ${journalId}`);
      }
      return journalSummary(journal);
    },

    async create(input: JournalCreateInput) {
      const user = findUser(runtime.seedData.users, assertNonEmpty(input.userId, "Journal author is required."));
      if (!user) {
        throw new Error(`Unknown user: ${input.userId}`);
      }
      const destination = findDestination(runtime.seedData.destinations, assertNonEmpty(input.destinationId, "Destination is required."));
      const journals = await store.list();
      const timestamp = nowIso();
      const journal: JournalRecord = {
        id: nextJournalId(journals),
        userId: user.id,
        destinationId: destination.id,
        title: assertNonEmpty(input.title, "Journal title is required."),
        body: assertNonEmpty(input.body, "Journal body is required."),
        tags: dedupeTags([...(input.tags ?? []), ...destination.categories.slice(0, 2)]),
        media: input.media ?? [],
        createdAt: timestamp,
        updatedAt: timestamp,
        views: 0,
        ratings: [],
        recommendedFor: input.recommendedFor ?? [],
      };
      await store.upsert(journal);
      return journalSummary(journal);
    },

    async update(journalId: string, input: JournalUpdateInput) {
      const existing = await store.get(journalId);
      if (!existing) {
        throw new Error(`Unknown journal: ${journalId}`);
      }
      const updated: JournalRecord = {
        ...existing,
        title: input.title ? assertNonEmpty(input.title, "Journal title is required.") : existing.title,
        body: input.body ? assertNonEmpty(input.body, "Journal body is required.") : existing.body,
        tags: input.tags ? dedupeTags(input.tags) : existing.tags,
        media: input.media ?? existing.media,
        recommendedFor: input.recommendedFor ?? existing.recommendedFor,
        updatedAt: nowIso(),
      };
      await store.upsert(updated);
      return journalSummary(updated);
    },

    async delete(journalId: string) {
      const removed = await store.remove(journalId);
      if (!removed) {
        throw new Error(`Unknown journal: ${journalId}`);
      }
      return { deleted: true };
    },

    async recordView(journalId: string) {
      const journal = await store.get(journalId);
      if (!journal) {
        throw new Error(`Unknown journal: ${journalId}`);
      }
      const updated = {
        ...journal,
        views: journal.views + 1,
        updatedAt: nowIso(),
      };
      await store.upsert(updated);
      return journalSummary(updated);
    },

    async rate(journalId: string, userId: string, score: number) {
      const user = findUser(runtime.seedData.users, userId);
      if (!user) {
        throw new Error(`Unknown user: ${userId}`);
      }
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error("Journal score must be an integer between 1 and 5.");
      }
      const journal = await store.get(journalId);
      if (!journal) {
        throw new Error(`Unknown journal: ${journalId}`);
      }
      if (journal.ratings.some((rating) => rating.userId === user.id)) {
        throw new Error(`User ${user.id} has already rated journal ${journalId}.`);
      }
      const updated = {
        ...journal,
        ratings: [...journal.ratings, { userId: user.id, score }],
        updatedAt: nowIso(),
      };
      await store.upsert(updated);
      return {
        ...journalSummary(updated),
        averageRating: averageRating(updated.ratings),
      };
    },

    async recommend(options: { userId?: string; destinationId?: string; limit?: number } = {}) {
      const limit = ensureLimit(options.limit, 6, 24);
      const user = findUser(runtime.seedData.users, options.userId);
      const destinationName = options.destinationId
        ? findDestination(runtime.seedData.destinations, options.destinationId).name
        : "";
      const journals = await store.list();
      return runtime.algorithms.recommendation
        .topK(
          journals.filter((journal) => (options.destinationId ? journal.destinationId === options.destinationId : true)),
          limit,
          (journal) => scoreJournal(journal, user, destinationName),
        )
        .map((journal) => journalSummary(journal));
    },
  };
}
