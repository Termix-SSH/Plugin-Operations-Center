# Changelog

## 1.0.0

### Added

- Operations tab to run any action any plugin offers, with a form, a dry run and the result
- Rollouts: one action across many hosts with a canary, batches, a pause between them and a failure limit
- History of every action with who ran it, from where and what happened, plus cancel and undo. Filter it by action, host or status
- Approvals for actions a rule holds, showing exactly what will run
- Approval rules by risk, plugin, action, where a run came from and host tag
- Drift checks that run on a schedule, show which hosts drifted and can fix them
- A page per host with its terminal and other sessions, every tool, status tiles, counts and recent changes in one tab
- A host page panel beside terminals, a Host page button in the tab bar and an Open host page item when you right click a tab
- A dot on host rows while a status tile on the host is warning or failing. It can be turned off in settings
- The host's actions in the host menu, one list per plugin
- Host tools can open inside the host page when Classic Layout is set to do that
- All hosts tables, such as every container or service, with filters and bulk actions
- MCP server for outside AI tools, using an API key
- Needs attention dashboard card
- Every action in the command palette
- Status tiles, action button and found links widgets for the homepage. Found links lists web addresses plugins know about, such as proxy routes
