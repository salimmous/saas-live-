import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider } from '@whiteboard/shared';

export class S3StorageProvider implements StorageProvider {
  name = 's3-minio';
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'whiteboard-assets';
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    });
  }

  async put(params: {
    key: string;
    buffer: Buffer | Uint8Array;
    mimeType: string;
    metadata?: Record<string, string>;
  }): Promise<{ key: string; publicUrl?: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.mimeType,
        Metadata: params.metadata,
      })
    );

    return { key: params.key };
  }

  async getSignedUrl(params: {
    key: string;
    expiresInSeconds: number;
    operation: 'getObject' | 'putObject';
  }): Promise<string> {
    const command =
      params.operation === 'putObject'
        ? new PutObjectCommand({ Bucket: this.bucket, Key: params.key })
        : new GetObjectCommand({ Bucket: this.bucket, Key: params.key });

    return await getSignedUrl(this.client, command, {
      expiresIn: params.expiresInSeconds,
    });
  }

  async delete(params: { key: string }): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
      })
    );
  }
}
