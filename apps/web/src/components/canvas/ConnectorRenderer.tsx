'use client';

import React from 'react';
import {
  BoardElement,
  ConnectorElement,
  computeOrthogonalPath,
  getAnchorPosition,
  getClosestAnchors,
  pointsToSvgPath,
  BoundingBox,
  Point,
} from '@whiteboard/shared';

interface ConnectorRendererProps {
  connector: ConnectorElement;
  elementsMap: Map<string, BoardElement>;
  isSelected?: boolean;
  onSelect?: (id: string, e: React.MouseEvent) => void;
}

export const ConnectorRenderer = React.memo(function ConnectorRenderer({
  connector,
  elementsMap,
  isSelected = false,
  onSelect,
}: ConnectorRendererProps) {
  const fromEl = elementsMap.get(connector.fromId);
  const toEl = elementsMap.get(connector.toId);

  // Si l'un des deux éléments reliés n'existe plus, ne pas rendre
  if (!fromEl || !toEl) {
    return null;
  }

  const fromBox: BoundingBox = {
    x: fromEl.x,
    y: fromEl.y,
    width: Math.max(20, fromEl.width),
    height: Math.max(20, fromEl.height),
  };

  const toBox: BoundingBox = {
    x: toEl.x,
    y: toEl.y,
    width: Math.max(20, toEl.width),
    height: Math.max(20, toEl.height),
  };

  // Calculer les ancres optimales si non spécifiées
  const closest = getClosestAnchors(fromBox, toBox);
  const fromAnchor = connector.fromAnchor || closest.fromAnchor;
  const toAnchor = connector.toAnchor || closest.toAnchor;

  const startPoint = getAnchorPosition(fromBox, fromAnchor);
  const endPoint = getAnchorPosition(toBox, toAnchor);

  // Calcul du tracé orthogonal avec repli sur ligne directe
  let pathPoints: Point[];
  if (connector.routing === 'straight') {
    pathPoints = [startPoint, endPoint];
  } else {
    pathPoints = computeOrthogonalPath(startPoint, endPoint, fromAnchor, toAnchor);
  }

  const pathD = pointsToSvgPath(pathPoints, connector.routing === 'curved');

  // Point médian pour le label
  const midPoint =
    pathPoints.length >= 2
      ? {
          x: (pathPoints[0].x + pathPoints[pathPoints.length - 1].x) / 2,
          y: (pathPoints[0].y + pathPoints[pathPoints.length - 1].y) / 2,
        }
      : startPoint;

  const strokeColor = isSelected ? '#3b82f6' : connector.style.stroke || '#64748b';
  const strokeWidth = isSelected ? (connector.style.strokeWidth || 2) + 1 : connector.style.strokeWidth || 2;
  const strokeDash = connector.style.strokeStyle === 'dashed' ? '6,6' : undefined;

  return (
    <g
      className="cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(connector.id, e);
      }}
    >
      {/* Zone transparente élargie pour faciliter le clic */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="pointer-events-auto"
      />

      {/* Tracé visible */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        markerEnd={connector.endEnd === 'arrow' ? `url(#arrow-end-${connector.id})` : undefined}
        markerStart={connector.startEnd === 'arrow' ? `url(#arrow-start-${connector.id})` : undefined}
        className="transition-colors pointer-events-none group-hover:stroke-blue-500"
      />

      {/* Définitions des marqueurs de flèches */}
      <defs>
        <marker
          id={`arrow-end-${connector.id}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill={strokeColor} />
        </marker>
        <marker
          id={`arrow-start-${connector.id}`}
          viewBox="0 0 10 10"
          refX="2"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 10 1 L 0 5 L 10 9 z" fill={strokeColor} />
        </marker>
      </defs>

      {/* Libellé éditable centré sur le connecteur */}
      {connector.label && (
        <g transform={`translate(${midPoint.x}, ${midPoint.y})`} className="pointer-events-none">
          <rect
            x={-((connector.label.length * 7 + 16) / 2)}
            y="-12"
            width={connector.label.length * 7 + 16}
            height="24"
            rx="4"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="1"
            className="shadow-sm"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontSize="12"
            fill="#334155"
            fontWeight="500"
            className="select-none"
          >
            {connector.label}
          </text>
        </g>
      )}
    </g>
  );
});
