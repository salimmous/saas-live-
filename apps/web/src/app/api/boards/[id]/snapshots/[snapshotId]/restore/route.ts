import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const { id: boardId, snapshotId } = await params;

    const snapshot = await prisma.boardSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot || snapshot.boardId !== boardId) {
      return NextResponse.json({ error: 'Point d’historique introuvable.' }, { status: 404 });
    }

    // Tenter de parser les données restaurées (soit binaire Yjs, soit JSON)
    let restoredElements: any[] = [];
    try {
      const dataBuffer = Buffer.from(snapshot.data);
      const parsed = JSON.parse(dataBuffer.toString('utf-8'));
      restoredElements = parsed.elements || [];
    } catch {
      // Données binaires Yjs pures
      restoredElements = [];
    }

    return NextResponse.json({
      success: true,
      version: snapshot.schemaVersion,
      createdAt: snapshot.createdAt,
      elements: restoredElements,
      message: `Version ${snapshot.schemaVersion} restaurée avec succès.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de restaurer cette version.' },
      { status: 500 }
    );
  }
}
