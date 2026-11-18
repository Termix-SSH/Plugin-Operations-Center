import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SessionSlot, type EmbedNodes } from "../../src/frontend/tiles/embeds";

vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

function nodes(wanted: string[] = []): EmbedNodes {
  return {
    nodeFor: vi.fn(() => document.createElement("div")),
    park: vi.fn(),
    show: vi.fn(),
    shown: new Set(),
    wanted: new Set(wanted),
    parking: { current: document.createElement("div") },
  };
}

afterEach(cleanup);

describe("session tile", () => {
  it("waits for Connect before it starts a session", () => {
    const embed = nodes();
    render(<SessionSlot type="rdp" embed={embed} />);
    expect(embed.show).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("tiles.connect"));
    expect(embed.show).toHaveBeenCalledWith("rdp");
  });

  it("shows a session that is already running", () => {
    const embed = nodes(["rdp"]);
    render(<SessionSlot type="rdp" embed={embed} />);
    expect(screen.queryByText("tiles.connect")).toBeNull();
    expect(embed.show).toHaveBeenCalledWith("rdp");
  });
});
