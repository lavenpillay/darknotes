# Project notes

Running log of notes made for this project. Mirrors notes created in DarkNotes ("make a note" = DarkNotes note + an entry here).

## 2026-10-15: Server reanalysis & work order (DarkNotes note n_13, ws_1)

### Suggested order of work
- [ ] 1. Atomic write (temp file + rename) + backup; stop `readData()` silently resetting to defaults on JSON parse error
- [ ] 2. Bind to 127.0.0.1, add Host/Origin checks, optional token; remove `enableDnsRebindingProtection:false` and wildcard CORS
- [ ] 3. Docker `CMD` `--both` -> `--api`; fix image name mismatch (`darknotes` vs `darknotes-server`) in docs
- [ ] 4. REFACTOR: extract shared note/group/connection ops into a service layer used by both `api.js` and `tools.js`
- [ ] 5. MCP server: capabilities should be `{ tools: {} }`; allow DELETE in CORS for session close; clean up abandoned sessions
- [ ] 6. Remove/archive `notes-app.html`, drop unused `uuid` dep, add tests for store + tools, add `.dockerignore`

### Issues detected
- **A. Data loss:** whole-file read-modify-write, no locking, non-atomic `writeFileSync`; browser autosave (`PUT /board`) races MCP calls; parse error -> `defaultData()` then overwritten on next write
- **B. Security:** no auth, `origin: '*'` CORS, DNS rebinding protection disabled; Docker `-p` exposes it to the network
- **C. `--both` mode:** stdio + HTTP in one process; Docker has no stdin so stdio may exit; Dockerfile comment says API mode but `CMD` is `--both`
- **D. ID collisions:** `PUT /board` accepts client `nextNoteId` that can be lower than MCP-allocated ids and overwrite notes; `nextWorkspaceId` assumed to exist (NaN ids on old data)
- **E. Tool gaps:** `create_note` ignores x/y/w/h (all stack at 100,100); `update_note` can't change x/y/w/h/headingFont; `add_label`/`remove_label` throw if `labels` missing; lines/body not validated; `update_note` doesn't validate `groupId`; REST `create_connection` doesn't check notes exist
- **F. Duplication:** search/filter x3; ws-exists check and delete-note cascade copy-pasted ~20x; REST and MCP behaviour has drifted
- **G. MCP server:** bogus capability `{ tools: { list_workspaces: true } }`; CORS lacks DELETE; sessions only removed on `onclose`; errors returned as text with no validation/internal distinction
- **H. Housekeeping:** `uuid` unused; README says open `notes-app.html` but server serves `darknotes-app.html`; no tests/lint/`.dockerignore`; GEMINI.md/AGENTS.md/README duplicate content; AGENTS.md ID note omits `data.nextWorkspaceId`; bloated `.gitignore`
- **I. Frontend (skimmed only):** two near-duplicate 2.6k/4.2k-line single-file apps; stale localStorage may overwrite newer MCP edits on reconnect; not audited in depth
