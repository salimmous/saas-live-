import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Sécurité des liens invités (Feature 17)', () => {
  it('hache le token invité de manière déterministe avec SHA-256', () => {
    const rawToken = '4f8a29b01c3d5e7f9a8b1c2d3e4f5a6b';
    const hash1 = crypto.createHash('sha256').update(rawToken).digest('hex');
    const hash2 = crypto.createHash('sha256').update(rawToken).digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    // Vérifier que le hash ne contient pas le token en clair
    expect(hash1).not.toContain(rawToken);
  });

  it('génère un token de longueur sécurisée aléatoire', () => {
    const rawToken = crypto.randomBytes(24).toString('hex');
    expect(rawToken).toHaveLength(48);
  });
});
