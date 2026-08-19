export const DEFAULT_FILE_RAIL_WIDTH = 280;
export const MIN_FILE_RAIL_WIDTH = 220;
export const MAX_FILE_RAIL_WIDTH = 520;

export function maxFileRailWidth(viewportWidth) {
  const compact = viewportWidth <= 1300;
  const documentWidth = compact ? 590 : 620;
  const threadRailWidth = compact ? 300 : 330;
  return Math.max(
    MIN_FILE_RAIL_WIDTH,
    Math.min(MAX_FILE_RAIL_WIDTH, viewportWidth - documentWidth - threadRailWidth),
  );
}

export function clampFileRailWidth(width, viewportWidth) {
  const numericWidth = Number.isFinite(width) ? width : DEFAULT_FILE_RAIL_WIDTH;
  return Math.min(maxFileRailWidth(viewportWidth), Math.max(MIN_FILE_RAIL_WIDTH, numericWidth));
}
