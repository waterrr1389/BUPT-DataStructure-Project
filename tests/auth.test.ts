import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createServerHandler } from "../src/server/index";
import { createAppServices } from "../src/services/index";

type JsonResponse<T> = {
  body: T;
  headers: Record<string, string>;
  status: number;
  text: string;
};

type RequestOptions = {
  body?: string | Record<string, unknown>;
  method?: string;
  cookie?: string;
};

function createMockResponse(): {
  body: Buffer[];
  headers: Record<string, string>;
  statusCode: number;
  end(chunk?: Buffer | string): void;
  writeHead(statusCode: number, headers: Record<string, unknown>): void;
  getHeader(name: string): string | string[] | undefined;
  setHeader(name: string, value: string | string[]): void;
} {
  const internalHeaders: Record<string, string | string[]> = {};
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
      const merged: Record<string, string> = {};
      for (const [key, value] of Object.entries(internalHeaders)) {
        merged[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
      }
      for (const [key, value] of Object.entries(headers)) {
        merged[key.toLowerCase()] = String(value);
      }
      this.headers = merged;
    },
    getHeader(name: string): string | string[] | undefined {
      return internalHeaders[name.toLowerCase()];
    },
    setHeader(name: string, value: string | string[]) {
      internalHeaders[name.toLowerCase()] = value;
    },
  };
}

function createMockRequest(requestPath: string, options: RequestOptions): {
  method: string;
  url: string;
  headers: Record<string, string>;
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
    headers: options.cookie ? { cookie: options.cookie } : {},
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

async function withAuthServer<T>(
  name: string,
  run: (context: {
    requestJson: <TResponse>(requestPath: string, options?: RequestOptions) => Promise<JsonResponse<TResponse>>;
  }) => Promise<T>,
): Promise<T> {
  const runtimeDir = path.join(
    "/tmp",
    `ds-ts-auth-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await fs.mkdir(runtimeDir, { recursive: true });
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
      headers: response.headers,
      status: response.statusCode,
      text,
      body: text ? (JSON.parse(text) as TResponse) : (null as TResponse),
    };
  }

  try {
    return await run({ requestJson });
  } finally {
    await (fs as any).rm(runtimeDir, { force: true, recursive: true });
  }
}

test("auth register creates a new user and returns session", async () => {
  await withAuthServer("register", async ({ requestJson }) => {
    const response = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "TestUser", password: "secret123" },
    });

    assert.equal(response.status, 201);
    assert.equal((response.body as Record<string, any>).item.name, "TestUser");
    assert.ok((response.body as Record<string, any>).item.id, "User should have an id");
    assert.ok(response.headers["set-cookie"], "Should set session cookie");
    assert.ok((response.headers["set-cookie"] as string).includes("trail_atlas_session"));
  });
});

test("auth register rejects duplicate username", async () => {
  await withAuthServer("duplicate", async ({ requestJson }) => {
    const first = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "UniqueUser", password: "secret123" },
    });
    assert.equal(first.status, 201);

    const second = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "UniqueUser", password: "otherpass" },
    });

    assert.equal(second.status, 409);
    assert.equal((second.body as Record<string, any>).code, "auth_duplicate_username");
  });
});

test("auth login succeeds with valid credentials", async () => {
  await withAuthServer("login-ok", async ({ requestJson }) => {
    const register = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "LoginUser", password: "mypassword" },
    });
    assert.equal(register.status, 201);

    const login = await requestJson("/api/auth/login", {
      method: "POST",
      body: { name: "LoginUser", password: "mypassword" },
    });

    assert.equal(login.status, 200);
    assert.equal((login.body as Record<string, any>).item.name, "LoginUser");
    assert.ok(login.headers["set-cookie"].includes("trail_atlas_session"));
  });
});

test("auth login fails with invalid credentials", async () => {
  await withAuthServer("login-fail", async ({ requestJson }) => {
    const response = await requestJson("/api/auth/login", {
      method: "POST",
      body: { name: "Nobody", password: "wrong" },
    });

    assert.equal(response.status, 401);
    assert.equal((response.body as Record<string, any>).code, "auth_invalid_credentials");
  });
});

test("auth me returns user when authenticated", async () => {
  await withAuthServer("me-ok", async ({ requestJson }) => {
    const register = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "MeUser", password: "pass" },
    });
    assert.equal(register.status, 201);

    const cookie = (register.headers["set-cookie"] as string).split(";")[0];
    const me = await requestJson("/api/auth/me", { cookie });

    assert.equal(me.status, 200);
    assert.equal((me.body as Record<string, any>).item.name, "MeUser");
  });
});

test("auth me returns 401 when not authenticated", async () => {
  await withAuthServer("me-fail", async ({ requestJson }) => {
    const response = await requestJson("/api/auth/me");

    assert.equal(response.status, 401);
    assert.equal((response.body as Record<string, any>).code, "auth_unauthenticated");
  });
});

test("auth logout clears session", async () => {
  await withAuthServer("logout", async ({ requestJson }) => {
    const register = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "LogoutUser", password: "pass" },
    });
    const cookie = (register.headers["set-cookie"] as string).split(";")[0];

    const logout = await requestJson("/api/auth/logout", {
      method: "POST",
      cookie,
    });
    assert.equal(logout.status, 200);
    assert.equal((logout.body as Record<string, any>).ok, true);

    const me = await requestJson("/api/auth/me", { cookie });
    assert.equal(me.status, 401);
  });
});

test("bootstrap includes currentUser when authenticated", async () => {
  await withAuthServer("bootstrap-auth", async ({ requestJson }) => {
    const register = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "BootstrapUser", password: "pass" },
    });
    const cookie = (register.headers["set-cookie"] as string).split(";")[0];

    const bootstrap = await requestJson("/api/bootstrap", { cookie });

    assert.equal(bootstrap.status, 200);
    assert.ok((bootstrap.body as Record<string, any>).currentUser);
    assert.equal((bootstrap.body as Record<string, any>).currentUser.name, "BootstrapUser");
  });
});

test("bootstrap includes null currentUser when not authenticated", async () => {
  await withAuthServer("bootstrap-noauth", async ({ requestJson }) => {
    const bootstrap = await requestJson("/api/bootstrap");

    assert.equal(bootstrap.status, 200);
    assert.equal((bootstrap.body as Record<string, any>).currentUser, null);
  });
});

test("seed users can login with default password", async () => {
  await withAuthServer("seed-login", async ({ requestJson }) => {
    const bootstrap = await requestJson("/api/bootstrap");
    const seedUser = (bootstrap.body as Record<string, any>).users[0];

    const login = await requestJson("/api/auth/login", {
      method: "POST",
      body: { name: seedUser.name, password: "trail-atlas" },
    });

    assert.equal(login.status, 200);
    assert.equal((login.body as Record<string, any>).item.name, seedUser.name);
  });
});

test("journal update is restricted to author", async () => {
  await withAuthServer("journal-guard-update", async ({ requestJson }) => {
    const author = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "Author", password: "pass" },
    });
    const authorCookie = (author.headers["set-cookie"] as string).split(";")[0];

    const other = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "Other", password: "pass" },
    });
    const otherCookie = (other.headers["set-cookie"] as string).split(";")[0];

    const bootstrap = await requestJson("/api/bootstrap", { cookie: authorCookie });
    const destId = (bootstrap.body as Record<string, any>).destinations[0].id;

    const create = await requestJson("/api/journals", {
      method: "POST",
      body: {
        userId: (author.body as Record<string, any>).item.id,
        destinationId: destId,
        title: "My Journal",
        body: "Content",
      },
      cookie: authorCookie,
    });
    assert.equal(create.status, 201);
    const journalId = (create.body as Record<string, any>).item.id;

    const updateSelf = await requestJson(`/api/journals/${journalId}`, {
      method: "PATCH",
      body: { title: "Updated" },
      cookie: authorCookie,
    });
    assert.equal(updateSelf.status, 200);

    const updateOther = await requestJson(`/api/journals/${journalId}`, {
      method: "PATCH",
      body: { title: "Hacked" },
      cookie: otherCookie,
    });
    assert.equal(updateOther.status, 400);
    assert.ok((updateOther.body as Record<string, any>).error.includes("Cannot update another user's journal"));
  });
});

test("journal delete is restricted to author", async () => {
  await withAuthServer("journal-guard-delete", async ({ requestJson }) => {
    const author = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "DeleteAuthor", password: "pass" },
    });
    const authorCookie = (author.headers["set-cookie"] as string).split(";")[0];

    const other = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "DeleteOther", password: "pass" },
    });
    const otherCookie = (other.headers["set-cookie"] as string).split(";")[0];

    const bootstrap = await requestJson("/api/bootstrap", { cookie: authorCookie });
    const destId = (bootstrap.body as Record<string, any>).destinations[0].id;

    const create = await requestJson("/api/journals", {
      method: "POST",
      body: {
        userId: (author.body as Record<string, any>).item.id,
        destinationId: destId,
        title: "To Delete",
        body: "Content",
      },
      cookie: authorCookie,
    });
    const journalId = (create.body as Record<string, any>).item.id;

    const deleteOther = await requestJson(`/api/journals/${journalId}`, {
      method: "DELETE",
      cookie: otherCookie,
    });
    assert.equal(deleteOther.status, 400);
    assert.ok((deleteOther.body as Record<string, any>).error.includes("Cannot delete another user's journal"));

    const deleteSelf = await requestJson(`/api/journals/${journalId}`, {
      method: "DELETE",
      cookie: authorCookie,
    });
    assert.equal(deleteSelf.status, 200);
  });
});

test("journal create falls back to cookie when body userId omitted", async () => {
  await withAuthServer("journal-fallback", async ({ requestJson }) => {
    const user = await requestJson("/api/auth/register", {
      method: "POST",
      body: { name: "FallbackUser", password: "pass" },
    });
    const cookie = (user.headers["set-cookie"] as string).split(";")[0];

    const bootstrap = await requestJson("/api/bootstrap", { cookie });
    const destId = (bootstrap.body as Record<string, any>).destinations[0].id;

    const create = await requestJson("/api/journals", {
      method: "POST",
      body: {
        destinationId: destId,
        title: "No Explicit UserId",
        body: "Content",
      },
      cookie,
    });

    assert.equal(create.status, 201);
    assert.equal((create.body as Record<string, any>).item.userId, (user.body as Record<string, any>).item.id);
  });
});
