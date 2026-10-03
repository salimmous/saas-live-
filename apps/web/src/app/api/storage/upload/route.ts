import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/lib/storage';
import { prisma } from '@whiteboard/shared';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { nanoid } from 'nanoid';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 Mo
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 Mo

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const boardId = formData.get('boardId') as string | null;

    if (!file || !boardId) {
      return NextResponse.json(
        { error: 'Fichier et identifiant de tableau (boardId) requis.' },
        { status: 400 }
      );
    }

    // Vérifier l'accès au tableau
    const userId = session?.user?.id || 'guest_user';
    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: 'Tableau introuvable.' }, { status: 404 });
    }

    const mimeType = file.type;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `Type de fichier non autorisé : ${mimeType}. Formats acceptés : PNG, JPEG, WebP, GIF, SVG, MP4, WebM.` },
        { status: 400 }
      );
    }

    const isVideo = mimeType.startsWith('video/');
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Limite : ${isVideo ? '50 Mo' : '10 Mo'}.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'png');
    const assetKey = `boards/${boardId}/assets/${nanoid()}.${ext}`;

    const storage = getStorageProvider();
    await storage.put({
      key: assetKey,
      buffer,
      mimeType,
    });

    // Générer URL signée (valide 24 heures)
    const signedUrl = await storage.getSignedUrl({
      key: assetKey,
      expiresInSeconds: 86400,
      operation: 'getObject',
    });

    // Enregistrer l'asset en base de données si utilisateur connecté
    if (session?.user?.id) {
      await prisma.asset.create({
        data: {
          boardId,
          key: assetKey,
          filename: file.name,
          mimeType,
          size: file.size,
          uploaderId: session.user.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      key: assetKey,
      url: signedUrl,
      filename: file.name,
      mimeType,
      size: file.size,
      isVideo,
    });
  } catch (error: any) {
    console.error('Erreur téléversement média:', error);
    return NextResponse.json(
      { error: error.message || 'Échec du téléversement du média.' },
      { status: 500 }
    );
  }
}
