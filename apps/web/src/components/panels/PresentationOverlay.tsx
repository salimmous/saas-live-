'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Maximize2,
  Users,
  Film,
} from 'lucide-react';
import { BoardElement } from '@whiteboard/shared';

interface PresentationOverlayProps {
  isActive: boolean;
  onClose: () => void;
  elements: BoardElement[];
  onFocusFrame: (frame: BoardElement) => void;
  onBroadcastSlide?: (slideIndex: number, frameId: string) => void;
}

export function PresentationOverlay({
  isActive,
  onClose,
  elements,
  onFocusFrame,
  onBroadcastSlide,
}: PresentationOverlayProps) {
  // Récupérer et trier tous les cadres (frames) selon leur ordre
  const frames = elements
    .filter((e) => e.type === 'frame')
    .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));

  const [currentIndex, setCurrentIndex] = useState(0);

  const goToSlide = useCallback(
    (index: number) => {
      if (frames.length === 0) return;
      const target = Math.max(0, Math.min(index, frames.length - 1));
      setCurrentIndex(target);
      const frame = frames[target];
      if (frame) {
        onFocusFrame(frame);
        if (onBroadcastSlide) {
          onBroadcastSlide(target, frame.id);
        }
      }
    },
    [frames, onFocusFrame, onBroadcastSlide]
  );

  // Focus initial sur le premier slide à l'ouverture
  useEffect(() => {
    if (isActive && frames.length > 0) {
      goToSlide(0);
    }
  }, [isActive, frames.length, goToSlide]);

  // Raccourcis clavier : Flèche Droite / Espace = Suivant, Flèche Gauche = Précédent, Échap = Quitter
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goToSlide(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToSlide(currentIndex - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentIndex, goToSlide, onClose]);

  if (!isActive) return null;

  if (frames.length === 0) {
    return (
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5">
        <Film size={20} className="text-amber-400" />
        <div className="text-xs">
          <p className="font-bold">Aucun cadre (Frame) disponible pour la présentation</p>
          <p className="text-slate-400 mt-0.5">
            Créez des cadres avec l&apos;outil Cadre (F) pour définir les diapositives de votre présentation.
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  const currentFrame = frames[currentIndex];

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Barre de contrôle flottante en bas de l'écran */}
      <div className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/70 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Titre et indice de diapositive */}
        <div className="flex flex-col min-w-[160px]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Diapositive {currentIndex + 1} / {frames.length}
          </span>
          <span className="text-xs font-bold text-white truncate max-w-[200px]">
            {(currentFrame as any)?.title || `Cadre ${currentIndex + 1}`}
          </span>
        </div>

        <div className="w-[1px] h-7 bg-slate-700" />

        {/* Boutons de navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToSlide(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="p-2 hover:bg-slate-800 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 hover:text-white transition-all"
            title="Précédent (←)"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={() => goToSlide(currentIndex + 1)}
            disabled={currentIndex === frames.length - 1}
            className="p-2 hover:bg-slate-800 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 hover:text-white transition-all"
            title="Suivant (→ ou Espace)"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="w-[1px] h-7 bg-slate-700" />

        {/* Quitter */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          title="Quitter la présentation (Échap)"
        >
          <X size={15} />
          Quitter
        </button>
      </div>
    </div>
  );
}
