import { selectTopK } from "./top-k";

export type Tokenizer = (text: string) => string[];

export interface IndexedDocument<Id, Meta = undefined> {
  id: Id;
  metadata?: Meta;
  text: string;
}

export interface InvertedIndexOptions {
  normalizer?: (token: string) => string;
  tokenizer?: Tokenizer;
}

export interface InvertedIndexSearchOptions {
  limit?: number;
  matchMode?: "all" | "any";
}

export interface SearchHit<Id, Meta = undefined> {
  id: Id;
  matchedTokens: string[];
  metadata?: Meta;
  score: number;
  text: string;
  tokenHits: number;
}

interface StoredDocument<Id, Meta> {
  id: Id;
  metadata?: Meta;
  text: string;
  tokenCounts: Map<string, number>;
}

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

function validateLimit(limit: number | undefined): void {
  if (limit === undefined) {
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Search limit must be a positive integer.");
  }
}

function defaultNormalizer(token: string): string {
  return token.trim().toLowerCase();
}

function createStoredDocument<Id, Meta>(
  document: IndexedDocument<Id, Meta>,
  tokenCounts: Map<string, number>,
): StoredDocument<Id, Meta> {
  const storedDocument: StoredDocument<Id, Meta> = {
    id: document.id,
    text: document.text,
    tokenCounts,
  };

  if (document.metadata !== undefined) {
    storedDocument.metadata = document.metadata;
  }

  return storedDocument;
}

function cloneIndexedDocument<Id, Meta>(document: StoredDocument<Id, Meta>): IndexedDocument<Id, Meta> {
  const clonedDocument: IndexedDocument<Id, Meta> = {
    id: document.id,
    text: document.text,
  };

  if (document.metadata !== undefined) {
    clonedDocument.metadata = document.metadata;
  }

  return clonedDocument;
}

function createSearchHit<Id, Meta>(
  document: StoredDocument<Id, Meta>,
  id: Id,
  matchedTokens: string[],
  score: number,
  tokenHits: number,
): SearchHit<Id, Meta> {
  const hit: SearchHit<Id, Meta> = {
    id,
    matchedTokens,
    score,
    text: document.text,
    tokenHits,
  };

  if (document.metadata !== undefined) {
    hit.metadata = document.metadata;
  }

  return hit;
}

export function defaultTokenize(text: string): string[] {
  return text.match(TOKEN_PATTERN)?.map((token) => token.toLowerCase()) ?? [];
}

export class InvertedIndex<Id, Meta = undefined> {
  private readonly documents: Map<Id, StoredDocument<Id, Meta>>;
  private readonly normalizer: (token: string) => string;
  private readonly postings: Map<string, Map<Id, number>>;
  private readonly tokenizer: Tokenizer;

  constructor(options: InvertedIndexOptions = {}) {
    this.documents = new Map<Id, StoredDocument<Id, Meta>>();
    this.normalizer = options.normalizer ?? defaultNormalizer;
    this.postings = new Map<string, Map<Id, number>>();
    this.tokenizer = options.tokenizer ?? defaultTokenize;
  }

  get size(): number {
    return this.documents.size;
  }

  add(document: IndexedDocument<Id, Meta>): void {
    if (this.documents.has(document.id)) {
      throw new Error("Document is already indexed.");
    }

    const tokenCounts = this.countTokens(document.text);
    const storedDocument = createStoredDocument(document, tokenCounts);

    this.documents.set(document.id, storedDocument);

    for (const [token, frequency] of tokenCounts) {
      let posting = this.postings.get(token);

      if (!posting) {
        posting = new Map<Id, number>();
        this.postings.set(token, posting);
      }

      posting.set(document.id, frequency);
    }
  }

  clear(): void {
    this.documents.clear();
    this.postings.clear();
  }

  getDocument(id: Id): IndexedDocument<Id, Meta> | undefined {
    const document = this.documents.get(id);

    if (!document) {
      return undefined;
    }

    return cloneIndexedDocument(document);
  }

  has(id: Id): boolean {
    return this.documents.has(id);
  }

  remove(id: Id): boolean {
    const storedDocument = this.documents.get(id);

    if (!storedDocument) {
      return false;
    }

    for (const token of storedDocument.tokenCounts.keys()) {
      const posting = this.postings.get(token);

      if (!posting) {
        continue;
      }

      posting.delete(id);

      if (posting.size === 0) {
        this.postings.delete(token);
      }
    }

    this.documents.delete(id);
    return true;
  }

  search(query: string, options: InvertedIndexSearchOptions = {}): SearchHit<Id, Meta>[] {
    validateLimit(options.limit);

    const queryTokens = Array.from(new Set(this.tokenize(query)));

    if (queryTokens.length === 0) {
      return [];
    }

    const candidateStates = new Map<Id, { matchedTokens: Set<string>; score: number }>();

    for (const token of queryTokens) {
      const posting = this.postings.get(token);

      if (!posting) {
        continue;
      }

      const inverseDocumentFrequency = Math.log((this.documents.size + 1) / (posting.size + 1)) + 1;

      for (const [id, frequency] of posting) {
        const state = candidateStates.get(id) ?? {
          matchedTokens: new Set<string>(),
          score: 0,
        };

        state.matchedTokens.add(token);
        state.score += (1 + Math.log(frequency)) * inverseDocumentFrequency;
        candidateStates.set(id, state);
      }
    }

    const hits: SearchHit<Id, Meta>[] = [];

    for (const [id, state] of candidateStates) {
      if (options.matchMode === "all" && state.matchedTokens.size !== queryTokens.length) {
        continue;
      }

      const document = this.documents.get(id);

      if (!document) {
        continue;
      }

      const matchedTokens = Array.from(state.matchedTokens.values()).sort();

      hits.push(createSearchHit(
        document,
        id,
        matchedTokens,
        state.score + (state.matchedTokens.size / queryTokens.length),
        state.matchedTokens.size,
      ));
    }

    const compareHits = (left: SearchHit<Id, Meta>, right: SearchHit<Id, Meta>): number => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if (left.tokenHits !== right.tokenHits) {
        return right.tokenHits - left.tokenHits;
      }

      return left.text.localeCompare(right.text);
    };

    if (options.limit === undefined) {
      hits.sort(compareHits);
      return hits;
    }

    return selectTopK(hits, options.limit, compareHits);
  }

  update(document: IndexedDocument<Id, Meta>): void {
    this.remove(document.id);
    this.add(document);
  }

  private countTokens(text: string): Map<string, number> {
    const tokenCounts = new Map<string, number>();

    for (const token of this.tokenize(text)) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }

    return tokenCounts;
  }

  private tokenize(text: string): string[] {
    const tokens: string[] = [];

    for (const rawToken of this.tokenizer(text)) {
      const token = this.normalizer(rawToken);

      if (token !== "") {
        tokens.push(token);
      }
    }

    return tokens;
  }
}
