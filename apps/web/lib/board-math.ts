/**
 * Pure board geometry. The board is drawn with `transform: translate(offsetX, offsetY) scale(zoom)`
 * and transform-origin 0 0, exactly like the legacy app, so saved offsets/zooms stay valid.
 */

export const BOARD_W = 4000;
export const BOARD_H = 3000;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.1;

export interface View {
  offsetX: number;
  offsetY: number;
  zoom: number;
}
export interface Point {
  x: number;
  y: number;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Viewport point (px from the viewport's top-left) -> board coordinates. */
export function screenToBoard(view: View, p: Point): Point {
  return { x: (p.x - view.offsetX) / view.zoom, y: (p.y - view.offsetY) / view.zoom };
}

/** Change zoom while keeping the board point under `pivot` (viewport coordinates) fixed. */
export function zoomAround(view: View, nextZoom: number, pivot: Point): View {
  const zoom = clampZoom(nextZoom);
  const b = screenToBoard(view, pivot);
  return { zoom, offsetX: pivot.x - b.x * zoom, offsetY: pivot.y - b.y * zoom };
}

/** Board coordinates of the middle of the visible area. */
export function visibleCenter(view: View, viewportW: number, viewportH: number): Point {
  return screenToBoard(view, { x: viewportW / 2, y: viewportH / 2 });
}

/** Wheel delta -> multiplicative zoom factor (smooth for trackpads, steady for mouse wheels). */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.0025);
}

export function roundZoom(zoom: number): number {
  return Math.round(zoom * 100) / 100;
}
