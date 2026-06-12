import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { destinationById, worldData } from "../src/data/seed";

const worldMapAssetRelativePath = "assets/world-map/atlas-boston-inspired-v1.png";
const generatorRelativePath = "scripts/world-map-asset-generator.js";
const generatedWorldMapAssetSha256 = "34503567becfa0451454a5c05ec6c830b0649b56043c58fc4d7a07db2821208d";

type WorldMapAssetGenerator = {
  WORLD_MAP_ASSET_CONTRACT: {
    allowedTraceTypes: string[];
    assetPath: string;
    forbiddenTraceTypes: string[];
    height: number;
    textCommandsAllowed: boolean;
    width: number;
  };
  createWorldMapPng(): {
    buffer: Buffer;
    trace: Array<Record<string, unknown>>;
  };
};

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

function sha256(content: Buffer): string {
  return (createHash("sha256") as { update(data: Buffer): { digest(encoding: "hex"): string } })
    .update(content)
    .digest("hex");
}

function loadWorldMapAssetGenerator(): WorldMapAssetGenerator {
  return require(path.join(process.cwd(), generatorRelativePath)) as WorldMapAssetGenerator;
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

test("world map background asset is generated from text-free raster primitives", async () => {
  const sourcePath = path.join(process.cwd(), "public", worldMapAssetRelativePath);
  const generatorSource = await fs.readFile(path.join(process.cwd(), generatorRelativePath), "utf8");
  const generator = loadWorldMapAssetGenerator();
  const generated = generator.createWorldMapPng();
  const sourceContent = await fs.readFile(sourcePath);
  const contract = generator.WORLD_MAP_ASSET_CONTRACT;
  const allowedTraceTypes = new Set(contract.allowedTraceTypes);
  const forbiddenTraceTypes = new Set(contract.forbiddenTraceTypes);

  assert.equal(contract.assetPath, path.join("public", worldMapAssetRelativePath));
  assert.equal(contract.width, worldData.width);
  assert.equal(contract.height, worldData.height);
  assert.equal(contract.textCommandsAllowed, false);
  assert.equal(generated.trace.length > 0, true);
  for (const entry of generated.trace) {
    const type = String(entry.type ?? "");
    assert.equal(allowedTraceTypes.has(type), true, `Unexpected world map generator primitive: ${type}`);
    assert.equal(forbiddenTraceTypes.has(type), false, `Forbidden text primitive reached generator trace: ${type}`);
    assert.equal(Object.keys(entry).some((key) => /text|label|font|glyph|caption/i.test(key)), false);
  }
  for (const destination of destinationById.values()) {
    assert.equal(generatorSource.includes(destination.name), false, `Generator source includes destination name: ${destination.name}`);
  }
  assert.equal(/fillText|strokeText|measureText|font\s*=|drawText|renderText/.test(generatorSource), false);
  assert.equal(sha256(generated.buffer), generatedWorldMapAssetSha256);
  assert.equal(sha256(sourceContent), generatedWorldMapAssetSha256);
});

test("browser build copies the world map PNG asset into the runtime public tree", async () => {
  const builtPath = path.join(process.cwd(), "dist", "public", worldMapAssetRelativePath);
  const builtContent = await fs.readFile(builtPath);
  const dimensions = decodePngDimensions(builtContent);

  assert.equal(path.extname(builtPath), ".png");
  assert.equal(sha256(builtContent), generatedWorldMapAssetSha256);
  assert.deepEqual(dimensions, {
    width: worldData.width,
    height: worldData.height,
  });
});
