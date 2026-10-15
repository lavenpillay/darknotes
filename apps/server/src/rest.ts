/** REST adapter over @darknotes/core. Paths, payloads and status codes match the legacy api.js. */

import express, { type Request, type Response, Router } from 'express';
import {
  CorruptDataError,
  DomainError,
  activateWorkspace,
  applyChanges,
  createConnection,
  createGroup,
  createNote,
  createWorkspace,
  deleteConnection,
  deleteGroup,
  deleteNote,
  deleteWorkspace,
  exportFilename,
  exportWorkspace,
  getNote,
  importWorkspace,
  getWorkspaceById,
  listConnections,
  listGroups,
  listNotes,
  listWorkspaces,
  saveBoard,
  searchNotes,
  updateGroup,
  updateNote,
  updateWorkspace,
} from '@darknotes/core';

const STATUS = { not_found: 404, invalid: 400, conflict: 400 } as const;

function sendError(res: Response, err: unknown) {
  if (err instanceof DomainError) return res.status(STATUS[err.code]).json({ error: err.message });
  if (err instanceof CorruptDataError) return res.status(500).json({ error: err.message });
  console.error('Unhandled REST error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

type Handler = (req: Request, res: Response) => void;
const h =
  (fn: Handler): Handler =>
  (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      sendError(res, err);
    }
  };

const q = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const p = (req: Request, name: string) => String(req.params[name]);

export function createApiRouter(): Router {
  const router = express.Router();

  // Workspaces
  router.get('/workspaces', h((_req, res) => {
    const { workspaces, currentWorkspaceId } = listWorkspaces();
    res.json({ workspaces, currentWorkspaceId });
  }));
  router.post('/workspaces', h((req, res) => {
    res.status(201).json(createWorkspace(req.body?.name));
  }));
  // Import must be registered before the /workspaces/:wsId routes.
  router.post('/workspaces/import', h((req, res) => {
    res.status(201).json(importWorkspace(req.body));
  }));
  router.get('/workspaces/:wsId/export', h((req, res) => {
    const doc = exportWorkspace(p(req, 'wsId'));
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename(doc.name)}"`);
    res.type('application/json').send(JSON.stringify(doc, null, 2));
  }));
  router.get('/workspaces/:wsId', h((req, res) => {
    res.json(getWorkspaceById(p(req, 'wsId')));
  }));
  router.patch('/workspaces/:wsId', h((req, res) => {
    res.json(updateWorkspace(p(req, 'wsId'), req.body));
  }));
  router.delete('/workspaces/:wsId', h((req, res) => {
    deleteWorkspace(p(req, 'wsId'));
    res.json({ ok: true });
  }));
  router.post('/workspaces/:wsId/activate', h((req, res) => {
    res.json(activateWorkspace(p(req, 'wsId')));
  }));
  // Whole-board replace. Kept for the legacy UI; it can overwrite concurrent edits, so new clients use /changes.
  router.put('/workspaces/:wsId/board', h((req, res) => {
    saveBoard(p(req, 'wsId'), req.body);
    res.json({ ok: true });
  }));

  // Incremental sync: apply only what changed. Safe alongside other writers (MCP, other tabs), unlike PUT /board.
  router.post('/workspaces/:wsId/changes', h((req, res) => {
    const { applied, skipped, workspace } = applyChanges(p(req, 'wsId'), req.body);
    res.json({ ok: true, applied, skipped, workspace });
  }));

  // Notes
  router.get('/workspaces/:wsId/notes', h((req, res) => {
    res.json(
      listNotes(p(req, 'wsId'), {
        search: q(req.query.search),
        label: q(req.query.label),
        groupId: q(req.query.groupId),
      }),
    );
  }));
  router.post('/workspaces/:wsId/notes', h((req, res) => {
    res.status(201).json(createNote(p(req, 'wsId'), req.body));
  }));
  router.get('/workspaces/:wsId/notes/:noteId', h((req, res) => {
    res.json(getNote(p(req, 'wsId'), p(req, 'noteId')));
  }));
  router.patch('/workspaces/:wsId/notes/:noteId', h((req, res) => {
    res.json(updateNote(p(req, 'wsId'), p(req, 'noteId'), req.body));
  }));
  router.delete('/workspaces/:wsId/notes/:noteId', h((req, res) => {
    deleteNote(p(req, 'wsId'), p(req, 'noteId'));
    res.json({ ok: true });
  }));

  // Groups
  router.get('/workspaces/:wsId/groups', h((req, res) => {
    res.json(listGroups(p(req, 'wsId')));
  }));
  router.post('/workspaces/:wsId/groups', h((req, res) => {
    res.status(201).json(createGroup(p(req, 'wsId'), req.body));
  }));
  router.patch('/workspaces/:wsId/groups/:groupId', h((req, res) => {
    res.json(updateGroup(p(req, 'wsId'), p(req, 'groupId'), req.body));
  }));
  router.delete('/workspaces/:wsId/groups/:groupId', h((req, res) => {
    deleteGroup(p(req, 'wsId'), p(req, 'groupId'));
    res.json({ ok: true });
  }));

  // Connections
  router.get('/workspaces/:wsId/connections', h((req, res) => {
    res.json(listConnections(p(req, 'wsId')));
  }));
  router.post('/workspaces/:wsId/connections', h((req, res) => {
    res.status(201).json(createConnection(p(req, 'wsId'), req.body));
  }));
  router.delete('/workspaces/:wsId/connections/:connId', h((req, res) => {
    deleteConnection(p(req, 'wsId'), p(req, 'connId'));
    res.json({ ok: true });
  }));

  // Search across all workspaces
  router.get('/search', h((req, res) => {
    const query = q(req.query.q);
    if (!query) return void res.status(400).json({ error: 'Missing search query ?q=' });
    res.json(searchNotes(query));
  }));

  return router;
}
