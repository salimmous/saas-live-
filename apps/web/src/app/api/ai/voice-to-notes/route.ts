import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/ai-service';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let audioBuffer: Buffer;
    let mimeType = 'audio/webm';
    let originX = 250;
    let originY = 250;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'Fichier audio requis.' }, { status: 400 });
      }
      mimeType = file.type || 'audio/webm';
      const arrayBuffer = await file.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      originX = parseFloat(formData.get('originX') as string) || 250;
      originY = parseFloat(formData.get('originY') as string) || 250;
    } else {
      const body = await req.json();
      if (!body.audioBase64) {
        return NextResponse.json({ error: 'Audio base64 requis.' }, { status: 400 });
      }
      audioBuffer = Buffer.from(body.audioBase64, 'base64');
      mimeType = body.mimeType || 'audio/webm';
      originX = body.originX || 250;
      originY = body.originY || 250;
    }

    const result = await aiService.transcribeVoiceToNotes({
      audioBuffer,
      mimeType,
      originX,
      originY,
    });

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      plan: result.plan,
    });
  } catch (error: any) {
    console.error('Erreur voice-to-notes:', error);
    return NextResponse.json(
      { error: error.message || 'Impossible de transcrire l’audio.' },
      { status: 500 }
    );
  }
}
