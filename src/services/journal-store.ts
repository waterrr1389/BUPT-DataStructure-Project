import fs from "node:fs/promises";
import path from "node:path";
import type { JournalCommentRecord, JournalLikeRecord, JournalRecord } from "./contracts";

interface JournalStoreOptions {
  runtimeDir: string;
  seedJournals: JournalRecord[];
  seedComments?: JournalCommentRecord[];
  seedLikes?: JournalLikeRecord[];
}

export class JournalStore {
  #journalFilePath: string;
  #commentFilePath: string;
  #likeFilePath: string;
  #seedJournals: JournalRecord[];
  #seedComments: JournalCommentRecord[];
  #seedLikes: JournalLikeRecord[];
  #journals: JournalRecord[] | null = null;
  #comments: JournalCommentRecord[] | null = null;
  #likes: JournalLikeRecord[] | null = null;

  constructor(options: JournalStoreOptions) {
    this.#journalFilePath = path.join(options.runtimeDir, "journals.json");
    this.#commentFilePath = path.join(options.runtimeDir, "journal-comments.json");
    this.#likeFilePath = path.join(options.runtimeDir, "journal-likes.json");
    this.#seedJournals = structuredClone(options.seedJournals);
    this.#seedComments = structuredClone(options.seedComments ?? []);
    this.#seedLikes = structuredClone(options.seedLikes ?? []);
  }

  async list(): Promise<JournalRecord[]> {
    return structuredClone(await this.#loadJournals());
  }

  async get(journalId: string): Promise<JournalRecord | null> {
    const journal = (await this.#loadJournals()).find((entry) => entry.id === journalId);
    return journal ? structuredClone(journal) : null;
  }

  async saveAll(journals: JournalRecord[]): Promise<void> {
    this.#journals = structuredClone(journals);
    await this.#persistJournals();
  }

  async upsert(journal: JournalRecord): Promise<JournalRecord> {
    const journals = await this.#loadJournals();
    const index = journals.findIndex((entry) => entry.id === journal.id);
    if (index >= 0) {
      journals[index] = structuredClone(journal);
    } else {
      journals.unshift(structuredClone(journal));
    }
    await this.#persistJournals();
    return structuredClone(journal);
  }

  async remove(journalId: string): Promise<boolean> {
    const journals = await this.#loadJournals();
    const nextJournals = journals.filter((entry) => entry.id !== journalId);
    if (nextJournals.length === journals.length) {
      return false;
    }
    this.#journals = nextJournals;
    await this.#persistJournals();
    return true;
  }

  async listComments(journalId?: string): Promise<JournalCommentRecord[]> {
    const comments = await this.#loadComments();
    const items = journalId ? comments.filter((entry) => entry.journalId === journalId) : comments;
    return structuredClone(items);
  }

  async getComment(commentId: string): Promise<JournalCommentRecord | null> {
    const comment = (await this.#loadComments()).find((entry) => entry.id === commentId);
    return comment ? structuredClone(comment) : null;
  }

  async upsertComment(comment: JournalCommentRecord): Promise<JournalCommentRecord> {
    const comments = await this.#loadComments();
    const index = comments.findIndex((entry) => entry.id === comment.id);
    if (index >= 0) {
      comments[index] = structuredClone(comment);
    } else {
      comments.unshift(structuredClone(comment));
    }
    await this.#persistComments();
    return structuredClone(comment);
  }

  async removeComment(commentId: string): Promise<boolean> {
    const comments = await this.#loadComments();
    const nextComments = comments.filter((entry) => entry.id !== commentId);
    if (nextComments.length === comments.length) {
      return false;
    }
    this.#comments = nextComments;
    await this.#persistComments();
    return true;
  }

  async removeCommentsByJournal(journalId: string): Promise<number> {
    const comments = await this.#loadComments();
    const nextComments = comments.filter((entry) => entry.journalId !== journalId);
    const removedCount = comments.length - nextComments.length;
    if (removedCount === 0) {
      return 0;
    }
    this.#comments = nextComments;
    await this.#persistComments();
    return removedCount;
  }

  async listLikes(options: { journalId?: string; userId?: string } = {}): Promise<JournalLikeRecord[]> {
    const likes = await this.#loadLikes();
    return structuredClone(
      likes.filter((entry) => (options.journalId ? entry.journalId === options.journalId : true))
        .filter((entry) => (options.userId ? entry.userId === options.userId : true)),
    );
  }

  async getLike(journalId: string, userId: string): Promise<JournalLikeRecord | null> {
    const like = (await this.#loadLikes()).find((entry) => entry.journalId === journalId && entry.userId === userId);
    return like ? structuredClone(like) : null;
  }

  async upsertLike(like: JournalLikeRecord): Promise<JournalLikeRecord> {
    const likes = await this.#loadLikes();
    const index = likes.findIndex((entry) => entry.journalId === like.journalId && entry.userId === like.userId);
    if (index >= 0) {
      likes[index] = structuredClone(like);
    } else {
      likes.unshift(structuredClone(like));
    }
    await this.#persistLikes();
    return structuredClone(like);
  }

  async removeLike(journalId: string, userId: string): Promise<boolean> {
    const likes = await this.#loadLikes();
    const nextLikes = likes.filter((entry) => !(entry.journalId === journalId && entry.userId === userId));
    if (nextLikes.length === likes.length) {
      return false;
    }
    this.#likes = nextLikes;
    await this.#persistLikes();
    return true;
  }

  async removeLikesByJournal(journalId: string): Promise<number> {
    const likes = await this.#loadLikes();
    const nextLikes = likes.filter((entry) => entry.journalId !== journalId);
    const removedCount = likes.length - nextLikes.length;
    if (removedCount === 0) {
      return 0;
    }
    this.#likes = nextLikes;
    await this.#persistLikes();
    return removedCount;
  }

  async reset(): Promise<void> {
    this.#journals = structuredClone(this.#seedJournals);
    this.#comments = structuredClone(this.#seedComments);
    this.#likes = structuredClone(this.#seedLikes);
    await Promise.all([this.#persistJournals(), this.#persistComments(), this.#persistLikes()]);
  }

  async #loadJournals(): Promise<JournalRecord[]> {
    if (this.#journals) {
      return this.#journals;
    }
    this.#journals = await this.#readArrayFile(this.#journalFilePath, this.#seedJournals);
    return this.#journals;
  }

  async #loadComments(): Promise<JournalCommentRecord[]> {
    if (this.#comments) {
      return this.#comments;
    }
    this.#comments = await this.#readArrayFile(this.#commentFilePath, this.#seedComments);
    return this.#comments;
  }

  async #loadLikes(): Promise<JournalLikeRecord[]> {
    if (this.#likes) {
      return this.#likes;
    }
    this.#likes = await this.#readArrayFile(this.#likeFilePath, this.#seedLikes);
    return this.#likes;
  }

  async #persistJournals(): Promise<void> {
    await this.#persistArrayFile(this.#journalFilePath, this.#journals ?? []);
  }

  async #persistComments(): Promise<void> {
    await this.#persistArrayFile(this.#commentFilePath, this.#comments ?? []);
  }

  async #persistLikes(): Promise<void> {
    await this.#persistArrayFile(this.#likeFilePath, this.#likes ?? []);
  }

  async #readArrayFile<T>(filePath: string, seed: T[]): Promise<T[]> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as T[];
    } catch (error) {
      const candidate = error as NodeJS.ErrnoException;
      if (candidate.code === "ENOENT") {
        return structuredClone(seed);
      }
      throw error;
    }
  }

  async #persistArrayFile<T>(filePath: string, items: T[]): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  }
}
