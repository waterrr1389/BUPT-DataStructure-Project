import assert from "node:assert/strict";
import test from "node:test";

import {
  createSpaDomEnvironment,
  dispatchDomEvent,
  importSpaModule,
  requireElement,
  settleAsync,
} from "../support/spa-harness";
import {
  createPostDetailFixture,
  type PostDetailModule,
} from "../spa-regressions.test";

test("post detail keeps the initial comments request bounded and appends older comments on load more", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
    ]);
    assert.equal(root.querySelectorAll(".comment-card").length, 5);
    const mapContextEmptyState = requireElement(root, "#post-map-context .empty-state");
    assert.equal(root.innerHTML.includes("地图上下文是辅助信息"), true);
    assert.equal(
      root.innerHTML.includes("只有当空间细节对这篇笔记有帮助时，再打开辅助目的地图结构。"),
      true,
    );
    assert.equal(mapContextEmptyState.querySelector(".section-tag"), null);

    const loadMoreButton = requireElement(root, "#post-comments-more");
    dispatchDomEvent(loadMoreButton, "click");
    await settleAsync();

    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
      { cursor: "cursor-2", journalId: "journal-1", limit: 5 },
    ]);
    assert.equal(root.querySelectorAll(".comment-card").length, 10);

    const commentsContainer = requireElement(root, "#post-comments");
    assert.ok(commentsContainer.innerHTML.indexOf("Comment 1") < commentsContainer.innerHTML.indexOf("Comment 6"));
    assert.ok(commentsContainer.innerHTML.includes("Comment 10"));

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("posting a comment resets post detail comments back to the first page", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    dispatchDomEvent(requireElement(root, "#post-comments-more"), "click");
    await settleAsync();
    assert.equal(root.querySelectorAll(".comment-card").length, 10);

    const commentBody = requireElement(root, "#post-comment-body");
    commentBody.value = "A fresh detail note";
    dispatchDomEvent(requireElement(root, "#post-comment-form"), "submit");
    await settleAsync();

    assert.deepEqual(fixture.createCommentCalls, [
      { body: "A fresh detail note", journalId: "journal-1", userId: "user-2" },
    ]);
    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
      { cursor: "cursor-2", journalId: "journal-1", limit: 5 },
      { cursor: "", journalId: "journal-1", limit: 5 },
    ]);
    assert.equal(root.querySelectorAll(".comment-card").length, 5);

    const commentsContainer = requireElement(root, "#post-comments");
    assert.ok(commentsContainer.innerHTML.includes("Comment 1"));
    assert.ok(!commentsContainer.innerHTML.includes("Comment 10"));
    assert.deepEqual(fixture.detailCalls, [
      { journalId: "journal-1", viewerUserId: "user-2" },
      { journalId: "journal-1", viewerUserId: "user-2" },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail refreshes visible state after view and rate actions", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    const heroMeta = requireElement(root, "#post-hero-meta");
    assert.ok(heroMeta.innerHTML.includes("浏览 14"), heroMeta.innerHTML);
    assert.ok(heroMeta.innerHTML.includes("评分 4"), heroMeta.innerHTML);
    assert.ok(heroMeta.innerHTML.includes("1 个评分"), heroMeta.innerHTML);

    dispatchDomEvent(requireElement(root, "#post-view"), "click");
    await settleAsync();

    assert.deepEqual(fixture.actionCalls[0], {
      action: "view",
      journalId: "journal-1",
      userId: "user-2",
    });
    assert.equal(fixture.detailCalls.length, 2);
    assert.ok(heroMeta.innerHTML.includes("浏览 15"), heroMeta.innerHTML);

    dispatchDomEvent(requireElement(root, "#post-rate"), "click");
    await settleAsync();

    assert.deepEqual(fixture.actionCalls[1], {
      action: "rate",
      journalId: "journal-1",
      userId: "user-2",
    });
    assert.equal(fixture.detailCalls.length, 3);
    assert.ok(heroMeta.innerHTML.includes("评分 4.5"), heroMeta.innerHTML);
    assert.ok(heroMeta.innerHTML.includes("2 个评分"), heroMeta.innerHTML);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail preserves the current actor on compose links", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    const composeLink = root.querySelector("[data-compose-href='true']");
    assert.ok(composeLink);
    assert.equal(composeLink?.getAttribute("href"), "/compose?destinationId=dest-1&actor=user-2");

    const actorSelect = requireElement(root, "#post-actor");
    actorSelect.value = "user-1";
    dispatchDomEvent(actorSelect, "change");
    await settleAsync();

    assert.equal(composeLink?.getAttribute("href"), "/compose?destinationId=dest-1&actor=user-1");
    assert.deepEqual(fixture.navigateCalls[0], {
      href: "/posts/journal-1?actor=user-1",
      options: {
        preserveScroll: true,
        render: false,
        replace: true,
      },
    });

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail preserves actor-aware map and feed hand-offs, including delete return", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    const feedLink = requireElement(root, "[data-feed-href='true']");
    const mapLink = requireElement(root, "[data-map-href='true']");
    assert.equal(feedLink.getAttribute("href"), "/feed?actor=user-2");
    assert.equal(mapLink.getAttribute("href"), "/map?destinationId=dest-1&actor=user-2");

    const actorSelect = requireElement(root, "#post-actor");
    actorSelect.value = "user-1";
    dispatchDomEvent(actorSelect, "change");
    await settleAsync();

    assert.equal(feedLink.getAttribute("href"), "/feed?actor=user-1");
    assert.equal(mapLink.getAttribute("href"), "/map?destinationId=dest-1&actor=user-1");

    dispatchDomEvent(requireElement(root, "#post-delete"), "click");
    await settleAsync();

    assert.deepEqual(fixture.actionCalls[fixture.actionCalls.length - 1], {
      action: "delete",
      journalId: "journal-1",
      userId: "user-1",
    });
    assert.deepEqual(fixture.navigateCalls, [
      {
        href: "/posts/journal-1?actor=user-1",
        options: {
          preserveScroll: true,
          render: false,
          replace: true,
        },
      },
      {
        href: "/feed?actor=user-1",
        options: undefined,
      },
    ]);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});

test("post detail keeps the journal surface mounted when the initial comments load fails", async () => {
  const env = createSpaDomEnvironment();
  const restore = env.install();
  try {
    const root = env.createRoot();
    const module = await importSpaModule<PostDetailModule>("views/post-detail.js");
    const fixture = createPostDetailFixture();

    fixture.app.fetchJournalComments = async (journalId: string, options: { cursor?: string; limit?: number }) => {
      fixture.commentCalls.push({
        cursor: options.cursor ?? "",
        journalId,
        limit: Number(options.limit) || 0,
      });
      throw new Error("Comments service timed out.");
    };

    const cleanup = await module.render(
      fixture.app,
      {
        journalId: "journal-1",
        params: {
          actor: "user-2",
        },
      },
      root,
    );

    assert.deepEqual(fixture.commentCalls, [
      { cursor: "", journalId: "journal-1", limit: 5 },
    ]);
    assert.ok(root.innerHTML.includes('id="post-hero-title"'));
    assert.ok(root.innerHTML.includes('id="post-story-title"'));
    assert.ok(root.innerHTML.includes("Bridge Notes"));
    assert.ok(requireElement(root, "#post-comment-notice").innerHTML.includes("评论加载失败"));
    assert.ok(requireElement(root, "#post-comment-notice").innerHTML.includes("评论无法加载。"));
    assert.equal(requireElement(root, "#post-comment-notice").innerHTML.includes("Comments service timed out."), false);

    const commentsContainer = requireElement(root, "#post-comments");
    assert.ok(commentsContainer.innerHTML.includes("评论加载失败"));
    assert.ok(commentsContainer.innerHTML.includes("评论无法加载。"));
    assert.equal(commentsContainer.innerHTML.includes("Comments service timed out."), false);
    assert.equal(commentsContainer.innerHTML.includes("评论不可用"), false);
    assert.equal(
      commentsContainer.innerHTML.includes("当前工作区尚未提供后端评论接口。"),
      false,
    );
    assert.equal(root.innerHTML.includes("找不到这篇笔记。"), false);

    if (typeof cleanup === "function") {
      cleanup();
    }
  } finally {
    restore();
  }
});
