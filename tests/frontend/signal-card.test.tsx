import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ loaded: false }));
const getSignal = vi.hoisted(() => vi.fn());

vi.mock("../../src/frontend/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getCatalog: vi.fn(async () => ({
    actions: [],
    events: [],
    resources: [],
    signals: [{ id: "disk", title: "Disk", scope: "host", read: "m.disk" }],
  })),
  getSignal,
}));
vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useHosts: () => ({ hosts: [], loaded: state.loaded }),
  useTranslation: () => ({ t: (key: string) => key, language: "en" }),
}));

import { SignalCard } from "../../src/frontend/tiles/DashboardTiles";

// Only the props these tests need.
const Card = SignalCard as unknown as (
  props: Record<string, unknown>,
) => ReturnType<typeof SignalCard>;

const shell = { openTab: vi.fn() } as never;

afterEach(() => {
  cleanup();
  getSignal.mockReset();
  state.loaded = false;
});

describe("SignalCard", () => {
  it("says loading, not no hosts, while hosts or reads are still coming", async () => {
    getSignal.mockResolvedValue({
      id: "disk",
      hosts: [{ hostId: 1, state: "loading" }],
    });
    state.loaded = true;
    render(<Card isVisible shell={shell} config={{ signal: "disk" }} />);
    await vi.waitFor(() => expect(getSignal).toHaveBeenCalled());
    expect(screen.queryByText("tiles.noHosts")).toBeNull();
  });

  it("says no hosts once every host answered", async () => {
    getSignal.mockResolvedValue({ id: "disk", hosts: [] });
    state.loaded = true;
    render(<Card isVisible shell={shell} config={{ signal: "disk" }} />);
    expect(await screen.findByText("tiles.noHosts")).toBeTruthy();
    expect(getSignal).toHaveBeenCalledWith("disk", undefined);
  });
});
