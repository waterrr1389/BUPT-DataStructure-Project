import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { worldData } from "../src/data/seed";

const worldMapAssetRelativePath = "assets/world-map/atlas-boston-inspired-v1.png";

function decodePngDimensions(content: Buffer): { height: number; width: number } {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  assert.equal(content.length >= 24, true, "PNG content is too small to include an IHDR header.");
  signature.forEach((byte, index) => {
    assert.equal(content[index], byte, "World map asset must be a PNG file.");
  });
  assert.equal(content.subarray(12, 16).toString("ascii"), "IHDR");
  const readUInt32BigEndian = (offset: number) =>
    ((content[offset] ?? 0) * 0x1000000) +
    ((content[offset + 1] ?? 0) << 16) +
    ((content[offset + 2] ?? 0) << 8) +
    (content[offset + 3] ?? 0);
  return {
    width: readUInt32BigEndian(16),
    height: readUInt32BigEndian(20),
  };
}

async function readPngDimensions(filePath: string): Promise<{ height: number; width: number }> {
  return decodePngDimensions(await fs.readFile(filePath));
}

test("world map background asset matches configured world coordinate bounds", async () => {
  const sourcePath = path.join(process.cwd(), "public", worldMapAssetRelativePath);
  const dimensions = await readPngDimensions(sourcePath);

  assert.deepEqual(dimensions, {
    width: worldData.width,
    height: worldData.height,
  });
  assert.equal(worldData.backgroundImage, `/${worldMapAssetRelativePath}`);
});

test("browser build copies the world map PNG asset into the runtime public tree", async () => {
  const builtPath = path.join(process.cwd(), "dist", "public", worldMapAssetRelativePath);
  const dimensions = await readPngDimensions(builtPath);

  assert.equal(path.extname(builtPath), ".png");
  assert.deepEqual(dimensions, {
    width: worldData.width,
    height: worldData.height,
  });
});
