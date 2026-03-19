import { averageRating, excerpt } from "./fallback-algorithms";
import {
  assertNonEmpty,
  dedupeTags,
  ensureLimit,
  findDestination,
  findUser,
  scoreJournal,
} from "./service-helpers";
import type {
  CursorPage,
  JournalCommentCreateInput,
  JournalCommentListQuery,
  JournalCommentRecord,
  JournalCommentView,
  JournalCreateInput,
  JournalDetailRecord,
  JournalFeedItem,
  JournalFeedQuery,
  JournalLikeRecord,
  JournalRecord,
  JournalUpdateInput,
} from "./contracts";
import type { JournalStore } from "./journal-store";
import type { ResolvedRuntime } from "./runtime";

const COMMENT_CURSOR_KIND = "comment";
const FEED_CURSOR_KIND = "feed";

type JournalListOptions = {
  destinationId?: string;
  userId?: string;
  limit?: number;
  viewerUserId?: string;
};

type SocialMaps = {
  commentCountByJournal: Map<string, number>;
  likeCountByJournal: Map<string, number>;
  likedUsersByJournal: Map<string, Set<string>>;
};

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

function nextCommentId(comments: JournalCommentRecord[]): string {
  const maxId = comments.reduce((max, comment) => {
    const value = Number.parseInt(comment.id.replace("comment-", ""), 10);
    return Number.isNaN(value) ? max : Math.max(max, value);
  }, 0);
  return `comment-${maxId + 1}`;
}

function compareDescendingIds(leftId: string, rightId: string): number {
  const leftNumber = Number.parseInt(leftId.match(/(\d+)$/)?.[1] ?? "", 10);
  const rightNumber = Number.parseInt(rightId.match(/(\d+)$/)?.[1] ?? "", 10);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
    return rightNumber - leftNumber;
  }
  return rightId.localeCompare(leftId);
}

function sortJournalsByUpdatedAt(left: JournalRecord, right: JournalRecord): number {
  const timestampOrder = right.updatedAt.localeCompare(left.updatedAt);
  return timestampOrder !== 0 ? timestampOrder : compareDescendingIds(left.id, right.id);
}

function sortJournalsByCreatedAt(left: JournalRecord, right: JournalRecord): number {
  const timestampOrder = right.createdAt.localeCompare(left.createdAt);
  return timestampOrder !== 0 ? timestampOrder : compareDescendingIds(left.id, right.id);
}

function sortComments(left: JournalCommentRecord, right: JournalCommentRecord): number {
  const timestampOrder = right.createdAt.localeCompare(left.createdAt);
  return timestampOrder !== 0 ? timestampOrder : compareDescendingIds(left.id, right.id);
}

function encodeCursor(kind: string, stamp: string, id: string): string {
  return btoa(`${kind}|${stamp}|${id}`);
}

function decodeCursor(kind: string, cursor: string): { stamp: string; id: string } {
  try {
    const decoded = atob(cursor);
    const [cursorKind, stamp, id] = decoded.split("|");
    if (cursorKind !== kind || !stamp || !id) {
      throw new Error("Invalid cursor.");
    }
    return { stamp, id };
  } catch {
    throw new Error("Invalid cursor.");
  }
}

function compareDescendingStampedIds(leftStamp: string, leftId: string, rightStamp: string, rightId: string): number {
  const stampOrder = rightStamp.localeCompare(leftStamp);
  return stampOrder !== 0 ? stampOrder : compareDescendingIds(leftId, rightId);
}

function resolveCursorIndex<T extends { id: string }>(
  items: T[],
  cursor: string | undefined,
  kind: string,
  stampOf: (item: T) => string,
): number {
  if (!cursor) {
    return 0;
  }

  const decoded = decodeCursor(kind, cursor);
  const index = items.findIndex((item) => item.id === decoded.id && stampOf(item) === decoded.stamp);
  if (index >= 0) {
    return index + 1;
  }

  const insertionIndex = items.findIndex(
    (item) => compareDescendingStampedIds(stampOf(item), item.id, decoded.stamp, decoded.id) > 0,
  );
  return insertionIndex >= 0 ? insertionIndex : items.length;
}

function nextCursorForPage<T extends { id: string }>(
  items: T[],
  startIndex: number,
  limit: number,
  kind: string,
  stampOf: (item: T) => string,
): string | null {
  if (startIndex + limit >= items.length) {
    return null;
  }
  const lastItem = items[startIndex + limit - 1];
  if (!lastItem) {
    return null;
  }
  return encodeCursor(kind, stampOf(lastItem), lastItem.id);
}

function buildSocialMaps(comments: JournalCommentRecord[], likes: JournalLikeRecord[]): SocialMaps {
  const commentCountByJournal = new Map<string, number>();
  for (const comment of comments) {
    commentCountByJournal.set(comment.journalId, (commentCountByJournal.get(comment.journalId) ?? 0) + 1);
  }

  const likeCountByJournal = new Map<string, number>();
  const likedUsersByJournal = new Map<string, Set<string>>();
  for (const like of likes) {
    likeCountByJournal.set(like.journalId, (likeCountByJournal.get(like.journalId) ?? 0) + 1);
    const bucket = likedUsersByJournal.get(like.journalId) ?? new Set<string>();
    bucket.add(like.userId);
    likedUsersByJournal.set(like.journalId, bucket);
  }

  return {
    commentCountByJournal,
    likeCountByJournal,
    likedUsersByJournal,
  };
}

function summarizeBody(body: string): string {
  const normalized = body.trim();
  const summary = excerpt(normalized, []).trim();
  if (summary.length === 0) {
    return normalized;
  }
  return summary.length < normalized.length ? `${summary}...` : summary;
}

function destinationLabel(runtime: ResolvedRuntime, destinationId: string): string {
  return runtime.lookups.destinationById.get(destinationId)?.name ?? destinationId;
}

function userLabel(runtime: ResolvedRuntime, userId: string): string {
  return runtime.lookups.userById.get(userId)?.name ?? userId;
}

function viewerHasLiked(maps: SocialMaps, journalId: string, viewerUserId?: string): boolean {
  if (!viewerUserId) {
    return false;
  }
  return maps.likedUsersByJournal.get(journalId)?.has(viewerUserId) ?? false;
}

function buildJournalDetail(
  runtime: ResolvedRuntime,
  journal: JournalRecord,
  maps: SocialMaps,
  viewerUserId?: string,
): JournalDetailRecord {
  return {
    ...journal,
    averageRating: averageRating(journal.ratings),
    summaryBody: summarizeBody(journal.body),
    destinationLabel: destinationLabel(runtime, journal.destinationId),
    userLabel: userLabel(runtime, journal.userId),
    likeCount: maps.likeCountByJournal.get(journal.id) ?? 0,
    commentCount: maps.commentCountByJournal.get(journal.id) ?? 0,
    viewerHasLiked: viewerHasLiked(maps, journal.id, viewerUserId),
  };
}

function buildFeedItem(
  runtime: ResolvedRuntime,
  journal: JournalRecord,
  maps: SocialMaps,
  viewerUserId?: string,
): JournalFeedItem {
  return {
    id: journal.id,
    userId: journal.userId,
    userLabel: userLabel(runtime, journal.userId),
    destinationId: journal.destinationId,
    destinationLabel: destinationLabel(runtime, journal.destinationId),
    title: journal.title,
    summaryBody: summarizeBody(journal.body),
    tags: [...journal.tags],
    createdAt: journal.createdAt,
    updatedAt: journal.updatedAt,
    views: journal.views,
    averageRating: averageRating(journal.ratings),
    likeCount: maps.likeCountByJournal.get(journal.id) ?? 0,
    commentCount: maps.commentCountByJournal.get(journal.id) ?? 0,
    viewerHasLiked: viewerHasLiked(maps, journal.id, viewerUserId),
    mediaCount: journal.media.length,
  };
}

function buildCommentView(runtime: ResolvedRuntime, comment: JournalCommentRecord): JournalCommentView {
  return {
    ...comment,
    userLabel: userLabel(runtime, comment.userId),
  };
}

function filterJournals(
  journals: JournalRecord[],
  options: { destinationId?: string; userId?: string },
): JournalRecord[] {
  return journals
    .filter((journal) => (options.destinationId ? journal.destinationId === options.destinationId : true))
    .filter((journal) => (options.userId ? journal.userId === options.userId : true));
}

function requireKnownUser(runtime: ResolvedRuntime, userId: string, errorMessage = "User is required.") {
  const user = findUser(runtime.seedData.users, assertNonEmpty(userId, errorMessage));
  if (!user) {
    throw new Error(`Unknown user: ${userId}`);
  }
  return user;
}

export function createJournalService(runtime: ResolvedRuntime, store: JournalStore) {
  async function loadViewerUserId(viewerUserId?: string): Promise<string | undefined> {
    if (!viewerUserId) {
      return undefined;
    }
    return requireKnownUser(runtime, viewerUserId, "Viewer user is required.").id;
  }

  async function loadJournal(journalId: string): Promise<JournalRecord> {
    const journal = await store.get(journalId);
    if (!journal) {
      throw new Error(`Unknown journal: ${journalId}`);
    }
    return journal;
  }

  async function loadSocialMaps(options: { journalId?: string } = {}): Promise<SocialMaps> {
    const [comments, likes] = await Promise.all([
      store.listComments(options.journalId),
      store.listLikes(options.journalId ? { journalId: options.journalId } : {}),
    ]);
    return buildSocialMaps(comments, likes);
  }

  async function getJournalDetail(journalId: string, viewerUserId?: string): Promise<JournalDetailRecord> {
    const resolvedViewerUserId = await loadViewerUserId(viewerUserId);
    const [journal, maps] = await Promise.all([loadJournal(journalId), loadSocialMaps({ journalId })]);
    return buildJournalDetail(runtime, journal, maps, resolvedViewerUserId);
  }

  return {
    async list(options: JournalListOptions = {}) {
      const limit = ensureLimit(options.limit, 12, 60);
      const resolvedViewerUserId = await loadViewerUserId(options.viewerUserId);
      const [journals, maps] = await Promise.all([store.list(), loadSocialMaps()]);
      return filterJournals(journals, options)
        .sort(sortJournalsByUpdatedAt)
        .slice(0, limit)
        .map((journal) => buildJournalDetail(runtime, journal, maps, resolvedViewerUserId));
    },

    async feed(options: JournalFeedQuery = {}): Promise<CursorPage<JournalFeedItem>> {
      const limit = ensureLimit(options.limit, 12, 40, { strictMax: true });
      const resolvedViewerUserId = await loadViewerUserId(options.viewerUserId);
      const [journals, maps] = await Promise.all([store.list(), loadSocialMaps()]);
      const filtered = filterJournals(journals, options).sort(sortJournalsByCreatedAt);
      const startIndex = resolveCursorIndex(filtered, options.cursor, FEED_CURSOR_KIND, (journal) => journal.createdAt);
      const items = filtered
        .slice(startIndex, startIndex + limit)
        .map((journal) => buildFeedItem(runtime, journal, maps, resolvedViewerUserId));

      return {
        items,
        nextCursor: nextCursorForPage(filtered, startIndex, limit, FEED_CURSOR_KIND, (journal) => journal.createdAt),
        totalCount: filtered.length,
      };
    },

    async get(journalId: string, options: { viewerUserId?: string } = {}) {
      return getJournalDetail(journalId, options.viewerUserId);
    },

    async create(input: JournalCreateInput) {
      const user = requireKnownUser(runtime, input.userId, "Journal author is required.");
      const destination = findDestination(
        runtime.seedData.destinations,
        assertNonEmpty(input.destinationId, "Destination is required."),
      );
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
      return buildJournalDetail(runtime, journal, buildSocialMaps([], []));
    },

    async update(journalId: string, input: JournalUpdateInput) {
      const [existing, maps] = await Promise.all([loadJournal(journalId), loadSocialMaps({ journalId })]);
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
      return buildJournalDetail(runtime, updated, maps);
    },

    async delete(journalId: string) {
      const removed = await store.remove(journalId);
      if (!removed) {
        throw new Error(`Unknown journal: ${journalId}`);
      }
      await Promise.all([store.removeCommentsByJournal(journalId), store.removeLikesByJournal(journalId)]);
      return { deleted: true };
    },

    async recordView(journalId: string) {
      const [journal, maps] = await Promise.all([loadJournal(journalId), loadSocialMaps({ journalId })]);
      const updated = {
        ...journal,
        views: journal.views + 1,
      };
      await store.upsert(updated);
      return buildJournalDetail(runtime, updated, maps);
    },

    async rate(journalId: string, userId: string, score: number) {
      const user = requireKnownUser(runtime, userId);
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error("Journal score must be an integer between 1 and 5.");
      }
      const [journal, maps] = await Promise.all([loadJournal(journalId), loadSocialMaps({ journalId })]);
      if (journal.ratings.some((rating) => rating.userId === user.id)) {
        throw new Error(`User ${user.id} has already rated journal ${journalId}.`);
      }
      const updated = {
        ...journal,
        ratings: [...journal.ratings, { userId: user.id, score }],
        updatedAt: nowIso(),
      };
      await store.upsert(updated);
      return buildJournalDetail(runtime, updated, maps, user.id);
    },

    async recommend(options: { userId?: string; destinationId?: string; limit?: number } = {}) {
      const limit = ensureLimit(options.limit, 6, 24);
      const user = findUser(runtime.seedData.users, options.userId);
      const destinationName = options.destinationId
        ? findDestination(runtime.seedData.destinations, options.destinationId).name
        : "";
      const [journals, maps] = await Promise.all([store.list(), loadSocialMaps()]);
      return runtime.algorithms.recommendation
        .topK(
          journals.filter((journal) => (options.destinationId ? journal.destinationId === options.destinationId : true)),
          limit,
          (journal) => scoreJournal(journal, user, destinationName),
        )
        .map((journal) => buildJournalDetail(runtime, journal, maps, user?.id));
    },

    async listComments(query: JournalCommentListQuery): Promise<CursorPage<JournalCommentView>> {
      await loadJournal(query.journalId);
      const limit = ensureLimit(query.limit, 20, 50, { strictMax: true });
      const comments = (await store.listComments(query.journalId)).sort(sortComments);
      const startIndex = resolveCursorIndex(comments, query.cursor, COMMENT_CURSOR_KIND, (comment) => comment.createdAt);
      const items = comments
        .slice(startIndex, startIndex + limit)
        .map((comment) => buildCommentView(runtime, comment));

      return {
        items,
        nextCursor: nextCursorForPage(comments, startIndex, limit, COMMENT_CURSOR_KIND, (comment) => comment.createdAt),
        totalCount: comments.length,
      };
    },

    async createComment(journalId: string, input: JournalCommentCreateInput) {
      const user = requireKnownUser(runtime, input.userId);
      const journal = await loadJournal(journalId);
      const comments = await store.listComments();
      const timestamp = nowIso();
      const comment: JournalCommentRecord = {
        id: nextCommentId(comments),
        journalId: journal.id,
        userId: user.id,
        body: assertNonEmpty(input.body, "Comment body is required."),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await store.upsertComment(comment);
      return buildCommentView(runtime, comment);
    },

    async deleteComment(commentId: string, userId: string) {
      const user = requireKnownUser(runtime, userId);
      const comment = await store.getComment(commentId);
      if (!comment) {
        throw new Error(`Unknown comment: ${commentId}`);
      }
      if (comment.userId !== user.id) {
        throw new Error(`User ${user.id} cannot delete comment ${commentId}.`);
      }
      await store.removeComment(commentId);
      return { deleted: true };
    },

    async like(journalId: string, userId: string) {
      const user = requireKnownUser(runtime, userId);
      const journal = await loadJournal(journalId);
      const existing = await store.getLike(journalId, user.id);
      if (existing) {
        throw new Error(`User ${user.id} has already liked journal ${journalId}.`);
      }

      const timestamp = nowIso();
      await store.upsertLike({
        journalId: journal.id,
        userId: user.id,
        createdAt: timestamp,
      });
      return getJournalDetail(journalId, user.id);
    },

    async unlike(journalId: string, userId: string) {
      const user = requireKnownUser(runtime, userId);
      await loadJournal(journalId);
      const removed = await store.removeLike(journalId, user.id);
      if (!removed) {
        throw new Error(`User ${user.id} has not liked journal ${journalId}.`);
      }
      return getJournalDetail(journalId, user.id);
    },
  };
}
