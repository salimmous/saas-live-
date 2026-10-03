import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';
import { TransformToActionPlanRequestSchema } from '@whiteboard/shared';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const validated = TransformToActionPlanRequestSchema.parse(json);
    const elements = json.elements || [];

    const selectedElements = elements.filter((e: any) => validated.selectedIds.includes(e.id));

    const plan = await aiService.transformToActionPlan({
      selectedElements,
    });

    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
