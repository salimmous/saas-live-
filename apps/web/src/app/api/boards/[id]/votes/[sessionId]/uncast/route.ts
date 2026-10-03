import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: boardId, sessionId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const { elementId } = await req.json();
    const userId = session?.user?.id || req.headers.get('x-guest-id');

    if (!userId || !elementId) {
      return NextResponse.json({ error: 'Identifiant et élément requis.' }, { status: 400 });
    }

    const voteSession = await prisma.voteSession.findUnique({
      where: { id: sessionId },
    });

    if (!voteSession || voteSession.boardId !== boardId || voteSession.status !== 'active') {
      return NextResponse.json({ error: 'Session non active ou introuvable.' }, { status: 400 });
    }

    await prisma.vote.deleteMany({
      where: {
        sessionId,
        elementId,
        userId,
      },
    });

    const remainingVotes =
      voteSession.votesPerUser -
      (await prisma.vote.count({
        where: { sessionId, userId },
      }));

    return NextResponse.json({
      success: true,
      elementId,
      remainingVotes,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de retirer le vote.' },
      { status: 400 }
    );
  }
}
