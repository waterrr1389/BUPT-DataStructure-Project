export type HeapComparator<T> = (a: T, b: T) => number;

export interface SelectTopKOptions {
  sorted?: boolean;
}

interface RankedEntry<T> {
  index: number;
  value: T;
}

export class MinHeap<T> {
  private readonly compare: HeapComparator<T>;
  private readonly items: T[];

  constructor(compare: HeapComparator<T>, values: Iterable<T> = []) {
    this.compare = compare;
    this.items = Array.from(values);

    if (this.items.length > 1) {
      this.heapify();
    }
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  pop(): T | undefined {
    if (this.items.length === 0) {
      return undefined;
    }

    const root = this.items[0];
    const last = this.items.pop() as T;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return root;
  }

  push(value: T): void {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }

  replace(value: T): T | undefined {
    if (this.items.length === 0) {
      this.items[0] = value;
      return undefined;
    }

    const root = this.items[0];
    this.items[0] = value;
    this.bubbleDown(0);
    return root;
  }

  toArray(): T[] {
    return [...this.items];
  }

  private bubbleDown(startIndex: number): void {
    let index = startIndex;

    while (index < this.items.length) {
      const left = (index * 2) + 1;
      const right = left + 1;
      let smallest = index;

      if (left < this.items.length && this.compare(this.items[left] as T, this.items[smallest] as T) < 0) {
        smallest = left;
      }

      if (right < this.items.length && this.compare(this.items[right] as T, this.items[smallest] as T) < 0) {
        smallest = right;
      }

      if (smallest === index) {
        break;
      }

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex;

    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);

      if (this.compare(this.items[index] as T, this.items[parent] as T) >= 0) {
        break;
      }

      this.swap(index, parent);
      index = parent;
    }
  }

  private heapify(): void {
    for (let index = Math.floor(this.items.length / 2) - 1; index >= 0; index -= 1) {
      this.bubbleDown(index);
    }
  }

  private swap(left: number, right: number): void {
    const temporary = this.items[left] as T;
    this.items[left] = this.items[right] as T;
    this.items[right] = temporary;
  }
}

function validateTopK(k: number): void {
  if (!Number.isInteger(k) || k < 0) {
    throw new Error("Top-K size must be a non-negative integer.");
  }
}

function createStableComparator<T>(
  compare: (a: T, b: T) => number,
): (a: RankedEntry<T>, b: RankedEntry<T>) => number {
  return (left, right) => {
    const order = compare(left.value, right.value);
    if (order !== 0) {
      return order;
    }

    return left.index - right.index;
  };
}

function createWorstFirstComparator<T>(
  compare: (a: T, b: T) => number,
): (a: RankedEntry<T>, b: RankedEntry<T>) => number {
  return (left, right) => {
    const order = compare(right.value, left.value);
    if (order !== 0) {
      return order;
    }

    return right.index - left.index;
  };
}

// The comparator follows Array.sort semantics: a negative value means "left ranks ahead of right".
export function selectTopK<T>(
  items: Iterable<T>,
  k: number,
  compare: (a: T, b: T) => number,
  options: SelectTopKOptions = {},
): T[] {
  validateTopK(k);

  if (k === 0) {
    return [];
  }

  const stableCompare = createStableComparator(compare);
  const worstFirstCompare = createWorstFirstComparator(compare);
  const heap = new MinHeap<RankedEntry<T>>(worstFirstCompare);
  let index = 0;

  for (const value of items) {
    const entry: RankedEntry<T> = { index, value };

    if (heap.size < k) {
      heap.push(entry);
    } else if (worstFirstCompare(entry, heap.peek() as RankedEntry<T>) > 0) {
      heap.replace(entry);
    }

    index += 1;
  }

  const selected = heap.toArray();

  if (options.sorted !== false) {
    selected.sort(stableCompare);
  }

  return selected.map((entry) => entry.value);
}

export function selectTopKByScore<T>(
  items: Iterable<T>,
  k: number,
  score: (item: T) => number,
  options: SelectTopKOptions = {},
): T[] {
  return selectTopK(
    items,
    k,
    (left, right) => score(right) - score(left),
    options,
  );
}
