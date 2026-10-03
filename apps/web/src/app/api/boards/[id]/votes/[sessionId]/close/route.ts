import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: boardId, sessionId } = await params;

    const voteSession = await prisma.voteSession.findUnique({
      where: { id: sessionId },
      include: { votes: true },
    });

    if (!voteSession || voteSession.boardId !== boardId) {
      return NextResponse.json({ error: 'Session introuvable.' }, { status: 404 });
    }

    const updated = await prisma.voteSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

    // Calculer les résultats définitifs
    const countMap: Record<string, number> = {};
    voteSession.votes.forEach((v) => {
      countMap[v.elementId] = (countMap[v.elementId] || 0) + 1;
    });

    const results = Object.entries(countMap)
      .map(([elementId, count]) => ({ elementId, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      session: {
        ...updated,
        results,
        totalVotesCast: voteSession.votes.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de clôturer la session.' },
      { status: 500 }
    );
  }
}
