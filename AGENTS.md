# DarkNotes Agent Instructions

Guidance for AI coding agents working in this repository. Read this before changing code. `README.md` is the user-facing guide (commands, options, API/tool reference); this file is about how to work on the code.

## 1. Project overview

DarkNotes is a visual note board with a local REST API and an MCP (Model Context Protocol) server. All data lives in one JSON file, `~/.darknotes/data.json` (override the directory with `DARKNOTES_DATA_DIR`).

The repo is an **npm-workspaces monorepo in TypeScript**, mid-migration from a plain-JS server plus single-file HTML apps to a typed backend and a Next.js + Tailwind frontend.

## 2. Layout

| Path | Role |
|---|---|
| `packages/core` | **Single owner of all data rules.** Types (`types.ts`), file store (`store.ts`), service layer (`service.ts`), Zod schemas (`schemas.ts`), domain errors (`errors.ts`) |
| `apps/server` | Thin adapters over `core`: REST (`rest.ts`), MCP tools (`tools.ts`), MCP sessions (`mcp.ts`), HTTP app and security (`app.ts`, `security.ts`, `config.ts`), entry point (`index.ts`) |
| `apps/web` | Next.js (App Router) + Tailwind frontend. `lib/` holds pure logic and the board store; `components/` holds React UI |
| `darknotes-app.html`, `documentation.html`, `css/` | **Legacy UI**, still served by the server until the Next.js app reaches parity. Behaviour reference only |
| `server.js`, `api.js`, `tools.js`, `store.js` | **Legacy backend. Superseded; do not add features here.** Kept only so `tests/characterization.test.mjs` can pin old behaviour; they are deleted at cutover |
| `notes-app.html` | Obsolete older UI fork. Ignore |

## 3. Commands

```bash
npm install
npm run dev:all        # API server (:3737) + Next.js app (:3000) together
npm run serve          # API server only: /api, /mcp, /health, legacy UI on :3737
npm run mcp            # MCP over stdio (what Claude Desktop / Claude Code launch)
npm run dev:web        # Next.js dev server only (needs the API running)
npm run typecheck      # core, server, web
npm test               # legacy characterisation tests
npm run test:all       # legacy + core + server + web tests
npm run build -w @darknotes/web
```

Requires Node 22+. Docker: `docker build -t darknotes .`; the image runs API mode, binds `0.0.0.0` inside the container, and should be published on loopback (`-p 127.0.0.1:3737:3737`).

## 4. Where changes go

**Behaviour changes start in `packages/core/src/service.ts`.** REST routes and MCP tools only translate between transport and service calls.

- **New or changed operation:** add/change the function in `service.ts` (validate input with a Zod schema from `schemas.ts`, throw `NotFoundError` / `ValidationError` / `ConflictError`), then expose it:
  - MCP: add the schema and handler case in `apps/server/src/tools.ts`.
  - REST: add the route in `apps/server/src/rest.ts` (400 for invalid and conflict, 404 for not found).
  - Add tests at each layer you touched, and keep `README.md`'s tool/endpoint tables in step.
- **Data file access** goes only through `readData()` / `writeData()` in `packages/core/src/store.ts`. Never read or write `data.json` directly. The store writes atomically, keeps `data.json.bak`, and throws `CorruptDataError` on invalid JSON instead of resetting.
- **IDs** created by the server (MCP tools, REST create endpoints) come from the per-workspace counters (`ws.nextNoteId`, `nextGroupId`, `nextConnectionId`) and `data.nextWorkspaceId`, with prefixes `n_`, `g_`, `c_`, `ws_`; use `nextId()`. The browser creates its own ids (random suffix, e.g. `n_k3f9a2x`) so offline and concurrent creates cannot collide. The store repairs counters on load (ignoring non-numeric suffixes), so ids are never reused. Treat ids as opaque strings.
- **Data model changes** must stay compatible with existing `data.json` files. Add optional fields (like `Connection.arrows`), never rename or remove fields without a migration.
- **MCP tool names and result shapes are a public contract.** Existing clients depend on them; extend, don't change.

## 5. Conventions

- **ES modules and strict TypeScript** everywhere (`noUncheckedIndexedAccess` is on).
- **Imports inside `packages/core` have no file extension** (`'./store'`, not `'./store.js'`) so both `tsx` and Next.js can resolve them.
- **Web code must import core types from `@darknotes/core/types`**, never from `@darknotes/core`. The package root pulls in `node:fs` and would break the browser bundle.
- **Web architecture:** pure logic lives in `apps/web/lib/*.ts` with unit tests (geometry, board maths, store). Components stay thin. The board store (`lib/board-store.ts`) applies edits at once and saves the whole board to the server after a debounce; the server is the source of truth and `localStorage` is only an offline cache. Transient UI state (a connection being dragged, open menus) goes in `lib/ui-store.ts` and is never saved.
- **Browser-side changes to saved data** go through store actions, not ad hoc `fetch` calls.
- **Browser saves are incremental, never whole-board.** `lib/sync.ts` diffs the local board against the last server state into `Change` ops (`POST /workspaces/:id/changes`, service function `applyChanges`) and three-way merges the server's reply, so other writers' edits (Claude over MCP, other tabs) are never overwritten. Do not use `saveBoard` / `PUT /board` from new code (it exists for the legacy UI). New saved fields need: the field in `types.ts` and `schemas.ts`, the field list in `lib/sync.ts`, and a test in `sync.test.ts`.
- **Logging in the server goes to stderr.** In stdio MCP mode stdout is the protocol channel; anything printed there corrupts it.
- **Security defaults matter:** the server binds `127.0.0.1`, rejects foreign `Host`/`Origin` headers, and supports an optional bearer token. Do not loosen these to make something work; add configuration instead (`apps/server/src/config.ts`).

## 6. Testing

- Tests use `node:test` run through `tsx`. They must use a temporary data directory (`DARKNOTES_DATA_DIR`); never touch `~/.darknotes`.
- On Node 26, `node --test <directory>` does not work; the npm scripts name the test files explicitly. Add new test files to the relevant package's `test` script.
- `apps/server/src/contract.test.ts` ports the legacy characterisation suite to the new adapters; cases marked `FIX` are intentional behaviour changes.
- Before reporting work done, run `npm run typecheck && npm run test:all`, and `npm run build -w @darknotes/web` if the web app changed. UI changes also need a manual check in a browser (`npm run dev:all`).

## 7. Documentation upkeep

- `README.md`: update as each change lands (commands, options, tool and REST tables).
- `documentation.html`: the user-facing docs page. Update periodically in batches, not on every change.
- Keep this file and `GEMINI.md` accurate when the layout, commands or rules change.

## 8. Migration status

Done: `packages/core` (store, service layer), `apps/server` (REST + MCP + security), web foundation (API client, board store, pan/zoom, note editing, drag/resize, workspaces, connections, groups, note context menu). In progress: note colour and font panels. Still to do: minimap, import/export, localStorage migration from the legacy app, docs page port, then cutover (delete the legacy backend and HTML apps, update the Dockerfile).
