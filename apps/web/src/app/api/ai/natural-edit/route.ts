import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';
import { NaturalLanguageEditRequestSchema } from '@whiteboard/shared';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const validated = NaturalLanguageEditRequestSchema.parse(json);
    const elements = json.elements || [];

    const plan = await aiService.naturalLanguageEdit({
      instruction: validated.instruction,
      elements,
      scope: {
        type: validated.scope,
        targetIds: validated.scope === 'selection' ? validated.selectedIds : undefined,
      },
    });

    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
