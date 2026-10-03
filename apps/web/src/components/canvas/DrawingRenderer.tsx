'use client';

import React from 'react';
import getStroke from 'perfect-freehand';
import { DrawingElement } from '@whiteboard/shared';

interface DrawingRendererProps {
  drawing: DrawingElement;
  isSelected?: boolean;
  onSelect?: (id: string, e: React.MouseEvent) => void;
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q'] as (string | number)[]
  );

  d.push('Z');
  return d.join(' ');
}

export const DrawingRenderer = React.memo(function DrawingRenderer({
  drawing,
  isSelected = false,
  onSelect,
}: DrawingRendererProps) {
  const points = drawing.points.map((p) => [p.x, p.y]);
  const stroke = getStroke(points, {
    size: (drawing.style.strokeWidth || 3) * 2,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });

  const pathData = getSvgPathFromStroke(stroke);

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(drawing.id, e);
      }}
      className="cursor-pointer"
    >
      <path
        d={pathData}
        fill={isSelected ? '#3b82f6' : drawing.style.stroke || '#000000'}
        className="transition-colors hover:opacity-80"
      />
    </g>
  );
});
