import type { RouteInstruction } from "./routes";

export type Coord = [number, number];
const scale = (lat: number) => [111320 * Math.cos(lat * Math.PI / 180), 111320];

export function lengths(points: Coord[]) {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = scale((points[i][1] + points[i - 1][1]) / 2);
    out.push(out[i - 1] + Math.hypot((points[i][0] - points[i - 1][0]) * x, (points[i][1] - points[i - 1][1]) * y));
  }
  return out;
}

export function positionAt(points: Coord[], distances: number[], progress: number): Coord {
  if (points.length < 2) return points[0];
  const target = Math.max(0, Math.min(progress, distances.at(-1) ?? 0));
  let i = 1;
  while (i < distances.length - 1 && distances[i] < target) i++;
  const t = (target - distances[i - 1]) / (distances[i] - distances[i - 1] || 1);
  return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
}

export function project(points: Coord[], distances: number[], position: Coord, previous: number) {
  const [sx, sy] = scale(position[1]);
  let best = { distance: Infinity, progress: 0 };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = (b[0] - a[0]) * sx, dy = (b[1] - a[1]) * sy;
    const t = Math.max(0, Math.min(1, ((position[0] - a[0]) * sx * dx + (position[1] - a[1]) * sy * dy) / (dx * dx + dy * dy || 1)));
    const distance = Math.hypot((position[0] - a[0]) * sx - t * dx, (position[1] - a[1]) * sy - t * dy);
    const progress = distances[i - 1] + t * (distances[i] - distances[i - 1]);
    // Prefer the nearby part of the route at intersections and loop endpoints.
    if (distance + Math.abs(progress - previous) * 0.04 < best.distance + Math.abs(best.progress - previous) * 0.04) best = { distance, progress };
  }
  return best;
}

export function instructionAt(instructions: RouteInstruction[], distances: number[], progress: number) {
  const next = instructions.find((step) => step.sign !== 5 && step.interval && (distances[step.interval[1]] ?? Infinity) > progress + 5);
  return next ?? instructions.at(-1);
}
