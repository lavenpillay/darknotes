# DarkNotes

A visual note board with a local REST API and an MCP server, so Claude and other MCP-compatible AI clients can read and write your notes.

> **Migration in progress.** DarkNotes is moving to a TypeScript monorepo with a Next.js + Tailwind frontend. The server (`apps/server`) is done. The Next.js app (`apps/web`) can already create, edit and delete notes, pan and zoom, and manage workspaces, but it does not yet have drag/resize, groups, connections, the colour picker, the minimap or import/export. Until it does, the full UI is still the original single-file app, served by the server at <http://localhost:3737>. The old `server.js` still runs (`npm start`) but is superseded and will be removed at cutover.

## What this does

- **REST API** (`/api`, port 3737) — the browser app saves notes here instead of only in localStorage.
- **MCP server** — Claude Desktop / Claude Code read and write your notes over **stdio**, or over **Streamable HTTP** at `/mcp`.
- **Web UI** — served at `http://localhost:3737` by the API server.

All data is stored in `~/.darknotes/data.json`.

## Repository layout

| Path | What it is |
|---|---|
| `packages/core` | Shared TypeScript: data types, the file store, the service layer (all note/group/connection rules), Zod schemas |
| `apps/server` | REST + MCP adapters over `core`; security guards; serves the legacy UI |
| `apps/web` | Next.js + Tailwind app: typed API client, board store with debounced saves, pan/zoom, note editing, workspaces (in progress) |
| `darknotes-app.html`, `documentation.html`, `css/` | Legacy UI, served by the server until the Next.js app replaces it |
| `server.js`, `api.js`, `tools.js`, `store.js` | Legacy backend (superseded, kept for the characterisation tests) |

---

## Quick start

Requires Node.js 22 or newer.

```bash
npm install
```

### Run the server

| Command | Mode |
|---|---|
| `npm run serve` | **API mode**: REST `/api`, MCP `/mcp`, `/health` and the web UI at <http://localhost:3737> |
| `npm run mcp` | **MCP stdio mode**: for Claude Desktop / Claude Code (no HTTP) |
| `npm run serve:both` | API mode and a stdio MCP server in one process |
| `npm run dev:all` | **API server and Next.js app together** (API on <http://localhost:3737>, new UI on <http://localhost:3000>); Ctrl+C stops both |
| `npm run dev:server` | API mode, restarts on file changes |
| `npm run dev:web` | Next.js dev server on <http://localhost:3000>: the new board UI (proxies `/api` to port 3737, so start `npm run serve` too) |

These are shortcuts for `node --import tsx apps/server/src/index.ts [--api | --both]`. With no flag the server runs in stdio mode. All logging goes to stderr, because stdout carries the stdio protocol.

Open <http://localhost:3737> for the original UI. The green dot in the toolbar confirms the API is connected.

`npm run serve` starts only the API server (plus the original UI on port 3737). The new Next.js UI on port 3000 is a separate process that needs that API running: use `npm run dev:all` to start both, or run `npm run serve` in one terminal and `npm run dev:web` in another.

### Configuration

Set these as environment variables.

| Variable | Default | Purpose |
|---|---|---|
| `DARKNOTES_PORT` | `3737` | HTTP port |
| `DARKNOTES_HOST` | `127.0.0.1` | Interface to bind. Loopback only by default; use `0.0.0.0` in containers |
| `DARKNOTES_TOKEN` | *(none)* | If set, `/api` and `/mcp` require `Authorization: Bearer <token>` |
| `DARKNOTES_ALLOWED_HOSTS` | *(none)* | Extra hostnames accepted in the `Host` header, comma-separated (`*` disables the check) |
| `DARKNOTES_ALLOWED_ORIGINS` | *(none)* | Extra browser origins accepted, comma-separated, e.g. `https://notes.example.com` |
| `DARKNOTES_DATA_DIR` | `~/.darknotes` | Where `data.json` lives |
| `DARKNOTES_API_ORIGIN` | `http://127.0.0.1:3737` | Where the Next.js app proxies `/api` (web app only) |

### Security

- The server binds to `127.0.0.1` by default, so only your machine can reach it.
- Requests whose `Host` header is not `localhost`, `127.0.0.1` or `[::1]` get a 403, which blocks DNS-rebinding attacks. Requests carrying a foreign browser `Origin` also get a 403. MCP clients and `curl` send no `Origin` and are unaffected.
- If you expose the port beyond your machine (a LAN, a reverse proxy, Docker without a loopback-only mapping), **set `DARKNOTES_TOKEN`** and add the hostname to `DARKNOTES_ALLOWED_HOSTS`. The legacy browser UI cannot send a token, so a token-protected server is for MCP and API clients.

---

## Configure MCP clients

### Claude Desktop (stdio)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "darknotes": {
      "command": "node",
      "args": ["--import", "tsx", "/absolute/path/to/darknotes/apps/server/src/index.ts"]
    }
  }
}
```

Config file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Claude Code (stdio)

```bash
claude mcp add darknotes -- node --import tsx /absolute/path/to/darknotes/apps/server/src/index.ts
```

### Streamable HTTP

Start the server in API mode (`npm run serve`, or Docker) and connect your client to `http://localhost:3737/mcp`. If you set `DARKNOTES_TOKEN`, send it as an `Authorization: Bearer` header.

```bash
claude mcp add --transport http darknotes http://localhost:3737/mcp
```

---

## Docker

```bash
docker build -t darknotes .

docker run -d \
  -p 127.0.0.1:3737:3737 \
  -v ~/.darknotes:/root/.darknotes \
  --name darknotes \
  darknotes
```

The image runs API mode (`--api`) and binds `0.0.0.0` inside the container. **Publish the port on loopback** (`127.0.0.1:3737:3737`) as above, or set `DARKNOTES_TOKEN` (`-e DARKNOTES_TOKEN=...`) before exposing it any wider. The UI and MCP endpoint are then at `http://localhost:3737`. Mounting `~/.darknotes` keeps your data outside the container.

---

## Available MCP tools

| Tool | Description |
|---|---|
| `list_workspaces` | List all workspaces |
| `create_workspace` | Create a new workspace |
| `rename_workspace` | Rename a workspace |
| `delete_workspace` | Delete a workspace (the last one cannot be deleted) |
| `list_notes` | List notes (optional search / label / group filter) |
| `get_note` | Get full note content |
| `create_note` | Create a note: heading, body or lines, labels, group, colors, fonts, and position/size (`x`, `y`, `w`, `h`) |
| `update_note` | Update any note field, including position, size and fonts; `groupId: null` ungroups |
| `delete_note` | Delete a note and its connections |
| `append_to_note` | Add lines to an existing note |
| `add_label` | Add a label to a note |
| `remove_label` | Remove a label from a note |
| `check_item` | Check/uncheck a checklist item by index |
| `list_groups` | List all groups |
| `create_group` | Create a group (optional position and size) |
| `delete_group` | Delete a group (notes become ungrouped) |
| `add_note_to_group` | Move a note into a group |
| `remove_note_from_group` | Remove a note from its group |
| `list_connections` | List connections between notes |
| `create_connection` | Connect two existing notes with a line |
| `delete_connection` | Remove a connection |
| `search` | Search notes across all workspaces |

Every tool that takes `workspaceId` defaults to the current workspace. Invalid input returns a tool error naming the field.

---

## REST API reference

Base URL: `http://localhost:3737/api`. Errors are JSON: `{ "error": "message" }` with status 400 (invalid input, or a rule such as deleting the last workspace), 404 (not found) or 500.

| Method | Path | Description |
|---|---|---|
| GET | `/workspaces` | List workspaces |
| POST | `/workspaces` | Create workspace |
| GET | `/workspaces/:id` | Get workspace |
| PATCH | `/workspaces/:id` | Update workspace (name, board offset, zoom) |
| DELETE | `/workspaces/:id` | Delete workspace |
| POST | `/workspaces/:id/activate` | Make this the current workspace |
| PUT | `/workspaces/:id/board` | Save full board state |
| GET | `/workspaces/:id/notes` | List notes (`?search=`, `?label=`, `?groupId=`) |
| POST | `/workspaces/:id/notes` | Create note |
| GET | `/workspaces/:id/notes/:nid` | Get note |
| PATCH | `/workspaces/:id/notes/:nid` | Update note |
| DELETE | `/workspaces/:id/notes/:nid` | Delete note |
| GET | `/workspaces/:id/groups` | List groups |
| POST | `/workspaces/:id/groups` | Create group |
| PATCH | `/workspaces/:id/groups/:gid` | Update group |
| DELETE | `/workspaces/:id/groups/:gid` | Delete group |
| GET | `/workspaces/:id/connections` | List connections |
| POST | `/workspaces/:id/connections` | Create connection (both notes must exist) |
| DELETE | `/workspaces/:id/connections/:cid` | Delete connection |
| GET | `/search?q=query` | Search all workspaces |

`GET /health` (outside `/api`) is the health check.

---

## Data file

`~/.darknotes/data.json` is human-readable JSON. You can back it up, version-control it, or move it between machines.

- Writes are atomic, and the previous version is kept as `data.json.bak`.
- If the file is not valid JSON, the server **does not reset it**. It reports an error, leaves the file untouched and saves a copy as `data.json.corrupt-<timestamp>`. Fix or restore the file (the `.bak` is a good start) and retry.
- Id counters are repaired on load, so ids are never reused.

---

## Development

```bash
npm run typecheck     # core, server and web
npm test              # legacy characterisation tests (tests/)
npm run test:all      # legacy + core + server + web tests
npm run build -w @darknotes/web
```

Tests use a temporary data directory (`DARKNOTES_DATA_DIR`) and never touch `~/.darknotes`.

New behaviour goes into `packages/core/src/service.ts`; the REST routes (`apps/server/src/rest.ts`) and MCP tools (`apps/server/src/tools.ts`) stay thin adapters over it.

### Web app notes (`apps/web`)

- The server is the source of truth. Edits show instantly and are saved to the server after a short pause (600 ms); the toolbar shows *Saved / Unsaved changes / Saving… / Not saved*. A failed save is retried every 5 seconds and nothing is discarded.
- If the server is unreachable at load, the app shows the last copy it cached in the browser (marked *Offline*) and syncs it when the server returns.
- Workspace names and the workspace list come from the server, so a workspace created or renamed through MCP appears here (and renames made here reach MCP). Switching back to the tab refreshes the board from the server when there are no unsaved changes.
- Controls so far: Ctrl/Cmd + scroll or Ctrl/Cmd + `+` / `-` / `0` to zoom, scroll or Space/middle-drag or dragging empty board to pan; in a note, Enter adds a line, Shift+Enter breaks a line, Tab toggles a checkbox, Backspace on an empty line removes it.
