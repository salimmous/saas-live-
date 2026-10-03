import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { nanoid } from 'nanoid';

export async function GET(
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
      return NextResponse.json({ drafts: [] });
    }

    // Récupérer UNIQUEMENT les brouillons privés de l'utilisateur courant non révélés
    const drafts = await prisma.brainstormDraft.findMany({
      where: {
        boardId,
        userId,
        revealedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ drafts });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des brouillons.' },
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

    let userId = session?.user?.id;
    if (!userId) {
      const guestHeader = req.headers.get('x-guest-id');
      if (guestHeader) {
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
          { error: 'Authentification requise pour enregistrer un brouillon.' },
          { status: 401 }
        );
      }
    }

    const { content, color } = await req.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Contenu requis pour la note.' }, { status: 400 });
    }

    const newDraft = await prisma.brainstormDraft.create({
      data: {
        boardId,
        userId,
        elementData: {
          id: nanoid(),
          type: 'sticky',
          rotation: 0,
          content: content.trim(),
          style: {
            color: color || '#fef08a',
            fontSize: 14,
            textAlign: 'left',
          },
          width: 200,
          height: 140,
        },
      },
    });

    return NextResponse.json({ success: true, draft: newDraft });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création du brouillon.' },
      { status: 500 }
    );
  }
}
