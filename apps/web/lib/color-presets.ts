/** The built-in swatches, unchanged from the original app, so existing notes keep their colours selectable. */
export const NOTE_COLOR_PRESETS = [
  '#FFF9C4', '#FFECB3', '#FFD7B5', '#FFD1DC', '#F3E5F5',
  '#E3F2FD', '#E8F5E9', '#F1F8E9', '#EFEBE9', '#ECEFF1',
  '#ffffff', '#FFF3E0', '#FCE4EC', '#E0F7FA', '#EDE7F6',
  '#fdf3e7', '#e8f4f8', '#f8f0fb', '#eafaf1', '#fdedec',
];

export const TEXT_COLOR_PRESETS = [
  '#1a1612', '#2c3e50', '#c0392b', '#16a085', '#8e44ad',
  '#e67e22', '#2980b9', '#27ae60', '#ffffff', '#7f8c8d',
];

export const BODY_FONT_SIZES = [11, 12, 13, 14, 15, 16, 18, 20, 24];
export const HEADING_SIZE_MIN = 12;
export const HEADING_SIZE_MAX = 36;

/** The next size up (+1) or down (-1) in the list, starting from the nearest listed size. */
export function stepBodySize(current: number, direction: 1 | -1): number {
  let nearest = 0;
  BODY_FONT_SIZES.forEach((s, i) => {
    if (Math.abs(s - current) < Math.abs(BODY_FONT_SIZES[nearest]! - current)) nearest = i;
  });
  // An off-list value (say 17) steps to the neighbour on the requested side, not past it.
  const at = BODY_FONT_SIZES[nearest]!;
  let index = nearest;
  if (direction === 1 && at > current) index = nearest;
  else if (direction === -1 && at < current) index = nearest;
  else index = nearest + direction;
  return BODY_FONT_SIZES[Math.min(BODY_FONT_SIZES.length - 1, Math.max(0, index))]!;
}
