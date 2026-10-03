import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const links = await prisma.guestLink.findMany({
      where: {
        boardId: id,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ links });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
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

    const body = await req.json();
    const role = body.role === 'editor' ? 'editor' : 'reader';
    const name = body.name?.trim() || undefined;

    // Générer un token sécurisé aléatoire
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const guestLink = await prisma.guestLink.create({
      data: {
        boardId: id,
        tokenHash,
        role,
        name,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const joinUrl = `${appUrl}/join/${rawToken}`;

    return NextResponse.json(
      {
        link: {
          id: guestLink.id,
          role: guestLink.role,
          name: guestLink.name,
          createdAt: guestLink.createdAt,
          url: joinUrl,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
