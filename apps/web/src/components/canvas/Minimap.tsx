'use client';

import React, { useRef } from 'react';
import { BoardElement, ViewportTransform, ScreenDimensions } from '@whiteboard/shared';

interface MinimapProps {
  elements: BoardElement[];
  viewport: ViewportTransform;
  screen: ScreenDimensions;
  onNavigate: (worldX: number, worldY: number) => void;
}

export const Minimap = React.memo(function Minimap({
  elements,
  viewport,
  screen,
  onNavigate,
}: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapWidth = 180;
  const minimapHeight = 120;

  if (elements.length === 0) return null;

  // Calculer l'enveloppe englobante de tous les éléments
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width || 100));
    maxY = Math.max(maxY, el.y + (el.height || 80));
  }

  // Marge minimale
  const padding = 200;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const totalWidth = Math.max(1000, maxX - minX);
  const totalHeight = Math.max(800, maxY - minY);

  const scale = Math.min(minimapWidth / totalWidth, minimapHeight / totalHeight);

  // Position du viewport actuel dans le repère de la minimap
  const viewWorldX = -viewport.x / viewport.zoom;
  const viewWorldY = -viewport.y / viewport.zoom;
  const viewWorldW = screen.width / viewport.zoom;
  const viewWorldH = screen.height / viewport.zoom;

  const viewMiniX = (viewWorldX - minX) * scale;
  const viewMiniY = (viewWorldY - minY) * scale;
  const viewMiniW = viewWorldW * scale;
  const viewMiniH = viewWorldH * scale;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convertir les coordonnées de la minimap en espace monde
    const targetWorldX = minX + clickX / scale;
    const targetWorldY = minY + clickY / scale;

    onNavigate(targetWorldX, targetWorldY);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ width: `${minimapWidth}px`, height: `${minimapHeight}px` }}
      className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-lg overflow-hidden cursor-crosshair select-none z-30 transition-all hover:bg-white"
    >
      <div className="relative w-full h-full bg-slate-50/50">
        {/* Miniature des éléments */}
        {elements.slice(0, 150).map((el) => {
          const miniX = (el.x - minX) * scale;
          const miniY = (el.y - minY) * scale;
          const miniW = Math.max(2, (el.width || 100) * scale);
          const miniH = Math.max(2, (el.height || 80) * scale);

          return (
            <div
              key={`mini-${el.id}`}
              style={{
                position: 'absolute',
                left: `${miniX}px`,
                top: `${miniY}px`,
                width: `${miniW}px`,
                height: `${miniH}px`,
                backgroundColor: el.type === 'frame' ? '#cbd5e1' : '#94a3b8',
                borderRadius: '1px',
              }}
            />
          );
        })}

        {/* Rectangle du viewport actif */}
        <div
          style={{
            position: 'absolute',
            left: `${viewMiniX}px`,
            top: `${viewMiniY}px`,
            width: `${Math.max(10, viewMiniW)}px`,
            height: `${Math.max(8, viewMiniH)}px`,
            border: '1.5px solid #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '2px',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
});
