import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = session.user.id;

    // Récupérer les tableaux possédés et ceux dont l'utilisateur est membre
    const ownedBoards = await prisma.board.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: { select: { name: true, email: true } },
      },
    });

    const memberBoards = await prisma.boardMember.findMany({
      where: { userId },
      include: {
        board: {
          include: {
            owner: { select: { name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({
      owned: ownedBoards,
      shared: memberBoards.map((m) => ({ ...m.board, userRole: m.role })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title?.trim() || 'Tableau sans titre';

    const board = await prisma.board.create({
      data: {
        title,
        ownerId: session.user.id,
      },
    });

    return NextResponse.json({ board }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
