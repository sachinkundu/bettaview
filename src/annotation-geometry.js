export const annotationSvgAttributes = 'stroke="#e34b31" stroke-width="9" fill="none" vector-effect="non-scaling-stroke"';

export function startDrawing(kind, point) {
  return {
    kind,
    ...(kind === "circle" ? { mode: "center-radius" } : {}),
    x1: point.x,
    y1: point.y,
    x2: point.x,
    y2: point.y,
  };
}

export function circleSvgGeometry(shape, viewport, viewBoxSize = 1000) {
  const width = viewport.width || 1;
  const height = viewport.height || 1;
  const radius = Math.hypot(
    (shape.x2 - shape.x1) * width,
    (shape.y2 - shape.y1) * height,
  );

  return {
    cx: shape.x1 * viewBoxSize,
    cy: shape.y1 * viewBoxSize,
    rx: (radius / width) * viewBoxSize,
    ry: (radius / height) * viewBoxSize,
  };
}
