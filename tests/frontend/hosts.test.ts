import { describe, expect, it } from "vitest";
import type { PluginHostRecord } from "@termix-ssh/plugin-sdk/frontend";
import { appliesTo } from "../../src/frontend/hosts";
import type { CatalogAction } from "../../src/frontend/api";

const action = (extra: Partial<CatalogAction>): CatalogAction => ({
  id: "docker.restart",
  pluginId: "docker",
  pluginName: "Docker",
  official: true,
  title: "Restart",
  scope: "host",
  risk: "change",
  inputs: [],
  available: true,
  ...extra,
});

// What a plugin sees: only its own host settings, never Docker's.
const host = (id: number) =>
  ({ id, name: `h${id}`, pluginSettings: {} }) as unknown as PluginHostRecord;

describe("appliesTo", () => {
  it("uses the hosts core says a when action fits", () => {
    const restart = action({
      when: { settings: { enableDocker: true } },
      hostIds: [2],
    });
    expect(appliesTo(restart, host(1))).toBe(false);
    expect(appliesTo(restart, host(2))).toBe(true);
  });

  it("fits every host when the action has no when", () => {
    expect(appliesTo(action({}), host(5))).toBe(true);
  });

  it("never fits a server action to a host", () => {
    expect(appliesTo(action({ scope: "server" }), host(1))).toBe(false);
  });
});
