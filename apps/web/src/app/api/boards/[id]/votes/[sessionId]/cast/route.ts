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
    if (!elementId) {
      return NextResponse.json({ error: 'elementId requis pour voter.' }, { status: 400 });
    }

    // Récupérer userId ou guestId
    let userId = session?.user?.id;
    if (!userId) {
      const guestHeader = req.headers.get('x-guest-id');
      if (guestHeader) {
        // Pour les invités, s'assurer qu'un utilisateur invité existe en base
        const guestUser = await prisma.user.upsert({
          where: { id: guestHeader },
          update: {},
          create: {
            id: guestHeader,
            name: 'Invité',
            email: `${guestHeader}@guest.local`,
          },
        });
        userId = guestUser.id;
      } else {
        return NextResponse.json(
          { error: 'Authentification requise pour enregistrer un vote.' },
          { status: 401 }
        );
      }
    }

    // Transaction atomique pour vérifier le plafond de votes par utilisateur
    const result = await prisma.$transaction(async (tx) => {
      const voteSession = await tx.voteSession.findUnique({
        where: { id: sessionId },
      });

      if (!voteSession || voteSession.boardId !== boardId) {
        throw new Error('Session de vote introuvable.');
      }

      if (voteSession.status !== 'active') {
        throw new Error('Cette session de vote est clôturée.');
      }

      const existingVotes = await tx.vote.count({
        where: {
          sessionId,
          userId,
        },
      });

      if (existingVotes >= voteSession.votesPerUser) {
        throw new Error(
          `Vous avez atteint votre limite de ${voteSession.votesPerUser} vote(s) pour cette session.`
        );
      }

      // Enregistrer le vote
      const vote = await tx.vote.create({
        data: {
          sessionId,
          elementId,
          userId,
        },
      });

      return {
        vote,
        remainingVotes: voteSession.votesPerUser - existingVotes - 1,
      };
    });

    return NextResponse.json({
      success: true,
      elementId,
      remainingVotes: result.remainingVotes,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible d’enregistrer le vote.' },
      { status: 400 }
    );
  }
}
