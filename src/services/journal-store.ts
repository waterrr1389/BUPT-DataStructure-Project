import fs from "node:fs/promises";
import path from "node:path";
import type { JournalRecord } from "./contracts";

interface JournalStoreOptions {
  runtimeDir: string;
  seedJournals: JournalRecord[];
}

export class JournalStore {
  #filePath: string;
  #seedJournals: JournalRecord[];
  #journals: JournalRecord[] | null = null;

  constructor(options: JournalStoreOptions) {
    this.#filePath = path.join(options.runtimeDir, "journals.json");
    this.#seedJournals = structuredClone(options.seedJournals);
  }

  async list(): Promise<JournalRecord[]> {
    return structuredClone(await this.#load());
  }

  async get(journalId: string): Promise<JournalRecord | null> {
    const journal = (await this.#load()).find((entry) => entry.id === journalId);
    return journal ? structuredClone(journal) : null;
  }

  async saveAll(journals: JournalRecord[]): Promise<void> {
    this.#journals = structuredClone(journals);
    await this.#persist();
  }

  async upsert(journal: JournalRecord): Promise<JournalRecord> {
    const journals = await this.#load();
    const index = journals.findIndex((entry) => entry.id === journal.id);
    if (index >= 0) {
      journals[index] = structuredClone(journal);
    } else {
      journals.unshift(structuredClone(journal));
    }
    await this.#persist();
    return structuredClone(journal);
  }

  async remove(journalId: string): Promise<boolean> {
    const journals = await this.#load();
    const nextJournals = journals.filter((entry) => entry.id !== journalId);
    if (nextJournals.length === journals.length) {
      return false;
    }
    this.#journals = nextJournals;
    await this.#persist();
    return true;
  }

  async reset(): Promise<void> {
    this.#journals = structuredClone(this.#seedJournals);
    await this.#persist();
  }

  async #load(): Promise<JournalRecord[]> {
    if (this.#journals) {
      return this.#journals;
    }
    try {
      const raw = await fs.readFile(this.#filePath, "utf8");
      const parsed = JSON.parse(raw) as JournalRecord[];
      this.#journals = parsed;
      return this.#journals;
    } catch (error) {
      const candidate = error as NodeJS.ErrnoException;
      if (candidate.code === "ENOENT") {
        this.#journals = structuredClone(this.#seedJournals);
        return this.#journals;
      }
      throw error;
    }
  }

  async #persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
    await fs.writeFile(this.#filePath, `${JSON.stringify(this.#journals, null, 2)}\n`, "utf8");
  }
}
