'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import { BoardElement, UserPresence, Point, BoardOperation } from '@whiteboard/shared';

export type SyncState = 'connecting' | 'connected' | 'saved' | 'saving' | 'reconnecting' | 'error';

interface UseBoardSyncOptions {
  boardId: string;
  token?: string;
  userName: string;
  userId: string;
  userColor?: string;
}

const LOCAL_ORIGIN = 'local-board-editor';

// Couleurs vives et contrastées pour les collaborateurs
const COLLAB_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'
];

export function useBoardSync({
  boardId,
  token,
  userName,
  userId,
  userColor,
}: UseBoardSyncOptions) {
  const [elements, setElements] = useState<Map<string, BoardElement>>(new Map());
  const [presenceUsers, setPresenceUsers] = useState<UserPresence[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const colorRef = useRef<string>(
    userColor || COLLAB_COLORS[Math.abs(userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % COLLAB_COLORS.length]
  );

  // Throttle awareness
  const lastCursorBroadcastRef = useRef<number>(0);
  const pendingCursorRef = useRef<{ point: Point | null; selectedIds: string[] } | null>(null);

  useEffect(() => {
    if (!boardId) return;

    // 1. Initialiser le Y.Doc
    const doc = new Y.Doc();
    docRef.current = doc;
    const yElements = doc.getMap<BoardElement>('elements');

    // 2. Persistance locale via IndexedDB pour tolérance aux pannes et mode déconnecté
    const persistence = new IndexeddbPersistence(`whiteboard-${boardId}`, doc);
    persistenceRef.current = persistence;

    // 3. Connecter le serveur temps réel Hocuspocus
    const syncUrl = process.env.NEXT_PUBLIC_SYNC_URL || 'ws://localhost:1234';
    const provider = new HocuspocusProvider({
      url: syncUrl,
      name: boardId,
      document: doc,
      token: token || '',
    });
    providerRef.current = provider;

    // 4. Configurer UndoManager avec filtre d'origine stricte (actions de l'utilisateur courant uniquement)
    const undoManager = new Y.UndoManager(yElements, {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
    });
    undoManagerRef.current = undoManager;

    undoManager.on('stack-item-added', () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    });
    undoManager.on('stack-item-popped', () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    });

    // 5. Écoute des mutations du document Yjs
    const updateLocalState = () => {
      const nextMap = new Map<string, BoardElement>();
      yElements.forEach((val, key) => {
        nextMap.set(key, val);
      });
      setElements(nextMap);
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    };

    yElements.observe(() => {
      updateLocalState();
    });

    // 6. Gestionnaires d'état de synchronisation
    provider.on('status', ({ status }: { status: string }) => {
      if (status === 'connected') {
        setSyncState('saved');
        setErrorMessage(null);
      } else if (status === 'connecting') {
        setSyncState('connecting');
      } else if (status === 'disconnected') {
        setSyncState('reconnecting');
      }
    });

    provider.on('synced', ({ state }: { state: boolean }) => {
      if (state) {
        setSyncState('saved');
        updateLocalState();
      }
    });

    provider.on('authenticationFailed', ({ reason }: { reason: string }) => {
      setSyncState('error');
      setErrorMessage(reason || 'Échec de l’authentification temps réel');
    });

    // 7. Awareness : présence, curseurs distants et sélections
    const awareness = provider.awareness;
    if (awareness) {
      // Définir l'état initial local
      awareness.setLocalStateField('user', {
        id: userId,
        name: userName,
        color: colorRef.current,
        selectedIds: [],
        cursor: null,
        lastActive: Date.now(),
      });

      const handleAwarenessChange = () => {
        const states = awareness.getStates();
        const activeUsers: UserPresence[] = [];

        states.forEach((state: any, clientID: number) => {
          if (clientID !== awareness.clientID && state?.user) {
            activeUsers.push(state.user as UserPresence);
          }
        });

        setPresenceUsers(activeUsers);
      };

      awareness.on('change', handleAwarenessChange);
    }

    // Chargement initial
    updateLocalState();

    return () => {
      undoManager.destroy();
      provider.destroy();
      persistence.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
      persistenceRef.current = null;
      undoManagerRef.current = null;
    };
  }, [boardId, token, userName, userId]);

  // Diffusion du curseur et de la sélection throttlée à ~20Hz (50ms)
  const broadcastCursor = useCallback(
    (point: Point | null, selectedIds: string[]) => {
      const now = Date.now();
      pendingCursorRef.current = { point, selectedIds };

      if (now - lastCursorBroadcastRef.current >= 50) {
        lastCursorBroadcastRef.current = now;
        const awareness = providerRef.current?.awareness;
        if (awareness) {
          awareness.setLocalStateField('user', {
            id: userId,
            name: userName,
            color: colorRef.current,
            cursor: point,
            selectedIds,
            lastActive: now,
          });
        }
      }
    },
    [userId, userName]
  );

  // Ajout d'élément
  const addElement = useCallback((element: BoardElement) => {
    const doc = docRef.current;
    if (!doc) return;
    const yElements = doc.getMap<BoardElement>('elements');

    doc.transact(() => {
      yElements.set(element.id, element);
    }, LOCAL_ORIGIN);
    setSyncState('saving');
    setTimeout(() => setSyncState('saved'), 300);
  }, []);

  // Mise à jour d'élément
  const updateElement = useCallback((id: string, patch: Partial<BoardElement>) => {
    const doc = docRef.current;
    if (!doc) return;
    const yElements = doc.getMap<BoardElement>('elements');

    doc.transact(() => {
      const current = yElements.get(id);
      if (current) {
        yElements.set(id, { ...current, ...patch, meta: { ...current.meta, updatedAt: Date.now() } } as BoardElement);
      }
    }, LOCAL_ORIGIN);
    setSyncState('saving');
    setTimeout(() => setSyncState('saved'), 300);
  }, []);

  // Suppression d'éléments et nettoyage des connecteurs attachés
  const deleteElements = useCallback((ids: string[]) => {
    const doc = docRef.current;
    if (!doc) return;
    const yElements = doc.getMap<BoardElement>('elements');
    const idsSet = new Set(ids);

    doc.transact(() => {
      // 1. Supprimer les éléments demandés
      ids.forEach((id) => yElements.delete(id));

      // 2. Nettoyer automatiquement les connecteurs reliés aux éléments supprimés (Règle 10)
      yElements.forEach((el, key) => {
        if (el.type === 'connector') {
          if (idsSet.has(el.fromId) || idsSet.has(el.toId)) {
            yElements.delete(key);
          }
        }
      });
    }, LOCAL_ORIGIN);
    setSyncState('saving');
    setTimeout(() => setSyncState('saved'), 300);
  }, []);

  // Exécution d'un lot d'opérations dans une transaction atomique Yjs unique (Moteur d'actions unique)
  const batchOperations = useCallback((operations: BoardOperation[]) => {
    const doc = docRef.current;
    if (!doc) return;
    const yElements = doc.getMap<BoardElement>('elements');

    doc.transact(() => {
      for (const op of operations) {
        if (op.kind === 'create') {
          yElements.set(op.element.id, op.element);
        } else if (op.kind === 'update') {
          const curr = yElements.get(op.elementId);
          if (curr) {
            yElements.set(op.elementId, { ...curr, ...op.patch, meta: { ...curr.meta, updatedAt: Date.now() } });
          }
        } else if (op.kind === 'move') {
          const curr = yElements.get(op.elementId);
          if (curr) {
            yElements.set(op.elementId, { ...curr, x: curr.x + op.dx, y: curr.y + op.dy, meta: { ...curr.meta, updatedAt: Date.now() } });
          }
        } else if (op.kind === 'delete') {
          yElements.delete(op.elementId);
        } else if (op.kind === 'connect') {
          const conn: BoardElement = {
            id: op.connectorId,
            type: 'connector',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            zIndex: 1000,
            fromId: op.fromId,
            toId: op.toId,
            startEnd: 'none',
            endEnd: 'arrow',
            routing: 'orthogonal',
            label: op.label,
            style: { stroke: '#64748b', strokeWidth: 2, strokeStyle: 'solid' },
            meta: { createdAt: Date.now(), updatedAt: Date.now() },
          };
          yElements.set(op.connectorId, conn);
        }
      }
    }, LOCAL_ORIGIN);
    setSyncState('saving');
    setTimeout(() => setSyncState('saved'), 300);
  }, []);

  // Annuler / Rétablir
  const undo = useCallback(() => {
    if (undoManagerRef.current && undoManagerRef.current.canUndo()) {
      undoManagerRef.current.undo();
    }
  }, []);

  const redo = useCallback(() => {
    if (undoManagerRef.current && undoManagerRef.current.canRedo()) {
      undoManagerRef.current.redo();
    }
  }, []);

  // Tentative de reconnexion manuelle
  const retryConnection = useCallback(() => {
    const provider = providerRef.current;
    if (provider) {
      setSyncState('connecting');
      provider.connect();
    }
  }, []);

  return {
    elements,
    presenceUsers,
    syncState,
    errorMessage,
    canUndo,
    canRedo,
    userColor: colorRef.current,
    addElement,
    updateElement,
    deleteElements,
    batchOperations,
    undo,
    redo,
    broadcastCursor,
    retryConnection,
  };
}
