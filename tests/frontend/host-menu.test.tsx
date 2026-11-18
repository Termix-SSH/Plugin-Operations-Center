import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@termix-ssh/plugin-sdk/frontend")>()),
  useTranslation: () => ({ t: (key: string) => key, language: "en" }),
  useToast: () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

vi.mock("../../src/frontend/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/frontend/api")>()),
  getCatalog: async () => ({
    actions: [
      {
        id: "docker.restart",
        pluginId: "docker",
        pluginName: "Docker",
        title: "Restart",
        available: true,
        scope: "host",
        inputs: [],
        hostIds: [7],
      },
    ],
    events: [],
    resources: [],
    signals: [],
  }),
}));

import { HostMenuActions } from "../../src/frontend/host-surfaces";

const host = { id: 7, name: "web" } as never;

describe("HostMenuActions", () => {
  it("draws without a parent menu in a frame and opens the host page", async () => {
    const shell = { openTab: vi.fn(), openSingletonTab: vi.fn() };
    render(<HostMenuActions host={host} shell={shell} framed />);
    fireEvent.click(await screen.findByText("host.actions"));
    expect(shell.openTab).toHaveBeenCalledWith(host, "host");
  });
});
