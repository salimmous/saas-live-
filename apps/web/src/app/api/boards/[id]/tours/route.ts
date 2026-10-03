import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;

    const tours = await prisma.recordedTour.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ tours });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de récupérer les visites enregistrées.' },
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

    let creatorId = session?.user?.id;
    if (!creatorId) {
      const guestHeader = req.headers.get('x-guest-id');
      if (guestHeader) {
        const guest = await prisma.user.upsert({
          where: { id: guestHeader },
          update: {},
          create: {
            id: guestHeader,
            name: 'Guide Invité',
            email: `${guestHeader}@guest.local`,
          },
        });
        creatorId = guest.id;
      } else {
        return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
      }
    }

    const { title, duration, trajectoryData, audioKey } = await req.json();

    if (!trajectoryData || !Array.isArray(trajectoryData)) {
      return NextResponse.json(
        { error: 'Données de trajectoire (trajectoryData) requises.' },
        { status: 400 }
      );
    }

    const tour = await prisma.recordedTour.create({
      data: {
        boardId,
        title: title?.trim() || 'Visite commentée du tableau',
        duration: parseFloat(duration) || 0,
        trajectoryData,
        audioKey: audioKey || null,
        creatorId,
      },
    });

    return NextResponse.json({ success: true, tour });
  } catch (error: any) {
    console.error('Erreur enregistrement visite:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la sauvegarde de la visite guidée.' },
      { status: 500 }
    );
  }
}
