'use client';

import React, { useRef, useState } from 'react';
import {
  BoardElement,
  StickyElement,
  TextElement,
  ShapeElement,
  FrameElement,
  MindMapNodeElement,
  TaskElement,
  ImageElement,
  VideoElement,
  LinkElement,
  HotspotElement,
} from '@whiteboard/shared';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  Play,
} from 'lucide-react';

interface ElementRendererProps {
  element: BoardElement;
  isSelected?: boolean;
  isReadOnly?: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onUpdate: (id: string, patch: Partial<BoardElement>) => void;
  onResizeStart?: (id: string, handle: string, e: React.MouseEvent) => void;
  onNavigateToFrame?: (frameId: string) => void;
}

export const ElementRenderer = React.memo(function ElementRenderer({
  element,
  isSelected = false,
  isReadOnly = false,
  onSelect,
  onUpdate,
  onResizeStart,
  onNavigateToFrame,
}: ElementRendererProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Éléments rendus exclusivement dans la couche SVG
  if (element.type === 'connector' || element.type === 'drawing') {
    return null;
  }

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${element.x}px`,
    top: `${element.y}px`,
    width: `${element.width}px`,
    height: `${element.height}px`,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex || 1,
  };

  const renderContent = () => {
    switch (element.type) {
      case 'sticky': {
        const el = element as StickyElement;
        return (
          <div
            className="w-full h-full p-3 rounded-lg shadow-md flex flex-col transition-shadow hover:shadow-lg"
            style={{
              backgroundColor: el.style.color || '#fef08a',
            }}
          >
            <textarea
              className="editable-note-text flex-1 text-slate-800 text-sm font-medium leading-relaxed"
              value={el.content}
              disabled={isReadOnly}
              placeholder="Écrivez une note..."
              onChange={(e) => onUpdate(el.id, { content: e.target.value })}
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
              style={{
                fontSize: `${el.style.fontSize || 14}px`,
                textAlign: el.style.textAlign || 'left',
              }}
            />
          </div>
        );
      }

      case 'text': {
        const el = element as TextElement;
        return (
          <div className="w-full h-full p-2 flex items-center">
            <textarea
              className="editable-note-text font-sans leading-snug"
              value={el.content}
              disabled={isReadOnly}
              placeholder="Tapez votre texte..."
              onChange={(e) => onUpdate(el.id, { content: e.target.value })}
              style={{
                fontSize: `${el.style.fontSize || 20}px`,
                fontFamily: el.style.fontFamily || 'inherit',
                color: el.style.color || '#000000',
                textAlign: el.style.textAlign || 'left',
                fontWeight: el.style.isBold ? 700 : 400,
                fontStyle: el.style.isItalic ? 'italic' : 'normal',
              }}
            />
          </div>
        );
      }

      case 'shape': {
        const el = element as ShapeElement;
        const fill = el.style.fill || '#e2e8f0';
        const stroke = el.style.stroke || '#475569';
        const strokeWidth = el.style.strokeWidth || 2;
        const isDashed = el.style.strokeStyle === 'dashed';

        let shapeClassName = 'w-full h-full flex items-center justify-center p-3 text-center transition-all ';

        if (el.shapeType === 'circle') {
          shapeClassName += 'rounded-full ';
        } else if (el.shapeType === 'diamond') {
          shapeClassName += 'rounded-md ';
        } else {
          shapeClassName += 'rounded-lg ';
        }

        return (
          <div
            className={shapeClassName}
            style={{
              backgroundColor: fill,
              border: `${strokeWidth}px ${isDashed ? 'dashed' : 'solid'} ${stroke}`,
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}
          >
            <textarea
              className="editable-note-text text-sm font-semibold text-center select-text"
              value={el.content || ''}
              disabled={isReadOnly}
              placeholder="Forme..."
              onChange={(e) => onUpdate(el.id, { content: e.target.value })}
              style={{ color: el.style.color || '#1e293b' }}
            />
          </div>
        );
      }

      case 'frame': {
        const el = element as FrameElement;
        return (
          <div
            className="w-full h-full rounded-xl pointer-events-none relative transition-all"
            style={{
              backgroundColor: el.style.background || 'rgba(241, 245, 249, 0.4)',
              border: el.style.border || '2px dashed #94a3b8',
            }}
          >
            <div className="absolute -top-7 left-0 bg-slate-800 text-white text-xs font-semibold px-3 py-1 rounded-t-md pointer-events-auto flex items-center gap-1 shadow-sm">
              <span>{el.title}</span>
            </div>
          </div>
        );
      }

      case 'mindmap-node': {
        const el = element as MindMapNodeElement;
        return (
          <div
            className="w-full h-full px-3 py-2 rounded-xl shadow-sm border-2 flex items-center justify-between gap-2 transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: el.style.fill || '#ffffff',
              borderColor: el.style.stroke || '#3b82f6',
              color: el.style.color || '#1e293b',
            }}
          >
            <input
              type="text"
              className="bg-transparent outline-none flex-1 font-medium text-sm select-text"
              value={el.content}
              disabled={isReadOnly}
              placeholder="Idée..."
              onChange={(e) => onUpdate(el.id, { content: e.target.value })}
            />
            {el.parentId !== undefined && (
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700 p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(el.id, { collapsed: !el.collapsed });
                }}
              >
                {el.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        );
      }

      case 'task': {
        const el = element as TaskElement;
        const statusColors = {
          todo: 'bg-slate-100 text-slate-700 border-slate-200',
          in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
          done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };

        const statusLabels = {
          todo: 'À faire',
          in_progress: 'En cours',
          done: 'Terminé',
        };

        return (
          <div className="w-full h-full bg-white rounded-xl shadow-md border border-slate-200 p-3 flex flex-col justify-between hover:shadow-lg transition-shadow">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[el.status]}`}
                >
                  {statusLabels[el.status]}
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  {el.priority}
                </span>
              </div>
              <input
                type="text"
                className="font-semibold text-slate-800 text-sm w-full bg-transparent outline-none"
                value={el.title}
                disabled={isReadOnly}
                placeholder="Titre de la tâche..."
                onChange={(e) => onUpdate(el.id, { title: e.target.value })}
              />
              {el.description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{el.description}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 mt-2">
              <span className="flex items-center gap-1">
                <UserIcon size={12} />
                {el.assigneeName || 'Non assigné'}
              </span>
              {el.dueDate && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock size={12} />
                  {el.dueDate}
                </span>
              )}
            </div>
          </div>
        );
      }

      case 'image': {
        const el = element as ImageElement;
        return (
          <div className="w-full h-full rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={el.url}
              alt={el.alt || 'Image tableau'}
              className="w-full h-full object-cover select-none pointer-events-none"
              loading="lazy"
            />
          </div>
        );
      }

      case 'video': {
        const el = element as VideoElement;
        if (el.videoType === 'youtube' || el.videoType === 'vimeo') {
          return (
            <div className="w-full h-full rounded-xl overflow-hidden shadow-md bg-black">
              <iframe
                src={el.url}
                title={el.title || 'Vidéo intégrée'}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          );
        }

        return (
          <div className="w-full h-full rounded-xl overflow-hidden shadow-md bg-black flex items-center justify-center">
            <video
              src={el.url}
              controls
              className="w-full h-full object-contain"
              preload="metadata"
            >
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
          </div>
        );
      }

      case 'link': {
        const el = element as LinkElement;
        return (
          <a
            href={el.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (isSelected) e.preventDefault();
            }}
            className="w-full h-full bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col group hover:shadow-lg transition-all"
          >
            {el.image && (
              <div className="h-28 w-full bg-slate-100 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={el.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
            )}
            <div className="p-3 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-xs text-slate-800 line-clamp-1 flex items-center gap-1">
                  {el.title || el.url}
                  <ExternalLink size={11} className="text-slate-400 group-hover:text-blue-500" />
                </h4>
                {el.description && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{el.description}</p>
                )}
              </div>
              <span className="text-[10px] text-slate-400 truncate mt-2">{new URL(el.url).hostname}</span>
            </div>
          </a>
        );
      }

      case 'hotspot': {
        const el = element as HotspotElement;
        return (
          <button
            type="button"
            className="w-full h-full rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/40 hover:bg-indigo-100/60 text-indigo-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToFrame?.(el.targetFrameId);
            }}
          >
            <Play size={13} className="fill-indigo-600" />
            <span>{el.label || 'Aller au cadre'}</span>
          </button>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      style={baseStyle}
      className={`group select-none cursor-grab active:cursor-grabbing ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(element.id, e);
      }}
    >
      {renderContent()}

      {/* 8 Poignées de redimensionnement pour l'élément sélectionné */}
      {isSelected && !isReadOnly && (
        <>
          <div
            className="resize-handle -top-1.5 -left-1.5 cursor-nwse-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart?.(element.id, 'nw', e);
            }}
          />
          <div
            className="resize-handle -top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart?.(element.id, 'n', e);
            }}
          />
          <div
            className="resize-handle -top-1.5 -right-1.5 cursor-nesw-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart?.(element.id, 'ne', e);
            }}
          />
          <div
            className="resize-handle top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart?.(element.id, 'e', e);
            }}
          />
          <div
            className="resize-handle -bottom-1.5 -right-1.5 cursor-nwse-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart?.(element.id, 'se', e);
            }}
          />
          <div
            className="resize-handle -bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart?.(element.id, 's', e);
            }}
          />
          <div
            className="resize-handle -bottom-1.5 -left-1.5 cursor-nesw-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart?.(element.id, 'sw', e);
            }}
          />
          <div
            className="resize-handle top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart?.(element.id, 'w', e);
            }}
          />
        </>
      )}
    </div>
  );
});
