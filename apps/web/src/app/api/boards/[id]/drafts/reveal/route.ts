import { NextRequest, NextResponse } from 'next/server';
import { prisma, BoardElement } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { nanoid } from 'nanoid';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id || req.headers.get('x-guest-id');
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { originX = 300, originY = 300 } = await req.json().catch(() => ({}));

    // Récupérer et révéler tous les brouillons en attente
    const drafts = await prisma.brainstormDraft.findMany({
      where: {
        boardId,
        userId,
        revealedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (drafts.length === 0) {
      return NextResponse.json({ elements: [] });
    }

    // Marquer comme révélés
    await prisma.brainstormDraft.updateMany({
      where: {
        boardId,
        userId,
        revealedAt: null,
      },
      data: {
        revealedAt: new Date(),
      },
    });

    // Transformer en éléments réels du tableau positionnés proprement
    const elements: BoardElement[] = drafts.map((draft, idx) => {
      const data = draft.elementData as any;
      const col = idx % 4;
      const row = Math.floor(idx / 4);

      return {
        id: data.id || nanoid(),
        type: 'sticky',
        x: originX + col * 230,
        y: originY + row * 160,
        width: data.width || 200,
        height: data.height || 140,
        rotation: 0,
        zIndex: 20 + idx,
        content: data.content || '',
        style: data.style || { color: '#fef08a', fontSize: 14, textAlign: 'left' },
        meta: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: userId,
        },
      };
    });

    return NextResponse.json({
      success: true,
      revealedCount: elements.length,
      elements,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la révélation des brouillons.' },
      { status: 500 }
    );
  }
}
