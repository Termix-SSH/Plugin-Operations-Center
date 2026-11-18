import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  getSignals: vi.fn(),
  listApprovals: vi.fn(),
  listRuns: vi.fn(),
  getAttention: vi.fn(),
}));
const hostsHook = vi.hoisted(() => ({ hosts: [] as unknown[] }));

vi.mock("../../src/frontend/api", () => ({ ...api, WARMING_POLL_MS: 2000 }));
vi.mock("@termix-ssh/plugin-sdk/frontend", () => ({
  useHosts: () => ({ hosts: hostsHook.hosts, loaded: true }),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.count !== undefined ? `${key}:${values.count}` : key,
    language: "en",
  }),
}));
vi.mock("@termix-ssh/plugin-sdk/ui", () => ({
  ListRow: ({ title }: { title: string }) => <div>{title}</div>,
  LoadingState: ({ label }: { label: string }) => <div>{label}</div>,
}));

import { AttentionCard } from "../../src/frontend/AttentionCard";

// Only the props these tests need.
const Card = AttentionCard as unknown as (
  props: Record<string, unknown>,
) => ReturnType<typeof AttentionCard>;

const never = () => new Promise<never>(() => {});
const shell = { openSingletonTab: vi.fn(), openTab: vi.fn() } as never;

afterEach(() => {
  cleanup();
  for (const fn of Object.values(api)) fn.mockReset();
});

describe("AttentionCard", () => {
  it("shows approvals before the slow signals answer", async () => {
    api.getCatalog.mockImplementation(never);
    api.getSignals.mockImplementation(never);
    api.listApprovals.mockResolvedValue([{}, {}]);
    api.listRuns.mockResolvedValue([]);
    api.getAttention.mockResolvedValue(null);
    render(<Card isVisible shell={shell} />);
    expect(await screen.findByText("attention.approvals:2")).toBeTruthy();
  });

  it("says all good only once every source answered", async () => {
    let finish: (value: unknown[]) => void = () => {};
    api.getCatalog.mockResolvedValue(null);
    api.getSignals.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    api.listApprovals.mockResolvedValue([]);
    api.listRuns.mockResolvedValue([]);
    api.getAttention.mockResolvedValue(null);
    render(<Card isVisible shell={shell} />);
    expect(await screen.findByText("attention.loading")).toBeTruthy();
    finish([]);
    expect(await screen.findByText("attention.allGood")).toBeTruthy();
  });

  it("does not ask again when the host list changes", async () => {
    api.getCatalog.mockResolvedValue(null);
    api.getSignals.mockResolvedValue([]);
    api.listApprovals.mockResolvedValue([]);
    api.listRuns.mockResolvedValue([]);
    api.getAttention.mockResolvedValue(null);
    const view = render(<Card isVisible shell={shell} />);
    await screen.findByText("attention.allGood");
    hostsHook.hosts = [{ id: 1 }];
    view.rerender(<Card isVisible shell={shell} />);
    await screen.findByText("attention.allGood");
    expect(api.getSignals).toHaveBeenCalledTimes(1);
    hostsHook.hosts = [];
  });
});
