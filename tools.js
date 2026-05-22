/**
 * DarkNotes MCP Tools
 * Defines all tools exposed via the Model Context Protocol
 */

import { readData, writeData, getWorkspace } from './store.js';

// ─── Tool definitions (schema) ────────────────────────────────────────────────

export const TOOLS = [
  // Workspaces
  {
    name: 'list_workspaces',
    description: 'List all DarkNotes workspaces with their note and group counts.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_workspace',
    description: 'Create a new DarkNotes workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the new workspace' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_workspace',
    description: 'Delete a workspace and all its contents. Cannot delete the last workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'ID of the workspace to delete' },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'rename_workspace',
    description: 'Rename an existing workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'ID of the workspace' },
        name:        { type: 'string', description: 'New name for the workspace' },
      },
      required: ['workspaceId', 'name'],
    },
  },

  // Notes
  {
    name: 'list_notes',
    description: 'List all notes in a workspace. Optionally filter by search text or label.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current workspace)' },
        search:      { type: 'string', description: 'Optional text to search in heading and body' },
        label:       { type: 'string', description: 'Optional label to filter by (without #)' },
        groupId:     { type: 'string', description: 'Optional group ID to filter by' },
      },
      required: [],
    },
  },
  {
    name: 'get_note',
    description: 'Get full details of a single note including its content lines.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current)' },
        noteId:      { type: 'string', description: 'Note ID' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note in a workspace. Content is provided as an array of lines (text or checklist items).',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current)' },
        heading:     { type: 'string', description: 'Note heading/title' },
        body:        { type: 'string', description: 'Plain text body (will be split into lines). Use this or lines, not both.' },
        lines: {
          type: 'array',
          description: 'Array of line objects. Use this for mixed text/checklist content.',
          items: {
            type: 'object',
            properties: {
              type:    { type: 'string', enum: ['text', 'check'], description: '"text" for plain line, "check" for checkbox' },
              text:    { type: 'string', description: 'Line content' },
              checked: { type: 'boolean', description: 'Whether checkbox is checked (only for type=check)' },
            },
            required: ['type', 'text'],
          },
        },
        labels:  { type: 'array', items: { type: 'string' }, description: 'Labels/tags (without #)' },
        bgColor: { type: 'string', description: 'Background color hex (e.g. "#FFF9C4")' },
        groupId: { type: 'string', description: 'Group ID to place note in' },
      },
      required: ['heading'],
    },
  },
  {
    name: 'update_note',
    description: 'Update an existing note. Only provided fields are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current)' },
        noteId:      { type: 'string', description: 'Note ID' },
        heading:     { type: 'string', description: 'New heading' },
        body:        { type: 'string', description: 'Replace entire body with this plain text (split into lines)' },
        lines:       { type: 'array',  description: 'Replace entire lines array', items: { type: 'object' } },
        labels:      { type: 'array',  items: { type: 'string' }, description: 'Replace labels' },
        bgColor:     { type: 'string', description: 'Background color' },
        fontColor:   { type: 'string', description: 'Font color' },
        fontSize:    { type: 'number', description: 'Font size in px (11–24)' },
        groupId:     { type: 'string', description: 'Move note to this group (null to ungroup)' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note and all its connections.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current)' },
        noteId:      { type: 'string', description: 'Note ID' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'append_to_note',
    description: 'Append lines to an existing note without replacing its content.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current)' },
        noteId:      { type: 'string', description: 'Note ID' },
        body:        { type: 'string', description: 'Plain text to append (split into lines)' },
        lines:       { type: 'array',  description: 'Lines to append', items: { type: 'object' } },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'add_label',
    description: 'Add a label to a note.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        noteId:      { type: 'string', description: 'Note ID' },
        label:       { type: 'string', description: 'Label to add (without #)' },
      },
      required: ['noteId', 'label'],
    },
  },
  {
    name: 'remove_label',
    description: 'Remove a label from a note.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        noteId:      { type: 'string', description: 'Note ID' },
        label:       { type: 'string', description: 'Label to remove (without #)' },
      },
      required: ['noteId', 'label'],
    },
  },
  {
    name: 'check_item',
    description: 'Check or uncheck a checklist item within a note by its index.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        noteId:      { type: 'string', description: 'Note ID' },
        lineIndex:   { type: 'number', description: 'Zero-based index of the checklist line' },
        checked:     { type: 'boolean', description: 'true to check, false to uncheck' },
      },
      required: ['noteId', 'lineIndex', 'checked'],
    },
  },

  // Groups
  {
    name: 'list_groups',
    description: 'List all groups in a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current)' },
      },
      required: [],
    },
  },
  {
    name: 'create_group',
    description: 'Create a new note group.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current)' },
        name:        { type: 'string', description: 'Group name' },
        color:       { type: 'string', description: 'Background color (rgba or hex)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_group',
    description: 'Delete a group (notes inside are ungrouped, not deleted).',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        groupId:     { type: 'string', description: 'Group ID' },
      },
      required: ['groupId'],
    },
  },
  {
    name: 'add_note_to_group',
    description: 'Add a note to a group.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        noteId:      { type: 'string', description: 'Note ID' },
        groupId:     { type: 'string', description: 'Group ID' },
      },
      required: ['noteId', 'groupId'],
    },
  },
  {
    name: 'remove_note_from_group',
    description: 'Remove a note from its group.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        noteId:      { type: 'string', description: 'Note ID' },
      },
      required: ['noteId'],
    },
  },

  // Connections
  {
    name: 'list_connections',
    description: 'List all connections (lines between notes) in a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID (defaults to current)' },
      },
      required: [],
    },
  },
  {
    name: 'create_connection',
    description: 'Create a connection line between two notes.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        fromNote:    { type: 'string', description: 'Source note ID' },
        fromSide:    { type: 'string', enum: ['top','right','bottom','left'], description: 'Side on source note' },
        toNote:      { type: 'string', description: 'Target note ID' },
        toSide:      { type: 'string', enum: ['top','right','bottom','left'], description: 'Side on target note' },
      },
      required: ['fromNote', 'fromSide', 'toNote', 'toSide'],
    },
  },
  {
    name: 'delete_connection',
    description: 'Delete a connection between notes.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId:  { type: 'string' },
        connectionId: { type: 'string', description: 'Connection ID' },
      },
      required: ['connectionId'],
    },
  },

  // Search
  {
    name: 'search',
    description: 'Search for notes across all workspaces by text content, heading, or label.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
];

// ─── Tool handlers ─────────────────────────────────────────────────────────────

function resolveWsId(data, wsId) {
  return wsId || data.currentWorkspaceId;
}

function bodyToLines(body) {
  return body.split('\n').map(t => ({ type: 'text', text: t }));
}

export async function handleTool(name, args) {
  const data = readData();

  switch (name) {

    // ── Workspaces ────────────────────────────────────────────
    case 'list_workspaces': {
      return Object.values(data.workspaces).map(ws => ({
        id: ws.id,
        name: ws.name,
        noteCount: Object.keys(ws.notes).length,
        groupCount: Object.keys(ws.groups).length,
        isCurrent: ws.id === data.currentWorkspaceId,
      }));
    }

    case 'create_workspace': {
      const id = `ws_${data.nextWorkspaceId++}`;
      data.workspaces[id] = {
        id, name: args.name,
        notes: {}, groups: {}, connections: {},
        boardOffsetX: 0, boardOffsetY: 0, boardZoom: 1,
        nextNoteId: 1, nextGroupId: 1, nextConnectionId: 1,
      };
      writeData(data);
      return { ok: true, workspace: data.workspaces[id] };
    }

    case 'delete_workspace': {
      if (!data.workspaces[args.workspaceId])
        throw new Error('Workspace not found');
      if (Object.keys(data.workspaces).length === 1)
        throw new Error('Cannot delete the last workspace');
      const name = data.workspaces[args.workspaceId].name;
      delete data.workspaces[args.workspaceId];
      if (data.currentWorkspaceId === args.workspaceId)
        data.currentWorkspaceId = Object.keys(data.workspaces)[0];
      writeData(data);
      return { ok: true, deleted: name };
    }

    case 'rename_workspace': {
      const ws = data.workspaces[args.workspaceId];
      if (!ws) throw new Error('Workspace not found');
      ws.name = args.name;
      writeData(data);
      return { ok: true, workspace: ws };
    }

    // ── Notes ────────────────────────────────────────────────
    case 'list_notes': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      let notes = Object.values(ws.notes);
      if (args.search) {
        const q = args.search.toLowerCase();
        notes = notes.filter(n =>
          n.heading?.toLowerCase().includes(q) ||
          (n.lines||[]).some(l => l.text?.toLowerCase().includes(q)) ||
          (n.labels||[]).some(l => l.toLowerCase().includes(q))
        );
      }
      if (args.label) notes = notes.filter(n => (n.labels||[]).includes(args.label));
      if (args.groupId) notes = notes.filter(n => n.groupId === args.groupId);
      return notes.map(n => ({
        id: n.id, heading: n.heading,
        preview: (n.lines||[]).map(l => l.text).join(' ').slice(0, 80),
        labels: n.labels, groupId: n.groupId,
        lineCount: (n.lines||[]).length,
      }));
    }

    case 'get_note': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const note = ws.notes[args.noteId];
      if (!note) throw new Error('Note not found');
      return note;
    }

    case 'create_note': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const id = `n_${ws.nextNoteId++}`;
      let lines = args.lines ?? (args.body ? bodyToLines(args.body) : [{ type: 'text', text: '' }]);
      const note = {
        id, heading: args.heading ?? 'New Note', lines,
        labels: args.labels ?? [], x: 100, y: 100, w: 300, h: 220,
        bgColor: args.bgColor ?? '#FFF9C4', fontColor: '#1a1612',
        fontSize: 14, headingFont: 'Playfair Display', headingSize: 17,
        groupId: args.groupId ?? null, zIndex: 10,
      };
      ws.notes[id] = note;
      writeData(data);
      return { ok: true, note };
    }

    case 'update_note': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const note = ws.notes[args.noteId];
      if (!note) throw new Error('Note not found');
      if (args.heading   !== undefined) note.heading   = args.heading;
      if (args.lines     !== undefined) note.lines     = args.lines;
      if (args.body      !== undefined) note.lines     = bodyToLines(args.body);
      if (args.labels    !== undefined) note.labels    = args.labels;
      if (args.bgColor   !== undefined) note.bgColor   = args.bgColor;
      if (args.fontColor !== undefined) note.fontColor = args.fontColor;
      if (args.fontSize  !== undefined) note.fontSize  = args.fontSize;
      if (args.groupId   !== undefined) note.groupId   = args.groupId;
      writeData(data);
      return { ok: true, note };
    }

    case 'delete_note': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      if (!ws.notes[args.noteId]) throw new Error('Note not found');
      const heading = ws.notes[args.noteId].heading;
      delete ws.notes[args.noteId];
      Object.keys(ws.connections).forEach(cid => {
        const c = ws.connections[cid];
        if (c.fromNote === args.noteId || c.toNote === args.noteId)
          delete ws.connections[cid];
      });
      writeData(data);
      return { ok: true, deleted: heading };
    }

    case 'append_to_note': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const note = ws.notes[args.noteId];
      if (!note) throw new Error('Note not found');
      const newLines = args.lines ?? (args.body ? bodyToLines(args.body) : []);
      note.lines = [...(note.lines||[]), ...newLines];
      writeData(data);
      return { ok: true, note };
    }

    case 'add_label': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const note = ws.notes[args.noteId];
      if (!note) throw new Error('Note not found');
      if (!note.labels.includes(args.label)) note.labels.push(args.label);
      writeData(data);
      return { ok: true, labels: note.labels };
    }

    case 'remove_label': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const note = ws.notes[args.noteId];
      if (!note) throw new Error('Note not found');
      note.labels = note.labels.filter(l => l !== args.label);
      writeData(data);
      return { ok: true, labels: note.labels };
    }

    case 'check_item': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const note = ws.notes[args.noteId];
      if (!note) throw new Error('Note not found');
      const line = note.lines?.[args.lineIndex];
      if (!line) throw new Error(`No line at index ${args.lineIndex}`);
      if (line.type !== 'check') throw new Error('Line is not a checklist item');
      line.checked = args.checked;
      writeData(data);
      return { ok: true, line };
    }

    // ── Groups ───────────────────────────────────────────────
    case 'list_groups': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      return Object.values(ws.groups).map(g => ({
        ...g,
        noteCount: Object.values(ws.notes).filter(n => n.groupId === g.id).length,
      }));
    }

    case 'create_group': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const id = `g_${ws.nextGroupId++}`;
      const group = {
        id, name: args.name, x: 60, y: 60, w: 460, h: 320,
        color: args.color ?? 'rgba(196,82,42,0.08)', minimized: false,
      };
      ws.groups[id] = group;
      writeData(data);
      return { ok: true, group };
    }

    case 'delete_group': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      if (!ws.groups[args.groupId]) throw new Error('Group not found');
      const name = ws.groups[args.groupId].name;
      Object.values(ws.notes).forEach(n => {
        if (n.groupId === args.groupId) n.groupId = null;
      });
      delete ws.groups[args.groupId];
      writeData(data);
      return { ok: true, deleted: name };
    }

    case 'add_note_to_group': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const note = ws.notes[args.noteId];
      if (!note) throw new Error('Note not found');
      if (!ws.groups[args.groupId]) throw new Error('Group not found');
      note.groupId = args.groupId;
      writeData(data);
      return { ok: true, note };
    }

    case 'remove_note_from_group': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      const note = ws.notes[args.noteId];
      if (!note) throw new Error('Note not found');
      note.groupId = null;
      writeData(data);
      return { ok: true, note };
    }

    // ── Connections ──────────────────────────────────────────
    case 'list_connections': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      return Object.values(ws.connections).map(c => ({
        ...c,
        fromHeading: ws.notes[c.fromNote]?.heading,
        toHeading:   ws.notes[c.toNote]?.heading,
      }));
    }

    case 'create_connection': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      if (!ws.notes[args.fromNote]) throw new Error('Source note not found');
      if (!ws.notes[args.toNote])   throw new Error('Target note not found');
      const id = `c_${ws.nextConnectionId++}`;
      const conn = { id, fromNote: args.fromNote, fromSide: args.fromSide,
                         toNote: args.toNote,   toSide: args.toSide };
      ws.connections[id] = conn;
      writeData(data);
      return { ok: true, connection: conn };
    }

    case 'delete_connection': {
      const wsId = resolveWsId(data, args.workspaceId);
      const ws = data.workspaces[wsId];
      if (!ws) throw new Error('Workspace not found');
      if (!ws.connections[args.connectionId]) throw new Error('Connection not found');
      delete ws.connections[args.connectionId];
      writeData(data);
      return { ok: true };
    }

    // ── Search ───────────────────────────────────────────────
    case 'search': {
      const q = args.query.toLowerCase();
      const results = [];
      Object.values(data.workspaces).forEach(ws => {
        Object.values(ws.notes).forEach(n => {
          if (
            n.heading?.toLowerCase().includes(q) ||
            (n.lines||[]).some(l => l.text?.toLowerCase().includes(q)) ||
            (n.labels||[]).some(l => l.toLowerCase().includes(q))
          ) {
            results.push({
              workspaceId: ws.id, workspaceName: ws.name,
              noteId: n.id, heading: n.heading, labels: n.labels,
              preview: (n.lines||[]).map(l=>l.text).join(' ').slice(0,100),
            });
          }
        });
      });
      return results;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
