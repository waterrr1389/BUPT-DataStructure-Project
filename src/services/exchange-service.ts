import {
  compressText as compressJournalText,
  decompressText as decompressJournalText,
  type LzwCompressedData,
} from "../algorithms/compression";
import { excerpt, generateStoryboard, normalizeText } from "./fallback-algorithms";
import { assertNonEmpty, ensureLimit, journalSummary } from "./service-helpers";
import type { JournalStore } from "./journal-store";
import type { ResolvedRuntime } from "./runtime";

const INTEGER_BASE = 0x8000;
const INTEGER_CHUNK_MASK = INTEGER_BASE - 1;
const INTEGER_CONTINUATION_MASK = INTEGER_BASE;

function isCompressedData(value: unknown): value is LzwCompressedData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { alphabet?: unknown; codes?: unknown };

  return Array.isArray(candidate.alphabet)
    && candidate.alphabet.every((symbol) => typeof symbol === "string")
    && Array.isArray(candidate.codes)
    && candidate.codes.every((code) => Number.isInteger(code) && code >= 0);
}

function encodeInteger(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Invalid compressed payload.");
  }

  let remaining = value;
  let encoded = "";

  do {
    let chunk = remaining % INTEGER_BASE;
    remaining = Math.floor(remaining / INTEGER_BASE);

    if (remaining > 0) {
      chunk |= INTEGER_CONTINUATION_MASK;
    }

    encoded += String.fromCharCode(chunk);
  } while (remaining > 0);

  return encoded;
}

function decodeInteger(input: string, startIndex: number): { value: number; nextIndex: number } {
  let value = 0;
  let factor = 1;
  let index = startIndex;

  while (index < input.length) {
    const chunk = input.charCodeAt(index);
    index += 1;
    value += (chunk & INTEGER_CHUNK_MASK) * factor;

    if (!Number.isSafeInteger(value)) {
      throw new Error("Invalid compressed payload.");
    }

    if ((chunk & INTEGER_CONTINUATION_MASK) === 0) {
      return { value, nextIndex: index };
    }

    factor *= INTEGER_BASE;
    if (!Number.isSafeInteger(factor)) {
      throw new Error("Invalid compressed payload.");
    }
  }

  throw new Error("Invalid compressed payload.");
}

function serializeCompressedData(data: LzwCompressedData): string {
  const alphabetText = data.alphabet.join("");
  return encodeInteger(alphabetText.length) + alphabetText + data.codes.map((code) => encodeInteger(code)).join("");
}

function deserializeCompressedData(input: string): LzwCompressedData {
  const { value: alphabetLength, nextIndex } = decodeInteger(input, 0);
  const alphabetEnd = nextIndex + alphabetLength;

  if (alphabetEnd > input.length) {
    throw new Error("Invalid compressed payload.");
  }

  const parsed: LzwCompressedData = {
    alphabet: Array.from(input.slice(nextIndex, alphabetEnd)),
    codes: [],
  };

  let index = alphabetEnd;
  while (index < input.length) {
    const decoded = decodeInteger(input, index);
    parsed.codes.push(decoded.value);
    index = decoded.nextIndex;
  }

  if (!isCompressedData(parsed)) {
    throw new Error("Invalid compressed payload.");
  }

  return parsed;
}

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
      const result = compressJournalText(text);
      const compressed = serializeCompressedData(result.data);
      const inputLength = text.length;
      const payloadLength = compressed.length;
      const compressionRatio = payloadLength / inputLength;
      const spaceSavings = 1 - compressionRatio;

      return {
        compressed,
        ratio: compressionRatio,
        compressionRatio,
        inputLength,
        outputLength: result.stats.outputLength,
        payloadLength,
        spaceSavings,
        algorithmCompressionRatio: result.stats.compressionRatio,
        dictionarySize: result.stats.dictionarySize,
        uniqueSymbols: result.stats.uniqueSymbols,
      };
    },

    decompress(body: string) {
      const text = assertNonEmpty(body, "Decompression requires compressed text.");
      return {
        text: decompressJournalText(deserializeCompressedData(text)),
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
