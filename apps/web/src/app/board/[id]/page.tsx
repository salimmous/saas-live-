'use client';

import React, { useState, useEffect, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useBoardSync } from '@/hooks/useBoardSync';
import { Canvas } from '@/components/canvas/Canvas';
import { Loader2 } from 'lucide-react';

interface BoardPageProps {
  params: Promise<{ id: string }>;
}

export default function BoardPage({ params }: BoardPageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const { data: session, isPending: isAuthPending } = useSession();

  // Paramètres d'invité éventuels
  const paramGuestToken = searchParams.get('guestToken');
  const paramGuestName = searchParams.get('guestName');

  const [guestToken, setGuestToken] = useState<string | null>(paramGuestToken);
  const [guestName, setGuestName] = useState<string | null>(paramGuestName);

  // Métadonnées du tableau
  const [boardTitle, setBoardTitle] = useState('Chargement du tableau…');
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'reader'>('editor');
  const [boardLoading, setBoardLoading] = useState(true);

  const [browserUid, setBrowserUid] = useState<string>('');
  const [browserUname, setBrowserUname] = useState<string>('');

  // Récupérer le token invité et générer un identifiant client unique par onglet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let uid = sessionStorage.getItem(`wb_uid_${id}`);
      if (!uid) {
        uid = 'u_' + Math.random().toString(36).substring(2, 8);
        sessionStorage.setItem(`wb_uid_${id}`, uid);
      }
      setBrowserUid(uid);

      if (!guestToken) {
        const storedToken = sessionStorage.getItem(`guest_token_${id}`);
        if (storedToken) setGuestToken(storedToken);
      }

      let uname = guestName || sessionStorage.getItem(`guest_name_${id}`);
      if (!uname && !session?.user?.name) {
        uname = 'Participant ' + uid.slice(-3).toUpperCase();
      }
      setBrowserUname(uname || '');
    }
  }, [id, guestToken, guestName, session?.user?.name]);

  // Charger les métadonnées du tableau
  useEffect(() => {
    if (!id) return;

    fetch(`/api/boards/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Tableau introuvable');
        return res.json();
      })
      .then((data) => {
        if (data.board) {
          setBoardTitle(data.board.title);
          if (data.userRole) setUserRole(data.userRole);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setBoardLoading(false));
  }, [id]);

  // Mettre à jour le titre du tableau
  const handleUpdateTitle = async (newTitle: string) => {
    setBoardTitle(newTitle);
    try {
      await fetch(`/api/boards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Déterminer les identifiants pour la collaboration temps réel
  const activeToken = guestToken || (session as any)?.session?.token || '';
  const currentUserName = guestName || session?.user?.name || browserUname || 'Utilisateur';
  const currentUserId = session?.user?.id || (guestToken ? `guest_${browserUid || id.slice(0, 6)}` : (browserUid ? `user_${browserUid}` : `user_${id.slice(0, 6)}`));

  // Connecter le moteur de synchronisation temps réel Yjs + Hocuspocus
  const {
    elements,
    presenceUsers,
    syncState,
    errorMessage,
    canUndo,
    canRedo,
    addElement,
    updateElement,
    deleteElements,
    batchOperations,
    undo,
    redo,
    broadcastCursor,
    retryConnection,
  } = useBoardSync({
    boardId: id,
    token: activeToken,
    userName: currentUserName,
    userId: currentUserId,
  });

  const isReadOnly = userRole === 'reader';

  if (boardLoading && isAuthPending) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 text-slate-500">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-xs font-semibold">Connexion à l’espace de travail…</p>
      </div>
    );
  }

  return (
    <Canvas
      boardId={id}
      boardTitle={boardTitle}
      onUpdateTitle={handleUpdateTitle}
      elements={elements}
      presenceUsers={presenceUsers}
      syncState={syncState}
      onRetrySync={retryConnection}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      onAddElement={addElement}
      onUpdateElement={updateElement}
      onDeleteElements={deleteElements}
      onBatchOperations={batchOperations}
      onBroadcastCursor={broadcastCursor}
      currentUser={{
        id: currentUserId,
        name: currentUserName,
        email: session?.user?.email,
        role: userRole,
      }}
      isReadOnly={isReadOnly}
    />
  );
}
