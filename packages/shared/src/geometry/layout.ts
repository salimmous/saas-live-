import dagre from 'dagre';
import { BoardElement, ConnectorElement } from '../types/board.js';

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeSep?: number;
  rankSep?: number;
  gridCols?: number;
  gridSpacingX?: number;
  gridSpacingY?: number;
  startX?: number;
  startY?: number;
}

export interface PositionedElementResult {
  id: string;
  x: number;
  y: number;
}

/**
 * Organise automatiquement les éléments de manière déterministe :
 * - Graph layout (dagre) pour les objets connectés
 * - Disposition en grille pour les objets non connectés
 */
export function computeAutoLayout(
  elements: BoardElement[],
  options: LayoutOptions = {}
): PositionedElementResult[] {
  const {
    direction = 'LR',
    nodeSep = 50,
    rankSep = 80,
    gridCols = 4,
    gridSpacingX = 40,
    gridSpacingY = 40,
    startX = 100,
    startY = 100,
  } = options;

  // Séparer les connecteurs des nœuds positionnables
  const connectors = elements.filter((el): el is ConnectorElement => el.type === 'connector');
  const nodes = elements.filter((el) => el.type !== 'connector');

  if (nodes.length === 0) return [];

  // Identifier les IDs connectés
  const connectedNodeIds = new Set<string>();
  for (const c of connectors) {
    connectedNodeIds.add(c.fromId);
    connectedNodeIds.add(c.toId);
  }

  const graphNodes = nodes.filter((n) => connectedNodeIds.has(n.id));
  const isolatedNodes = nodes.filter((n) => !connectedNodeIds.has(n.id));

  const results: PositionedElementResult[] = [];

  // 1. Layout de graphe pour les nœuds connectés
  let maxGraphX = startX;
  let maxGraphY = startY;

  if (graphNodes.length > 0) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: direction,
      nodesep: nodeSep,
      ranksep: rankSep,
      marginx: 0,
      marginy: 0,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of graphNodes) {
      g.setNode(node.id, {
        width: Math.max(80, node.width),
        height: Math.max(60, node.height),
      });
    }

    for (const c of connectors) {
      if (g.hasNode(c.fromId) && g.hasNode(c.toId)) {
        g.setEdge(c.fromId, c.toId);
      }
    }

    dagre.layout(g);

    g.nodes().forEach((nodeId) => {
      const nodeLayout = g.node(nodeId);
      if (nodeLayout) {
        const originalNode = graphNodes.find((n) => n.id === nodeId);
        const w = originalNode?.width ?? 120;
        const h = originalNode?.height ?? 80;

        // Dagre retourne le centre du nœud
        const posX = startX + (nodeLayout.x - w / 2);
        const posY = startY + (nodeLayout.y - h / 2);

        results.push({ id: nodeId, x: posX, y: posY });
        maxGraphX = Math.max(maxGraphX, posX + w);
        maxGraphY = Math.max(maxGraphY, posY + h);
      }
    });
  }

  // 2. Disposition en grille pour les objets isolés
  if (isolatedNodes.length > 0) {
    // Si des nœuds connectés existent, placer la grille sous le graphe
    const gridOriginX = startX;
    const gridOriginY = graphNodes.length > 0 ? maxGraphY + 100 : startY;

    // Calculer les largeurs et hauteurs max pour l'espacement régulier
    const cellWidth = Math.max(...isolatedNodes.map((n) => n.width), 160);
    const cellHeight = Math.max(...isolatedNodes.map((n) => n.height), 120);

    isolatedNodes.forEach((node, index) => {
      const col = index % gridCols;
      const row = Math.floor(index / gridCols);

      const posX = gridOriginX + col * (cellWidth + gridSpacingX);
      const posY = gridOriginY + row * (cellHeight + gridSpacingY);

      results.push({ id: node.id, x: posX, y: posY });
    });
  }

  return results;
}
