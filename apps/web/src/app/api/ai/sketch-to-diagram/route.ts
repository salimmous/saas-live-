import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let imageBase64 = '';
    let mimeType = 'image/png';
    let originX = 250;
    let originY = 200;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'Fichier image de croquis requis.' }, { status: 400 });
      }
      mimeType = file.type || 'image/png';
      const arrayBuffer = await file.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString('base64');
      originX = parseFloat(formData.get('originX') as string) || 250;
      originY = parseFloat(formData.get('originY') as string) || 200;
    } else {
      const body = await req.json();
      imageBase64 = body.imageBase64 || '';
      mimeType = body.mimeType || 'image/png';
      originX = body.originX || 250;
      originY = body.originY || 200;
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'Données image base64 requises.' }, { status: 400 });
    }

    const result = await aiService.convertSketchToDiagram({
      imageBase64,
      mimeType,
      originX,
      originY,
    });

    return NextResponse.json({
      success: true,
      confidence: result.confidence,
      plan: result.plan,
    });
  } catch (error: any) {
    console.error('Erreur sketch-to-diagram:', error);
    return NextResponse.json(
      { error: error.message || 'Impossible d’analyser le croquis.' },
      { status: 500 }
    );
  }
}
