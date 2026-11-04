import { afterEach, describe, expect, it } from "vitest";
import { startServer, until, type TestServer } from "./helpers";

let server: TestServer | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

describe("approval rules", () => {
  it("starts with the assistant and MCP rules", async () => {
    server = await startServer();
    const { body } = await server.request("GET", "/rules");
    expect(
      body.rules.map((rule: { origins: string[] }) => rule.origins),
    ).toEqual([
      ["assistant", "mcp"],
      ["assistant", "mcp"],
    ]);
  });

  it("needs the rules permission to change them", async () => {
    server = await startServer({ permissions: ["operations-center.use"] });
    const { status } = await server.request("POST", "/rules", {
      body: { name: "x", effect: "deny", minRisk: "change" },
    });
    expect(status).toBe(403);
  });

  it("saves a rule and checks its shape", async () => {
    server = await startServer();
    const bad = await server.request("POST", "/rules", {
      body: { name: "x", effect: "maybe", minRisk: "change" },
    });
    expect(bad.status).toBe(400);
    const good = await server.request("POST", "/rules", {
      body: {
        name: "Prod needs approval",
        effect: "approve",
        minRisk: "change",
        hostTags: ["prod"],
        position: 5,
      },
    });
    expect(good.status).toBe(200);
    expect(good.body.rules).toHaveLength(3);
  });
});

describe("rollouts", () => {
  it("runs a canary, then batches, as a rollout", async () => {
    server = await startServer();
    const { body } = await server.request("POST", "/rollouts", {
      body: {
        actionId: "docker.restart-container",
        resourceKey: "web",
        targets: { tags: ["prod"], hostIds: [3] },
        canary: 1,
        batchSize: 2,
        input: { force: true },
        start: true,
      },
    });
    const id = body.rollout.id;
    await until(async () => {
      const { body: got } = await server!.request("GET", `/rollouts/${id}`);
      return got.batch.status === "done";
    });
    expect(server.calls).toHaveLength(3);
    for (const call of server.calls) {
      expect(call.options).toMatchObject({
        via: "rollout",
        resourceKey: "web",
        input: { force: true },
        confirmed: true,
      });
    }
    expect(new Set(server.calls.map((call) => call.options.hostId))).toEqual(
      new Set([1, 2, 3]),
    );
  });

  it("pauses after too many failures", async () => {
    server = await startServer({
      invoke: async () => ({ runId: "r", status: "failed", error: "no" }),
    });
    const { body } = await server.request("POST", "/rollouts", {
      body: {
        actionId: "docker.restart-container",
        targets: { hostIds: [1, 2, 3] },
        canary: 1,
        stopAfterFailures: 1,
        start: true,
      },
    });
    const id = body.rollout.id;
    await until(async () => {
      const { body: got } = await server!.request("GET", `/rollouts/${id}`);
      return got.batch.status === "paused";
    });
    expect(server.calls).toHaveLength(1);
    const { body: got } = await server.request("GET", `/rollouts/${id}`);
    expect(got.batch.pausedReason).toContain("1 failed");
    expect(
      got.targets.filter((t: { status: string }) => t.status === "waiting"),
    ).toHaveLength(2);
  });

  it("records a target held for approval", async () => {
    server = await startServer({
      invoke: async () => ({ runId: "r", status: "pending_approval" }),
    });
    const { body } = await server.request("POST", "/rollouts", {
      body: {
        actionId: "docker.restart-container",
        targets: { hostIds: [1] },
        start: true,
      },
    });
    await until(async () => {
      const { body: got } = await server!.request(
        "GET",
        `/rollouts/${body.rollout.id}`,
      );
      return got.targets[0].status === "pending_approval";
    });
  });

  it("refuses targets that match nothing", async () => {
    server = await startServer();
    const { status, body } = await server.request("POST", "/rollouts", {
      body: {
        actionId: "docker.restart-container",
        targets: { tags: ["none"] },
      },
    });
    expect(status).toBe(400);
    expect(body.error).toContain("No hosts");
  });

  it("only shows a user their own rollouts", async () => {
    server = await startServer();
    const { body } = await server.request("POST", "/rollouts", {
      body: { actionId: "docker.restart-container", targets: { hostIds: [1] } },
    });
    const other = await server.request("GET", `/rollouts/${body.rollout.id}`, {
      user: "user-2",
    });
    expect(other.status).toBe(404);
  });

  it("does not resume after a restart", async () => {
    server = await startServer({
      invoke: () => new Promise(() => {}),
    });
    const { body } = await server.request("POST", "/rollouts", {
      body: { actionId: "x.y", targets: { hostIds: [1] }, start: true },
    });
    expect(body.rollout).toBeDefined();
    const { createRollouts } = await import("../../src/backend/rollouts.js");
    const { batches, batchTargets } =
      await import("../../src/backend/tables.js");
    const fresh = createRollouts(server.mock.ctx, {
      batches: await server.mock.ctx.db.define(batches),
      targets: await server.mock.ctx.db.define(batchTargets),
    });
    await fresh.recover();
    const { body: got } = await server.request(
      "GET",
      `/rollouts/${body.rollout.id}`,
    );
    expect(got.batch.status).toBe("paused");
    expect(got.targets[0].status).toBe("failed");
  });
});

describe("drift", () => {
  it("records drifted hosts and fixes them when asked", async () => {
    server = await startServer({
      invoke: async (actionId, options) =>
        actionId === "firewall.port-allowed"
          ? {
              runId: null,
              status: "success",
              data: { compliant: options.hostId !== 2 },
            }
          : { runId: "fix", status: "success" },
    });
    await server.request("POST", "/baselines", {
      body: {
        name: "443 open",
        checkActionId: "firewall.port-allowed",
        targets: { tags: ["prod"] },
        fixActionId: "firewall.allow-port",
        autoFix: true,
        input: { port: 443 },
      },
    });
    const { body } = await server.request("GET", "/baselines");
    const id = body.baselines[0].id;
    await server.request("POST", `/baselines/${id}/run`);
    await until(async () => {
      const { body: got } = await server!.request(
        "GET",
        `/baselines/${id}/results`,
      );
      return got.results.length === 2;
    });
    const { body: got } = await server.request(
      "GET",
      `/baselines/${id}/results`,
    );
    expect(
      Object.fromEntries(
        got.results.map((r: { hostId: number; state: string }) => [
          r.hostId,
          r.state,
        ]),
      ),
    ).toEqual({ 1: "compliant", 2: "drifted" });
    const fix = server.calls.find(
      (call) => call.actionId === "firewall.allow-port",
    );
    expect(fix?.options).toMatchObject({
      hostId: 2,
      via: "drift",
      input: { port: 443 },
    });
    const attention = await server.request("GET", "/attention");
    expect(attention.body.drifted).toBe(1);
    expect(attention.body.running).toBe(0);
  });
});
