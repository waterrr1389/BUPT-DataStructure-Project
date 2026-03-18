export interface TrieEntry<T> {
  key: string;
  value: T;
}

export interface TrieOptions {
  normalizer?: (input: string) => string;
}

export interface TrieSearchOptions {
  limit?: number;
}

interface TrieNode<T> {
  children: Map<string, TrieNode<T>>;
  hasValue: boolean;
  key?: string;
  value?: T;
}

function createNode<T>(): TrieNode<T> {
  return {
    children: new Map<string, TrieNode<T>>(),
    hasValue: false,
  };
}

function validateLimit(limit: number | undefined): void {
  if (limit === undefined) {
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Trie search limit must be a positive integer.");
  }
}

function clearNodeValue<T>(node: TrieNode<T>): void {
  node.hasValue = false;
  delete node.key;
  delete node.value;
}

export class Trie<T> {
  private readonly normalizer: (input: string) => string;
  private readonly root: TrieNode<T>;
  private sizeValue: number;

  constructor(options: TrieOptions = {}) {
    this.normalizer = options.normalizer ?? ((input) => input);
    this.root = createNode<T>();
    this.sizeValue = 0;
  }

  get size(): number {
    return this.sizeValue;
  }

  clear(): void {
    this.root.children.clear();
    clearNodeValue(this.root);
    this.sizeValue = 0;
  }

  delete(key: string): boolean {
    const normalized = this.normalizer(key);
    const characters = Array.from(normalized);
    const result = this.deleteRecursive(this.root, characters, 0);

    if (result.deleted) {
      this.sizeValue -= 1;
    }

    return result.deleted;
  }

  get(key: string): T | undefined {
    const node = this.findNode(this.normalizer(key));
    return node?.hasValue ? node.value : undefined;
  }

  has(key: string): boolean {
    return this.findNode(this.normalizer(key))?.hasValue ?? false;
  }

  searchExact(key: string): TrieEntry<T> | undefined {
    const node = this.findNode(this.normalizer(key));

    if (!node?.hasValue) {
      return undefined;
    }

    return {
      key: node.key as string,
      value: node.value as T,
    };
  }

  searchPrefix(prefix: string, options: TrieSearchOptions = {}): TrieEntry<T>[] {
    validateLimit(options.limit);

    const node = this.findNode(this.normalizer(prefix));

    if (!node) {
      return [];
    }

    const results: TrieEntry<T>[] = [];
    this.collect(node, results, options.limit);
    return results;
  }

  set(key: string, value: T): void {
    const normalized = this.normalizer(key);
    let node = this.root;

    for (const character of Array.from(normalized)) {
      let child = node.children.get(character);

      if (!child) {
        child = createNode<T>();
        node.children.set(character, child);
      }

      node = child;
    }

    if (!node.hasValue) {
      this.sizeValue += 1;
    }

    node.hasValue = true;
    node.key = key;
    node.value = value;
  }

  private collect(node: TrieNode<T>, results: TrieEntry<T>[], limit?: number): void {
    if (limit !== undefined && results.length >= limit) {
      return;
    }

    if (node.hasValue) {
      results.push({
        key: node.key as string,
        value: node.value as T,
      });
    }

    for (const child of node.children.values()) {
      if (limit !== undefined && results.length >= limit) {
        return;
      }

      this.collect(child, results, limit);
    }
  }

  private deleteRecursive(
    node: TrieNode<T>,
    characters: string[],
    index: number,
  ): { deleted: boolean; prune: boolean } {
    if (index === characters.length) {
      if (!node.hasValue) {
        return { deleted: false, prune: false };
      }

      clearNodeValue(node);
      return { deleted: true, prune: node.children.size === 0 };
    }

    const character = characters[index] as string;
    const child = node.children.get(character);

    if (!child) {
      return { deleted: false, prune: false };
    }

    const result = this.deleteRecursive(child, characters, index + 1);

    if (result.prune) {
      node.children.delete(character);
    }

    return {
      deleted: result.deleted,
      prune: !node.hasValue && node.children.size === 0,
    };
  }

  private findNode(normalizedKey: string): TrieNode<T> | undefined {
    let node: TrieNode<T> | undefined = this.root;

    for (const character of Array.from(normalizedKey)) {
      node = node.children.get(character);

      if (!node) {
        return undefined;
      }
    }

    return node;
  }
}
