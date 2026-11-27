import { describe, expect, it } from "vitest";
import { mcpUrl, setupFor } from "../../src/frontend/connect-ai";

const URL = "https://termix.example.com/plugin-api/operations-center/mcp";

describe("connect ai setup", () => {
  it("builds the address under a base path", () => {
    expect(mcpUrl("https://termix.example.com", "")).toBe(URL);
    expect(mcpUrl("https://example.com", "/termix/")).toBe(
      "https://example.com/termix/plugin-api/operations-center/mcp",
    );
  });

  it("gives Claude Code one command", () => {
    expect(setupFor("claude", URL, "tmx_1")).toBe(
      `claude mcp add --transport http termix ${URL} --header "Authorization: Bearer tmx_1"`,
    );
  });

  it("gives Codex a config table", () => {
    expect(setupFor("codex", URL, "tmx_1")).toContain(
      'http_headers = { Authorization = "Bearer tmx_1" }',
    );
  });

  it("gives Cursor a server entry it can parse", () => {
    expect(JSON.parse(setupFor("cursor", URL, "tmx_1"))).toEqual({
      mcpServers: {
        termix: { url: URL, headers: { Authorization: "Bearer tmx_1" } },
      },
    });
  });
});
