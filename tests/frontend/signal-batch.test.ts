import { afterEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@termix-ssh/plugin-sdk/ui", () => ({ operationsApi: { get } }));

import { getSignal, signalWarming } from "../../src/frontend/api";

afterEach(() => {
  get.mockReset();
});

describe("getSignal", () => {
  it("asks once for every signal wanted at about the same time", async () => {
    get.mockResolvedValue({
      data: {
        signals: [
          { id: "disk", hosts: [] },
          { id: "load", hosts: [] },
        ],
      },
    });
    const [disk, load, gone] = await Promise.all([
      getSignal("disk"),
      getSignal("load"),
      getSignal("gone"),
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/signals", {
      params: { hostIds: undefined, ids: "disk,load,gone" },
    });
    expect(disk?.id).toBe("disk");
    expect(load?.id).toBe("load");
    expect(gone).toBeNull();
  });

  it("keeps hosts apart and passes errors to each tile", async () => {
    get.mockRejectedValue(new Error("down"));
    const one = getSignal("disk", [1]);
    const all = getSignal("disk");
    await expect(one).rejects.toThrow("down");
    await expect(all).rejects.toThrow("down");
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("signalWarming", () => {
  it("is true only while a host is still loading", () => {
    expect(signalWarming(null)).toBe(false);
    expect(
      signalWarming({ id: "a", hosts: [{ hostId: 1, state: "ok" }] } as never),
    ).toBe(false);
    expect(
      signalWarming({
        id: "a",
        hosts: [{ hostId: 1, state: "loading" }],
      } as never),
    ).toBe(true);
  });
});
