/**
 * Style a new note starts with. One definition, used by the service layer (MCP/REST creates), the web app's
 * "new note" and its Style panel's "Reset to default". Plain constants: safe to import from browser code via
 * `@darknotes/core/defaults`.
 *
 * `headingFont` is a font *name*, not a CSS stack: the web app maps "MesloLG" to MesloLG if it is installed
 * (several Nerd Font spellings) and otherwise to DM Sans, a sans-serif.
 */
export const DEFAULT_NOTE_STYLE = {
  bgColor: '#FFF9C4',
  fontColor: '#1a1612',
  fontSize: 14,
  headingFont: 'MesloLG',
  headingSize: 17,
} as const;
