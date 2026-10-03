import { NextRequest, NextResponse } from 'next/server';
import { parseDocumentToBoard } from '@/lib/ai/doc-parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const format = (formData.get('format') as any) || 'mindmap';
    const boardId = (formData.get('boardId') as string) || '';
    const textContent = formData.get('textContent') as string | null;
    const file = formData.get('file') as File | null;

    if (!file && !textContent) {
      return NextResponse.json(
        { error: 'Veuillez fournir un fichier (TXT, DOCX, PDF) ou du texte collé.' },
        { status: 400 }
      );
    }

    let buffer: Buffer | undefined;
    let filename = 'Document-texte.txt';
    let mimeType = 'text/plain';

    if (file) {
      filename = file.name;
      mimeType = file.type;
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const plan = await parseDocumentToBoard({
      buffer,
      text: textContent || undefined,
      filename,
      mimeType,
      format,
      boardId,
    });

    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
