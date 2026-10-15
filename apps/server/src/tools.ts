/**
 * MCP tools: schemas and handlers. Tool names, arguments and result shapes match the legacy tools.js;
 * create_note / update_note / create_group additionally accept position, size and font options.
 */

import {
  type ConnectionInput,
  ValidationError,
  addLabel,
  addNoteToGroup,
  appendToNote,
  checkItem,
  createConnection,
  createGroup,
  createNote,
  createWorkspace,
  deleteConnection,
  deleteGroup,
  deleteNote,
  deleteWorkspace,
  getNote,
  listConnections,
  listGroups,
  listNotes,
  listWorkspaces,
  removeLabel,
  removeNoteFromGroup,
  renameWorkspace,
  searchNotes,
  updateNote,
} from '@darknotes/core';

type Args = Record<string, unknown>;

// ─── schemas ──────────────────────────────────────────────────

const workspaceId = { type: 'string', description: 'Workspace ID (defaults to current workspace)' };
const noteId = { type: 'string', description: 'Note ID' };
const groupId = { type: 'string', description: 'Group ID' };
const side = { type: 'string', enum: ['top', 'right', 'bottom', 'left'] };
const lineItem = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['text', 'check'], description: '"text" for plain line, "check" for checkbox' },
    text: { type: 'string', description: 'Line content' },
    checked: { type: 'boolean', description: 'Whether checkbox is checked (only for type=check)' },
  },
  required: ['type', 'text'],
};
const layout = {
  x: { type: 'number', description: 'Board x position in px' },
  y: { type: 'number', description: 'Board y position in px' },
  w: { type: 'number', description: 'Width in px' },
  h: { type: 'number', description: 'Height in px' },
};
const style = {
  bgColor: { type: 'string', description: 'Background color hex (e.g. "#FFF9C4")' },
  fontColor: { type: 'string', description: 'Font color' },
  fontSize: { type: 'number', description: 'Font size in px (11–24)' },
  headingFont: { type: 'string', description: 'Heading font name (e.g. "Lora"). Default "MesloLG": MesloLG if installed, else a sans-serif' },
  headingSize: { type: 'number', description: 'Heading font size in px' },
};

const tool = (name: string, description: string, properties: object, required: string[] = []) => ({
  name,
  description,
  inputSchema: { type: 'object' as const, properties, required },
});

export const TOOLS = [
  tool('list_workspaces', 'List all DarkNotes workspaces with their note and group counts.', {}),
  tool('create_workspace', 'Create a new DarkNotes workspace.', { name: { type: 'string', description: 'Name for the new workspace' } }, ['name']),
  tool('delete_workspace', 'Delete a workspace and all its contents. Cannot delete the last workspace.', { workspaceId: { type: 'string', description: 'ID of the workspace to delete' } }, ['workspaceId']),
  tool('rename_workspace', 'Rename an existing workspace.', { workspaceId: { type: 'string', description: 'ID of the workspace' }, name: { type: 'string', description: 'New name for the workspace' } }, ['workspaceId', 'name']),

  tool('list_notes', 'List all notes in a workspace. Optionally filter by search text or label.', {
    workspaceId,
    search: { type: 'string', description: 'Optional text to search in heading and body' },
    label: { type: 'string', description: 'Optional label to filter by (without #)' },
    groupId: { type: 'string', description: 'Optional group ID to filter by' },
  }),
  tool('get_note', 'Get full details of a single note including its content lines.', { workspaceId, noteId }, ['noteId']),
  tool('create_note', 'Create a new note in a workspace. Content is provided as an array of lines (text or checklist items).', {
    workspaceId,
    heading: { type: 'string', description: 'Note heading/title' },
    body: { type: 'string', description: 'Plain text body (will be split into lines). Use this or lines, not both.' },
    lines: { type: 'array', description: 'Array of line objects. Use this for mixed text/checklist content.', items: lineItem },
    labels: { type: 'array', items: { type: 'string' }, description: 'Labels/tags (without #)' },
    groupId: { type: 'string', description: 'Group ID to place note in' },
    ...layout,
    ...style,
  }, ['heading']),
  tool('update_note', 'Update an existing note. Only provided fields are changed.', {
    workspaceId,
    noteId,
    heading: { type: 'string', description: 'New heading' },
    body: { type: 'string', description: 'Replace entire body with this plain text (split into lines)' },
    lines: { type: 'array', description: 'Replace entire lines array', items: lineItem },
    labels: { type: 'array', items: { type: 'string' }, description: 'Replace labels' },
    groupId: { type: ['string', 'null'], description: 'Move note to this group (null to ungroup)' },
    ...layout,
    ...style,
  }, ['noteId']),
  tool('delete_note', 'Delete a note and all its connections.', { workspaceId, noteId }, ['noteId']),
  tool('append_to_note', 'Append lines to an existing note without replacing its content.', {
    workspaceId,
    noteId,
    body: { type: 'string', description: 'Plain text to append (split into lines)' },
    lines: { type: 'array', description: 'Lines to append', items: lineItem },
  }, ['noteId']),
  tool('add_label', 'Add a label to a note.', { workspaceId, noteId, label: { type: 'string', description: 'Label to add (without #)' } }, ['noteId', 'label']),
  tool('remove_label', 'Remove a label from a note.', { workspaceId, noteId, label: { type: 'string', description: 'Label to remove (without #)' } }, ['noteId', 'label']),
  tool('check_item', 'Check or uncheck a checklist item within a note by its index.', {
    workspaceId,
    noteId,
    lineIndex: { type: 'number', description: 'Zero-based index of the checklist line' },
    checked: { type: 'boolean', description: 'true to check, false to uncheck' },
  }, ['noteId', 'lineIndex', 'checked']),

  tool('list_groups', 'List all groups in a workspace.', { workspaceId }),
  tool('create_group', 'Create a new note group.', {
    workspaceId,
    name: { type: 'string', description: 'Group name' },
    color: { type: 'string', description: 'Background color (rgba or hex)' },
    ...layout,
  }, ['name']),
  tool('delete_group', 'Delete a group (notes inside are ungrouped, not deleted).', { workspaceId, groupId }, ['groupId']),
  tool('add_note_to_group', 'Add a note to a group.', { workspaceId, noteId, groupId }, ['noteId', 'groupId']),
  tool('remove_note_from_group', 'Remove a note from its group.', { workspaceId, noteId }, ['noteId']),

  tool('list_connections', 'List all connections (lines between notes) in a workspace.', { workspaceId }),
  tool('create_connection', 'Create a connection line between two notes.', {
    workspaceId,
    fromNote: { type: 'string', description: 'Source note ID' },
    fromSide: { ...side, description: 'Side on source note' },
    toNote: { type: 'string', description: 'Target note ID' },
    toSide: { ...side, description: 'Side on target note' },
    arrows: { type: 'string', enum: ['none', 'start', 'end', 'both'], description: 'Arrowheads (default none)' },
  }, ['fromNote', 'fromSide', 'toNote', 'toSide']),
  tool('delete_connection', 'Delete a connection between notes.', { workspaceId, connectionId: { type: 'string', description: 'Connection ID' } }, ['connectionId']),

  tool('search', 'Search for notes across all workspaces by text content, heading, or label.', { query: { type: 'string', description: 'Search query' } }, ['query']),
];

// ─── handlers ─────────────────────────────────────────────────

function pick(args: Args, keys: string[]): Args {
  const out: Args = {};
  for (const k of keys) if (args[k] !== undefined) out[k] = args[k];
  return out;
}

function str(args: Args, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || v === '') throw new ValidationError(`${key} is required`);
  return v;
}

const ws = (args: Args) => (typeof args.workspaceId === 'string' ? args.workspaceId : undefined);
const preview = (lines: Array<{ text?: string }> | undefined, n: number) =>
  (lines ?? []).map((l) => l.text).join(' ').slice(0, n);

const LAYOUT = ['x', 'y', 'w', 'h'];
const STYLE = ['bgColor', 'fontColor', 'fontSize', 'headingFont', 'headingSize'];

export async function handleTool(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'list_workspaces':
      return listWorkspaces().workspaces;
    case 'create_workspace':
      return { ok: true, workspace: createWorkspace(str(args, 'name')) };
    case 'delete_workspace':
      return { ok: true, deleted: deleteWorkspace(str(args, 'workspaceId')).name };
    case 'rename_workspace':
      return { ok: true, workspace: renameWorkspace(str(args, 'workspaceId'), str(args, 'name')) };

    case 'list_notes':
      return listNotes(ws(args), {
        search: args.search as string | undefined,
        label: args.label as string | undefined,
        groupId: args.groupId as string | undefined,
      }).map((n) => ({
        id: n.id,
        heading: n.heading,
        preview: preview(n.lines, 80),
        labels: n.labels,
        groupId: n.groupId,
        lineCount: (n.lines ?? []).length,
      }));
    case 'get_note':
      return getNote(ws(args), str(args, 'noteId'));
    case 'create_note':
      return {
        ok: true,
        note: createNote(ws(args), pick(args, ['heading', 'body', 'lines', 'labels', 'groupId', ...LAYOUT, ...STYLE])),
      };
    case 'update_note':
      return {
        ok: true,
        note: updateNote(
          ws(args),
          str(args, 'noteId'),
          pick(args, ['heading', 'body', 'lines', 'labels', 'groupId', ...LAYOUT, ...STYLE]),
        ),
      };
    case 'delete_note':
      return { ok: true, deleted: deleteNote(ws(args), str(args, 'noteId')).heading };
    case 'append_to_note':
      return {
        ok: true,
        note: appendToNote(ws(args), str(args, 'noteId'), {
          body: args.body as string | undefined,
          lines: args.lines as unknown[] | undefined,
        }),
      };
    case 'add_label':
      return { ok: true, labels: addLabel(ws(args), str(args, 'noteId'), str(args, 'label')) };
    case 'remove_label':
      return { ok: true, labels: removeLabel(ws(args), str(args, 'noteId'), str(args, 'label')) };
    case 'check_item': {
      if (typeof args.lineIndex !== 'number') throw new ValidationError('lineIndex is required');
      if (typeof args.checked !== 'boolean') throw new ValidationError('checked is required');
      return { ok: true, line: checkItem(ws(args), str(args, 'noteId'), args.lineIndex, args.checked) };
    }

    case 'list_groups':
      return listGroups(ws(args));
    case 'create_group':
      return { ok: true, group: createGroup(ws(args), pick(args, ['name', 'color', ...LAYOUT])) };
    case 'delete_group':
      return { ok: true, deleted: deleteGroup(ws(args), str(args, 'groupId')).name };
    case 'add_note_to_group':
      return { ok: true, note: addNoteToGroup(ws(args), str(args, 'noteId'), str(args, 'groupId')) };
    case 'remove_note_from_group':
      return { ok: true, note: removeNoteFromGroup(ws(args), str(args, 'noteId')) };

    case 'list_connections':
      return listConnections(ws(args));
    case 'create_connection':
      return {
        ok: true,
        connection: createConnection(ws(args), pick(args, ['fromNote', 'fromSide', 'toNote', 'toSide', 'arrows']) as ConnectionInput),
      };
    case 'delete_connection':
      deleteConnection(ws(args), str(args, 'connectionId'));
      return { ok: true };

    case 'search':
      return searchNotes(str(args, 'query')).map(({ workspaceId, workspaceName, note }) => ({
        workspaceId,
        workspaceName,
        noteId: note.id,
        heading: note.heading,
        labels: note.labels,
        preview: preview(note.lines, 100),
      }));

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
