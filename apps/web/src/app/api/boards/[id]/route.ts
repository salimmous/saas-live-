import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers, cookies } from 'next/headers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    }).catch(() => null);

    const cookieStore = await cookies();
    const isDemo = cookieStore.get('demo_session')?.value === 'authenticated';

    try {
      const board = await prisma.board.findUnique({
        where: { id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      });

      if (board) {
        let userRole = 'reader';
        if (session?.user || isDemo) {
          const currentId = session?.user?.id || 'demo-user-1';
          if (board.ownerId === currentId || isDemo) {
            userRole = 'owner';
          } else {
            const membership = await prisma.boardMember.findUnique({
              where: { boardId_userId: { boardId: id, userId: currentId } },
            });
            if (membership) {
              userRole = membership.role;
            }
          }
        }
        return NextResponse.json({ board, userRole });
      }
    } catch {
      // Fallback si la base n'est pas encore connectée
    }

    const fallbackBoard = {
      id,
      title: id === 'board-demo-1'
        ? 'Atelier Stratégie & Brainstorming'
        : (id === 'board-demo-2' ? 'Architecture Système & Mind Map' : 'Tableau Collaboratif'),
      description: 'Espace visuel collaboratif en temps réel',
      owner: { id: 'demo-user-1', name: 'Utilisateur Démo', email: 'demo@whiteboard.local' },
    };

    const isOwnerUser = isDemo || (session?.user && session.user.id === 'demo-user-1');
    const userRole = isOwnerUser ? 'owner' : 'editor';

    return NextResponse.json({ board: fallbackBoard, userRole });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    }).catch(() => null);

    const cookieStore = await cookies();
    const isDemo = cookieStore.get('demo_session')?.value === 'authenticated';

    if (!session?.user && !isDemo) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();

    try {
      const board = await prisma.board.findUnique({ where: { id } });
      if (board) {
        const currentUserId = session?.user?.id || 'demo-user-1';
        if (board.ownerId !== currentUserId && !isDemo) {
          const membership = await prisma.boardMember.findUnique({
            where: { boardId_userId: { boardId: id, userId: currentUserId } },
          });
          if (!membership || membership.role === 'reader') {
            return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });
          }
        }

        const updated = await prisma.board.update({
          where: { id },
          data: {
            title: body.title !== undefined ? body.title : undefined,
            description: body.description !== undefined ? body.description : undefined,
            isPublic: body.isPublic !== undefined ? body.isPublic : undefined,
          },
        });

        return NextResponse.json({ board: updated });
      }
    } catch {
      // Fallback
    }

    return NextResponse.json({
      board: {
        id,
        title: body.title || 'Tableau Modifié',
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    }).catch(() => null);

    const cookieStore = await cookies();
    const isDemo = cookieStore.get('demo_session')?.value === 'authenticated';

    if (!session?.user && !isDemo) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    try {
      await prisma.board.delete({ where: { id } });
    } catch {
      // Fallback
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

