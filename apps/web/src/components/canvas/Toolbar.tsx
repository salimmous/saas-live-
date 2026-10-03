'use client';

import React, { useState } from 'react';
import {
  MousePointer2,
  StickyNote,
  Type,
  Square,
  Circle,
  Diamond,
  PenTool,
  ArrowUpRight,
  Frame,
  Network,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

export type CanvasTool =
  | 'select'
  | 'sticky'
  | 'text'
  | 'shape-rectangle'
  | 'shape-circle'
  | 'shape-diamond'
  | 'pen'
  | 'connector'
  | 'frame'
  | 'mindmap';

interface ToolbarProps {
  currentTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToContent: () => void;
  onAutoLayout?: () => void;
  onToggleAiPanel: () => void;
  onOpenHelp: () => void;
}

export function Toolbar({
  currentTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToContent,
  onAutoLayout,
  onToggleAiPanel,
  onOpenHelp,
}: ToolbarProps) {
  const [showShapeMenu, setShowShapeMenu] = useState(false);

  return (
    <>
      {/* Barre d'outils principale (centrée en bas) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-xl border border-slate-200/80 flex items-center gap-1 z-30 select-none">
        {/* Curseur Sélection */}
        <button
          type="button"
          title="Sélectionner (V)"
          onClick={() => onSelectTool('select')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'select'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MousePointer2 size={18} />
        </button>

        {/* Sticky Note */}
        <button
          type="button"
          title="Note adhésive (S)"
          onClick={() => onSelectTool('sticky')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'sticky'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <StickyNote size={18} />
        </button>

        {/* Texte */}
        <button
          type="button"
          title="Texte (T)"
          onClick={() => onSelectTool('text')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'text'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Type size={18} />
        </button>

        {/* Formes géométriques */}
        <div className="relative">
          <button
            type="button"
            title="Formes géométriques (R)"
            onClick={() => {
              if (currentTool.startsWith('shape-')) {
                setShowShapeMenu(!showShapeMenu);
              } else {
                onSelectTool('shape-rectangle');
              }
            }}
            className={`p-2.5 rounded-xl transition-all flex items-center gap-0.5 ${
              currentTool.startsWith('shape-')
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentTool === 'shape-circle' ? (
              <Circle size={18} />
            ) : currentTool === 'shape-diamond' ? (
              <Diamond size={18} />
            ) : (
              <Square size={18} />
            )}
          </button>

          {/* Menu déroulant des formes */}
          {showShapeMenu && (
            <div className="absolute bottom-14 left-0 bg-white rounded-xl shadow-lg border border-slate-200 p-1 flex gap-1 z-40">
              <button
                type="button"
                onClick={() => {
                  onSelectTool('shape-rectangle');
                  setShowShapeMenu(false);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-700"
                title="Rectangle"
              >
                <Square size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectTool('shape-circle');
                  setShowShapeMenu(false);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-700"
                title="Cercle"
              >
                <Circle size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectTool('shape-diamond');
                  setShowShapeMenu(false);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-700"
                title="Losange"
              >
                <Diamond size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Dessin libre au stylet */}
        <button
          type="button"
          title="Dessin libre (D)"
          onClick={() => onSelectTool('pen')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'pen'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PenTool size={18} />
        </button>

        {/* Connecteur intelligent */}
        <button
          type="button"
          title="Connecteur intelligent (C)"
          onClick={() => onSelectTool('connector')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'connector'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ArrowUpRight size={18} />
        </button>

        {/* Cadre (Frame) */}
        <button
          type="button"
          title="Cadre / Écran (F)"
          onClick={() => onSelectTool('frame')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'frame'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Frame size={18} />
        </button>

        {/* Mind Map */}
        <button
          type="button"
          title="Mind Map auto-adaptative (M)"
          onClick={() => onSelectTool('mindmap')}
          className={`p-2.5 rounded-xl transition-all ${
            currentTool === 'mindmap'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Network size={18} />
        </button>

        {/* Organisation automatique (Feature 2) */}
        {onAutoLayout && (
          <button
            type="button"
            title="Organisation automatique (Dagre / Grille)"
            onClick={onAutoLayout}
            className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-all"
          >
            <Maximize2 size={18} className="rotate-45" />
          </button>
        )}

        <div className="w-[1px] h-6 bg-slate-200 mx-1" />

        {/* Assistant IA */}
        <button
          type="button"
          title="Assistant IA (Diagrammes, Regroupement, Synthèse)"
          onClick={onToggleAiPanel}
          className="p-2.5 rounded-xl text-purple-600 hover:bg-purple-50 transition-all flex items-center gap-1 font-medium text-xs"
        >
          <Sparkles size={18} className="text-purple-600" />
          <span className="hidden md:inline">IA</span>
        </button>

        <div className="w-[1px] h-6 bg-slate-200 mx-1" />

        {/* Annuler / Rétablir */}
        <button
          type="button"
          title="Annuler (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          title="Rétablir (Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Contrôles de zoom en bas à gauche */}
      <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md px-2 py-1 rounded-xl shadow-lg border border-slate-200/80 flex items-center gap-1 z-30 select-none text-slate-700 text-xs font-semibold">
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom arrière"
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          title="Réinitialiser à 100%"
          className="px-2 py-1 hover:bg-slate-100 rounded-md transition-colors"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom avant"
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ZoomIn size={15} />
        </button>
        <div className="w-[1px] h-4 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={onFitToContent}
          title="Ajuster au contenu"
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
        >
          <Maximize2 size={14} />
          <span className="hidden sm:inline">Ajuster</span>
        </button>
        <div className="w-[1px] h-4 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={onOpenHelp}
          title="Aide et raccourcis clavier (?)"
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
        >
          <HelpCircle size={15} />
        </button>
      </div>
    </>
  );
}
