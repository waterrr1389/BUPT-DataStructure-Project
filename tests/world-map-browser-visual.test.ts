import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { startServer } from "../src/server/index";

type CdpResult<T = unknown> = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: T;
  error?: { message?: string };
};

type JsonResponse<T> = {
  body: T;
  headers: Headers;
  status: number;
  text: string;
};

type ScreenshotStats = {
  height: number;
  nonTransparentPixels: number;
  sampledColors: number;
  width: number;
};

const runtimeFs = fs as typeof fs & {
  mkdtemp(prefix: string): Promise<string>;
  rm(targetPath: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
};

const childProcess = require("node:child_process") as {
  spawn(command: string, args: string[], options?: Record<string, unknown>): {
    kill(signal?: string): void;
    killed: boolean;
    on(event: "exit", listener: () => void): void;
    stderr?: { on(event: "data", listener: (chunk: Buffer) => void): void };
    stdout?: { on(event: "data", listener: (chunk: Buffer) => void): void };
  };
  spawnSync(command: string, args?: string[], options?: Record<string, unknown>): { status: number | null };
};
const zlib = require("node:zlib") as {
  inflateSync(content: Buffer): Buffer;
};

function browserCandidates(): string[] {
  return [
    process.env.CHROMIUM_PATH,
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
    "chrome",
  ].filter((candidate): candidate is string => Boolean(candidate));
}

function findChromiumExecutable(): string | null {
  for (const candidate of browserCandidates()) {
    const probe = childProcess.spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

async function waitFor<T>(description: string, callback: () => Promise<T | null>, timeoutMs = 10_000): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await callback();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const suffix = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${description}${suffix}`);
}

async function readDevToolsWebSocketUrl(userDataDir: string): Promise<string> {
  const activePortPath = path.join(userDataDir, "DevToolsActivePort");
  return waitFor("Chromium page DevTools endpoint", async () => {
    const content = await fs.readFile(activePortPath, "utf8");
    const [port] = content.trim().split(/\n/);
    if (!port) {
      return null;
    }
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) {
      return null;
    }
    const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
    return targets.find((target) => target.type === "page")?.webSocketDebuggerUrl ?? null;
  });
}

class CdpSession {
  private nextId = 1;
  private readonly pending = new Map<number, { reject(error: Error): void; resolve(value: CdpResult): void }>();

  private constructor(private readonly socket: WebSocket) {}

  static async connect(webSocketUrl: string): Promise<CdpSession> {
    const socket = new WebSocket(webSocketUrl);
    const session = new CdpSession(socket);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("CDP WebSocket failed to open.")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpResult;
      if (typeof message.id !== "number") {
        return;
      }
      const pending = session.pending.get(message.id);
      if (!pending) {
        return;
      }
      session.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? "CDP command failed."));
      } else {
        pending.resolve(message);
      }
    });
    return session;
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    const response = await new Promise<CdpResult<T>>((resolve, reject) => {
      this.pending.set(id, { reject, resolve: resolve as (value: CdpResult) => void });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
    return response.result as T;
  }

  close(): void {
    this.socket.close();
  }
}

async function requestJson<T>(baseUrl: string, requestPath: string, options: {
  body?: Record<string, unknown>;
  cookie?: string;
  method?: string;
} = {}): Promise<JsonResponse<T>> {
  const response = await fetch(`${baseUrl}${requestPath}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return {
    body: text ? JSON.parse(text) as T : null as T,
    headers: response.headers,
    status: response.status,
    text,
  };
}

async function loginSeedUser(baseUrl: string): Promise<string> {
  const bootstrap = await requestJson<{ users: Array<{ id: string; name: string }> }>(baseUrl, "/api/bootstrap");
  const user = bootstrap.body.users.find((entry) => entry.id === "user-2");
  assert.ok(user, "Expected seed user user-2 for browser smoke test.");
  const response = await requestJson<{ item: { id: string; name: string } }>(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { name: user.name, password: "trail-atlas" },
  });
  assert.equal(response.status, 200, response.text);
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert.match(cookie, /^trail_atlas_session=/);
  return cookie;
}

function readUInt32(content: Buffer, offset: number): number {
  return (
    ((content[offset] ?? 0) * 0x1000000) +
    ((content[offset + 1] ?? 0) << 16) +
    ((content[offset + 2] ?? 0) << 8) +
    (content[offset + 3] ?? 0)
  );
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
}

function decodeScreenshotStats(base64Png: string): ScreenshotStats {
  const content = Buffer.from(base64Png, "base64");
  assert.equal(content.subarray(1, 4).toString("ascii"), "PNG");
  const width = readUInt32(content, 16);
  const height = readUInt32(content, 20);
  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset < content.length) {
    const length = readUInt32(content, offset);
    const type = content.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    if (type === "IDAT") {
      chunks.push(content.subarray(dataStart, dataStart + length));
    }
    offset = dataStart + length + 4;
    if (type === "IEND") {
      break;
    }
  }

  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(chunks));
  const colors = new Set<string>();
  let nonTransparentPixels = 0;
  let sourceOffset = 0;
  let previous = Buffer.alloc(scanlineLength);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset] ?? 0;
    sourceOffset += 1;
    const current = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + scanlineLength));
    sourceOffset += scanlineLength;
    for (let x = 0; x < scanlineLength; x += 1) {
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] ?? 0 : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] ?? 0 : 0;
      if (filter === 1) {
        current[x] = ((current[x] ?? 0) + left) & 0xff;
      } else if (filter === 2) {
        current[x] = ((current[x] ?? 0) + up) & 0xff;
      } else if (filter === 3) {
        current[x] = ((current[x] ?? 0) + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) {
        current[x] = ((current[x] ?? 0) + paeth(left, up, upLeft)) & 0xff;
      }
    }
    for (let x = 0; x < width; x += 8) {
      const pixelOffset = x * bytesPerPixel;
      const alpha = current[pixelOffset + 3] ?? 0;
      if (alpha > 0) {
        nonTransparentPixels += 1;
        colors.add([
          current[pixelOffset] ?? 0,
          current[pixelOffset + 1] ?? 0,
          current[pixelOffset + 2] ?? 0,
          alpha,
        ].join(","));
      }
    }
    previous = current;
  }

  return {
    height,
    nonTransparentPixels,
    sampledColors: colors.size,
    width,
  };
}

async function evaluate<T>(session: CdpSession, expression: string): Promise<T> {
  const result = await session.send<{
    exceptionDetails?: unknown;
    result: { value?: T };
  }>("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  assert.equal(result.exceptionDetails, undefined);
  return result.result.value as T;
}

async function verifyWorldMapViewport(session: CdpSession, baseUrl: string, cookie: string, viewport: {
  height: number;
  name: string;
  width: number;
}): Promise<void> {
  await session.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: viewport.height,
    mobile: viewport.width < 700,
    width: viewport.width,
  });
  await session.send("Network.setExtraHTTPHeaders", { headers: { Cookie: cookie } });
  await session.send("Page.navigate", { url: `${baseUrl}/map?view=world` });
  await waitFor(`${viewport.name} world map render`, async () => {
    const ready = await evaluate<boolean>(session, `Boolean(
      location.pathname === "/map" &&
      location.search.includes("view=world") &&
      document.querySelector("#world-map-canvas .leaflet-image-layer") &&
      document.querySelector("#world-route-form")
    )`);
    return ready ? true : null;
  });

  const diagnostics = await evaluate<{
    hasImage: boolean;
    hasLoginRedirect: boolean;
    hasRasterSize: boolean;
    height: number;
    markerCount: number;
    pathCount: number;
    routeControls: boolean;
    visiblePathCount: number;
    width: number;
  }>(session, `(() => {
    const canvas = document.querySelector("#world-map-canvas");
    const rect = canvas?.getBoundingClientRect();
    const image = document.querySelector("#world-map-canvas .leaflet-image-layer");
    const paths = Array.from(document.querySelectorAll("#world-map-canvas svg path"));
    const markers = document.querySelectorAll("#world-map-canvas .world-destination-marker").length;
    return {
      hasImage: Boolean(image),
      hasLoginRedirect: location.pathname === "/login",
      hasRasterSize: Boolean(image && image.complete && image.naturalWidth > 100 && image.naturalHeight > 100),
      height: Math.round(rect?.height ?? 0),
      markerCount: markers,
      pathCount: paths.length,
      routeControls: Boolean(document.querySelector("#world-route-form") && document.querySelector("[data-route-world-submit='true']")),
      visiblePathCount: paths.filter((path) => {
        const box = path.getBoundingClientRect();
        const style = getComputedStyle(path);
        return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      }).length,
      width: Math.round(rect?.width ?? 0),
    };
  })()`);

  assert.equal(diagnostics.hasLoginRedirect, false, `${viewport.name} should not redirect to login.`);
  assert.equal(diagnostics.width > 240, true, `${viewport.name} map width should be non-trivial.`);
  assert.equal(diagnostics.height > 220, true, `${viewport.name} map height should be non-trivial.`);
  assert.equal(diagnostics.hasImage, true, `${viewport.name} should include a Leaflet image layer.`);
  assert.equal(diagnostics.hasRasterSize, true, `${viewport.name} raster image should load.`);
  assert.equal(diagnostics.pathCount >= 3, true, `${viewport.name} should include SVG region and road paths.`);
  assert.equal(diagnostics.visiblePathCount >= 3, true, `${viewport.name} should include visible SVG paths.`);
  assert.equal(diagnostics.markerCount >= 2, true, `${viewport.name} should include destination markers.`);
  assert.equal(diagnostics.routeControls, true, `${viewport.name} should include world route controls.`);

  const screenshot = await session.send<{ data: string }>("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
  });
  const stats = decodeScreenshotStats(screenshot.data);
  assert.equal(stats.width, viewport.width);
  assert.equal(stats.height, viewport.height);
  assert.equal(stats.nonTransparentPixels > (stats.width * stats.height) / 128, true);
  assert.equal(stats.sampledColors > 24, true, `${viewport.name} screenshot should contain varied rendered pixels.`);
}

test("world map renders real Leaflet raster and vector layers in Chromium", async (t) => {
  const chromium = findChromiumExecutable();
  if (!chromium) {
    t.skip("Chromium executable not found; skipping real-browser world map visual smoke test.");
    return;
  }

  const tempRoot = await runtimeFs.mkdtemp(path.join("/tmp", "ds-ts-world-map-browser-"));
  const runtimeDir = path.join(tempRoot, "runtime");
  const userDataDir = path.join(tempRoot, "chromium");
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(userDataDir, { recursive: true });

  const started = await startServer({ host: "127.0.0.1", port: 0, runtimeDir });
  const browser = childProcess.spawn(chromium, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: "ignore" });
  const browserExited = new Promise<void>((resolve) => {
    browser.on("exit", () => resolve());
  });

  let session: CdpSession | null = null;
  try {
    const cookie = await loginSeedUser(started.url);
    const webSocketUrl = await readDevToolsWebSocketUrl(userDataDir);
    session = await CdpSession.connect(webSocketUrl);
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("Network.enable");

    await verifyWorldMapViewport(session, started.url, cookie, { height: 900, name: "desktop", width: 1280 });
    await verifyWorldMapViewport(session, started.url, cookie, { height: 812, name: "mobile", width: 390 });
  } finally {
    session?.close();
    browser.kill("SIGKILL");
    await Promise.race([
      browserExited,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    started.server.close();
    await runtimeFs.rm(tempRoot, { force: true, recursive: true });
  }
});
