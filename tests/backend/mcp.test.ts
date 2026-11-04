import { afterEach, describe, expect, it } from "vitest";
import { actionIdOf, toolFor, toolName } from "../../src/backend/mcp";
import { startServer, type TestServer } from "./helpers";

let server: TestServer | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

const action = {
  id: "docker.restart-container",
  title: "Restart container",
  scope: "resource" as const,
  risk: "change",
  inputSchema: { type: "object", properties: {} },
  available: true,
};

const rpc = (method: string, params?: unknown, id: number | null = 1) => ({
  jsonrpc: "2.0",
  id,
  method,
  params,
});

describe("mcp tools", () => {
  it("round trips action ids through tool names", () => {
    expect(toolName("docker.restart-container")).toBe(
      "docker__restart-container",
    );
    expect(actionIdOf("docker__restart-container")).toBe(
      "docker.restart-container",
    );
  });

  it("asks for a host and target for a resource action", () => {
    const tool = toolFor(action);
    expect(tool.inputSchema.required).toEqual(["hostId", "resourceKey"]);
    expect(tool.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
    });
  });
});

describe("mcp route", () => {
  async function withCatalog() {
    server = await startServer();
    server.mock.ctx.operations.list = async () => ({ actions: [action] });
    return server;
  }

  it("answers initialize and lists tools", async () => {
    const s = await withCatalog();
    const init = await s.request("POST", "/mcp", {
      body: rpc("initialize", {}),
    });
    expect(init.body.result.serverInfo.name).toBe("termix");
    const list = await s.request("POST", "/mcp", { body: rpc("tools/list") });
    expect(
      list.body.result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual(["list_hosts", "docker__restart-container"]);
  });

  it("calls through the gate as mcp", async () => {
    const s = await withCatalog();
    const call = await s.request("POST", "/mcp", {
      body: rpc("tools/call", {
        name: "docker__restart-container",
        arguments: { hostId: 1, resourceKey: "web" },
      }),
    });
    expect(call.body.result.isError).toBe(false);
    expect(s.calls[0]).toMatchObject({
      actionId: "docker.restart-container",
      options: { hostId: 1, resourceKey: "web", via: "mcp" },
    });
  });

  it("refuses tools the catalog does not offer", async () => {
    const s = await withCatalog();
    const call = await s.request("POST", "/mcp", {
      body: rpc("tools/call", { name: "firewall__delete-rule", arguments: {} }),
    });
    expect(call.body.error.code).toBe(-32602);
    expect(s.calls).toHaveLength(0);
  });

  it("says when a change waits for approval", async () => {
    server = await startServer({
      invoke: async () => ({ runId: "r1", status: "pending_approval" }),
    });
    server.mock.ctx.operations.list = async () => ({ actions: [action] });
    const call = await server.request("POST", "/mcp", {
      body: rpc("tools/call", {
        name: "docker__restart-container",
        arguments: { hostId: 1, resourceKey: "web" },
      }),
    });
    expect(call.body.result.content[0].text).toContain("approve");
  });

  it("does not answer a notification", async () => {
    const s = await withCatalog();
    const response = await s.request("POST", "/mcp", {
      body: rpc("notifications/initialized", undefined, null),
    });
    expect(response.status).toBe(202);
  });

  it("needs the mcp permission", async () => {
    server = await startServer({ permissions: ["operations-center.use"] });
    const response = await server.request("POST", "/mcp", {
      body: rpc("ping"),
    });
    expect(response.status).toBe(403);
  });
});
