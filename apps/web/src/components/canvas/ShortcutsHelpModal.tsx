'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'V', desc: 'Outil Sélection / Déplacement' },
  { key: 'S', desc: 'Créer une Sticky Note' },
  { key: 'T', desc: 'Ajouter du texte' },
  { key: 'R', desc: 'Créer un rectangle / forme' },
  { key: 'D', desc: 'Dessin libre au stylet' },
  { key: 'C', desc: 'Connecteur intelligent' },
  { key: 'Espace + Glisser', desc: 'Naviguer dans le canvas (Pan)' },
  { key: 'Molette / Pincement', desc: 'Zoom centré sur le curseur' },
  { key: 'Maj + Clic', desc: 'Sélection multiple' },
  { key: 'Suppr / Retour', desc: 'Supprimer les éléments sélectionnés' },
  { key: 'Ctrl/Cmd + Z', desc: 'Annuler (Undo local)' },
  { key: 'Ctrl/Cmd + Y', desc: 'Rétablir (Redo)' },
  { key: 'Ctrl/Cmd + D', desc: 'Dupliquer la sélection' },
  { key: 'Ctrl/Cmd + C / V', desc: 'Copier / Coller' },
  { key: 'Tab', desc: 'Mind map : ajouter un nœud enfant' },
  { key: 'Entrée', desc: 'Mind map : ajouter un nœud frère' },
  { key: '?', desc: 'Ouvrir cette aide des raccourcis' },
];

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-in">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-base">
            <Keyboard size={18} className="text-blue-600" />
            <span>Raccourcis Clavier</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-2.5">
            {SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
              >
                <span className="text-sm text-slate-600 font-medium">{s.desc}</span>
                <kbd className="px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-mono font-semibold rounded-md shadow-xs">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
