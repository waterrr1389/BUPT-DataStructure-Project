import fs from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { parseDestinationSortBy } from "../services/contracts";
import { createAppServices, type AppServices } from "../services/index";

const publicDir = path.resolve(process.cwd(), "public");

function json(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function mimeType(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "application/octet-stream";
}

function staticCacheControl(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html" || extension === ".json") {
    return "no-store";
  }
  if (extension === ".js" || extension === ".css" || extension === ".svg") {
    return "public, max-age=300, must-revalidate";
  }
  return "public, max-age=300, must-revalidate";
}

async function serveStatic(requestPath: string, response: ServerResponse): Promise<void> {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, "");
  const targetPath = path.join(publicDir, safePath);
  if (!targetPath.startsWith(publicDir)) {
    json(response, 403, { error: "Forbidden" });
    return;
  }
  try {
    const content = await fs.readFile(targetPath);
    response.writeHead(200, {
      "content-type": mimeType(targetPath),
      "cache-control": staticCacheControl(targetPath),
    });
    response.end(content);
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException;
    if (candidate.code === "ENOENT" && !path.extname(targetPath)) {
      const fallback = await fs.readFile(path.join(publicDir, "index.html"));
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(fallback);
      return;
    }
    json(response, 404, { error: "Not found" });
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalSize += buffer.length;
    if (totalSize > 1_000_000) {
      throw new Error("Request body exceeds 1 MB.");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function asNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pathParts(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

async function handleApi(
  request: IncomingMessage,
  response: ServerResponse,
  services: AppServices,
  url: URL,
): Promise<boolean> {
  const parts = pathParts(url.pathname);
  if (parts[0] !== "api") {
    return false;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    json(response, 200, {
      ok: true,
      source: services.runtime.source,
      runtimeDir: services.runtime.runtimeDir,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    json(response, 200, await services.bootstrap());
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/feed") {
    json(
      response,
      200,
      await services.journals.feed({
        cursor: url.searchParams.get("cursor") ?? undefined,
        destinationId: url.searchParams.get("destinationId") ?? undefined,
        limit: asNumber(url.searchParams.get("limit")),
        userId: url.searchParams.get("userId") ?? undefined,
        viewerUserId: url.searchParams.get("viewerUserId") ?? undefined,
      }),
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/destinations") {
    const query = url.searchParams.get("query") ?? undefined;
    const category = url.searchParams.get("category") ?? undefined;
    const userId = url.searchParams.get("userId") ?? undefined;
    const sortBy = parseDestinationSortBy(url.searchParams.get("sortBy"));
    if (!query && !category) {
      json(response, 200, { items: services.destinations.listCatalog(asNumber(url.searchParams.get("limit")) ?? 18) });
      return true;
    }
    json(response, 200, {
      items: services.destinations.search({
        query,
        category,
        userId,
        sortBy,
        limit: asNumber(url.searchParams.get("limit")),
      }),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/destinations/recommendations") {
    const sortBy = parseDestinationSortBy(url.searchParams.get("sortBy"));
    json(response, 200, {
      items: services.destinations.recommend({
        userId: url.searchParams.get("userId") ?? undefined,
        query: url.searchParams.get("query") ?? undefined,
        category: url.searchParams.get("category") ?? undefined,
        sortBy,
        limit: asNumber(url.searchParams.get("limit")),
      }),
    });
    return true;
  }

  if (request.method === "GET" && parts[1] === "destinations" && parts.length === 3) {
    json(response, 200, services.destinations.getDestination(parts[2]));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/routes/plan") {
    const body = asObject(await readBody(request));
    json(response, 200, {
      item: services.routing.plan({
        destinationId: String(body.destinationId ?? ""),
        startNodeId: String(body.startNodeId ?? ""),
        endNodeId: body.endNodeId ? String(body.endNodeId) : undefined,
        waypointNodeIds: Array.isArray(body.waypointNodeIds) ? body.waypointNodeIds.map(String) : undefined,
        strategy: (body.strategy as "distance" | "time" | "mixed" | undefined) ?? undefined,
        mode: (body.mode as "walk" | "bike" | "shuttle" | "mixed" | undefined) ?? undefined,
      }),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/facilities/nearby") {
    json(response, 200, {
      item: services.facilities.findNearby({
        destinationId: url.searchParams.get("destinationId") ?? "",
        fromNodeId: url.searchParams.get("fromNodeId") ?? "",
        category: (url.searchParams.get("category") as
          | "restroom"
          | "clinic"
          | "store"
          | "charging"
          | "info"
          | "parking"
          | "water"
          | "atm"
          | "security"
          | "lounge"
          | "all"
          | null) ?? undefined,
        radius: asNumber(url.searchParams.get("radius")),
        limit: asNumber(url.searchParams.get("limit")),
        mode: (url.searchParams.get("mode") as "walk" | "bike" | "shuttle" | "mixed" | null) ?? undefined,
      }),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/journals") {
    json(response, 200, {
      items: await services.journals.list({
        destinationId: url.searchParams.get("destinationId") ?? undefined,
        userId: url.searchParams.get("userId") ?? undefined,
        limit: asNumber(url.searchParams.get("limit")),
        viewerUserId: url.searchParams.get("viewerUserId") ?? undefined,
      }),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/journals/recommendations") {
    json(response, 200, {
      items: await services.journals.recommend({
        destinationId: url.searchParams.get("destinationId") ?? undefined,
        userId: url.searchParams.get("userId") ?? undefined,
        limit: asNumber(url.searchParams.get("limit")),
      }),
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/journals") {
    const body = asObject(await readBody(request));
    json(response, 201, {
      item: await services.journals.create({
        userId: String(body.userId ?? ""),
        destinationId: String(body.destinationId ?? ""),
        title: String(body.title ?? ""),
        body: String(body.body ?? ""),
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        media: Array.isArray(body.media)
          ? body.media.map((entry) => ({
              type: String((entry as Record<string, unknown>).type ?? "image") as "image" | "video",
              title: String((entry as Record<string, unknown>).title ?? ""),
              source: String((entry as Record<string, unknown>).source ?? ""),
              note: (entry as Record<string, unknown>).note ? String((entry as Record<string, unknown>).note) : undefined,
            }))
          : undefined,
        recommendedFor: Array.isArray(body.recommendedFor) ? body.recommendedFor.map(String) : undefined,
      }),
    });
    return true;
  }

  if (parts[1] === "journals" && parts.length >= 3) {
    const journalId = parts[2];
    if (request.method === "GET" && parts.length === 3) {
      json(response, 200, {
        item: await services.journals.get(journalId, {
          viewerUserId: url.searchParams.get("viewerUserId") ?? undefined,
        }),
      });
      return true;
    }
    if (request.method === "PATCH" && parts.length === 3) {
      const body = asObject(await readBody(request));
      json(response, 200, {
        item: await services.journals.update(journalId, {
          title: body.title ? String(body.title) : undefined,
          body: body.body ? String(body.body) : undefined,
          tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
          media: Array.isArray(body.media)
            ? body.media.map((entry) => ({
                type: String((entry as Record<string, unknown>).type ?? "image") as "image" | "video",
                title: String((entry as Record<string, unknown>).title ?? ""),
                source: String((entry as Record<string, unknown>).source ?? ""),
                note: (entry as Record<string, unknown>).note ? String((entry as Record<string, unknown>).note) : undefined,
              }))
            : undefined,
          recommendedFor: Array.isArray(body.recommendedFor) ? body.recommendedFor.map(String) : undefined,
        }),
      });
      return true;
    }
    if (request.method === "GET" && parts[3] === "comments") {
      json(
        response,
        200,
        await services.journals.listComments({
          journalId,
          cursor: url.searchParams.get("cursor") ?? undefined,
          limit: asNumber(url.searchParams.get("limit")),
        }),
      );
      return true;
    }
    if (request.method === "POST" && parts[3] === "comments") {
      const body = asObject(await readBody(request));
      json(response, 201, {
        item: await services.journals.createComment(journalId, {
          userId: String(body.userId ?? ""),
          body: String(body.body ?? ""),
        }),
      });
      return true;
    }
    if (request.method === "POST" && parts[3] === "likes") {
      const body = asObject(await readBody(request));
      json(response, 200, {
        item: await services.journals.like(journalId, String(body.userId ?? "")),
      });
      return true;
    }
    if (request.method === "DELETE" && parts[3] === "likes") {
      const body = asObject(await readBody(request));
      json(response, 200, {
        item: await services.journals.unlike(
          journalId,
          String(body.userId ?? url.searchParams.get("userId") ?? ""),
        ),
      });
      return true;
    }
    if (request.method === "DELETE" && parts.length === 3) {
      json(response, 200, await services.journals.delete(journalId));
      return true;
    }
    if (request.method === "POST" && parts[3] === "view") {
      json(response, 200, { item: await services.journals.recordView(journalId) });
      return true;
    }
    if (request.method === "POST" && parts[3] === "rate") {
      const body = asObject(await readBody(request));
      json(response, 200, {
        item: await services.journals.rate(journalId, String(body.userId ?? ""), Number(body.score)),
      });
      return true;
    }
  }

  if (request.method === "DELETE" && parts[1] === "comments" && parts.length === 3) {
    const body = asObject(await readBody(request));
    json(
      response,
      200,
      await services.journals.deleteComment(parts[2], String(body.userId ?? url.searchParams.get("userId") ?? "")),
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/journal-exchange/destination") {
    json(response, 200, {
      items: await services.exchange.byDestination(url.searchParams.get("destinationId") ?? "", asNumber(url.searchParams.get("limit"))),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/journal-exchange/title") {
    json(response, 200, {
      item: await services.exchange.exactTitle(url.searchParams.get("title") ?? ""),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/journal-exchange/search") {
    json(response, 200, {
      items: await services.exchange.searchText(url.searchParams.get("query") ?? "", asNumber(url.searchParams.get("limit"))),
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/journal-exchange/compress") {
    const body = asObject(await readBody(request));
    json(response, 200, {
      item: services.exchange.compress(String(body.body ?? "")),
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/journal-exchange/decompress") {
    const body = asObject(await readBody(request));
    json(response, 200, {
      item: services.exchange.decompress(String(body.body ?? "")),
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/journal-exchange/storyboard") {
    const body = asObject(await readBody(request));
    json(response, 200, {
      item: services.exchange.generateStoryboard({
        title: body.title ? String(body.title) : undefined,
        prompt: String(body.prompt ?? ""),
        mediaSources: Array.isArray(body.mediaSources) ? body.mediaSources.map(String) : undefined,
      }),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/foods/recommendations") {
    json(response, 200, {
      items: services.foods.recommend({
        destinationId: url.searchParams.get("destinationId") ?? "",
        userId: url.searchParams.get("userId") ?? undefined,
        fromNodeId: url.searchParams.get("fromNodeId") ?? undefined,
        cuisine: url.searchParams.get("cuisine") ?? undefined,
        limit: asNumber(url.searchParams.get("limit")),
      }),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/foods/search") {
    json(response, 200, {
      items: services.foods.search({
        destinationId: url.searchParams.get("destinationId") ?? "",
        cuisine: url.searchParams.get("cuisine") ?? undefined,
        query: url.searchParams.get("query") ?? undefined,
        limit: asNumber(url.searchParams.get("limit")),
      }),
    });
    return true;
  }

  json(response, 404, { error: "Unknown API endpoint." });
  return true;
}

export function createServerHandler(services: AppServices) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const handled = await handleApi(request, response, services, requestUrl);
      if (!handled) {
        await serveStatic(requestUrl.pathname, response);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error.";
      json(response, 400, { error: message });
    }
  };
}

export async function createServerApp(options: { runtimeDir?: string } = {}) {
  const services = await createAppServices(options);
  const server = http.createServer(createServerHandler(services));
  return { server, services };
}

export async function startServer(options: { port?: number; host?: string; runtimeDir?: string } = {}) {
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  const app = await createServerApp({ runtimeDir: options.runtimeDir });
  const server = app.server as typeof app.server & {
    address(): { port: number } | string | null;
    once(event: "error", listener: (error: Error) => void): typeof app.server;
    once(event: "listening", listener: () => void): typeof app.server;
    removeListener(event: "error", listener: (error: Error) => void): typeof app.server;
    removeListener(event: "listening", listener: () => void): typeof app.server;
  };
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      server.removeListener("error", onError);
      server.removeListener("listening", onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;
  return {
    ...app,
    url: `http://${host}:${resolvedPort}`,
  };
}

async function runServerFromCli(): Promise<void> {
  try {
    const started = await startServer();
    process.stdout.write(`Server listening on ${started.url}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error.";
    throw new Error(`Server failed to start: ${message}`);
  }
}

if (require.main === module) {
  void runServerFromCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Server failed to start.";
    process.stdout.write(`${message}\n`);
    process.exitCode = 1;
  });
}
