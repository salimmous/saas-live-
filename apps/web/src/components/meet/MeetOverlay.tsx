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
  ShieldCheck,
  Check,
  X,
  Copy,
  VolumeX,
  AlertCircle,
  Sparkles,
  UserCheck,
  UserX,
  Edit3,
  Eye,
  Radio,
  User,
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
  // Nom d'affichage de l'invité
  const [displayName, setDisplayName] = useState(
    currentUser.name.startsWith('Participant ') ? '' : currentUser.name
  );
  const [nameError, setNameError] = useState(false);

  // Détection Hôte : UNIQUEMENT l'hôte officiel (pas tout le monde)
  const [hostId, setHostId] = useState<string>('');
  const isHost = hostId ? hostId === currentUser.id : currentUser.role === 'owner';

  // Médias locaux
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Flux distants WebRTC P2P (Voix & Vidéo en direct)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  // États de session
  const [isJoined, setIsJoined] = useState(false);
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [participants, setParticipants] = useState<MeetParticipant[]>([]);
  const [waitingRoom, setWaitingRoom] = useState<WaitingUser[]>([]);
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Références
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pollTimerRef = useRef<any>(null);
  const peerRef = useRef<any>(null);
  const activeCallsRef = useRef<Map<string, any>>(new Map());

  // Identifiant PeerJS
  const getPeerIdForUser = useCallback(
    (uid: string) => {
      const cleanBoard = boardId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
      const cleanUser = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
      return `wb_${cleanBoard}_${cleanUser}`;
    },
    [boardId]
  );

  const myPeerId = getPeerIdForUser(currentUser.id);

  // Initialisation du flux caméra & micro local
  const startLocalMedia = async () => {
    try {
      setMediaError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setLocalStream(stream);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      console.warn('Caméra/Micro refusé ou absent, essai audio seul:', err);
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioOnly);
        localStreamRef.current = audioOnly;
        setIsCamOn(false);
        return audioOnly;
      } catch (err2: any) {
        console.warn('Mode audio/vidéo simulé:', err2);
        setMediaError('Caméra/Micro non détectés ou bloqués par le navigateur.');
        setIsCamOn(false);
        setIsMicOn(true);
        return null;
      }
    }
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isJoined]);

  // Initialisation PeerJS WebRTC P2P
  useEffect(() => {
    if (!isJoined || typeof window === 'undefined') return;

    let peerInstance: any = null;
    let isDestroyed = false;

    const initPeer = async () => {
      try {
        const PeerModule = await import('peerjs');
        const Peer = PeerModule.default;

        peerInstance = new Peer(myPeerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
            ],
          },
        });

        peerRef.current = peerInstance;

        peerInstance.on('open', (id: string) => {
          console.log('[PeerJS] Connecté avec ID:', id);
        });

        peerInstance.on('call', (call: any) => {
          console.log('[PeerJS] Appel entrant de:', call.peer);
          activeCallsRef.current.set(call.peer, call);

          const currentStream = localStreamRef.current;
          call.answer(currentStream || undefined);

          call.on('stream', (remoteStream: MediaStream) => {
            console.log('[PeerJS] Flux distant reçu de:', call.peer);
            if (!isDestroyed) {
              setRemoteStreams((prev) => ({
                ...prev,
                [call.peer]: remoteStream,
              }));
            }
          });

          call.on('close', () => {
            activeCallsRef.current.delete(call.peer);
            setRemoteStreams((prev) => {
              const copy = { ...prev };
              delete copy[call.peer];
              return copy;
            });
          });

          call.on('error', (err: any) => {
            console.warn('[PeerJS] Erreur call:', err);
          });
        });

        peerInstance.on('error', (err: any) => {
          console.warn('[PeerJS] Erreur:', err.type, err.message);
        });
      } catch (err) {
        console.error('[PeerJS] Erreur init:', err);
      }
    };

    initPeer();

    return () => {
      isDestroyed = true;
      if (peerInstance) {
        peerInstance.destroy();
        peerRef.current = null;
      }
      activeCallsRef.current.clear();
      setRemoteStreams({});
    };
  }, [isJoined, myPeerId]);

  // Appeler les autres participants pour établir la vidéo et le son
  const connectToPeer = useCallback(
    (targetUserId: string) => {
      if (!peerRef.current || targetUserId === currentUser.id) return;
      const targetPeerId = getPeerIdForUser(targetUserId);

      if (activeCallsRef.current.has(targetPeerId) || remoteStreams[targetPeerId]) {
        return;
      }

      const stream = localStreamRef.current;
      console.log('[PeerJS] Appel du pair:', targetPeerId);
      try {
        const call = peerRef.current.call(targetPeerId, stream || undefined);
        if (!call) return;

        activeCallsRef.current.set(targetPeerId, call);

        call.on('stream', (remoteStream: MediaStream) => {
          console.log('[PeerJS] Flux distant reçu (call):', targetPeerId);
          setRemoteStreams((prev) => ({
            ...prev,
            [targetPeerId]: remoteStream,
          }));
        });

        call.on('close', () => {
          activeCallsRef.current.delete(targetPeerId);
          setRemoteStreams((prev) => {
            const copy = { ...prev };
            delete copy[targetPeerId];
            return copy;
          });
        });

        call.on('error', (err: any) => {
          console.warn('[PeerJS] Erreur call vers:', targetPeerId, err);
        });
      } catch (err) {
        console.warn('[PeerJS] Call impossible:', err);
      }
    },
    [currentUser.id, getPeerIdForUser, remoteStreams]
  );

  // Rejoindre la réunion avec saisie du prénom / nom
  const joinMeeting = async () => {
    const finalName = displayName.trim();
    if (!finalName) {
      setNameError(true);
      return;
    }
    setNameError(false);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`guest_name_${boardId}`, finalName);
    }

    await startLocalMedia();

    const initialParticipant: MeetParticipant = {
      id: currentUser.id,
      name: finalName,
      role: isHost ? 'host' : 'participant',
      hasVideo: isCamOn,
      hasAudio: isMicOn,
      canDraw: true,
      isMutedByHost: false,
      isVideoBlockedByHost: false,
    };

    setParticipants((prev) => {
      const map = new Map<string, MeetParticipant>();
      prev.forEach((p) => map.set(p.id, p));
      map.set(currentUser.id, initialParticipant);
      return Array.from(map.values());
    });

    try {
      const res = await fetch(`/api/boards/${boardId}/meet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'knock',
          userId: currentUser.id,
          userName: finalName,
          isHost,
          hasVideo: isCamOn,
          hasAudio: isMicOn,
        }),
      });

      const data = await res.json();
      if (data.status === 'approved') {
        setIsJoined(true);
        setIsInWaitingRoom(false);
        if (data.role === 'host') {
          setHostId(currentUser.id);
        }
      } else {
        setIsInWaitingRoom(true);
      }
    } catch {
      setIsJoined(true);
      setIsInWaitingRoom(false);
    }
  };

  // Polling régulier de l'état
  const pollMeetState = useCallback(async () => {
    if (!isOpen) return;

    try {
      const res = await fetch(`/api/boards/${boardId}/meet`);
      if (res.ok) {
        const data = await res.json();
        if (data.hostId) setHostId(data.hostId);
        setWaitingRoom(data.waitingRoom || []);

        const serverParticipants: MeetParticipant[] = data.participants || [];
        const currentInList = serverParticipants.find((p) => p.id === currentUser.id);

        if (isInWaitingRoom && currentInList) {
          setIsInWaitingRoom(false);
          setIsJoined(true);
        }

        // Restrictions de l'hôte
        if (currentInList) {
          if (currentInList.isMutedByHost && isMicOn) {
            setIsMicOn(false);
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
            }
          }

          if (currentInList.isVideoBlockedByHost && isCamOn) {
            setIsCamOn(false);
            if (localStreamRef.current) {
              localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
            }
          }

          if (onPermissionChange) {
            onPermissionChange({ canDraw: currentInList.canDraw });
          }
        }

        // Mise à jour participants
        setParticipants((prev) => {
          const map = new Map<string, MeetParticipant>();
          prev.forEach((p) => map.set(p.id, p));
          serverParticipants.forEach((p) => map.set(p.id, p));

          if (isJoined) {
            map.set(currentUser.id, {
              id: currentUser.id,
              name: displayName || currentUser.name,
              role: (hostId ? hostId === currentUser.id : currentUser.role === 'owner')
                ? 'host'
                : 'participant',
              hasVideo: isCamOn,
              hasAudio: isMicOn,
              canDraw: currentInList ? currentInList.canDraw : true,
              isMutedByHost: currentInList ? currentInList.isMutedByHost : false,
              isVideoBlockedByHost: currentInList ? currentInList.isVideoBlockedByHost : false,
            });
          }

          return Array.from(map.values());
        });

        // Appeler tout participant manquant en WebRTC
        if (isJoined && peerRef.current) {
          serverParticipants.forEach((p) => {
            if (p.id !== currentUser.id) {
              connectToPeer(p.id);
            }
          });
        }
      }

      // Heartbeat
      if (isJoined) {
        await fetch(`/api/boards/${boardId}/meet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            userId: currentUser.id,
            userName: displayName || currentUser.name,
            hasVideo: isCamOn,
            hasAudio: isMicOn,
          }),
        });
      }
    } catch (err) {
      console.error('Meet poll error:', err);
    }
  }, [
    boardId,
    currentUser.id,
    currentUser.name,
    displayName,
    hostId,
    isInWaitingRoom,
    isJoined,
    isCamOn,
    isMicOn,
    onPermissionChange,
    isOpen,
    connectToPeer,
  ]);

  useEffect(() => {
    if (isOpen) {
      pollMeetState();
      pollTimerRef.current = setInterval(pollMeetState, 2500);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, pollMeetState]);

  // Quitter le Meet
  const handleLeave = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    activeCallsRef.current.clear();
    setRemoteStreams({});

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

  // Toggles
  const toggleMic = () => {
    const nextState = !isMicOn;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = nextState;
      });
    }
    setIsMicOn(nextState);
  };

  const toggleCam = () => {
    const nextState = !isCamOn;
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = nextState;
      });
    }
    setIsCamOn(nextState);
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
        console.warn('Partage écran annulé:', err);
      }
    }
  };

  // Modération
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
    const updated = !p.isMutedByHost;
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-permission',
        targetUserId: p.id,
        isMutedByHost: updated,
      }),
    });
    setParticipants((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, isMutedByHost: updated } : item))
    );
    pollMeetState();
  };

  const handleToggleParticipantVideo = async (p: MeetParticipant) => {
    const updated = !p.isVideoBlockedByHost;
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-permission',
        targetUserId: p.id,
        isVideoBlockedByHost: updated,
      }),
    });
    setParticipants((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, isVideoBlockedByHost: updated } : item))
    );
    pollMeetState();
  };

  const handleToggleParticipantDraw = async (p: MeetParticipant) => {
    const updated = !p.canDraw;
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-permission',
        targetUserId: p.id,
        canDraw: updated,
      }),
    });
    setParticipants((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, canDraw: updated } : item))
    );
    pollMeetState();
  };

  const handleMuteAll = async () => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mute-all' }),
    });
    setParticipants((prev) =>
      prev.map((item) => (item.role !== 'host' ? { ...item, isMutedByHost: true } : item))
    );
    pollMeetState();
  };

  const handleKickUser = async (targetUserId: string) => {
    await fetch(`/api/boards/${boardId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'kick', targetUserId }),
    });
    setParticipants((prev) => prev.filter((item) => item.id !== targetUserId));
    pollMeetState();
  };

  const handleCopyMeetLink = () => {
    const url = `${window.location.origin}/board/${boardId}?meet=true`;
    navigator.clipboard.writeText(url);
    setHasCopiedLink(true);
    setTimeout(() => setHasCopiedLink(false), 2500);
  };

  if (!isOpen) return null;

  const activeCount = isJoined ? Math.max(1, participants.length) : 0;

  // 1. Écran de Pré-Rejoint : Saisie OBLIGATOIRE du prénom / nom par l'invité
  if (!isJoined && !isInWaitingRoom) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md animate-fade-in p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Radio size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Rejoindre la Réunion</h3>
                <p className="text-xs text-slate-400">Collaboration vidéo & voix en direct</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Saisie du prénom / nom */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <User size={14} className="text-indigo-400" />
              <span>Votre Prénom & Nom :</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (nameError) setNameError(false);
              }}
              placeholder="Ex: Yasser, Salim, Mehdi..."
              className={`w-full px-4 py-2.5 bg-slate-800/90 border rounded-xl text-white text-sm focus:outline-none transition-colors ${
                nameError
                  ? 'border-rose-500 ring-2 ring-rose-500/20'
                  : 'border-slate-700 focus:border-indigo-500'
              }`}
              autoFocus
            />
            {nameError && (
              <span className="text-[11px] text-rose-400 block">
                Veuillez entrer votre prénom ou nom avant d’entrer.
              </span>
            )}
          </div>

          {/* Aperçu vidéo avant d'entrer */}
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
                  {(displayName || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-xs">Caméra désactivée</span>
              </div>
            )}

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/80 shadow-lg">
              <button
                type="button"
                onClick={toggleMic}
                className={`p-2 rounded-full transition-colors ${
                  isMicOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-500 text-white'
                }`}
                title={isMicOn ? 'Couper micro' : 'Activer micro'}
              >
                {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button
                type="button"
                onClick={toggleCam}
                className={`p-2 rounded-full transition-colors ${
                  isCamOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-500 text-white'
                }`}
                title={isCamOn ? 'Couper caméra' : 'Activer caméra'}
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
              <span>{isHost ? 'Démarrer la réunion en tant qu’Hôte (Admin)' : 'Rejoindre la réunion'}</span>
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

  // 2. Écran Salle d'Attente
  if (isInWaitingRoom) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md animate-fade-in p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-5 shadow-2xl text-white">
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
            Participant : {displayName || currentUser.name}
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

  // 3. RÉUNION EN COURS : DESIGN FLOTTANT (Bulles Vidéo en haut à droite + Barre de contrôle en bas au-dessus de la barre d'outils)
  return (
    <>
      {/* Lecteurs Audio distants (Garantit le son sur iOS Safari et Mac Chrome) */}
      {Object.entries(remoteStreams).map(([peerKey, stream]) => (
        <audio
          key={`audio_${peerKey}`}
          ref={(audioEl) => {
            if (audioEl && audioEl.srcObject !== stream) {
              audioEl.srcObject = stream;
              audioEl.play().catch(() => {});
            }
          }}
          autoPlay
          playsInline
        />
      ))}

      {/* Demandes d'entrée en Salle d'Attente pour l'Hôte */}
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

      {/* Bulles Vidéo Flottantes en Haut à Droite (Style Miro / FigJam) */}
      <div
        className={`fixed z-40 transition-all duration-300 ${
          isMinimized
            ? 'bottom-28 right-6'
            : 'top-20 right-6 flex flex-col gap-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-1'
        }`}
      >
        {/* Bulle Vidéo Locale (Vous) */}
        <div
          className={`relative w-48 sm:w-56 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl group select-none transition-all ${
            isHost
              ? 'border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-amber-500/10'
              : 'border-2 border-indigo-500 ring-2 ring-indigo-500/20'
          }`}
        >
          {/* Badge Rôle en haut à gauche */}
          <div className="absolute top-2 left-2 z-10">
            {isHost ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-extrabold text-[10px] tracking-wide shadow-md">
                <ShieldCheck size={12} className="text-slate-950" />
                <span>ADMIN / HÔTE</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 font-medium text-[10px] border border-slate-700/80">
                <span>Invité</span>
              </span>
            )}
          </div>

          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${!isCamOn && 'hidden'}`}
          />
          {!isCamOn && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-200">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base text-white shadow-md ${
                  isHost ? 'bg-amber-600' : 'bg-indigo-600'
                }`}
              >
                {(displayName || currentUser.name).charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700/60">
            <span className="truncate max-w-[130px]">
              {displayName || currentUser.name} (Vous)
            </span>
            <div className="flex items-center gap-1.5">
              {!isMicOn ? (
                <VolumeX size={13} className="text-rose-400" />
              ) : (
                <Mic size={13} className="text-emerald-400" />
              )}
            </div>
          </div>
        </div>

        {/* Bulles Vidéo des Autres Participants (WebRTC Live Video & Audio) */}
        {!isMinimized &&
          participants
            .filter((p) => p.id !== currentUser.id)
            .map((p) => {
              const isParticipantHost = hostId ? p.id === hostId : p.role === 'host';
              const targetPeerId = getPeerIdForUser(p.id);
              const remoteStream = remoteStreams[targetPeerId] || remoteStreams[p.id];
              const hasVideoTrack =
                remoteStream &&
                remoteStream.getVideoTracks().length > 0 &&
                remoteStream.getVideoTracks().some((t) => t.enabled);

              return (
                <div
                  key={p.id}
                  className={`relative w-48 sm:w-56 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl select-none transition-all ${
                    isParticipantHost
                      ? 'border-2 border-amber-400 ring-2 ring-amber-400/30'
                      : p.isSpeaking
                      ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/30'
                      : 'border-2 border-slate-700/80'
                  }`}
                >
                  {/* Badge Rôle */}
                  <div className="absolute top-2 left-2 z-10">
                    {isParticipantHost ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-extrabold text-[10px] tracking-wide shadow-md">
                        <ShieldCheck size={12} className="text-slate-950" />
                        <span>ADMIN / HÔTE</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 font-medium text-[10px] border border-slate-700">
                        <span>Invité</span>
                      </span>
                    )}
                  </div>

                  {/* Vidéo Distante en direct */}
                  <video
                    ref={(videoEl) => {
                      if (videoEl && remoteStream && videoEl.srcObject !== remoteStream) {
                        videoEl.srcObject = remoteStream;
                        videoEl.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover ${
                      !p.hasVideo || p.isVideoBlockedByHost || !hasVideoTrack ? 'hidden' : ''
                    }`}
                  />

                  {/* Fallback si caméra éteinte ou flux en attente */}
                  {(!p.hasVideo || p.isVideoBlockedByHost || !hasVideoTrack) && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-300 gap-1">
                      <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center font-bold text-base text-white">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {p.isVideoBlockedByHost
                          ? 'Caméra bloquée'
                          : !p.hasVideo
                          ? 'Caméra coupée'
                          : remoteStream
                          ? 'Caméra inactive'
                          : 'Connexion…'}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700/60">
                    <span className="truncate max-w-[130px]">{p.name}</span>
                    <div className="flex items-center gap-1.5">
                      {p.isMutedByHost || !p.hasAudio ? (
                        <VolumeX size={13} className="text-rose-400" />
                      ) : (
                        <Mic size={13} className="text-emerald-400" />
                      )}
                      {!p.canDraw && (
                        <span title="Lecture seule">
                          <Eye size={13} className="text-amber-400" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Barre de Contrôle Flottante Inférieure (Positionnée à bottom-24 pour flotter AU-DESSUS de la barre d'outils du tableau blanc !) */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-3 text-white">
        {/* Badge Hôte si applicable */}
        {isHost && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <ShieldCheck size={14} className="text-amber-400" />
            <span>Hôte</span>
          </div>
        )}

        {/* Micro */}
        <button
          type="button"
          onClick={toggleMic}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 ${
            isMicOn
              ? 'bg-slate-800 hover:bg-slate-700 text-white'
              : 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
          }`}
          title={isMicOn ? 'Couper micro (M)' : 'Activer micro'}
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
          title={isCamOn ? 'Couper caméra (V)' : 'Activer caméra'}
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

        {/* Bouton Participants / Modération */}
        <button
          type="button"
          onClick={() => setShowHostPanel(!showHostPanel)}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold relative active:scale-95 ${
            showHostPanel ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Gérer les participants et permissions"
        >
          <Users size={18} />
          <span className="font-bold">{activeCount}</span>
          {waitingRoom.length > 0 && isHost && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
              {waitingRoom.length}
            </span>
          )}
        </button>

        {/* Inviter */}
        <button
          type="button"
          onClick={handleCopyMeetLink}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 active:scale-95"
          title="Copier le lien direct du Meet"
        >
          {hasCopiedLink ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
          <span className="hidden sm:inline">{hasCopiedLink ? 'Copié !' : 'Inviter'}</span>
        </button>

        {/* Quitter */}
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

      {/* Modal Participants & Modération Hôte (Positionnée à bottom-40 au-dessus de la barre de contrôle) */}
      {showHostPanel && (
        <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-5 text-white space-y-4 animate-scale-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-amber-400" />
              <div>
                <h3 className="font-bold text-sm text-white">Participants & Modération ({activeCount})</h3>
                <p className="text-[11px] text-slate-400">
                  {isHost ? 'Vous gérez cette réunion en tant qu’Hôte / Admin' : 'Vue de la session en direct'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHostPanel(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Actions globales de l'Hôte */}
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

          {/* Liste détaillée des participants */}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
            {participants.map((p) => {
              const isCurrent = p.id === currentUser.id;
              const isParticipantHost = hostId ? p.id === hostId : p.role === 'host';

              return (
                <div key={p.id} className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center border ${
                        isParticipantHost ? 'bg-amber-600 border-amber-400' : 'bg-slate-800 border-slate-700'
                      }`}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">{p.name}</span>
                        {isParticipantHost && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[9px] font-black uppercase">
                            <ShieldCheck size={10} />
                            Hôte / Admin
                          </span>
                        )}
                        {isCurrent && <span className="text-[10px] text-slate-400">(Vous)</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        {p.canDraw ? 'Peut dessiner & éditer' : 'Lecture seule'}
                      </span>
                    </div>
                  </div>

                  {/* Contrôles de modération par l'Hôte */}
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
                        title={p.isMutedByHost ? 'Débloquer micro' : 'Couper micro'}
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
                        title={p.isVideoBlockedByHost ? 'Débloquer vidéo' : 'Bloquer vidéo'}
                      >
                        {p.isVideoBlockedByHost ? <VideoOff size={14} /> : <Video size={14} />}
                      </button>

                      {/* Toggle Droit de dessin */}
                      <button
                        type="button"
                        onClick={() => handleToggleParticipantDraw(p)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          !p.canDraw
                            ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                        title={p.canDraw ? 'Passer en lecture seule' : 'Autoriser à dessiner'}
                      >
                        {p.canDraw ? <Edit3 size={14} /> : <Eye size={14} />}
                      </button>

                      {/* Expulser */}
                      <button
                        type="button"
                        onClick={() => handleKickUser(p.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors ml-1"
                        title="Expulser"
                      >
                        <UserX size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      {p.hasAudio && !p.isMutedByHost ? (
                        <Mic size={14} className="text-emerald-400" />
                      ) : (
                        <VolumeX size={14} className="text-rose-400" />
                      )}
                      {p.hasVideo && !p.isVideoBlockedByHost ? (
                        <Video size={14} className="text-indigo-400" />
                      ) : (
                        <VideoOff size={14} className="text-slate-500" />
                      )}
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
