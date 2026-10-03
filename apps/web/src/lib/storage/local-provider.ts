import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider } from '@whiteboard/shared';

export class LocalStorageProvider implements StorageProvider {
  name = 'local-fs';
  private baseDir: string;
  private secret: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || './storage/uploads');
    this.secret = process.env.BETTER_AUTH_SECRET || 'local-storage-secret-signing-key-32chars';
  }

  private async ensureDir() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async put(params: {
    key: string;
    buffer: Buffer | Uint8Array;
    mimeType: string;
    metadata?: Record<string, string>;
  }): Promise<{ key: string; publicUrl?: string }> {
    await this.ensureDir();
    const filePath = path.join(this.baseDir, path.basename(params.key));
    await fs.writeFile(filePath, params.buffer);
    return { key: params.key };
  }

  async getSignedUrl(params: {
    key: string;
    expiresInSeconds: number;
    operation: 'getObject' | 'putObject';
  }): Promise<string> {
    const expires = Date.now() + params.expiresInSeconds * 1000;
    const hmac = crypto
      .createHmac('sha256', this.secret)
      .update(`${params.key}:${expires}:${params.operation}`)
      .digest('hex');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${appUrl}/api/storage/file?key=${encodeURIComponent(params.key)}&expires=${expires}&op=${params.operation}&sig=${hmac}`;
  }

  async delete(params: { key: string }): Promise<void> {
    try {
      const filePath = path.join(this.baseDir, path.basename(params.key));
      await fs.unlink(filePath);
    } catch {
      // Ignorer si le fichier n'existe pas
    }
  }

  verifySignature(key: string, expires: number, op: string, sig: string): boolean {
    if (Date.now() > expires) return false;
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(`${key}:${expires}:${op}`)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }

  async getFileStream(key: string) {
    const filePath = path.join(this.baseDir, path.basename(key));
    return await fs.readFile(filePath);
  }
}
