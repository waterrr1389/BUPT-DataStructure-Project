#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(repoRoot, "public");
const browserBuilds = [
  { name: "esm", config: "tsconfig.browser-esm.json" },
  { name: "script", config: "tsconfig.browser-script.json" },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isWithin(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
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

function readTsconfig(configPath) {
  const configContent = fs.readFileSync(path.join(repoRoot, configPath), "utf8");
  return JSON.parse(configContent);
}

function listTypeScriptFiles(directoryPath) {
  const sourcePaths = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      sourcePaths.push(...listTypeScriptFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entryPath.endsWith(".ts") && !entryPath.endsWith(".d.ts")) {
      sourcePaths.push(entryPath);
    }
  }

  return sourcePaths.sort();
}

function resolveConfigEntry(entryPath) {
  return path.resolve(repoRoot, entryPath);
}

function resolveIncludePattern(configPath, pattern) {
  if (!pattern.includes("*")) {
    return [resolveConfigEntry(pattern)];
  }

  const recursiveTsSuffix = "/**/*.ts";

  if (pattern.endsWith(recursiveTsSuffix)) {
    const directoryPath = resolveConfigEntry(pattern.slice(0, -recursiveTsSuffix.length));
    return listTypeScriptFiles(directoryPath);
  }

  fail(`Unsupported include pattern in ${configPath}: ${pattern}`);
}

function listBrowserSources(configPath) {
  const config = readTsconfig(configPath);
  const configuredEntries = [];

  for (const filePath of config.files ?? []) {
    configuredEntries.push(resolveConfigEntry(filePath));
  }

  for (const pattern of config.include ?? []) {
    configuredEntries.push(...resolveIncludePattern(configPath, pattern));
  }

  return configuredEntries
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts"))
    .filter((entry) => isWithin(publicRoot, entry))
    .sort();
}

function toOutputPath(sourcePath) {
  return sourcePath.slice(0, -3) + ".js";
}

function removeManagedOutputs(outputPaths) {
  for (const outputPath of outputPaths) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }
}

function verifyOutputs(sourcePaths) {
  const missingOutputs = sourcePaths
    .map((sourcePath) => ({ sourcePath, outputPath: toOutputPath(sourcePath) }))
    .filter(({ outputPath }) => !fs.existsSync(outputPath));

  if (missingOutputs.length > 0) {
    const details = missingOutputs
      .map(({ sourcePath, outputPath }) => {
        const relativeSource = path.relative(repoRoot, sourcePath);
        const relativeOutput = path.relative(repoRoot, outputPath);
        return `Missing emitted asset for ${relativeSource}: expected ${relativeOutput}`;
      })
      .join("\n");

    fail(details);
  }
}

function main() {
  const sourceSet = new Set();

  for (const build of browserBuilds) {
    for (const sourcePath of listBrowserSources(build.config)) {
      sourceSet.add(sourcePath);
    }
  }

  const sourcePaths = Array.from(sourceSet).sort();

  if (sourcePaths.length === 0) {
    fail("No browser TypeScript sources were resolved for browser build verification.");
  }

  removeManagedOutputs(sourcePaths.map(toOutputPath));

  for (const build of browserBuilds) {
    console.log(`Compiling browser ${build.name} sources with ${build.config}`);
    runTsc(["-p", build.config]);
  }

  verifyOutputs(sourcePaths);

  console.log(`Verified ${sourcePaths.length} browser runtime assets.`);
}

main();
