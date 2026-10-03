import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const originalBoard = await prisma.board.findUnique({
      where: { id },
      include: {
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!originalBoard) {
      return NextResponse.json({ error: 'Tableau non trouvé' }, { status: 404 });
    }

    // Créer la copie
    const newBoard = await prisma.board.create({
      data: {
        title: `${originalBoard.title} (Copie)`,
        description: originalBoard.description,
        ownerId: session.user.id,
      },
    });

    // Si un snapshot existait, le dupliquer pour le nouveau tableau
    if (originalBoard.snapshots.length > 0) {
      await prisma.boardSnapshot.create({
        data: {
          boardId: newBoard.id,
          data: originalBoard.snapshots[0].data,
          schemaVersion: originalBoard.snapshots[0].schemaVersion,
        },
      });
    }

    return NextResponse.json({ board: newBoard }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
