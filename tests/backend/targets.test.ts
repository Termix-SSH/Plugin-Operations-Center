import { describe, expect, it } from "vitest";
import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";
import { resolveTargets } from "../../src/backend/targets.js";

function fakeCtx(fleets: unknown): PluginContext {
  return {
    hosts: {
      list: async () => [
        { id: 1, name: "web", tags: "prod" },
        { id: 2, name: "db", tags: "" },
        { id: 3, name: "lab", tags: "" },
      ],
    },
    // In a plugin process every services call answers through a promise.
    services: { get: async () => fleets },
  } as unknown as PluginContext;
}

describe("resolveTargets", () => {
  it("picks fleet members when services answer through a promise", async () => {
    const ctx = fakeCtx({ members: async () => [{ id: 3 }, { id: 9 }] });
    const targets = await resolveTargets(ctx, {
      fleetIds: [4],
      tags: ["prod"],
    });
    expect(targets.map((t) => t.hostId).sort()).toEqual([1, 3]);
  });

  it("matches nothing from fleets when Fleets is off", async () => {
    const ctx = {
      ...fakeCtx(null),
      services: {
        get: async () => {
          throw new Error("not running");
        },
      },
    } as unknown as PluginContext;
    expect(await resolveTargets(ctx, { fleetIds: [4] })).toEqual([]);
  });
});
