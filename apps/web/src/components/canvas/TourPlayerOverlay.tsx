'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, X, RotateCcw, FastForward, Navigation } from 'lucide-react';

interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  zoom: number;
  cursorX?: number;
  cursorY?: number;
}

interface TourPlayerOverlayProps {
  tour: {
    id: string;
    title: string;
    duration: number;
    trajectoryData: TrajectoryPoint[];
    creator?: { name: string };
  } | null;
  onClose: () => void;
  onSetViewport: (viewport: { x: number; y: number; zoom: number }) => void;
}

export function TourPlayerOverlay({
  tour,
  onClose,
  onSetViewport,
}: TourPlayerOverlayProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const duration = tour?.duration || 1;
  const trajectory = useMemo(() => tour?.trajectoryData || [], [tour?.trajectoryData]);

  // Animation frame loop
  useEffect(() => {
    if (!tour || trajectory.length === 0) return;

    const animate = (time: number) => {
      if (lastTimeRef.current !== null && isPlaying) {
        const delta = (time - lastTimeRef.current) / 1000 * playbackSpeed;
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = null;
    };
  }, [tour, isPlaying, playbackSpeed, duration, trajectory]);

  // Synchronisation de la caméra et du curseur selon currentTime
  useEffect(() => {
    if (!trajectory || trajectory.length === 0) return;

    // Trouver le point le plus proche
    let currentPoint = trajectory[0];
    for (let i = 0; i < trajectory.length; i++) {
      if (trajectory[i].t <= currentTime) {
        currentPoint = trajectory[i];
      } else {
        break;
      }
    }

    if (currentPoint) {
      onSetViewport({
        x: currentPoint.x,
        y: currentPoint.y,
        zoom: currentPoint.zoom,
      });

      if (currentPoint.cursorX !== undefined && currentPoint.cursorY !== undefined) {
        setCursorPos({
          x: currentPoint.cursorX,
          y: currentPoint.cursorY,
        });
      }
    }
  }, [currentTime, trajectory, onSetViewport]);

  // Gestion des raccourcis clavier (Espace pour pause, Escape pour quitter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!tour) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Curseur virtuel du présentateur */}
      {cursorPos && (
        <div
          className="fixed pointer-events-none z-50 transition-all duration-75 ease-out"
          style={{
            transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`,
          }}
        >
          <div className="relative">
            <Navigation
              size={22}
              className="text-purple-600 fill-purple-600 -rotate-45 drop-shadow-md"
            />
            <div className="absolute top-4 left-4 bg-purple-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
              {tour.creator?.name || 'Guide'}
            </div>
            <span className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-purple-400/40 animate-ping pointer-events-none" />
          </div>
        </div>
      )}

      {/* Barre de contrôle flottante en bas de l'écran */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-xl border border-white/20 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-col gap-2.5 w-[90%] max-w-lg animate-in slide-in-from-bottom-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold truncate max-w-xs">{tour.title}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const speeds = [1, 1.5, 2];
                const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                setPlaybackSpeed(speeds[nextIdx]);
              }}
              className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
            >
              {playbackSpeed}x
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Quitter la visite"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Ligne de défilement (Scrubber) */}
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white transition-transform active:scale-95 shadow-xs"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="fill-white" />}
          </button>

          <span className="text-[11px] font-mono text-slate-300 w-10 text-right">
            {formatDuration(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              setCurrentTime(parseFloat(e.target.value));
              lastTimeRef.current = null;
            }}
            className="flex-1 accent-purple-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
          />

          <span className="text-[11px] font-mono text-slate-400 w-10">
            {formatDuration(duration)}
          </span>

          <button
            onClick={() => {
              setCurrentTime(0);
              setIsPlaying(true);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Recommencer"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
