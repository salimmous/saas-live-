'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import {
  BoardElement,
  ConnectorElement,
  DrawingElement,
  Point,
  ViewportTransform,
  getWorldViewportBounds,
  getVisibleElements,
  BoundingBox,
} from '@whiteboard/shared';
import { ElementRenderer } from './ElementRenderer';
import { ConnectorRenderer } from './ConnectorRenderer';
import { DrawingRenderer } from './DrawingRenderer';
import { RemoteCursors } from './RemoteCursors';
import { Minimap } from './Minimap';
import { Toolbar, CanvasTool } from './Toolbar';
import { TopNav } from './TopNav';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
import { ShareModal } from './ShareModal';
import { SyncState } from '@/hooks/useBoardSync';
import { toPng } from 'html-to-image';
import { AiPanel } from '../panels/AiPanel';
import { VoteModal } from '../panels/VoteModal';
import { BrainstormModal } from '../panels/BrainstormModal';
import { PresentationOverlay } from '../panels/PresentationOverlay';
import { LinkPreviewModal } from './LinkPreviewModal';
import { computeAutoLayout } from '@whiteboard/shared';

interface CanvasProps {
  boardId: string;
  boardTitle: string;
  onUpdateTitle: (title: string) => void;
  elements: Map<string, BoardElement>;
  presenceUsers: any[];
  syncState: SyncState;
  onRetrySync: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddElement: (el: BoardElement) => void;
  onUpdateElement: (id: string, patch: Partial<BoardElement>) => void;
  onDeleteElements: (ids: string[]) => void;
  onBatchOperations?: (ops: any[]) => void;
  onBroadcastCursor: (cursor: Point | null, selectedIds: string[]) => void;
  currentUser: { id: string; name: string; email?: string; role?: string };
  isReadOnly?: boolean;
  onToggleAiPanel?: () => void;
  onOpenVoteModal?: () => void;
  onOpenBrainstormModal?: () => void;
  onStartPresentation?: () => void;
}

export function Canvas({
  boardId,
  boardTitle,
  onUpdateTitle,
  elements,
  presenceUsers,
  syncState,
  onRetrySync,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddElement,
  onUpdateElement,
  onDeleteElements,
  onBatchOperations,
  onBroadcastCursor,
  currentUser,
  isReadOnly = false,
  onToggleAiPanel,
  onOpenVoteModal,
  onOpenBrainstormModal,
  onStartPresentation,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // État du viewport
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, zoom: 1 });
  const [screen, setScreen] = useState({ width: 1920, height: 1080 });

  // Outils et sélection
  const [currentTool, setCurrentTool] = useState<CanvasTool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<BoardElement[]>([]);

  // Modales & Ateliers
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showBrainstormModal, setShowBrainstormModal] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isPrototypeMode, setIsPrototypeMode] = useState(false);
  const [activeVoteSession, setActiveVoteSession] = useState<any>(null);
  const [isVotingActive, setIsVotingActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // États d'interaction
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Tracé stylet en cours
  const [currentDrawingPoints, setCurrentDrawingPoints] = useState<Point[] | null>(null);

  // Connecteur en cours de création
  const [connectorStartId, setConnectorStartId] = useState<string | null>(null);

  // Boîte de sélection multiple par rectangle
  const [selectionBox, setSelectionBox] = useState<BoundingBox | null>(null);

  // Déplacement d'éléments
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [initialElementsPos, setInitialElementsPos] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Redimensionnement
  const [resizingInfo, setResizingInfo] = useState<{
    id: string;
    handle: string;
    initialBox: BoundingBox;
    startPoint: Point;
  } | null>(null);

  // Mettre à jour les dimensions d'écran au redimensionnement
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setScreen({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Conversion Coordonnées Écran <-> Espace Monde
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      return {
        x: (screenX - viewport.x) / viewport.zoom,
        y: (screenY - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Liste de tous les éléments
  const elementsArray = useMemo(() => Array.from(elements.values()), [elements]);

  // Culling spatial pour les performances à 500+ objets (Règle Section 8)
  const visibleElements = useMemo(() => {
    // Si moins de 80 objets, rendu direct sans culling
    if (elementsArray.length < 80) return elementsArray;
    const bounds = getWorldViewportBounds(viewport, screen, 300);
    return getVisibleElements(elementsArray, bounds);
  }, [elementsArray, viewport, screen]);

  // Séparer les connecteurs et dessins (SVG) des éléments DOM
  const svgConnectors = useMemo(
    () => elementsArray.filter((el): el is ConnectorElement => el.type === 'connector'),
    [elementsArray]
  );

  const svgDrawings = useMemo(
    () => elementsArray.filter((el): el is DrawingElement => el.type === 'drawing'),
    [elementsArray]
  );

  // Centrage / Ajuster au contenu
  const handleFitToContent = useCallback(() => {
    if (elementsArray.length === 0) {
      setViewport({ x: screen.width / 2 - 400, y: screen.height / 2 - 300, zoom: 1 });
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of elementsArray) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 100));
      maxY = Math.max(maxY, el.y + (el.height || 80));
    }

    const padding = 100;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;

    const scaleX = screen.width / contentW;
    const scaleY = screen.height / contentH;
    const zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setViewport({
      x: screen.width / 2 - centerX * zoom,
      y: screen.height / 2 - centerY * zoom,
      zoom,
    });
  }, [elementsArray, screen]);

  // Organisation automatique déterministe (Feature 2)
  const handleAutoLayout = useCallback(() => {
    if (isReadOnly || elementsArray.length === 0) return;

    const targetElements =
      selectedIds.length > 1
        ? elementsArray.filter((e) => selectedIds.includes(e.id))
        : elementsArray;

    const positions = computeAutoLayout(targetElements, {
      startX: targetElements[0]?.x || 100,
      startY: targetElements[0]?.y || 100,
    });

    if (onBatchOperations) {
      const ops = positions.map((p) => ({
        kind: 'update' as const,
        elementId: p.id,
        patch: { x: p.x, y: p.y },
      }));
      onBatchOperations(ops);
    } else {
      positions.forEach((p) => onUpdateElement(p.id, { x: p.x, y: p.y }));
    }
  }, [isReadOnly, elementsArray, selectedIds, onBatchOperations, onUpdateElement]);

  // Zoom avec centrage sur le curseur
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.08), 4.0);

      const rect = containerRef.current?.getBoundingClientRect();
      const mouseX = e.clientX - (rect?.left || 0);
      const mouseY = e.clientY - (rect?.top || 0);

      const worldX = (mouseX - viewport.x) / viewport.zoom;
      const worldY = (mouseY - viewport.y) / viewport.zoom;

      setViewport({
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom,
        zoom: newZoom,
      });
    } else {
      // Pan par trackpad / molette
      setViewport((prev) => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si l'utilisateur est en train d'écrire dans un champ de texte, ne pas intercepter
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'textarea' || activeTag === 'input') {
        return;
      }

      if (e.key === ' ') {
        setIsSpacePressed(true);
      } else if (e.key === '?') {
        setShowHelpModal(true);
      } else if (e.key === 'v' || e.key === 'V') {
        setCurrentTool('select');
      } else if (e.key === 's' || e.key === 'S') {
        setCurrentTool('sticky');
      } else if (e.key === 't' || e.key === 'T') {
        setCurrentTool('text');
      } else if (e.key === 'r' || e.key === 'R') {
        setCurrentTool('shape-rectangle');
      } else if (e.key === 'd' || e.key === 'D') {
        setCurrentTool('pen');
      } else if (e.key === 'c' || e.key === 'C') {
        setCurrentTool('connector');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0 && !isReadOnly) {
          onDeleteElements(selectedIds);
          setSelectedIds([]);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        onRedo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        // Dupliquer la sélection
        if (selectedIds.length > 0 && !isReadOnly) {
          const newIds: string[] = [];
          selectedIds.forEach((id) => {
            const original = elements.get(id);
            if (original) {
              const dupId = nanoid();
              newIds.push(dupId);
              onAddElement({
                ...original,
                id: dupId,
                x: original.x + 30,
                y: original.y + 30,
                meta: { createdAt: Date.now(), updatedAt: Date.now() },
              });
            }
          });
          setSelectedIds(newIds);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        // Copier
        const toCopy = selectedIds.map((id) => elements.get(id)).filter(Boolean) as BoardElement[];
        setClipboard(toCopy);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        // Coller
        if (clipboard.length > 0 && !isReadOnly) {
          const newIds: string[] = [];
          clipboard.forEach((original) => {
            const newId = nanoid();
            newIds.push(newId);
            onAddElement({
              ...original,
              id: newId,
              x: original.x + 40,
              y: original.y + 40,
              meta: { createdAt: Date.now(), updatedAt: Date.now() },
            });
          });
          setSelectedIds(newIds);
        }
      } else if (e.key === 'Tab') {
        // Tab : ajouter un nœud enfant (Feature 11)
        if (selectedIds.length === 1 && !isReadOnly) {
          const selectedEl = elements.get(selectedIds[0]);
          if (selectedEl?.type === 'mindmap-node') {
            e.preventDefault();
            const childId = nanoid();
            const connId = nanoid();
            onAddElement({
              id: childId,
              type: 'mindmap-node',
              parentId: selectedEl.id,
              order: 1,
              content: 'Sous-idée',
              x: selectedEl.x + 220,
              y: selectedEl.y + 30,
              width: 160,
              height: 48,
              zIndex: (selectedEl.zIndex || 1) + 1,
              style: { fill: '#ffffff', stroke: '#3b82f6', color: '#1e293b' },
              meta: { createdAt: Date.now(), updatedAt: Date.now() },
            });
            onAddElement({
              id: connId,
              type: 'connector',
              fromId: selectedEl.id,
              toId: childId,
              fromAnchor: 'right',
              toAnchor: 'left',
              startEnd: 'none',
              endEnd: 'arrow',
              routing: 'orthogonal',
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              zIndex: 1000,
              style: { stroke: '#94a3b8', strokeWidth: 2, strokeStyle: 'solid' },
              meta: { createdAt: Date.now(), updatedAt: Date.now() },
            });
            setSelectedIds([childId]);
          }
        }
      } else if (e.key === 'Enter') {
        // Entrée : ajouter un nœud frère (Feature 11)
        if (selectedIds.length === 1 && !isReadOnly) {
          const selectedEl = elements.get(selectedIds[0]);
          if (selectedEl?.type === 'mindmap-node') {
            e.preventDefault();
            const siblingId = nanoid();
            const connId = nanoid();
            onAddElement({
              id: siblingId,
              type: 'mindmap-node',
              parentId: selectedEl.parentId,
              order: 2,
              content: 'Idée sœur',
              x: selectedEl.x,
              y: selectedEl.y + 65,
              width: 160,
              height: 48,
              zIndex: (selectedEl.zIndex || 1) + 1,
              style: { fill: '#ffffff', stroke: '#3b82f6', color: '#1e293b' },
              meta: { createdAt: Date.now(), updatedAt: Date.now() },
            });
            if (selectedEl.parentId) {
              onAddElement({
                id: connId,
                type: 'connector',
                fromId: selectedEl.parentId,
                toId: siblingId,
                fromAnchor: 'right',
                toAnchor: 'left',
                startEnd: 'none',
                endEnd: 'arrow',
                routing: 'orthogonal',
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                zIndex: 1000,
                style: { stroke: '#94a3b8', strokeWidth: 2, strokeStyle: 'solid' },
                meta: { createdAt: Date.now(), updatedAt: Date.now() },
              });
            }
            setSelectedIds([siblingId]);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selectedIds,
    isReadOnly,
    elements,
    clipboard,
    onDeleteElements,
    onAddElement,
    onUndo,
    onRedo,
  ]);

  // Démarrage du clic sur le fond du canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    // Si clic avec molette ou barre espace appuyée -> Pan
    if (e.button === 1 || isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    if (e.button !== 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = e.clientX - (rect?.left || 0);
    const mouseY = e.clientY - (rect?.top || 0);
    const worldPoint = screenToWorld(mouseX, mouseY);

    // 1. Outil Stylet (dessin libre)
    if (currentTool === 'pen') {
      setCurrentDrawingPoints([worldPoint]);
      return;
    }

    // 2. Outils de création directe par clic
    if (currentTool === 'sticky' && !isReadOnly) {
      const newId = nanoid();
      onAddElement({
        id: newId,
        type: 'sticky',
        x: Math.round(worldPoint.x - 100),
        y: Math.round(worldPoint.y - 70),
        width: 200,
        height: 140,
        zIndex: elementsArray.length + 1,
        content: '',
        style: { color: '#fef08a', fontSize: 14, textAlign: 'left' },
        meta: { createdAt: Date.now(), updatedAt: Date.now() },
      });
      setSelectedIds([newId]);
      setCurrentTool('select');
      return;
    }

    if (currentTool === 'text' && !isReadOnly) {
      const newId = nanoid();
      onAddElement({
        id: newId,
        type: 'text',
        x: Math.round(worldPoint.x),
        y: Math.round(worldPoint.y),
        width: 180,
        height: 50,
        zIndex: elementsArray.length + 1,
        content: '',
        style: { fontSize: 20, color: '#1e293b', textAlign: 'left' },
        meta: { createdAt: Date.now(), updatedAt: Date.now() },
      });
      setSelectedIds([newId]);
      setCurrentTool('select');
      return;
    }

    if (currentTool.startsWith('shape-') && !isReadOnly) {
      const shapeType = currentTool.replace('shape-', '') as any;
      const newId = nanoid();
      onAddElement({
        id: newId,
        type: 'shape',
        shapeType,
        x: Math.round(worldPoint.x - 70),
        y: Math.round(worldPoint.y - 70),
        width: 140,
        height: 140,
        zIndex: elementsArray.length + 1,
        content: '',
        style: { fill: '#f1f5f9', stroke: '#475569', strokeWidth: 2, strokeStyle: 'solid' },
        meta: { createdAt: Date.now(), updatedAt: Date.now() },
      });
      setSelectedIds([newId]);
      setCurrentTool('select');
      return;
    }

    if (currentTool === 'frame' && !isReadOnly) {
      const newId = nanoid();
      onAddElement({
        id: newId,
        type: 'frame',
        title: `Cadre ${elementsArray.filter((e) => e.type === 'frame').length + 1}`,
        x: Math.round(worldPoint.x - 250),
        y: Math.round(worldPoint.y - 180),
        width: 500,
        height: 360,
        zIndex: 0,
        style: { border: '2px dashed #94a3b8', background: 'rgba(241, 245, 249, 0.4)' },
        meta: { createdAt: Date.now(), updatedAt: Date.now() },
      });
      setSelectedIds([newId]);
      setCurrentTool('select');
      return;
    }

    if (currentTool === 'mindmap' && !isReadOnly) {
      const newId = nanoid();
      onAddElement({
        id: newId,
        type: 'mindmap-node',
        order: 0,
        x: Math.round(worldPoint.x - 80),
        y: Math.round(worldPoint.y - 25),
        width: 160,
        height: 50,
        zIndex: elementsArray.length + 1,
        content: 'Idée centrale',
        style: { color: '#ffffff', fill: '#3b82f6', stroke: '#2563eb' },
        meta: { createdAt: Date.now(), updatedAt: Date.now() },
      });
      setSelectedIds([newId]);
      setCurrentTool('select');
      return;
    }

    if (currentTool === 'hotspot' && !isReadOnly) {
      const frames = elementsArray.filter((el) => el.type === 'frame');
      const targetFrame = frames[0];
      const newId = nanoid();
      onAddElement({
        id: newId,
        type: 'hotspot',
        x: Math.round(worldPoint.x - 70),
        y: Math.round(worldPoint.y - 25),
        width: 140,
        height: 50,
        rotation: 0,
        zIndex: elementsArray.length + 1,
        targetFrameId: targetFrame ? targetFrame.id : '',
        label: targetFrame ? `→ ${(targetFrame as any).title}` : 'Lien vers cadre',
        meta: { createdAt: Date.now(), updatedAt: Date.now() },
      });
      setSelectedIds([newId]);
      setCurrentTool('select');
      return;
    }

    // 3. Clic dans le vide avec outil 'select' -> Démarre rectangle de sélection ou vide sélection
    if (!e.shiftKey) {
      setSelectedIds([]);
    }
    setSelectionBox({
      x: worldPoint.x,
      y: worldPoint.y,
      width: 0,
      height: 0,
    });
  };

  // Déplacement souris (Pan, Tracé, Rectangle de sélection, Déplacement d'objets, Diffusion du curseur)
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = e.clientX - (rect?.left || 0);
    const mouseY = e.clientY - (rect?.top || 0);
    const worldPoint = screenToWorld(mouseX, mouseY);

    // Diffuser la position du curseur aux collaborateurs (throttlé à 20fps)
    onBroadcastCursor(worldPoint, selectedIds);

    // Pan en cours
    if (isPanning) {
      setViewport((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }

    // Tracé de dessin en cours
    if (currentDrawingPoints) {
      setCurrentDrawingPoints((prev) => (prev ? [...prev, worldPoint] : [worldPoint]));
      return;
    }

    // Rectangle de sélection en cours
    if (selectionBox) {
      const width = worldPoint.x - selectionBox.x;
      const height = worldPoint.y - selectionBox.y;

      const normX = width >= 0 ? selectionBox.x : worldPoint.x;
      const normY = height >= 0 ? selectionBox.y : worldPoint.y;
      const normW = Math.abs(width);
      const normH = Math.abs(height);

      const box: BoundingBox = { x: normX, y: normY, width: normW, height: normH };

      // Sélectionner tous les objets intersectés
      const hitIds = elementsArray
        .filter((el) => {
          return (
            el.x < box.x + box.width &&
            el.x + el.width > box.x &&
            el.y < box.y + box.height &&
            el.y + el.height > box.y
          );
        })
        .map((el) => el.id);

      setSelectedIds(hitIds);
      return;
    }

    // Déplacement d'éléments en cours
    if (isDragging && !isReadOnly) {
      const dx = worldPoint.x - dragStartPoint.x;
      const dy = worldPoint.y - dragStartPoint.y;

      selectedIds.forEach((id) => {
        const initial = initialElementsPos.get(id);
        if (initial) {
          onUpdateElement(id, {
            x: Math.round(initial.x + dx),
            y: Math.round(initial.y + dy),
          });
        }
      });
      return;
    }

    // Redimensionnement en cours
    if (resizingInfo && !isReadOnly) {
      const { id, handle, initialBox, startPoint } = resizingInfo;
      const dx = worldPoint.x - startPoint.x;
      const dy = worldPoint.y - startPoint.y;

      let newX = initialBox.x;
      let newY = initialBox.y;
      let newW = initialBox.width;
      let newH = initialBox.height;

      if (handle.includes('e')) newW = Math.max(40, initialBox.width + dx);
      if (handle.includes('s')) newH = Math.max(30, initialBox.height + dy);
      if (handle.includes('w')) {
        const maxDx = initialBox.width - 40;
        const clampedDx = Math.min(dx, maxDx);
        newX = initialBox.x + clampedDx;
        newW = initialBox.width - clampedDx;
      }
      if (handle.includes('n')) {
        const maxDy = initialBox.height - 30;
        const clampedDy = Math.min(dy, maxDy);
        newY = initialBox.y + clampedDy;
        newH = initialBox.height - clampedDy;
      }

      onUpdateElement(id, {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    }
  };

  // Fin de clic souris
  const handleMouseUp = () => {
    setIsPanning(false);

    // Finaliser le dessin libre
    if (currentDrawingPoints && currentDrawingPoints.length > 1 && !isReadOnly) {
      const newId = nanoid();
      onAddElement({
        id: newId,
        type: 'drawing',
        points: currentDrawingPoints,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        zIndex: elementsArray.length + 1,
        style: { stroke: '#0f172a', strokeWidth: 3 },
        meta: { createdAt: Date.now(), updatedAt: Date.now() },
      });
      setCurrentDrawingPoints(null);
      setCurrentTool('select');
    } else {
      setCurrentDrawingPoints(null);
    }

    setSelectionBox(null);
    setIsDragging(false);
    setResizingInfo(null);
  };

  // Sélection d'un élément
  const handleSelectElement = (id: string, e: React.MouseEvent) => {
    // Si l'outil connecteur est actif, relier le point de départ au point d'arrivée
    if (currentTool === 'connector' && !isReadOnly) {
      if (!connectorStartId) {
        setConnectorStartId(id);
      } else if (connectorStartId !== id) {
        const connId = nanoid();
        onAddElement({
          id: connId,
          type: 'connector',
          fromId: connectorStartId,
          toId: id,
          fromAnchor: 'right',
          toAnchor: 'left',
          startEnd: 'none',
          endEnd: 'arrow',
          routing: 'orthogonal',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          zIndex: 1000,
          style: { stroke: '#64748b', strokeWidth: 2, strokeStyle: 'solid' },
          meta: { createdAt: Date.now(), updatedAt: Date.now() },
        });
        setConnectorStartId(null);
        setCurrentTool('select');
      }
      return;
    }

    // Si session de vote active : voter ou retirer le vote par clic
    if (isVotingActive && activeVoteSession) {
      handleVoteClick(id);
      return;
    }

    // Si mode prototype actif : naviguer si l'élément cliqué est un hotspot
    if (isPrototypeMode) {
      const el = elements.get(id);
      if (el?.type === 'hotspot' && (el as any).targetFrameId) {
        handleNavigateToFrame((el as any).targetFrameId);
        return;
      }
    }

    // Gestion de la sélection simple / multiple (Maj)
    let nextSelected: string[];
    if (e.shiftKey) {
      if (selectedIds.includes(id)) {
        nextSelected = selectedIds.filter((item) => item !== id);
      } else {
        nextSelected = [...selectedIds, id];
      }
    } else {
      nextSelected = selectedIds.includes(id) ? selectedIds : [id];
    }
    setSelectedIds(nextSelected);

    // Initialiser le déplacement de groupe
    if (!isReadOnly) {
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      const mouseX = e.clientX - (rect?.left || 0);
      const mouseY = e.clientY - (rect?.top || 0);
      setDragStartPoint(screenToWorld(mouseX, mouseY));

      const posMap = new Map<string, { x: number; y: number }>();
      nextSelected.forEach((selId) => {
        const el = elements.get(selId);
        if (el) posMap.set(selId, { x: el.x, y: el.y });
      });
      setInitialElementsPos(posMap);
    }
  };

  // Démarrage du redimensionnement
  const handleResizeStart = (id: string, handle: string, e: React.MouseEvent) => {
    const el = elements.get(id);
    if (!el || isReadOnly) return;

    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = e.clientX - (rect?.left || 0);
    const mouseY = e.clientY - (rect?.top || 0);

    setResizingInfo({
      id,
      handle,
      initialBox: { x: el.x, y: el.y, width: el.width, height: el.height },
      startPoint: screenToWorld(mouseX, mouseY),
    });
  };

  // Navigation vers un cadre (Hotspot / Présentation)
  const handleNavigateToFrame = (frameId: string) => {
    const frame = elements.get(frameId);
    if (frame) {
      const zoom = Math.min(screen.width / (frame.width + 100), screen.height / (frame.height + 100), 1.2);
      setViewport({
        x: screen.width / 2 - (frame.x + frame.width / 2) * zoom,
        y: screen.height / 2 - (frame.y + frame.height / 2) * zoom,
        zoom,
      });
    }
  };

  // Vote sur un élément (Feature 13)
  const handleVoteClick = async (elementId: string) => {
    if (!activeVoteSession) return;
    const isVoted = activeVoteSession.myVotes?.includes(elementId);
    const endpoint = isVoted ? 'uncast' : 'cast';

    try {
      const res = await fetch(`/api/boards/${boardId}/votes/${activeVoteSession.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erreur lors du vote.');
        return;
      }
      setActiveVoteSession((prev: any) => {
        if (!prev) return prev;
        const updatedMyVotes = isVoted
          ? (prev.myVotes || []).filter((item: string) => item !== elementId)
          : [...(prev.myVotes || []), elementId];
        return {
          ...prev,
          myVotes: updatedMyVotes,
          remainingVotes: data.remainingVotes,
        };
      });
    } catch (e: any) {
      alert(`Erreur: ${e.message}`);
    }
  };

  // Téléversement et insertion d'images / vidéos (Feature 16)
  const handleFileUpload = async (file: File, worldX?: number, worldY?: number) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('boardId', boardId);

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const posX = worldX ?? Math.round((screen.width / 2 - viewport.x) / viewport.zoom);
      const posY = worldY ?? Math.round((screen.height / 2 - viewport.y) / viewport.zoom);

      if (data.isVideo) {
        const newEl: BoardElement = {
          id: nanoid(),
          type: 'video',
          x: posX - 240,
          y: posY - 160,
          width: 480,
          height: 320,
          rotation: 0,
          zIndex: elementsArray.length + 1,
          url: data.url,
          videoType: 'upload',
          title: data.filename,
          meta: { createdAt: Date.now(), updatedAt: Date.now() },
        };
        onAddElement(newEl);
        setSelectedIds([newEl.id]);
      } else {
        const newEl: BoardElement = {
          id: nanoid(),
          type: 'image',
          x: posX - 180,
          y: posY - 130,
          width: 360,
          height: 260,
          rotation: 0,
          zIndex: elementsArray.length + 1,
          url: data.url,
          alt: data.filename,
          meta: { createdAt: Date.now(), updatedAt: Date.now() },
        };
        onAddElement(newEl);
        setSelectedIds([newEl.id]);
      }
    } catch (err: any) {
      alert(`Erreur téléversement média : ${err.message}`);
    }
  };

  // Glisser-déposer de fichiers multimédias
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const rect = containerRef.current?.getBoundingClientRect();
      const clientX = e.clientX - (rect?.left || 0);
      const clientY = e.clientY - (rect?.top || 0);
      const pt = screenToWorld(clientX, clientY);
      await handleFileUpload(file, pt.x, pt.y);
    }
  };

  // Collage direct d'images (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (isReadOnly) return;
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        const file = e.clipboardData.files[0];
        await handleFileUpload(file);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly, boardId, viewport, screen]);

  // Exportation du tableau en image PNG de haute qualité (Section 5)
  const handleExportPng = async () => {
    if (!worldRef.current) return;
    try {
      const dataUrl = await toPng(worldRef.current, {
        cacheBust: true,
        backgroundColor: '#f8fafc',
      });
      const link = document.createElement('a');
      link.download = `${boardTitle.toLowerCase().replace(/\s+/g, '_')}_export.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erreur export PNG:', err);
    }
  };

  const cursorClass = isSpacePressed || isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-default';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`relative w-screen h-screen overflow-hidden canvas-grid ${cursorClass}`}
    >
      {/* Barre de navigation supérieure */}
      <TopNav
        boardId={boardId}
        title={boardTitle}
        onUpdateTitle={onUpdateTitle}
        syncState={syncState}
        onRetrySync={onRetrySync}
        presenceUsers={presenceUsers}
        currentUser={currentUser}
        onOpenShareModal={() => setShowShareModal(true)}
        onExportPng={handleExportPng}
        onStartPresentation={onStartPresentation || (() => setShowPresentation(true))}
        onOpenVoteModal={onOpenVoteModal || (() => setShowVoteModal(true))}
        onOpenBrainstormModal={onOpenBrainstormModal || (() => setShowBrainstormModal(true))}
      />

      {/* Bannière Mode Vote Actif */}
      {isVotingActive && activeVoteSession && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-indigo-600/95 backdrop-blur-md text-white px-5 py-2 rounded-full shadow-lg border border-indigo-400/40 flex items-center gap-3 z-40 text-xs font-medium animate-in fade-in slide-in-from-top-4">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
          <span>
            Session : <strong>{activeVoteSession.title}</strong> — {activeVoteSession.remainingVotes} vote(s) restant(s)
          </span>
          <button
            onClick={() => setShowVoteModal(true)}
            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-full text-[11px] font-bold transition-colors ml-1"
          >
            Résultats
          </button>
        </div>
      )}

      {/* Bannière Mode Prototype Actif */}
      {isPrototypeMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-emerald-600/95 backdrop-blur-md text-white px-5 py-2 rounded-full shadow-lg border border-emerald-400/40 flex items-center gap-3 z-40 text-xs font-medium animate-in fade-in slide-in-from-top-4">
          <span>📱 <strong>Mode Prototype Actif</strong> — Cliquez sur les zones pour naviguer</span>
          <button
            onClick={() => setIsPrototypeMode(false)}
            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-full text-[11px] font-bold transition-colors ml-1"
          >
            Quitter
          </button>
        </div>
      )}

      {/* Couche Monde Unique transformée pour le Pan et Zoom */}
      <div
        ref={worldRef}
        className="canvas-world absolute inset-0 pointer-events-none"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
        }}
      >
        {/* Couche SVG : Connecteurs, Tracés libres, Marqueurs de curseur */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Dessins libres */}
          {svgDrawings.map((drawing) => (
            <DrawingRenderer
              key={drawing.id}
              drawing={drawing}
              isSelected={selectedIds.includes(drawing.id)}
              onSelect={handleSelectElement}
            />
          ))}

          {/* Connecteurs intelligents */}
          {svgConnectors.map((conn) => (
            <ConnectorRenderer
              key={conn.id}
              connector={conn}
              elementsMap={elements}
              isSelected={selectedIds.includes(conn.id)}
              onSelect={handleSelectElement}
            />
          ))}

          {/* Tracé de stylet en direct pendant le dessin */}
          {currentDrawingPoints && currentDrawingPoints.length > 1 && (
            <DrawingRenderer
              drawing={{
                id: 'preview-draw',
                type: 'drawing',
                points: currentDrawingPoints,
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                zIndex: 9999,
                style: { stroke: '#0f172a', strokeWidth: 3 },
                meta: { createdAt: Date.now(), updatedAt: Date.now() },
              }}
            />
          )}
        </svg>

        {/* Couche DOM Natif : Éléments interactifs culled */}
        <div className="absolute inset-0 pointer-events-auto">
          {visibleElements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              isSelected={selectedIds.includes(el.id)}
              isReadOnly={isReadOnly}
              onSelect={handleSelectElement}
              onUpdate={onUpdateElement}
              onResizeStart={handleResizeStart}
              onNavigateToFrame={handleNavigateToFrame}
            />
          ))}

          {/* Curseurs et sélections distantes en temps réel */}
          <RemoteCursors users={presenceUsers} elementsMap={elements} />
        </div>

        {/* Rectangle de sélection multiple (rubberband) */}
        {selectionBox && (
          <div
            className="selection-box absolute"
            style={{
              left: `${selectionBox.x}px`,
              top: `${selectionBox.y}px`,
              width: `${selectionBox.width}px`,
              height: `${selectionBox.height}px`,
            }}
          />
        )}
      </div>

      {/* Barre d'outils en bas */}
      <Toolbar
        currentTool={currentTool}
        onSelectTool={setCurrentTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        zoom={viewport.zoom}
        onZoomIn={() =>
          setViewport((prev) => ({
            ...prev,
            zoom: Math.min(prev.zoom * 1.2, 4.0),
          }))
        }
        onZoomOut={() =>
          setViewport((prev) => ({
            ...prev,
            zoom: Math.max(prev.zoom * 0.8, 0.08),
          }))
        }
        onZoomReset={() =>
          setViewport((prev) => ({
            ...prev,
            zoom: 1.0,
          }))
        }
        onFitToContent={handleFitToContent}
        onAutoLayout={handleAutoLayout}
        onOpenLinkModal={() => setShowLinkModal(true)}
        onTriggerFileUpload={() => fileInputRef.current?.click()}
        isPrototypeMode={isPrototypeMode}
        onTogglePrototypeMode={() => setIsPrototypeMode(!isPrototypeMode)}
        onToggleAiPanel={onToggleAiPanel || (() => setShowAiPanel(!showAiPanel))}
        onOpenHelp={() => setShowHelpModal(true)}
      />

      {/* Champ invisible pour le téléversement de fichier multimédia */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Panneau IA (Phase 2) */}
      <AiPanel
        isOpen={showAiPanel}
        onClose={() => setShowAiPanel(false)}
        boardId={boardId}
        elements={elementsArray}
        selectedIds={selectedIds}
        onApplyOperations={(ops) => {
          if (onBatchOperations) {
            onBatchOperations(ops);
          } else {
            ops.forEach((op) => {
              if (op.kind === 'create') onAddElement(op.element);
              else if (op.kind === 'update') onUpdateElement(op.elementId, op.patch);
              else if (op.kind === 'delete') onDeleteElements([op.elementId]);
            });
          }
        }}
        onFocusElement={(targetId) => {
          const el = elements.get(targetId);
          if (el) {
            setViewport((prev) => ({
              ...prev,
              x: screen.width / 2 - el.x * prev.zoom,
              y: screen.height / 2 - el.y * prev.zoom,
              zoom: Math.max(1, prev.zoom),
            }));
            setSelectedIds([targetId]);
          }
        }}
      />

      {/* Minimap interactive */}
      <Minimap
        elements={elementsArray}
        viewport={viewport}
        screen={screen}
        onNavigate={(worldX, worldY) => {
          setViewport((prev) => ({
            ...prev,
            x: screen.width / 2 - worldX * prev.zoom,
            y: screen.height / 2 - worldY * prev.zoom,
          }));
        }}
      />

      {/* Modale de votes (Phase 3) */}
      <VoteModal
        isOpen={showVoteModal}
        onClose={() => setShowVoteModal(false)}
        boardId={boardId}
        elements={elementsArray}
        onFocusElement={(id) => handleNavigateToFrame(id)}
        isVotingActive={isVotingActive}
        setIsVotingActive={setIsVotingActive}
        activeVoteSession={activeVoteSession}
        setActiveVoteSession={setActiveVoteSession}
      />

      {/* Modale de Brainstorming privé (Phase 3) */}
      <BrainstormModal
        isOpen={showBrainstormModal}
        onClose={() => setShowBrainstormModal(false)}
        boardId={boardId}
        onBatchAddElements={(newEls) => {
          if (onBatchOperations) {
            onBatchOperations(newEls.map((el) => ({ kind: 'create', element: el })));
          } else {
            newEls.forEach((el) => onAddElement(el));
          }
        }}
        viewportCenter={{
          x: (screen.width / 2 - viewport.x) / viewport.zoom,
          y: (screen.height / 2 - viewport.y) / viewport.zoom,
        }}
      />

      {/* Mode Présentation animé (Phase 3) */}
      <PresentationOverlay
        isActive={showPresentation}
        onClose={() => setShowPresentation(false)}
        elements={elementsArray}
        onFocusFrame={(frame) => handleNavigateToFrame(frame.id)}
      />

      {/* Modale Carte de lien web (Phase 3) */}
      <LinkPreviewModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onAddElement={onAddElement}
        viewportCenter={{
          x: (screen.width / 2 - viewport.x) / viewport.zoom,
          y: (screen.height / 2 - viewport.y) / viewport.zoom,
        }}
      />

      {/* Modale d'aide des raccourcis */}
      <ShortcutsHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

      {/* Modale de partage invité */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        boardId={boardId}
      />
    </div>
  );
}
