import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider, localStorageProviderInstance } from '@/lib/storage';
import path from 'path';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const key = searchParams.get('key');
  const expires = searchParams.get('expires');
  const op = searchParams.get('op');
  const sig = searchParams.get('sig');

  if (!key || !expires || !op || !sig) {
    return NextResponse.json({ error: 'Paramètres de signature manquants' }, { status: 400 });
  }

  // Vérifier la signature si le driver local est utilisé
  getStorageProvider();
  if (localStorageProviderInstance) {
    const isValid = localStorageProviderInstance.verifySignature(
      key,
      parseInt(expires, 10),
      op,
      sig
    );

    if (!isValid) {
      return NextResponse.json({ error: 'URL signée invalide ou expirée' }, { status: 403 });
    }

    try {
      const buffer = await localStorageProviderInstance.getFileStream(key);
      const ext = path.extname(key).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.mp4') contentType = 'video/mp4';
      else if (ext === '.webm') contentType = 'video/webm';
      else if (ext === '.mp3') contentType = 'audio/mpeg';

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
    }
  }

  return NextResponse.json({ error: 'Provider non supporté en direct' }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const key = searchParams.get('key');
  const expires = searchParams.get('expires');
  const op = searchParams.get('op');
  const sig = searchParams.get('sig');

  if (!key || !expires || !op || !sig || op !== 'putObject') {
    return NextResponse.json({ error: 'Paramètres invalides pour téléversement' }, { status: 400 });
  }

  getStorageProvider();
  if (localStorageProviderInstance) {
    const isValid = localStorageProviderInstance.verifySignature(
      key,
      parseInt(expires, 10),
      op,
      sig
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Signature invalide ou expirée' }, { status: 403 });
    }

    const data = await req.arrayBuffer();
    const mimeType = req.headers.get('content-type') || 'application/octet-stream';

    await localStorageProviderInstance.put({
      key,
      buffer: Buffer.from(data),
      mimeType,
    });

    return NextResponse.json({ success: true, key });
  }

  return NextResponse.json({ error: 'Provider non supporté' }, { status: 400 });
}
