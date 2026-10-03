import { StorageProvider } from '@whiteboard/shared';
import { S3StorageProvider } from './s3-provider';
import { LocalStorageProvider } from './local-provider';

let storageInstance: StorageProvider | null = null;
export let localStorageProviderInstance: LocalStorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (storageInstance) return storageInstance;

  const driver = process.env.STORAGE_DRIVER || 'local';

  if (driver === 's3') {
    storageInstance = new S3StorageProvider();
  } else {
    const local = new LocalStorageProvider();
    localStorageProviderInstance = local;
    storageInstance = local;
  }

  return storageInstance;
}
