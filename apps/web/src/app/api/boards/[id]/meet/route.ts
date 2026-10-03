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
  updatedAt: number;
}

// Sessions Meet actives en mémoire partagée
const activeMeets = new Map<string, MeetSession>();

function getOrCreateSession(boardId: string, hostId?: string, hostName?: string): MeetSession {
  let session = activeMeets.get(boardId);
  if (!session) {
    session = {
      boardId,
      hostId: hostId || 'host',
      hostName: hostName || 'Hôte',
      isActive: true,
      participants: new Map(),
      waitingRoom: new Map(),
      updatedAt: Date.now(),
    };
    activeMeets.set(boardId, session);
  }
  return session;
}

// Nettoyage des participants inactifs (> 30 secondes sans heartbeat)
function cleanupStaleParticipants(session: MeetSession) {
  const now = Date.now();
  for (const [id, p] of session.participants.entries()) {
    if (now - p.lastSeen > 35000) {
      session.participants.delete(id);
    }
  }
  for (const [id, w] of session.waitingRoom.entries()) {
    if (now - w.requestedAt > 120000) {
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

  if (isHost && !session.hostId) {
    session.hostId = userId;
    session.hostName = userName;
  }

  switch (action) {
    // 1. Demande d'accès (Knock / Salle d'attente)
    case 'knock': {
      if (isHost || session.hostId === userId || session.participants.size === 0) {
        session.participants.set(userId, {
          id: userId,
          name: userName,
          role: isHost || session.hostId === userId ? 'host' : 'participant',
          hasVideo: body.hasVideo ?? true,
          hasAudio: body.hasAudio ?? true,
          canDraw: true,
          isMutedByHost: false,
          isVideoBlockedByHost: false,
          lastSeen: Date.now(),
        });
        session.waitingRoom.delete(userId);
        session.updatedAt = Date.now();
        return NextResponse.json({ status: 'approved' });
      }

      if (session.participants.has(userId)) {
        return NextResponse.json({ status: 'approved' });
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

    // 7. Heartbeat & état média personnel (Micro/Caméra on/off)
    case 'heartbeat': {
      const participant = session.participants.get(userId);
      if (participant) {
        participant.lastSeen = Date.now();
        if (body.hasVideo !== undefined) participant.hasVideo = body.hasVideo;
        if (body.hasAudio !== undefined) participant.hasAudio = body.hasAudio;
        if (body.isSpeaking !== undefined) participant.isSpeaking = body.isSpeaking;
      }
      session.updatedAt = Date.now();
      return NextResponse.json({
        participant,
        waitingRoom: Array.from(session.waitingRoom.values()),
        participants: Array.from(session.participants.values()),
      });
    }

    // 8. Quitter le Meet
    case 'leave': {
      session.participants.delete(userId);
      session.waitingRoom.delete(userId);
      session.updatedAt = Date.now();
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  }
}
