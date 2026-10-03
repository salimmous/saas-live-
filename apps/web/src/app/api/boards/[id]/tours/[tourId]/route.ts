import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@whiteboard/shared';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tourId: string }> }
) {
  try {
    const { id: boardId, tourId } = await params;

    await prisma.recordedTour.deleteMany({
      where: {
        id: tourId,
        boardId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de supprimer la visite.' },
      { status: 500 }
    );
  }
}
