'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  MonitorUp,
  Users,
  Shield,
  Check,
  X,
  Copy,
  Lock,
  Unlock,
  VolumeX,
  AlertCircle,
  Sparkles,
  UserCheck,
  UserX,
  Edit3,
  Eye,
  Radio,
} from 'lucide-react';

export interface MeetParticipant {
  id: string;
  name: string;
  role: 'host' | 'participant';
  hasVideo: boolean;
  hasAudio: boolean;
  canDraw: boolean;
  isMutedByHost: boolean;
  isVideoBlockedByHost: boolean;
  isSpeaking?: boolean;
}

export interface WaitingUser {
  id: string;
  name: string;
  requestedAt: number;
}

interface MeetOverlayProps {
  boardId: string;
  currentUser: {
    id: string;
    name: string;
    role?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onPermissionChange?: (permissions: { canDraw: boolean }) => void;
}

export function MeetOverlay({
  boardId,
  currentUser,
  isOpen,
  onClose,
  onPermissionChange,
}: MeetOverlayProps) {
  const isHost = currentUser.role === 'owner';

  // États médias locaux
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // État de session
  const [isJoined, setIsJoined] = useState(false);
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [participants, setParticipants] = useState<MeetParticipant[]>([]);
  const [waitingRoom, setWaitingRoom] = useState<WaitingUser[]>([]);
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Références vidéo
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pollTimerRef = useRef<any>(null);

  // Initialisation du flux caméra et micro local
  const startLocalMedia = async () => {
    try {
      setMediaError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      console.warn('Accès caméra/micro standard refusé ou absent, essai audio seul:', err);
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioOnly);
        setIsCamOn(false);
        return audioOnly;
      } catch (err2: any) {
        console.warn('Mode simulation média activé pour test sans périphériques physiques:', err2);
        setMediaError('Caméra/Micro non détectés ou bloqués par le navigateur. Mode audio/vidéo simulé actif.');
        setIsCamOn(false);
        setIsMicOn(true);
        return null;
      }
    }
  };

  // Reconnexion du stream au tag <video> quand le composant se met à jour
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isJoined]);

  // Rejoindre la réunion ou frapper à la porte (Knock)
  const joinMeeting = async () => {
    await startLocalMedia();

    try {
      const res = await fetch(`/api/boards/${boardId}/meet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'knock',
          userId: currentUser.id,
          userName: currentUser.name,
          isHost,
          hasVideo: isCamOn,
          hasAudio: isMicOn,
        }),
      });

      const data = await res.json();
      if (data.status === 'approved') {
        setIsJoined(true);
        setIsInWaitingRoom(false);
      } else {
        setIsInWaitingRoom(true);
      }
    } catch {
      // Fallback local instantané
      setIsJoined(true);
      setIsInWaitingRoom(false);
    }
  };

  // Synchronisation polling avec le serveur toutes les 2.5 secondes
  const pollMeetState = useCallback(async () => {
    if (!isOpen) return;

    try {
      const res = await fetch(`/api/boards/${boardId}/meet`);
      if (res.ok) {
        const data = await res.json();
        setWaitingRoom(data.waitingRoom || []);

        const currentInList = data.participants?.find((p: any) => p.id === currentUser.id);

        if (isInWaitingRoom && currentInList) {
          setIsInWaitingRoom(false);
          setIsJoined(true);
        }

        // Appliquer les restrictions imposées par l'hôte en temps réel
        if (currentInList) {
          if (currentInList.isMutedByHost && isMicOn) {
            setIsMicOn(false);
            if (localStream) {
              localStream.getAudioTracks().forEach((t) => (t.enabled = false));
            }
          }

          if (currentInList.isVideoBlockedByHost && isCamOn) {
            setIsCamOn(false);
            if (localStream) {
              localStream.getVideoTracks().forEach((t) => (t.enabled = false));
            }
          }

          if (onPermissionChange) {
            onPermissionChange({ canDraw: currentInList.canDraw });
          }
        }

        setParticipants(data.participants || []);
      }

      // Envoi du heartbeat si connecté
      if (isJoined) {
        await fetch(`/api/boards/${boardId}/meet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            userId: currentUser.id,
            userName: currentUser.name,
            hasVideo: isCamOn,
            hasAudio: isMicOn,
          }),
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [boardId, currentUser.id, currentUser.name, isInWaitingRoom, isJoined, isCamOn, isMicOn, localStream, onPermissionChange, isOpen]);

  useEffect(() => {
    if (isOpen) {
      pollMeetState();
      pollTimerRef.current = setInterval(pollMeetState, 2500);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, pollMeetState]);

  // Arrêter proprement les flux à la fermeture
  const handleLeave = async () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    try {
      await fetch(`/api/boards/${boardId}/meet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          userId: currentUser.id,
        }),
      });
    } catch {}

    setIsJoined(false);
    setIsInWaitingRoom(false);
    onClose();
  };

  // Toggles utilisateur
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !isMicOn;
      });
    }
    setIsMicOn(!isMicOn);
  };

  const toggleCam = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = !isCamOn;
      });
    }
    setIsCamOn(!isCamOn);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        };
      } catch (err) {
        console.warn('Partage d’écran annulé ou non disponible:', err);
      }
    }
  };

  // Actions de l'Hôte (Modération)
  const handleApproveUser = async (targetUserId: string) => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', targetUserId }),
    });
    pollMeetState();
  };

  const handleRejectUser = async (targetUserId: string) => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', targetUserId }),
    });
    pollMeetState();
  };

  const handleToggleParticipantMic = async (p: MeetParticipant) => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-permission',
        targetUserId: p.id,
        isMutedByHost: !p.isMutedByHost,
      }),
    });
    pollMeetState();
  };

  const handleToggleParticipantVideo = async (p: MeetParticipant) => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-permission',
        targetUserId: p.id,
        isVideoBlockedByHost: !p.isVideoBlockedByHost,
      }),
    });
    pollMeetState();
  };

  const handleToggleParticipantDraw = async (p: MeetParticipant) => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-permission',
        targetUserId: p.id,
        canDraw: !p.canDraw,
      }),
    });
    pollMeetState();
  };

  const handleMuteAll = async () => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mute-all' }),
    });
    pollMeetState();
  };

  const handleKickUser = async (targetUserId: string) => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'kick', targetUserId }),
    });
    pollMeetState();
  };

  const handleCopyMeetLink = () => {
    const url = `${window.location.origin}/board/${boardId}?meet=true`;
    navigator.clipboard.writeText(url);
    setHasCopiedLink(true);
    setTimeout(() => setHasCopiedLink(false), 2500);
  };

  if (!isOpen) return null;

  // 1. Écran de Pré-Rejoint (Lancer ou Frapper à la porte)
  if (!isJoined && !isInWaitingRoom) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in p-4">
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Radio size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Réunion Vidéo & Voix</h3>
                <p className="text-xs text-slate-400">Tableau collaboratif en direct</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Aperçu caméra local */}
          <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!isCamOn && 'hidden'}`}
            />
            {!isCamOn && (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-300">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs">Caméra désactivée</span>
              </div>
            )}

            {/* Toggles pré-rejoint */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/80 shadow-lg">
              <button
                type="button"
                onClick={toggleMic}
                className={`p-2 rounded-full transition-colors ${
                  isMicOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-500 text-white'
                }`}
                title={isMicOn ? 'Couper le micro' : 'Activer le micro'}
              >
                {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button
                type="button"
                onClick={toggleCam}
                className={`p-2 rounded-full transition-colors ${
                  isCamOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-500 text-white'
                }`}
                title={isCamOn ? 'Couper la caméra' : 'Activer la caméra'}
              >
                {isCamOn ? <Video size={16} /> : <VideoOff size={16} />}
              </button>
            </div>
          </div>

          {mediaError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{mediaError}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={joinMeeting}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <span>{isHost ? 'Démarrer la réunion en tant qu’Hôte' : 'Demander à rejoindre la réunion'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMeetLink}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {hasCopiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{hasCopiedLink ? 'Lien de réunion copié !' : 'Copier le lien d’invitation Meet'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Écran Salle d'Attente pour les invités non encore autorisés
  if (isInWaitingRoom) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md animate-fade-in p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full text-center space-y-5 shadow-2xl text-white">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
            <Radio size={32} className="animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-lg">Salle d’attente</h3>
            <p className="text-xs text-slate-400">
              L’hôte du tableau a été notifié de votre arrivée. La réunion commencera dès qu’il aura autorisé votre entrée.
            </p>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl text-xs text-slate-300 font-mono">
            Participant : {currentUser.name}
          </div>
          <button
            type="button"
            onClick={handleLeave}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-medium transition-colors"
          >
            Annuler la demande
          </button>
        </div>
      </div>
    );
  }

  // 3. Réunion en cours : Barre flottante + Bulles Vidéo en direct + Contrôles Hôte
  return (
    <>
      {/* Alerte Hôte : Demandes d'entrée dans la salle d'attente ("Knock") */}
      {isHost && waitingRoom.length > 0 && (
        <div className="fixed top-20 right-6 z-50 max-w-md w-full bg-slate-900/95 border border-indigo-500/60 rounded-2xl shadow-2xl p-4 text-white space-y-3 animate-slide-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles size={14} />
              <span>Demande d’accès ({waitingRoom.length})</span>
            </div>
          </div>
          <div className="space-y-2">
            {waitingRoom.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between bg-slate-800/90 px-3.5 py-2.5 rounded-xl border border-slate-700/60"
              >
                <div className="text-xs">
                  <span className="font-semibold text-white block">{w.name}</span>
                  <span className="text-[10px] text-slate-400">Souhaite rejoindre la réunion</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApproveUser(w.id)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                    title="Autoriser l’entrée"
                  >
                    <UserCheck size={14} />
                    <span>Autoriser</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectUser(w.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="Refuser"
                  >
                    <UserX size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulles Vidéo Flottantes (Avatars vidéo style Miro / FigJam) */}
      <div
        className={`fixed z-40 transition-all duration-300 ${
          isMinimized
            ? 'bottom-20 right-6'
            : 'top-20 right-6 flex flex-col gap-3 max-h-[calc(100vh-140px)] overflow-y-auto pr-1'
        }`}
      >
        {/* Bulle Vidéo Locale (Vous) */}
        <div className="relative w-44 sm:w-52 aspect-video bg-slate-900 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-xl group select-none">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${!isCamOn && 'hidden'}`}
          />
          {!isCamOn && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-200">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-md">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded-lg border border-slate-700/60">
            <span className="truncate max-w-[100px]">{currentUser.name} (Vous)</span>
            <div className="flex items-center gap-1">
              {!isMicOn && <VolumeX size={12} className="text-rose-400" />}
              {isHost && <Shield size={12} className="text-amber-400" />}
            </div>
          </div>
        </div>

        {/* Bulles Vidéo des Autres Participants */}
        {!isMinimized &&
          participants
            .filter((p) => p.id !== currentUser.id)
            .map((p) => (
              <div
                key={p.id}
                className={`relative w-44 sm:w-52 aspect-video bg-slate-900 rounded-2xl overflow-hidden border-2 shadow-xl select-none transition-all ${
                  p.isSpeaking ? 'border-emerald-400 ring-2 ring-emerald-400/30' : 'border-slate-700/80'
                }`}
              >
                {p.hasVideo && !p.isVideoBlockedByHost ? (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 relative">
                    <div className="w-12 h-12 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-300">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-white">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    {p.isVideoBlockedByHost && (
                      <span className="text-[10px] text-amber-400 mt-1">Caméra bloquée par l’hôte</span>
                    )}
                  </div>
                )}

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded-lg border border-slate-700/60">
                  <span className="truncate max-w-[100px]">{p.name}</span>
                  <div className="flex items-center gap-1">
                    {p.isMutedByHost || !p.hasAudio ? (
                      <VolumeX size={12} className="text-rose-400" />
                    ) : (
                      <Mic size={12} className="text-emerald-400" />
                    )}
                    {!p.canDraw && (
                      <span title="Lecture seule">
                        <Eye size={12} className="text-amber-400" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Barre de Contrôle Flottante Inférieure */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-3 text-white">
        {/* Micro */}
        <button
          type="button"
          onClick={toggleMic}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 ${
            isMicOn
              ? 'bg-slate-800 hover:bg-slate-700 text-white'
              : 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
          }`}
          title={isMicOn ? 'Couper le micro (M)' : 'Activer le micro'}
        >
          {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
          <span className="hidden md:inline">{isMicOn ? 'Micro actif' : 'Muet'}</span>
        </button>

        {/* Caméra */}
        <button
          type="button"
          onClick={toggleCam}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 ${
            isCamOn
              ? 'bg-slate-800 hover:bg-slate-700 text-white'
              : 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
          }`}
          title={isCamOn ? 'Désactiver la caméra (V)' : 'Activer la caméra'}
        >
          {isCamOn ? <Video size={18} /> : <VideoOff size={18} />}
          <span className="hidden md:inline">{isCamOn ? 'Caméra active' : 'Sans vidéo'}</span>
        </button>

        {/* Partage d'écran */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 ${
            isScreenSharing ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Partager l’écran"
        >
          <MonitorUp size={18} />
          <span className="hidden lg:inline">{isScreenSharing ? 'Partage actif' : 'Écran'}</span>
        </button>

        <div className="w-[1px] h-6 bg-slate-700 mx-1" />

        {/* Panneau des Participants / Contrôles Hôte */}
        <button
          type="button"
          onClick={() => setShowHostPanel(!showHostPanel)}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold relative active:scale-95 ${
            showHostPanel ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Gérer les participants et permissions"
        >
          <Users size={18} />
          <span>{participants.length}</span>
          {waitingRoom.length > 0 && isHost && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
              {waitingRoom.length}
            </span>
          )}
        </button>

        {/* Copier le lien Meet */}
        <button
          type="button"
          onClick={handleCopyMeetLink}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 active:scale-95"
          title="Copier le lien direct du Meet"
        >
          {hasCopiedLink ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
          <span className="hidden sm:inline">{hasCopiedLink ? 'Copié !' : 'Inviter'}</span>
        </button>

        {/* Quitter la réunion */}
        <button
          type="button"
          onClick={handleLeave}
          className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 active:scale-95"
          title="Quitter la réunion"
        >
          <PhoneOff size={18} />
          <span className="hidden sm:inline">Quitter</span>
        </button>
      </div>

      {/* Modal Panneau de Modération & Permissions de l'Hôte */}
      {showHostPanel && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-5 text-white space-y-4 animate-scale-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-indigo-400" />
              <h3 className="font-bold text-sm text-white">Gestion des Participants & Permissions</h3>
            </div>
            <button
              onClick={() => setShowHostPanel(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>

          {/* Actions globales de l'hôte */}
          {isHost && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleMuteAll}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <VolumeX size={14} className="text-rose-400" />
                <span>Couper tous les micros</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyMeetLink()}
                className="flex-1 py-2 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-indigo-500/40"
              >
                <Copy size={14} />
                <span>Copier le lien Meet</span>
              </button>
            </div>
          )}

          {/* Liste détaillée des participants avec toggles */}
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
            {participants.map((p) => {
              const isCurrent = p.id === currentUser.id;
              return (
                <div key={p.id} className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center border border-slate-700">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">{p.name}</span>
                        {p.role === 'host' && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                            Hôte
                          </span>
                        )}
                        {isCurrent && <span className="text-[10px] text-slate-400">(Vous)</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        {p.canDraw ? 'Peut dessiner & éditer' : 'Lecture seule'}
                      </span>
                    </div>
                  </div>

                  {/* Contrôles de modération par l'hôte */}
                  {isHost && !isCurrent ? (
                    <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                      {/* Toggle Micro */}
                      <button
                        type="button"
                        onClick={() => handleToggleParticipantMic(p)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          p.isMutedByHost
                            ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                        title={p.isMutedByHost ? 'Micro forcé muet (cliquer pour autoriser)' : 'Couper le micro'}
                      >
                        {p.isMutedByHost ? <VolumeX size={14} /> : <Mic size={14} />}
                      </button>

                      {/* Toggle Caméra */}
                      <button
                        type="button"
                        onClick={() => handleToggleParticipantVideo(p)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          p.isVideoBlockedByHost
                            ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                        title={p.isVideoBlockedByHost ? 'Caméra bloquée (cliquer pour autoriser)' : 'Bloquer la caméra'}
                      >
                        {p.isVideoBlockedByHost ? <VideoOff size={14} /> : <Video size={14} />}
                      </button>

                      {/* Toggle Droit d'écriture sur le tableau */}
                      <button
                        type="button"
                        onClick={() => handleToggleParticipantDraw(p)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          !p.canDraw
                            ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                        title={p.canDraw ? 'Passer en lecture seule (interdire de dessiner)' : 'Autoriser à dessiner'}
                      >
                        {p.canDraw ? <Edit3 size={14} /> : <Eye size={14} />}
                      </button>

                      {/* Expulser */}
                      <button
                        type="button"
                        onClick={() => handleKickUser(p.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors ml-1"
                        title="Expulser de la réunion"
                      >
                        <UserX size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      {p.hasAudio ? <Mic size={14} className="text-emerald-400" /> : <VolumeX size={14} className="text-rose-400" />}
                      {p.hasVideo ? <Video size={14} className="text-indigo-400" /> : <VideoOff size={14} className="text-slate-500" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
