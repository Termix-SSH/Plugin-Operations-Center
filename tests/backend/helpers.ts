import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import express, { type Router } from "express";
import {
  createMockCtx,
  createTestDb,
  type MockPluginContext,
} from "@termix-ssh/plugin-sdk/testing";
import type {
  PluginHostSummary,
  PluginOperationInvokeOptions,
  PluginOperationOutcome,
} from "@termix-ssh/plugin-sdk/backend";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import manifestJson from "../../manifest.json";

export const manifest = manifestJson as unknown as PluginManifest;
const pluginDir = path.resolve(fileURLToPath(import.meta.url), "../../..");

export const host = (
  id: number,
  name: string,
  tags: string | null = null,
): PluginHostSummary => ({
  id,
  userId: "user-1",
  name,
  ip: `10.0.0.${id}`,
  port: 22,
  username: "root",
  tags,
  folder: null,
  authType: "password",
});

export type Invoke = (
  actionId: string,
  options: PluginOperationInvokeOptions,
) => Promise<PluginOperationOutcome>;

export interface TestServer {
  mock: MockPluginContext;
  calls: { actionId: string; options: PluginOperationInvokeOptions }[];
  request: (
    method: string,
    url: string,
    options?: { user?: string; body?: unknown },
  ) => Promise<{ status: number; body: any }>;
  close: () => Promise<void>;
}

export async function startServer(
  options: {
    invoke?: Invoke;
    permissions?: string[];
    hosts?: PluginHostSummary[];
  } = {},
): Promise<TestServer> {
  let router: Router | null = null;
  const db = await createTestDb(pluginDir);
  const mock = createMockCtx({
    pluginId: manifest.id,
    manifest,
    capabilities: manifest.capabilities,
    router: () => (router = express.Router()),
    permissions: options.permissions ?? [
      "operations-center.use",
      "operations-center.rules",
      "operations-center.mcp",
    ],
    hosts: options.hosts ?? [
      host(1, "web", "prod"),
      host(2, "db", "prod"),
      host(3, "lab", "test"),
    ],
    db: db.database,
    actor: "user-1",
  });
  const calls: TestServer["calls"] = [];
  const invoke: Invoke =
    options.invoke ??
    (async () => ({ runId: "run", status: "success", summary: "ok" }));
  mock.ctx.operations.invoke = async (actionId, invokeOptions = {}) => {
    calls.push({ actionId, options: invokeOptions });
    return invoke(actionId, invokeOptions);
  };

  const { activate } = await import("../../src/backend/index.js");
  await activate(mock.ctx);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    mock.setActor(req.header("x-test-user") ?? undefined);
    next();
  });
  app.use((req, res, next) => router!(req, res, next));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  return {
    mock,
    calls,
    async request(method, url, { user = "user-1", body } = {}) {
      const response = await fetch(`http://127.0.0.1:${port}${url}`, {
        method,
        headers: { "x-test-user": user, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        db.close?.();
      }),
  };
}

/** Polls until `check` is true or the time runs out. */
export async function until(check: () => Promise<boolean>, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out");
}
