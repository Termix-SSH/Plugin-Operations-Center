Operations Center is where you run and watch the actions other plugins offer. Plugins such as Docker, Services, Wake-on-LAN, Kubernetes and Host Metrics declare what they can do, and every one of those actions shows up here with no setup.

Open it from the Operations button in the rail, or search for an action in the command palette.

## Run an action

1. Open Operations and pick Run.
2. Search for an action and pick it, or pick a plugin to see only its actions. Only hosts where the action applies are offered.
3. For an action on one item, such as a container, pick it from the list.
4. Fill in the form and press Dry run to see what would happen, or Run.

Every run is checked the same way wherever it starts: your role permissions, your access to the host, the action's inputs and the approval rules. Destructive actions ask before they run.

## Host page

Each host has a Host page. Open it from the host's menu or the Host page button. It has:

- The host's status and the buttons to connect. Terminal, remote desktop and other sessions open inside the page.
- Status tiles from every plugin, such as unhealthy containers or failed services, with a fix button.
- How many containers, services and other things the host has.
- Every action on the host, by plugin, 10 to a page. Search finds any of them, and the plugin list next to it shows one plugin's actions. Actions that work on one thing, such as restarting a container, ask which one.
- Recent changes on the host, a page at a time.
- Every session and tool for the host on the left. They open inside the page and keep running while you move between them, so you need one tab instead of ten. Open in its own tab puts one back in a normal tab, for split view.

The tool buttons on a host row still open their own tabs, like always. To open them inside the host page instead, go to Customize sidebar and set Open host tools in to The host page. Then each button shows that tool on the host's page, and a page already open for the host is reused.

Pick Only the host page to make the page the one way to work with a host. Host rows lose their connect buttons, and a click on a host opens its page. Ctrl click or middle click still opens a second page.

The host page also shows up in other places:

- Beside a terminal, as a panel with the host's status tiles and actions. Open it from the panel bar on the terminal's edge.
- In the tab bar, where the Host page button opens the page for the host you are working on. Right click a tab for the same thing.
- On the host row, where a dot shows next to the name while one of the host's status tiles is warning or failing. Hover it to see which. Turn it off with Show the attention dot in this plugin's settings.
- In the host's menu, under Actions, with one list per plugin. Actions with nothing to fill in run right away; the rest open with their form.

## All hosts

All hosts shows one kind of thing across every host, such as every container or every service. Filter by host or status, search the table, select rows on any hosts and run an action on all of them at once. Click a host name to open its host page. Hosts answer in the background, so the table fills in as they reply.

History can show one action, one host or one status. Long lists in every view show a page at a time.

## Rollouts

A rollout runs one action across many hosts in steps:

- Canary hosts run first.
- Then hosts at a time, with an optional wait between groups.
- Stop after failures pauses the rollout when that many hosts fail. 0 never stops.

Pick hosts one by one or by tag. Pause, stop, resume or retry the hosts that failed at any time. If Termix restarts during a rollout, it waits for you to check the hosts and resume. It never carries on with a change on its own.

## Approvals and rules

Rules decide what needs a person. They are checked from the top, and the first one that matches decides:

- Run: goes ahead.
- Needs approval: waits in Approvals until someone with the same access approves or rejects it.
- Refuse: never runs.

A rule can match how risky an action is, which plugin and action it is, where the run came from (the web app, an API key, an automation, a rollout, a drift check, the assistant or MCP) and host tags. With no match, people and their automations go by their permissions, and the assistant and MCP can't change anything. A new server starts with two rules: the assistant and MCP can read, and their changes need approval.

The person who asked can't approve their own request, unless the rule allows it or the request came from the assistant, MCP or an automation. Changing rules needs the Manage approval rules permission.

Plugins run inside Termix, so how risky an action is comes from the plugin. Plugins that are not signed as official always count as changes.

## Drift

A baseline is a check that should always pass, such as a firewall port being open. It runs on the hosts you pick every few minutes and shows which hosts are as expected and which drifted. Add a fix action to fix drifted hosts with one click, or let the baseline fix them on its own. Approval rules still apply to the fix. You get an alert when a host drifts.

## MCP

Operations Center has an MCP server, so AI tools like Claude Code can use Termix actions.

1. Give the user the Use the MCP server permission.
2. Make an API key in Termix, limited to Read actions or Run actions.
3. Point the tool at `https://your-termix/plugin-api/operations-center/mcp` with the header `Authorization: Bearer <key>`.

Only actions a plugin marked safe for MCP are offered. Changes follow the approval rules, so by default they wait for you in Approvals.

## Needs attention

Add the Needs attention card to the dashboard to see failing status tiles, waiting approvals, failed runs, drifted hosts and stopped rollouts in one place.

## Homepage widgets

With the Homepage plugin on, add these widgets to your homepage:

- Status tiles: what every plugin reports about your hosts. Pick which tiles to show, or only the ones with a problem.
- Found links: web addresses plugins know about, such as Reverse Proxy routes, kept up to date with nothing to type in.
- Action button: one button that runs an action, such as restarting a service on a host. It goes through the same checks and rules as any other run.
