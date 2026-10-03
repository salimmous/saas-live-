import { NextRequest, NextResponse } from 'next/server';

interface MeetParticipant {
  id: string;
  name: string;
  role: 'host' | 'participant';
  hasVideo: boolean;
  hasAudio: boolean;
  canDraw: boolean;
  isMutedByHost: boolean;
  isVideoBlockedByHost: boolean;
  isSpeaking?: boolean;
  lastSeen: number;
}

interface WaitingUser {
  id: string;
  name: string;
  requestedAt: number;
}

interface MeetSession {
  boardId: string;
  hostId: string;
  hostName: string;
  isActive: boolean;
  participants: Map<string, MeetParticipant>;
  waitingRoom: Map<string, WaitingUser>;
  signals: Map<string, Array<{ from: string; signal: any }>>;
  updatedAt: number;
}

// Utilisation de globalThis pour conserver l'état entre les requêtes serverless
const globalAny: any = globalThis;
if (!globalAny.__activeMeets) {
  globalAny.__activeMeets = new Map<string, MeetSession>();
}
const activeMeets: Map<string, MeetSession> = globalAny.__activeMeets;

function getOrCreateSession(boardId: string, hostId?: string, hostName?: string): MeetSession {
  let session = activeMeets.get(boardId);
  if (!session) {
    session = {
      boardId,
      hostId: hostId || 'host',
      hostName: hostName || 'Hôte (Admin)',
      isActive: true,
      participants: new Map(),
      waitingRoom: new Map(),
      signals: new Map(),
      updatedAt: Date.now(),
    };
    activeMeets.set(boardId, session);
  }
  if (!session.signals) {
    session.signals = new Map();
  }
  if (hostId && (!session.hostId || session.hostId === 'host')) {
    session.hostId = hostId;
    session.hostName = hostName || 'Hôte (Admin)';
  }
  return session;
}

// Tolérance aux pannes réseau : 5 minutes avant suppression
function cleanupStaleParticipants(session: MeetSession) {
  const now = Date.now();
  for (const [id, p] of session.participants.entries()) {
    if (now - p.lastSeen > 300000) {
      session.participants.delete(id);
    }
  }
  for (const [id, w] of session.waitingRoom.entries()) {
    if (now - w.requestedAt > 300000) {
      session.waitingRoom.delete(id);
    }
  }
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id: boardId } = await context.params;
  const session = getOrCreateSession(boardId);
  cleanupStaleParticipants(session);

  const participants = Array.from(session.participants.values());
  const waitingRoom = Array.from(session.waitingRoom.values());

  return NextResponse.json({
    boardId,
    isActive: session.isActive,
    hostId: session.hostId,
    hostName: session.hostName,
    participants,
    waitingRoom,
    updatedAt: session.updatedAt,
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id: boardId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const { action, userId, userName, isHost } = body;

  const session = getOrCreateSession(boardId, isHost ? userId : undefined, isHost ? userName : undefined);
  cleanupStaleParticipants(session);

  switch (action) {
    // 1. Demande d'accès (Knock / Salle d'attente)
    case 'knock': {
      if (isHost || session.hostId === userId || session.participants.size === 0) {
        session.participants.set(userId, {
          id: userId,
          name: userName,
          role: 'host',
          hasVideo: body.hasVideo ?? true,
          hasAudio: body.hasAudio ?? true,
          canDraw: true,
          isMutedByHost: false,
          isVideoBlockedByHost: false,
          lastSeen: Date.now(),
        });
        session.hostId = userId;
        session.hostName = userName;
        session.waitingRoom.delete(userId);
        session.updatedAt = Date.now();
        return NextResponse.json({ status: 'approved', role: 'host' });
      }

      if (session.participants.has(userId)) {
        const p = session.participants.get(userId)!;
        p.lastSeen = Date.now();
        return NextResponse.json({ status: 'approved', role: p.role });
      }

      // Ajouter à la salle d'attente
      session.waitingRoom.set(userId, {
        id: userId,
        name: userName,
        requestedAt: Date.now(),
      });
      session.updatedAt = Date.now();
      return NextResponse.json({ status: 'waiting' });
    }

    // 2. L'hôte approuve un invité
    case 'approve': {
      const targetUserId = body.targetUserId;
      const waiting = session.waitingRoom.get(targetUserId);
      if (waiting) {
        session.waitingRoom.delete(targetUserId);
        session.participants.set(targetUserId, {
          id: targetUserId,
          name: waiting.name,
          role: 'participant',
          hasVideo: true,
          hasAudio: true,
          canDraw: true,
          isMutedByHost: false,
          isVideoBlockedByHost: false,
          lastSeen: Date.now(),
        });
        session.updatedAt = Date.now();
      }
      return NextResponse.json({ success: true });
    }

    // 3. L'hôte refuse un invité
    case 'reject': {
      const targetUserId = body.targetUserId;
      session.waitingRoom.delete(targetUserId);
      session.updatedAt = Date.now();
      return NextResponse.json({ success: true });
    }

    // 4. Mise à jour des permissions par l'hôte (micro, caméra, dessin)
    case 'update-permission': {
      const { targetUserId, canDraw, isMutedByHost, isVideoBlockedByHost } = body;
      const target = session.participants.get(targetUserId);
      if (target) {
        if (canDraw !== undefined) target.canDraw = canDraw;
        if (isMutedByHost !== undefined) target.isMutedByHost = isMutedByHost;
        if (isVideoBlockedByHost !== undefined) target.isVideoBlockedByHost = isVideoBlockedByHost;
        target.lastSeen = Date.now();
        session.updatedAt = Date.now();
      }
      return NextResponse.json({ success: true });
    }

    // 5. Mute all / Verrouillage global par l'hôte
    case 'mute-all': {
      for (const [id, p] of session.participants.entries()) {
        if (p.role !== 'host') {
          p.isMutedByHost = true;
        }
      }
      session.updatedAt = Date.now();
      return NextResponse.json({ success: true });
    }

    case 'lock-board': {
      const { locked } = body;
      for (const [id, p] of session.participants.entries()) {
        if (p.role !== 'host') {
          p.canDraw = !locked;
        }
      }
      session.updatedAt = Date.now();
      return NextResponse.json({ success: true });
    }

    // 6. Expulser un participant
    case 'kick': {
      const { targetUserId } = body;
      session.participants.delete(targetUserId);
      session.updatedAt = Date.now();
      return NextResponse.json({ success: true });
    }

    // 7. Heartbeat & état média personnel
    case 'heartbeat': {
      let participant = session.participants.get(userId);
      if (!participant) {
        participant = {
          id: userId,
          name: userName || 'Utilisateur',
          role: isHost || session.hostId === userId ? 'host' : 'participant',
          hasVideo: body.hasVideo ?? true,
          hasAudio: body.hasAudio ?? true,
          canDraw: true,
          isMutedByHost: false,
          isVideoBlockedByHost: false,
          lastSeen: Date.now(),
        };
        session.participants.set(userId, participant);
      } else {
        participant.lastSeen = Date.now();
        if (body.hasVideo !== undefined) participant.hasVideo = body.hasVideo;
        if (body.hasAudio !== undefined) participant.hasAudio = body.hasAudio;
        if (body.isSpeaking !== undefined) participant.isSpeaking = body.isSpeaking;
      }
      let pendingSignals: any[] = [];
      if (session.signals && userId) {
        pendingSignals = session.signals.get(userId) || [];
        session.signals.delete(userId);
      }

      session.updatedAt = Date.now();
      return NextResponse.json({
        participant,
        waitingRoom: Array.from(session.waitingRoom.values()),
        participants: Array.from(session.participants.values()),
        signals: pendingSignals,
      });
    }

    // 8. Quitter le Meet
    case 'leave': {
      session.participants.delete(userId);
      session.waitingRoom.delete(userId);
      if (session.signals) session.signals.delete(userId);
      session.updatedAt = Date.now();
      return NextResponse.json({ success: true });
    }

    // 9. WebRTC P2P Signaling (Offer, Answer, ICE candidate)
    case 'signal': {
      const { to, signal } = body;
      if (!session.signals) session.signals = new Map();
      const existing = session.signals.get(to) || [];
      existing.push({ from: userId, signal });
      session.signals.set(to, existing);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  }
}
