import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getSignals } = vi.hoisted(() => ({ getSignals: vi.fn() }));

vi.mock("../../src/frontend/api", () => ({
  getCatalog: vi.fn(async () => ({
    actions: [],
    events: [],
    resources: [],
    signals: [
      { id: "disk", title: "Disk", pluginId: "m", read: "m.disk" },
      { id: "load", title: "Load", pluginId: "m", read: "m.load" },
    ],
  })),
  getSignals,
}));

import {
  resetAttention,
  useHostAttention,
} from "../../src/frontend/host-attention";

afterEach(() => {
  resetAttention();
  getSignals.mockReset();
});

describe("useHostAttention", () => {
  it("reads only the hosts on screen and keeps the worst tone", async () => {
    getSignals.mockResolvedValue([
      {
        id: "disk",
        hosts: [
          { hostId: 1, state: "ok", value: { status: "warn", label: "91%" } },
          { hostId: 2, state: "ok", value: { status: "ok" } },
        ],
      },
      {
        id: "load",
        hosts: [{ hostId: 1, state: "ok", value: { status: "fail" } }],
      },
    ]);
    const one = renderHook(() => useHostAttention(1));
    const two = renderHook(() => useHostAttention(2));
    await waitFor(() => expect(one.result.current).toBeDefined());
    expect(getSignals).toHaveBeenCalledWith([1, 2]);
    expect(one.result.current).toEqual({
      tone: "fail",
      lines: ["Disk: 91%", "Load"],
    });
    expect(two.result.current).toBeUndefined();
  });

  it("reads nothing while the dot is turned off", async () => {
    getSignals.mockResolvedValue([]);
    const row = renderHook(() => useHostAttention(9, false));
    await act(async () => {});
    expect(getSignals).not.toHaveBeenCalled();
    expect(row.result.current).toBeUndefined();
  });

  it("stops asking once no row shows the host", async () => {
    getSignals.mockResolvedValue([]);
    const row = renderHook(() => useHostAttention(5));
    await waitFor(() => expect(getSignals).toHaveBeenCalledTimes(1));
    act(() => row.unmount());
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(120_000);
    vi.useRealTimers();
    expect(getSignals).toHaveBeenCalledTimes(1);
  });
});
