import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@whiteboard/shared';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, name } = body;

    if (!token || !name?.trim()) {
      return NextResponse.json(
        { error: 'Token et pseudonyme requis pour rejoindre' },
        { status: 400 }
      );
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const guestLink = await prisma.guestLink.findUnique({
      where: { tokenHash },
      include: {
        board: { select: { id: true, title: true } },
      },
    });

    if (!guestLink || guestLink.revokedAt) {
      return NextResponse.json(
        { error: 'Ce lien d’invitation est invalide ou a été révoqué.' },
        { status: 403 }
      );
    }

    if (guestLink.expiresAt && guestLink.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Ce lien d’invitation a expiré.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      boardId: guestLink.boardId,
      boardTitle: guestLink.board.title,
      role: guestLink.role,
      guestToken: `guest:${token}`,
      guestName: name.trim(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
