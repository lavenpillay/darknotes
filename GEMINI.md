# DarkNotes: Gemini instructions

**Read `AGENTS.md` first.** It is the single source of truth for how to work in this repository (layout, commands, conventions, testing). This file only repeats the rules that are most costly to get wrong, so the two cannot drift apart.

## Essentials

- The repo is a TypeScript npm-workspaces monorepo: `packages/core` (types, store, service layer, schemas), `apps/server` (REST + MCP adapters), `apps/web` (Next.js + Tailwind).
- **Put behaviour changes in `packages/core/src/service.ts`.** REST (`apps/server/src/rest.ts`) and MCP tools (`apps/server/src/tools.ts`) stay thin adapters over it.
- All data access goes through `readData()` / `writeData()` in `packages/core/src/store.ts`. New ids use the workspace counters (`nextNoteId` and so on) with the prefixes `n_`, `g_`, `c_`, `ws_`.
- MCP tool names and result shapes are a public contract: extend them, do not change them. Data-file changes must stay compatible with existing `data.json` files.
- In `apps/web`, import core types from `@darknotes/core/types`, never from `@darknotes/core`.
- Server logging goes to stderr only (stdout is the MCP stdio channel). Do not loosen the localhost binding or the Host/Origin checks.

## Commands

```bash
npm install
npm run dev:all       # API server (:3737) + Next.js app (:3000)
npm run build         # production build
npm start             # production: web app, API and MCP on :3737
npm run serve         # API server only
npm run mcp           # MCP over stdio
npm run typecheck
npm test              # core + server + web tests (needs Node 22+)
```

Before reporting work done, run `npm run typecheck && npm test`. Tests must use a temporary `DARKNOTES_DATA_DIR`, never `~/.darknotes`.
