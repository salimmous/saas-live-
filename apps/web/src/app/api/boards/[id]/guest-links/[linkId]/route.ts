import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

interface RouteContext {
  params: Promise<{ id: string; linkId: string }>;
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id, linkId } = await context.params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Révoquer le lien en base
    const link = await prisma.guestLink.update({
      where: { id: linkId },
      data: { revokedAt: new Date() },
    });

    // Notifier immédiatement le serveur Hocuspocus pour couper les connexions actives
    const syncUrl = process.env.SYNC_URL || 'http://localhost:1234';
    try {
      const httpSyncUrl = syncUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
      await fetch(`${httpSyncUrl}/api/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: id }),
      });
    } catch (e) {
      console.warn('Notification de révocation au serveur sync non distribuée:', e);
    }

    return NextResponse.json({ success: true, revokedId: link.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
