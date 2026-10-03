import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id || req.headers.get('x-guest-id') || 'guest';

    const sessions = await prisma.voteSession.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      include: {
        votes: true,
      },
    });

    const sanitizedSessions = sessions.map((s) => {
      const isClosed = s.status === 'closed';
      const myVotes = s.votes.filter((v) => v.userId === userId).map((v) => v.elementId);

      if (!isClosed) {
        // En session active : le décompte reste STRICTEMENT SECRET
        return {
          id: s.id,
          title: s.title,
          votesPerUser: s.votesPerUser,
          status: s.status,
          createdAt: s.createdAt,
          closedAt: s.closedAt,
          myVotes,
          remainingVotes: Math.max(0, s.votesPerUser - myVotes.length),
          totalVotesCast: s.votes.length,
          results: null, // Masqué jusqu'à clôture
        };
      }

      // En session fermée : calcul du classement et décompte public
      const countMap: Record<string, number> = {};
      s.votes.forEach((v) => {
        countMap[v.elementId] = (countMap[v.elementId] || 0) + 1;
      });

      const results = Object.entries(countMap)
        .map(([elementId, count]) => ({ elementId, count }))
        .sort((a, b) => b.count - a.count);

      return {
        id: s.id,
        title: s.title,
        votesPerUser: s.votesPerUser,
        status: s.status,
        createdAt: s.createdAt,
        closedAt: s.closedAt,
        myVotes,
        remainingVotes: 0,
        totalVotesCast: s.votes.length,
        results,
      };
    });

    return NextResponse.json({ sessions: sanitizedSessions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des sessions de vote.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const body = await req.json();
    const title = body.title?.trim() || 'Session de vote';
    const votesPerUser = Math.min(Math.max(parseInt(body.votesPerUser, 10) || 3, 1), 10);

    // Clôturer toute session active précédente sur ce tableau
    await prisma.voteSession.updateMany({
      where: { boardId, status: 'active' },
      data: { status: 'closed', closedAt: new Date() },
    });

    const newSession = await prisma.voteSession.create({
      data: {
        boardId,
        title,
        votesPerUser,
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      session: {
        ...newSession,
        myVotes: [],
        remainingVotes: votesPerUser,
        results: null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création de la session de vote.' },
      { status: 500 }
    );
  }
}
