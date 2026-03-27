import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_PUBLIC_ROOT = path.join(process.cwd(), "dist", "public");

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/^\/+/, "");
}

function createMissingAssetError(relativePath: string, _cause: NodeJS.ErrnoException): Error {
  const normalizedPath = normalizeRelativePath(relativePath).replace(/\\/g, "/");
  return new Error(
    `Missing built browser asset at dist/public/${normalizedPath}. Run npm run build before browser contract tests.`,
  );
}

export function getRuntimePublicRoot(): string {
  return RUNTIME_PUBLIC_ROOT;
}

export function getRuntimePublicAssetPath(relativePath: string): string {
  return path.join(RUNTIME_PUBLIC_ROOT, normalizeRelativePath(relativePath));
}

export async function readRuntimePublicTextAsset(relativePath: string): Promise<string> {
  try {
    return await fs.readFile(getRuntimePublicAssetPath(relativePath), "utf8");
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException;
    if (candidate.code === "ENOENT") {
      throw createMissingAssetError(relativePath, candidate);
    }
    throw error;
  }
}
