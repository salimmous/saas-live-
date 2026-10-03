import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;

    const rawSnapshots = await prisma.boardSnapshot.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        schemaVersion: true,
        createdAt: true,
      },
    });

    const updateCount = await prisma.boardUpdate.count({
      where: { boardId },
    });

    const snapshots = rawSnapshots.map((s) => ({
      id: s.id,
      version: s.schemaVersion,
      createdAt: s.createdAt,
      createdBy: 'Système',
    }));

    return NextResponse.json({
      snapshots,
      totalUpdates: updateCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de récupérer l’historique.' },
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

    // Récupérer le dernier snapshot
    const lastSnapshot = await prisma.boardSnapshot.findFirst({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
    });

    const nextVersion = (lastSnapshot?.schemaVersion || 0) + 1;

    const body = await req.json().catch(() => ({}));
    const snapshotBuffer = body.snapshotData
      ? Buffer.from(body.snapshotData, 'base64')
      : Buffer.from(JSON.stringify({ elements: body.elements || [] }));

    const created = await prisma.boardSnapshot.create({
      data: {
        boardId,
        schemaVersion: nextVersion,
        data: snapshotBuffer,
      },
      select: {
        id: true,
        schemaVersion: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      snapshot: {
        id: created.id,
        version: created.schemaVersion,
        createdAt: created.createdAt,
        createdBy: 'Système',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de créer le point d’historique.' },
      { status: 500 }
    );
  }
}
