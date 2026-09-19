import type { ScreenPoint, Size } from './projection';

export interface EdgeIndicator {
  x: number;
  y: number;
  // Degrees, 0 = pointing up, clockwise.
  angle: number;
}

// Where to draw an arrow for a target that is off screen: on the border of the inset rectangle,
// on the line from the screen centre to the target. Returns null while the target is visible.
export function edgeIndicator(target: ScreenPoint, size: Size, inset: number): EdgeIndicator | null {
  const left = inset;
  const right = size.width - inset;
  const top = inset;
  const bottom = size.height - inset;
  if (target.x >= left && target.x <= right && target.y >= top && target.y <= bottom) return null;

  const cx = size.width / 2;
  const cy = size.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const scale = Math.min(
    dx === 0 ? Infinity : (dx > 0 ? right - cx : left - cx) / dx,
    dy === 0 ? Infinity : (dy > 0 ? bottom - cy : top - cy) / dy
  );
  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
    angle: (Math.atan2(dx, -dy) * 180) / Math.PI,
  };
}
