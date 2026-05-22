import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createAppServices, type AppServices } from "../src/services/index";

function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function createIsolatedApp(name: string): Promise<AppServices> {
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-runtime-services-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await fs.mkdir(runtimeDir, { recursive: true });
  const app = await createAppServices({ runtimeDir });
  await app.journalStore.reset();
  return app;
}

async function writeUploadedImage(runtimeDir: string, fileName: string): Promise<void> {
  const uploadDir = path.join(runtimeDir, "uploads", "images");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), "test image bytes");
}

test("journal deletion removes plain and media comments", async () => {
  const app = await createIsolatedApp("journal-delete-comment-media");
  const created = await app.journals.create({
    body: "Indoor archive route with comments that should be removed with the parent journal.",
    destinationId: "dest-002",
    tags: ["indoor", "cleanup"],
    title: "North Institute comment cleanup route",
    userId: "user-2",
  });
  const imageFileName = "image-77777777-7777-7777-7777-777777777777.webp";
  await writeUploadedImage(app.runtime.runtimeDir, imageFileName);

  const plainComment = await app.journals.createComment(created.id, {
    body: "Plain comment should be removed.",
    userId: "user-5",
  });
  const mediaComment = await app.journals.createComment(created.id, {
    body: "Image comment should be removed.",
    media: [
      {
        type: "image",
        title: "Cleanup image",
        source: `/uploads/images/${imageFileName}`,
      },
    ],
    userId: "user-6",
  });
  const beforeDelete = await app.journals.listComments({
    journalId: created.id,
    limit: 10,
  });

  await app.journals.delete(created.id);
  const storedComments = await app.journalStore.listComments(created.id);

  assert.equal(beforeDelete.totalCount, 2, format(beforeDelete));
  assert.equal(
    beforeDelete.items.some((item) => item.id === plainComment.id),
    true,
    format(beforeDelete),
  );
  assert.equal(
    beforeDelete.items.some((item) => item.id === mediaComment.id && item.media.length === 1),
    true,
    format(beforeDelete),
  );
  assert.deepEqual(storedComments, []);
});
