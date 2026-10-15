import { z } from 'zod';
import { ValidationError } from './errors';

export const sideSchema = z.enum(['top', 'right', 'bottom', 'left']);

/** Loose so extra per-line properties already present in data files survive a round trip. */
export const lineSchema = z.looseObject({
  type: z.enum(['text', 'check']),
  text: z.string(),
  checked: z.boolean().optional(),
});

const noteFields = {
  heading: z.string(),
  lines: z.array(lineSchema),
  labels: z.array(z.string()),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  bgColor: z.string(),
  fontColor: z.string(),
  fontSize: z.number(),
  headingFont: z.string(),
  headingSize: z.number(),
  groupId: z.string().nullable(),
  zIndex: z.number(),
};

/** `body` is a plain-text convenience that is split into text lines; it is ignored if `lines` is given. */
export const noteInputSchema = z.object({ ...noteFields, body: z.string() }).partial();
export const notePatchSchema = z.object({ ...noteFields, body: z.string() }).partial();

export const groupFields = {
  name: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  color: z.string(),
  minimized: z.boolean(),
};
export const groupInputSchema = z.object(groupFields).partial();
export const groupPatchSchema = z.object(groupFields).partial();

export const arrowsSchema = z.enum(['none', 'start', 'end', 'both']);

export const connectionInputSchema = z.object({
  fromNote: z.string().min(1),
  fromSide: sideSchema,
  toNote: z.string().min(1),
  toSide: sideSchema,
  arrows: arrowsSchema.optional(),
});

export const workspacePatchSchema = z
  .object({
    name: z.string(),
    boardOffsetX: z.number(),
    boardOffsetY: z.number(),
    boardZoom: z.number(),
  })
  .partial();

const idItem = z.looseObject({ id: z.string() });
const collection = z.union([z.array(idItem), z.record(z.string(), idItem)]);

/** Whole-board save sent by the browser. Collections may be arrays (browser) or id-keyed maps. */
export const boardSchema = z
  .object({
    notes: collection,
    groups: collection,
    connections: collection,
    boardOffsetX: z.number(),
    boardOffsetY: z.number(),
    boardZoom: z.number(),
    nextNoteId: z.number(),
    nextGroupId: z.number(),
    nextConnectionId: z.number(),
  })
  .partial();

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '),
    );
  }
  return result.data;
}

export type NoteInput = z.input<typeof noteInputSchema>;
export type NotePatch = z.input<typeof notePatchSchema>;
export type GroupInput = z.input<typeof groupInputSchema>;
export type GroupPatch = z.input<typeof groupPatchSchema>;
export type ConnectionInput = z.input<typeof connectionInputSchema>;
export type WorkspacePatch = z.input<typeof workspacePatchSchema>;
export type BoardInput = z.input<typeof boardSchema>;

// ─── incremental changes (browser sync) ──────────────────────

const id = z.string().min(1);
const viewFields = z.object({ boardOffsetX: z.number(), boardOffsetY: z.number(), boardZoom: z.number() }).partial();

/**
 * One edit to a workspace. The browser sends only what it changed, so edits made elsewhere (MCP, another tab)
 * to other notes or other fields are never overwritten. Every op is idempotent: replaying a batch is safe.
 */
export const changeSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('createNote'), note: noteInputSchema.extend({ id }) }),
  z.object({ op: z.literal('patchNote'), id, fields: notePatchSchema }),
  z.object({ op: z.literal('deleteNote'), id }),
  z.object({ op: z.literal('createGroup'), group: groupInputSchema.extend({ id }) }),
  z.object({ op: z.literal('patchGroup'), id, fields: groupPatchSchema }),
  z.object({ op: z.literal('deleteGroup'), id }),
  z.object({ op: z.literal('createConnection'), connection: connectionInputSchema.extend({ id }) }),
  z.object({ op: z.literal('patchConnection'), id, fields: z.object({ arrows: arrowsSchema }).partial() }),
  z.object({ op: z.literal('deleteConnection'), id }),
  z.object({ op: z.literal('setView'), fields: viewFields }),
]);

export const changesSchema = z.object({ changes: z.array(changeSchema).max(5000) });

import type { Change } from './types';
export type { Change };

// Compile-time check that the plain `Change` type is accepted by the schema.
const _changeTypeMatchesSchema = (c: Change): z.input<typeof changeSchema> => c;
void _changeTypeMatchesSchema;
