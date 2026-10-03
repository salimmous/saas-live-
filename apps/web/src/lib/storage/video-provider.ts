import { VideoProvider } from '@whiteboard/shared';
import { getStorageProvider } from './index';

export class LocalVideoProvider implements VideoProvider {
  name = 'local-video-v1';

  async upload(params: {
    key: string;
    buffer: Buffer | Uint8Array;
    mimeType: string;
  }): Promise<{ key: string }> {
    const storage = getStorageProvider();
    await storage.put({
      key: params.key,
      buffer: params.buffer,
      mimeType: params.mimeType,
    });
    return { key: params.key };
  }

  async getPlaybackUrl(params: { key: string }): Promise<string> {
    const storage = getStorageProvider();
    // URL signée pour une durée de 2 heures de lecture
    return await storage.getSignedUrl({
      key: params.key,
      expiresInSeconds: 7200,
      operation: 'getObject',
    });
  }

  async delete(params: { key: string }): Promise<void> {
    const storage = getStorageProvider();
    await storage.delete(params);
  }
}

export const videoProvider = new LocalVideoProvider();
