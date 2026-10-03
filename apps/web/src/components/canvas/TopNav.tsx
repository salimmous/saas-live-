'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Share2,
  Download,
  Play,
  Vote,
  Lightbulb,
} from 'lucide-react';
import { SyncState } from '@/hooks/useBoardSync';
import { UserPresence } from '@whiteboard/shared';

interface TopNavProps {
  boardId: string;
  title: string;
  onUpdateTitle: (title: string) => void;
  syncState: SyncState;
  onRetrySync: () => void;
  presenceUsers: UserPresence[];
  currentUser: { name: string; email?: string; role?: string };
  onOpenShareModal: () => void;
  onExportPng: () => void;
  onStartPresentation?: () => void;
  onOpenVoteModal?: () => void;
  onOpenBrainstormModal?: () => void;
}

export function TopNav({
  boardId,
  title,
  onUpdateTitle,
  syncState,
  onRetrySync,
  presenceUsers,
  currentUser,
  onOpenShareModal,
  onExportPng,
  onStartPresentation,
  onOpenVoteModal,
  onOpenBrainstormModal,
}: TopNavProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [boardTitle, setBoardTitle] = useState(title);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (boardTitle.trim()) {
      onUpdateTitle(boardTitle.trim());
    } else {
      setBoardTitle(title);
    }
  };

  const renderSyncIndicator = () => {
    switch (syncState) {
      case 'saved':
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium px-2 py-1 rounded-md bg-slate-100/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="hidden sm:inline">Enregistré</span>
          </div>
        );
      case 'saving':
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium px-2 py-1 rounded-md bg-slate-100/80">
            <Loader2 size={12} className="animate-spin text-blue-500" />
            <span className="hidden sm:inline">Enregistrement…</span>
          </div>
        );
      case 'reconnecting':
        return (
          <button
            type="button"
            onClick={onRetrySync}
            className="flex items-center gap-1.5 text-xs text-amber-700 font-medium px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <RefreshCw size={12} className="animate-spin text-amber-600" />
            <span>Reconnexion…</span>
          </button>
        );
      case 'error':
        return (
          <button
            type="button"
            onClick={onRetrySync}
            className="flex items-center gap-1.5 text-xs text-rose-700 font-medium px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 transition-colors"
          >
            <AlertCircle size={12} className="text-rose-600" />
            <span>Erreur (Réessayer)</span>
          </button>
        );
    }
  };

  return (
    <header className="absolute top-4 left-4 right-4 h-14 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/80 px-4 flex items-center justify-between z-30 select-none">
      {/* Côté Gauche : Retour Dashboard + Titre éditable + État de sauvegarde */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          title="Retour au tableau de bord"
        >
          <ArrowLeft size={18} />
        </Link>

        {isEditingTitle ? (
          <input
            type="text"
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
            autoFocus
            className="font-bold text-slate-800 text-sm md:text-base outline-none border-b-2 border-blue-500 bg-transparent px-1 py-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className="font-bold text-slate-800 text-sm md:text-base hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors truncate max-w-[200px] md:max-w-[320px] text-left"
            title="Cliquer pour renommer"
          >
            {title}
          </button>
        )}

        {renderSyncIndicator()}
      </div>

      {/* Côté Droit : Atelier, Collaborateurs, Partage, Présentation, Export */}
      <div className="flex items-center gap-2">
        {/* Ateliers Phase 3 : Votes & Brainstorming */}
        {onOpenVoteModal && (
          <button
            type="button"
            onClick={onOpenVoteModal}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors hidden md:flex items-center gap-1 text-xs font-semibold"
            title="Session de vote"
          >
            <Vote size={16} />
            <span>Votes</span>
          </button>
        )}

        {onOpenBrainstormModal && (
          <button
            type="button"
            onClick={onOpenBrainstormModal}
            className="p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors hidden md:flex items-center gap-1 text-xs font-semibold"
            title="Brainstorming privé"
          >
            <Lightbulb size={16} />
            <span>Brouillons</span>
          </button>
        )}

        {/* Mode Présentation (Phase 3) */}
        {onStartPresentation && (
          <button
            type="button"
            onClick={onStartPresentation}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Lancer la présentation plein écran"
          >
            <Play size={16} className="text-emerald-600 fill-emerald-600" />
            <span className="hidden sm:inline">Présentation</span>
          </button>
        )}

        <div className="w-[1px] h-6 bg-slate-200 mx-1 hidden sm:block" />

        {/* Liste des participants connectés en direct */}
        <div className="flex items-center -space-x-2 overflow-hidden py-1">
          {/* Utilisateur courant */}
          <div
            className="w-8 h-8 rounded-full border-2 border-white bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs"
            title={`${currentUser.name} (Vous)`}
          >
            {currentUser.name.charAt(0).toUpperCase()}
          </div>

          {/* Collaborateurs distants */}
          {presenceUsers.slice(0, 4).map((u) => (
            <div
              key={u.id}
              className="w-8 h-8 rounded-full border-2 border-white text-white font-bold text-xs flex items-center justify-center shadow-xs"
              style={{ backgroundColor: u.color || '#6366f1' }}
              title={u.name}
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
          ))}

          {presenceUsers.length > 4 && (
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
              +{presenceUsers.length - 4}
            </div>
          )}
        </div>

        {/* Bouton Partager / Lien invité */}
        <button
          type="button"
          onClick={onOpenShareModal}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
        >
          <Share2 size={14} />
          <span className="hidden sm:inline">Partager</span>
        </button>

        {/* Bouton Export PNG */}
        <button
          type="button"
          onClick={onExportPng}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          title="Exporter le tableau en image PNG"
        >
          <Download size={17} />
        </button>
      </div>
    </header>
  );
}
