import { compressText, decompressText, excerpt, generateStoryboard, normalizeText } from "./fallback-algorithms";
import { assertNonEmpty, ensureLimit, journalSummary } from "./service-helpers";
import type { JournalStore } from "./journal-store";
import type { ResolvedRuntime } from "./runtime";

export function createExchangeService(runtime: ResolvedRuntime, store: JournalStore) {
  return {
    async byDestination(destinationId: string, limit?: number) {
      const destination = runtime.lookups.destinationById.get(assertNonEmpty(destinationId, "Destination is required."));
      if (!destination) {
        throw new Error(`Unknown destination: ${destinationId}`);
      }
      const journals = await store.list();
      return journals
        .filter((journal) => journal.destinationId === destination.id)
        .sort((left, right) => {
          const leftScore = left.views + left.ratings.reduce((sum, rating) => sum + rating.score, 0) * 10;
          const rightScore = right.views + right.ratings.reduce((sum, rating) => sum + rating.score, 0) * 10;
          return rightScore - leftScore;
        })
        .slice(0, ensureLimit(limit, 8, 24))
        .map((journal) => journalSummary(journal));
    },

    async exactTitle(title: string) {
      const journals = await store.list();
      const journal = runtime.algorithms.search.exactTitle(journals, title, (entry) => entry.title);
      return journal ? journalSummary(journal) : null;
    },

    async searchText(query: string, limit?: number) {
      const textQuery = assertNonEmpty(query, "Text search requires a query.");
      const journals = await store.list();
      const results = runtime.algorithms.search.rankText(
        journals,
        textQuery,
        (journal) => [journal.title, journal.body, ...journal.tags],
        ensureLimit(limit, 8, 24),
      );
      return results.map((entry) => ({
        ...journalSummary(entry.item),
        score: entry.score,
        matches: entry.matches,
        excerpt: excerpt(entry.item.body, entry.matches),
      }));
    },

    compress(body: string) {
      const text = assertNonEmpty(body, "Compression requires journal text.");
      const compressed = compressText(text);
      return {
        compressed,
        ratio: Number((compressed.length / text.length).toFixed(2)),
      };
    },

    decompress(body: string) {
      const text = assertNonEmpty(body, "Decompression requires compressed text.");
      return {
        text: decompressText(text),
      };
    },

    generateStoryboard(input: { title?: string; prompt: string; mediaSources?: string[] }) {
      const prompt = assertNonEmpty(input.prompt, "Storyboard prompt is required.");
      return generateStoryboard(input.title?.trim() || "travel journal", prompt, input.mediaSources ?? []);
    },

    async searchByDestinationText(destinationName: string, query: string) {
      const normalizedDestination = normalizeText(assertNonEmpty(destinationName, "Destination name is required."));
      const journals = await store.list();
      return journals
        .filter((journal) => {
          const destination = runtime.lookups.destinationById.get(journal.destinationId);
          return destination ? normalizeText(destination.name) === normalizedDestination : false;
        })
        .filter((journal) => normalizeText(journal.title + journal.body).includes(normalizeText(query)));
    },
  };
}
