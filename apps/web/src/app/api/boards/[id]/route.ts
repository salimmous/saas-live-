import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!board) {
      return NextResponse.json({ error: 'Tableau non trouvé' }, { status: 404 });
    }

    let userRole = 'reader';
    if (session?.user) {
      if (board.ownerId === session.user.id) {
        userRole = 'owner';
      } else {
        const membership = await prisma.boardMember.findUnique({
          where: { boardId_userId: { boardId: id, userId: session.user.id } },
        });
        if (membership) {
          userRole = membership.role;
        }
      }
    }

    return NextResponse.json({ board, userRole });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const board = await prisma.board.findUnique({ where: { id } });
    if (!board) {
      return NextResponse.json({ error: 'Tableau non trouvé' }, { status: 404 });
    }

    // Vérifier les droits d'édition
    if (board.ownerId !== session.user.id) {
      const membership = await prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId: id, userId: session.user.id } },
      });
      if (!membership || membership.role === 'reader') {
        return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });
      }
    }

    const body = await req.json();
    const updated = await prisma.board.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        description: body.description !== undefined ? body.description : undefined,
        isPublic: body.isPublic !== undefined ? body.isPublic : undefined,
      },
    });

    return NextResponse.json({ board: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const board = await prisma.board.findUnique({ where: { id } });
    if (!board) {
      return NextResponse.json({ error: 'Tableau non trouvé' }, { status: 404 });
    }

    // Seul le propriétaire peut supprimer le tableau
    if (board.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Seul le propriétaire peut supprimer ce tableau' }, { status: 403 });
    }

    await prisma.board.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
