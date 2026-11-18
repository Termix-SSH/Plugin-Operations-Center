import { describe, expect, it, vi } from "vitest";

describe("useShellScroll", () => {
  it("uses Termix's hook when it has one", async () => {
    vi.resetModules();
    const hook = vi.fn();
    vi.doMock("@termix-ssh/plugin-sdk/frontend", () => ({
      useShellScroll: hook,
    }));
    const { useShellScroll } = await import("../../src/frontend/shell-scroll");
    useShellScroll(true);
    expect(hook).toHaveBeenCalledWith(true);
    vi.doUnmock("@termix-ssh/plugin-sdk/frontend");
  });

  it("does nothing on a Termix without it", async () => {
    vi.resetModules();
    vi.doMock("@termix-ssh/plugin-sdk/frontend", () => ({}));
    const { useShellScroll } = await import("../../src/frontend/shell-scroll");
    expect(() => useShellScroll(true)).not.toThrow();
    vi.doUnmock("@termix-ssh/plugin-sdk/frontend");
  });
});
