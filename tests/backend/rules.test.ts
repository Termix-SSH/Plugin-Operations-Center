import { describe, expect, it } from "vitest";
import type { PluginOperationApprovalInput } from "@termix-ssh/plugin-sdk/backend";
import {
  decide,
  originName,
  ruleMatches,
  toRule,
} from "../../src/backend/rules";
import type { Rule } from "../../src/shared/types";

const input = (
  overrides: Partial<PluginOperationApprovalInput> = {},
): PluginOperationApprovalInput => ({
  actionId: "docker.restart-container",
  pluginId: "docker",
  risk: "change",
  effectiveRisk: "change",
  origin: { kind: "ui" },
  userId: "user-1",
  hostId: 1,
  hostTags: ["prod"],
  ...overrides,
});

const rule = (overrides: Partial<Rule> = {}): Rule => ({
  id: 1,
  name: "rule",
  position: 0,
  enabled: true,
  effect: "approve",
  minRisk: "change",
  origins: [],
  pluginIds: [],
  actionIds: [],
  hostTags: [],
  allowSelf: false,
  expiresInMinutes: null,
  ...overrides,
});

describe("rules", () => {
  it("names a plugin origin by what it was doing", () => {
    expect(originName({ kind: "plugin", via: "assistant" })).toBe("assistant");
    expect(originName({ kind: "plugin" })).toBe("plugin");
    expect(originName({ kind: "api" })).toBe("api");
  });

  it("skips reads below the rule's risk", () => {
    expect(ruleMatches(rule(), input({ effectiveRisk: "read" }))).toBe(false);
    expect(
      ruleMatches(rule({ minRisk: "read" }), input({ effectiveRisk: "read" })),
    ).toBe(true);
  });

  it("goes by the effective risk, not the declared one", () => {
    expect(
      ruleMatches(rule(), input({ risk: "read", effectiveRisk: "change" })),
    ).toBe(true);
  });

  it("matches origins, plugins, actions and tags", () => {
    const assistant = input({ origin: { kind: "plugin", via: "assistant" } });
    expect(ruleMatches(rule({ origins: ["assistant"] }), assistant)).toBe(true);
    expect(ruleMatches(rule({ origins: ["mcp"] }), assistant)).toBe(false);
    expect(ruleMatches(rule({ pluginIds: ["firewall"] }), input())).toBe(false);
    expect(
      ruleMatches(rule({ actionIds: ["docker.restart-container"] }), input()),
    ).toBe(true);
    expect(ruleMatches(rule({ hostTags: ["prod"] }), input())).toBe(true);
    expect(ruleMatches(rule({ hostTags: ["lab"] }), input())).toBe(false);
  });

  it("ignores rules that are off", () => {
    expect(ruleMatches(rule({ enabled: false }), input())).toBe(false);
  });

  it("lets the first match decide", () => {
    const result = decide(
      [
        rule({ id: 1, name: "first", effect: "deny", hostTags: ["prod"] }),
        rule({ id: 2, name: "second", effect: "allow" }),
      ],
      input(),
    );
    expect(result).toMatchObject({ decision: "deny", reason: "first" });
  });

  it("leaves it to core when nothing matches", () => {
    expect(decide([rule({ pluginIds: ["x"] })], input())).toBeNull();
  });

  it("reads stored rows safely", () => {
    const parsed = toRule({
      id: 3,
      name: "x",
      effect: "nonsense",
      minRisk: "huge",
      origins: '["mcp"]',
      hostTags: "not json",
    });
    expect(parsed.effect).toBe("approve");
    expect(parsed.minRisk).toBe("change");
    expect(parsed.origins).toEqual(["mcp"]);
    expect(parsed.hostTags).toEqual([]);
  });
});
