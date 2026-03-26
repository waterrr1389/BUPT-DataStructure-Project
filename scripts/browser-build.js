#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(repoRoot, "public");
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

function getTscCommand() {
  return process.platform === "win32" ? "tsc.cmd" : "tsc";
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
    process.exit(result.status ?? 1);
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

function verifyOutputs(sourcePaths, preBuildOrphans) {
  const failures = [];
  const missingOutputs = findMissingOutputs(sourcePaths);

  if (missingOutputs.length > 0) {
    failures.push(formatMissingOutputs(missingOutputs));
  }

  if (preBuildOrphans.length > 0) {
    failures.push(
      formatOrphanOutputs(
        preBuildOrphans,
        "Managed browser JavaScript is checked in without a matching TypeScript source of truth:"
      )
    );
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
  const sourcePaths = listManagedSourcePaths();

  if (sourcePaths.length === 0) {
    fail("No browser TypeScript sources were resolved for browser build verification.");
  }

  const managedOutputPaths = listManagedOutputPaths();
  const preBuildOrphans = findOrphanOutputs(managedOutputPaths, sourcePaths);

  removeManagedOutputs(managedOutputPaths);

  for (const build of browserBuilds) {
    console.log(`Compiling browser ${build.name} sources with ${build.config}`);
    runTsc(["-p", build.config]);
  }

  verifyOutputs(sourcePaths, preBuildOrphans);

  console.log(`Verified ${sourcePaths.length} browser runtime assets.`);
}

main();
