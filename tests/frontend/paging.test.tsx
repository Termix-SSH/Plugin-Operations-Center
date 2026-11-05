import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { pageOf } from "../../src/frontend/parts";
import { byPlugin } from "../../src/frontend/host-surfaces";
import { filterActions, pluginOptions } from "../../src/frontend/parts";
import type { CatalogAction } from "../../src/frontend/api";

afterEach(cleanup);

describe("pageOf", () => {
  const items = Array.from({ length: 23 }, (_, i) => i);

  it("cuts a list into pages", () => {
    expect(pageOf(items, 0, 10)).toEqual({
      rows: items.slice(0, 10),
      page: 0,
      pages: 3,
    });
    expect(pageOf(items, 2, 10).rows).toEqual([20, 21, 22]);
  });

  it("keeps the page in range when the list shrinks", () => {
    expect(pageOf(items, 9, 10).page).toBe(2);
    expect(pageOf([], 3, 10)).toEqual({ rows: [], page: 0, pages: 1 });
  });
});

describe("byPlugin", () => {
  const action = (pluginName: string, title: string) =>
    ({ id: `${pluginName}.${title}`, pluginName, title }) as CatalogAction;

  it("groups by plugin with names in order", () => {
    const groups = byPlugin([
      action("Services", "Restart"),
      action("Docker", "Stop"),
      action("Docker", "Restart"),
    ]);
    expect(groups.map((group) => group.plugin)).toEqual(["Docker", "Services"]);
    expect(groups[0].actions.map((entry) => entry.title)).toEqual([
      "Restart",
      "Stop",
    ]);
  });
});

describe("pluginOptions", () => {
  it("lists each plugin once with its count, by name", () => {
    const entry = (pluginId: string, pluginName: string) =>
      ({ id: `${pluginId}.x`, pluginId, pluginName, title: "x" }) as never;
    expect(
      pluginOptions([
        entry("service-manager", "Services"),
        entry("docker", "Docker"),
        entry("docker", "Docker"),
      ]),
    ).toEqual([
      { id: "docker", name: "Docker", count: 2 },
      { id: "service-manager", name: "Services", count: 1 },
    ]);
  });
});

describe("filterActions", () => {
  const entry = (pluginId: string, title: string) =>
    ({
      id: `${pluginId}.${title}`,
      pluginId,
      pluginName: pluginId,
      title,
    }) as never;
  const list = [
    entry("docker", "Restart"),
    entry("docker", "Stop"),
    entry("services", "Restart"),
  ];

  it("keeps one plugin and the search", () => {
    const result = filterActions(list, "docker", "stop");
    expect(result.plugin).toBe("docker");
    expect(result.matching).toHaveLength(1);
  });

  it("falls back to all plugins when the picked one is gone", () => {
    const result = filterActions(list, "tunnels", "restart");
    expect(result.plugin).toBe("");
    expect(result.matching).toHaveLength(2);
  });
});
