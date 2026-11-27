export const AI_CLIENTS = ["claude", "codex", "cursor", "other"] as const;
export type AiClient = (typeof AI_CLIENTS)[number];

/** Where the MCP server answers, from the address the browser is on. */
export function mcpUrl(origin: string, basePath: string): string {
  return `${origin}${basePath.replace(/\/$/, "")}/plugin-api/operations-center/mcp`;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** What to paste into each tool so it reaches Termix with this key. */
export function setupFor(client: AiClient, url: string, token: string): string {
  const header = `Bearer ${token}`;
  switch (client) {
    case "claude":
      return `claude mcp add --transport http termix ${url} --header "Authorization: ${header}"`;
    case "codex":
      return [
        "[mcp_servers.termix]",
        `url = ${JSON.stringify(url)}`,
        `http_headers = { Authorization = ${JSON.stringify(header)} }`,
      ].join("\n");
    case "cursor":
      return json({
        mcpServers: { termix: { url, headers: { Authorization: header } } },
      });
    case "other":
      return json({ url, headers: { Authorization: header } });
  }
}
