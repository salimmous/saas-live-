import { describe, it, expect } from 'vitest';
import {
  getWorldViewportBounds,
  isIntersecting,
  getVisibleElements,
  BoundingBox,
  BoardElement,
} from '@whiteboard/shared';

describe('Culling spatial & Optimisation Viewport', () => {
  it('calcule correctement les bornes mondes visibles avec le zoom', () => {
    const transform = { x: 100, y: 50, zoom: 2 };
    const screen = { width: 1000, height: 600 };
    const bounds = getWorldViewportBounds(transform, screen, 0);

    expect(bounds.x).toBe(-50);
    expect(bounds.y).toBe(-25);
    expect(bounds.width).toBe(500);
    expect(bounds.height).toBe(300);
  });

  it('détecte correctement l’intersection entre deux boîtes englobantes', () => {
    const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const boxB: BoundingBox = { x: 50, y: 50, width: 100, height: 100 };
    const boxC: BoundingBox = { x: 200, y: 200, width: 50, height: 50 };

    expect(isIntersecting(boxA, boxB)).toBe(true);
    expect(isIntersecting(boxA, boxC)).toBe(false);
  });

  it('filtre les éléments hors écran pour ne conserver que les visibles', () => {
    const viewportBounds: BoundingBox = { x: 0, y: 0, width: 500, height: 500 };

    const el1: BoardElement = {
      id: 'el-1',
      type: 'sticky',
      x: 100,
      y: 100,
      width: 150,
      height: 100,
      zIndex: 1,
      content: 'Visible',
      style: { color: '#fef08a' },
      meta: { createdAt: 1, updatedAt: 1 },
    };

    const el2: BoardElement = {
      id: 'el-2',
      type: 'sticky',
      x: 1500,
      y: 1500,
      width: 150,
      height: 100,
      zIndex: 1,
      content: 'Invisible',
      style: { color: '#fef08a' },
      meta: { createdAt: 1, updatedAt: 1 },
    };

    const visible = getVisibleElements([el1, el2], viewportBounds);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('el-1');
  });
});
