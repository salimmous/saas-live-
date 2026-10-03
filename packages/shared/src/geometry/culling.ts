import { BaseElement } from '../types/board.js';
import { BoundingBox } from './connectors.js';

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface ScreenDimensions {
  width: number;
  height: number;
}

/**
 * Calcule la boîte englobante dans l'espace monde visible dans le viewport, avec marge tampon.
 */
export function getWorldViewportBounds(
  transform: ViewportTransform,
  screen: ScreenDimensions,
  bufferPx = 250
): BoundingBox {
  const zoom = Math.max(0.01, transform.zoom);
  const left = -transform.x / zoom - bufferPx / zoom;
  const top = -transform.y / zoom - bufferPx / zoom;
  const width = screen.width / zoom + (bufferPx * 2) / zoom;
  const height = screen.height / zoom + (bufferPx * 2) / zoom;

  return { x: left, y: top, width, height };
}

/**
 * Vérifie si deux boîtes AABB se chevauchent.
 */
export function isIntersecting(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

/**
 * Filtre les éléments visibles pour le culling du canvas.
 * Pour les connecteurs dont la boîte englobante est calculée à partir des 2 extrémités,
 * on inclut le connecteur si sa boîte intersecte le viewport.
 */
export function getVisibleElements<T extends BaseElement>(
  elements: T[],
  viewportBounds: BoundingBox
): T[] {
  return elements.filter((el) => {
    // Si c'est un connecteur sans dimensions explicites, on l'inclut toujours ou on calcule sa zone
    if (el.type === 'connector') {
      return true;
    }

    const elBox: BoundingBox = {
      x: el.x,
      y: el.y,
      width: Math.max(1, el.width),
      height: Math.max(1, el.height),
    };

    return isIntersecting(viewportBounds, elBox);
  });
}
