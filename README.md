# DarkNotes MCP Server

Connect your DarkNotes to Claude and any MCP-compatible AI client.

## What this does

- **REST API** (port 3737) — the DarkNotes browser app saves notes here instead of just localStorage
- **MCP Server** (stdio) — Claude Desktop / Claude Code can read and write your notes directly

All data is stored in `~/.darknotes/data.json`.

---

## Quick start

### 1. Install dependencies
```bash
cd darknotes-mcp
npm install
```

### 2. Run the server

**API only** (browser app syncs here while you work):
```bash
node server.js --api
```

**MCP only** (for Claude Desktop / Claude Code — uses stdio):
```bash
node server.js
```

**Both simultaneously**:
```bash
node server.js --both
```

### 3. Open the browser app
Open `notes-app.html` in your browser. The green dot in the toolbar confirms the API is connected.

### 4. Configure MCP Clients

#### Option A: Stdio (Node executable)
This is the default for Claude Desktop. Use `node server.js` in your config.

#### Option B: HTTP (SSE)
You can connect to a running DarkNotes server via HTTP. This is useful for Docker or remote setups.
1. Start the server with `node server.js --api` or `--both`.
2. Connect your client to `http://localhost:3737/mcp/sse`.

---

### 5. Configure Claude Desktop (MCP)

Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "darknotes": {
      "command": "node",
      "args": ["/absolute/path/to/darknotes-mcp/server.js"]
    }
  }
}
```

Config file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### 6. Configure Claude Code (MCP)

```bash
claude mcp add darknotes node /absolute/path/to/darknotes-mcp/server.js
```

---

## Available MCP Tools

| Tool | Description |
|---|---|
| `list_workspaces` | List all workspaces |
| `create_workspace` | Create a new workspace |
| `rename_workspace` | Rename a workspace |
| `delete_workspace` | Delete a workspace |
| `list_notes` | List notes (with optional search/label/group filter) |
| `get_note` | Get full note content |
| `create_note` | Create a note with heading, body, labels, checklist items |
| `update_note` | Update note fields |
| `delete_note` | Delete a note |
| `append_to_note` | Add lines to an existing note |
| `add_label` | Add a label to a note |
| `remove_label` | Remove a label from a note |
| `check_item` | Check/uncheck a checklist item by index |
| `list_groups` | List all groups |
| `create_group` | Create a group |
| `delete_group` | Delete a group (notes become ungrouped) |
| `add_note_to_group` | Move a note into a group |
| `remove_note_from_group` | Remove a note from its group |
| `list_connections` | List connections between notes |
| `create_connection` | Connect two notes with a line |
| `delete_connection` | Remove a connection |
| `search` | Search notes across all workspaces |

---

## REST API Reference

Base URL: `http://localhost:3737/api`

| Method | Path | Description |
|---|---|---|
| GET | `/workspaces` | List workspaces |
| POST | `/workspaces` | Create workspace |
| GET | `/workspaces/:id` | Get workspace |
| PATCH | `/workspaces/:id` | Update workspace |
| DELETE | `/workspaces/:id` | Delete workspace |
| PUT | `/workspaces/:id/board` | Save full board state |
| GET | `/workspaces/:id/notes` | List notes |
| POST | `/workspaces/:id/notes` | Create note |
| GET | `/workspaces/:id/notes/:nid` | Get note |
| PATCH | `/workspaces/:id/notes/:nid` | Update note |
| DELETE | `/workspaces/:id/notes/:nid` | Delete note |
| GET | `/workspaces/:id/groups` | List groups |
| POST | `/workspaces/:id/groups` | Create group |
| PATCH | `/workspaces/:id/groups/:gid` | Update group |
| DELETE | `/workspaces/:id/groups/:gid` | Delete group |
| GET | `/workspaces/:id/connections` | List connections |
| POST | `/workspaces/:id/connections` | Create connection |
| DELETE | `/workspaces/:id/connections/:cid` | Delete connection |
| GET | `/search?q=query` | Search all workspaces |
| GET | `/health` | Health check |

---

## Data file

`~/.darknotes/data.json` — human-readable JSON. You can back it up, version-control it, or move it between machines.
