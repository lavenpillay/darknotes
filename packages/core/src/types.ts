/** Data model for ~/.darknotes/data.json (unchanged from the JS version). */

export type Line =
  | { type: 'text'; text: string }
  | { type: 'check'; text: string; checked?: boolean };

export interface Note {
  id: string; // n_<counter>
  heading: string;
  lines: Line[];
  labels: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  bgColor: string;
  fontColor: string;
  fontSize: number;
  headingFont: string;
  headingSize: number;
  groupId: string | null;
  zIndex: number;
}

export interface Group {
  id: string; // g_<counter>
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  minimized: boolean;
}

export type Side = 'top' | 'right' | 'bottom' | 'left';

export type Arrows = 'none' | 'start' | 'end' | 'both';

export interface Connection {
  id: string; // c_<counter>
  fromNote: string;
  fromSide: Side;
  toNote: string;
  toSide: Side;
  /** Arrowheads. Absent means 'none' (connections made before arrows existed, or via the API). */
  arrows?: Arrows;
}

export interface Workspace {
  id: string; // ws_<counter>
  name: string;
  notes: Record<string, Note>;
  groups: Record<string, Group>;
  connections: Record<string, Connection>;
  boardOffsetX: number;
  boardOffsetY: number;
  boardZoom: number;
  nextNoteId: number;
  nextGroupId: number;
  nextConnectionId: number;
}

export interface DarknotesData {
  workspaces: Record<string, Workspace>;
  currentWorkspaceId: string;
  nextWorkspaceId: number;
}

type NoteFields = Omit<Note, 'id'>;
type GroupFields = Omit<Group, 'id'>;

/**
 * One edit to a workspace, as sent by the browser (POST /workspaces/:id/changes). Defined here, as plain
 * types, so client code can use it without importing the Zod schemas; schemas.ts checks the two agree.
 */
export type Change =
  | { op: 'createNote'; note: { id: string } & Partial<NoteFields> }
  | { op: 'patchNote'; id: string; fields: Partial<NoteFields> }
  | { op: 'deleteNote'; id: string }
  | { op: 'createGroup'; group: { id: string } & Partial<GroupFields> }
  | { op: 'patchGroup'; id: string; fields: Partial<GroupFields> }
  | { op: 'deleteGroup'; id: string }
  | { op: 'createConnection'; connection: Connection }
  | { op: 'patchConnection'; id: string; fields: { arrows?: Arrows } }
  | { op: 'deleteConnection'; id: string }
  | { op: 'setView'; fields: Partial<Pick<Workspace, 'boardOffsetX' | 'boardOffsetY' | 'boardZoom'>> };
