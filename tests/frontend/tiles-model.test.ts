import { describe, expect, it } from "vitest";
import type { Catalog, CatalogAction } from "../../src/frontend/api";
import {
  defaultHostTiles,
  mergeHostTiles,
  parseTile,
  quickActions,
  tileAvailable,
  tilesForHost,
  type HostTileSources,
} from "../../src/frontend/tiles/model";

function action(id: string, extra: Partial<CatalogAction> = {}): CatalogAction {
  return {
    id,
    pluginId: id.split(".")[0],
    pluginName: id.split(".")[0],
    official: true,
    title: id,
    scope: "host",
    risk: "read",
    inputs: [],
    available: true,
    ...extra,
  };
}

const catalog: Catalog = {
  actions: [],
  events: [],
  signals: [],
  resources: [
    {
      id: "docker.containers",
      pluginId: "docker",
      title: "Containers",
      list: "docker.list",
      key: "id",
      name: "name",
      columns: [],
    },
  ],
};

const sources: HostTileSources = {
  catalog,
  actions: [
    action("docker.list"),
    action("docker.prune", { risk: "destructive" }),
    action("snippets.run", {
      inputs: [{ key: "snippet", type: "string", required: true } as never],
    }),
    action("host.reboot", { risk: "change" }),
  ],
  signals: ["metrics.health"],
  sessions: ["terminal"],
  sections: [],
  plugins: ["host-metrics.cpu"],
};

describe("parseTile", () => {
  it("reads prefixed and fixed ids", () => {
    expect(parseTile("signal:a.b")).toEqual({ kind: "signal", id: "a.b" });
    expect(parseTile("session:terminal")).toEqual({
      kind: "session",
      id: "terminal",
    });
    expect(parseTile("runs")).toEqual({ kind: "runs" });
    expect(parseTile("nope:x")).toBeNull();
    expect(parseTile("signal:")).toBeNull();
    expect(parseTile("plain")).toBeNull();
  });
});

describe("tileAvailable", () => {
  it("only offers what the host has", () => {
    expect(tileAvailable("signal:metrics.health", sources)).toBe(true);
    expect(tileAvailable("signal:other", sources)).toBe(false);
    expect(tileAvailable("action:docker.list", sources)).toBe(true);
    expect(tileAvailable("group:docker", sources)).toBe(true);
    expect(tileAvailable("resource:docker.containers", sources)).toBe(true);
    expect(tileAvailable("session:rdp", sources)).toBe(false);
    expect(tileAvailable("counts", sources)).toBe(true);
    expect(tileAvailable("counts", { ...sources, actions: [] })).toBe(false);
  });
});

describe("quickActions", () => {
  it("keeps host actions that need nothing and are not destructive", () => {
    expect(quickActions(sources.actions).map((a) => a.id)).toEqual([
      "docker.list",
      "host.reboot",
    ]);
  });
});

describe("defaultHostTiles", () => {
  it("puts status first, then the terminal, then the rest", () => {
    const ids = defaultHostTiles(sources).map((slot) => slot.id);
    expect(ids.slice(0, 3)).toEqual([
      "signal:metrics.health",
      "session:terminal",
      "runs",
    ]);
    expect(ids).toContain("plugin:host-metrics.cpu");
    expect(ids).toContain("counts");
    expect(ids).toContain("action:docker.list");
    expect(ids).not.toContain("action:docker.prune");
    expect(ids[ids.length - 1]).toBe("actions");
  });

  it("never lets a row run past 12 columns", () => {
    for (const slot of defaultHostTiles(sources))
      expect(slot.x + slot.w).toBeLessThanOrEqual(12);
  });

  it("leaves no gap above the actions tile on either side", () => {
    const tiles = defaultHostTiles({
      ...sources,
      plugins: ["m.cpu", "m.disk", "m.memory", "m.network"],
      actions: [
        action("a.one"),
        action("a.two"),
        action("a.three"),
        action("a.four"),
      ],
    });
    const actions = tiles.find((s) => s.id === "actions")!;
    const bottom = (half: (s: (typeof tiles)[number]) => boolean) =>
      Math.max(
        ...tiles
          .filter((s) => s.id !== "actions" && half(s))
          .map((s) => s.y + (s.h ?? 0)),
      );
    expect(bottom((s) => s.x < 6)).toBe(actions.y);
    expect(bottom((s) => s.x + s.w > 6)).toBe(actions.y);
  });
});

describe("shared layouts", () => {
  it("hides tiles a host lacks and keeps them for other hosts", () => {
    const saved = [
      { id: "runs", x: 0, y: 0, w: 6, h: null },
      { id: "session:rdp", x: 6, y: 0, w: 6, h: 300 },
    ];
    const shown = tilesForHost(saved, sources);
    expect(shown.map((slot) => slot.id)).toEqual(["runs"]);
    const edited = [{ id: "runs", x: 0, y: 0, w: 12, h: null }];
    expect(
      mergeHostTiles(saved, edited, sources).map((slot) => slot.id),
    ).toEqual(["runs", "session:rdp"]);
  });
});
