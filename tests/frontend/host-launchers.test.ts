import { describe, expect, it, vi } from "vitest";
import { launchersFor } from "../../src/frontend/host-launchers";

const t = (key: string) => `t:${key}`;
const icon = () => null;

describe("launchersFor", () => {
  it("skips tools the page can embed and connect actions", () => {
    const list = launchersFor(
      [
        { id: "files", kind: "open", titleKey: "f", icon, tabType: "files" },
        { id: "ssh", kind: "connect", titleKey: "s", icon, run: vi.fn() },
      ],
      { id: 1 },
      t,
    );
    expect(list).toEqual([]);
  });

  it("adds one entry for a run only tool and runs it with the host", () => {
    const run = vi.fn();
    const host = { id: 9 };
    const [entry] = launchersFor(
      [{ id: "tmux", kind: "open", titleKey: "nav.tmux", icon, run }],
      host,
      t,
    );
    expect(entry.id).toBe("launch:tmux");
    expect(entry.label).toBe("t:nav.tmux");
    entry.run("shell");
    expect(run).toHaveBeenCalledWith(host, "shell");
  });

  it("adds one entry per item", () => {
    const first = vi.fn();
    const list = launchersFor(
      [
        {
          id: "web",
          kind: "open",
          titleKey: "w",
          icon,
          items: () => [
            { id: "a", label: "Grafana", run: first },
            { id: "b", label: "Proxmox", run: vi.fn() },
          ],
        },
      ],
      { id: 2 },
      t,
    );
    expect(list.map((entry) => entry.label)).toEqual(["Grafana", "Proxmox"]);
    list[0].run("shell");
    expect(first).toHaveBeenCalled();
  });

  it("drops an action whose items throw", () => {
    const list = launchersFor(
      [
        {
          id: "bad",
          kind: "open",
          titleKey: "b",
          icon,
          items: () => {
            throw new Error("boom");
          },
        },
      ],
      { id: 3 },
      t,
    );
    expect(list).toEqual([]);
  });
});
