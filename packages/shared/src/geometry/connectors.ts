import { ConnectorAnchor, Point } from '../types/board.js';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calcule les coordonnées de l'ancre sur la boîte englobante d'un élément.
 */
export function getAnchorPosition(box: BoundingBox, anchor: ConnectorAnchor = 'center'): Point {
  const { x, y, width, height } = box;
  switch (anchor) {
    case 'top':
      return { x: x + width / 2, y };
    case 'bottom':
      return { x: x + width / 2, y: y + height };
    case 'left':
      return { x, y: y + height / 2 };
    case 'right':
      return { x: x + width, y: y + height / 2 };
    case 'center':
    default:
      return { x: x + width / 2, y: y + height / 2 };
  }
}

/**
 * Détermine l'ancre la plus proche entre deux boîtes pour un tracé naturel.
 */
export function getClosestAnchors(
  fromBox: BoundingBox,
  toBox: BoundingBox
): { fromAnchor: ConnectorAnchor; toAnchor: ConnectorAnchor } {
  const fromCenter = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
  const toCenter = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) {
      return { fromAnchor: 'right', toAnchor: 'left' };
    } else {
      return { fromAnchor: 'left', toAnchor: 'right' };
    }
  } else {
    if (dy > 0) {
      return { fromAnchor: 'bottom', toAnchor: 'top' };
    } else {
      return { fromAnchor: 'top', toAnchor: 'bottom' };
    }
  }
}

/**
 * Calcule le chemin orthogonal simple évitant les collisions de base.
 * Retourne une liste de points (waypoints) garantissant un routage horizontal/vertical.
 */
export function computeOrthogonalPath(
  start: Point,
  end: Point,
  fromAnchor: ConnectorAnchor = 'center',
  toAnchor: ConnectorAnchor = 'center'
): Point[] {
  // Si les points sont identiques, ligne directe
  if (start.x === end.x && start.y === end.y) {
    return [start, end];
  }

  const offset = 20;
  const points: Point[] = [start];

  // Point de dégagement initial selon l'ancre
  let p1: Point = { ...start };
  if (fromAnchor === 'top') p1.y -= offset;
  else if (fromAnchor === 'bottom') p1.y += offset;
  else if (fromAnchor === 'left') p1.x -= offset;
  else if (fromAnchor === 'right') p1.x += offset;

  // Point d'approche final selon l'ancre d'arrivée
  let p2: Point = { ...end };
  if (toAnchor === 'top') p2.y -= offset;
  else if (toAnchor === 'bottom') p2.y += offset;
  else if (toAnchor === 'left') p2.x -= offset;
  else if (toAnchor === 'right') p2.x += offset;

  if (fromAnchor !== 'center') points.push(p1);

  // Routage intermédiaire selon l'orientation
  if (fromAnchor === 'left' || fromAnchor === 'right' || toAnchor === 'left' || toAnchor === 'right') {
    const midX = (p1.x + p2.x) / 2;
    points.push({ x: midX, y: p1.y });
    points.push({ x: midX, y: p2.y });
  } else {
    const midY = (p1.y + p2.y) / 2;
    points.push({ x: p1.x, y: midY });
    points.push({ x: p2.x, y: midY });
  }

  if (toAnchor !== 'center') points.push(p2);
  points.push(end);

  // Nettoyage des points colinéaires redondants
  return simplifyPath(points);
}

/**
 * Supprime les points intermédiaires alignés pour un SVG propre.
 */
function simplifyPath(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts;
  const result: Point[] = [pts[0]];

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const isCollinearX = prev.x === curr.x && curr.x === next.x;
    const isCollinearY = prev.y === curr.y && curr.y === next.y;

    if (!isCollinearX && !isCollinearY) {
      result.push(curr);
    }
  }

  result.push(pts[pts.length - 1]);
  return result;
}

/**
 * Convertit une liste de waypoints en chaîne SVG path 'd'.
 */
export function pointsToSvgPath(points: Point[], curved = false): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  if (!curved) {
    return points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }

  // Version lissée (courbe de Bézier)
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    const cy = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${cx} ${cy}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x} ${last.y}`;
  return d;
}
