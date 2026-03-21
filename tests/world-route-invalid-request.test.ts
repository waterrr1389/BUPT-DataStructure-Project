import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createServerHandler } from "../src/server/index";
import { createAppServices } from "../src/services/index";

type JsonResponse<T> = {
  body: T;
  status: number;
  text: string;
};

type RequestOptions = {
  body?: unknown;
  method?: string;
};

type RuntimeFs = {
  mkdir(targetPath: string, options?: { recursive?: boolean }): Promise<void>;
  rm(targetPath: string, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
};

function createMockResponse(): {
  body: Buffer[];
  statusCode: number;
  end(chunk?: Buffer | string): void;
  writeHead(statusCode: number): void;
} {
  return {
    body: [],
    statusCode: 200,
    end(chunk?: Buffer | string) {
      if (chunk !== undefined) {
        this.body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    },
    writeHead(statusCode: number) {
      this.statusCode = statusCode;
    },
  };
}

function createMockRequest(requestPath: string, options: RequestOptions): {
  method: string;
  url: string;
  [Symbol.asyncIterator](): AsyncGenerator<Buffer, void, unknown>;
} {
  const bodyText =
    typeof options.body === "string"
      ? options.body
      : options.body === undefined
        ? ""
        : JSON.stringify(options.body);
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

async function withServer<T>(
  name: string,
  run: (requestJson: <TResponse>(requestPath: string, options?: RequestOptions) => Promise<JsonResponse<TResponse>>) => Promise<T>,
): Promise<T> {
  const runtimeFs = fs as unknown as RuntimeFs;
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-world-route-invalid-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await runtimeFs.mkdir(runtimeDir, { recursive: true });
  const services = await createAppServices({ runtimeDir });
  await services.journalStore.reset();
  const handler = createServerHandler(services);

  async function requestJson<TResponse>(
    requestPath: string,
    options: RequestOptions = {},
  ): Promise<JsonResponse<TResponse>> {
    const request = createMockRequest(requestPath, options);
    const response = createMockResponse();
    await handler(request as never, response as never);
    const text = Buffer.concat(response.body).toString("utf8");
    return {
      body: text ? JSON.parse(text) as TResponse : (null as TResponse),
      status: response.statusCode,
      text,
    };
  }

  try {
    return await run(requestJson);
  } finally {
    await runtimeFs.rm(runtimeDir, { force: true, recursive: true });
  }
}

test("world route plan maps malformed JSON to world_route_invalid_request", async () => {
  await withServer("malformed-json", async (requestJson) => {
    const response = await requestJson<{ error: string; code: string; issues: string[] }>("/api/world/routes/plan", {
      method: "POST",
      body: "{\"scope\":\"cross-map\"",
    });

    assert.equal(response.status, 400, response.text);
    assert.deepEqual(response.body, {
      error: "Invalid world route request.",
      code: "world_route_invalid_request",
      issues: ["Request body must be valid JSON."],
    });
  });
});

test("world route plan maps non-object payloads to world_route_invalid_request", async () => {
  await withServer("non-object-payload", async (requestJson) => {
    const payloads: unknown[] = [null, 123, ["dest-002", "dest-004"]];

    for (const payload of payloads) {
      const response = await requestJson<{ error: string; code: string; issues: string[] }>("/api/world/routes/plan", {
        method: "POST",
        body: payload,
      });
      assert.equal(response.status, 400, response.text);
      assert.deepEqual(response.body, {
        error: "Invalid world route request.",
        code: "world_route_invalid_request",
        issues: ["Request body must be a JSON object."],
      });
    }
  });
});

test("world route plan keeps schema validation failures in world_route_invalid_request", async () => {
  await withServer("missing-scope", async (requestJson) => {
    const response = await requestJson<{ error: string; code: string; issues: string[] }>("/api/world/routes/plan", {
      method: "POST",
      body: {},
    });

    assert.equal(response.status, 400, response.text);
    assert.deepEqual(response.body, {
      error: "Invalid world route request.",
      code: "world_route_invalid_request",
      issues: ["\"scope\" must be a non-empty string."],
    });
  });
});

test("world route plan maps oversized payloads to world_route_invalid_request", async () => {
  await withServer("oversized-body", async (requestJson) => {
    const response = await requestJson<{ error: string; code: string; issues: string[] }>("/api/world/routes/plan", {
      method: "POST",
      body: { payload: "a".repeat(1_000_050) },
    });

    assert.equal(response.status, 400, response.text);
    assert.deepEqual(response.body, {
      error: "Invalid world route request.",
      code: "world_route_invalid_request",
      issues: ["Request body exceeds 1 MB."],
    });
  });
});

test("world route plan rejects same-destination cross-map requests", async () => {
  await withServer("same-destination-cross-map", async (requestJson) => {
    const response = await requestJson<{ error: string; code: string; issues: string[] }>("/api/world/routes/plan", {
      method: "POST",
      body: {
        scope: "cross-map",
        fromDestinationId: "dest-002",
        toDestinationId: "dest-002",
        strategy: "distance",
        mode: "walk",
      },
    });

    assert.equal(response.status, 400, response.text);
    assert.deepEqual(response.body, {
      error: "Invalid world route request.",
      code: "world_route_invalid_request",
      issues: ['"fromDestinationId" and "toDestinationId" must be different for "cross-map" routes.'],
    });
  });
});

test("unrelated endpoint keeps generic malformed JSON handling", async () => {
  await withServer("generic-endpoint", async (requestJson) => {
    const response = await requestJson<{ error: string; code?: string }>("/api/routes/plan", {
      method: "POST",
      body: "{\"destinationId\":\"dest-002\"",
    });

    assert.equal(response.status, 400, response.text);
    assert.deepEqual(response.body, { error: "Request body must be valid JSON." });
    assert.equal("code" in response.body, false);
  });
});
