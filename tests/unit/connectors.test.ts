import { describe, it, expect } from 'vitest';
import {
  getAnchorPosition,
  getClosestAnchors,
  computeOrthogonalPath,
  pointsToSvgPath,
  BoundingBox,
} from '@whiteboard/shared';

describe('Connecteurs intelligents - Géométrie & Routage', () => {
  const boxA: BoundingBox = { x: 100, y: 100, width: 200, height: 100 };
  const boxB: BoundingBox = { x: 500, y: 100, width: 200, height: 100 };

  it('calcule correctement les positions des ancres', () => {
    expect(getAnchorPosition(boxA, 'top')).toEqual({ x: 200, y: 100 });
    expect(getAnchorPosition(boxA, 'bottom')).toEqual({ x: 200, y: 200 });
    expect(getAnchorPosition(boxA, 'left')).toEqual({ x: 100, y: 150 });
    expect(getAnchorPosition(boxA, 'right')).toEqual({ x: 300, y: 150 });
    expect(getAnchorPosition(boxA, 'center')).toEqual({ x: 200, y: 150 });
  });

  it('détermine les ancres les plus proches selon la disposition relative', () => {
    const anchors = getClosestAnchors(boxA, boxB);
    expect(anchors).toEqual({ fromAnchor: 'right', toAnchor: 'left' });

    const boxC: BoundingBox = { x: 100, y: 400, width: 200, height: 100 };
    const verticalAnchors = getClosestAnchors(boxA, boxC);
    expect(verticalAnchors).toEqual({ fromAnchor: 'bottom', toAnchor: 'top' });
  });

  it('génère un chemin orthogonal sans segments colinéaires superflus', () => {
    const start = { x: 300, y: 150 };
    const end = { x: 500, y: 150 };
    const path = computeOrthogonalPath(start, end, 'right', 'left');

    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(end);
  });

  it('convertit les points en instruction de tracé SVG valide', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    const svgPath = pointsToSvgPath(points);
    expect(svgPath).toBe('M 0 0 L 50 0 L 50 100');
  });
});
