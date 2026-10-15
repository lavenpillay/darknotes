# DarkNotes

A visual note board with a local REST API and an MCP server, so Claude and other MCP-compatible AI clients can read and write your notes.

## What this does

- **REST API** (`/api`, port 3737) — the browser app saves notes here instead of only in localStorage.
- **MCP server** — Claude Desktop / Claude Code read and write your notes over **stdio**, or over **Streamable HTTP** at `/mcp`.
- **Web UI** — served at `http://localhost:3737` by the API server.

All data is stored in `~/.darknotes/data.json`.

## Repository layout

| Path | What it is |
|---|---|
| `packages/core` | Shared TypeScript: data types, the file store, the service layer (all note/group/connection rules), Zod schemas |
| `apps/server` | REST + MCP adapters over `core`; security guards; serves the built web app |
| `apps/web` | Next.js + Tailwind app: board, notes, groups, connections, Style panel, minimap, import/export, workspaces, and the documentation page (`/documentation`; content in `components/docs/`) |

---

## Quick start

Requires Node.js 22 or newer.

```bash
npm install
```

### Run the server

| Command | What it does |
|---|---|
| `npm run build` | **Production build**: compiles the server to JavaScript (`apps/server/dist`) and exports the web app to static files (`apps/web/out`) |
| `npm start` | **Production**: one process on <http://localhost:3737> serving the web app, `/api`, `/mcp` and `/health` (run `npm run build` first) |
| `npm run dev:all` | **Development**: the server (<http://localhost:3737>) and the web app with hot reload (<http://localhost:3000>) together; Ctrl+C stops both |
| `npm run dev:server` | The server only, from source, restarting on file changes |
| `npm run dev:web` | The web app's dev server on <http://localhost:3000> (proxies `/api` to port 3737, so start the server too) |
| `npm run serve` | The server only, from source: `/api`, `/mcp`, `/health`, and the built web app if it exists |
| `npm run mcp` | **MCP stdio mode**, from source: for Claude Desktop / Claude Code (no HTTP) |
| `npm run serve:mcp-http` | The server **plus** an MCP stdio server, in one process. **Does not start the web app** |

The development and `serve`/`mcp` commands run the server straight from the TypeScript source with `tsx`; `npm start` runs the compiled build. With no flag the server runs in stdio mode (`node apps/server/dist/index.js [--api | --both]`). All logging goes to stderr, because stdout carries the stdio protocol.

**One port in production.** The static web app is built by `npm run build` into `apps/web/out` and served by the DarkNotes server itself, so there is no second process, no proxy and nothing else to expose: <http://localhost:3737> is the app, `/api` the REST API and `/mcp` the MCP endpoint. (`DARKNOTES_WEB_DIR` points the server at a different build directory.) In development the web app runs in its own Next.js dev server on port 3000, which proxies `/api` to the server so you get hot reload; that is why `dev:all` starts two processes.

**What `serve:mcp-http` is for.** The name refers to the two MCP transports, not to a web app: it serves MCP over **HTTP** (`/mcp` on port 3737) and over **stdio** at the same time. Use it when an MCP client launches the server and talks to it over stdio while you also want the HTTP side (REST API, `/mcp`, the built web app) available from the same process. It does **not** start the web app's development server; for development use `npm run dev:all`, for normal use `npm start`. Run from a plain terminal, nothing is connected to the stdio side, so it just waits; the HTTP side works normally. (It runs the server with the `--both` flag, which is why the flag name differs.)

### Configuration

Set these as environment variables.

| Variable | Default | Purpose |
|---|---|---|
| `DARKNOTES_PORT` | `3737` | HTTP port |
| `DARKNOTES_HOST` | `127.0.0.1` | Interface to bind. Loopback only by default; use `0.0.0.0` in containers |
| `DARKNOTES_TOKEN` | *(none)* | If set, `/api` and `/mcp` require `Authorization: Bearer <token>` |
| `DARKNOTES_ALLOWED_HOSTS` | *(none)* | Extra hostnames accepted in the `Host` header, comma-separated (`*` disables the check) |
| `DARKNOTES_ALLOWED_ORIGINS` | *(none)* | Extra browser origins accepted, comma-separated, e.g. `https://notes.example.com` |
| `DARKNOTES_WEB_DIR` | `apps/web/out` | Directory of the built web app that the server serves at `/` |
| `DARKNOTES_DATA_DIR` | `~/.darknotes` | Where `data.json` lives |
| `DARKNOTES_API_ORIGIN` | `http://127.0.0.1:3737` | Where the Next.js app proxies `/api` (web app only) |

### Security

- The server binds to `127.0.0.1` by default, so only your machine can reach it.
- Requests whose `Host` header is not `localhost`, `127.0.0.1` or `[::1]` get a 403, which blocks DNS-rebinding attacks. Requests carrying a foreign browser `Origin` also get a 403. MCP clients and `curl` send no `Origin` and are unaffected.
- If you expose the port beyond your machine (a LAN, a reverse proxy, Docker without a loopback-only mapping), **set `DARKNOTES_TOKEN`** and add the hostname to `DARKNOTES_ALLOWED_HOSTS`. **The web app does not send a token**, so against a token-protected server it cannot load your notes; a token is for MCP and API clients. Protect browser access some other way (keep the port on loopback, or put an authenticating proxy in front).

---

## Configure MCP clients

### Claude Desktop (stdio)

Run `npm run build` once first; the config points at the compiled server. (Without a build you can use `"command": "node", "args": ["--import", "tsx", ".../apps/server/src/index.ts"]` to run from source.)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "darknotes": {
      "command": "node",
      "args": ["/absolute/path/to/darknotes/apps/server/dist/index.js"]
    }
  }
}
```

Config file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Claude Code (stdio)

```bash
claude mcp add darknotes -- node /absolute/path/to/darknotes/apps/server/dist/index.js
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

The image is built in two stages and contains only Node, the compiled server and the static web app: one process, one port. It runs API mode (`--api`) and binds `0.0.0.0` inside the container. **Publish the port on loopback** (`127.0.0.1:3737:3737`) as above, or set `DARKNOTES_TOKEN` (`-e DARKNOTES_TOKEN=...`) before exposing it any wider. The app, the API (`/api`) and the MCP endpoint (`/mcp`) are then all at `http://localhost:3737`. Mounting `~/.darknotes` keeps your data outside the container.

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
| GET | `/workspaces/:id/export` | Download the workspace as an export file (`Content-Disposition: attachment`) |
| POST | `/workspaces/import` | Create a **new** workspace from an export file's JSON (also accepts the original app's files); returns `{ workspace, imported, skipped }` |
| PATCH | `/workspaces/:id` | Update workspace (name, board offset, zoom) |
| DELETE | `/workspaces/:id` | Delete workspace |
| POST | `/workspaces/:id/activate` | Make this the current workspace |
| POST | `/workspaces/:id/changes` | Apply incremental edits (`{ "changes": [...] }`): create/patch/delete notes, groups and connections, set the view. Idempotent and safe alongside other writers; returns the resulting workspace |
| PUT | `/workspaces/:id/board` | Replace the whole board. Kept for API compatibility: it overwrites anything added elsewhere in the meantime, so prefer `/changes` |
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

## How saving and syncing work

Several writers can change the same board at once: the browser (possibly in more than one tab), Claude over MCP, and scripts using the REST API. The web app is built so that none of them erases the others' work. (The original single-file UI replaced the whole board on every save, which could silently delete notes Claude had just added. The web app does not work that way.)

### Three copies of the board

The web app keeps, per open workspace:

| Copy | What it is |
|---|---|
| **local** | What is on screen. Every edit changes this first, so the UI never waits for the network. |
| **base** | The last server state this tab saw (after the last load, save or poll). |
| **server** | What is in `data.json` right now, including anything other writers changed. |

### Saving: send what changed, merge what came back

1. An edit changes *local* and starts a 600 ms debounce. The toolbar shows *Unsaved changes*.
2. When it fires, the app **diffs base against local** into a short list of operations (below). Only changed fields are included: moving a note sends `{ op: "patchNote", id, fields: { x, y } }`, not the whole note.
3. The list goes to `POST /api/workspaces/:id/changes`. The server applies all of it in **one atomic read-modify-write** (`applyChanges` in `packages/core/src/service.ts`) and replies with the resulting workspace.
4. The app **merges that reply into local** (rules below) and sets *base* to the reply. Anything you edited while the request was in flight is kept and saved on the next round.

Operations (all idempotent):

| Operation | Effect |
|---|---|
| `createNote`, `createGroup`, `createConnection` | Add the item with a client-chosen id. Skipped if that id already exists, so a retried request cannot duplicate it. A connection is skipped if either note is missing. |
| `patchNote`, `patchGroup`, `patchConnection` | Change only the listed fields. Skipped if the item no longer exists (someone deleted it). An unknown `groupId` becomes "ungrouped". |
| `deleteNote`, `deleteGroup`, `deleteConnection` | Remove the item. Skipped if already gone. Deleting a note removes its connections; deleting a group ungroups its notes. |
| `setView` | Pan offset and zoom. |

The app sends them in a safe order (groups, notes, connections, patches, view, deletes) so every reference exists when it is used. A batch that fails validation is rejected whole and nothing is written. Skipped operations are reported in the reply (`skipped`) and are not errors.

### Picking up other writers' changes

While the tab is visible, the app fetches the workspace every **4 seconds** (and when the tab becomes visible or the network returns) and merges it exactly like a save reply. That is how notes Claude adds over MCP appear on their own. A poll response that arrives after a save has finished is discarded as stale, so it cannot roll anything back.

### The merge

The merge compares each note, group and connection, field by field, against *base*:

| Situation | Result |
|---|---|
| We did not change it, the server did (Claude edited or appended) | Take the server's value |
| We changed it, the server did not | Keep ours (it is sent on the next save) |
| Both changed *different* fields (we moved a note, Claude renamed it) | Keep both |
| Both changed the *same* field | Ours wins until saved, then the last write wins |
| Created on the server (by Claude) | Appears here |
| Created here, not yet saved | Kept |
| Deleted on the server | Removed here, even if we edited it |
| Deleted here, not yet saved | Stays deleted |
| A group or note it points to has gone | Note becomes ungrouped; the connection is dropped |

Unchanged items keep their object identity, so React does not re-render them on every poll.

### Ids

Things created in the browser get random ids (`n_k3f9a2x`, `g_…`, `c_…`). Things created by the server (MCP tools, REST create endpoints) get counter ids (`n_1`, `n_2`, …). The two formats cannot collide, which is what makes offline and concurrent creation safe. Treat ids as opaque strings.

### Failures and offline

- A failed save keeps the edits, shows *Not saved*, and retries every 5 seconds. Switching workspace waits for pending saves first.
- Saves are also started when the tab is hidden or closed (using `keepalive` requests, which browsers cap at 64 KB), so a pan or edit made just before closing is not lost.
- The app caches its *local* and *base* copies in the browser. If the server is unreachable at load, it shows the cached board marked *Offline*, and sends the unsaved edits (diffed against the cached base) once the server is back.

### Limits

- Both sides editing the *same field of the same note* between syncs is last-write-wins. A note's `lines` are replaced as a whole, so two writers editing one note's text at the same moment can overwrite each other. (Claude's `append_to_note` is safe unless you are typing in that same note.)
- A delete on one side beats an edit on the other.
- `PUT /workspaces/:id/board` replaces the whole board and can erase concurrent edits. The web app does not use it; scripts should use `POST /workspaces/:id/changes`.

### Where it lives

| Piece | File |
|---|---|
| Operation types and validation | `packages/core/src/types.ts` (`Change`), `schemas.ts` (`changeSchema`) |
| Applying a batch atomically | `packages/core/src/service.ts` (`applyChanges`) |
| HTTP endpoint | `apps/server/src/rest.ts` (`POST /workspaces/:wsId/changes`) |
| Diff and merge (pure functions) | `apps/web/lib/sync.ts` |
| Save loop, polling, offline cache | `apps/web/lib/board-store.ts` |

Other clients can use the same endpoint: MCP tools and the per-item REST endpoints already change one thing at a time and are safe as they are, and `/changes` is for sending several edits in one atomic request.

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
npm test              # the tests of core, server and web
npm run build         # production build (server and web app)
```

Tests use a temporary data directory (`DARKNOTES_DATA_DIR`) and never touch `~/.darknotes`.

New behaviour goes into `packages/core/src/service.ts`; the REST routes (`apps/server/src/rest.ts`) and MCP tools (`apps/server/src/tools.ts`) stay thin adapters over it.

### Web app notes (`apps/web`)

- The server is the source of truth. Edits show instantly and are saved after a short pause; the toolbar shows *Saved / Unsaved changes / Saving… / Not saved*.
- Saving is incremental and merge-safe, so Claude can edit while the tab is open: see [How saving and syncing work](#how-saving-and-syncing-work).
- Workspace names and the workspace list come from the server, so a workspace created or renamed through MCP appears here (and renames made here reach MCP).
- **Export and import** (the download and upload buttons in the toolbar). **Export** saves any pending edits, then downloads the current workspace as `darknotes-<name>-<date>.json`. **Import** takes such a file (choose it, or paste its contents) and creates a **new workspace** from it, then switches to it; your existing workspaces are never changed or overwritten. Details below.
- **Minimap** (bottom-right): an overview of the whole board with a box for what is on screen. Click it to jump there, drag the box to pan, drag the top-left corner to resize it (it keeps its shape, 160 to 520 px wide), or collapse it with the chevron to **mini-mode**, a small thumbnail that still navigates (use the expand button to bring the full map back). Arrow keys pan when it has focus. Size and mode are remembered per browser. Notes are drawn in their colours, groups as tinted rectangles, connections as thin lines; notes inside minimized groups are left out.
- Notes: drag anywhere that is not a text field; resize from the corner, right or bottom edge; right-click for Duplicate, Add to / Remove from Group, Delete.
- **Style panel** (the *Style* button on a note): note colour (20 presets), text colour (10 presets), body text size (11 to 24 px, stepper), heading font (20 fonts in a grouped list, shown in their own typeface) and heading size (12 to 36 px). Changes apply live. A contrast readout under the text colours warns when text will be hard to read. *Reset to default* restores the defaults below.
- **Your own colours:** the **+** at the end of the note-colour and text-colour rows opens a picker (saturation/brightness square, hue, opacity, hex). Colours apply live; **Save to palette** keeps one as a swatch (up to 24 per row, remove one with the × on hover). Saved colours live in this browser only (`localStorage`), not in `data.json`, so they do not follow you to another browser; the notes themselves keep their colours everywhere.
- **Default font:** new notes use a sans-serif heading font, **MesloLG when it is installed on the computer** (the Nerd Font, `MesloLGS NF`, plain Meslo LG and "for Powerline" builds are all recognised), otherwise DM Sans. The font list shows whether MesloLG was found. The default applies to notes created by the web app, MCP and the REST API alike (`headingFont` is stored as the name `MesloLG`); existing notes keep the font they have.
- Connections: drag from a dot on a note's edge to a dot on another note (it snaps within 30 px); click a line to delete it; right-click a line for arrowheads.
- Groups: **+ New Group** adds one; drag its header (notes inside move with it), resize from the corner, rename, recolour, minimize to a pill (hides its notes and their connections) or delete (notes are kept).
- Controls so far: Ctrl/Cmd + scroll or Ctrl/Cmd + `+` / `-` / `0` to zoom, scroll or Space/middle-drag or dragging empty board to pan; in a note, Enter adds a line, Shift+Enter breaks a line, Tab toggles a checkbox, Backspace on an empty line removes it.

### Export and import files

An export is one flat JSON file:

```json
{
  "app": "darknotes", "version": 1, "exportedAt": "2026-10-15T20:00:00.000Z",
  "name": "My Workspace",
  "boardOffsetX": 0, "boardOffsetY": 0, "boardZoom": 1,
  "notes":       [ { "id": "n_1", "heading": "…", "lines": [ … ], "labels": [ … ], "x": 0, "y": 0, "w": 300, "h": 220, "bgColor": "#FFF9C4", "groupId": "g_1", "zIndex": 10, … } ],
  "groups":      [ { "id": "g_1", "name": "…", "x": 0, "y": 0, "w": 460, "h": 320, "color": "rgba(…)", "minimized": false } ],
  "connections": [ { "id": "c_1", "fromNote": "n_1", "fromSide": "right", "toNote": "n_2", "toSide": "left", "arrows": "end" } ]
}
```

It holds everything on the board (content, colours, fonts, positions, sizes, stacking order, groups and their members, connections and arrowheads, and the saved pan/zoom) and nothing else, so it is safe to share or keep as a backup. The layout is deliberately compatible with the original app's importer, which only reads `name`, `notes`, `groups` and `connections` (I have not re-tested that importer against the new files).

**Import rules.** Importing always creates a new workspace (named after the file, or "Imported workspace"). Every note, group and connection gets a fresh id and the links between them are rewritten to match, so an import can never collide with, or change, anything you already have. It accepts this app's files, the original app's files (notes without ids, arrays or id-keyed objects, numeric ids), and a bare JSON array of notes. A file with a bad value (for example a note position that is not a number) is rejected as a whole with a message naming the entry, and nothing is created. A connection that is malformed or points at a note the file does not contain is skipped, and the app tells you how many; the original app's exports carry no note ids, so connections in them cannot always be restored. Limits: 5,000 notes, groups and connections each, about 10 MB. Over HTTP: `GET /api/workspaces/:id/export` and `POST /api/workspaces/import` (see the REST table).
