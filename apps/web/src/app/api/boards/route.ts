import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers, cookies } from 'next/headers';

const DEMO_BOARDS = [
  {
    id: 'board-demo-1',
    title: 'Atelier Stratégie & Brainstorming',
    description: 'Tableau collaboratif principal avec sticky notes et connecteurs',
    isPublic: true,
    createdAt: new Date('2026-10-01T10:00:00.000Z').toISOString(),
    updatedAt: new Date().toISOString(),
    owner: { name: 'Utilisateur Démo', email: 'demo@whiteboard.local' },
  },
  {
    id: 'board-demo-2',
    title: 'Architecture Système & Mind Map',
    description: 'Diagramme technique avec arborescence et IA',
    isPublic: true,
    createdAt: new Date('2026-10-02T14:30:00.000Z').toISOString(),
    updatedAt: new Date().toISOString(),
    owner: { name: 'Utilisateur Démo', email: 'demo@whiteboard.local' },
  },
];

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    }).catch(() => null);

    const cookieStore = await cookies();
    const demoCookie = cookieStore.get('demo_session');
    const isDemo = demoCookie?.value === 'authenticated';

    if (!session?.user && !isDemo) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = session?.user?.id || 'demo-user-1';

    try {
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
        owned: ownedBoards.length > 0 ? ownedBoards : (isDemo ? DEMO_BOARDS : []),
        shared: memberBoards.map((m) => ({ ...m.board, userRole: m.role })),
      });
    } catch {
      // Fallback si la base de données n'est pas encore connectée
      return NextResponse.json({
        owned: DEMO_BOARDS,
        shared: [],
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    }).catch(() => null);

    const cookieStore = await cookies();
    const isDemo = cookieStore.get('demo_session')?.value === 'authenticated';

    if (!session?.user && !isDemo) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = session?.user?.id || 'demo-user-1';
    const body = await req.json().catch(() => ({}));
    const title = body.title?.trim() || 'Tableau sans titre';

    try {
      const board = await prisma.board.create({
        data: {
          title,
          ownerId: userId,
        },
      });

      return NextResponse.json({ board }, { status: 201 });
    } catch {
      const fallbackBoard = {
        id: `board-${Date.now().toString(36)}`,
        title,
        ownerId: userId,
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ board: fallbackBoard }, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

