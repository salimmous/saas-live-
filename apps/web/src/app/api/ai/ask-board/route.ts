import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';
import { AskBoardRequestSchema } from '@whiteboard/shared';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const validated = AskBoardRequestSchema.parse(json);
    const elements = json.elements || [];

    const result = await aiService.askBoard({
      question: validated.question,
      elements,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
