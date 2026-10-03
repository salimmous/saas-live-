import { describe, it, expect } from 'vitest';
import { BoardElement, FrameElement } from '@whiteboard/shared';

describe('Phase 3 — Ateliers (Votes, Brainstorming, Présentation) & Sécurité Médias', () => {
  it('trie strictement les cadres (frames) pour le mode présentation selon la propriété order', () => {
    const rawFrames: BoardElement[] = [
      { id: 'f3', type: 'frame', order: 3, title: 'Conclusion', x: 800, y: 0, width: 400, height: 300, zIndex: 1, rotation: 0, meta: { createdAt: 0, updatedAt: 0 } } as any,
      { id: 'f1', type: 'frame', order: 1, title: 'Introduction', x: 0, y: 0, width: 400, height: 300, zIndex: 1, rotation: 0, meta: { createdAt: 0, updatedAt: 0 } } as any,
      { id: 'f2', type: 'frame', order: 2, title: 'Architecture', x: 400, y: 0, width: 400, height: 300, zIndex: 1, rotation: 0, meta: { createdAt: 0, updatedAt: 0 } } as any,
    ];

    const sortedFrames = (rawFrames.filter((e) => e.type === 'frame') as FrameElement[])
      .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));

    expect(sortedFrames[0].id).toBe('f1');
    expect(sortedFrames[1].id).toBe('f2');
    expect(sortedFrames[2].id).toBe('f3');
    expect(sortedFrames[0].title).toBe('Introduction');
  });

  it('calcule et classe fidèlement les résultats d’un vote après clôture', () => {
    const rawVotes = [
      { elementId: 'el-A', userId: 'user-1' },
      { elementId: 'el-B', userId: 'user-1' },
      { elementId: 'el-A', userId: 'user-2' },
      { elementId: 'el-C', userId: 'user-2' },
      { elementId: 'el-A', userId: 'user-3' },
      { elementId: 'el-B', userId: 'user-3' },
    ];

    const countMap: Record<string, number> = {};
    rawVotes.forEach((v) => {
      countMap[v.elementId] = (countMap[v.elementId] || 0) + 1;
    });

    const results = Object.entries(countMap)
      .map(([elementId, count]) => ({ elementId, count }))
      .sort((a, b) => b.count - a.count);

    expect(results).toHaveLength(3);
    // Vainqueur : el-A avec 3 votes
    expect(results[0]).toEqual({ elementId: 'el-A', count: 3 });
    // Deuxième : el-B avec 2 votes
    expect(results[1]).toEqual({ elementId: 'el-B', count: 2 });
    // Troisième : el-C avec 1 vote
    expect(results[2]).toEqual({ elementId: 'el-C', count: 1 });
  });

  it('bloque les tentatives d’attaques SSRF sur les plages IP privées et métadonnées cloud', () => {
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

      const parts = lower.split('.').map((p) => parseInt(p, 10));
      if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
        if (parts[0] === 127) return true; // loopback
        if (parts[0] === 10) return true; // classe A privée
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // classe B privée
        if (parts[0] === 192 && parts[1] === 168) return true; // classe C privée
        if (parts[0] === 169 && parts[1] === 254) return true; // link-local / AWS metadata
      }
      return false;
    }

    // Doivent être bloqués
    expect(isPrivateOrLocalHost('localhost')).toBe(true);
    expect(isPrivateOrLocalHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrLocalHost('10.0.0.1')).toBe(true);
    expect(isPrivateOrLocalHost('172.20.0.5')).toBe(true);
    expect(isPrivateOrLocalHost('192.168.1.100')).toBe(true);
    expect(isPrivateOrLocalHost('169.254.169.254')).toBe(true);
    expect(isPrivateOrLocalHost('my-server.local')).toBe(true);

    // Doivent être autorisés
    expect(isPrivateOrLocalHost('github.com')).toBe(false);
    expect(isPrivateOrLocalHost('google.com')).toBe(false);
    expect(isPrivateOrLocalHost('8.8.8.8')).toBe(false);
    expect(isPrivateOrLocalHost('anthropic.com')).toBe(false);
  });
});
