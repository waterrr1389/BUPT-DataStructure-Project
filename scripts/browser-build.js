#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");
const publicRoot = path.join(repoRoot, "public");
const runtimePublicRoot = path.join(distRoot, "public");
const publicVendorRoot = path.join(publicRoot, "vendor");
const browserBuildLockPath = path.join(repoRoot, ".browser-build.lock");
const browserBuildLockPollMs = 100;
const browserBuildLockTimeoutMs = 30000;
const diagnosticsStderrFd = (() => {
  try {
    const stderrStream = process.stderr;
    if (stderrStream && typeof stderrStream.fd === "number") {
      return stderrStream.fd;
    }
  } catch (error) {
    // ignore; fallback to standard descriptor
  }
  return 2;
})();
const managedBrowserBoundaries = [
  { kind: "file", sourcePath: path.join(publicRoot, "app.ts") },
  { kind: "tree", directoryPath: path.join(publicRoot, "spa") },
  { kind: "file", sourcePath: path.join(publicRoot, "journal-consumers.ts") },
  { kind: "file", sourcePath: path.join(publicRoot, "journal-presentation.ts") },
  { kind: "file", sourcePath: path.join(publicRoot, "route-visualization-markers.ts") },
];
const browserBuilds = [
  { name: "esm", config: "tsconfig.browser-esm.json" },
  { name: "script", config: "tsconfig.browser-script.json" },
];

function reportDiagnostics(message) {
  if (!message) {
    return;
  }

  const normalized = message.endsWith("\n") ? message : `${message}\n`;
  const buffer = Buffer.from(normalized, "utf8");
  fs.writeSync(diagnosticsStderrFd, buffer, 0, buffer.length);
}

function fail(message, exitCode = 1) {
  reportDiagnostics(message);

  const error = new Error(message);
  error.exitCode = exitCode;
  if (message) {
    error.diagnosticsReported = true;
  }
  throw error;
}

function getTscCommand() {
  const command = process.platform === "win32" ? "tsc.cmd" : "tsc";
  const localCommand = path.join(repoRoot, "node_modules", ".bin", command);
  return fs.existsSync(localCommand) ? localCommand : command;
}

function runTsc(args, options = {}) {
  const result = spawnSync(getTscCommand(), args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.captureOutput ? ["inherit", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    if (options.captureOutput) {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }

    const capturedOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    const summaryParts = [
      `tsc ${args.join(" ")} exited with code ${result.status ?? 1}.`,
    ];

    if (capturedOutput) {
      summaryParts.push(capturedOutput);
    }

    fail(summaryParts.join("\n\n"), result.status ?? 1);
  }

  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function listFiles(directoryPath, extension) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const filePaths = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...listFiles(entryPath, extension));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (extension == null) {
      filePaths.push(entryPath);
      continue;
    }

    if (extension === ".ts" && entryPath.endsWith(".ts") && !entryPath.endsWith(".d.ts")) {
      filePaths.push(entryPath);
      continue;
    }

    if (extension === ".js" && entryPath.endsWith(".js")) {
      filePaths.push(entryPath);
    }
  }

  return filePaths.sort();
}

function uniqueSorted(paths) {
  return Array.from(new Set(paths)).sort();
}

function isPathInsideTree(rootPath, targetPath) {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function readBuildLockPid() {
  try {
    const rawPid = fs.readFileSync(browserBuildLockPath, "utf8").trim();
    const pid = Number(rawPid);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function acquireBuildLock() {
  const waitStart = Date.now();

  while (true) {
    try {
      const lockHandle = fs.openSync(browserBuildLockPath, "wx");
      fs.writeFileSync(lockHandle, `${process.pid}\n`);
      return lockHandle;
    } catch (error) {
      if (error.code !== "EEXIST") {
        fail(`Unable to acquire browser build lock: ${error.message}`);
      }

      const lockPid = readBuildLockPid();
      if (lockPid !== null && !isProcessAlive(lockPid)) {
        try {
          fs.unlinkSync(browserBuildLockPath);
          continue;
        } catch (unlinkError) {
          if (unlinkError.code === "ENOENT") {
            continue;
          }
          fail(`Unable to clear stale browser build lock: ${unlinkError.message}`);
        }
      }

      if (Date.now() - waitStart >= browserBuildLockTimeoutMs) {
        const owner = lockPid === null ? "an unknown process" : `pid ${lockPid}`;
        fail(`Timed out waiting for browser build lock held by ${owner}.`);
      }

      sleep(browserBuildLockPollMs);
    }
  }
}

function releaseBuildLock(lockHandle) {
  if (lockHandle == null) {
    return;
  }

  fs.closeSync(lockHandle);

  try {
    fs.unlinkSync(browserBuildLockPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function listManagedSourcePaths() {
  const sourcePaths = [];

  for (const boundary of managedBrowserBoundaries) {
    if (boundary.kind === "file") {
      if (fs.existsSync(boundary.sourcePath) && fs.statSync(boundary.sourcePath).isFile()) {
        sourcePaths.push(boundary.sourcePath);
      }
      continue;
    }

    sourcePaths.push(...listFiles(boundary.directoryPath, ".ts"));
  }

  return uniqueSorted(sourcePaths);
}

function listManagedOutputPathsInRoot(outputRoot) {
  const outputPaths = [];

  for (const boundary of managedBrowserBoundaries) {
    if (boundary.kind === "file") {
      const outputPath = toOutputPath(boundary.sourcePath, outputRoot);
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).isFile()) {
        outputPaths.push(outputPath);
      }
      continue;
    }

    outputPaths.push(...listFiles(path.join(outputRoot, path.relative(publicRoot, boundary.directoryPath)), ".js"));
  }

  return uniqueSorted(outputPaths);
}

function getPublicRelativePath(targetPath) {
  return path.relative(publicRoot, targetPath);
}

function toOutputRelativePath(sourcePath) {
  return getPublicRelativePath(sourcePath).slice(0, -3) + ".js";
}

function toOutputPath(sourcePath, outputRoot = runtimePublicRoot) {
  return path.join(outputRoot, toOutputRelativePath(sourcePath));
}

function toSourcePath(outputPath, outputRoot = runtimePublicRoot) {
  return path.join(publicRoot, path.relative(outputRoot, outputPath).slice(0, -3) + ".ts");
}

function findMissingOutputs(sourcePaths, outputRoot) {
  return sourcePaths
    .map((sourcePath) => ({ sourcePath, outputPath: toOutputPath(sourcePath, outputRoot) }))
    .filter(({ outputPath }) => !fs.existsSync(outputPath));
}

function findOrphanOutputs(outputPaths, sourcePaths, outputRoot) {
  const sourceSet = new Set(sourcePaths);
  return outputPaths.filter((outputPath) => !sourceSet.has(toSourcePath(outputPath, outputRoot)));
}

function formatMissingOutputs(missingOutputs) {
  return missingOutputs
    .map(({ sourcePath, outputPath }) => {
      const relativeSource = path.relative(repoRoot, sourcePath);
      const relativeOutput = path.relative(repoRoot, outputPath);
      return `Missing emitted asset for ${relativeSource}: expected ${relativeOutput}`;
    })
    .join("\n");
}

function formatOrphanOutputs(orphanOutputs, outputRoot, label) {
  const details = orphanOutputs
    .map((outputPath) => {
      const relativeOutput = path.relative(repoRoot, outputPath);
      const relativeSource = path.relative(repoRoot, toSourcePath(outputPath, outputRoot));
      return `${relativeOutput} has no matching TypeScript source at ${relativeSource}`;
    })
    .join("\n");

  return `${label}\n${details}`;
}

function isManagedOutputRelativePath(relativePath, sourcePaths) {
  const managedOutputs = new Set(sourcePaths.map((sourcePath) => toOutputRelativePath(sourcePath)));
  return managedOutputs.has(relativePath);
}

function isAllowedPublicJavaScriptPath(filePath) {
  return isPathInsideTree(publicVendorRoot, filePath);
}

function listUnexpectedPublicJavaScriptPaths() {
  return listFiles(publicRoot, ".js").filter((filePath) => !isAllowedPublicJavaScriptPath(filePath));
}

function formatUnexpectedPublicJavaScriptPaths(filePaths) {
  const details = filePaths
    .map((filePath) => path.relative(repoRoot, filePath))
    .join("\n");

  return [
    "Unexpected JavaScript files were found under public/ outside the allowed third-party tree public/vendor/:",
    details,
  ].join("\n");
}

function listStaticAssetSourcePaths(sourcePaths) {
  return listFiles(publicRoot, null).filter((filePath) => {
    if (filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
      return false;
    }

    if (filePath.endsWith(".js")) {
      return isAllowedPublicJavaScriptPath(filePath);
    }

    return !isManagedOutputRelativePath(getPublicRelativePath(filePath), sourcePaths);
  });
}

function copyFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function copyStaticAssets(sourcePaths, outputRoot) {
  const staticAssetSourcePaths = listStaticAssetSourcePaths(sourcePaths);

  for (const sourcePath of staticAssetSourcePaths) {
    copyFile(sourcePath, path.join(outputRoot, getPublicRelativePath(sourcePath)));
  }

  return staticAssetSourcePaths;
}

function formatMissingStaticAssets(missingStaticAssets) {
  return missingStaticAssets
    .map((assetPath) => {
      const relativeOutput = path.relative(repoRoot, assetPath);
      return `Missing copied runtime asset: expected ${relativeOutput}`;
    })
    .join("\n");
}

function findMissingStaticAssets(staticAssetSourcePaths, outputRoot) {
  return staticAssetSourcePaths
    .map((sourcePath) => path.join(outputRoot, getPublicRelativePath(sourcePath)))
    .filter((assetPath) => !fs.existsSync(assetPath));
}

function listReferencedPublicAssetPaths(outputRoot) {
  const indexPath = path.join(outputRoot, "index.html");

  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const referencedAssets = new Set();
  const assetPattern = /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi;

  for (const match of html.matchAll(assetPattern)) {
    const assetPath = match[1];

    if (!assetPath || !assetPath.startsWith("/")) {
      continue;
    }

    referencedAssets.add(path.join(outputRoot, assetPath.slice(1)));
  }

  return [...referencedAssets].sort();
}

function formatMissingReferencedAssets(missingReferencedAssets) {
  return missingReferencedAssets
    .map((assetPath) => {
      const relativeOutput = path.relative(repoRoot, assetPath);
      return `Runtime entrypoint references a missing asset: ${relativeOutput}`;
    })
    .join("\n");
}

function findMissingRequiredAssets(outputRoot) {
  return ["index.html"]
    .map((relativePath) => path.join(outputRoot, relativePath))
    .filter((assetPath) => !fs.existsSync(assetPath));
}

function verifyOutputs(sourcePaths, staticAssetSourcePaths, outputRoot) {
  const failures = [];
  const missingOutputs = findMissingOutputs(sourcePaths, outputRoot);

  if (missingOutputs.length > 0) {
    failures.push(formatMissingOutputs(missingOutputs));
  }

  const postBuildOrphans = findOrphanOutputs(listManagedOutputPathsInRoot(outputRoot), sourcePaths, outputRoot);

  if (postBuildOrphans.length > 0) {
    failures.push(
      formatOrphanOutputs(
        postBuildOrphans,
        outputRoot,
        "Managed browser JavaScript exists after rebuild without a matching TypeScript source of truth:"
      )
    );
  }

  const missingRequiredAssets = findMissingRequiredAssets(outputRoot);

  if (missingRequiredAssets.length > 0) {
    failures.push(formatMissingStaticAssets(missingRequiredAssets));
  }

  const missingStaticAssets = findMissingStaticAssets(staticAssetSourcePaths, outputRoot);

  if (missingStaticAssets.length > 0) {
    failures.push(formatMissingStaticAssets(missingStaticAssets));
  }

  const missingReferencedAssets = listReferencedPublicAssetPaths(outputRoot).filter(
    (assetPath) => !fs.existsSync(assetPath),
  );

  if (missingReferencedAssets.length > 0) {
    failures.push(formatMissingReferencedAssets(missingReferencedAssets));
  }

  if (failures.length > 0) {
    fail(failures.join("\n\n"));
  }
}

function ensureEmptyDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
  fs.mkdirSync(directoryPath, { recursive: true });
}

function removeDirectoryIfPresent(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

function activateRuntimeTree(stagingRoot) {
  const backupRoot = path.join(distRoot, ".public-backup");
  const hasExistingRuntimeTree = fs.existsSync(runtimePublicRoot);

  removeDirectoryIfPresent(backupRoot);

  if (hasExistingRuntimeTree) {
    fs.renameSync(runtimePublicRoot, backupRoot);
  }

  try {
    fs.renameSync(stagingRoot, runtimePublicRoot);
  } catch (error) {
    if (hasExistingRuntimeTree && fs.existsSync(backupRoot) && !fs.existsSync(runtimePublicRoot)) {
      fs.renameSync(backupRoot, runtimePublicRoot);
    }
    throw error;
  }

  removeDirectoryIfPresent(backupRoot);
}

function main() {
  let buildLockHandle = null;
  const stagingRoot = path.join(distRoot, `.public-staging-${process.pid}`);
  let exitCode = 0;

  try {
    buildLockHandle = acquireBuildLock();
    const sourcePaths = listManagedSourcePaths();

    if (sourcePaths.length === 0) {
      fail("No browser TypeScript sources were resolved for browser build verification.");
    }

    const unexpectedPublicJavaScriptPaths = listUnexpectedPublicJavaScriptPaths();

    if (unexpectedPublicJavaScriptPaths.length > 0) {
      fail(formatUnexpectedPublicJavaScriptPaths(unexpectedPublicJavaScriptPaths));
    }

    ensureEmptyDirectory(stagingRoot);
    const staticAssetSourcePaths = copyStaticAssets(sourcePaths, stagingRoot);

    for (const build of browserBuilds) {
      console.log(`Compiling browser ${build.name} sources with ${build.config}`);
      runTsc(["-p", build.config, "--rootDir", publicRoot, "--outDir", stagingRoot]);
    }

    verifyOutputs(sourcePaths, staticAssetSourcePaths, stagingRoot);
    activateRuntimeTree(stagingRoot);
    verifyOutputs(sourcePaths, staticAssetSourcePaths, runtimePublicRoot);

    console.log(
      `Verified ${sourcePaths.length} browser runtime assets and ${staticAssetSourcePaths.length} copied static assets.`,
    );
  } catch (error) {
    exitCode = error?.exitCode ?? 1;
    removeDirectoryIfPresent(stagingRoot);
    if (!error?.diagnosticsReported && error?.message) {
      reportDiagnostics(error.message);
    }
  } finally {
    try {
      releaseBuildLock(buildLockHandle);
    } catch (error) {
      if (exitCode === 0) {
        throw error;
      }
      const lockReleaseMessage = error?.message ?? String(error);
      reportDiagnostics(`Unable to release browser build lock: ${lockReleaseMessage}`);
    }
  }

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

main();
