import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';
import { GenerateDiagramRequestSchema } from '@whiteboard/shared';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const validated = GenerateDiagramRequestSchema.parse(json);

    const plan = await aiService.generateDiagram({
      prompt: validated.prompt,
      diagramType: validated.diagramType,
      boardId: validated.boardId,
    });

    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
