import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FRESH_MS,
  requestSection,
  resetSectionRequests,
  useSectionRequest,
} from "../../src/frontend/host-page-nav";
import { openHostPage } from "../../src/frontend/host-surfaces";

afterEach(() => {
  resetSectionRequests();
  vi.useRealTimers();
});

describe("section requests", () => {
  it("hands each host its own latest section", () => {
    const { result } = renderHook(() => useSectionRequest(7));
    expect(result.current).toBeUndefined();
    act(() => requestSection(7, "docker"));
    expect(result.current?.section).toBe("docker");
    act(() => requestSection(8, "files"));
    expect(result.current?.section).toBe("docker");
  });

  it("moves again when the same section is asked twice", () => {
    const { result } = renderHook(() => useSectionRequest("7"));
    act(() => requestSection(7, "docker"));
    const first = result.current!.seq;
    act(() => requestSection(7, "docker"));
    expect(result.current!.seq).toBeGreaterThan(first);
  });

  it("stamps the time so a late page can skip an old request", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    requestSection(1, "docker");
    const { result } = renderHook(() => useSectionRequest(1));
    expect(result.current!.at).toBe(1_000_000);
    expect(FRESH_MS).toBeGreaterThan(0);
  });
});

describe("openHostPage", () => {
  it("opens the page with no tab data so an open one is reused", () => {
    const shell = { openTab: vi.fn(), openSingletonTab: vi.fn() };
    const host = { id: 3, name: "web" } as never;
    openHostPage(shell, host, "docker");
    expect(shell.openTab).toHaveBeenCalledWith(host, "host");
    const { result } = renderHook(() => useSectionRequest(3));
    expect(result.current?.section).toBe("docker");
  });
});
