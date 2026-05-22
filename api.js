/**
 * DarkNotes REST API
 * Serves the browser app's data from ~/.darknotes/data.json
 * Mounts at http://localhost:3737/api
 */

import express from 'express';
import cors from 'cors';
import { readData, writeData, getWorkspace } from './store.js';

export function createApiRouter() {
  const router = express.Router();

  // ── Workspaces ─────────────────────────────────────────────

  router.get('/workspaces', (req, res) => {
    const data = readData();
    res.json({
      workspaces: Object.values(data.workspaces).map(ws => ({
        id: ws.id,
        name: ws.name,
        noteCount: Object.keys(ws.notes).length,
        groupCount: Object.keys(ws.groups).length,
      })),
      currentWorkspaceId: data.currentWorkspaceId,
    });
  });

  router.post('/workspaces', (req, res) => {
    const data = readData();
    const name = (req.body.name || 'New Workspace').trim();
    const id = `ws_${data.nextWorkspaceId++}`;
    data.workspaces[id] = {
      id, name,
      notes: {}, groups: {}, connections: {},
      boardOffsetX: 0, boardOffsetY: 0, boardZoom: 1,
      nextNoteId: 1, nextGroupId: 1, nextConnectionId: 1,
    };
    writeData(data);
    res.status(201).json(data.workspaces[id]);
  });

  router.get('/workspaces/:wsId', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws);
  });

  router.patch('/workspaces/:wsId', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (req.body.name !== undefined) ws.name = req.body.name;
    if (req.body.boardOffsetX !== undefined) ws.boardOffsetX = req.body.boardOffsetX;
    if (req.body.boardOffsetY !== undefined) ws.boardOffsetY = req.body.boardOffsetY;
    if (req.body.boardZoom !== undefined) ws.boardZoom = req.body.boardZoom;
    writeData(data);
    res.json(ws);
  });

  router.delete('/workspaces/:wsId', (req, res) => {
    const data = readData();
    if (!data.workspaces[req.params.wsId]) return res.status(404).json({ error: 'Workspace not found' });
    if (Object.keys(data.workspaces).length === 1)
      return res.status(400).json({ error: 'Cannot delete the last workspace' });
    delete data.workspaces[req.params.wsId];
    if (data.currentWorkspaceId === req.params.wsId)
      data.currentWorkspaceId = Object.keys(data.workspaces)[0];
    writeData(data);
    res.json({ ok: true });
  });

  router.post('/workspaces/:wsId/activate', (req, res) => {
    const data = readData();
    if (!data.workspaces[req.params.wsId]) return res.status(404).json({ error: 'Workspace not found' });
    data.currentWorkspaceId = req.params.wsId;
    writeData(data);
    res.json({ currentWorkspaceId: data.currentWorkspaceId });
  });

  // Full board save (browser sends entire workspace state)
  router.put('/workspaces/:wsId/board', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const { notes, groups, connections, boardOffsetX, boardOffsetY, boardZoom,
            nextNoteId, nextGroupId, nextConnectionId } = req.body;
    if (notes !== undefined) ws.notes = notes;
    if (groups !== undefined) ws.groups = groups;
    if (connections !== undefined) ws.connections = connections;
    if (boardOffsetX !== undefined) ws.boardOffsetX = boardOffsetX;
    if (boardOffsetY !== undefined) ws.boardOffsetY = boardOffsetY;
    if (boardZoom !== undefined) ws.boardZoom = boardZoom;
    if (nextNoteId !== undefined) ws.nextNoteId = nextNoteId;
    if (nextGroupId !== undefined) ws.nextGroupId = nextGroupId;
    if (nextConnectionId !== undefined) ws.nextConnectionId = nextConnectionId;
    writeData(data);
    res.json({ ok: true });
  });

  // ── Notes ──────────────────────────────────────────────────

  router.get('/workspaces/:wsId/notes', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    let notes = Object.values(ws.notes);
    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      notes = notes.filter(n =>
        n.heading?.toLowerCase().includes(q) ||
        (n.lines || []).some(l => l.text?.toLowerCase().includes(q)) ||
        (n.labels || []).some(l => l.toLowerCase().includes(q))
      );
    }
    if (req.query.label) {
      notes = notes.filter(n => (n.labels || []).includes(req.query.label));
    }
    if (req.query.groupId) {
      notes = notes.filter(n => n.groupId === req.query.groupId);
    }
    res.json(notes);
  });

  router.post('/workspaces/:wsId/notes', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const id = `n_${ws.nextNoteId++}`;
    const note = {
      id,
      heading:     req.body.heading     ?? 'New Note',
      lines:       req.body.lines       ?? [{ type: 'text', text: '' }],
      labels:      req.body.labels      ?? [],
      x:           req.body.x           ?? 100,
      y:           req.body.y           ?? 100,
      w:           req.body.w           ?? 300,
      h:           req.body.h           ?? 220,
      bgColor:     req.body.bgColor     ?? '#FFF9C4',
      fontColor:   req.body.fontColor   ?? '#1a1612',
      fontSize:    req.body.fontSize    ?? 14,
      headingFont: req.body.headingFont ?? 'Playfair Display',
      headingSize: req.body.headingSize ?? 17,
      groupId:     req.body.groupId     ?? null,
      zIndex:      10,
    };
    ws.notes[id] = note;
    writeData(data);
    res.status(201).json(note);
  });

  router.get('/workspaces/:wsId/notes/:noteId', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const note = ws.notes[req.params.noteId];
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  });

  router.patch('/workspaces/:wsId/notes/:noteId', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const note = ws.notes[req.params.noteId];
    if (!note) return res.status(404).json({ error: 'Note not found' });
    const allowed = ['heading','lines','labels','x','y','w','h','bgColor','fontColor',
                     'fontSize','headingFont','headingSize','groupId','zIndex'];
    allowed.forEach(k => { if (req.body[k] !== undefined) note[k] = req.body[k]; });
    writeData(data);
    res.json(note);
  });

  router.delete('/workspaces/:wsId/notes/:noteId', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!ws.notes[req.params.noteId]) return res.status(404).json({ error: 'Note not found' });
    delete ws.notes[req.params.noteId];
    // Remove connections to/from this note
    Object.keys(ws.connections).forEach(cid => {
      const c = ws.connections[cid];
      if (c.fromNote === req.params.noteId || c.toNote === req.params.noteId)
        delete ws.connections[cid];
    });
    writeData(data);
    res.json({ ok: true });
  });

  // ── Groups ─────────────────────────────────────────────────

  router.get('/workspaces/:wsId/groups', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(Object.values(ws.groups));
  });

  router.post('/workspaces/:wsId/groups', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const id = `g_${ws.nextGroupId++}`;
    const group = {
      id,
      name:      req.body.name      ?? 'New Group',
      x:         req.body.x         ?? 60,
      y:         req.body.y         ?? 60,
      w:         req.body.w         ?? 460,
      h:         req.body.h         ?? 320,
      color:     req.body.color     ?? 'rgba(196,82,42,0.08)',
      minimized: req.body.minimized ?? false,
    };
    ws.groups[id] = group;
    writeData(data);
    res.status(201).json(group);
  });

  router.patch('/workspaces/:wsId/groups/:groupId', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const group = ws.groups[req.params.groupId];
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const allowed = ['name','x','y','w','h','color','minimized'];
    allowed.forEach(k => { if (req.body[k] !== undefined) group[k] = req.body[k]; });
    writeData(data);
    res.json(group);
  });

  router.delete('/workspaces/:wsId/groups/:groupId', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!ws.groups[req.params.groupId]) return res.status(404).json({ error: 'Group not found' });
    // Unassign notes from this group
    Object.values(ws.notes).forEach(n => {
      if (n.groupId === req.params.groupId) n.groupId = null;
    });
    delete ws.groups[req.params.groupId];
    writeData(data);
    res.json({ ok: true });
  });

  // ── Connections ────────────────────────────────────────────

  router.get('/workspaces/:wsId/connections', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(Object.values(ws.connections));
  });

  router.post('/workspaces/:wsId/connections', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    const { fromNote, fromSide, toNote, toSide } = req.body;
    if (!fromNote || !toNote || !fromSide || !toSide)
      return res.status(400).json({ error: 'fromNote, fromSide, toNote, toSide are required' });
    const id = `c_${ws.nextConnectionId++}`;
    const conn = { id, fromNote, fromSide, toNote, toSide };
    ws.connections[id] = conn;
    writeData(data);
    res.status(201).json(conn);
  });

  router.delete('/workspaces/:wsId/connections/:connId', (req, res) => {
    const data = readData();
    const ws = data.workspaces[req.params.wsId];
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (!ws.connections[req.params.connId])
      return res.status(404).json({ error: 'Connection not found' });
    delete ws.connections[req.params.connId];
    writeData(data);
    res.json({ ok: true });
  });

  // ── Search across all workspaces ───────────────────────────

  router.get('/search', (req, res) => {
    const data = readData();
    const q = (req.query.q || '').toLowerCase();
    if (!q) return res.status(400).json({ error: 'Missing search query ?q=' });
    const results = [];
    Object.values(data.workspaces).forEach(ws => {
      Object.values(ws.notes).forEach(n => {
        const headingMatch = n.heading?.toLowerCase().includes(q);
        const bodyMatch    = (n.lines || []).some(l => l.text?.toLowerCase().includes(q));
        const labelMatch   = (n.labels || []).some(l => l.toLowerCase().includes(q));
        if (headingMatch || bodyMatch || labelMatch) {
          results.push({ workspaceId: ws.id, workspaceName: ws.name, note: n });
        }
      });
    });
    res.json(results);
  });

  return router;
}
