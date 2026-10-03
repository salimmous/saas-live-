import { z } from 'zod';

export interface AIProvider {
  name: string;
  generateStructured<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T>;
  }): Promise<T>;
  analyzeImage<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    imageBase64: string;
    mimeType: string;
    schema: z.ZodType<T>;
  }): Promise<T>;
}

export interface TranscriptionProvider {
  name: string;
  transcribe(params: {
    audioBuffer: Buffer | Uint8Array;
    mimeType: string;
    language?: string;
  }): Promise<{ text: string; segments?: Array<{ start: number; end: number; text: string }> }>;
}

export interface StorageProvider {
  name: string;
  put(params: {
    key: string;
    buffer: Buffer | Uint8Array;
    mimeType: string;
    metadata?: Record<string, string>;
  }): Promise<{ key: string; publicUrl?: string }>;
  getSignedUrl(params: {
    key: string;
    expiresInSeconds: number;
    operation: 'getObject' | 'putObject';
  }): Promise<string>;
  delete(params: { key: string }): Promise<void>;
}

export interface VideoProvider {
  name: string;
  upload(params: {
    key: string;
    buffer: Buffer | Uint8Array;
    mimeType: string;
  }): Promise<{ key: string }>;
  getPlaybackUrl(params: { key: string }): Promise<string>;
  delete(params: { key: string }): Promise<void>;
}
