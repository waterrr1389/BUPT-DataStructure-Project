#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(repoRoot, "public");
const browserBuildLockPath = path.join(repoRoot, ".browser-build.lock");
const browserBuildLockPollMs = 100;
const browserBuildLockTimeoutMs = 30000;
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

function fail(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
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
    fail("", result.status ?? 1);
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

function listManagedOutputPaths() {
  const outputPaths = [];

  for (const boundary of managedBrowserBoundaries) {
    if (boundary.kind === "file") {
      const outputPath = toOutputPath(boundary.sourcePath);
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).isFile()) {
        outputPaths.push(outputPath);
      }
      continue;
    }

    outputPaths.push(...listFiles(boundary.directoryPath, ".js"));
  }

  return uniqueSorted(outputPaths);
}

function toOutputPath(sourcePath) {
  return sourcePath.slice(0, -3) + ".js";
}

function toSourcePath(outputPath) {
  return outputPath.slice(0, -3) + ".ts";
}

function removeManagedOutputs(outputPaths) {
  for (const outputPath of outputPaths) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }
}

function snapshotManagedOutputs(outputPaths) {
  const outputSnapshots = new Map();

  for (const outputPath of outputPaths) {
    if (fs.existsSync(outputPath)) {
      outputSnapshots.set(outputPath, fs.readFileSync(outputPath));
    }
  }

  return outputSnapshots;
}

function restoreManagedOutputs(outputSnapshots) {
  const managedOutputPaths = listManagedOutputPaths();
  removeManagedOutputs(managedOutputPaths);

  for (const [outputPath, content] of outputSnapshots.entries()) {
    fs.writeFileSync(outputPath, content);
  }
}

function findMissingOutputs(sourcePaths) {
  return sourcePaths
    .map((sourcePath) => ({ sourcePath, outputPath: toOutputPath(sourcePath) }))
    .filter(({ outputPath }) => !fs.existsSync(outputPath));
}

function findOrphanOutputs(outputPaths, sourcePaths) {
  const sourceSet = new Set(sourcePaths);
  return outputPaths.filter((outputPath) => !sourceSet.has(toSourcePath(outputPath)));
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

function formatOrphanOutputs(orphanOutputs, label) {
  const details = orphanOutputs
    .map((outputPath) => {
      const relativeOutput = path.relative(repoRoot, outputPath);
      const relativeSource = path.relative(repoRoot, toSourcePath(outputPath));
      return `${relativeOutput} has no matching TypeScript source at ${relativeSource}`;
    })
    .join("\n");

  return `${label}\n${details}`;
}

function verifyOutputs(sourcePaths) {
  const failures = [];
  const missingOutputs = findMissingOutputs(sourcePaths);

  if (missingOutputs.length > 0) {
    failures.push(formatMissingOutputs(missingOutputs));
  }

  const postBuildOrphans = findOrphanOutputs(listManagedOutputPaths(), sourcePaths);

  if (postBuildOrphans.length > 0) {
    failures.push(
      formatOrphanOutputs(
        postBuildOrphans,
        "Managed browser JavaScript exists after rebuild without a matching TypeScript source of truth:"
      )
    );
  }

  if (failures.length > 0) {
    fail(failures.join("\n\n"));
  }
}

function main() {
  let buildLockHandle = null;
  let outputSnapshots = new Map();
  let shouldRestoreOutputs = false;

  try {
    buildLockHandle = acquireBuildLock();

    const managedOutputPaths = listManagedOutputPaths();
    outputSnapshots = snapshotManagedOutputs(managedOutputPaths);
    const sourcePaths = listManagedSourcePaths();

    if (sourcePaths.length === 0) {
      fail("No browser TypeScript sources were resolved for browser build verification.");
    }

    shouldRestoreOutputs = true;
    removeManagedOutputs(managedOutputPaths);

    for (const build of browserBuilds) {
      console.log(`Compiling browser ${build.name} sources with ${build.config}`);
      runTsc(["-p", build.config]);
    }

    verifyOutputs(sourcePaths);
    shouldRestoreOutputs = false;

    console.log(`Verified ${sourcePaths.length} browser runtime assets.`);
  } catch (error) {
    if (shouldRestoreOutputs) {
      restoreManagedOutputs(outputSnapshots);
    }
    if (error?.message) {
      console.error(error.message);
    }
    process.exit(error?.exitCode ?? 1);
  } finally {
    releaseBuildLock(buildLockHandle);
  }
}

main();
