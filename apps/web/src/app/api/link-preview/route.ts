import { NextRequest, NextResponse } from 'next/server';

/**
 * Validation SSRF stricte : interdire les réseaux locaux, privés et de métadonnées cloud
 */
function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  // Vérifier les blocs IPv4 privés
  const parts = lower.split('.').map((p) => parseInt(p, 10));
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL requise.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL invalide.' }, { status: 400 });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Protocole non supporté. Seuls HTTP et HTTPS sont autorisés.' },
        { status: 400 }
      );
    }

    if (isPrivateOrLocalHost(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: 'Accès refusé : les adresses IP privées et locales sont interdites pour des raisons de sécurité (SSRF).' },
        { status: 403 }
      );
    }

    // Requête HTTP avec timeout court et limite de taille
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhiteboardPreviewBot/1.0; +https://whiteboard.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({
        title: parsedUrl.hostname,
        description: parsedUrl.href,
        url: parsedUrl.href,
        siteName: parsedUrl.hostname,
      });
    }

    const html = await response.text();

    // Extraire les balises OpenGraph et standard via regex sécurisée
    const getMetaContent = (prop: string): string => {
      const match1 = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'));
      if (match1) return match1[1];
      const match2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
      if (match2) return match2[1];
      const match3 = html.match(new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'));
      if (match3) return match3[1];
      return '';
    };

    const ogTitle = getMetaContent('og:title');
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitle || (titleMatch ? titleMatch[1].trim() : parsedUrl.hostname);

    const ogDescription = getMetaContent('og:description');
    const metaDescription = getMetaContent('description');
    const description = ogDescription || metaDescription || parsedUrl.hostname;

    let ogImage = getMetaContent('og:image');
    if (ogImage && !ogImage.startsWith('http')) {
      ogImage = new URL(ogImage, parsedUrl.origin).href;
    }

    const favicon = `${parsedUrl.origin}/favicon.ico`;
    const siteName = getMetaContent('og:site_name') || parsedUrl.hostname;

    return NextResponse.json({
      title: title.slice(0, 100),
      description: description.slice(0, 200),
      image: ogImage || null,
      favicon,
      siteName,
      url: parsedUrl.href,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Impossible de récupérer l’aperçu du lien.' },
      { status: 500 }
    );
  }
}
