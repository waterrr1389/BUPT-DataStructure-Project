import assert from "node:assert/strict";
import path from "node:path";

import type { createServerHandler as CreateServerHandler } from "../../src/server/index";
import type { AppServices, createAppServices as CreateAppServices } from "../../src/services/index";

const { mkdir, readFile, rm } = require("node:fs/promises") as any;
const processWithControl = process as typeof process & {
  chdir(directory: string): void;
  exit(code?: number): never;
};

type RequestOptions = {
  body?: string | Record<string, unknown>;
  method?: string;
};

function expectMatches(value: string, pattern: RegExp): void {
  assert.equal(pattern.test(value), true, value);
}

function createMockResponse(): {
  body: Buffer[];
  headers: Record<string, string>;
  statusCode: number;
  end(chunk?: Buffer | string): void;
  writeHead(statusCode: number, headers: Record<string, unknown>): void;
} {
  return {
    body: [],
    headers: {},
    statusCode: 200,
    end(chunk?: Buffer | string) {
      if (chunk !== undefined) {
        this.body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    },
    writeHead(statusCode: number, headers: Record<string, unknown>) {
      this.statusCode = statusCode;
      this.headers = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
      );
    },
  };
}

function createMockRequest(requestPath: string, options: RequestOptions = {}): {
  method: string;
  url: string;
  [Symbol.asyncIterator](): AsyncGenerator<Buffer, void, unknown>;
} {
  const bodyText =
    typeof options.body === "string"
      ? options.body
      : options.body
        ? JSON.stringify(options.body)
        : "";
  const chunks = bodyText ? [Buffer.from(bodyText)] : [];

  return {
    method: options.method ?? "GET",
    url: requestPath,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const originalCwd = process.cwd();
  const outsideCwd = path.join(
    "/tmp",
    `ds-ts-built-server-cwd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  let runtimeDir: string | null = null;
  await mkdir(outsideCwd, { recursive: true });
  processWithControl.chdir(outsideCwd);

  try {
    const builtServerModulePath = path.join(repoRoot, "dist", "src", "server", "index.js");
    const builtServicesModulePath = path.join(repoRoot, "dist", "src", "services", "index.js");
    const builtServerModule = require(builtServerModulePath) as {
      createServerHandler: typeof CreateServerHandler;
    };
    const builtServicesModule = require(builtServicesModulePath) as {
      createAppServices: typeof CreateAppServices;
    };
    const createServerHandler = builtServerModule.createServerHandler;
    const createAppServices = builtServicesModule.createAppServices;

    runtimeDir = path.join(
      "/tmp",
      `ds-ts-built-runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    );
    await mkdir(runtimeDir, { recursive: true });
    const services = await createAppServices({ runtimeDir });
    await services.journalStore.reset();
    const handler = createServerHandler(services as AppServices);

    async function requestTextBuilt(requestPath: string, options: RequestOptions = {}) {
      const request = createMockRequest(requestPath, options);
      const response = createMockResponse();
      await handler(request as never, response as never);
      return {
        headers: response.headers,
        status: response.statusCode,
        text: Buffer.concat(response.body).toString("utf8"),
      };
    }

    const builtIndexHtml = await readFile(path.join(repoRoot, "dist", "public", "index.html"), "utf8");
    const builtAppJs = await readFile(path.join(repoRoot, "dist", "public", "app.js"), "utf8");

    const rootResponse = await requestTextBuilt("/");
    assert.equal(rootResponse.status, 200, rootResponse.text);
    assert.equal(rootResponse.headers["content-type"], "text/html; charset=utf-8");
    assert.equal(rootResponse.headers["cache-control"], "no-store");
    assert.equal(rootResponse.text, builtIndexHtml);

    const appResponse = await requestTextBuilt("/app.js");
    assert.equal(appResponse.status, 200, appResponse.text);
    assert.equal(appResponse.headers["cache-control"], "no-store");
    expectMatches(appResponse.headers["content-type"] ?? "", /javascript/i);
    assert.equal(appResponse.text, builtAppJs);
  } finally {
    processWithControl.chdir(originalCwd);
    if (runtimeDir) {
      await rm(runtimeDir, { force: true, recursive: true });
    }
    await rm(outsideCwd, { force: true, recursive: true });
  }
}

void main().catch((error) => {
  console.error(error);
  processWithControl.exit(1);
});
