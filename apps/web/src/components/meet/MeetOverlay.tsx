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
  ChevronRight,
  Minus,
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
  // Détection Hôte (Propriétaire du tableau ou créateur de session)
  const [hostId, setHostId] = useState<string>('');
  const isHost = currentUser.role === 'owner' || (hostId ? hostId === currentUser.id : false);

  // Médias locaux
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Flux distants WebRTC
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  // États de session
  const [isJoined, setIsJoined] = useState(false);
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [participants, setParticipants] = useState<MeetParticipant[]>([]);
  const [waitingRoom, setWaitingRoom] = useState<WaitingUser[]>([]);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Références
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pollTimerRef = useRef<any>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Configuration WebRTC STUN
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  // Envoi de signal WebRTC (BroadcastChannel + API server)
  const sendWebRtcSignal = useCallback(
    (to: string, signal: any) => {
      // 1. Instantanéité locale (entre onglets du même navigateur)
      bcRef.current?.postMessage({
        type: 'WEBRTC_SIGNAL',
        from: currentUser.id,
        to,
        signal,
      });

      // 2. Multi-appareils via API serveur
      fetch(`/api/boards/${boardId}/meet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signal',
          userId: currentUser.id,
          to,
          signal,
        }),
      }).catch(() => {});
    },
    [boardId, currentUser.id]
  );

  // Création / Récupération d'une connexion Peer WebRTC
  const getOrCreatePeerConnection = useCallback(
    (peerId: string) => {
      if (pcsRef.current.has(peerId)) {
        return pcsRef.current.get(peerId)!;
      }

      const pc = new RTCPeerConnection(rtcConfig);

      // Ajouter les flux locaux
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      // Réception du flux vidéo / audio distant
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStreams((prev) => ({
            ...prev,
            [peerId]: event.streams[0],
          }));
        }
      };

      // Échange des candidats ICE
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebRtcSignal(peerId, { candidate: event.candidate });
        }
      };

      pcsRef.current.set(peerId, pc);
      return pc;
    },
    [localStream, sendWebRtcSignal]
  );

  // Mise à jour des tracks sur les PeerConnections si le flux local change
  useEffect(() => {
    if (!localStream) return;
    pcsRef.current.forEach((pc) => {
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          pc.addTrack(track, localStream);
        }
      });
    });
  }, [localStream]);

  // Initialisation du flux caméra & micro
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
      console.warn('Accès caméra/micro standard refusé, essai audio:', err);
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioOnly);
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

  // Gestion des signaux WebRTC entrants
  const handleIncomingSignal = useCallback(
    async (from: string, signal: any) => {
      if (from === currentUser.id) return;
      const pc = getOrCreatePeerConnection(from);

      if (signal.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendWebRtcSignal(from, { answer });
      } else if (signal.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn('Erreur ICE:', e);
        }
      }
    },
    [currentUser.id, getOrCreatePeerConnection, sendWebRtcSignal]
  );

  // Canal BroadcastChannel (Signaling + État)
  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;

    try {
      const channel = new BroadcastChannel(`wb_meet_bc_${boardId}`);
      bcRef.current = channel;

      channel.onmessage = async (event) => {
        const msg = event.data;
        if (!msg) return;

        // Signal WebRTC entrant
        if (msg.type === 'WEBRTC_SIGNAL' && msg.to === currentUser.id) {
          handleIncomingSignal(msg.from, msg.signal);
          return;
        }

        // Nouveau pair qui a rejoint : l'ancien pair initie l'Offre WebRTC
        if (msg.type === 'PEER_JOINED' && msg.peerId !== currentUser.id) {
          const pc = getOrCreatePeerConnection(msg.peerId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendWebRtcSignal(msg.peerId, { offer });
          } catch (e) {
            console.error('Erreur createOffer:', e);
          }
        }

        // Synchronisation des participants
        if (msg.type === 'SYNC_PARTICIPANT' && msg.participant) {
          setParticipants((prev) => {
            const map = new Map<string, MeetParticipant>();
            prev.forEach((p) => map.set(p.id, p));
            map.set(msg.participant.id, msg.participant);
            return Array.from(map.values());
          });
        } else if (msg.type === 'REMOVE_PARTICIPANT' && msg.userId) {
          setParticipants((prev) => prev.filter((p) => p.id !== msg.userId));
          const pc = pcsRef.current.get(msg.userId);
          if (pc) {
            pc.close();
            pcsRef.current.delete(msg.userId);
          }
          setRemoteStreams((prev) => {
            const copy = { ...prev };
            delete copy[msg.userId];
            return copy;
          });
        }
      };

      // Annoncer la présence
      if (isJoined) {
        channel.postMessage({ type: 'PEER_JOINED', peerId: currentUser.id });
      }

      return () => {
        channel.close();
        bcRef.current = null;
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }, [boardId, isOpen, isJoined, currentUser.id, getOrCreatePeerConnection, handleIncomingSignal, sendWebRtcSignal]);

  // Rejoindre la réunion
  const joinMeeting = async () => {
    const stream = await startLocalMedia();

    const localP: MeetParticipant = {
      id: currentUser.id,
      name: currentUser.name,
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
      map.set(currentUser.id, localP);
      return Array.from(map.values());
    });

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
        if (data.role === 'host') setHostId(currentUser.id);
        bcRef.current?.postMessage({ type: 'PEER_JOINED', peerId: currentUser.id });
        bcRef.current?.postMessage({ type: 'SYNC_PARTICIPANT', participant: localP });
      } else {
        setIsInWaitingRoom(true);
      }
    } catch {
      setIsJoined(true);
      setIsInWaitingRoom(false);
      bcRef.current?.postMessage({ type: 'PEER_JOINED', peerId: currentUser.id });
      bcRef.current?.postMessage({ type: 'SYNC_PARTICIPANT', participant: localP });
    }
  };

  // Polling du serveur (participants + signaux WebRTC distants)
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

        // Fusion sans écrasement
        setParticipants((prev) => {
          const map = new Map<string, MeetParticipant>();
          prev.forEach((p) => map.set(p.id, p));
          serverParticipants.forEach((p) => map.set(p.id, p));

          if (isJoined) {
            map.set(currentUser.id, {
              id: currentUser.id,
              name: currentUser.name,
              role: isHost ? 'host' : 'participant',
              hasVideo: isCamOn,
              hasAudio: isMicOn,
              canDraw: currentInList ? currentInList.canDraw : true,
              isMutedByHost: currentInList ? currentInList.isMutedByHost : false,
              isVideoBlockedByHost: currentInList ? currentInList.isVideoBlockedByHost : false,
            });
          }

          return Array.from(map.values());
        });
      }

      // Heartbeat + signaux
      if (isJoined) {
        const heartbeatRes = await fetch(`/api/boards/${boardId}/meet`, {
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

        if (heartbeatRes.ok) {
          const hbData = await heartbeatRes.json();
          if (Array.isArray(hbData.signals)) {
            for (const sig of hbData.signals) {
              handleIncomingSignal(sig.from, sig.signal);
            }
          }
        }
      }
    } catch (err) {
      console.error('Meet poll error:', err);
    }
  }, [boardId, currentUser.id, currentUser.name, isInWaitingRoom, isJoined, isCamOn, isMicOn, isHost, localStream, onPermissionChange, isOpen, handleIncomingSignal]);

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
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    setRemoteStreams({});

    bcRef.current?.postMessage({ type: 'REMOVE_PARTICIPANT', userId: currentUser.id });

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
    const nextState = !isMicOn;
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = nextState;
      });
    }
    setIsMicOn(nextState);

    bcRef.current?.postMessage({
      type: 'SYNC_PARTICIPANT',
      participant: {
        id: currentUser.id,
        name: currentUser.name,
        role: isHost ? 'host' : 'participant',
        hasVideo: isCamOn,
        hasAudio: nextState,
        canDraw: true,
        isMutedByHost: false,
        isVideoBlockedByHost: false,
      },
    });
  };

  const toggleCam = () => {
    const nextState = !isCamOn;
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = nextState;
      });
    }
    setIsCamOn(nextState);

    bcRef.current?.postMessage({
      type: 'SYNC_PARTICIPANT',
      participant: {
        id: currentUser.id,
        name: currentUser.name,
        role: isHost ? 'host' : 'participant',
        hasVideo: nextState,
        hasAudio: isMicOn,
        canDraw: true,
        isMutedByHost: false,
        isVideoBlockedByHost: false,
      },
    });
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

  // Actions de l'Hôte
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
    bcRef.current?.postMessage({ type: 'REMOVE_PARTICIPANT', userId: targetUserId });
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

  // 1. Écran de Pré-Rejoint (Modal centré pour vérifier caméra et micro)
  if (!isJoined && !isInWaitingRoom) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-fade-in p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Radio size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Rejoindre la Réunion</h3>
                <p className="text-xs text-slate-400">Collaboration vidéo & audio en direct</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
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
                  {currentUser.name.charAt(0).toUpperCase()}
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

  // 2. Écran Salle d'Attente pour les invités non encore autorisés
  if (isInWaitingRoom) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md animate-fade-in p-4">
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

  // 3. Bouton Flottant quand la Sidebar est Réduite (Minimized)
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed top-20 right-6 z-40 bg-slate-900/95 border border-indigo-500/50 hover:border-indigo-400 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer backdrop-blur-md transition-all hover:scale-102 active:scale-95 group"
      >
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <div className="text-xs font-bold">
          Meet en direct ({activeCount})
        </div>
        <ChevronRight size={16} className="text-slate-400 group-hover:text-white transition-transform" />
      </div>
    );
  }

  // 4. RÉUNION EN COURS : SIDEBAR COMPLÈTE À DROITE (Zéro collision avec la barre d'outils du tableau blanc !)
  return (
    <aside className="fixed top-0 right-0 bottom-0 w-80 sm:w-88 bg-slate-900/98 backdrop-blur-2xl border-l border-slate-800 z-50 flex flex-col text-white shadow-2xl animate-slide-in">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              <span>Meet en direct</span>
              <span className="text-[11px] font-semibold text-slate-400">({activeCount})</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Réduire la barre latérale"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={handleLeave}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition-colors"
            title="Quitter la réunion"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Alertes Salle d'Attente ("Knock") pour l'Hôte */}
      {isHost && waitingRoom.length > 0 && (
        <div className="p-3 bg-indigo-950/60 border-b border-indigo-500/40 space-y-2">
          <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs uppercase tracking-wider">
            <Sparkles size={14} />
            <span>Demande d’accès ({waitingRoom.length})</span>
          </div>
          <div className="space-y-1.5">
            {waitingRoom.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between bg-slate-900/90 px-3 py-2 rounded-xl border border-indigo-500/30 text-xs"
              >
                <span className="font-semibold text-white truncate max-w-[120px]">{w.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleApproveUser(w.id)}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                    title="Autoriser"
                  >
                    <UserCheck size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectUser(w.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded-md transition-colors"
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

      {/* Grille des Flux Vidéo (Vous + Autres participants avec WebRTC) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {/* Tuile Vidéo Locale (Vous) */}
        <div
          className={`relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-md select-none ${
            isHost
              ? 'border-2 border-amber-400 ring-2 ring-amber-400/30'
              : 'border-2 border-indigo-500/80 ring-2 ring-indigo-500/20'
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
                <span>Participant</span>
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
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-300 gap-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md ${
                  isHost ? 'bg-amber-600' : 'bg-indigo-600'
                }`}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-slate-400">Caméra désactivée</span>
            </div>
          )}

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700/60">
            <span className="truncate max-w-[140px]">{currentUser.name} (Vous)</span>
            <div className="flex items-center gap-1">
              {!isMicOn ? (
                <VolumeX size={13} className="text-rose-400" />
              ) : (
                <Mic size={13} className="text-emerald-400" />
              )}
            </div>
          </div>
        </div>

        {/* Tuiles Vidéo Distantes (WebRTC Live Stream) */}
        {participants
          .filter((p) => p.id !== currentUser.id)
          .map((p) => {
            const isParticipantHost = p.role === 'host' || (hostId ? p.id === hostId : false);
            const hasRemoteStream = !!remoteStreams[p.id];

            return (
              <div
                key={p.id}
                className={`relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-md select-none ${
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

                {/* Flux Vidéo Réel WebRTC */}
                <video
                  ref={(videoEl) => {
                    if (videoEl && remoteStreams[p.id]) {
                      if (videoEl.srcObject !== remoteStreams[p.id]) {
                        videoEl.srcObject = remoteStreams[p.id];
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${
                    !p.hasVideo || p.isVideoBlockedByHost || !hasRemoteStream ? 'hidden' : ''
                  }`}
                />

                {/* Fallback si caméra éteinte ou flux en attente */}
                {(!p.hasVideo || p.isVideoBlockedByHost || !hasRemoteStream) && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-300 gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center font-bold text-lg text-white">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {p.isVideoBlockedByHost
                        ? 'Caméra bloquée par l’hôte'
                        : !p.hasVideo
                        ? 'Caméra coupée'
                        : 'Connexion vidéo…'}
                    </span>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700/60">
                  <span className="truncate max-w-[140px]">{p.name}</span>
                  <div className="flex items-center gap-1.5">
                    {p.isMutedByHost || !p.hasAudio ? (
                      <VolumeX size={13} className="text-rose-400" />
                    ) : (
                      <Mic size={13} className="text-emerald-400" />
                    )}
                    {!p.canDraw && (
                      <span title="Lecture seule (Dessin désactivé)">
                        <Eye size={13} className="text-amber-400" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Barre de Contrôles Média (Ancrée dans la Sidebar — Jamais sur le tableau blanc !) */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 space-y-2.5">
        <div className="grid grid-cols-4 gap-2">
          {/* Micro */}
          <button
            type="button"
            onClick={toggleMic}
            className={`p-2.5 rounded-xl transition-all flex flex-col items-center justify-center gap-1 text-[11px] font-semibold active:scale-95 ${
              isMicOn
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
            }`}
            title={isMicOn ? 'Couper le micro' : 'Activer le micro'}
          >
            {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
            <span>{isMicOn ? 'Micro' : 'Muet'}</span>
          </button>

          {/* Caméra */}
          <button
            type="button"
            onClick={toggleCam}
            className={`p-2.5 rounded-xl transition-all flex flex-col items-center justify-center gap-1 text-[11px] font-semibold active:scale-95 ${
              isCamOn
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
            }`}
            title={isCamOn ? 'Couper la caméra' : 'Activer la caméra'}
          >
            {isCamOn ? <Video size={18} /> : <VideoOff size={18} />}
            <span>{isCamOn ? 'Caméra' : 'Off'}</span>
          </button>

          {/* Partage d'écran */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-2.5 rounded-xl transition-all flex flex-col items-center justify-center gap-1 text-[11px] font-semibold active:scale-95 ${
              isScreenSharing ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Partager l'écran"
          >
            <MonitorUp size={18} />
            <span>Écran</span>
          </button>

          {/* Inviter */}
          <button
            type="button"
            onClick={handleCopyMeetLink}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex flex-col items-center justify-center gap-1 text-[11px] font-semibold active:scale-95"
            title="Copier le lien d'invitation Meet"
          >
            {hasCopiedLink ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
            <span>{hasCopiedLink ? 'Copié' : 'Inviter'}</span>
          </button>
        </div>

        {/* Bouton Quitter */}
        <button
          type="button"
          onClick={handleLeave}
          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <PhoneOff size={16} />
          <span>Quitter la réunion</span>
        </button>
      </div>

      {/* Section Modération & Liste des Participants (Directement dans la Sidebar !) */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2 max-h-52 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Users size={14} className="text-indigo-400" />
            <span>Participants ({activeCount})</span>
          </div>

          {isHost && (
            <button
              type="button"
              onClick={handleMuteAll}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 hover:underline"
              title="Couper tous les micros"
            >
              <VolumeX size={12} />
              <span>Tout muet</span>
            </button>
          )}
        </div>

        {/* Liste détaillée */}
        <div className="space-y-1.5 divide-y divide-slate-800/60">
          {participants.map((p) => {
            const isCurrent = p.id === currentUser.id;
            const isParticipantHost = p.role === 'host' || (hostId ? p.id === hostId : false);

            return (
              <div key={p.id} className="pt-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full text-white font-bold text-[10px] flex items-center justify-center ${
                      isParticipantHost ? 'bg-amber-600' : 'bg-slate-700'
                    }`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-white max-w-[100px] truncate">{p.name}</span>
                      {isParticipantHost && (
                        <span className="text-[9px] font-bold text-amber-400">Hôte</span>
                      )}
                      {isCurrent && <span className="text-[9px] text-slate-400">(Vous)</span>}
                    </div>
                  </div>
                </div>

                {/* Contrôles de modération Hôte */}
                {isHost && !isCurrent ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleParticipantMic(p)}
                      className={`p-1 rounded-md transition-colors ${
                        p.isMutedByHost ? 'text-rose-400 bg-rose-500/20' : 'text-slate-400 hover:text-white'
                      }`}
                      title={p.isMutedByHost ? 'Débloquer micro' : 'Couper micro'}
                    >
                      {p.isMutedByHost ? <VolumeX size={13} /> : <Mic size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleParticipantVideo(p)}
                      className={`p-1 rounded-md transition-colors ${
                        p.isVideoBlockedByHost ? 'text-rose-400 bg-rose-500/20' : 'text-slate-400 hover:text-white'
                      }`}
                      title={p.isVideoBlockedByHost ? 'Débloquer vidéo' : 'Bloquer vidéo'}
                    >
                      {p.isVideoBlockedByHost ? <VideoOff size={13} /> : <Video size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleParticipantDraw(p)}
                      className={`p-1 rounded-md transition-colors ${
                        !p.canDraw ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-white'
                      }`}
                      title={p.canDraw ? 'Passer en lecture seule' : 'Autoriser à dessiner'}
                    >
                      {p.canDraw ? <Edit3 size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKickUser(p.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Expulser"
                    >
                      <UserX size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-400">
                    {p.hasAudio && !p.isMutedByHost ? (
                      <Mic size={13} className="text-emerald-400" />
                    ) : (
                      <VolumeX size={13} className="text-rose-400" />
                    )}
                    {p.hasVideo && !p.isVideoBlockedByHost ? (
                      <Video size={13} className="text-indigo-400" />
                    ) : (
                      <VideoOff size={13} className="text-slate-500" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
