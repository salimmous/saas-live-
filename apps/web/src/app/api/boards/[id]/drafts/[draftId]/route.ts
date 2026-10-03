import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  try {
    const { id: boardId, draftId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = session?.user?.id || req.headers.get('x-guest-id');
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    await prisma.brainstormDraft.deleteMany({
      where: {
        id: draftId,
        boardId,
        userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de supprimer le brouillon.' },
      { status: 500 }
    );
  }
}
