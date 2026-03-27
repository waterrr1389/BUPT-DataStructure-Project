import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

const { spawnSync } = require("node:child_process") as {
  spawnSync(
    command: string,
    args: string[],
    options: {
      cwd: string;
      encoding: "utf8";
    },
  ): {
    status: number | null;
    stderr?: string;
    stdout?: string;
  };
};
const fs = require("node:fs") as {
  mkdtempSync(prefix: string): string;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  rmSync(path: string, options: { force?: boolean; recursive?: boolean }): void;
  writeFileSync(path: string, data: string, encoding: "utf8"): void;
};

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRepoRelativePath(repoRoot: string, targetPath: string): string {
  const normalizedTargetPath = targetPath.replace(/\\/g, "/");
  const normalizedRepoRoot = repoRoot.replace(/\\/g, "/").replace(/\/$/, "");
  const repoPrefix = `${normalizedRepoRoot}/`;
  return normalizedTargetPath.startsWith(repoPrefix)
    ? normalizedTargetPath.slice(repoPrefix.length)
    : normalizedTargetPath;
}

test("browser build fails when first-party JavaScript is present under public", () => {
  const repoRoot = process.cwd();
  const publicRoot = path.join(repoRoot, "public");
  const tempDirectoryPath = fs.mkdtempSync(path.join(publicRoot, ".browser-build-guard-"));
  const illegalPublicPath = path.join(tempDirectoryPath, "illegal-first-party.js");

  try {
    fs.writeFileSync(illegalPublicPath, "console.log('unexpected runtime artifact');\n", "utf8");

    const result = spawnSync("node", [path.join("scripts", "browser-build.js")], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const illegalRelativePath = toRepoRelativePath(repoRoot, illegalPublicPath);

    assert.equal(
      result.status === 0,
      false,
      `Expected browser build guard failure for ${illegalRelativePath}.\n${output}`,
    );
    assert.equal(
      /Unexpected JavaScript files were found under public\/ outside the allowed third-party tree public\/vendor\//.test(
        output,
      ),
      true,
      output,
    );
    assert.equal(new RegExp(escapeRegExp(illegalRelativePath)).test(output), true, output);
  } finally {
    fs.rmSync(tempDirectoryPath, { recursive: true, force: true });
  }
});

test("browser build guard lists each unexpected public JavaScript path", () => {
  const repoRoot = process.cwd();
  const publicRoot = path.join(repoRoot, "public");
  const tempDirectoryPath = fs.mkdtempSync(path.join(publicRoot, ".browser-build-guard-"));
  const illegalFiles = [
    "illegal-first-party-a.js",
    path.join("nested", "illegal-first-party-b.js"),
  ].map((relativePath) => path.join(tempDirectoryPath, relativePath));

  try {
    for (const illegalFile of illegalFiles) {
      fs.mkdirSync(path.dirname(illegalFile), { recursive: true });
      fs.writeFileSync(illegalFile, "console.log('illegal first-party');\n", "utf8");
    }

    const result = spawnSync("node", [path.join("scripts", "browser-build.js")], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const illegalRelativePaths = illegalFiles.map((filePath) => toRepoRelativePath(repoRoot, filePath));

    assert.equal(
      result.status === 0,
      false,
      `Expected browser build guard failure for ${illegalRelativePaths.join(", ")}.\n${output}`,
    );
    assert.equal(
      /Unexpected JavaScript files were found under public\/ outside the allowed third-party tree public\/vendor\//.test(
        output,
      ),
      true,
      output,
    );

    for (const illegalRelativePath of illegalRelativePaths) {
      assert.equal(new RegExp(escapeRegExp(illegalRelativePath)).test(output), true, output);
    }
  } finally {
    fs.rmSync(tempDirectoryPath, { recursive: true, force: true });
  }
});
