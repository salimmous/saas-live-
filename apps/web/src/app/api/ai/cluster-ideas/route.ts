import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';
import { ClusterIdeasRequestSchema } from '@whiteboard/shared';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const validated = ClusterIdeasRequestSchema.parse(json);
    const elements = json.elements || [];

    const plan = await aiService.clusterIdeas({
      elements,
      selectedIds: validated.selectedIds,
    });

    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
