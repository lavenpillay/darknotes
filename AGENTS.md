# DarkNotes Agent Instructions

Guidance for AI coding agents working in this repository. Read this before changing code. `README.md` is the user-facing guide (commands, options, API/tool reference); this file is about how to work on the code.

## 1. Project overview

DarkNotes is a visual note board with a local REST API and an MCP (Model Context Protocol) server. All data lives in one JSON file, `~/.darknotes/data.json` (override the directory with `DARKNOTES_DATA_DIR`).

The repo is an **npm-workspaces monorepo in TypeScript**: a typed backend (`packages/core`, `apps/server`) and a Next.js + Tailwind web app (`apps/web`), served together on one port in production.

## 2. Layout

| Path | Role |
|---|---|
| `packages/core` | **Single owner of all data rules.** Types (`types.ts`), file store (`store.ts`), service layer (`service.ts`), Zod schemas (`schemas.ts`), domain errors (`errors.ts`) |
| `apps/server` | Thin adapters over `core` (built to one file, `dist/index.js`, with `core` bundled in by tsup): REST (`rest.ts`), MCP tools (`tools.ts`), MCP sessions (`mcp.ts`), HTTP app and security (`app.ts`, `security.ts`, `config.ts`), entry point (`index.ts`) |
| `apps/web` | Next.js (App Router) + Tailwind frontend. `lib/` holds pure logic and the board store; `components/` holds React UI |

## 3. Commands

```bash
npm install
npm run build          # production build: server -> apps/server/dist (tsup), web app -> apps/web/out (static export)
npm start              # production: one process on :3737 serving the web app, /api, /mcp (run build first)
npm run dev:all        # development: API server (:3737) + Next.js dev server (:3000) with hot reload
npm run serve          # API server only, from source: /api, /mcp, /health (and the built web app if it exists)
npm run mcp            # MCP over stdio (what Claude Desktop / Claude Code launch)
npm run dev:web        # Next.js dev server only (needs the API running)
npm run typecheck      # core, server, web
npm test               # core + server + web tests
```

Requires Node 22+. Docker: `docker build -t darknotes .` (two stages: build, then Node + the compiled server + the static web app); it runs `node apps/server/dist/index.js --api`, binds `0.0.0.0` inside the container and should be published on loopback (`-p 127.0.0.1:3737:3737`).

## 4. Where changes go

**Behaviour changes start in `packages/core/src/service.ts`.** REST routes and MCP tools only translate between transport and service calls.

- **New or changed operation:** add/change the function in `service.ts` (validate input with a Zod schema from `schemas.ts`, throw `NotFoundError` / `ValidationError` / `ConflictError`), then expose it:
  - MCP: add the schema and handler case in `apps/server/src/tools.ts`.
  - REST: add the route in `apps/server/src/rest.ts` (400 for invalid and conflict, 404 for not found).
  - Add tests at each layer you touched, and keep `README.md`'s tool/endpoint tables in step.
- **Data file access** goes only through `readData()` / `writeData()` in `packages/core/src/store.ts`. Never read or write `data.json` directly. The store writes atomically, keeps `data.json.bak`, and throws `CorruptDataError` on invalid JSON instead of resetting.
- **IDs** created by the server (MCP tools, REST create endpoints) come from the per-workspace counters (`ws.nextNoteId`, `nextGroupId`, `nextConnectionId`) and `data.nextWorkspaceId`, with prefixes `n_`, `g_`, `c_`, `ws_`; use `nextId()`. The browser creates its own ids (random suffix, e.g. `n_k3f9a2x`) so offline and concurrent creates cannot collide. The store repairs counters on load (ignoring non-numeric suffixes), so ids are never reused. Treat ids as opaque strings.
- **Data model changes** must stay compatible with existing `data.json` files. Add optional fields (like `Connection.arrows`), never rename or remove fields without a migration.
- **Note style defaults** live in one place, `packages/core/src/defaults.ts` (`DEFAULT_NOTE_STYLE`), used by the service layer, the web app's new-note and the Style panel's reset. `headingFont` is stored as a font *name*; `apps/web/lib/fonts.ts` turns it into a CSS stack (`MesloLG` becomes MesloLG-if-installed, then DM Sans). Users' saved custom colours are a browser-only preference (`lib/palette-store.ts`), not part of the data file.
- **MCP tool names and result shapes are a public contract.** Existing clients depend on them; extend, don't change.

## 5. Conventions

- **ES modules and strict TypeScript** everywhere (`noUncheckedIndexedAccess` is on).
- **Imports inside `packages/core` have no file extension** (`'./store'`, not `'./store.js'`) so both `tsx` and Next.js can resolve them.
- **Web code must import core types from `@darknotes/core/types`**, never from `@darknotes/core`. The package root pulls in `node:fs` and would break the browser bundle.
- **Web architecture:** pure logic lives in `apps/web/lib/*.ts` with unit tests (geometry, board maths, store). Components stay thin. The board store (`lib/board-store.ts`) applies edits at once and saves the whole board to the server after a debounce; the server is the source of truth and `localStorage` is only an offline cache. Transient UI state (a connection being dragged, open menus) goes in `lib/ui-store.ts` and is never saved.
- **Browser-side changes to saved data** go through store actions, not ad hoc `fetch` calls.
- **The web app is a static export in production** (`next.config.ts` sets `output: 'export'` when `NODE_ENV=production`), served by `apps/server` from `apps/web/out`. So do not use server-only Next.js features: no route handlers, no server components that fetch data at request time, no middleware, no `next/image` optimisation, no `rewrites` outside the dev branch of the config. All data goes through the REST API with relative `/api` URLs (the dev server proxies them). A page route must produce a static `.html`; the server maps `/page` to `page.html` and serves `404.html` for unknown pages.
- **Server runtime dependencies live in `apps/server/package.json` `dependencies`** (express, cors, the MCP SDK, zod): `@darknotes/core` is a devDependency because tsup bundles it. If you add a runtime package to `core` or the server, add it to the server's `dependencies` too, or the compiled build and the Docker image will fail at startup. `npm run build` then `node apps/server/dist/index.js --api` is the quickest check.
- **Browser saves are incremental, never whole-board.** `lib/sync.ts` diffs the local board against the last server state into `Change` ops (`POST /workspaces/:id/changes`, service function `applyChanges`) and three-way merges the server's reply, so other writers' edits (Claude over MCP, other tabs) are never overwritten. Do not use `saveBoard` / `PUT /board` from new code (the endpoint remains only for API compatibility). New saved fields need: the field in `types.ts` and `schemas.ts`, the field list in `lib/sync.ts`, and a test in `sync.test.ts`.
- **Logging in the server goes to stderr.** In stdio MCP mode stdout is the protocol channel; anything printed there corrupts it.
- **Security defaults matter:** the server binds `127.0.0.1`, rejects foreign `Host`/`Origin` headers, and supports an optional bearer token. Do not loosen these to make something work; add configuration instead (`apps/server/src/config.ts`).

## 6. Testing

- Tests use `node:test` run through `tsx`. They must use a temporary data directory (`DARKNOTES_DATA_DIR`); never touch `~/.darknotes`.
- On Node 26, `node --test <directory>` does not work; the npm scripts name the test files explicitly. Add new test files to the relevant package's `test` script.
- `apps/server/src/contract.test.ts` pins the REST and MCP behaviour (cases marked `FIX` record deliberate changes from the original JavaScript server); `static.test.ts` covers serving the web app; `components/docs/docs.test.tsx` guards the documentation against drift.
- Before reporting work done, run `npm run typecheck && npm test`, and `npm run build` if the server or web app changed (it catches problems the tests cannot, such as a missing runtime dependency or a page that cannot be statically exported). UI changes also need a manual check in a browser (`npm run dev:all`).

## 7. Documentation upkeep

- `README.md`: update as each change lands (commands, options, tool and REST tables).
- The user-facing documentation is a page of the web app at `/documentation` (`apps/web/components/docs/sections/*.tsx`, styled by `app/documentation/docs.css`, table of contents in `components/docs/nav.ts`). Update it periodically in batches, not on every change. `components/docs/docs.test.tsx` fails if the page drifts from the code: every MCP tool, REST route and `DARKNOTES_*` variable must be documented, every `npm run` shown must exist, and every in-page link must resolve. New sections need an `id` on their `<h2>` and an entry in `nav.ts`.
- Keep this file and `GEMINI.md` accurate when the layout, commands or rules change.

## 8. Project status and history

The migration from the original plain-JavaScript server and single-file HTML apps to this TypeScript monorepo is complete and those files are gone. Two things were deliberately not carried over, because the owner does not need them: migrating boards stored in the original app's `localStorage`, and the original app's *Clear All* button. The importer still accepts the original app's export files.

Known gap: the Docker image has not been built or run in this environment (the Docker daemon was unavailable); its runtime stage was rehearsed in a clean directory instead. Build it once (`docker build -t darknotes .`) before relying on it.
